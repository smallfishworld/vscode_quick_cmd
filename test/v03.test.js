'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { emptyConfig, addGroup, addCommand, validateConfig, commandSteps, moveDrop } = require('../src/model');
const { TerminalRunner } = require('../src/terminal');
const { CommandTreeProvider } = require('../src/tree');
const { CommandEditorProvider } = require('../src/editor');

test('legacy commands map to one executed step; new steps preserve the final checkbox', () => {
  const legacy = { command: 'echo hello' };
  assert.deepEqual(commandSteps(legacy), [{ command: 'echo hello', execute: true }]);
  const cfg = emptyConfig(); const group = addGroup(cfg, 'Build');
  const multi = addCommand(cfg, group.id, { title: 'Both', steps: [
    { command: 'echo first', execute: true }, { command: 'echo second', execute: false }
  ] });
  assert.equal(validateConfig(cfg), cfg);
  assert.deepEqual(commandSteps(multi), multi.steps);
  assert.throws(() => addCommand(cfg, group.id, { title: 'Invalid', steps: [
    { command: 'echo first', execute: false }, { command: 'echo second', execute: true }
  ] }), /Only the final step/);
  assert.throws(() => addCommand(cfg, group.id, { title: 'Invalid', steps: [] }), /steps/);
  assert.throws(() => addCommand(cfg, group.id, { title: 'Invalid', steps: [{ command: 'x', execute: 'yes' }] }), /boolean/);
});

test('drag-and-drop orders groups and moves commands between groups', () => {
  const cfg = emptyConfig();
  const one = addGroup(cfg, 'One'), two = addGroup(cfg, 'Two');
  const a = addCommand(cfg, one.id, { title: 'A', command: 'echo A' });
  const b = addCommand(cfg, one.id, { title: 'B', command: 'echo B' });
  const c = addCommand(cfg, two.id, { title: 'C', command: 'echo C' });
  moveDrop(cfg, { kind: 'group', groupId: two.id }, { kind: 'group', groupId: one.id });
  assert.deepEqual(cfg.groups.map(g => g.id), [two.id, one.id]);
  moveDrop(cfg, { kind: 'command', groupId: one.id, commandId: b.id },
    { kind: 'command', groupId: two.id, commandId: c.id });
  assert.deepEqual(two.commands.map(cmd => cmd.title), ['B', 'C']);
  assert.deepEqual(one.commands.map(cmd => cmd.title), ['A']);
  assert.equal(moveDrop(cfg, { kind: 'command', groupId: two.id, commandId: b.id },
    { kind: 'command', groupId: two.id, commandId: b.id }), false);
  moveDrop(cfg, { kind: 'command', groupId: one.id, commandId: a.id },
    { kind: 'group', groupId: two.id });
  assert.deepEqual(two.commands.map(cmd => cmd.title), ['B', 'C', 'A']);
  assert.equal(validateConfig(cfg), cfg);
});

test('terminal sends false for the unchecked final checkbox (no enter)', () => {
  const sent = [];
  const vscode = {
    workspace: { isTrusted: true, workspaceFolders: [] },
    window: { createTerminal: () => ({ show() {}, sendText(text, newline) { sent.push([text, newline]); } }) }
  };
  const runner = new TerminalRunner(vscode);
  runner.run({ type: 'global', id: 'global' }, { title: 'Draft', steps: [
    { command: 'echo first', execute: true }, { command: 'echo second', execute: false }
  ] });
  assert.deepEqual(sent, [['echo first', true], ['echo second', false]]);
});

test('TreeView drag data uses scope validation and updates same-scope command order', async () => {
  const cfg = emptyConfig(); const group = addGroup(cfg, 'Build');
  const a = addCommand(cfg, group.id, { title: 'A', command: 'a' });
  const b = addCommand(cfg, group.id, { title: 'B', command: 'b' });
  const scope = { type: 'global', id: 'global', label: 'Global' };
  const store = {
    scopes: () => [scope],
    async read() { return cfg; },
    async update(_, fn) { return fn(cfg); }
  };
  const errors = [];
  const vscode = {
    EventEmitter: class { constructor() { this.event = () => {}; } fire() {} dispose() {} },
    DataTransferItem: class { constructor(value) { this.value = value; } asString() { return this.value; } },
    window: { async showErrorMessage(msg) { errors.push(msg); } }
  };
  const provider = new CommandTreeProvider(vscode, store);
  const source = [{ kind: 'command', scope, groupId: group.id, commandId: b.id }];
  const target = { kind: 'command', scope, groupId: group.id, commandId: a.id };
  const entries = new Map();
  const data = { set: (key, value) => entries.set(key, value), get: key => entries.get(key) };
  await provider.handleDrag(source, data);
  await provider.handleDrop(target, data);
  assert.deepEqual(cfg.groups[0].commands.map(c => c.id), [b.id, a.id]);
  assert.deepEqual(errors, []);
});

test('embedded editor saves new steps and converts a legacy record without losing id', async () => {
  const cfg = emptyConfig(); const group = addGroup(cfg, 'Build');
  const legacy = addCommand(cfg, group.id, { title: 'Old', command: 'echo old' });
  const scope = { id: 'global', type: 'global', label: 'Global' };
  const store = {
    scopes: () => [scope],
    read: async () => cfg,
    update: async (_, fn) => { const result = await fn(cfg); validateConfig(cfg); return result; }
  };
  const vscode = { commands: { executeCommand: async () => {} } };
  let refreshes = 0;
  const editor = new CommandEditorProvider(vscode, {}, store, () => refreshes++);
  await editor.open(scope, group.id, legacy.id);
  await editor.save({ title: 'Modern', steps: [{ command: 'echo modern', execute: false }] }, group.id);
  assert.equal(group.commands[0].id, legacy.id);
  assert.equal(group.commands[0].command, undefined);
  assert.equal(group.commands[0].steps[0].execute, false);
  assert.equal(refreshes, 1);
});
