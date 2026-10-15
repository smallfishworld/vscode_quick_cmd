import * as vscode from 'vscode';
import * as path from 'node:path';
import {CommandDefinition, ConfigError} from './model';
import {Scope, scopeKey} from './store';
import {resolveVariables} from './variables';

/** VS Code Terminal API cannot generally determine command completion from sendText. */
export class TerminalManager implements vscode.Disposable {
  private readonly terminals = new Map<string, vscode.Terminal>();
  private readonly closeSubscription: vscode.Disposable;

  constructor() {
    this.closeSubscription = vscode.window.onDidCloseTerminal(closed => {
      for (const [key, terminal] of this.terminals) {
        if (terminal === closed) { this.terminals.delete(key); }
      }
    });
  }

  async execute(scope: Scope, entry: CommandDefinition): Promise<void> {
    if (!vscode.workspace.isTrusted) {
      throw new ConfigError('Workspace is not trusted. Trust the workspace before running commands.');
    }
    if (entry.enabled === false) { throw new ConfigError('This command is disabled.'); }
    if (entry.confirm) {
      const answer = await vscode.window.showWarningMessage(`Run "${entry.name}"?`, {modal: true}, 'Run');
      if (answer !== 'Run') { return; }
    }
    const editorFile = vscode.window.activeTextEditor?.document.uri;
    const activeFolder = editorFile ? vscode.workspace.getWorkspaceFolder(editorFile) : undefined;
    const preferred = scope.kind === 'folder'
      ? scope.uri.fsPath
      : (activeFolder ?? vscode.workspace.workspaceFolders?.[0])?.uri.fsPath;
    const context = {
      workspaceFolder: preferred,
      file: editorFile?.scheme === 'file' || editorFile?.scheme === 'vscode-remote' ? editorFile.fsPath : undefined
    };
    const command = resolveVariables(entry.command, context);
    const baseCwd = preferred;
    const resolvedCwd = entry.cwd ? resolveVariables(entry.cwd, context) : baseCwd;
    const cwd = resolvedCwd && !path.isAbsolute(resolvedCwd) && baseCwd
      ? path.resolve(baseCwd, resolvedCwd)
      : resolvedCwd;
    const key = `${scopeKey(scope)}:${entry.id}`;
    let terminal = entry.terminal === 'new' ? undefined : this.terminals.get(key);
    if (!terminal) {
      terminal = vscode.window.createTerminal({name: `Command Deck: ${entry.name}`, cwd});
      if (entry.terminal !== 'new') { this.terminals.set(key, terminal); }
    }
    terminal.show(false);
    terminal.sendText(command, true);
  }

  dispose(): void {
    this.closeSubscription.dispose();
    this.terminals.clear();
  }
}
