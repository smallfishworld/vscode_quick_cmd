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

test('re-adding to the open group focuses the pending draft like editing does', async () => {
  const f = fixture();
  const { editor, scope, group } = f;
  const focused = [];
  f.vscode.commands.executeCommand = async (id) => {
    if (id === 'quickCmd.editor.focus') focused.push(id);
  };
  await editor.open(scope, group.id);
  editor.session.raw.title = 'Unfinished';
  const token = editor.session.token;
  await editor.open(scope, group.id);
  assert.equal(focused.length, 2, 'both opens focus the editor view');
  assert.equal(editor.session.token, token);
  assert.equal(editor.session.raw.title, 'Unfinished');
  assert.equal(f.answers.length, 0, 'no switch prompt for the same target');
});

test('a group chosen in the editor marks the draft dirty and moves the command', async () => {
  const f = fixture();
  const { editor, scope, group, a } = f;
  let other;
  await f.store.update(scope, (cfg) => {
    other = addGroup(cfg, 'Other');
  });
  await editor.open(scope, group.id, a.id);
  assert.equal(editor.dirty(), false);
  editor.session.groupId = other.id;
  assert.equal(editor.dirty(), true);
  f.answers.push('Save');
  assert.equal(await editor.close(), true);
  const cfg = await f.store.read(scope);
  assert.equal(cfg.groups[0].commands.length, 1);
  assert.equal(cfg.groups[1].commands[0].id, a.id);
  assert.equal(editor.session, undefined);
});

test('a picker move wins over an intervening external move', async () => {
  const f = fixture();
  const { editor, scope, group, a } = f;
  let other, third;
  await editor.open(scope, group.id, a.id);
  await f.store.update(scope, (cfg) => {
    other = addGroup(cfg, 'Other');
    third = addGroup(cfg, 'Third');
    third.commands.push(cfg.groups[0].commands.shift());
  });
  editor.session.groupId = other.id;
  await editor.save(editor.session.raw, other.id);
  const cfg = await f.store.read(scope);
  assert.equal(cfg.groups[1].commands[0].id, a.id);
  assert.equal(cfg.groups[2].commands.length, 0);
  assert.equal(editor.selection.groupId, other.id);
});

test('the open add slot follows the picker group, not the opening group', async () => {
  const f = fixture();
  const { editor, scope, group } = f;
  let other;
  await f.store.update(scope, (cfg) => {
    other = addGroup(cfg, 'Other');
  });
  await editor.open(scope, group.id);
  editor.session.groupId = other.id;
  const token = editor.session.token;
  // Adding again in the group the draft targets: focus, keep draft, no prompt.
  await editor.open(scope, other.id);
  assert.equal(editor.session.token, token);
  assert.equal(f.answers.length, 0);
  // Adding in the original group is a real switch and prompts for the draft.
  editor.session.raw.title = 'Pending';
  f.answers.push('Cancel');
  await editor.open(scope, group.id);
  assert.equal(editor.session.token, token);
  assert.equal(editor.session.raw.title, 'Pending');
});

test('drafts persisted before the group picker existed count as clean', async () => {
  const f = fixture();
  const { editor, scope, group, a } = f;
  await editor.open(scope, group.id, a.id);
  delete editor.session.groupId;
  editor.persist();
  await editor.persistQueue;
  const restored = new CommandEditorProvider(
    f.vscode,
    f.context,
    f.store,
    () => {},
  );
  assert.equal(restored.dirty(), false);
  assert.equal(await restored.close(), true);
  assert.equal(f.answers.length, 0, 'clean legacy drafts close without a prompt');
});

test('a group deleted while its draft targeted it falls back at reload', async () => {
  const f = fixture();
  const { editor, scope, group } = f;
  let other;
  await f.store.update(scope, (cfg) => {
    other = addGroup(cfg, 'Other');
  });
  await editor.open(scope, group.id);
  editor.session.groupId = other.id;
  await f.store.update(scope, (cfg) => {
    cfg.groups.splice(
      cfg.groups.findIndex((g) => g.id === other.id),
      1,
    );
  });
  let message;
  await editor.load({
    webview: { postMessage: async (msg) => (message = msg) },
  });
  assert.equal(message.groupId, group.id);
  assert.equal(message.baselineGroupId, group.id);
  assert.equal(editor.session.groupId, group.id);
  assert.equal(editor.dirty(), false);
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
  assert.deepEqual(contexts.at(-2), ['setContext', 'quickCmd.editing', false]);
  // 退出编辑后回到命令列表视图，而不是停在终端或空编辑视图。
  assert.deepEqual(contexts.at(-1), ['quickCmd.commands.focus']);
  await f.editor.open(f.scope, f.group.id, f.b.id);
  f.editor.session.raw.title = 'Discarded';
  f.answers.push('Discard');
  assert.equal(await f.editor.close(), true);
  assert.equal((await f.store.read(f.scope)).groups[0].commands[1].title, 'B');
});

test('save and finish writes the draft and leaves the editor without a prompt', async () => {
  const f = fixture();
  const contexts = [];
  f.vscode.commands.executeCommand = async (...args) => contexts.push(args);
  await f.editor.open(f.scope, f.group.id, f.a.id);
  f.editor.session.raw.title = 'Saved by check';
  assert.equal(await f.editor.saveAndClose(), true);
  assert.equal(f.editor.session, undefined);
  assert.equal(
    (await f.store.read(f.scope)).groups[0].commands[0].title,
    'Saved by check',
  );
  assert.deepEqual(contexts.at(-1), ['quickCmd.commands.focus']);
  // 保存失败时保持编辑，不丢输入。
  await f.editor.open(f.scope, f.group.id, f.a.id);
  f.editor.session.raw.envText = '{broken';
  await assert.rejects(f.editor.saveAndClose(), /Invalid environment/);
  assert.equal(f.editor.session.raw.envText, '{broken');
});

test('save and finish also saves drafts received while the first write is pending', async () => {
  const f = fixture();
  await f.editor.open(f.scope, f.group.id, f.a.id);
  f.editor.session.raw.title = 'Submitted';
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const update = f.store.update;
  let writes = 0;
  f.store.update = async (...args) => {
    if (++writes === 1) { entered(); await gate; }
    return update(...args);
  };
  const closing = f.editor.saveAndClose();
  await started;
  f.editor.session.raw = { ...f.editor.session.raw, title: 'Typed during save' };
  f.editor.session.revision++;
  release();
  await closing;
  assert.equal(writes, 2);
  assert.equal((await f.store.read()).groups[0].commands[0].title, 'Typed during save');
  assert.equal(f.editor.session, undefined);
});

test('a later draft that cannot be saved stays open when finishing', async () => {
  const f = fixture();
  await f.editor.open(f.scope, f.group.id, f.a.id);
  f.editor.session.raw.title = 'Submitted';
  const update = f.store.update;
  f.store.update = async (...args) => {
    f.editor.session.raw = { ...f.editor.session.raw, envText: '{invalid' };
    f.editor.session.revision++;
    return update(...args);
  };
  await assert.rejects(f.editor.saveAndClose(), /Invalid environment/);
  assert.equal(f.editor.session.raw.envText, '{invalid');
});
