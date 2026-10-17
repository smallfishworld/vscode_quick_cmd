'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { ConfigStore } = require('../src/store');
const { addGroup, addCommand } = require('../src/model');
const { memoryFs } = require('./helpers/memory-fs');

function fixture(storage = memoryFs()) {
  const api = {
    Uri: storage.vscodeUri,
    workspace: {
      fs: storage.fs,
      workspaceFolders: [{ name: 'A' }, { name: 'B' }],
    },
  };
  const context = {
    extensionPath: path.join(__dirname, '..'),
    globalStorageUri: storage.root,
    globalState: {
      get: () => { throw Error('Legacy globalState must not be read'); },
      update: () => { throw Error('Legacy globalState must not be written'); },
    },
  };
  return { store: new ConfigStore(api, context), storage, context };
}

test('one global JSON file persists commands regardless of open projects', async () => {
  const { store, storage } = fixture();
  const scope = store.scopes()[0];
  assert.equal(store.scopes().length, 1);
  assert.equal(scope.id, 'global');
  await store.update(scope, config => {
    const group = addGroup(config, 'Build');
    addCommand(config, group.id, { title: 'Make', command: 'make' });
  });
  assert.equal((await store.read()).groups[0].commands[0].command, 'make');
  assert.equal(storage.readConfig().groups[0].commands[0].command, 'make');
  assert.equal((await fixture(storage).store.read()).groups[0].title, 'Build');
  assert.deepEqual([...storage.files.keys()], [storage.configPath]);
});

test('serializes concurrent read-modify-write operations to JSON', async () => {
  const { store } = fixture();
  const scope = store.scopes()[0];
  await Promise.all(Array.from({ length: 10 }, (_, i) =>
    store.update(scope, async config => {
      await Promise.resolve();
      addGroup(config, 'Group ' + i);
    })));
  assert.equal((await store.read()).groups.length, 10);
});

test('invalid mutation never replaces JSON and queue recovers', async () => {
  const { store, storage } = fixture();
  const scope = store.scopes()[0];
  await store.update(scope, config => addGroup(config, 'Good'));
  const before = storage.files.get(storage.configPath);
  await assert.rejects(store.update(scope, config => { config.groups = 'invalid'; }), /Invalid Quick Cmd/);
  assert.deepEqual(storage.files.get(storage.configPath), before);
  await store.update(scope, config => addGroup(config, 'Still good'));
  assert.equal((await store.read()).groups.length, 2);
});

test('first activation seeds 43 Chinese commands exactly once', async () => {
  const { store, storage } = fixture();
  const first = store.initializeDefaults('zh-cn');
  const second = store.initializeDefaults('en');
  const config = await store.read();
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(config.groups.length, 6);
  assert.equal(config.groups.reduce((n, group) => n + group.commands.length, 0), 43);
  assert.equal(config.groups[0].title, require('../presets/defaults.zh-CN.json').groups[0].title);
  assert.deepEqual(storage.readConfig(), config);
  const restarted = fixture(storage).store;
  assert.equal(await restarted.initializeDefaults('en'), false);
  assert.deepEqual(await restarted.read(), config);
});

test('non-Chinese VS Code display language seeds English defaults', async () => {
  const { store } = fixture();
  assert.equal(await store.initializeDefaults('fr'), true);
  assert.equal((await store.read()).groups[0].title,
    require('../presets/defaults.en.json').groups[0].title);
});

test('an intentionally empty JSON file never gets overwritten by defaults', async () => {
  const storage = memoryFs();
  storage.writeConfig({ version: 1, groups: [] });
  const { store } = fixture(storage);
  assert.equal(await store.initializeDefaults('zh-cn'), false);
  assert.deepEqual(await store.read(), { version: 1, groups: [] });
  assert.equal(await fixture(storage).store.initializeDefaults('en'), false);
  assert.deepEqual(storage.readConfig(), { version: 1, groups: [] });
});

test('initialize and edit serialize without overwriting user data', async () => {
  const { store } = fixture();
  const seed = store.initializeDefaults('en');
  const edit = store.update(store.scopes()[0], config => addGroup(config, 'My commands'));
  await Promise.all([seed, edit]);
  assert.equal((await store.read()).groups.length, 7);
  assert.equal((await store.read()).groups.at(-1).title, 'My commands');
});

test('earlier queued edit wins over a later initialization', async () => {
  const { store } = fixture();
  const edit = store.update(store.scopes()[0], config => addGroup(config, 'Created first'));
  const init = store.initializeDefaults('zh-cn');
  assert.equal(await init, false);
  await edit;
  assert.equal((await store.read()).groups[0].title, 'Created first');
});

test('malformed saved JSON fails loudly and is not replaced by defaults', async () => {
  const storage = memoryFs(new Map());
  storage.files.set(storage.configPath, new TextEncoder().encode('{broken json'));
  const original = Uint8Array.from(storage.files.get(storage.configPath));
  const { store } = fixture(storage);
  await assert.rejects(store.initializeDefaults('zh-cn'), SyntaxError);
  assert.deepEqual(storage.files.get(storage.configPath), original);
});

test('schema-invalid saved config is preserved and not reinitialized', async () => {
  const storage = memoryFs();
  storage.writeConfig({ version: 99, groups: [] });
  const { store } = fixture(storage);
  await assert.rejects(store.initializeDefaults('zh-cn'), /Invalid Quick Cmd config/);
  assert.deepEqual(storage.readConfig(), { version: 99, groups: [] });
});

test('filesystem stat errors do not silently initialize or delete data', async () => {
  const { store, storage } = fixture();
  storage.options.failStat = true;
  await assert.rejects(store.initializeDefaults('en'), /Cannot stat storage/);
  assert.equal(storage.files.size, 0);
});

test('atomic replacement failure preserves original JSON and cleans temp file', async () => {
  const { store, storage } = fixture();
  await store.initializeDefaults('en');
  const original = Uint8Array.from(storage.files.get(storage.configPath));
  storage.options.failRename = true;
  await assert.rejects(store.update(store.scopes()[0], c => addGroup(c, 'Not saved')), /Cannot rename storage/);
  assert.deepEqual(storage.files.get(storage.configPath), original);
  assert.deepEqual([...storage.files.keys()], [storage.configPath]);
});

test('missing packaged defaults do not create empty JSON or overwrite it', async () => {
  const { store, storage, context } = fixture();
  context.extensionPath = path.join(__dirname, 'missing-extension-root');
  await assert.rejects(store.initializeDefaults('en'), /ENOENT/);
  assert.equal(storage.files.size, 0);
});
