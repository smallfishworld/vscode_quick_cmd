'use strict';
const { t } = require('./i18n');
const { emptyConfig, validateConfig } = require('./model');
const { loadDefaultConfig } = require('./defaults');
const GLOBAL_KEY = 'quickCmd.globalConfig';

/** One global command collection. Project files are neither read nor written. */
class ConfigStore {
  constructor(vscode, context) {
    this.context = context;
    this.pending = Promise.resolve();
    this.initialization = null;
  }
  scopes() {
    return [{ type: 'global', id: 'global', label: t('Global commands') }];
  }
  /**
   * Seed defaults exactly once for installations without a persisted config.
   * A saved empty collection counts as existing user data; never overwrite it.
   */
  initializeDefaults(locale) {
    if (this.initialization) {
      return this.initialization;
    }
    const task = this.pending.catch(() => {}).then(async () => {
      const saved = this.context.globalState.get(GLOBAL_KEY);
      if (saved !== undefined) {
        validateConfig(structuredClone(saved));
        return false;
      }
      const preset = loadDefaultConfig(this.context.extensionPath, locale);
      await this.context.globalState.update(GLOBAL_KEY, structuredClone(preset));
      return true;
    });
    this.initialization = task;
    this.pending = task;
    return task;
  }
  async read() {
    // Views and commands must not observe an empty placeholder while seeding.
    if (this.initialization) {
      await this.initialization;
    }
    return this.readStored();
  }
  readStored() {
    return validateConfig(
      structuredClone(this.context.globalState.get(GLOBAL_KEY, emptyConfig())),
    );
  }
  async write(_scope, config) {
    validateConfig(config);
    await this.context.globalState.update(GLOBAL_KEY, config);
  }
  /** Serialize all global read-modify-write operations. */
  async update(scope, transform) {
    const current = this.pending
      .catch(() => {})
      .then(async () => {
        const config = this.readStored();
        const result = await transform(config);
        await this.write(scope, config);
        return result;
      });
    this.pending = current;
    return current;
  }
}
module.exports = { ConfigStore };
