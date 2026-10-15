'use strict';

const { t } = require('./i18n');
const { randomUUID } = require('node:crypto');
const { emptyConfig, validateConfig } = require('./model');
const GLOBAL_KEY = 'quickCmd.globalConfig';

/** Stores global commands in VS Code state and project commands in JSON. */
class ConfigStore {
  constructor(vscode, context) {
    this.vscode = vscode;
    this.context = context;
    this.pending = new Map();
  }

  scopes() {
    const scopes = [
      { type: 'global', id: 'global', label: t('Global commands') },
    ];
    for (const folder of this.vscode.workspace.workspaceFolders || []) {
      if (folder.uri.scheme === 'file') {
        scopes.push({
          type: 'workspace',
          id: folder.uri.toString(),
          label: folder.name,
          folder,
        });
      }
    }
    return scopes;
  }

  configUri(scope) {
    if (scope.type !== 'workspace') {
      throw new Error('Global commands are edited from the sidebar, not JSON.');
    }
    return this.vscode.Uri.joinPath(
      scope.folder.uri,
      '.vscode',
      'quick-cmd.json',
    );
  }

  async read(scope) {
    if (scope.type === 'global') {
      return validateConfig(
        structuredClone(
          this.context.globalState.get(GLOBAL_KEY, emptyConfig()),
        ),
      );
    }
    try {
      const bytes = await this.vscode.workspace.fs.readFile(
        this.configUri(scope),
      );
      return validateConfig(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (error) {
      if (error && error.code === 'FileNotFound') {
        return emptyConfig();
      }
      throw new Error(
        'Cannot read ' +
          scope.label +
          '/.vscode/quick-cmd.json: ' +
          error.message,
      );
    }
  }

  async write(scope, config) {
    validateConfig(config);
    if (scope.type === 'global') {
      await this.context.globalState.update(GLOBAL_KEY, config);
      return;
    }
    const folderUri = this.vscode.Uri.joinPath(scope.folder.uri, '.vscode');
    const temporary = this.vscode.Uri.joinPath(
      folderUri,
      '.quick-cmd-' + randomUUID() + '.tmp',
    );
    const target = this.configUri(scope);
    await this.vscode.workspace.fs.createDirectory(folderUri);
    try {
      await this.vscode.workspace.fs.writeFile(
        temporary,
        new TextEncoder().encode(JSON.stringify(config, null, 2) + '\n'),
      );
      await this.vscode.workspace.fs.rename(temporary, target, {
        overwrite: true,
      });
    } finally {
      try {
        await this.vscode.workspace.fs.delete(temporary);
      } catch {
        // Temporary file already moved or was never created.
      }
    }
  }

  /** Serialize read-modify-write operations so rapid clicks cannot lose edits. */
  async update(scope, transform) {
    const previous = this.pending.get(scope.id) || Promise.resolve();
    const current = previous
      .catch(() => {})
      .then(async () => {
        const config = await this.read(scope);
        const result = await transform(config);
        await this.write(scope, config);
        return result;
      });
    this.pending.set(scope.id, current);
    try {
      return await current;
    } finally {
      if (this.pending.get(scope.id) === current) {
        this.pending.delete(scope.id);
      }
    }
  }
}
module.exports = { ConfigStore };
