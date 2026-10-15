'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveCwd, TerminalRunner } = require('../src/terminal');

test('resolve absolute, relative and default cwd', () => {
  const root = path.resolve('project');
  assert.equal(resolveCwd(undefined, root), root);
  assert.equal(resolveCwd('build', root), path.join(root, 'build'));
  assert.equal(resolveCwd('${workspaceFolder}/out', root), path.join(root, 'out'));
  assert.equal(resolveCwd(root), root);
  assert.throws(() => resolveCwd('build'), /require an open workspace/);
  assert.throws(() => resolveCwd('${workspaceFolder}'), /needs an open workspace/);
});

test('launch a fresh integrated terminal for each click', () => {
  const records = [];
  const folder = { uri: { scheme: 'file', fsPath: path.resolve('fixture') } };
  const api = {
    workspace: { workspaceFolders: [folder], isTrusted: true, getWorkspaceFolder: () => folder },
    window: {
      createTerminal: options => {
        const record = { options, calls: [] };
        records.push(record);
        return {
          show: () => record.calls.push('show'),
          sendText: (...args) => record.calls.push(args)
        };
      }
    }
  };
  const runner = new TerminalRunner(api);
  const command = { title: 'Compile', command: 'make -j8' };
  runner.run({ type: 'workspace', folder }, command);
  runner.run({ type: 'workspace', folder }, command);
  assert.equal(records.length, 2);
  assert.deepEqual(records[0].calls, ['show', ['make -j8', true]]);
  assert.equal(records[0].options.cwd, folder.uri.fsPath);
});

test('reject command execution for untrusted projects', () => {
  const api = { workspace: { workspaceFolders: [{}], isTrusted: false }, window: {} };
  assert.throws(() => new TerminalRunner(api).run({ type: 'global' }, { title: 'X', command: 'x' }), /Trust this workspace/);
});
