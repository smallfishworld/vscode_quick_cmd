'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { t, errorText, resolveLocale } = require('./i18n');
const {
  commandSteps,
  requireGroup,
  requireCommand,
  moveDrop,
} = require('./model');

/** Compact, movable list view. Client messages identify records, never executable text. */
class CommandListProvider {
  constructor(vscode, context, store, runner, onSelection = () => {}) {
    Object.assign(this, { vscode, context, store, runner, onSelection });
    this.disposables = [];
    this.generation = 0;
  }
  resolveWebviewView(view) {
    this.view = view;
    this.token = randomUUID();
    const webview = view.webview;
    const media = this.vscode.Uri.joinPath(this.context.extensionUri, 'media');
    const packaged = fs.existsSync(
      path.join(this.context.extensionPath, 'media', 'codicons', 'codicon.css'),
    );
    const icons = this.vscode.Uri.joinPath(
      this.context.extensionUri,
      ...(packaged
        ? ['media', 'codicons']
        : ['node_modules', '@vscode', 'codicons', 'dist']),
    );
    webview.options = {
      enableScripts: true,
      localResourceRoots: [media, icons],
    };
    this.disposables.push(
      webview.onDidReceiveMessage((message) =>
        this.handleMessage(message).catch((error) => {
          if (this.view === view) {
            void webview.postMessage({
              type: 'error',
              message: errorText(error),
            });
          }
        }),
      ),
    );
    let html = fs.readFileSync(
      path.join(this.context.extensionPath, 'media', 'list.html'),
      'utf8',
    );
    const values = {
      language: resolveLocale(this.vscode.env?.language),
      cspSource: webview.cspSource,
      cssUri: webview.asWebviewUri(this.vscode.Uri.joinPath(media, 'list.css')),
      iconsUri: webview.asWebviewUri(
        this.vscode.Uri.joinPath(icons, 'codicon.css'),
      ),
      jsUri: webview.asWebviewUri(
        this.vscode.Uri.joinPath(media, 'list-client.js'),
      ),
      i18nUri: webview.asWebviewUri(this.vscode.Uri.joinPath(media, 'i18n.js')),
    };
    for (const [key, value] of Object.entries(values)) {
      html = html.replaceAll('{{' + key + '}}', String(value));
    }
    webview.html = html;
    if (view.onDidDispose) {
      this.disposables.push(
        view.onDidDispose(() => {
          if (this.view === view) {
            this.view = undefined;
            this.generation++;
          }
        }),
      );
    }
  }
  scope() {
    return this.store.scopes()[0];
  }
  async node(message) {
    const scope = this.scope();
    const cfg = await this.store.read(scope);
    if (
      !message ||
      !['command', 'group'].includes(message.kind) ||
      typeof message.groupId !== 'string'
    ) {
      throw new Error('Invalid list request.');
    }
    const group = requireGroup(cfg, message.groupId);
    if (message.kind === 'command') {
      requireCommand(cfg, group.id, message.commandId);
    }
    return {
      kind: message.kind,
      scope,
      groupId: group.id,
      ...(message.kind === 'command' ? { commandId: message.commandId } : {}),
    };
  }
  async model() {
    const scope = this.scope();
    const cfg = await this.store.read(scope);
    const requested = Number(
      this.vscode.workspace
        .getConfiguration?.('quickCmd')
        ?.get('listFontSize', 0) ?? 0,
    );
    const fontSize =
      Number.isFinite(requested) && requested > 0
        ? Math.max(10, Math.min(18, requested))
        : 0;
    return {
      groups: cfg.groups.map((group) => ({
        id: group.id,
        title: group.title,
        commands: group.commands.map((cmd) => {
          const steps = commandSteps(cmd);
          const status = this.runner?.status(scope, cmd);
          const running = !!(status?.monitored && status.busy);
          const failed = !!(
            status?.monitored &&
            !status.busy &&
            status.exitCode !== undefined &&
            status.exitCode !== 0
          );
          const statusText = status
            ? running
              ? t('Running')
              : status.monitored
                ? status.exitCode === 0
                  ? t('Succeeded')
                  : status.exitCode === undefined
                    ? t('Ended · status unknown')
                    : t('Failed · exit code {0}', status.exitCode)
                : status.staged
                  ? t('Sent without trailing Enter')
                  : t('Sent · status unknown')
            : '';
          return {
            id: cmd.id,
            title: cmd.title,
            icon: running
              ? 'loading'
              : failed
                ? 'error'
                : cmd.icon || 'terminal',
            running,
            preview: steps
              .map((step) => step.command)
              .join(' ; ')
              .replace(/\s+/g, ' ')
              .trim(),
            status: statusText,
            tooltip: [
              cmd.description,
              statusText,
              ...steps.map(
                (step, index) =>
                  `${index + 1}. ${step.command}${step.execute ? ' ↵' : ' (' + t('Sent without trailing Enter') + ')'}`,
              ),
              cmd.cwd ? t('Working directory') + ': ' + cmd.cwd : '',
            ]
              .filter(Boolean)
              .join('\n'),
          };
        }),
      })),
      fontSize,
    };
  }
  async refresh() {
    const generation = ++this.generation;
    if (!this.view) {
      return;
    }
    try {
      const model = await this.model();
      if (generation === this.generation && this.view) {
        await this.view.webview.postMessage({
          type: 'model',
          token: this.token,
          ...model,
        });
      }
    } catch (error) {
      if (generation === this.generation) {
        await this.view?.webview.postMessage({
          type: 'error',
          message: errorText(error),
        });
      }
    }
  }
  collapseAll() {
    return this.view?.webview.postMessage({ type: 'collapseAll' });
  }
  async handleMessage(message) {
    if (message?.type === 'ready') {
      await this.refresh();
      return;
    }
    if (!this.view || message?.token !== this.token) {
      throw new Error('Invalid list request.');
    }
    if (message.type === 'newGroup') {
      await this.vscode.commands.executeCommand('quickCmd.addGroup');
      return;
    }
    if (message.type === 'refresh') {
      await this.refresh();
      return;
    }
    if (message.type === 'drop') {
      await this.drop(message.source, message.target);
      return;
    }
    const node = await this.node(message);
    this.onSelection(node);
    if (message.type === 'select') {
      return;
    }
    const actions = {
      run: 'quickCmd.run',
      edit: 'quickCmd.editCommand',
      delete: 'quickCmd.deleteCommand',
      add: 'quickCmd.addCommand',
    };
    if (actions[message.type]) {
      if (message.type !== 'add' && node.kind !== 'command') {
        throw new Error('Invalid list request.');
      }
      await this.vscode.commands.executeCommand(actions[message.type], node);
    } else if (message.type === 'context') {
      await this.contextMenu(node);
    } else {
      throw new Error('Invalid list request.');
    }
  }
  async contextMenu(node) {
    const definitions =
      node.kind === 'group'
        ? [
            ['New command', 'addCommand'],
            ['Rename group', 'renameGroup'],
            ['Move up', 'moveGroupUp'],
            ['Move down', 'moveGroupDown'],
            ['Delete', 'deleteGroup'],
          ]
        : [
            ['Send to terminal', 'run'],
            ['Edit command', 'editCommand'],
            ['Duplicate command', 'duplicateCommand'],
            ['Move up', 'moveCommandUp'],
            ['Move down', 'moveCommandDown'],
            ['Copy keybinding', 'copyShortcut'],
            ['Stop command', 'stop'],
            ['Delete command', 'deleteCommand'],
          ];
    const picked = await this.vscode.window.showQuickPick(
      definitions.map(([label, command]) => ({ label: t(label), command })),
      {
        placeHolder: t(
          node.kind === 'group' ? 'Group actions' : 'Command actions',
        ),
      },
    );
    if (
      picked &&
      definitions.some(([, command]) => command === picked.command)
    ) {
      await this.vscode.commands.executeCommand(
        'quickCmd.' + picked.command,
        node,
      );
    }
  }
  async drop(source, target) {
    const from = await this.node(source);
    const to =
      target?.kind === 'root'
        ? { kind: 'scope', scope: this.scope() }
        : await this.node(target);
    let before, after, moved;
    await this.store.update(this.scope(), (cfg) => {
      before = structuredClone(cfg);
      moved = moveDrop(cfg, from, to);
      after = JSON.stringify(cfg);
    });
    if (!moved) {
      return;
    }
    await this.refresh();
    const selection = {
      ...from,
      groupId: from.kind === 'command' ? to.groupId : from.groupId,
    };
    this.onSelection(selection);
    await this.view?.webview.postMessage({ type: 'reveal', ...selection });
    const action = await this.vscode.window.showInformationMessage?.(
      t('Moved to {0}.', t('Groups')),
      t('Undo'),
    );
    if (action === t('Undo')) {
      await this.store.update(this.scope(), (cfg) => {
        if (JSON.stringify(cfg) !== after) {
          throw new Error(
            'Configuration changed. Undo is no longer available.',
          );
        }
        cfg.groups = before.groups;
      });
      this.onSelection(from);
      await this.refresh();
      await this.view?.webview.postMessage({ type: 'reveal', ...from });
    }
  }
  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.view = undefined;
    this.generation++;
  }
}
module.exports = { CommandListProvider };
