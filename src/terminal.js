'use strict';
const path = require('node:path');
const { expand } = require('./variables');
const { commandSteps } = require('./model');

function resolveCwd(configured, folderPath, ctx) {
  if (!configured || !configured.trim()) {
    return folderPath || undefined;
  }
  const dir = ctx
    ? expand(configured, ctx, false)
    : configured.replaceAll('${workspaceFolder}', () => {
        if (!folderPath) {
          throw new Error(
            'This command needs an open workspace for ${workspaceFolder}.',
          );
        }
        return folderPath;
      });
  if (path.isAbsolute(dir)) {
    return path.normalize(dir);
  }
  if (!folderPath) {
    throw new Error('Relative working directories require an open workspace.');
  }
  return path.resolve(folderPath, dir);
}

class TerminalRunner {
  constructor(vscode) {
    this.vscode = vscode;
    this.terminals = new Map();
    this.states = new Map();
    this.signatures = new Map();
    this.disposables = [];
    // A webview panel can become active without a text editor. Retain the last
    // document context for file variables and global commands in multi-root workspaces.
    this.lastTextUri = vscode.window.activeTextEditor?.document.uri;
    if (vscode.window.onDidChangeActiveTextEditor) {
      this.disposables.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
          if (editor?.document.uri.scheme === 'file') {
            this.lastTextUri = editor.document.uri;
          }
        }),
      );
    }
    this.changed = vscode.EventEmitter ? new vscode.EventEmitter() : undefined;
    this.onDidChangeStatus = this.changed?.event;
    if (vscode.window.onDidCloseTerminal) {
      this.disposables.push(
        vscode.window.onDidCloseTerminal((t) => {
          this.states.delete(t);
          this.changed?.fire();
          for (const [key, term] of this.terminals) {
            if (term === t) {
              this.terminals.delete(key);
              this.signatures.delete(key);
            }
          }
        }),
      );
    }
    if (vscode.window.onDidStartTerminalShellExecution) {
      this.disposables.push(
        vscode.window.onDidStartTerminalShellExecution((e) => {
          this.states.set(e.terminal, { busy: true, monitored: true });
          this.changed?.fire();
        }),
      );
    }
    if (vscode.window.onDidEndTerminalShellExecution) {
      this.disposables.push(
        vscode.window.onDidEndTerminalShellExecution((e) => {
          this.states.set(e.terminal, {
            busy: false,
            monitored: true,
            exitCode: e.exitCode,
          });
          this.changed?.fire();
        }),
      );
    }
  }

  getFolder(scope) {
    const vscode = this.vscode;
    const uri =
      vscode.window.activeTextEditor?.document.uri || this.lastTextUri;
    return scope.type === 'workspace'
      ? scope.folder
      : (uri && vscode.workspace.getWorkspaceFolder?.(uri)) ||
          (vscode.workspace.workspaceFolders || [])[0];
  }

  ensureTrusted() {
    const vscode = this.vscode;
    if (
      (vscode.workspace.workspaceFolders || []).length &&
      !vscode.workspace.isTrusted
    ) {
      throw new Error(
        'Trust this workspace before running saved shell commands.',
      );
    }
  }

  /** A terminal is reusable only after Shell Integration has observed an execution finish. */
  run(scope, command, options = {}) {
    this.ensureTrusted();
    const vscode = this.vscode;
    const folder = this.getFolder(scope);
    if (folder && folder.uri.scheme !== 'file') {
      throw new Error('Commands require a file-system workspace.');
    }
    const ctx = options.context || { workspaceFolder: folder?.uri.fsPath };
    const cwd = resolveCwd(command.cwd, folder?.uri.fsPath, ctx);
    const steps =
      options.steps ||
      (options.text === undefined
        ? commandSteps(command).map((step) => ({
            text: step.command,
            execute: step.execute,
          }))
        : [{ text: options.text, execute: command.execute !== false }]);
    if (
      !Array.isArray(steps) ||
      !steps.length ||
      steps.some(
        (step) =>
          typeof step.text !== 'string' || typeof step.execute !== 'boolean',
      )
    ) {
      throw new Error('Invalid terminal steps.');
    }
    const mode = command.terminal || 'new';
    const key = `${scope.id || scope.type}:${command.id || command.title}`;
    const signature = JSON.stringify({ cwd, env: command.env || {} });
    if (
      mode === 'active' &&
      (command.cwd || Object.keys(command.env || {}).length)
    ) {
      throw new Error(
        'The active terminal cannot apply command-specific cwd or env. Use new or reuse mode.',
      );
    }
    let terminal;
    let actualMode = mode;
    if (mode === 'reuse') {
      const existing = this.terminals.get(key);
      const state = this.states.get(existing);
      if (
        existing &&
        state?.monitored &&
        !state.busy &&
        this.signatures.get(key) === signature
      ) {
        terminal = existing;
      } else {
        actualMode = 'new';
      }
    } else if (mode === 'active') {
      terminal = vscode.window.activeTerminal;
      if (!terminal) {
        actualMode = 'new';
      }
    }
    if (!terminal) {
      terminal = vscode.window.createTerminal({
        name: `Quick Cmd: ${command.title}`,
        cwd,
        ...(command.env
          ? {
              env: Object.fromEntries(
                Object.entries(command.env).map(([k, v]) => [
                  k,
                  expand(v, ctx, false),
                ]),
              ),
            }
          : {}),
      });
      if (mode === 'reuse') {
        this.terminals.set(key, terminal);
      }
    }
    // Only a monitored, idle terminal is reused. Fresh terminals are always safe to send to.
    if (mode !== 'active' || actualMode === 'new') {
      this.terminals.set(key, terminal);
      this.signatures.set(key, signature);
    }
    this.states.set(terminal, {
      busy: steps.some((step) => step.execute),
      monitored: this.states.get(terminal)?.monitored || false,
      staged: steps[steps.length - 1].execute === false,
    });
    this.changed?.fire();
    terminal.show();
    // Send the combined script once, preserving line breaks between steps.
    // The final checkbox controls whether a trailing Return is sent.
    // In particular, 'false' never appends an Enter to the final line.
    terminal.sendText(
      steps.map((step) => step.text).join('\n'),
      steps[steps.length - 1].execute,
    );
    return { terminal, actualMode };
  }

  status(scope, command) {
    const terminal = this.terminals.get(
      `${scope.id || scope.type}:${command.id || command.title}`,
    );
    return terminal ? this.states.get(terminal) : undefined;
  }

  stop(scope, command) {
    const key = `${scope.id || scope.type}:${command.id || command.title}`;
    const terminal = this.terminals.get(key);
    if (!terminal) {
      throw new Error('No dedicated terminal is available for this command.');
    }
    terminal.dispose();
    this.terminals.delete(key);
    this.signatures.delete(key);
    this.states.delete(terminal);
    this.changed?.fire();
  }

  isActiveTerminalUnsafe() {
    const active = this.vscode.window.activeTerminal;
    if (!active) {
      return false;
    }
    const state = this.states.get(active);
    return !state?.monitored || state.busy;
  }

  dispose() {
    for (const item of this.disposables) {
      item.dispose();
    }
    this.terminals.clear();
    this.states.clear();
    this.signatures.clear();
    this.changed?.dispose();
  }
}
module.exports = { resolveCwd, TerminalRunner };
