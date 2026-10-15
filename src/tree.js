'use strict';
const { t, errorText } = require('./i18n');
const { GROUP_SCHEME, GROUP_COLOR } = require('./group-decoration');
const { commandSteps, moveDrop } = require('./model');
const TREE_MIME = 'application/vnd.code.tree.quickCmd.commands';

/** Native VS Code Tree View: group → runnable command. */
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
  refresh() {
    this.changed.fire();
  }

  async handleDrag(source, data) {
    if (source.length !== 1 || !['command', 'group'].includes(source[0].kind)) {
      return;
    }
    const item = source[0];
    const payload = {
      kind: item.kind,
      scopeId: item.scope.id,
      groupId: item.groupId,
      commandId: item.commandId,
    };
    data.set(
      TREE_MIME,
      new this.vscode.DataTransferItem(JSON.stringify(payload)),
    );
  }

  async handleDrop(target, data) {
    const transfer = data.get(TREE_MIME);
    target = target || { kind: 'scope', scope: this.store.scopes()[0] };
    if (
      !transfer ||
      !target ||
      !['scope', 'group', 'command'].includes(target.kind)
    ) {
      return;
    }
    try {
      const source = JSON.parse(await transfer.asString());
      if (!source || !['command', 'group'].includes(source.kind)) {
        return;
      }
      if (!target.scope || source.scopeId !== target.scope.id) {
        throw new Error(
          'Drag and drop is supported only within the same configuration scope.',
        );
      }
      let before, after, moved;
      await this.store.update(target.scope, (cfg) => {
        before = structuredClone(cfg);
        moved = moveDrop(cfg, source, {
          kind: target.kind,
          groupId: target.groupId,
          commandId: target.commandId,
        });
        after = JSON.stringify(cfg);
      });
      if (!moved) {
        return;
      }
      this.refresh();
      if (this.tree) {
        const groups = await this.getChildren();
        const groupId =
          source.kind === 'group' ? source.groupId : target.groupId;
        const groupNode = groups.find((n) => n.groupId === groupId);
        const node =
          source.kind === 'group'
            ? groupNode
            : (await this.getChildren(groupNode)).find(
                (n) => n.commandId === source.commandId,
              );
        if (node) {
          await this.tree.reveal(node, { select: true, expand: true });
        }
      }
      const undo = t('Undo');
      const action = await this.vscode.window.showInformationMessage?.(
        t('Moved to {0}.', target.label || t('Groups')),
        undo,
      );
      if (action === undo) {
        await this.store.update(target.scope, (cfg) => {
          if (JSON.stringify(cfg) !== after) {
            throw new Error(
              'Configuration changed. Undo is no longer available.',
            );
          }
          cfg.groups = before.groups;
        });
        this.refresh();
      }
    } catch (error) {
      await this.vscode.window.showErrorMessage(
        'Quick Cmd: ' + errorText(error),
      );
    }
  }
  async getParent(item) {
    if (item.kind !== 'command') {
      return undefined;
    }
    return (await this.getChildren()).find(
      (node) => node.groupId === item.groupId,
    );
  }
  getTreeItem(item) {
    return item;
  }
  async getChildren(parent) {
    const vscode = this.vscode;
    if (parent?.kind === 'error' || parent?.kind === 'command') {
      return [];
    }
    if (!parent) {
      const scope = this.store.scopes()[0];
      try {
        const config = await this.store.read(this.store.scopes()[0]);
        return config.groups.map((group) => {
          const item = new vscode.TreeItem(
            group.title,
            vscode.TreeItemCollapsibleState.Expanded,
          );
          item.kind = 'group';
          item.id = `group:${scope.id}:${group.id}`;
          item.contextValue = 'quickCmd.group';
          item.scope = scope;
          item.groupId = group.id;
          item.resourceUri = vscode.Uri.from({
            scheme: GROUP_SCHEME,
            path: '/' + encodeURIComponent(group.id),
          });
          item.iconPath = new vscode.ThemeIcon(
            'folder',
            new vscode.ThemeColor(GROUP_COLOR),
          );
          item.description = `${group.commands.length}`;
          return item;
        });
      } catch (error) {
        const item = new vscode.TreeItem(
          t('Invalid configuration — see tooltip'),
        );
        item.kind = 'error';
        item.scope = scope;
        item.iconPath = new vscode.ThemeIcon('error');
        item.tooltip = errorText(error);
        return [item];
      }
    }
    if (parent.kind === 'group') {
      const config = await this.store.read(this.store.scopes()[0]);
      const group = config.groups.find((item) => item.id === parent.groupId);
      return (group?.commands || []).map((command) => {
        const item = new vscode.TreeItem(
          command.title,
          vscode.TreeItemCollapsibleState.None,
        );
        item.kind = 'command';
        item.id = `command:${parent.scope.id}:${command.id}`;
        item.contextValue = 'quickCmd.command';
        item.scope = parent.scope;
        item.groupId = parent.groupId;
        item.commandId = command.id;
        const status = this.runner?.status(parent.scope, command);
        const running = status?.monitored && status.busy;
        const failed =
          status?.monitored &&
          !status.busy &&
          status.exitCode !== undefined &&
          status.exitCode !== 0;
        item.iconPath = new vscode.ThemeIcon(
          running
            ? 'loading~spin'
            : failed
              ? 'error'
              : command.icon || 'terminal',
        );
        item.description = status
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
          : command.description ||
            commandSteps(command)
              .map((step) => step.command)
              .join(' ; ')
              .replace(/\s+/g, ' ')
              .trim();
        item.tooltip =
          (command.description ? command.description + '\n' : '') +
          commandSteps(command)
            .map(
              (step, i) =>
                i +
                1 +
                '. ' +
                step.command +
                (step.execute
                  ? ' ↵'
                  : ' (' + t('Sent without trailing Enter') + ')'),
            )
            .join('\n') +
          (command.cwd
            ? '\n' + t('Working directory') + ': ' + command.cwd
            : '');
        item.command = {
          command: 'quickCmd.selectCommand',
          title: t(this.editMode ? 'Edit command' : 'Send to terminal'),
          arguments: [item],
        };
        return item;
      });
    }
    return [];
  }
  dispose() {
    this.changed.dispose();
  }
}
module.exports = { CommandTreeProvider };
