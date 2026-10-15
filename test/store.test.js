'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
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
    globalState: {
      get: (key, fallback) => state.get(key) ?? fallback,
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
