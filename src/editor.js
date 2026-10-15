'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { randomBytes, randomUUID } = require('node:crypto');
const {
  addCommand,
  requireGroup,
  commandSteps,
  findCommand,
} = require('./model');
const { t, errorText, resolveLocale } = require('./i18n');
const DRAFT_KEY = 'quickCmd.editorDraft.v1';

/** One editing session shared by the sidebar and wide editor. Drafts never execute. */
class CommandEditorProvider {
  constructor(vscode, context, store, onSaved, onRun, onModeChange) {
    Object.assign(this, {
      vscode,
      context,
      store,
      onSaved,
      onRun,
      onModeChange,
    });
    this.surfaces = new Set();
    this.disposables = [];
    this.openQueue = Promise.resolve();
    this.persistQueue = Promise.resolve();
    const draft = context.workspaceState?.get(DRAFT_KEY);
    if (draft?.selection && draft?.raw && draft?.token) {
      this.selection = draft.selection;
      this.session = draft;
    }
  }
  html(webview) {
    const media = this.vscode.Uri.joinPath(this.context.extensionUri, 'media');
    webview.options = { enableScripts: true, localResourceRoots: [media] };
    let html = fs.readFileSync(
      path.join(this.context.extensionPath, 'media', 'editor.html'),
      'utf8',
    );
    const values = {
      cspSource: webview.cspSource,
      nonce: randomBytes(16).toString('base64'),
      language: /^zh\b/i.test(resolveLocale(this.vscode.env?.language))
        ? 'zh-CN'
        : 'en',
    };
    for (const [key, file] of [
      ['cssUri', 'editor.css'],
      ['jsUri', 'editor-client.js'],
      ['i18nUri', 'i18n.js'],
    ]) {
      values[key] = String(
        webview.asWebviewUri(this.vscode.Uri.joinPath(media, file)),
      );
    }
    for (const [key, value] of Object.entries(values)) {
      html = html.replaceAll('{{' + key + '}}', value);
    }
    return html;
  }
  attach(surface) {
    const webview = surface.webview;
    this.surfaces.add(surface);
    const html = this.html(webview);
    this.disposables.push(
      webview.onDidReceiveMessage(async (message) => {
        try {
          if (message?.type === 'ready') {
            await this.load(surface);
            return;
          }
          if (message?.type === 'new') {
            await this.vscode.commands.executeCommand('quickCmd.addCommand');
            return;
          }
          if (message?.type === 'expand') {
            await this.openPanel();
            return;
          }
          if (message?.token !== this.session?.token) {
            throw new Error('Stale editor request. Please retry.');
          }
          if (message.type === 'reopen') {
            const scope = this.store
              .scopes()
              .find((s) => s.id === this.selection.scopeId);
            if (!scope) {
              throw new Error('The workspace is no longer open.');
            }
            await this.open(
              scope,
              this.selection.groupId,
              this.selection.commandId,
              true,
              true,
            );
            return;
          }
          if (this.panel && surface !== this.panel) {
            throw new Error('Editing in the wide editor.');
          }
          if (message.type === 'draft') {
            if (
              this.validRaw(message.fields) &&
              message.baseRevision === this.session.revision
            ) {
              this.session.raw = message.fields;
              this.session.revision++;
              this.persist();
              this.broadcast(
                {
                  type: 'draft',
                  token: this.session.token,
                  raw: this.session.raw,
                  baseline: this.session.baseline,
                  revision: this.session.revision,
                },
                surface,
              );
              webview.postMessage({
                type: 'revision',
                token: this.session.token,
                revision: this.session.revision,
              });
            } else {
              await this.load(surface);
            }
          }
          if (message.type === 'save') {
            await this.save(message.fields, message.groupId, message);
          }
        } catch (error) {
          webview.postMessage({
            type: 'error',
            token: message?.token,
            message: errorText(error),
          });
        }
      }),
    );
    webview.html = html;
    if (surface.onDidDispose) {
      this.disposables.push(
        surface.onDidDispose(() => {
          this.surfaces.delete(surface);
          if (this.panel === surface) {
            this.panel = undefined;
            this.broadcast({ type: 'readOnly', value: false });
          }
        }),
      );
    }
  }
  validRaw(raw) {
    return (
      raw &&
      typeof raw === 'object' &&
      typeof raw.title === 'string' &&
      Array.isArray(raw.steps) &&
      raw.steps.length <= 32 &&
      JSON.stringify(raw).length <= 150000
    );
  }
  resolveWebviewView(view) {
    this.view = view;
    this.attach(view);
  }
  broadcast(message, except) {
    for (const surface of this.surfaces) {
      if (surface !== except) {
        void surface.webview.postMessage(message);
      }
    }
    // Also support non-UI consumers and extension tests.
    if (!this.surfaces.size && this.view) {
      void this.view.webview.postMessage(message);
    }
  }
  rawCommand(command = {}) {
    return {
      title: command.title || '',
      steps: command.steps || [
        { command: command.command || '', execute: command.execute !== false },
      ],
      cwd: command.cwd || '',
      terminal: command.terminal || 'new',
      confirm: !!command.confirm,
      description: command.description || '',
      icon: command.icon || '',
      envText: JSON.stringify(command.env || {}, null, 2),
    };
  }
  fields(raw) {
    const result = {
      title: raw.title.trim(),
      steps: raw.steps,
      terminal: raw.terminal || 'new',
      confirm: !!raw.confirm,
    };
    for (const key of ['cwd', 'description', 'icon']) {
      if (raw[key]?.trim()) {
        result[key] = raw[key].trim();
      }
    }
    let env;
    try {
      env =
        raw.envText !== undefined ? JSON.parse(raw.envText || '{}') : raw.env;
    } catch {
      throw new Error('Invalid environment variable JSON.');
    }
    if (env !== undefined) {
      if (!env || typeof env !== 'object' || Array.isArray(env)) {
        throw new Error(
          'Environment variables must be a JSON object of string values.',
        );
      }
      if (Object.keys(env).length) {
        result.env = env;
      }
    }
    if (result.terminal === 'active' && (result.cwd || result.env)) {
      throw new Error(
        'The active terminal cannot apply command-specific cwd or env. Use new or reuse mode.',
      );
    }
    return result;
  }
  dirty() {
    return (
      this.session &&
      JSON.stringify(this.session.raw) !== JSON.stringify(this.session.baseline)
    );
  }
  persist() {
    const snapshot = this.session
      ? structuredClone({ ...this.session, selection: this.selection })
      : undefined;
    this.persistQueue = this.persistQueue
      .catch(() => {})
      .then(() => this.context.workspaceState?.update(DRAFT_KEY, snapshot));
  }
  open(scope, groupId, commandId, focus = true, force = false) {
    const job = this.openQueue
      .catch(() => {})
      .then(() => this.openSelection(scope, groupId, commandId, focus, force));
    this.openQueue = job;
    return job;
  }
  async openSelection(scope, groupId, commandId, focus, force = false) {
    if (this.saving) {
      await this.saving;
    }
    const same =
      this.selection?.scopeId === scope.id &&
      this.selection?.commandId === commandId &&
      (commandId || this.selection?.groupId === groupId);
    if (same && this.session && commandId && !force) {
      if (focus || !this.view) {
        await this.focus();
      } else {
        await this.showView();
        this.view.show?.(true);
      }
      return;
    }
    while (this.dirty()) {
      const answer = await this.vscode.window.showWarningMessage(
        t(
          'Save changes to "{0}" before switching?',
          this.session.raw.title || t('New command'),
        ),
        { modal: true },
        t('Save'),
        t('Discard'),
        t('Cancel'),
      );
      if (answer === t('Save')) {
        await this.save(this.session.raw, this.selection.groupId);
      } else if (answer === t('Discard')) {
        break;
      } else {
        return;
      }
    }
    const cfg = await this.store.read(scope);
    let original;
    if (commandId) {
      const found = findCommand(cfg, commandId);
      if (!found) {
        throw new Error('Command no longer exists.');
      }
      groupId = found.group.id;
      original = found.command;
    }
    const group = requireGroup(cfg, groupId);
    this.selection = { scopeId: scope.id, groupId, commandId };
    const raw = this.rawCommand(
      original ? { ...original, steps: commandSteps(original) } : {},
    );
    this.session = {
      token: randomUUID(),
      revision: 0,
      raw,
      baseline: structuredClone(raw),
      original: original ? structuredClone(original) : undefined,
      scopeLabel: scope.label,
      groupTitle: group.title,
    };
    this.persist();
    // Ensure the sidebar is created for selection, then return focus to the tree when requested.
    if (focus || !this.view) {
      await this.focus();
    } else {
      await this.showView();
      this.view.show?.(true);
    }
    await this.load();
  }
  async showView() {
    await this.onModeChange?.(true);
    await this.vscode.commands.executeCommand(
      'setContext',
      'quickCmd.editing',
      true,
    );
  }
  async focus() {
    await this.showView();
    await this.vscode.commands.executeCommand('quickCmd.editor.focus');
    this.view?.show?.(true);
  }
  async load(surface) {
    const message = this.session
      ? {
          type: 'load',
          ...this.session,
          command: this.session.raw,
          groupId: this.selection.groupId,
          isEdit: !!this.selection.commandId,
        }
      : { type: 'empty' };
    const send = (target) =>
      target.webview.postMessage({
        ...message,
        readOnly: !!this.panel && target !== this.panel,
      });
    if (surface) {
      await send(surface);
    } else {
      for (const target of this.surfaces) {
        await send(target);
      }
    }
  }
  async close() {
    // Serialize close and selection changes; never hide a dirty or pending save silently.
    const job = this.openQueue
      .catch(() => {})
      .then(async () => {
        if (this.saving) {
          await this.saving;
        }
        while (this.dirty()) {
          const answer = await this.vscode.window.showWarningMessage(
            t('Save changes before closing the editor?'),
            { modal: true },
            t('Save'),
            t('Discard'),
            t('Cancel'),
          );
          if (answer === t('Save')) {
            await this.save(this.session.raw, this.selection.groupId);
          } else if (answer === t('Discard')) {
            break;
          } else {
            return false;
          }
        }
        this.panel?.dispose();
        this.session = undefined;
        this.selection = undefined;
        this.persist();
        this.broadcast({ type: 'empty' });
        await this.vscode.commands.executeCommand(
          'setContext',
          'quickCmd.editing',
          false,
        );
        await this.onModeChange?.(false);
        return true;
      });
    this.openQueue = job;
    return job;
  }
  async openPanel() {
    await this.showView();
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    this.panel = this.vscode.window.createWebviewPanel(
      'quickCmd.wideEditor',
      'Quick Cmd · ' + t('Edit command'),
      this.vscode.ViewColumn.Active,
      { retainContextWhenHidden: true },
    );
    this.attach(this.panel);
    this.broadcast({ type: 'readOnly', value: true }, this.panel);
  }
  async save(fields, targetGroupId, request = {}) {
    if (this.saving) {
      throw new Error('Stale editor request. Please retry.');
    }
    const task = this.saveRecord(fields, targetGroupId, request);
    this.saving = task;
    try {
      return await task;
    } finally {
      if (this.saving === task) {
        this.saving = undefined;
      }
    }
  }
  async saveRecord(fields, targetGroupId, request) {
    if (!this.selection) {
      throw new Error('Choose a command first.');
    }
    const selection = { ...this.selection };
    const session = this.session;
    const revisionAtStart = session?.revision;
    if (
      request.token &&
      (request.token !== session?.token ||
        request.revision !== session.revision)
    ) {
      throw new Error('Stale editor request. Please retry.');
    }
    const { scopeId, groupId, commandId } = selection;
    const scope = this.store.scopes().find((s) => s.id === scopeId);
    if (!scope) {
      throw new Error('The workspace is no longer open.');
    }
    if (targetGroupId !== groupId) {
      throw new Error('Command group changed. Reopen the editor.');
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      throw new Error('Invalid command fields.');
    }
    const clean = this.fields(fields);
    if (fields.envRows) {
      throw new Error(
        'Enter a valid environment variable name and a string value.',
      );
    }
    const savedRaw = structuredClone(
      fields.envText !== undefined ? fields : this.rawCommand(clean),
    );
    let result, resultingGroup;
    await this.store.update(scope, (cfg) => {
      if (commandId) {
        const found = findCommand(cfg, commandId);
        if (!found) {
          throw new Error('Command no longer exists.');
        }
        if (
          session?.original &&
          JSON.stringify(found.command) !== JSON.stringify(session.original)
        ) {
          throw new Error(
            'Command changed outside this editor. Reopen it to review the latest version; your draft is retained.',
          );
        }
        const command = found.command;
        for (const field of [
          'command',
          'execute',
          'steps',
          'cwd',
          'terminal',
          'confirm',
          'description',
          'icon',
          'env',
        ]) {
          delete command[field];
        }
        Object.assign(command, clean);
        result = command;
        resultingGroup = found.group;
      } else {
        requireGroup(cfg, groupId);
        result = addCommand(cfg, groupId, clean);
        resultingGroup = requireGroup(cfg, groupId);
      }
    });
    if (
      this.selection.scopeId === scopeId &&
      this.selection.commandId === commandId
    ) {
      this.selection.commandId = result.id;
      this.selection.groupId = resultingGroup.id;
      if (session) {
        session.original = structuredClone(result);
        session.baseline = savedRaw;
        session.groupTitle = resultingGroup.title;
        if (!request.token && session.revision === revisionAtStart) {
          session.raw = structuredClone(savedRaw);
        }
        this.persist();
      }
      this.broadcast({
        type: 'saved',
        token: session?.token,
        commandId: result.id,
        baseline: savedRaw,
        groupId: resultingGroup.id,
      });
    }
    this.onSaved();
    if (request.run && this.onRun) {
      await this.onRun(scope, result);
    }
    return result;
  }
  dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.panel?.dispose();
    this.surfaces.clear();
  }
}
module.exports = { CommandEditorProvider };
