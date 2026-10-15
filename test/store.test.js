'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ConfigStore } = require('../src/store');
const { addGroup, addCommand } = require('../src/model');

function mockStore() {
  const files = new Map();
  const state = new Map();
  const folder = { name: 'project', uri: { scheme: 'file', fsPath: '/project', toString: () => 'file:///project', path: '/project' } };
  const uri = path => ({ path, scheme: 'file' });
  const api = {
    Uri: { joinPath: (base, ...parts) => uri(base.path + '/' + parts.join('/')) },
    workspace: {
      workspaceFolders: [folder],
      fs: {
        readFile: async target => {
          if (!files.has(target.path)) {
            throw Object.assign(new Error('not found'), { code: 'FileNotFound' });
          }
          return files.get(target.path);
        },
        createDirectory: async () => {},
        writeFile: async (target, bytes) => { files.set(target.path, bytes); },
        rename: async (source, dest) => { files.set(dest.path, files.get(source.path)); files.delete(source.path); },
        delete: async target => { files.delete(target.path); }
      }
    }
  };
  const context = { globalState: {
    get: (key, fallback) => state.get(key) ?? fallback,
    update: async (key, value) => { state.set(key, structuredClone(value)); }
  } };
  return { store: new ConfigStore(api, context), files, state };
}

test('workspace config is JSON and global config is user state', async () => {
  const { store, files, state } = mockStore();
  const [global, workspace] = store.scopes();
  await store.update(workspace, config => {
    const group = addGroup(config, 'Build');
    addCommand(config, group.id, { title: 'Make', command: 'make' });
  });
  assert.equal((await store.read(workspace)).groups[0].commands[0].command, 'make');
  assert.ok(files.has('/project/.vscode/quick-cmd.json'));
  await store.update(global, config => addGroup(config, 'Global'));
  assert.equal((await store.read(global)).groups[0].title, 'Global');
  assert.ok(state.has('quickCmd.globalConfig'));
});

test('serialize concurrent edits without dropping groups', async () => {
  const { store } = mockStore();
  const scope = store.scopes()[1];
  await Promise.all(Array.from({ length: 10 }, (_, index) =>
    store.update(scope, async config => { await Promise.resolve(); addGroup(config, 'Group ' + index); })
  ));
  assert.equal((await store.read(scope)).groups.length, 10);
});

test('refuse to overwrite malformed workspace JSON', async () => {
  const { store, files } = mockStore();
  const scope = store.scopes()[1];
  const invalid = new TextEncoder().encode('{invalid JSON');
  files.set('/project/.vscode/quick-cmd.json', invalid);
  await assert.rejects(store.update(scope, config => addGroup(config, 'Nope')), /Cannot read/);
  assert.equal(files.get('/project/.vscode/quick-cmd.json'), invalid);
});
