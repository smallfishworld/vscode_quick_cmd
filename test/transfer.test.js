'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { exportScope, importScope } = require('../src/transfer');
const { ConfigStore } = require('../src/store');
const { addGroup, addCommand } = require('../src/model');

function fixture() {
  const files = new Map();
  const state = new Map();
  const folder = { name: 'project', uri: { scheme: 'file', fsPath: '/project', path: '/project', toString: () => 'file:///project' } };
  let confirm = 'Replace Commands'; let dialogs = [];
  const v = {
    Uri: { joinPath: (base, ...parts) => ({ path: `${base.path}/${parts.join('/')}` }), file: path => ({ path }) },
    workspace: { workspaceFolders: [folder], fs: {
      readFile: async uri => { if (!files.has(uri.path)) { throw Object.assign(new Error('missing'), { code: 'FileNotFound' }); } return files.get(uri.path); },
      writeFile: async (uri, bytes) => files.set(uri.path, bytes), createDirectory: async () => {},
      rename: async (a, b) => { files.set(b.path, files.get(a.path)); files.delete(a.path); },
      delete: async uri => files.delete(uri.path)
    } },
    window: { showSaveDialog: async () => ({ path: '/export.json' }),
      showOpenDialog: async () => dialogs,
      showWarningMessage: async () => confirm }
  };
  const context = { globalState: {
    get: (k, fallback) => state.get(k) || fallback,
    update: async (k, value) => state.set(k, structuredClone(value))
  } };
  return { v, store: new ConfigStore(v, context), files,
    setConfirmation: x => { confirm = x; }, setDialogs: x => { dialogs = x; } };
}

test('JSON export and import preserve configuration and IDs', async () => {
  const f = fixture(); const scope = f.store.scopes()[1];
  await f.store.update(scope, config => { const group = addGroup(config, 'Build'); addCommand(config, group.id, { title: 'Run', command: 'echo okay' }); });
  const before = await f.store.read(scope);
  assert.equal(await exportScope(f.v, f.store, scope), true);
  assert.ok(f.files.has('/export.json'));
  await f.store.update(scope, config => { config.groups = []; });
  f.setDialogs([{ path: '/export.json' }]);
  assert.equal(await importScope(f.v, f.store, scope), true);
  assert.deepEqual(await f.store.read(scope), before);
});
test('import validates BEFORE showing confirmation or modifying original', async () => {
  const f = fixture(); const scope = f.store.scopes()[1];
  f.files.set('/invalid.json', new TextEncoder().encode('{oops'));
  f.setDialogs([{ path: '/invalid.json' }]);
  await assert.rejects(importScope(f.v, f.store, scope), /Unexpected token|Expected property/);
  assert.deepEqual((await f.store.read(scope)).groups, []);
});
test('import requires explicit replacement confirmation', async () => {
  const f = fixture(); const scope = f.store.scopes()[0];
  f.files.set('/valid.json', new TextEncoder().encode('{"version":1,"groups":[]}'));
  f.setDialogs([{ path: '/valid.json' }]); f.setConfirmation(undefined);
  assert.equal(await importScope(f.v, f.store, scope), false);
});
