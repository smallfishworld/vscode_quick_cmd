'use strict';

const vscode = require('vscode');
const { ConfigStore } = require('./store');
const { CommandTreeProvider } = require('./tree');
const { TerminalRunner } = require('./terminal');
const { addGroup, addCommand, requireGroup, requireCommand } = require('./model');

/** @param {import('vscode').ExtensionContext} context */
function activate(context) {
  const store = new ConfigStore(vscode, context);
  const provider = new CommandTreeProvider(vscode, store);
  const runner = new TerminalRunner(vscode);
  context.subscriptions.push(vscode.window.createTreeView('quickCmd.commands', { treeDataProvider: provider }));
  context.subscriptions.push(provider);

  function register(id, fn) {
    context.subscriptions.push(vscode.commands.registerCommand(id, async (...args) => {
      try {
        await fn(...args);
      } catch (error) {
        await vscode.window.showErrorMessage('Quick Cmd: ' + (error.message || String(error)));
      }
    }));
  }

  async function pickScope() {
    const scopes = store.scopes();
    if (scopes.length === 1) { return scopes[0]; }
    const selected = await vscode.window.showQuickPick(scopes.map(scope => ({
      label: scope.label,
      description: scope.type === 'global'
        ? 'Available in all workspaces' : 'Stored in .vscode/quick-cmd.json',
      scope
    })), { placeHolder: 'Where should this command be saved?' });
    return selected?.scope;
  }

  async function promptTitle(prompt, value = '') {
    return vscode.window.showInputBox({
      prompt, value, ignoreFocusOut: true,
      validateInput: text => !text.trim() ? 'Name cannot be blank'
        : text.length > 128 ? 'Maximum 128 characters' : undefined
    });
  }

  async function createGroup(scope) {
    const title = await promptTitle('Group name');
    if (title === undefined) { return undefined; }
    const group = await store.update(scope, config => addGroup(config, title));
    provider.refresh();
    return group;
  }

  async function pickGroup(scope) {
    const config = await store.read(scope);
    if (config.groups.length === 0) { return createGroup(scope); }
    const selected = await vscode.window.showQuickPick([
      ...config.groups.map(group => ({ label: group.title, group })),
      { label: '$(add) Create a new group...', create: true }
    ], { placeHolder: 'Choose a command group' });
    if (!selected) { return undefined; }
    return selected.create ? createGroup(scope) : selected.group;
  }

  async function promptCommand(existing = {}) {
    const title = await promptTitle('Command display name', existing.title || '');
    if (title === undefined) { return undefined; }
    const command = await vscode.window.showInputBox({
      prompt: 'Shell command (executed by your configured VS Code terminal shell)',
      value: existing.command || '', ignoreFocusOut: true,
      validateInput: text => !text.trim() ? 'Command cannot be blank'
        : text.length > 8192 ? 'Maximum 8192 characters' : undefined
    });
    if (command === undefined) { return undefined; }
    const cwd = await vscode.window.showInputBox({
      prompt: 'Working directory (optional): blank = project root; relative path or ${workspaceFolder} supported',
      value: existing.cwd || '', ignoreFocusOut: true,
      validateInput: text => text.length > 2048 ? 'Maximum 2048 characters' : undefined
    });
    if (cwd === undefined) { return undefined; }
    return { title: title.trim(), command,
      ...(cwd.trim() ? { cwd: cwd.trim() } : {}) };
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
    const fields = await promptCommand();
    if (!fields) { return; }
    await store.update(scope, config => addCommand(config, group.id, fields));
    provider.refresh();
  });

  register('quickCmd.run', async node => {
    if (node?.kind !== 'command') { return; }
    const config = await store.read(node.scope);
    runner.run(node.scope, requireCommand(config, node.groupId, node.commandId));
  });

  register('quickCmd.editCommand', async node => {
    if (node?.kind !== 'command') { return; }
    const config = await store.read(node.scope);
    const current = requireCommand(config, node.groupId, node.commandId);
    const fields = await promptCommand(current);
    if (!fields) { return; }
    await store.update(node.scope, latest => {
      const command = requireCommand(latest, node.groupId, node.commandId);
      command.title = fields.title;
      command.command = fields.command;
      if (fields.cwd) { command.cwd = fields.cwd; } else { delete command.cwd; }
    });
    provider.refresh();
  });

  register('quickCmd.deleteCommand', async node => {
    if (node?.kind !== 'command') { return; }
    const config = await store.read(node.scope);
    const command = requireCommand(config, node.groupId, node.commandId);
    const confirmation = await vscode.window.showWarningMessage(
      'Delete command "' + command.title + '"?', { modal: true }, 'Delete'
    );
    if (confirmation !== 'Delete') { return; }
    await store.update(node.scope, latest => {
      const group = requireGroup(latest, node.groupId);
      const index = group.commands.findIndex(item => item.id === node.commandId);
      if (index < 0) { throw new Error('Command no longer exists.'); }
      group.commands.splice(index, 1);
    });
    provider.refresh();
  });

  register('quickCmd.renameGroup', async node => {
    if (node?.kind !== 'group') { return; }
    const config = await store.read(node.scope);
    const title = await promptTitle('Rename group', requireGroup(config, node.groupId).title);
    if (title === undefined) { return; }
    await store.update(node.scope, latest => {
      requireGroup(latest, node.groupId).title = title.trim();
    });
    provider.refresh();
  });

  register('quickCmd.deleteGroup', async node => {
    if (node?.kind !== 'group') { return; }
    const config = await store.read(node.scope);
    const group = requireGroup(config, node.groupId);
    const confirmation = await vscode.window.showWarningMessage(
      'Delete group "' + group.title + '" and its ' + group.commands.length + ' command(s)?',
      { modal: true }, 'Delete'
    );
    if (confirmation !== 'Delete') { return; }
    await store.update(node.scope, latest => {
      const index = latest.groups.findIndex(item => item.id === node.groupId);
      if (index < 0) { throw new Error('Group no longer exists.'); }
      latest.groups.splice(index, 1);
    });
    provider.refresh();
  });

  register('quickCmd.openConfig', async node => {
    const scope = node?.kind === 'scope' && node.scope.type === 'workspace'
      ? node.scope : await pickScope();
    if (!scope) { return; }
    if (scope.type === 'global') {
      await vscode.window.showInformationMessage(
        'Global commands are edited directly in the Quick Cmd sidebar.'
      );
      return;
    }
    await store.update(scope, () => {});
    const document = await vscode.workspace.openTextDocument(store.configUri(scope));
    await vscode.window.showTextDocument(document);
  });

  const watcher = vscode.workspace.createFileSystemWatcher('**/.vscode/quick-cmd.json');
  context.subscriptions.push(watcher);
  context.subscriptions.push(watcher.onDidChange(() => provider.refresh()));
  context.subscriptions.push(watcher.onDidCreate(() => provider.refresh()));
  context.subscriptions.push(watcher.onDidDelete(() => provider.refresh()));
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh()));
}
function deactivate() {}
module.exports = { activate, deactivate };
