'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { emptyConfig, addGroup, addCommand, validateConfig, moveItem, findCommand } = require('../src/model');
const { TerminalRunner } = require('../src/terminal');

test('P1 config accepts extended command fields and old v0.1 format', () => {
  const cfg = emptyConfig(); const group = addGroup(cfg, 'Build');
  const base = addCommand(cfg, group.id, { title: 'Legacy', command: 'make' });
  const cmd = addCommand(cfg, group.id, { title: 'Deploy', command: 'echo ${input:name}', terminal: 'reuse',
    confirm: true, description: 'Deploy firmware', icon: 'rocket', env: { BUILD: 'debug' } });
  assert.equal(validateConfig(cfg), cfg);
  assert.equal(findCommand(cfg, cmd.id).command.title, 'Deploy');
  assert.equal(moveItem(group.commands, cmd.id, -1), true);
  assert.equal(group.commands[0].id, cmd.id);
  assert.equal(moveItem(group.commands, cmd.id, -1), false);
  assert.equal(group.commands[1].id, base.id);
});
test('P1 config rejects invalid terminal flags and invalid env', () => {
  const cfg = emptyConfig(); const g = addGroup(cfg, 'Build');
  assert.throws(() => addCommand(cfg, g.id, { title: 'A', command: 'echo', terminal: 'magic' }), /terminal/);
  assert.throws(() => addCommand(cfg, g.id, { title: 'A', command: 'echo', confirm: 'yes' }), /boolean/);
  assert.throws(() => addCommand(cfg, g.id, { title: 'A', command: 'echo', env: { 'bad-name': 1 } }), /env/);
});

function harness() {
  const events = { start: null, end: null, close: null };
  const terminals = [];
  const folder = { uri: { scheme: 'file', fsPath: '/my project' } };
  const api = { EventEmitter: class { constructor() { this.fire = () => {}; this.event = () => ({ dispose() {} }); } dispose() {} },
    workspace: { workspaceFolders: [folder], isTrusted: true, getWorkspaceFolder: () => folder },
    window: {
      activeTextEditor: undefined,
      onDidStartTerminalShellExecution: fn => { events.start = fn; return { dispose() {} }; },
      onDidEndTerminalShellExecution: fn => { events.end = fn; return { dispose() {} }; },
      onDidCloseTerminal: fn => { events.close = fn; return { dispose() {} }; },
      createTerminal: opts => { const t = { opts, lines: [], show() {}, sendText(line) { this.lines.push(line); },
        dispose() { this.closed = true; } }; terminals.push(t); return t; }
    }
  };
  return { api, events, terminals, folder };
}
test('reuse creates new terminal while busy and reuses once shell integration confirms idle', () => {
  const h = harness(); const runner = new TerminalRunner(h.api);
  const scope = { type: 'workspace', id: 'myproject', folder: h.folder };
  const cmd = { id: 'run', title: 'Build', command: 'make', terminal: 'reuse' };
  const first = runner.run(scope, cmd); assert.equal(h.terminals.length, 1);
  const second = runner.run(scope, cmd); assert.equal(h.terminals.length, 2);
  h.events.start({ terminal: second.terminal });
  h.events.end({ terminal: second.terminal, exitCode: 0 });
  const third = runner.run(scope, cmd);
  assert.equal(h.terminals.length, 2); assert.equal(third.terminal, second.terminal);
  assert.equal(runner.status(scope, cmd).busy, true);
  runner.stop(scope, cmd);
  assert.equal(second.terminal.closed, true);
  runner.dispose();
});
test('active mode uses selected terminal and reports potential busy state', () => {
  const h = harness(); const runner = new TerminalRunner(h.api);
  const active = h.api.window.createTerminal({}); h.api.window.activeTerminal = active;
  assert.equal(runner.isActiveTerminalUnsafe(), true);
  const result = runner.run({ type: 'global', id: 'global' }, { title: 'Echo', command: 'echo hi', terminal: 'active' });
  assert.equal(result.terminal, active);
  assert.deepEqual(active.lines, ['echo hi']);
  runner.dispose();
});
