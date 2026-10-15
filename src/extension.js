'use strict';

const vscode = require('vscode');
const { ConfigStore } = require('./store');
const { CommandTreeProvider } = require('./tree');
const { CommandEditorProvider } = require('./editor');
const { TerminalRunner } = require('./terminal');
const { addGroup, addCommand, requireGroup, requireCommand, findCommand, moveItem, commandSteps } = require('./model');
const { expand, extractInputs, detectShell } = require('./variables');
const { importScope, exportScope } = require('./transfer');

/** @param {import('vscode').ExtensionContext} context */
function activate(context) {
  const store = new ConfigStore(vscode, context);
  const runner = new TerminalRunner(vscode);
  const provider = new CommandTreeProvider(vscode, store, runner);
  context.subscriptions.push(vscode.window.createTreeView('quickCmd.commands', {
    treeDataProvider: provider, dragAndDropController: provider
  }));
  const editor = new CommandEditorProvider(vscode, context, store, () => provider.refresh());
  context.subscriptions.push(editor);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('quickCmd.editor', editor, {
    webviewOptions: { retainContextWhenHidden: true }
  }));
  context.subscriptions.push(provider, runner);
  if (runner.onDidChangeStatus) { context.subscriptions.push(runner.onDidChangeStatus(() => provider.refresh())); }

  function register(id, fn) {
    context.subscriptions.push(vscode.commands.registerCommand(id, async (...args) => {
      try { return await fn(...args); }
      catch (error) { await vscode.window.showErrorMessage(`Quick Cmd: ${error.message || String(error)}`); }
    }));
  }
  async function pickScope() {
    const scopes = store.scopes();
    if (scopes.length === 1) { return scopes[0]; }
    const selected = await vscode.window.showQuickPick(scopes.map(scope => ({
      label: scope.label,
      description: scope.type === 'global' ? 'Available in all workspaces' : 'Stored in .vscode/quick-cmd.json',
      scope
    })), { placeHolder: 'Choose configuration scope' });
    return selected?.scope;
  }
  async function promptTitle(prompt, value = '') {
    return vscode.window.showInputBox({
      prompt, value, ignoreFocusOut: true,
      validateInput: text => !text.trim() ? 'Name cannot be blank' : text.length > 128 ? 'Maximum 128 characters' : undefined
    });
  }
  async function createGroup(scope) {
    const title = await promptTitle('Group name');
    if (title === undefined) { return undefined; }
    const group = await store.update(scope, config => addGroup(config, title));
    provider.refresh(); return group;
  }
  async function pickGroup(scope) {
    const config = await store.read(scope);
    if (!config.groups.length) { return createGroup(scope); }
    const selected = await vscode.window.showQuickPick([
      ...config.groups.map(group => ({ label: group.title, group })),
      { label: '$(add) Create new group...', create: true }
    ], { placeHolder: 'Choose a command group' });
    if (!selected) { return undefined; }
    return selected.create ? createGroup(scope) : selected.group;
  }

  async function execute(scope, cmd) {
    runner.ensureTrusted();
    const folder = runner.getFolder(scope);
    const current = vscode.window.activeTextEditor?.document.uri;
    const inputs = {};
    const steps = commandSteps(cmd);
    for (const name of extractInputs(...steps.map(step => step.command), cmd.cwd, ...Object.values(cmd.env || {}))) {
      const value = await vscode.window.showInputBox({ prompt: `Input parameter: ${name}`, ignoreFocusOut: true });
      if (value === undefined) { return; }
      inputs[name] = value;
    }
    const ctx = {
      workspaceFolder: folder?.uri.fsPath,
      file: current?.scheme === 'file' ? current.fsPath : undefined,
      env: { ...process.env }, inputs, shell: detectShell(vscode)
    };
    const resolvedSteps = steps.map(step => ({ text: expand(step.command, ctx), execute: step.execute }));
    const preview = resolvedSteps.map(step => step.text + (step.execute ? ' ↵' : ' (input only)')).join('\n');
    if (cmd.confirm) {
      const result = await vscode.window.showWarningMessage(
        `Send "${cmd.title}"?\n${preview.slice(0, 500)}`, { modal: true }, 'Run Command'
      );
      if (result !== 'Run Command') { return; }
    }
    if (cmd.terminal === 'active' && runner.isActiveTerminalUnsafe()) {
      const result = await vscode.window.showWarningMessage(
        'The active terminal may be busy. Sending text could interfere with an interactive program.',
        { modal: true }, 'Send Anyway'
      );
      if (result !== 'Send Anyway') { return; }
    }
    runner.run(scope, cmd, { steps: resolvedSteps, context: ctx });
    provider.refresh();
  }

  async function commandFromNode(node) {
    if (node?.kind !== 'command') { return undefined; }
    const config = await store.read(node.scope);
    return requireCommand(config, node.groupId, node.commandId);
  }

  register('quickCmd.refresh', () => provider.refresh());
  register('quickCmd.addGroup', async node => {
    const scope = node?.scope || await pickScope();
    if (scope) { await createGroup(scope); }
  });
  register('quickCmd.addCommand', async node => {
    const scope = node?.scope || await pickScope();
    if (!scope) { return; }
    const group = node?.kind === 'group' ? { id: node.groupId } : await pickGroup(scope);
    if (!group) { return; }
    await editor.open(scope, group.id);
  });
  register('quickCmd.run', async node => {
    const cmd = await commandFromNode(node);
    if (cmd) { await execute(node.scope, cmd); }
  });
  register('quickCmd.editCommand', async node => {
    const current = await commandFromNode(node);
    if (current) { await editor.open(node.scope, node.groupId, node.commandId); }
  });
  register('quickCmd.duplicateCommand', async node => {
    const original = await commandFromNode(node);
    if (!original) { return; }
    const { id: unused, ...fields } = original;
    await store.update(node.scope, config => addCommand(config, node.groupId, { ...fields, title: `${original.title.slice(0, 121)} (copy)` }));
    provider.refresh();
  });
  register('quickCmd.deleteCommand', async node => {
    const cmd = await commandFromNode(node);
    if (!cmd) { return; }
    const answer = await vscode.window.showWarningMessage(`Delete command "${cmd.title}"?`, { modal: true }, 'Delete');
    if (answer !== 'Delete') { return; }
    await store.update(node.scope, config => {
      const group = requireGroup(config, node.groupId);
      const i = group.commands.findIndex(c => c.id === node.commandId);
      if (i < 0) { throw new Error('Command no longer exists.'); }
      group.commands.splice(i, 1);
    });
    provider.refresh();
  });
  register('quickCmd.renameGroup', async node => {
    if (node?.kind !== 'group') { return; }
    const cfg = await store.read(node.scope);
    const title = await promptTitle('Rename group', requireGroup(cfg, node.groupId).title);
    if (title === undefined) { return; }
    await store.update(node.scope, latest => { requireGroup(latest, node.groupId).title = title.trim(); });
    provider.refresh();
  });
  register('quickCmd.deleteGroup', async node => {
    if (node?.kind !== 'group') { return; }
    const cfg = await store.read(node.scope);
    const group = requireGroup(cfg, node.groupId);
    const answer = await vscode.window.showWarningMessage(`Delete group "${group.title}" and ${group.commands.length} command(s)?`, { modal: true }, 'Delete');
    if (answer !== 'Delete') { return; }
    await store.update(node.scope, config => {
      const i = config.groups.findIndex(g => g.id === node.groupId);
      if (i < 0) { throw new Error('Group no longer exists.'); }
      config.groups.splice(i, 1);
    });
    provider.refresh();
  });
  for (const [suffix, direction] of [['Up', -1], ['Down', 1]]) {
    register(`quickCmd.moveCommand${suffix}`, async node => {
      if (node?.kind !== 'command') { return; }
      await store.update(node.scope, config => moveItem(requireGroup(config, node.groupId).commands, node.commandId, direction));
      provider.refresh();
    });
    register(`quickCmd.moveGroup${suffix}`, async node => {
      if (node?.kind !== 'group') { return; }
      await store.update(node.scope, config => moveItem(config.groups, node.groupId, direction));
      provider.refresh();
    });
  }
  register('quickCmd.openConfig', async node => {
    const scope = node?.kind === 'scope' ? node.scope : await pickScope();
    if (!scope) { return; }
    if (scope.type === 'global') { await vscode.window.showInformationMessage('Use Export to save global configuration as JSON.'); return; }
    // Only create the config if it does not exist. Opening must never overwrite edits on disk.
    try { await vscode.workspace.fs.stat(store.configUri(scope)); }
    catch (e) {
      if (e.code !== 'FileNotFound') { throw e; }
      await store.write(scope, await store.read(scope));
    }
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(store.configUri(scope)));
  });
  register('quickCmd.exportConfig', async node => {
    const scope = node?.scope || await pickScope();
    if (scope && await exportScope(vscode, store, scope)) { vscode.window.showInformationMessage('Quick Cmd configuration exported.'); }
  });
  register('quickCmd.importConfig', async node => {
    const scope = node?.scope || await pickScope();
    if (scope && await importScope(vscode, store, scope)) { provider.refresh(); }
  });
  register('quickCmd.searchCommands', async () => {
    const entries = [];
    for (const scope of store.scopes()) {
      const config = await store.read(scope);
      for (const group of config.groups) {
        for (const cmd of group.commands) {
          entries.push({ label: `$(terminal) ${cmd.title}`, description: `${scope.label} / ${group.title}`,
            detail: commandSteps(cmd).map(step => step.command).join(' ; '), scope, cmd });
        }
      }
    }
    if (!entries.length) { vscode.window.showInformationMessage('No Quick Cmd commands configured yet.'); return; }
    const item = await vscode.window.showQuickPick(entries, { placeHolder: 'Search and run a Quick Cmd command', matchOnDescription: true, matchOnDetail: true });
    if (item) { await execute(item.scope, item.cmd); }
  });
  register('quickCmd.runById', async (id, scopeId) => {
    if (id && typeof id === 'object') { scopeId = id.scopeId; id = id.id; }
    if (typeof id !== 'string' || !id) { throw new Error('Provide a command id; see the Quick Cmd shortcut documentation.'); }
    const matches = [];
    for (const scope of store.scopes()) {
      if (scopeId && scope.id !== scopeId) { continue; }
      const config = await store.read(scope);
      const found = findCommand(config, id);
      if (found) { matches.push({ scope, cmd: found.command }); }
    }
    if (!matches.length) { throw new Error(`Command id not found: ${id}`); }
    if (matches.length !== 1) { throw new Error(`Ambiguous command id: ${id}. Specify a scope id.`); }
    await execute(matches[0].scope, matches[0].cmd);
  });
  register('quickCmd.copyShortcut', async node => {
    const cmd = await commandFromNode(node);
    if (!cmd) { return; }
    const snippet = JSON.stringify({ key: 'ctrl+alt+shift+r', command: 'quickCmd.runById', args: { id: cmd.id, scopeId: node.scope.id } }, null, 2);
    await vscode.env.clipboard.writeText(snippet);
    await vscode.commands.executeCommand('workbench.action.openGlobalKeybindingsFile');
    vscode.window.showInformationMessage('Keybinding JSON copied. Paste it into keybindings.json and customize the key.');
  });
  register('quickCmd.stop', async node => {
    const cmd = await commandFromNode(node);
    if (!cmd) { return; }
    const status = runner.status(node.scope, cmd);
    if (!status?.busy) { throw new Error('This command does not have a running tracked terminal.'); }
    const answer = await vscode.window.showWarningMessage('Close the dedicated terminal to stop the running command?', { modal: true }, 'Stop Command');
    if (answer === 'Stop Command') { runner.stop(node.scope, cmd); }
  });

  const watcher = vscode.workspace.createFileSystemWatcher('**/.vscode/quick-cmd.json');
  context.subscriptions.push(watcher);
  for (const name of ['onDidChange', 'onDidCreate', 'onDidDelete']) {
    context.subscriptions.push(watcher[name](() => provider.refresh()));
  }
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh()));
}
function deactivate() {}
module.exports = { activate, deactivate };
