'use strict';

/** Native VS Code Tree View: scope → group → runnable command. */
class CommandTreeProvider {
  constructor(vscode, store, runner) {
    this.vscode = vscode;
    this.store = store;
    this.runner = runner;
    this.changed = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.changed.event;
  }
  refresh() { this.changed.fire(); }
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
        item.description = status?.monitored ? (status.busy ? 'Running' : status.exitCode === undefined ? 'Finished' : `Exit ${status.exitCode}`) : (command.description || '');
        item.tooltip = `${command.command}${command.cwd ? `\nWorking directory: ${command.cwd}` : ''}`;
        item.command = { command: 'quickCmd.run', title: 'Run command', arguments: [item] };
        return item;
      });
    }
    return [];
  }
  dispose() { this.changed.dispose(); }
}
module.exports = { CommandTreeProvider };
