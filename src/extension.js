'use strict';

const vscode = require('vscode');
const { t, setLocale, errorText } = require('./i18n');
const { ConfigStore } = require('./store');
const { CommandListProvider } = require('./list');
const { CommandEditorProvider } = require('./editor');
const { TerminalRunner } = require('./terminal');
const {
  addGroup,
  addCommand,
  requireGroup,
  requireCommand,
  findCommand,
  moveItem,
  commandSteps,
} = require('./model');
const { expand, extractInputs, detectShell } = require('./variables');
const { importScope, exportScope } = require('./transfer');

/** @param {import('vscode').ExtensionContext} context */
function activate(context) {
  setLocale(vscode.env?.language || 'en');
  void vscode.commands.executeCommand('setContext', 'quickCmd.editing', false);
  const store = new ConfigStore(vscode, context);
  const runner = new TerminalRunner(vscode);
  let selectedNode;
  const provider = new CommandListProvider(
    vscode,
    context,
    store,
    runner,
    (node) => {
      selectedNode = node;
    },
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('quickCmd.commands', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
  const editor = new CommandEditorProvider(
    vscode,
    context,
    store,
    () => provider.refresh(),
    (scope, cmd) => execute(scope, cmd),
  );
  context.subscriptions.push(editor);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('quickCmd.editor', editor, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
  context.subscriptions.push(provider, runner);
  if (runner.onDidChangeStatus) {
    context.subscriptions.push(
      runner.onDidChangeStatus(() => provider.refresh()),
    );
  }

  function register(id, fn) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async (...args) => {
        try {
          if (args[0]?.quickCmdListContext === true) {
            args[0] = await provider.contextNode(id, args[0]);
          }
          return await fn(...args);
        } catch (error) {
          await vscode.window.showErrorMessage(
            `Quick Cmd: ${errorText(error)}`,
          );
        }
      }),
    );
  }
  function globalScope() {
    return store.scopes()[0];
  }
  async function promptTitle(prompt, value = '') {
    return vscode.window.showInputBox({
      prompt: t(prompt),
      value,
      ignoreFocusOut: true,
      validateInput: (text) =>
        !text.trim()
          ? t('Name cannot be blank')
          : text.length > 128
            ? t('Maximum 128 characters')
            : undefined,
    });
  }
  async function createGroup(scope) {
    const title = await promptTitle('Group name');
    if (title === undefined) {
      return undefined;
    }
    const group = await store.update(scope, (config) =>
      addGroup(config, title),
    );
    provider.refresh();
    return group;
  }
  async function pickGroup(scope) {
    const config = await store.read(scope);
    if (!config.groups.length) {
      return createGroup(scope);
    }
    const selected = await vscode.window.showQuickPick(
      [
        ...config.groups.map((group) => ({ label: group.title, group })),
        { label: '$(add) ' + t('Create new group...'), create: true },
      ],
      { placeHolder: t('Choose a command group') },
    );
    if (!selected) {
      return undefined;
    }
    return selected.create ? createGroup(scope) : selected.group;
  }

  async function execute(scope, cmd) {
    runner.ensureTrusted();
    const folder = runner.getFolder(scope);
    const current =
      vscode.window.activeTextEditor?.document.uri || runner.lastTextUri;
    const inputs = {};
    const steps = commandSteps(cmd);
    for (const name of extractInputs(
      ...steps.map((step) => step.command),
      cmd.cwd,
      ...Object.values(cmd.env || {}),
    )) {
      const value = await vscode.window.showInputBox({
        prompt: t('Input parameter: {0}', name),
        ignoreFocusOut: true,
      });
      if (value === undefined) {
        return;
      }
      inputs[name] = value;
    }
    const ctx = {
      workspaceFolder: folder?.uri.fsPath,
      file: current?.scheme === 'file' ? current.fsPath : undefined,
      env: { ...process.env },
      inputs,
      shell: detectShell(vscode),
    };
    const resolvedSteps = steps.map((step) => ({
      text: expand(step.command, ctx),
      execute: step.execute,
    }));
    const preview = resolvedSteps
      .map(
        (step) =>
          step.text +
          (step.execute ? ' ↵' : ' (' + t('Sent without trailing Enter') + ')'),
      )
      .join('\n');
    if (cmd.confirm) {
      const result = await vscode.window.showWarningMessage(
        t('Send "{0}"?\n{1}', cmd.title, preview.slice(0, 500)),
        { modal: true },
        t('Run Command'),
      );
      if (result !== t('Run Command')) {
        return;
      }
    }
    if (cmd.terminal === 'active' && runner.isActiveTerminalUnsafe()) {
      const result = await vscode.window.showWarningMessage(
        t(
          'The active terminal may be busy. Sending text could interfere with an interactive program.',
        ),
        { modal: true },
        t('Send Anyway'),
      );
      if (result !== t('Send Anyway')) {
        return;
      }
    }
    runner.run(scope, cmd, { steps: resolvedSteps, context: ctx });
    provider.refresh();
  }

  async function commandFromNode(node) {
    if (node?.kind !== 'command') {
      return undefined;
    }
    const config = await store.read(node.scope);
    return requireCommand(config, node.groupId, node.commandId);
  }

  register('quickCmd.refresh', () => provider.refresh());
  register('quickCmd.addGroup', async (node) => {
    const scope = node?.scope || globalScope();
    if (scope) {
      await createGroup(scope);
    }
  });
  register('quickCmd.addCommand', async (node) => {
    node = node || selectedNode;
    const scope = node?.scope || globalScope();
    if (!scope) {
      return;
    }
    const group = ['group', 'command'].includes(node?.kind)
      ? { id: node.groupId }
      : await pickGroup(scope);
    if (!group) {
      return;
    }
    await editor.open(scope, group.id);
  });
  register('quickCmd.run', async (node) => {
    const cmd = await commandFromNode(node);
    if (cmd) {
      await execute(node.scope, cmd);
    }
  });
  register('quickCmd.openEditorPanel', () => editor.openPanel());
  register('quickCmd.closeEditor', () => editor.close());
  register('quickCmd.closeEditorView', () => editor.close());
  register('quickCmd.collapseAll', () => provider.collapseAll());
  register('quickCmd.openSettings', () =>
    vscode.commands.executeCommand(
      'workbench.action.openSettings',
      '@ext:smallfishworld.vscode-quick-cmd',
    ),
  );
  register('quickCmd.editCommand', async (node) => {
    node = node || selectedNode;
    const current = await commandFromNode(node);
    if (current) {
      await editor.open(node.scope, node.groupId, node.commandId);
    }
  });
  register('quickCmd.duplicateCommand', async (node) => {
    const original = await commandFromNode(node);
    if (!original) {
      return;
    }
    const { id: unused, ...fields } = original;
    await store.update(node.scope, (config) =>
      addCommand(config, node.groupId, {
        ...fields,
        title: t('{0} (copy)', original.title.slice(0, 121)),
      }),
    );
    provider.refresh();
  });
  register('quickCmd.deleteCommand', async (node) => {
    const cmd = await commandFromNode(node);
    if (!cmd) {
      return;
    }
    const answer = await vscode.window.showWarningMessage(
      t('Delete command "{0}"?', cmd.title),
      { modal: true },
      t('Delete'),
    );
    if (answer !== t('Delete')) {
      return;
    }
    await store.update(node.scope, (config) => {
      const group = requireGroup(config, node.groupId);
      const i = group.commands.findIndex((c) => c.id === node.commandId);
      if (i < 0) {
        throw new Error('Command no longer exists.');
      }
      group.commands.splice(i, 1);
    });
    provider.refresh();
  });
  register('quickCmd.renameGroup', async (node) => {
    if (node?.kind !== 'group') {
      return;
    }
    const cfg = await store.read(node.scope);
    const title = await promptTitle(
      'Rename group',
      requireGroup(cfg, node.groupId).title,
    );
    if (title === undefined) {
      return;
    }
    await store.update(node.scope, (latest) => {
      requireGroup(latest, node.groupId).title = title.trim();
    });
    provider.refresh();
  });
  register('quickCmd.deleteGroup', async (node) => {
    if (node?.kind !== 'group') {
      return;
    }
    const cfg = await store.read(node.scope);
    const group = requireGroup(cfg, node.groupId);
    const answer = await vscode.window.showWarningMessage(
      t(
        'Delete group "{0}" and {1} command(s)?',
        group.title,
        group.commands.length,
      ),
      { modal: true },
      t('Delete'),
    );
    if (answer !== t('Delete')) {
      return;
    }
    await store.update(node.scope, (config) => {
      const i = config.groups.findIndex((g) => g.id === node.groupId);
      if (i < 0) {
        throw new Error('Group no longer exists.');
      }
      config.groups.splice(i, 1);
    });
    provider.refresh();
  });
  for (const [suffix, direction] of [
    ['Up', -1],
    ['Down', 1],
  ]) {
    register(`quickCmd.moveCommand${suffix}`, async (node) => {
      if (node?.kind !== 'command') {
        return;
      }
      await store.update(node.scope, (config) =>
        moveItem(
          requireGroup(config, node.groupId).commands,
          node.commandId,
          direction,
        ),
      );
      provider.refresh();
    });
    register(`quickCmd.moveGroup${suffix}`, async (node) => {
      if (node?.kind !== 'group') {
        return;
      }
      await store.update(node.scope, (config) =>
        moveItem(config.groups, node.groupId, direction),
      );
      provider.refresh();
    });
  }
  register('quickCmd.exportConfig', async (node) => {
    const scope = node?.scope || globalScope();
    if (scope && (await exportScope(vscode, store, scope))) {
      vscode.window.showInformationMessage(
        t('Quick Cmd configuration exported.'),
      );
    }
  });
  register('quickCmd.importConfig', async (node) => {
    const scope = node?.scope || globalScope();
    if (scope && (await importScope(vscode, store, scope))) {
      provider.refresh();
    }
  });
  register('quickCmd.searchCommands', async () => {
    const entries = [];
    for (const scope of store.scopes()) {
      const config = await store.read(scope);
      for (const group of config.groups) {
        for (const cmd of group.commands) {
          entries.push({
            groupId: group.id,
            label: `$(terminal) ${cmd.title}`,
            description: group.title,
            detail: commandSteps(cmd)
              .map((step) => step.command)
              .join(' ; '),
            scope,
            cmd,
          });
        }
      }
    }
    if (!entries.length) {
      vscode.window.showInformationMessage(
        t('No Quick Cmd commands configured yet.'),
      );
      return;
    }
    const item = await vscode.window.showQuickPick(entries, {
      placeHolder: t('Search commands to send'),
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (item) {
      await execute(item.scope, item.cmd);
    }
  });
  register('quickCmd.runById', async (id) => {
    if (id && typeof id === 'object') {
      id = id.id;
    }
    if (typeof id !== 'string' || !id) {
      throw new Error(
        'Provide a command id; see the Quick Cmd shortcut documentation.',
      );
    }
    const scope = store.scopes()[0];
    const found = findCommand(await store.read(scope), id);
    if (!found) {
      throw new Error(`Command id not found: ${id}`);
    }
    await execute(scope, found.command);
  });
  register('quickCmd.copyShortcut', async (node) => {
    const cmd = await commandFromNode(node);
    if (!cmd) {
      return;
    }
    const snippet = JSON.stringify(
      {
        key: 'ctrl+alt+shift+r',
        command: 'quickCmd.runById',
        args: { id: cmd.id },
      },
      null,
      2,
    );
    await vscode.env.clipboard.writeText(snippet);
    await vscode.commands.executeCommand(
      'workbench.action.openGlobalKeybindingsFile',
    );
    vscode.window.showInformationMessage(
      t(
        'Keybinding JSON copied. Paste it into keybindings.json and customize the key.',
      ),
    );
  });
  register('quickCmd.stop', async (node) => {
    const cmd = await commandFromNode(node);
    if (!cmd) {
      return;
    }
    const status = runner.status(node.scope, cmd);
    if (!status?.busy) {
      throw new Error('This command does not have a running tracked terminal.');
    }
    const answer = await vscode.window.showWarningMessage(
      t('Close the dedicated terminal to stop the running command?'),
      { modal: true },
      t('Stop Command'),
    );
    if (answer === t('Stop Command')) {
      runner.stop(node.scope, cmd);
    }
  });
  if (vscode.workspace.onDidChangeConfiguration) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('quickCmd.listFontSize')) {
          void provider.refresh();
        }
      }),
    );
  }
}
function deactivate() {}
module.exports = { activate, deactivate };
