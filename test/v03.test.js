'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { emptyConfig, addGroup, addCommand, validateConfig, commandSteps, moveDrop } = require('../src/model');
const { TerminalRunner } = require('../src/terminal');
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
  assert.deepEqual(sent, [['echo first\necho second', false]]);
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
