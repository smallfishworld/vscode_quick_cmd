'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { ConfigStore } = require('../src/store');
const { addGroup, addCommand } = require('../src/model');
function fixture(state = new Map()) {
  const api = {
    workspace: {
      workspaceFolders: [{ name: 'A' }, { name: 'B' }],
      fs: new Proxy(
        {},
        {
          get() {
            throw Error('Project files must not be accessed');
          },
        },
      ),
    },
  };
  const context = {
    extensionPath: path.join(__dirname, '..'),
    globalState: {
      get: (key, fallback) => state.has(key) ? state.get(key) : fallback,
      update: async (key, value) => state.set(key, structuredClone(value)),
    },
  };
  return { store: new ConfigStore(api, context), state, context };
}
test('only one global collection exists regardless of open projects', async () => {
  const { store, state } = fixture();
  const scopes = store.scopes();
  assert.equal(scopes.length, 1);
  assert.equal(scopes[0].id, 'global');
  await store.update(scopes[0], (config) => {
    const group = addGroup(config, 'Build');
    addCommand(config, group.id, { title: 'Make', command: 'make' });
  });
  assert.equal((await store.read()).groups[0].commands[0].command, 'make');
  assert.ok(state.has('quickCmd.globalConfig'));
  assert.equal((await fixture(state).store.read()).groups[0].title, 'Build');
});
test('global writes serialize concurrent edits', async () => {
  const { store } = fixture();
  const scope = store.scopes()[0];
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      store.update(scope, async (config) => {
        await Promise.resolve();
        addGroup(config, 'Group ' + i);
      }),
    ),
  );
  assert.equal((await store.read()).groups.length, 10);
});
test('invalid global configuration is not overwritten and queue recovers', async () => {
  const { store, state } = fixture();
  const scope = store.scopes()[0];
  await assert.rejects(
    store.update(scope, (config) => {
      config.groups = 'invalid';
    }),
    /Invalid Quick Cmd/,
  );
  assert.equal(state.size, 0);
  await store.update(scope, (config) => addGroup(config, 'Valid'));
  assert.equal((await store.read()).groups[0].title, 'Valid');
});

test('first activation seeds 43 localized commands once and reads wait for initialization', async () => {
  const { store, state } = fixture();
  const first = store.initializeDefaults('zh-cn');
  const second = store.initializeDefaults('en');
  const cfg = await store.read();
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(cfg.groups.length, 6);
  assert.equal(cfg.groups.reduce((sum, group) => sum + group.commands.length, 0), 43);
  assert.equal(cfg.groups[0].title, require('../presets/defaults.zh-CN.json').groups[0].title);
  assert.equal(state.has('quickCmd.globalConfig'), true);
  const freshInstance = fixture(state).store;
  assert.equal(await freshInstance.initializeDefaults('en'), false, 'reinstall must preserve stored data');
  assert.deepEqual(await freshInstance.read(), cfg);
});

test('non-Chinese VS Code locales receive the English preset', async () => {
  const { store } = fixture();
  assert.equal(await store.initializeDefaults('fr'), true);
  assert.equal((await store.read()).groups[0].title,
    require('../presets/defaults.en.json').groups[0].title);
});

test('an existing empty config is never reseeded, even across reloads', async () => {
  const state = new Map([['quickCmd.globalConfig', { version: 1, groups: [] }]]);
  const { store } = fixture(state);
  assert.equal(await store.initializeDefaults('zh-cn'), false);
  assert.deepEqual(await store.read(), { version: 1, groups: [] });
  const reinstalled = fixture(state).store;
  assert.equal(await reinstalled.initializeDefaults('en'), false);
  assert.deepEqual(await reinstalled.read(), { version: 1, groups: [] });
});

test('initialization serializes with edits and does not overwrite concurrent writes', async () => {
  const { store } = fixture();
  const seed = store.initializeDefaults('en');
  const edit = store.update(store.scopes()[0], config => addGroup(config, 'My group'));
  await Promise.all([seed, edit]);
  assert.equal((await store.read()).groups.length, 7);
  assert.equal((await store.read()).groups.at(-1).title, 'My group');
});

test('initialization after earlier queued edits does not deadlock or overwrite them', async () => {
  const { store } = fixture();
  const edit = store.update(store.scopes()[0], config => addGroup(config, 'Before init'));
  const seed = store.initializeDefaults('zh-cn');
  assert.equal(await seed, false);
  await edit;
  assert.equal((await store.read()).groups[0].title, 'Before init');
});

test('a corrupted existing config is preserved and not replaced by defaults', async () => {
  const state = new Map([['quickCmd.globalConfig', { version: 99, groups: [] }]]);
  const { store } = fixture(state);
  await assert.rejects(store.initializeDefaults('zh-cn'), /Invalid Quick Cmd config/);
  assert.deepEqual(state.get('quickCmd.globalConfig'), { version: 99, groups: [] });
});

test('missing packaged default files must not create a placeholder config', async () => {
  const { store, state, context } = fixture();
  context.extensionPath = path.join(__dirname, 'missing-installation-root');
  await assert.rejects(store.initializeDefaults('en'), /ENOENT/);
  assert.equal(state.has('quickCmd.globalConfig'), false);
});
