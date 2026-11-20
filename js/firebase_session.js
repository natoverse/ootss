const SettingsAccount = (() => {
  function timeout(promise, message) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 15000); }),
    ]).finally(() => clearTimeout(timer));
  }

  class Account {
    constructor({ key, config, onReady, getSettings, exportSettings }) {
      this.key = key;
      this.config = config;
      this.onReady = onReady;
      this.getSettings = getSettings;
      this.exportSettings = exportSettings;
      this.client = null;
      this.sync = null;
      this.user = null;
      this.started = false;
      this.generation = 0;
      this.busy = false;
      this.reloadWhenSynced = false;
      this.error = null;
      this.signInButton = document.getElementById('google-sign-in');
      this.signOutButton = document.getElementById('google-sign-out');
      this.statusButton = document.getElementById('account-status');
      this.notice = document.getElementById('account-notice');
      this.signInButton.addEventListener('click', () => this.signIn());
      this.signOutButton.addEventListener('click', () => this.signOut());
      this.statusButton.addEventListener('click', () => {
        if (this.sync?.status().error) this.sync.retry();
        else if (this.error) location.reload();
      });
      document.getElementById('account-retry').addEventListener('click', () => {
        if (this.reloadWhenSynced) {
          this.showNotice('Retrying cloud settings...');
          this.sync.retry();
        } else location.reload();
      });
      document.getElementById('account-export').addEventListener('click', exportSettings);
      document.getElementById('account-reset-local').addEventListener('click', () => {
        if (confirm('Reset the guest settings saved in this browser?')) {
          localStorage.removeItem(this.key);
          location.reload();
        }
      });
      window.addEventListener('online', () => this.render());
      window.addEventListener('offline', () => this.render());
      window.addEventListener('beforeunload', event => {
        if (!this.sync) return;
        this.sync.send();
        const status = this.sync.status();
        if (status.dirty || status.pending || status.error) {
          event.preventDefault();
          event.returnValue = '';
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.sync?.send();
      });
      document.getElementById('account-control').addEventListener('keydown', event => event.stopPropagation());
      this.notice.addEventListener('keydown', event => event.stopPropagation());
    }

    showNotice(message, retry = false) {
      this.notice.hidden = false;
      document.getElementById('account-message').textContent = message;
      document.getElementById('account-retry').hidden = !retry;
      document.getElementById('account-export').hidden = !this.started;
      document.getElementById('account-reset-local').hidden = Boolean(this.user) || this.started;
    }

    report(error) {
      console.error('Settings account error:', error);
      this.error = error instanceof Error ? error.message : String(error);
      this.render();
    }

    render() {
      const status = this.sync?.status();
      const error = status?.error?.message || this.error;
      const label = error ? 'Sync Error'
        : this.user ? !this.sync ? 'Loading Cloud Settings'
          : !navigator.onLine ? 'Offline'
            : status.dirty || status.pending ? 'Saving...' : 'Synced'
        : 'Guest · Saved in this browser';
      this.statusButton.textContent = label;
      this.statusButton.classList.toggle('account-error', Boolean(error));
      this.statusButton.title = error || (this.user
        ? 'Firebase settings for this Google account. Changes on other devices load when you refresh.'
        : 'Guest progress stays in this browser and is not automatically copied to Google accounts.');
      this.signInButton.hidden = Boolean(this.user);
      this.signInButton.textContent = this.busy && !this.user ? 'Signing in...' : 'Sign in with Google';
      this.signInButton.disabled = !this.client || this.busy;
      this.signInButton.title = this.client ? 'Use your separate Google-account settings'
        : 'Configure Firebase using FIREBASE_SETUP.md to enable Google sign-in';
      this.signOutButton.hidden = !this.user;
      this.signOutButton.disabled = this.busy;
      document.getElementById('account-user').textContent = this.user?.displayName || this.user?.email || '';
      document.getElementById('firebase-setup-link').hidden = Boolean(this.config);
      if (this.reloadWhenSynced && status && !status.dirty && !status.pending && !status.error) {
        this.reloadWhenSynced = false;
        location.reload();
      }
    }

    async start() {
      this.render();
      if (!this.config) {
        await this.connect(null);
        return;
      }
      this.showNotice('Restoring Google session...');
      try {
        const module = await timeout(import('./firebase_client.mjs'), 'Firebase could not load. Guest settings remain available.');
        this.client = await timeout(module.createFirebaseClient(this.config, SettingsStorage.decode), 'Firebase initialization timed out.');
        let restored = false;
        const timer = setTimeout(() => {
          if (restored) return;
          this.report(new Error('Google session restoration timed out. Continuing as a guest; retry sign-in to use cloud settings.'));
          this.connect(null);
        }, 15000);
        this.client.observeAuth(user => {
          restored = true;
          clearTimeout(timer);
          this.connect(user);
        }, error => {
          restored = true;
          clearTimeout(timer);
          this.report(error);
          if (!this.started) this.connect(null);
        });
        this.render();
      } catch (error) {
        this.report(error);
        await this.connect(null);
      }
    }

    async connect(user) {
      const generation = ++this.generation;
      if (this.started) {
        if ((user?.uid || null) !== (this.user?.uid || null)) {
          this.showNotice('Switching between guest and Google-account settings...');
          location.reload();
        }
        return;
      }
      this.user = user;
      this.render();
      try {
        let data;
        if (user) {
          this.showNotice('Loading your cloud settings...');
          data = await timeout(this.client.read(user.uid), 'Cloud settings could not load. Retry or sign out to use guest settings.');
          if (generation !== this.generation) return;
          const uid = user.uid;
          this.sync = new SettingsStorage.Sync({
            initial: data,
            write: values => this.client.write(uid, values),
            onStatus: () => {
              const error = this.sync.status().error;
              if (error && this.reloadWhenSynced) this.showNotice(`Cloud settings are not saved: ${error.message}`, true);
              this.render();
            },
          });
        } else {
          const saved = localStorage.getItem(this.key);
          data = saved ? SettingsStorage.validate(JSON.parse(saved)) : {};
        }
        if (generation !== this.generation) return;
        this.started = true;
        this.notice.hidden = true;
        this.onReady(data || {});
        this.render();
      } catch (error) {
        if (generation !== this.generation) return;
        this.report(error);
        this.showNotice(`Could not load settings: ${this.error}`, true);
      }
    }

    async signIn() {
      this.busy = true;
      this.error = null;
      this.render();
      try {
        await this.client.signIn();
      } catch (error) {
        this.report(error);
      } finally {
        this.busy = false;
        this.render();
      }
    }

    async signOut() {
      this.busy = true;
      this.error = null;
      this.render();
      this.showNotice('Saving changes before signing out...');
      try {
        if (this.sync) await timeout(this.sync.flush(), 'Changes have not synced yet. Stay signed in, reconnect, and retry. You can export a settings backup.');
        if (this.client.messages) await timeout(this.client.messages.flush(), 'Messages have not synced yet. Reconnect before signing out.');
        await this.client.signOut();
      } catch (error) {
        this.report(error);
        if (this.started && !this.reloadWhenSynced) this.notice.hidden = true;
        else this.showNotice(this.error, true);
      } finally {
        this.busy = false;
        this.render();
      }
    }

    async replace() {
      if (!this.sync) {
        localStorage.setItem(this.key, JSON.stringify(SettingsStorage.validate(this.getSettings())));
        location.reload();
        return;
      }
      this.reloadWhenSynced = true;
      this.showNotice('Saving replacement settings to Firebase...');
      this.sync.save(this.getSettings());
      try {
        await timeout(this.sync.flush(), 'Replacement settings are still pending. Reconnect or retry; keep this page open. Export a backup if needed.');
        this.render();
      } catch (error) {
        this.report(error);
        this.showNotice(this.error, true);
        throw error;
      }
    }
  }

  return { Account };
})();
