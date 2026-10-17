'use strict';
const { randomUUID } = require('node:crypto');
const { t } = require('./i18n');
const { emptyConfig, validateConfig } = require('./model');
const { loadDefaultConfig } = require('./defaults');
const { setTimeout: delay } = require('node:timers/promises');

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
    this.coordinationUri = vscode.Uri.joinPath(this.baseUri, 'command-writers');
    this.Uri = vscode.Uri;
    this.pending = Promise.resolve();
    this.initialization = null;
  }
  scopes() {
    return [{ type: 'global', id: 'global', label: t('Global commands') }];
  }
  async publishParticipant(uri, owner) {
    const temporary = this.Uri.joinPath(this.coordinationUri, randomUUID() + '.tmp');
    try {
      await this.fs.writeFile(temporary, new TextEncoder().encode(JSON.stringify(owner)));
      await this.fs.rename(temporary, uri, { overwrite: true });
    } finally {
      try { await this.fs.delete(temporary); } catch { /* Already renamed, or write failed. */ }
    }
  }
  async participants() {
    const result = [];
    for (const [name] of await this.fs.readDirectory(this.coordinationUri)) {
      if (!name.endsWith('.json')) continue;
      const uri = this.Uri.joinPath(this.coordinationUri, name);
      let owner;
      try { owner = JSON.parse(new TextDecoder().decode(await this.fs.readFile(uri))); }
      catch (error) { if (error.code === 'FileNotFound') continue; throw error; }
      if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 ||
          !Number.isSafeInteger(owner.ticket) || owner.ticket < 0 ||
          typeof owner.choosing !== 'boolean') {
        throw new Error('Invalid global command storage coordination file.');
      }
      let alive = true;
      try { process.kill(owner.pid, 0); }
      catch (error) { alive = error.code !== 'ESRCH'; }
      if (alive) result.push({ ...owner, name });
      else {
        // UUID filenames are never reused, so cleanup cannot unlink a new owner.
        try { await this.fs.delete(uri); }
        catch (error) { if (error.code !== 'FileNotFound') throw error; }
      }
    }
    return result;
  }
  async exclusive(job) {
    await this.fs.createDirectory(this.coordinationUri);
    const name = randomUUID() + '.json';
    const uri = this.Uri.joinPath(this.coordinationUri, name);
    const owner = { pid: process.pid, choosing: true, ticket: 0 };
    const deadline = Date.now() + 10000;
    try {
      // Bakery protocol: announce intent before choosing a ticket. All records
      // are atomically published, including the choosing -> ticket transition.
      await this.publishParticipant(uri, owner);
      owner.ticket = Math.max(0, ...(await this.participants()).map(peer => peer.ticket)) + 1;
      if (!Number.isSafeInteger(owner.ticket)) {
        throw new Error('Invalid global command storage coordination file.');
      }
      owner.choosing = false;
      await this.publishParticipant(uri, owner);
      while ((await this.participants()).some(peer => peer.name !== name &&
        (peer.choosing || peer.ticket < owner.ticket ||
          (peer.ticket === owner.ticket && peer.name < name)))) {
        if (Date.now() >= deadline) {
          throw new Error('Another window is updating commands. Please retry.');
        }
        await delay(20);
      }
      return await job();
    } finally {
      try { await this.fs.delete(uri); }
      catch (error) { if (error.code !== 'FileNotFound') throw error; }
    }
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
    const task = this.pending.catch(() => {}).then(() => this.exclusive(async () => {
      if (await this.exists()) {
        await this.readStored(); // Report malformed files rather than replacing.
        return false;
      }
      const preset = loadDefaultConfig(this.context.extensionPath, locale);
      await this.writeStored(preset);
      return true;
    }));
    this.initialization = task;
    this.pending = task;
    return task;
  }
  async read() {
    if (this.initialization) {
      await this.initialization;
    }
    return this.exclusive(() => this.readStored());
  }
  /** Serialize read, modification and atomic replacement across host processes. */
  async update(scope, transform) {
    const current = this.pending.catch(() => {}).then(() => this.exclusive(async () => {
      const config = await this.readStored();
      const result = await transform(config);
      await this.writeStored(config);
      return result;
    }));
    this.pending = current;
    return current;
  }
}
module.exports = { ConfigStore };
