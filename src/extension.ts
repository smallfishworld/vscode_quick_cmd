import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {CommandDefinition, CommandGroup, TerminalPolicy} from './model';
import {ConfigStore, Scope} from './store';
import {CommandTreeProvider, TreeNode} from './tree';
import {TerminalManager} from './terminal';

function nonEmpty(value: string): string | undefined { return value.trim() ? undefined : 'Value cannot be empty'; }

async function input(prompt: string, value = '', required = false): Promise<string | undefined> {
  return vscode.window.showInputBox({prompt, value, ignoreFocusOut: true, validateInput: required ? nonEmpty : undefined});
}

async function pickScope(store: ConfigStore, node?: TreeNode): Promise<Scope | undefined> {
  if (node) { return node.scope; }
  const options = store.scopes();
  if (options.length === 1) { return options[0]; }
  const items = options.map(scope => ({label: scope.kind === 'global' ? 'Global Commands' : scope.name, scope}));
  return (await vscode.window.showQuickPick(items, {placeHolder: 'Select command configuration location'}))?.scope;
}

async function pickGroup(store: ConfigStore, scope: Scope, node?: TreeNode): Promise<CommandGroup | undefined> {
  const groups = await store.read(scope);
  if (node?.kind === 'group') { return groups.find(g => g.id === node.group.id); }
  if (node?.kind === 'command') { return groups.find(g => g.id === node.groupId); }
  if (!groups.length) {
    void vscode.window.showInformationMessage('Add a group first.');
    return undefined;
  }
  return (await vscode.window.showQuickPick(groups.map(group => ({label: group.name, group})), {placeHolder: 'Select group'}))?.group;
}

async function commandFields(existing?: CommandDefinition): Promise<CommandDefinition | undefined> {
  const name = await input('Command display name', existing?.name, true);
  if (name === undefined) { return undefined; }
  const command = await input('Shell command (executed in VS Code terminal)', existing?.command, true);
  if (command === undefined) { return undefined; }
  const description = await input('Optional description', existing?.description ?? '');
  if (description === undefined) { return undefined; }
  const cwd = await input('Working directory (blank = project folder; supports variables)', existing?.cwd ?? '');
  if (cwd === undefined) { return undefined; }
  const terminalOptions = [
    {label: 'Reuse dedicated terminal', value: 'reuse' as TerminalPolicy},
    {label: 'Create a new terminal every time', value: 'new' as TerminalPolicy}
  ];
  const terminalChoice = await vscode.window.showQuickPick(
    [...terminalOptions].sort((a, b) => Number(b.value === (existing?.terminal ?? 'reuse')) - Number(a.value === (existing?.terminal ?? 'reuse'))),
    {placeHolder: 'Terminal policy'}
  );
  if (!terminalChoice) { return undefined; }
  const confirmationOptions = [
    {label: 'No confirmation', value: false},
    {label: 'Ask before running', value: true}
  ];
  const confirmChoice = await vscode.window.showQuickPick(
    [...confirmationOptions].sort((a, b) => Number(b.value === (existing?.confirm ?? false)) - Number(a.value === (existing?.confirm ?? false))),
    {placeHolder: 'Require confirmation?'}
  );
  if (!confirmChoice) { return undefined; }
  return {
    id: existing?.id ?? randomUUID(), name: name.trim(), command: command.trim(),
    description: description.trim() || undefined, cwd: cwd.trim() || undefined,
    terminal: terminalChoice.value, confirm: confirmChoice.value,
    enabled: existing?.enabled ?? true
  };
}

function requireNode(node: TreeNode | undefined, kind: 'group' | 'command'): boolean {
  return node?.kind === kind;
}

/** Activation registers only public commands and their accompanying native tree. */
export function activate(context: vscode.ExtensionContext): void {
  const store = new ConfigStore();
  const provider = new CommandTreeProvider(store);
  const terminals = new TerminalManager();
  context.subscriptions.push(store, provider, terminals);
  const view = vscode.window.createTreeView('commandDeck.commands', {treeDataProvider: provider, showCollapseAll: true});
  context.subscriptions.push(view);

  function register(name: string, run: (node?: TreeNode) => Promise<void> | void): void {
    context.subscriptions.push(vscode.commands.registerCommand(`commandDeck.${name}`, async (node?: TreeNode) => {
      try { await run(node); }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Command Deck: ${message}`);
      }
    }));
  }

  register('refresh', () => provider.refresh());
  register('addGroup', async node => {
    const scope = await pickScope(store, node);
    if (!scope) { return; }
    const name = await input('Group name', '', true);
    if (name === undefined) { return; }
    await store.mutate(scope, groups => groups.push({id: randomUUID(), name: name.trim(), commands: []}));
  });
  register('addCommand', async node => {
    const scope = await pickScope(store, node);
    if (!scope) { return; }
    const group = await pickGroup(store, scope, node);
    if (!group) { return; }
    const entry = await commandFields();
    if (!entry) { return; }
    await store.mutate(scope, groups => {
      const target = groups.find(g => g.id === group.id);
      if (!target) { throw new Error('Group no longer exists.'); }
      target.commands.push(entry);
    });
  });
  register('run', async node => {
    if (node?.kind !== 'command') { return; }
    const groups = await store.read(node.scope);
    const entry = groups.find(g => g.id === node.groupId)?.commands.find(e => e.id === node.entry.id);
    if (!entry) { throw new Error('Command no longer exists.'); }
    await terminals.execute(node.scope, entry);
  });
  register('editCommand', async node => {
    if (node?.kind !== 'command') { return; }
    const groups = await store.read(node.scope);
    const old = groups.find(g => g.id === node.groupId)?.commands.find(e => e.id === node.entry.id);
    if (!old) { throw new Error('Command no longer exists.'); }
    const updated = await commandFields(old);
    if (!updated) { return; }
    await store.mutate(node.scope, all => {
      const group = all.find(g => g.id === node.groupId);
      const index = group?.commands.findIndex(e => e.id === old.id) ?? -1;
      if (!group || index < 0) { throw new Error('Command no longer exists.'); }
      group.commands[index] = updated;
    });
  });
  register('toggleCommand', async node => {
    if (node?.kind !== 'command') { return; }
    await store.mutate(node.scope, groups => {
      const command = groups.find(g => g.id === node.groupId)?.commands.find(e => e.id === node.entry.id);
      if (!command) { throw new Error('Command no longer exists.'); }
      command.enabled = command.enabled === false;
    });
  });
  register('renameGroup', async node => {
    if (!requireNode(node, 'group') || node?.kind !== 'group') { return; }
    const name = await input('Group name', node.group.name, true);
    if (name === undefined) { return; }
    await store.mutate(node.scope, groups => {
      const group = groups.find(g => g.id === node.group.id);
      if (!group) { throw new Error('Group no longer exists.'); }
      group.name = name.trim();
    });
  });
  register('deleteItem', async node => {
    if (node?.kind !== 'group' && node?.kind !== 'command') { return; }
    const label = node.kind === 'group' ? node.group.name : node.entry.name;
    const answer = await vscode.window.showWarningMessage(`Delete "${label}"?`, {modal: true}, 'Delete');
    if (answer !== 'Delete') { return; }
    await store.mutate(node.scope, groups => {
      if (node.kind === 'group') {
        const index = groups.findIndex(g => g.id === node.group.id);
        if (index < 0) { throw new Error('Group no longer exists.'); }
        groups.splice(index, 1);
      } else {
        const group = groups.find(g => g.id === node.groupId);
        const index = group?.commands.findIndex(e => e.id === node.entry.id) ?? -1;
        if (!group || index < 0) { throw new Error('Command no longer exists.'); }
        group.commands.splice(index, 1);
      }
    });
  });
  async function move(node: TreeNode | undefined, delta: number): Promise<void> {
    if (node?.kind !== 'group' && node?.kind !== 'command') { return; }
    await store.mutate(node.scope, groups => {
      const collection = node.kind === 'group' ? groups : groups.find(g => g.id === node.groupId)?.commands;
      if (!collection) { throw new Error('Group no longer exists.'); }
      const id = node.kind === 'group' ? node.group.id : node.entry.id;
      const i = collection.findIndex(item => item.id === id);
      if (i < 0) { throw new Error('Item no longer exists.'); }
      const j = i + delta;
      if (j < 0 || j >= collection.length) { return; }
      [collection[i], collection[j]] = [collection[j], collection[i]];
    });
  }
  register('moveUp', node => move(node, -1));
  register('moveDown', node => move(node, 1));
  register('openConfig', async node => {
    const scope = await pickScope(store, node);
    if (!scope) { return; }
    if (scope.kind === 'global') {
      await vscode.commands.executeCommand('workbench.action.openSettingsJson');
      void vscode.window.showInformationMessage('Edit the "commandDeck.globalGroups" key in User Settings JSON.');
      return;
    }
    const uri = await store.ensureFile(scope);
    if (uri) { await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri)); }
  });
}

export function deactivate(): void {}
