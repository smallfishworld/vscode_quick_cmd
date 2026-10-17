'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { memoryFs } = require('./helpers/memory-fs');

test('extension activates the embedded editor, saves a multi-step command, then runs it', async () => {
  const callbacks = new Map();
  // An existing empty JSON collection must stay empty (never auto-seeded).
  const storage = memoryFs();
  storage.writeConfig({ version: 1, groups: [] });
  const inputs = ['Utilities'];
  const terminals = [];
  const modes = new Map();
  const answers = [];
  const warnings = [];
  let loads = 0;
  let editorProvider, listProvider;
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
        if (id === 'quickCmd.commands') {
          listProvider = provider;
        } else {
          assert.equal(id, 'quickCmd.editor');
          editorProvider = provider;
        }
        return event();
      },
      showInputBox: async () => inputs.shift(),
      showQuickPick: async (choices) => choices[0],
      showWarningMessage: async (...args) => {
        warnings.push(args);
        return answers.shift();
      },
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
      fs: storage.fs,
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
        if (callbacks.has(id)) {
          return callbacks.get(id)(...args);
        }
        if (id === 'quickCmd.editor.focus' && !webviewResolved) {
          webviewResolved = true;
          editorProvider.resolveWebviewView({ webview, show() {} });
        }
      },
    },
    Uri: storage.vscodeUri,
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
      globalStorageUri: storage.root,
      subscriptions: [],
      globalState: {
        get: () => { throw Error('Old globalState must not be read'); },
        update: () => { throw Error('Old globalState must not be written'); },
      },
    };
    activate(context);
    assert.equal(typeof callbacks.get('quickCmd.runById'), 'function');

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
    const cmd = storage.readConfig().groups[0].commands[0];
    assert.equal(cmd.command, undefined);
    assert.equal(cmd.steps.length, 2);
    assert.equal(callbacks.has('quickCmd.showEditor'), false);
    await callbacks.get('quickCmd.closeEditor')();
    assert.equal(modes.get('quickCmd.editing'), false);
    let listMessage, listModel;
    const listPackets = [];
    listProvider.resolveWebviewView({
      webview: {
        cspSource: 'vscode-resource:',
        asWebviewUri: (uri) => uri.fsPath,
        onDidReceiveMessage: (fn) => {
          listMessage = fn;
          return event();
        },
        postMessage: (packet) => {
          listPackets.push(packet);
          if (packet.type === 'model') {
            listModel = packet;
          }
          return Promise.resolve();
        },
      },
    });
    await listMessage({ type: 'ready' });
    const node = {
      kind: 'command',
      groupId: listModel.groups[0].id,
      commandId: cmd.id,
    };
    const beforeLoads = loads;
    await listMessage({ type: 'run', token: listModel.token, ...node });
    assert.equal(terminals.length, 1);
    assert.equal(loads, beforeLoads, 'clicking the row never opens an editor');
    assert.equal(modes.get('quickCmd.editing'), false);
    assert.deepEqual(terminals[0].calls, [['echo first\necho second', false]]);
    const nativeContext = {
      ...node,
      webview: 'quickCmd.commands',
      webviewSection: 'command',
      quickCmdListContext: true,
      quickCmdToken: listModel.token,
    };
    await callbacks.get('quickCmd.editCommand')(nativeContext);
    assert.equal(terminals.length, 1, 'row edit never sends');
    assert.equal(modes.get('quickCmd.editing'), true);
    await onMessage({
      type: 'draft',
      token: latest.token,
      baseRevision: latest.revision,
      fields: { ...latest.raw, title: 'Dirty' },
    });
    // × 仍走放弃确认：取消后保持编辑。
    answers.push('Cancel');
    assert.equal(await callbacks.get('quickCmd.closeEditorView')(), false);
    assert.equal(modes.get('quickCmd.editing'), true);
    // ✓ 直接保存草稿并退出，不弹确认框。
    assert.equal(await callbacks.get('quickCmd.closeEditor')(), true);
    assert.equal(modes.get('quickCmd.editing'), false);
    assert.equal(
      storage.readConfig().groups[0].commands[0].title,
      'Dirty',
    );
    // 再次进入编辑并改脏，× 选择放弃后退出。
    await callbacks.get('quickCmd.editCommand')(nativeContext);
    assert.equal(modes.get('quickCmd.editing'), true);
    await onMessage({
      type: 'draft',
      token: latest.token,
      baseRevision: latest.revision,
      fields: { ...latest.raw, title: 'Discarded' },
    });
    answers.push('Discard');
    assert.equal(await callbacks.get('quickCmd.closeEditorView')(), true);
    assert.equal(modes.get('quickCmd.editing'), false);
    assert.equal(
      storage.readConfig().groups[0].commands[0].title,
      'Dirty',
    );
    await callbacks.get('quickCmd.searchCommands')();
    assert.equal(terminals.length, 2);
    const beforeCollapsePackets = listPackets.length;
    await callbacks.get('quickCmd.collapseAll')();
    assert.ok(
      listPackets.slice(beforeCollapsePackets).some(packet => packet.type === 'collapseAll'),
      'collapseAll should be sent even if an asynchronous model refresh follows it',
    );
    await callbacks.get('quickCmd.runById')({ id: cmd.id });
    assert.equal(terminals.length, 3);
    answers.push('Cancel');
    await callbacks.get('quickCmd.deleteCommand')(nativeContext);
    assert.equal(warnings.at(-1)[1].modal, true);
    assert.equal(
      storage.readConfig().groups[0].commands.length,
      1,
    );
    answers.push('Delete');
    await callbacks.get('quickCmd.deleteCommand')(nativeContext);
    assert.equal(
      storage.readConfig().groups[0].commands.length,
      0,
    );
    assert.equal(
      terminals.length,
      3,
      'neither cancelled nor confirmed deletion sends commands',
    );
  } finally {
    Module._load = originalLoad;
  }
});
