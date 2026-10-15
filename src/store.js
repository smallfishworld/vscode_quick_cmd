'use strict';
const { t } = require('./i18n');
const { emptyConfig, validateConfig } = require('./model');
const GLOBAL_KEY = 'quickCmd.globalConfig';

/** One global command collection. Project files are neither read nor written. */
class ConfigStore {
  constructor(vscode, context) {
    this.context = context;
    this.pending = Promise.resolve();
  }
  scopes() {
    return [{ type: 'global', id: 'global', label: t('Global commands') }];
  }
  async read() {
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
        const config = await this.read();
        const result = await transform(config);
        await this.write(scope, config);
        return result;
      });
    this.pending = current;
    return current;
  }
}
module.exports = { ConfigStore };
