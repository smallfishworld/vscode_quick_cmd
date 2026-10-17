'use strict';
const { randomUUID } = require('node:crypto');
const { t } = require('./i18n');
const { emptyConfig, validateConfig } = require('./model');
const { loadDefaultConfig } = require('./defaults');

/**
 * One JSON-backed global command collection, isolated to this extension's
 * VS Code global storage directory. No workspace or legacy database access.
 */
class ConfigStore {
  constructor(vscode, context) {
    this.fs = vscode.workspace.fs;
    this.context = context;
    this.baseUri = context.globalStorageUri;
    this.configUri = vscode.Uri.joinPath(this.baseUri, 'config.json');
    this.Uri = vscode.Uri;
    this.pending = Promise.resolve();
    this.initialization = null;
  }
  scopes() {
    return [{ type: 'global', id: 'global', label: t('Global commands') }];
  }
  async exists() {
    try {
      await this.fs.stat(this.configUri);
      return true;
    } catch (error) {
      if (error.code === 'FileNotFound') {
        return false;
      }
      throw error;
    }
  }
  /** Only a missing file is an empty collection; invalid JSON stays an error. */
  async readStored() {
    let bytes;
    try {
      bytes = await this.fs.readFile(this.configUri);
    } catch (error) {
      if (error.code === 'FileNotFound') {
        return emptyConfig();
      }
      throw error;
    }
    return validateConfig(JSON.parse(new TextDecoder().decode(bytes)));
  }
  /** Write adjacent temporary file then rename, keeping old JSON on failure. */
  async writeStored(config) {
    validateConfig(config);
    await this.fs.createDirectory(this.baseUri);
    const temporaryUri = this.Uri.joinPath(this.baseUri, `.config.${randomUUID()}.tmp`);
    try {
      const bytes = new TextEncoder().encode(`${JSON.stringify(config, null, 2)}\n`);
      await this.fs.writeFile(temporaryUri, bytes);
      await this.fs.rename(temporaryUri, this.configUri, { overwrite: true });
    } catch (error) {
      try {
        await this.fs.delete(temporaryUri);
      } catch {
        // Preserve the original error; a temporary-file cleanup is best effort.
      }
      throw error;
    }
  }
  /**
   * Populate the packaged bilingual defaults only when config.json is absent.
   * Existing empty JSON is intentional and must never be overwritten.
   */
  initializeDefaults(locale) {
    if (this.initialization) {
      return this.initialization;
    }
    const task = this.pending.catch(() => {}).then(async () => {
      if (await this.exists()) {
        await this.readStored(); // Report malformed files rather than replacing.
        return false;
      }
      const preset = loadDefaultConfig(this.context.extensionPath, locale);
      await this.writeStored(preset);
      return true;
    });
    this.initialization = task;
    this.pending = task;
    return task;
  }
  async read() {
    if (this.initialization) {
      await this.initialization;
    }
    return this.readStored();
  }
  /** Serialize read, modification and atomic JSON replacement in this host. */
  async update(scope, transform) {
    const current = this.pending.catch(() => {}).then(async () => {
      const config = await this.readStored();
      const result = await transform(config);
      await this.writeStored(config);
      return result;
    });
    this.pending = current;
    return current;
  }
}
module.exports = { ConfigStore };
