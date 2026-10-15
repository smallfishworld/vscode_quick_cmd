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
  const modes = new Map();
  const answers = [];
  let loads = 0;
  let editorProvider;
  let onMessage;
  let latest;
  let webviewResolved = false;
  const event = () => ({ dispose() {} });
  const webview = {
    cspSource: 'vscode-resource:',
    asWebviewUri: (uri) => ({ toString: () => uri.fsPath }),
    postMessage: (msg) => {
      if (msg.type === 'load') {
        latest = msg;
        loads++;
      }
      return Promise.resolve(true);
    },
    onDidReceiveMessage: (callback) => {
      onMessage = callback;
      return event();
    },
  };
  const vscode = {
    EventEmitter: class {
      constructor() {
        this.event = event;
      }
      fire() {}
      dispose() {}
    },
    ThemeIcon: class {
      constructor(id) {
        this.id = id;
      }
    },
    DataTransferItem: class {
      constructor(value) {
        this.value = value;
      }
      asString() {
        return this.value;
      }
    },
    window: {
      registerFileDecorationProvider: () => event(),
      createTreeView: () => ({ dispose() {} }),
      registerWebviewViewProvider: (id, provider) => {
        assert.equal(id, 'quickCmd.editor');
        editorProvider = provider;
        return event();
      },
      showInputBox: async () => inputs.shift(),
      showQuickPick: async (choices) => choices[0],
      showWarningMessage: async () => answers.shift(),
      showErrorMessage: (msg) => {
        throw new Error(msg);
      },
      createTerminal: (options) => {
        const term = {
          options,
          calls: [],
          show() {},
          sendText(text, newline) {
            this.calls.push([text, newline]);
          },
        };
        terminals.push(term);
        return term;
      },
    },
    workspace: {
      workspaceFolders: [],
      isTrusted: true,
      getConfiguration: () => ({ get: (key, fallback) => fallback }),
      createFileSystemWatcher: () => ({
        onDidCreate: event,
        onDidChange: event,
        onDidDelete: event,
        dispose() {},
      }),
      onDidChangeWorkspaceFolders: event,
    },
    commands: {
      registerCommand: (id, fn) => {
        callbacks.set(id, fn);
        return event();
      },
      executeCommand: async (id, ...args) => {
        if (id === 'setContext') {
          modes.set(args[0], args[1]);
        }
        if (id === 'quickCmd.editor.focus' && !webviewResolved) {
          webviewResolved = true;
          editorProvider.resolveWebviewView({ webview, show() {} });
        }
      },
    },
    Uri: {
      file: (fsPath) => ({ fsPath }),
      joinPath: (uri, ...parts) => ({
        fsPath: path.join(uri.fsPath, ...parts),
      }),
    },
  };
  const originalLoad = Module._load;
  Module._load = function (request, parent, main) {
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
        update: async (key, value) => state.set(key, structuredClone(value)),
      },
    };
    activate(context);
    assert.equal(typeof callbacks.get('quickCmd.runById'), 'function');
    assert.equal(modes.get('quickCmd.editMode'), false);
    assert.equal(modes.get('quickCmd.editing'), false);
    await callbacks.get('quickCmd.addGroup')();
    await callbacks.get('quickCmd.addCommand')();
    assert.equal(latest.groupTitle, 'Utilities');
    const raw = {
      ...latest.raw,
      title: 'Combined',
      steps: [
        { command: 'echo first', execute: true },
        { command: 'echo second', execute: false },
      ],
    };
    await onMessage({
      type: 'draft',
      token: latest.token,
      baseRevision: latest.revision,
      fields: raw,
    });
    await onMessage({
      type: 'save',
      token: latest.token,
      revision: latest.revision + 1,
      groupId: latest.groupId,
      fields: raw,
    });
    const cmd = state.get('quickCmd.globalConfig').groups[0].commands[0];
    assert.equal(cmd.command, undefined);
    assert.equal(cmd.steps.length, 2);
    // Creating a command explicitly enters edit mode; searching here edits only.
    assert.equal(modes.get('quickCmd.editMode'), true);
    await callbacks.get('quickCmd.searchCommands')();
    assert.equal(terminals.length, 0);
    await callbacks.get('quickCmd.closeEditor')();
    assert.equal(modes.get('quickCmd.editMode'), false);
    assert.equal(modes.get('quickCmd.editing'), false);
    const node = {
      kind: 'command',
      scope: { id: 'global', type: 'global' },
      groupId: state.get('quickCmd.globalConfig').groups[0].id,
      commandId: cmd.id,
    };
    const beforeLoads = loads;
    await callbacks.get('quickCmd.selectCommand')(node);
    assert.equal(terminals.length, 1, 'normal clicks send');
    assert.equal(loads, beforeLoads, 'normal clicks never open the editor');
    assert.equal(modes.get('quickCmd.editing'), false);
    assert.deepEqual(terminals[0].calls, [['echo first\necho second', false]]);
    await callbacks.get('quickCmd.searchCommands')();
    assert.equal(terminals.length, 2, 'normal search sends directly');
    await callbacks.get('quickCmd.showEditor')();
    assert.equal(modes.get('quickCmd.editMode'), true);
    assert.equal(
      modes.get('quickCmd.editing'),
      false,
      'entering mode alone need not open a form',
    );
    await callbacks.get('quickCmd.selectCommand')(node);
    assert.equal(terminals.length, 2, 'edit-mode clicks never send');
    assert.equal(modes.get('quickCmd.editing'), true);
    await onMessage({
      type: 'draft',
      token: latest.token,
      baseRevision: latest.revision,
      fields: { ...latest.raw, title: 'Dirty' },
    });
    answers.push('Cancel');
    assert.equal(await callbacks.get('quickCmd.closeEditor')(), false);
    assert.equal(modes.get('quickCmd.editMode'), true);
    assert.equal(modes.get('quickCmd.editing'), true);
    answers.push('Discard');
    assert.equal(await callbacks.get('quickCmd.closeEditor')(), true);
    assert.equal(modes.get('quickCmd.editMode'), false);
    await callbacks.get('quickCmd.runById')({ id: cmd.id });
    assert.equal(terminals.length, 3);
  } finally {
    Module._load = originalLoad;
  }
});
