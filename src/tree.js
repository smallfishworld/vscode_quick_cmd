'use strict';
const { commandSteps, moveDrop } = require('./model');
const TREE_MIME = 'application/vnd.code.tree.quickCmd.commands';

/** Native VS Code Tree View: scope → group → runnable command. */
class CommandTreeProvider {
  constructor(vscode, store, runner) {
    this.vscode = vscode;
    this.store = store;
    this.runner = runner;
    this.dragMimeTypes = [TREE_MIME];
    this.dropMimeTypes = [TREE_MIME];
    this.changed = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.changed.event;
  }
  refresh() { this.changed.fire(); }

  async handleDrag(source, data) {
    if (source.length !== 1 || !['command', 'group'].includes(source[0].kind)) { return; }
    const item = source[0];
    const payload = { kind: item.kind, scopeId: item.scope.id, groupId: item.groupId,
      commandId: item.commandId };
    data.set(TREE_MIME, new this.vscode.DataTransferItem(JSON.stringify(payload)));
  }

  async handleDrop(target, data) {
    const transfer = data.get(TREE_MIME);
    if (!transfer || !target || !['scope', 'group', 'command'].includes(target.kind)) { return; }
    try {
      const source = JSON.parse(await transfer.asString());
      if (!source || !['command', 'group'].includes(source.kind)) { return; }
      if (!target.scope || source.scopeId !== target.scope.id) {
        throw new Error('Drag and drop is supported only within the same configuration scope.');
      }
      await this.store.update(target.scope, cfg => moveDrop(cfg, source, {
        kind: target.kind, groupId: target.groupId, commandId: target.commandId
      }));
      this.refresh();
    } catch (error) {
      await this.vscode.window.showErrorMessage('Quick Cmd drag: ' + (error.message || String(error)));
    }
  }
  getTreeItem(item) { return item; }
  async getChildren(parent) {
    const vscode = this.vscode;
    if (!parent) {
      return this.store.scopes().map(scope => {
        const item = new vscode.TreeItem(scope.label, vscode.TreeItemCollapsibleState.Expanded);
        item.kind = 'scope'; item.scope = scope; item.id = `scope:${scope.id}`;
        item.contextValue = `quickCmd.scope.${scope.type}`;
        item.iconPath = new vscode.ThemeIcon(scope.type === 'global' ? 'globe' : 'root-folder');
        return item;
      });
    }
    if (parent.kind === 'error' || parent.kind === 'command') { return []; }
    if (parent.kind === 'scope') {
      try {
        const config = await this.store.read(parent.scope);
        return config.groups.map(group => {
          const item = new vscode.TreeItem(group.title, vscode.TreeItemCollapsibleState.Expanded);
          item.kind = 'group'; item.id = `group:${parent.scope.id}:${group.id}`;
          item.contextValue = 'quickCmd.group'; item.scope = parent.scope; item.groupId = group.id;
          item.iconPath = new vscode.ThemeIcon('folder'); item.description = `${group.commands.length}`;
          return item;
        });
      } catch (error) {
        const item = new vscode.TreeItem('Invalid configuration — see tooltip');
        item.kind = 'error'; item.iconPath = new vscode.ThemeIcon('error'); item.tooltip = error.message;
        return [item];
      }
    }
    if (parent.kind === 'group') {
      const config = await this.store.read(parent.scope);
      const group = config.groups.find(item => item.id === parent.groupId);
      return (group?.commands || []).map(command => {
        const item = new vscode.TreeItem(command.title, vscode.TreeItemCollapsibleState.None);
        item.kind = 'command'; item.id = `command:${parent.scope.id}:${parent.groupId}:${command.id}`;
        item.contextValue = 'quickCmd.command'; item.scope = parent.scope;
        item.groupId = parent.groupId; item.commandId = command.id;
        const status = this.runner?.status(parent.scope, command);
        item.iconPath = new vscode.ThemeIcon(command.icon || (status?.monitored && status.busy ? 'loading~spin' : 'terminal'));
        item.description = status?.staged && !status.busy ? 'Input only'
          : status?.monitored ? (status.busy ? 'Running' : status.exitCode === undefined ? 'Finished' : `Exit ${status.exitCode}`)
            : (command.description || (commandSteps(command).length > 1 ? `${commandSteps(command).length} steps` : ''));
        item.tooltip = commandSteps(command).map((step, i) => (i + 1) + '. ' + step.command + (step.execute ? ' ↵' : ' (input only)')).join('\n') + (command.cwd ? '\nWorking directory: ' + command.cwd : '');
        item.command = { command: 'quickCmd.run', title: 'Run command', arguments: [item] };
        return item;
      });
    }
    return [];
  }
  dispose() { this.changed.dispose(); }
}
module.exports = { CommandTreeProvider };
