'use strict';
const { validateConfig } = require('./model');
const os = require('node:os');

async function exportScope(vscode, store, scope) {
  const config = await store.read(scope);
  const name = scope.type === 'global' ? 'quick-cmd-global.json' : 'quick-cmd.json';
  const uri = await vscode.window.showSaveDialog({
    saveLabel: 'Export Quick Cmd configuration', filters: { JSON: ['json'] },
    defaultUri: vscode.Uri.joinPath(scope.type === 'workspace' ? scope.folder.uri : vscode.Uri.file(os.homedir()), name)
  });
  if (!uri) { return false; }
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(`${JSON.stringify(config, null, 2)}\n`));
  return true;
}

async function importScope(vscode, store, scope) {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false, openLabel: 'Import Quick Cmd configuration', filters: { JSON: ['json'] }
  });
  if (!picked?.length) { return false; }
  const bytes = await vscode.workspace.fs.readFile(picked[0]);
  const incoming = validateConfig(JSON.parse(new TextDecoder().decode(bytes)));
  const confirmation = await vscode.window.showWarningMessage(
    `Replace all commands in "${scope.label}" with ${incoming.groups.length} imported group(s)?`,
    { modal: true }, 'Replace Commands'
  );
  if (confirmation !== 'Replace Commands') { return false; }
  await store.update(scope, config => {
    config.version = incoming.version;
    config.groups = structuredClone(incoming.groups);
  });
  return true;
}
module.exports = { exportScope, importScope };
