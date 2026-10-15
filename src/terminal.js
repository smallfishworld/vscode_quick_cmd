'use strict';

const path = require('node:path');

/** Resolve a cwd on the VS Code extension-host OS (including Remote SSH). */
function resolveCwd(configured, folderPath) {
  if (!configured || !configured.trim()) { return folderPath || undefined; }
  let cwd = configured.trim();
  if (cwd.includes('${workspaceFolder}')) {
    if (!folderPath) { throw new Error('This command needs an open workspace for ${workspaceFolder}.'); }
    cwd = cwd.replaceAll('${workspaceFolder}', folderPath);
  }
  if (path.isAbsolute(cwd)) { return path.normalize(cwd); }
  if (!folderPath) { throw new Error('Relative working directories require an open workspace.'); }
  return path.resolve(folderPath, cwd);
}

/** A new terminal per run avoids injecting commands into busy shells. */
class TerminalRunner {
  constructor(vscode) { this.vscode = vscode; }

  run(scope, command) {
    const vscode = this.vscode;
    if ((vscode.workspace.workspaceFolders || []).length && !vscode.workspace.isTrusted) {
      throw new Error('Trust this workspace before running saved shell commands.');
    }
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    const folder = scope.type === 'workspace' ? scope.folder
      : (activeUri && vscode.workspace.getWorkspaceFolder(activeUri))
        || (vscode.workspace.workspaceFolders || [])[0];
    if (folder && folder.uri.scheme !== 'file') {
      throw new Error('Terminal commands require a local or remote file-system workspace.');
    }
    const cwd = resolveCwd(command.cwd, folder?.uri.fsPath);
    const terminal = vscode.window.createTerminal({ name: 'Quick Cmd: ' + command.title, cwd });
    terminal.show();
    terminal.sendText(command.command, true);
  }
}

module.exports = { TerminalRunner, resolveCwd };
