import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveVariables} from '../src/variables';

test('resolves file and workspace placeholders', () => {
  const result = resolveVariables('${workspaceFolder}|${fileBasename}|${fileBasenameNoExtension}|${fileDirname}|${relativeFile}', {
    workspaceFolder: '/home/dev/demo', file: '/home/dev/demo/src/main.c'
  });
  assert.equal(result, '/home/dev/demo|main.c|main|/home/dev/demo/src|src/main.c');
});

test('resolves environment variables', () => {
  assert.equal(resolveVariables('${env:SDK_HOME}/bin', {env: {SDK_HOME: '/opt/sdk'}}), '/opt/sdk/bin');
  assert.throws(() => resolveVariables('${env:NOT_SET}', {env: {}}), /not set/);
});

test('preserves normal shell expressions and rejects unavailable VS Code variables', () => {
  assert.equal(resolveVariables('echo ${HOME}', {}), 'echo ${HOME}');
  assert.throws(() => resolveVariables('cat ${file}', {}), /Unavailable variable/);
});
