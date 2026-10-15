'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const { addCommand, requireCommand, requireGroup, commandSteps } = require('./model');

/** Inline editor below the command tree, within the same Activity Bar container. */
class CommandEditorProvider {
  constructor(vscode, context, store, onSaved) {
    this.vscode = vscode;
    this.context = context;
    this.store = store;
    this.onSaved = onSaved;
  }
  resolveWebviewView(view) {
    this.view = view;
    const webview = view.webview;
    const media = this.vscode.Uri.joinPath(this.context.extensionUri, 'media');
    webview.options = { enableScripts: true, localResourceRoots: [media] };
    const nonce = randomBytes(16).toString('base64');
    const css = webview.asWebviewUri(this.vscode.Uri.joinPath(media, 'editor.css'));
    const js = webview.asWebviewUri(this.vscode.Uri.joinPath(media, 'editor-client.js'));
    webview.html = fs.readFileSync(path.join(this.context.extensionPath, 'media', 'editor.html'), 'utf8')
      .replaceAll('{{cspSource}}', webview.cspSource)
      .replaceAll('{{cssUri}}', String(css))
      .replaceAll('{{jsUri}}', String(js))
      .replaceAll('{{nonce}}', nonce);
    this.disposable = webview.onDidReceiveMessage(async message => {
      try {
        if (message?.type === 'ready') { await this.load(); }
        if (message?.type === 'save') { await this.save(message.fields, message.groupId); }
      } catch (error) {
        webview.postMessage({ type: 'error', message: error.message || String(error) });
      }
    });
    void this.load();
  }
  async open(scope, groupId, commandId) {
    this.selection = { scopeId: scope.id, groupId, commandId };
    await this.vscode.commands.executeCommand('quickCmd.editor.focus');
    this.view?.show?.(false);
    await this.load();
  }
  async load() {
    if (!this.view) { return; }
    const selection = this.selection;
    if (!selection) { this.view.webview.postMessage({ type: 'empty' }); return; }
    const scope = this.store.scopes().find(s => s.id === selection.scopeId);
    if (!scope) { throw new Error('The selected workspace is no longer open.'); }
    const cfg = await this.store.read(scope);
    const group = requireGroup(cfg, selection.groupId);
    const original = selection.commandId ? requireCommand(cfg, selection.groupId, selection.commandId) : undefined;
    const cmd = original ? {
      ...original,
      steps: commandSteps(original)
    } : undefined;
    this.view.webview.postMessage({
      type: 'load', scopeLabel: scope.label, groupId: group.id, groupTitle: group.title,
      isEdit: !!original, command: cmd
    });
  }
  async save(fields, targetGroupId) {
    if (!this.selection) { throw new Error('Choose a command first.'); }
    const { scopeId, groupId, commandId } = this.selection;
    const scope = this.store.scopes().find(s => s.id === scopeId);
    if (!scope) { throw new Error('The workspace is no longer open.'); }
    if (targetGroupId !== groupId) { throw new Error('Command group changed. Reopen the editor.'); }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) { throw new Error('Invalid command fields.'); }
    // Keep only schema-supported properties; never trust IDs from a Webview message.
    const allowed = ['title', 'steps', 'cwd', 'terminal', 'confirm', 'description', 'icon', 'env'];
    const clean = Object.fromEntries(allowed.filter(key => fields[key] !== undefined).map(key => [key, fields[key]]));
    let result;
    await this.store.update(scope, cfg => {
      requireGroup(cfg, groupId);
      if (commandId) {
        const command = requireCommand(cfg, groupId, commandId);
        for (const field of ['command', 'execute', 'steps', 'cwd', 'terminal', 'confirm', 'description', 'icon', 'env']) {
          delete command[field];
        }
        Object.assign(command, clean);
        result = command;
      } else {
        result = addCommand(cfg, groupId, clean);
      }
    });
    this.selection.commandId = result.id;
    this.onSaved();
    this.view?.webview.postMessage({ type: 'saved' });
    await this.load();
  }
  dispose() { this.disposable?.dispose(); }
}
module.exports = { CommandEditorProvider };
