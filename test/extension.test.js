'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('VS Code extension activates, registers commands, and runs a saved command through search', async () => {
  const callbacks = new Map();
  const state = new Map();
  const inputs = ['Utilities', 'Say hello', 'echo hi', '', '', '', '{}'];
  const quickPicks = [0, 0, 0, 0];
  const terminals = [];
  const event = () => ({ dispose() {} });
  const vscode = {
    EventEmitter: class { constructor() { this.event = event; } fire() {} dispose() {} },
    window: {
      createTreeView: () => ({ dispose() {} }),
      showInputBox: async () => inputs.shift(),
      showQuickPick: async choices => choices[quickPicks.shift() || 0],
      showErrorMessage: msg => { throw new Error(msg); },
      createTerminal: options => { const term = { options, calls: [], show() {}, sendText(line) { this.calls.push(line); } }; terminals.push(term); return term; }
    },
    workspace: {
      workspaceFolders: [], isTrusted: true,
      getConfiguration: () => ({ get: (key, defaultValue) => defaultValue }),
      createFileSystemWatcher: () => ({ onDidCreate: event, onDidChange: event, onDidDelete: event, dispose() {} }),
      onDidChangeWorkspaceFolders: event
    },
    commands: { registerCommand: (id, fn) => { callbacks.set(id, fn); return { dispose() {} }; } },
    Uri: { file: fsPath => ({ fsPath }) }
  };
  const originalLoad = Module._load;
  Module._load = function(request, parent, main) { return request === 'vscode' ? vscode : originalLoad.apply(this, arguments); };
  try {
    const { activate } = require('../src/extension');
    const context = { subscriptions: [], globalState: {
      get: (k, fallback) => state.get(k) || fallback,
      update: async (k, v) => state.set(k, structuredClone(v))
    } };
    activate(context);
    assert.equal(typeof callbacks.get('quickCmd.runById'), 'function');
    await callbacks.get('quickCmd.addGroup')();
    await callbacks.get('quickCmd.addCommand')();
    await callbacks.get('quickCmd.searchCommands')();
    assert.equal(terminals.length, 1);
    assert.deepEqual(terminals[0].calls, ['echo hi']);
    const command = state.get('quickCmd.globalConfig').groups[0].commands[0];
    await callbacks.get('quickCmd.runById')({ id: command.id, scopeId: 'global' });
    assert.equal(terminals.length, 2);
  } finally { Module._load = originalLoad; }
});
