const MessageBoards = (() => {
  const coordinates = typeof module === 'undefined' ? GridCoordinates : require('./grid_coordinates.js');
  const fog = typeof module === 'undefined' ? FogOfWar : require('./fog_of_war.js');

  class Model {
    constructor({ configs, progress }) {
      this.configs = configs;
      this.progress = progress;
    }

    resolve(address) {
      for (const [layer, conf] of Object.entries(this.configs)) {
        const cell = coordinates.resolve(conf, address);
        if (cell) return { ...cell, layer };
      }
      return null;
    }

    spoilers(boardId, settings) {
      if (boardId === 'general') return [];
      const cell = this.resolve(boardId);
      if (!cell) return ['Unknown cell'];
      const reasons = [];
      if (fog.isObscured(settings, cell.screen)) reasons.push('Unexplored screen');
      if ([...(this.progress.cells.get(cell.address) || [])].some(id => settings.markedItems?.[id] !== true)) {
        reasons.push('Unsolved puzzle');
      }
      return reasons;
    }
  }

  class Panel {
    constructor({ root, toggle, account, model, getSettings, onSelectCell }) {
      this.root = root;
      this.toggle = toggle;
      this.account = account;
      this.model = model;
      this.getSettings = getSettings;
      this.onSelectCell = onSelectCell;
      this.mode = 'cells';
      this.cell = null;
      this.records = new Map();
      this.revealed = new Set();
      this.drafts = new Map();
      this.generation = 0;
      this.sending = false;
      this.list = root.querySelector('.message-list');
      this.status = root.querySelector('.message-status');
      this.input = root.querySelector('textarea');
      this.sendButton = root.querySelector('[data-message-action="send"]');
      this.olderButton = root.querySelector('[data-message-action="older"]');
      toggle.addEventListener('click', () => this.setOpen(root.hidden));
      root.querySelector('[data-message-action="close"]').addEventListener('click', () => this.setOpen(false));
      root.querySelector('[data-message-action="all"]').addEventListener('click', () => this.selectCell(null));
      root.querySelector('[data-message-action="retry"]').addEventListener('click', () => this.subscribe());
      root.querySelector('[data-message-action="older"]').addEventListener('click', () => this.loadOlder());
      root.querySelectorAll('[data-message-mode]').forEach(button => button.addEventListener('click', () => {
        this.mode = button.dataset.messageMode;
        this.subscribe();
      }));
      this.input.addEventListener('input', () => {
        this.drafts.set(this.boardId(), this.input.value);
        this.updateComposer();
      });
      root.querySelector('form').addEventListener('submit', event => {
        event.preventDefault();
        this.send();
      });
      root.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          this.setOpen(false);
          toggle.focus();
          event.preventDefault();
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.target === this.input) {
          event.preventDefault();
          this.send();
        }
        event.stopPropagation();
      });
      for (const name of ['keyup', 'keypress']) root.addEventListener(name, event => event.stopPropagation());
      window.addEventListener('online', () => this.updateComposer());
      window.addEventListener('offline', () => this.updateComposer());
      window.addEventListener('beforeunload', event => {
        if (this.sending) {
          event.preventDefault();
          event.returnValue = '';
        }
      });
    }

    boardId() {
      return this.mode === 'general' ? 'general' : this.cell?.address || 'all';
    }

    setOpen(open) {
      this.root.hidden = !open;
      this.toggle.setAttribute('aria-expanded', String(open));
      this.toggle.setAttribute('aria-label', open ? 'Close Messages' : 'Open Messages');
      if (open) this.subscribe();
      else {
        this.generation++;
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.revealed.clear();
      }
      this.onSelectCell(open && this.mode === 'cells' ? this.cell : null);
    }

    selectCell(address, open = false) {
      const cell = address === null ? null : this.model.resolve(address);
      if (address !== null && !cell) throw new Error('This cell address is outside the map.');
      this.cell = cell;
      this.mode = 'cells';
      if (open && this.root.hidden) this.setOpen(true);
      else if (!this.root.hidden) this.subscribe();
    }

    clearCell() {
      this.cell = null;
      if (!this.root.hidden) this.subscribe();
    }

    showError(error) {
      console.error('Message board error:', error);
      this.status.textContent = `Messages: ${error.message || String(error)}`;
      this.status.classList.add('message-error');
      this.root.querySelector('[data-message-action="retry"]').hidden = false;
    }

    subscribe() {
      const generation = ++this.generation;
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.records.clear();
      this.revealed.clear();
      this.cursor = null;
      this.serverReady = false;
      this.hasMore = false;
      this.loadingOlder = false;
      this.status.classList.remove('message-error');
      this.root.querySelector('[data-message-action="retry"]').hidden = true;
      this.status.textContent = this.account.user ? 'Loading messages...' : 'Sign in with Google to read and post messages.';
      this.render();
      this.onSelectCell(this.mode === 'cells' ? this.cell : null);
      if (!this.account.user) return;
      const client = this.account.client?.messages;
      if (!client) {
        this.showError(new Error('Messaging could not initialize. Reload the app and retry.'));
        return;
      }
      this.unsubscribe = client.listen(this.boardId(), result => {
        if (generation !== this.generation) return;
        if (!result.fromCache && !this.serverReady) {
          this.records.clear();
          this.cursor = result.cursor;
          this.hasMore = result.hasMore;
          this.serverReady = true;
        }
        const current = new Set(result.messages.map(message => message.id));
        for (const [id, message] of this.records) {
          if (message.pending && !current.has(id)) this.records.delete(id);
        }
        for (const message of result.messages) this.records.set(message.id, message);
        this.status.classList.remove('message-error');
        this.root.querySelector('[data-message-action="retry"]').hidden = true;
        this.status.textContent = result.fromCache ? 'Showing cached messages; waiting for a connection.' : '';
        this.render();
      }, error => {
        if (generation !== this.generation) return;
        this.records.clear();
        this.hasMore = false;
        this.render();
        this.showError(error);
      });
    }

    async loadOlder() {
      if (!this.cursor || this.loadingOlder || !this.serverReady) return;
      const generation = this.generation;
      this.loadingOlder = true;
      this.render();
      try {
        const result = await this.account.client.messages.older(this.boardId(), this.cursor);
        if (generation !== this.generation) return;
        for (const message of result.messages) this.records.set(message.id, message);
        this.cursor = result.cursor;
        this.hasMore = result.hasMore;
      } catch (error) {
        if (generation === this.generation) this.showError(error);
      } finally {
        if (generation === this.generation) {
          this.loadingOlder = false;
          this.render(true);
        }
      }
    }

    async send() {
      const boardId = this.boardId();
      const draft = this.drafts.get(boardId) || '';
      if (this.sending || !this.account.user || boardId === 'all' || !draft.trim()) return;
      if (!navigator.onLine) {
        this.showError(new Error('Reconnect to send your message. Your draft is retained.'));
        return;
      }
      this.sending = true;
      this.updateComposer();
      try {
        await this.account.client.messages.send(boardId, draft);
        if (this.drafts.get(boardId) === draft) this.drafts.delete(boardId);
      } catch (error) {
        this.showError(error);
      } finally {
        this.sending = false;
        const draft = this.drafts.get(this.boardId()) || '';
        if (this.input.value !== draft) this.input.value = draft;
        this.updateComposer();
      }
    }

    updateComposer() {
      const boardId = this.boardId();
      this.input.disabled = !this.account.user || boardId === 'all' || this.sending;
      this.input.placeholder = !this.account.user ? 'Sign in to post'
        : boardId === 'all' ? 'Select a cell on the map to start a discussion'
          : boardId === 'general' ? 'Message the group...' : `Message ${boardId}...`;
      this.sendButton.disabled = this.input.disabled || !this.input.value.trim() || !navigator.onLine;
      this.sendButton.textContent = this.sending ? 'Sending...' : 'Send';
      this.root.querySelector('.message-author').textContent = this.account.user
        ? `Posting as ${this.account.user.displayName || 'your Google profile'}` : '';
    }

    render(prepend = false) {
      const nearBottom = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 40;
      const scrollTop = this.list.scrollTop;
      const previousHeight = this.list.scrollHeight;
      this.root.querySelectorAll('[data-message-mode]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.messageMode === this.mode));
      });
      this.root.querySelector('.message-selection').textContent = this.mode === 'general'
        ? 'General Chat' : this.cell ? `Cell: ${this.cell.address}` : 'Latest messages from all cells';
      this.root.querySelector('[data-message-action="all"]').hidden = this.mode === 'general' || !this.cell;
      this.olderButton.hidden = !this.hasMore;
      this.olderButton.disabled = this.loadingOlder || !this.serverReady;
      this.olderButton.textContent = this.loadingOlder ? 'Loading...' : 'Load Older Messages';
      this.input.value = this.drafts.get(this.boardId()) || '';
      this.updateComposer();
      const fragment = document.createDocumentFragment();
      const messages = [...this.records.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      for (const message of messages) {
        const article = document.createElement('article');
        article.className = 'board-message';
        article.dataset.messageId = message.id;
        const heading = document.createElement('header');
        const author = document.createElement('strong');
        author.textContent = message.authorName;
        const time = document.createElement('time');
        const date = new Date(message.createdAt);
        time.dateTime = date.toISOString();
        time.textContent = message.pending ? 'Sending...' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        heading.append(author, time);
        article.append(heading);
        if (message.boardId !== 'general') {
          const address = document.createElement('button');
          address.type = 'button';
          address.className = 'message-address';
          address.textContent = message.boardId;
          address.addEventListener('click', () => this.selectCell(message.boardId));
          article.append(address);
        }
        const reasons = this.model.spoilers(message.boardId, this.getSettings());
        if (reasons.length && !this.revealed.has(message.id)) {
          const spoiler = document.createElement('div');
          spoiler.className = 'message-spoiler';
          const explanation = document.createElement('span');
          explanation.textContent = `${reasons.join(' / ')} — message obscured`;
          const reveal = document.createElement('button');
          reveal.type = 'button';
          reveal.textContent = 'Show Spoiler';
          reveal.addEventListener('click', () => {
            this.revealed.add(message.id);
            this.render();
          });
          spoiler.append(explanation, reveal);
          article.append(spoiler);
        } else {
          const body = document.createElement('p');
          body.className = 'message-text';
          body.textContent = message.text;
          article.append(body);
          if (reasons.length) {
            const hide = document.createElement('button');
            hide.type = 'button';
            hide.className = 'message-hide-spoiler';
            hide.textContent = 'Hide Spoiler';
            hide.addEventListener('click', () => { this.revealed.delete(message.id); this.render(); });
            article.append(hide);
          }
        }
        fragment.append(article);
      }
      if (!messages.length) {
        const empty = document.createElement('p');
        empty.className = 'message-empty';
        empty.textContent = 'No messages loaded.';
        fragment.append(empty);
      }
      this.list.replaceChildren(fragment);
      this.list.scrollTop = nearBottom ? this.list.scrollHeight
        : scrollTop + (prepend ? Math.max(0, this.list.scrollHeight - previousHeight) : 0);
    }
  }

  return { Model, Panel };
})();

if (typeof module !== 'undefined') module.exports = MessageBoards;
