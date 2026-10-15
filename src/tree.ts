import * as vscode from 'vscode';
import {CommandDefinition, CommandGroup} from './model';
import {ConfigStore, Scope, scopeKey} from './store';

export type TreeNode =
  | {kind: 'scope'; scope: Scope}
  | {kind: 'group'; scope: Scope; group: CommandGroup}
  | {kind: 'command'; scope: Scope; groupId: string; entry: CommandDefinition}
  | {kind: 'error'; scope: Scope; message: string};

export class CommandTreeProvider implements vscode.TreeDataProvider<TreeNode>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private readonly subscription: vscode.Disposable;

  constructor(private readonly store: ConfigStore) {
    this.subscription = store.onDidChange(() => this.refresh());
  }

  refresh(): void { this.emitter.fire(undefined); }

  async getChildren(node?: TreeNode): Promise<TreeNode[]> {
    if (!node) { return this.store.scopes().map(scope => ({kind: 'scope', scope})); }
    if (node.kind === 'error' || node.kind === 'command') { return []; }
    try {
      const groups = await this.store.read(node.scope);
      if (node.kind === 'scope') { return groups.map(group => ({kind: 'group', scope: node.scope, group})); }
      const group = groups.find(group => group.id === node.group.id);
      return (group?.commands ?? []).map(entry => ({kind: 'command', scope: node.scope, groupId: node.group.id, entry}));
    } catch (error) {
      return [{kind: 'error', scope: node.scope, message: error instanceof Error ? error.message : String(error)}];
    }
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    if (node.kind === 'scope') {
      const label = node.scope.kind === 'global' ? 'Global Commands' : node.scope.name;
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `scope:${scopeKey(node.scope)}`;
      item.contextValue = 'commandDeck.scope';
      item.iconPath = new vscode.ThemeIcon(node.scope.kind === 'global' ? 'globe' : 'root-folder');
      item.tooltip = node.scope.kind === 'global' ? 'Stored in User Settings (JSON)' : `Project: ${node.scope.uri.fsPath}`;
      return item;
    }
    if (node.kind === 'group') {
      const item = new vscode.TreeItem(node.group.name, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `group:${scopeKey(node.scope)}:${node.group.id}`;
      item.contextValue = 'commandDeck.group';
      item.iconPath = new vscode.ThemeIcon('folder');
      item.description = `${node.group.commands.length}`;
      return item;
    }
    if (node.kind === 'error') {
      const item = new vscode.TreeItem('Invalid configuration', vscode.TreeItemCollapsibleState.None);
      item.description = 'Open JSON to repair';
      item.iconPath = new vscode.ThemeIcon('error');
      item.tooltip = node.message;
      item.command = {command: 'commandDeck.openConfig', title: 'Open Configuration', arguments: [node]};
      return item;
    }
    const item = new vscode.TreeItem(node.entry.name, vscode.TreeItemCollapsibleState.None);
    item.id = `command:${scopeKey(node.scope)}:${node.entry.id}`;
    item.contextValue = 'commandDeck.command';
    item.iconPath = new vscode.ThemeIcon(node.entry.enabled === false ? 'circle-slash' : 'terminal');
    item.description = node.entry.description || node.entry.command;
    item.tooltip = new vscode.MarkdownString(`**${node.entry.name.replaceAll('*', '\\*')}**\n\n\`\`\`sh\n${node.entry.command.replaceAll('```', '`` `')}\n\`\`\``);
    if (node.entry.enabled !== false) {
      item.command = {command: 'commandDeck.run', title: 'Run Command', arguments: [node]};
    }
    return item;
  }

  dispose(): void {
    this.subscription.dispose();
    this.emitter.dispose();
  }
}
