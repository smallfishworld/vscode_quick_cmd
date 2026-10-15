import * as vscode from 'vscode';
import {CommandFile, CommandGroup, parseCommandFile, parseGroups} from './model';

export type Scope = {kind: 'global'} | {kind: 'folder'; uri: vscode.Uri; name: string};
const FILE = '.vscode/command-deck.json';

export function scopeKey(scope: Scope): string {
  return scope.kind === 'global' ? 'global' : scope.uri.toString();
}

/** Storage abstraction: application-level settings and a versioned project JSON file. */
export class ConfigStore implements vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changeEmitter.event;
  private readonly subscriptions: vscode.Disposable[];
  private queue: Promise<void> = Promise.resolve();

  constructor() {
    const watcher = vscode.workspace.createFileSystemWatcher('**/.vscode/command-deck.json');
    this.subscriptions = [
      watcher,
      watcher.onDidChange(() => this.changeEmitter.fire()),
      watcher.onDidCreate(() => this.changeEmitter.fire()),
      watcher.onDidDelete(() => this.changeEmitter.fire()),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.changeEmitter.fire()),
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('commandDeck.globalGroups')) { this.changeEmitter.fire(); }
      })
    ];
  }

  scopes(): Scope[] {
    return [{kind: 'global'}, ...(vscode.workspace.workspaceFolders ?? []).map(f => ({kind: 'folder' as const, uri: f.uri, name: f.name}))];
  }

  fileUri(scope: Scope): vscode.Uri | undefined {
    return scope.kind === 'folder' ? vscode.Uri.joinPath(scope.uri, FILE) : undefined;
  }

  async read(scope: Scope): Promise<CommandGroup[]> {
    if (scope.kind === 'global') {
      const value: unknown = vscode.workspace.getConfiguration('commandDeck').get('globalGroups', []);
      return parseGroups(value);
    }
    const uri = this.fileUri(scope)!;
    let bytes: Uint8Array;
    try { bytes = await vscode.workspace.fs.readFile(uri); }
    catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'FileNotFound') {
        return [];
      }
      throw error;
    }
    let raw: unknown;
    try { raw = JSON.parse(new TextDecoder().decode(bytes)); }
    catch (error) { throw new Error(`${uri.fsPath}: invalid JSON (${String(error)})`); }
    return parseCommandFile(raw).groups;
  }

  async mutate(scope: Scope, modify: (groups: CommandGroup[]) => void): Promise<void> {
    const operation = this.queue.then(async () => {
      const groups = await this.read(scope);
      modify(groups);
      const validated = parseGroups(groups);
      await this.write(scope, validated);
      this.changeEmitter.fire();
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async ensureFile(scope: Scope): Promise<vscode.Uri | undefined> {
    const uri = this.fileUri(scope);
    if (!uri) { return undefined; }
    try { await vscode.workspace.fs.stat(uri); }
    catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'FileNotFound')) {
        throw error;
      }
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(scope.uri, '.vscode'));
      const initial: CommandFile = {version: 1, groups: []};
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(initial, null, 2) + '\n'));
    }
    return uri;
  }

  private async write(scope: Scope, groups: CommandGroup[]): Promise<void> {
    if (scope.kind === 'global') {
      await vscode.workspace.getConfiguration('commandDeck').update('globalGroups', groups, vscode.ConfigurationTarget.Global);
      return;
    }
    const uri = this.fileUri(scope)!;
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(scope.uri, '.vscode'));
    const value: CommandFile = {version: 1, groups};
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n'));
  }

  dispose(): void {
    this.subscriptions.forEach(s => s.dispose());
    this.changeEmitter.dispose();
  }
}
