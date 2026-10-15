'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

test('extension activates the embedded editor, saves a multi-step command, then runs it', async () => {
  const callbacks = new Map();
  const state = new Map();
  const inputs = ['Utilities'];
  const terminals = [];
  let editorProvider;
  let onMessage;
  let latest;
  let webviewResolved = false;
  const event = () => ({ dispose() {} });
  const webview = {
    cspSource: 'vscode-resource:',
    asWebviewUri: uri => ({ toString: () => uri.fsPath }),
    postMessage: msg => { if (msg.type === 'load') { latest = msg; } return Promise.resolve(true); },
    onDidReceiveMessage: callback => { onMessage = callback; return event(); }
  };
  const vscode = {
    EventEmitter: class { constructor() { this.event = event; } fire() {} dispose() {} },
    ThemeIcon: class { constructor(id) { this.id = id; } },
    DataTransferItem: class { constructor(value) { this.value = value; } asString() { return this.value; } },
    window: {
      createTreeView: () => ({ dispose() {} }),
      registerWebviewViewProvider: (id, provider) => { assert.equal(id, 'quickCmd.editor'); editorProvider = provider; return event(); },
      showInputBox: async () => inputs.shift(),
      showQuickPick: async choices => choices[0],
      showErrorMessage: msg => { throw new Error(msg); },
      createTerminal: options => {
        const term = { options, calls: [], show() {}, sendText(text, newline) { this.calls.push([text, newline]); } };
        terminals.push(term); return term;
      }
    },
    workspace: {
      workspaceFolders: [], isTrusted: true,
      getConfiguration: () => ({ get: (key, fallback) => fallback }),
      createFileSystemWatcher: () => ({ onDidCreate: event, onDidChange: event, onDidDelete: event, dispose() {} }),
      onDidChangeWorkspaceFolders: event
    },
    commands: {
      registerCommand: (id, fn) => { callbacks.set(id, fn); return event(); },
      executeCommand: async id => {
        if (id === 'quickCmd.editor.focus' && !webviewResolved) {
          webviewResolved = true; editorProvider.resolveWebviewView({ webview, show() {} });
        }
      }
    },
    Uri: {
      file: fsPath => ({ fsPath }),
      joinPath: (uri, ...parts) => ({ fsPath: path.join(uri.fsPath, ...parts) })
    }
  };
  const originalLoad = Module._load;
  Module._load = function(request, parent, main) {
    return request === 'vscode' ? vscode : originalLoad.apply(this, arguments);
  };
  try {
    const { activate } = require('../src/extension');
    const context = {
      extensionPath: path.join(__dirname, '..'),
      extensionUri: { fsPath: path.join(__dirname, '..') },
      subscriptions: [],
      globalState: {
        get: (key, fallback) => state.get(key) || fallback,
        update: async (key, value) => state.set(key, structuredClone(value))
      }
    };
    activate(context);
    assert.equal(typeof callbacks.get('quickCmd.runById'), 'function');
    await callbacks.get('quickCmd.addGroup')();
    await callbacks.get('quickCmd.addCommand')();
    assert.equal(latest.groupTitle, 'Utilities');
    await onMessage({ type: 'save', groupId: latest.groupId, fields: {
      title: 'Combined', steps: [{ command: 'echo first', execute: true }, { command: 'echo second', execute: false }],
      terminal: 'new', confirm: false
    } });
    const cmd = state.get('quickCmd.globalConfig').groups[0].commands[0];
    assert.equal(cmd.command, undefined);
    assert.equal(cmd.steps.length, 2);
    await callbacks.get('quickCmd.searchCommands')();
    assert.equal(terminals.length, 1);
    assert.deepEqual(terminals[0].calls, [['echo first\necho second', false]]);
    await callbacks.get('quickCmd.runById')({ id: cmd.id, scopeId: 'global' });
    assert.equal(terminals.length, 2);
    assert.deepEqual(terminals[1].calls, [['echo first\necho second', false]]);
  } finally { Module._load = originalLoad; }
});
