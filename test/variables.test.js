'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { shellQuote, extractInputs, expand, detectShell } = require('../src/variables');

test('quotes POSIX shell interpolation against command injection', () => {
  assert.equal(shellQuote('a b'), "'a b'");
  assert.equal(shellQuote("x' ; rm -rf /"), "'x'\\'' ; rm -rf /'");
  assert.equal(expand('printf %s ${input:name}', { inputs: { name: '$(touch hacked)' } }), "printf %s '$(touch hacked)'");
});
test('PowerShell and cmd quoting handle special characters', () => {
  assert.equal(shellQuote("O'Neil", 'powershell'), "'O''Neil'");
  assert.equal(shellQuote('C:\\Program Files\\App', 'cmd'), '"C:\\Program Files\\App"');
  assert.throws(() => shellQuote('x%PATH%', 'cmd'), /unsafe/);
  assert.throws(() => shellQuote('a&b', 'cmd'), /unsafe/);
});
test('expands file, workspace, env and input placeholders', () => {
  const folder = path.resolve('my project');
  const file = path.join(folder, 'src', 'test.c');
  const ctx = { workspaceFolder: folder, file, inputs: { flavor: 'Debug' }, env: { USER: 'Alice' }, shell: 'posix' };
  assert.equal(expand('cd ${workspaceFolder}', ctx), `cd '${folder}'`);
  assert.equal(expand('${relativeFile} ${fileBasename} ${fileBasenameNoExtension}', ctx), "'src/test.c' 'test.c' 'test'");
  assert.equal(expand('${env:USER} ${input:flavor}', ctx), "'Alice' 'Debug'");
  assert.equal(expand('${fileDirname}', ctx, false), path.dirname(file));
});
test('detect input names and reject unresolved variables and missing context', () => {
  assert.deepEqual(extractInputs('echo ${input:target}', '${input:target}/dir ${input:mode}'), ['target', 'mode']);
  assert.throws(() => extractInputs('${input:bad name}'), /Invalid input/);
  assert.throws(() => expand('${file}', {}), /saved file/);
  assert.throws(() => expand('${workspaceFolder}', {}), /open workspace/);
  assert.throws(() => expand('${env:MISSING}', { env: {} }), /not set/);
  assert.throws(() => expand('${mystery}', {}), /Unknown variable/);
  assert.equal(detectShell({ workspace: { getConfiguration: () => ({ get: () => 'posix' }) } }), 'posix');
});

test('reject interpolation inside quoting, escapes and nested shell contexts', () => {
  for (const shell of ['posix', 'powershell', 'cmd']) {
    const ctx = { shell, inputs: { x: '$(printf injected)' } };
    for (const template of ['echo "${input:x}"', 'echo $(echo ${input:x})', 'cat <<END\n${input:x}\nEND']) {
      assert.throws(() => expand(template, ctx), /outside quotes/);
    }
    if (shell !== 'cmd') {
      assert.throws(() => expand("echo '${input:x}'", ctx), /outside quotes/);
      assert.throws(() => expand('# ${input:x}', ctx), /outside quotes/);
    }
  }
  assert.throws(() => expand('echo \\${input:x}', { inputs: { x: 'safe' } }), /outside quotes/);
  assert.throws(() => expand('echo ^${input:x}', { shell: 'cmd', inputs: { x: 'safe' } }), /outside quotes/);
});

test('bare interpolation preserves hostile values as literal shell arguments', () => {
  const { spawnSync } = require('node:child_process');
  if (process.platform === 'win32') return;
  const payload = '$(printf injected >&2)\nhello\'"; echo unexpected';
  const command = expand("printf '%s' ${input:x}", { inputs: { x: payload } });
  const result = spawnSync('/bin/sh', ['-c', command], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, payload);
  assert.equal(result.stderr, '');
  assert.equal(expand('echo "literal" ${input:x}', { inputs: { x: 'safe' } }), 'echo "literal" \'safe\'');
  assert.equal(expand('"${input:x}"', { inputs: { x: 'raw' } }, false), '"raw"');
});

test('reject nested parameter and arithmetic contexts before quoting values', () => {
  const ctx = { inputs: { x: '$(printf injected >&2)' } };
  for (const template of ['echo ${other:-"${input:x}"}', '(( ${input:x} ))', '[[ -v ${input:x} ]]', 'echo $[${input:x}]']) {
    assert.throws(() => expand(template, ctx), /outside quotes/);
  }
});
