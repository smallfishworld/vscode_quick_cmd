'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { exportScope, importScope } = require('../src/transfer');
const { ConfigStore } = require('../src/store');
const { addGroup, addCommand } = require('../src/model');
const { memoryFs } = require('./helpers/memory-fs');

function fixture() {
  const storage = memoryFs();
  const externalFiles = new Map();
  let confirm = 'Replace Commands';
  let dialogs = [];
  const fs = {
    ...storage.fs,
    readFile: async uri => externalFiles.has(uri.fsPath)
      ? Uint8Array.from(externalFiles.get(uri.fsPath))
      : storage.fs.readFile(uri),
    writeFile: async (uri, bytes) => {
      if (uri.fsPath === '/export.json') {
        externalFiles.set(uri.fsPath, Uint8Array.from(bytes));
      } else {
        await storage.fs.writeFile(uri, bytes);
      }
    },
  };
  const v = {
    Uri: storage.vscodeUri,
    workspace: { workspaceFolders: [{ name: 'project' }], fs },
    window: {
      showSaveDialog: async () => v.Uri.file('/export.json'),
      showOpenDialog: async () => dialogs,
      showWarningMessage: async () => confirm,
    },
  };
  const context = {
    extensionPath: path.join(__dirname, '..'),
    globalStorageUri: storage.root,
  };
  return {
    v, store: new ConfigStore(v, context), files: externalFiles, storage,
    setConfirmation: x => { confirm = x; },
    setDialogs: x => { dialogs = x; },
  };
}

test('JSON export and import preserve configuration and IDs', async () => {
  const f = fixture();
  const scope = f.store.scopes()[0];
  await f.store.update(scope, config => {
    const group = addGroup(config, 'Build');
    addCommand(config, group.id, { title: 'Run', command: 'echo okay' });
  });
  const before = await f.store.read(scope);
  assert.equal(await exportScope(f.v, f.store, scope), true);
  assert.ok(f.files.has('/export.json'));
  await f.store.update(scope, config => { config.groups = []; });
  f.setDialogs([f.v.Uri.file('/export.json')]);
  assert.equal(await importScope(f.v, f.store, scope), true);
  assert.deepEqual(await f.store.read(scope), before);
  assert.deepEqual(f.storage.readConfig(), before);
});

test('import validates BEFORE showing confirmation or modifying original', async () => {
  const f = fixture();
  const scope = f.store.scopes()[0];
  f.files.set('/invalid.json', new TextEncoder().encode('{oops'));
  f.setDialogs([f.v.Uri.file('/invalid.json')]);
  await assert.rejects(importScope(f.v, f.store, scope), SyntaxError);
  assert.deepEqual((await f.store.read(scope)).groups, []);
  assert.equal(f.storage.files.size, 0);
});

test('import requires explicit replacement confirmation', async () => {
  const f = fixture();
  const scope = f.store.scopes()[0];
  f.files.set('/valid.json', new TextEncoder().encode('{"version":1,"groups":[]}'));
  f.setDialogs([f.v.Uri.file('/valid.json')]);
  f.setConfirmation(undefined);
  assert.equal(await importScope(f.v, f.store, scope), false);
  assert.equal(f.storage.files.size, 0);
});
