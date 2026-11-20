const SettingsStorage = (() => {
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  function validate(settings) {
    if (!isRecord(settings)) throw new Error('Settings must be a JSON object.');
    for (const key of ['activeLayers', 'markedItems', 'revealedScreens']) {
      if (settings[key] == null) continue;
      if (!isRecord(settings[key]) || Object.values(settings[key]).some(value => typeof value !== 'boolean')) {
        throw new Error(`${key} must contain boolean settings.`);
      }
    }
    for (const key of ['fogOfWar', 'hideFound']) {
      if (settings[key] != null && typeof settings[key] !== 'boolean') throw new Error(`${key} must be a boolean.`);
    }
    if (settings.center != null && (!Array.isArray(settings.center) || settings.center.length !== 2 || settings.center.some(value => !Number.isFinite(value)))) {
      throw new Error('Map center must contain two finite coordinates.');
    }
    if (settings.zoom != null && !Number.isFinite(settings.zoom)) throw new Error('Map zoom must be a finite number.');
    return settings;
  }

  function encode(settings) {
    return Object.fromEntries(Object.entries(validate(settings)).map(([key, value]) => {
      const encoded = JSON.stringify(value);
      if (encoded === undefined) throw new Error(`Cannot serialize setting: ${key}`);
      return [key, encoded];
    }));
  }

  function decode(values) {
    if (!isRecord(values)) throw new Error('The cloud settings document has invalid values.');
    const settings = Object.fromEntries(Object.entries(values).map(([key, value]) => {
      if (typeof value !== 'string') throw new Error(`Invalid cloud setting: ${key}`);
      return [key, JSON.parse(value)];
    }));
    return validate(settings);
  }

  class Sync {
    constructor({ write, onStatus, initial = null, delay = 750 }) {
      this.write = write;
      this.onStatus = onStatus;
      this.delay = delay;
      this.latest = initial === null ? null : JSON.stringify(encode(initial));
      this.saved = this.latest;
      this.sent = this.latest;
      this.revision = 0;
      this.savedRevision = 0;
      this.errorRevision = 0;
      this.error = null;
      this.pending = new Set();
      this.timer = null;
      this.lastSyncedAt = null;
    }

    status() {
      return {
        dirty: this.latest !== this.saved,
        pending: this.pending.size,
        error: this.error,
        lastSyncedAt: this.lastSyncedAt,
      };
    }

    emit() {
      this.onStatus(this.status());
    }

    save(settings) {
      const snapshot = JSON.stringify(encode(settings));
      if (snapshot === this.latest) return;
      this.latest = snapshot;
      this.revision++;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.send(), this.delay);
      this.emit();
    }

    send() {
      clearTimeout(this.timer);
      this.timer = null;
      if (this.latest === null || this.latest === this.sent) return;
      const snapshot = this.latest;
      const revision = this.revision;
      this.sent = snapshot;
      let operation;
      operation = Promise.resolve().then(() => this.write(JSON.parse(snapshot))).then(() => {
        if (revision >= this.savedRevision) {
          this.saved = snapshot;
          this.savedRevision = revision;
          this.lastSyncedAt = Date.now();
          if (revision >= this.errorRevision) this.error = null;
        }
      }, error => {
        if (revision >= this.savedRevision) {
          this.error = error instanceof Error ? error : new Error(String(error));
          this.errorRevision = revision;
        }
      }).finally(() => {
        this.pending.delete(operation);
        this.emit();
      });
      this.pending.add(operation);
      this.emit();
    }

    async flush() {
      do {
        this.send();
        await Promise.all([...this.pending]);
      } while (this.latest !== this.sent || this.pending.size);
      if (this.error) throw this.error;
    }

    retry() {
      this.sent = null;
      this.revision++;
      this.send();
    }
  }

  return { validate, encode, decode, Sync };
})();

if (typeof module !== 'undefined') module.exports = SettingsStorage;
