'use strict';
const path = require('node:path');

const defaultRoot = path.join('/test', 'globalStorage', 'smallfishworld.vscode-quick-cmd');
const uri = (fsPath) => ({ fsPath });
const notFound = () => Object.assign(new Error('File not found'), { code: 'FileNotFound' });

/** In-memory stand-in for the VS Code workspace.fs API. */
function memoryFs(initial = new Map()) {
  const files = new Map(
    [...initial].map(([key, value]) => [key,
      typeof value === 'string' ? new TextEncoder().encode(value) : Uint8Array.from(value)]),
  );
  const options = { failRename: false, failWrite: false, failStat: false };
  const fs = {
    stat: async (file) => {
      if (options.failStat) { throw new Error('Cannot stat storage'); }
      if (!files.has(file.fsPath)) { throw notFound(); }
      return { size: files.get(file.fsPath).length };
    },
    createDirectory: async (directory) => {
      if (!directory.fsPath.startsWith(defaultRoot)) {
        throw new Error('Attempted to create a directory outside extension storage');
      }
    },
    readFile: async (file) => {
      if (!files.has(file.fsPath)) { throw notFound(); }
      return Uint8Array.from(files.get(file.fsPath));
    },
    writeFile: async (file, bytes) => {
      if (options.failWrite) { throw new Error('Cannot write storage'); }
      if (!file.fsPath.startsWith(defaultRoot + path.sep)) {
        throw new Error('Attempted to write outside extension storage');
      }
      files.set(file.fsPath, Uint8Array.from(bytes));
    },
    rename: async (from, to, opts = {}) => {
      if (options.failRename) { throw new Error('Cannot rename storage'); }
      if (!files.has(from.fsPath)) { throw notFound(); }
      if (files.has(to.fsPath) && !opts.overwrite) { throw new Error('File already exists'); }
      files.set(to.fsPath, files.get(from.fsPath));
      files.delete(from.fsPath);
    },
    delete: async (file) => {
      if (!files.delete(file.fsPath)) { throw notFound(); }
    },
  };
  return {
    fs, files, options,
    root: uri(defaultRoot),
    configPath: path.join(defaultRoot, 'config.json'),
    vscodeUri: {
      file: uri,
      joinPath: (root, ...parts) => uri(path.join(root.fsPath, ...parts)),
    },
    readConfig: () => JSON.parse(new TextDecoder().decode(files.get(path.join(defaultRoot, 'config.json')))),
    writeConfig: (data) => files.set(
      path.join(defaultRoot, 'config.json'),
      new TextEncoder().encode(JSON.stringify(data)),
    ),
  };
}

module.exports = { memoryFs, defaultRoot, notFound };
