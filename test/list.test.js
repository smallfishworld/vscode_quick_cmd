'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CommandListProvider } = require('../src/list');
const {
  emptyConfig,
  addGroup,
  addCommand,
  validateConfig,
} = require('../src/model');
function fixture() {
  let cfg = emptyConfig();
  const group = addGroup(cfg, 'Build');
  const a = addCommand(cfg, group.id, { title: 'A', command: 'echo a' });
  const b = addCommand(cfg, group.id, { title: 'B', command: 'echo b' });
  const other = addGroup(cfg, 'Other');
  const scope = { id: 'global', type: 'global' };
  const calls = [];
  const packets = [];
  const vscode = {
    workspace: { getConfiguration: () => ({ get: () => 0 }) },
    commands: { executeCommand: async (...args) => calls.push(args) },
    window: {},
  };
  const store = {
    scopes: () => [scope],
    read: async () => structuredClone(cfg),
    update: async (_, fn) => {
      const next = structuredClone(cfg);
      const result = fn(next);
      validateConfig(next);
      cfg = next;
      return result;
    },
  };
  const provider = new CommandListProvider(vscode, {}, store, {
    status: () => undefined,
  });
  provider.view = {
    webview: { postMessage: async (packet) => packets.push(packet) },
  };
  provider.token = 'session';
  return { provider, store, scope, group, a, b, other, calls, packets };
}
test('list model has compact font and command previews without counts or custom colors', async () => {
  const f = fixture();
  const model = await f.provider.model();
  assert.equal(model.fontSize, 0);
  assert.equal(model.groups[0].title, 'Build');
  assert.equal(Object.hasOwn(model.groups[0], 'count'), false);
  assert.equal(Object.hasOwn(model.groups[0], 'color'), false);
  assert.equal(model.groups[0].commands[0].preview, 'echo a');
});
test('list message boundary checks session and current IDs and ignores injected code', async () => {
  const f = fixture();
  const node = { kind: 'command', groupId: f.group.id, commandId: f.a.id };
  await assert.rejects(
    f.provider.handleMessage({ type: 'run', token: 'wrong', ...node }),
    /Invalid list/,
  );
  await assert.rejects(
    f.provider.handleMessage({
      type: 'run',
      token: 'session',
      ...node,
      commandId: 'missing',
    }),
    /no longer exists/,
  );
  await assert.rejects(
    f.provider.handleMessage({
      type: 'arbitrary-command',
      token: 'session',
      ...node,
    }),
    /Invalid list/,
  );
  await f.provider.handleMessage({
    type: 'edit',
    token: 'session',
    ...node,
    command: 'evil shell text',
  });
  assert.equal(f.calls[0][0], 'quickCmd.editCommand');
  assert.equal(Object.hasOwn(f.calls[0][1], 'command'), false);
  await f.provider.handleMessage({ type: 'run', token: 'session', ...node });
  assert.equal(f.calls[1][0], 'quickCmd.run');
  // 行尾删除按钮已移除；删除只能通过行级右键的原生菜单（contextNode）触发。
  await assert.rejects(
    f.provider.handleMessage({ type: 'delete', token: 'session', ...node }),
    /Invalid list/,
  );
  await assert.rejects(
    f.provider.handleMessage({
      type: 'delete',
      token: 'session',
      kind: 'group',
      groupId: f.group.id,
    }),
    /Invalid list/,
  );
});
test('list drag supports order, cross-group moves and group drop onto empty space', async () => {
  const f = fixture();
  let selected;
  f.provider.onSelection = (node) => {
    selected = node;
  };
  await f.provider.drop(
    { kind: 'command', groupId: f.group.id, commandId: f.b.id },
    { kind: 'command', groupId: f.group.id, commandId: f.a.id },
  );
  assert.deepEqual(
    (await f.store.read()).groups[0].commands.map((cmd) => cmd.id),
    [f.b.id, f.a.id],
  );
  await f.provider.drop(
    { kind: 'command', groupId: f.group.id, commandId: f.b.id },
    { kind: 'group', groupId: f.other.id },
  );
  assert.equal((await f.store.read()).groups[1].commands[0].id, f.b.id);
  assert.equal(selected.groupId, f.other.id);
  await f.provider.drop(
    { kind: 'group', groupId: f.group.id },
    { kind: 'root' },
  );
  assert.equal((await f.store.read()).groups.at(-1).id, f.group.id);
});
test('an older asynchronous refresh cannot replace newer list state', async () => {
  const f = fixture();
  let resolveOld;
  let i = 0;
  f.provider.model = () =>
    ++i === 1
      ? new Promise((resolve) => {
          resolveOld = resolve;
        })
      : Promise.resolve({ groups: [], fontSize: 12 });
  const old = f.provider.refresh();
  await f.provider.refresh();
  resolveOld({ groups: [], fontSize: 11 });
  await old;
  assert.equal(f.packets.length, 1);
  assert.equal(f.packets[0].fontSize, 12);
});

test('native context actions validate current target, session and per-kind action whitelist', async () => {
  const f = fixture();
  const ctx = {
    webview: 'quickCmd.commands',
    webviewSection: 'command',
    quickCmdToken: 'session',
    groupId: f.group.id,
    commandId: f.b.id,
    scope: { id: 'untrusted' },
    command: 'injected text',
  };
  const node = await f.provider.contextNode('quickCmd.editCommand', ctx);
  assert.equal(node.commandId, f.b.id);
  assert.equal(node.scope.id, 'global');
  assert.equal(Object.hasOwn(node, 'command'), false);
  await assert.rejects(
    f.provider.contextNode('quickCmd.deleteGroup', ctx),
    /Invalid list/,
  );
  await assert.rejects(
    f.provider.contextNode('quickCmd.run', { ...ctx, quickCmdToken: 'old' }),
    /Invalid list/,
  );
  await assert.rejects(
    f.provider.contextNode('quickCmd.run', { ...ctx, commandId: 'deleted' }),
    /no longer exists/,
  );
  assert.equal(
    (
      await f.provider.contextNode('quickCmd.addCommand', {
        ...ctx,
        webviewSection: 'group',
      })
    ).kind,
    'group',
  );
  assert.equal(
    f.calls.length,
    0,
    'resolving a right-click target never executes',
  );
});
