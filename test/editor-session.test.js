'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CommandEditorProvider } = require('../src/editor');
const {
  emptyConfig,
  addGroup,
  addCommand,
  validateConfig,
} = require('../src/model');
const { setLocale, t, errorText } = require('../src/i18n');

function fixture() {
  let config = emptyConfig();
  const group = addGroup(config, 'Build');
  const a = addCommand(config, group.id, { title: 'A', command: 'echo a' });
  const b = addCommand(config, group.id, { title: 'B', command: 'echo b' });
  const scope = { id: 'global', type: 'global', label: 'Global' };
  const state = new Map();
  const answers = [];
  const vscode = {
    commands: { executeCommand: async () => {} },
    window: { showWarningMessage: async () => answers.shift() },
  };
  const context = {
    workspaceState: {
      get: (key) => state.get(key),
      update: async (key, value) => state.set(key, structuredClone(value)),
    },
  };
  const store = {
    scopes: () => [scope],
    read: async () => structuredClone(config),
    update: async (_, fn) => {
      const next = structuredClone(config);
      const result = await fn(next);
      validateConfig(next);
      config = next;
      return result;
    },
  };
  const editor = new CommandEditorProvider(vscode, context, store, () => {});
  return { editor, store, scope, group, a, b, answers, state, vscode, context };
}

test('switching cancels, discards, or saves a dirty command explicitly', async () => {
  const f = fixture();
  const { editor, scope, group, a, b, answers } = f;
  await editor.open(scope, group.id, a.id);
  editor.session.raw.title = 'Draft A';
  answers.push('Cancel');
  await editor.open(scope, group.id, b.id);
  assert.equal(editor.selection.commandId, a.id);
  assert.equal(editor.session.raw.title, 'Draft A');
  answers.push('Save');
  await editor.open(scope, group.id, b.id);
  assert.equal(editor.selection.commandId, b.id);
  assert.equal(
    (await f.store.read(scope)).groups[0].commands[0].title,
    'Draft A',
  );
  editor.session.raw.title = 'Discard me';
  answers.push('Discard');
  await editor.open(scope, group.id, a.id);
  assert.equal((await f.store.read(scope)).groups[0].commands[1].title, 'B');
});

test('draft survives provider recreation without being executed or written to config', async () => {
  const f = fixture();
  await f.editor.open(f.scope, f.group.id, f.a.id);
  f.editor.session.raw.steps[0].command = 'unfinished';
  f.editor.persist();
  await f.editor.persistQueue;
  const restored = new CommandEditorProvider(
    f.vscode,
    f.context,
    f.store,
    () => {},
  );
  assert.equal(restored.session.raw.steps[0].command, 'unfinished');
  assert.ok(restored.dirty());
  assert.equal(
    (await f.store.read(f.scope)).groups[0].commands[0].command,
    'echo a',
  );
});

test('save acknowledgement does not mark edits typed during save as saved', async () => {
  const f = fixture();
  await f.editor.open(f.scope, f.group.id, f.a.id);
  f.editor.session.raw.title = 'Submitted';
  const submitted = structuredClone(f.editor.session.raw);
  const token = f.editor.session.token;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const update = f.store.update;
  f.store.update = async (...args) => {
    await gate;
    return update(...args);
  };
  const saving = f.editor.save(submitted, f.group.id, { token, revision: 0 });
  f.editor.session.raw.title = 'Typed later';
  f.editor.session.revision++;
  release();
  await saving;
  assert.equal(f.editor.session.baseline.title, 'Submitted');
  assert.equal(f.editor.session.raw.title, 'Typed later');
  assert.ok(f.editor.dirty());
});

test('external changes are never silently overwritten', async () => {
  const f = fixture();
  await f.editor.open(f.scope, f.group.id, f.a.id);
  f.editor.session.raw.title = 'My draft';
  await f.store.update(f.scope, (cfg) => {
    cfg.groups[0].commands[0].title = 'External';
  });
  await assert.rejects(
    f.editor.save(f.editor.session.raw, f.group.id),
    /changed outside/,
  );
  assert.equal(
    (await f.store.read(f.scope)).groups[0].commands[0].title,
    'External',
  );
  assert.equal(f.editor.session.raw.title, 'My draft');
});

test('saving after a tree move follows command identity rather than the old group', async () => {
  const f = fixture();
  await f.editor.open(f.scope, f.group.id, f.a.id);
  let target;
  await f.store.update(f.scope, (cfg) => {
    target = addGroup(cfg, 'Other');
    target.commands.push(cfg.groups[0].commands.shift());
  });
  f.editor.session.raw.title = 'Moved';
  await f.editor.save(f.editor.session.raw, f.group.id);
  assert.equal(f.editor.selection.groupId, target.id);
  assert.equal(
    (await f.store.read(f.scope)).groups[1].commands[0].title,
    'Moved',
  );
});

test('invalid JSON remains a draft and cannot be saved by switch confirmation', async () => {
  const f = fixture();
  await f.editor.open(f.scope, f.group.id, f.a.id);
  f.editor.session.raw.envText = '{broken';
  f.answers.push('Save');
  await assert.rejects(
    f.editor.open(f.scope, f.group.id, f.b.id),
    /Invalid environment/,
  );
  assert.equal(f.editor.selection.commandId, f.a.id);
  assert.equal(f.editor.session.raw.envText, '{broken');
});

test('stale save tokens and revisions cannot write another command', async () => {
  const f = fixture();
  await f.editor.open(f.scope, f.group.id, f.a.id);
  await assert.rejects(
    f.editor.save(f.editor.session.raw, f.group.id, {
      token: 'old',
      revision: 0,
    }),
    /Stale/,
  );
  await assert.rejects(
    f.editor.save(f.editor.session.raw, f.group.id, {
      token: f.editor.session.token,
      revision: 9,
    }),
    /Stale/,
  );
});

test('UI language and domain errors follow the selected locale', () => {
  setLocale('zh-cn');
  assert.equal(t('Working directory'), '工作目录');
  assert.equal(
    errorText(
      new Error(
        'Command title must be a non-empty string of at most 128 characters.',
      ),
    ),
    '命令名称不能为空，且不能超过 128 个字符。',
  );
  assert.equal(
    errorText(new Error('Too many groups (limit: 200).')),
    '分组过多，最多支持 200 个。',
  );
  setLocale('en');
  assert.equal(t('Working directory'), 'Working directory');
});

test('finishing editing cancels or handles dirty data before hiding the editor', async () => {
  const f = fixture();
  const contexts = [];
  f.vscode.commands.executeCommand = async (...args) => contexts.push(args);
  await f.editor.open(f.scope, f.group.id, f.a.id);
  assert.ok(
    contexts.some((args) => args[0] === 'setContext' && args[2] === true),
  );
  f.editor.session.raw.title = 'Pending';
  f.answers.push('Cancel');
  assert.equal(await f.editor.close(), false);
  assert.equal(f.editor.session.raw.title, 'Pending');
  f.answers.push('Save');
  assert.equal(await f.editor.close(), true);
  assert.equal(f.editor.session, undefined);
  assert.equal(
    (await f.store.read(f.scope)).groups[0].commands[0].title,
    'Pending',
  );
  assert.deepEqual(contexts.at(-1), ['setContext', 'quickCmd.editing', false]);
  await f.editor.open(f.scope, f.group.id, f.b.id);
  f.editor.session.raw.title = 'Discarded';
  f.answers.push('Discard');
  assert.equal(await f.editor.close(), true);
  assert.equal((await f.store.read(f.scope)).groups[0].commands[1].title, 'B');
});
