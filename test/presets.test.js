'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { validateConfig } = require('../src/model');
const { commandSteps, findCommand } = require('../src/model');
const { extractInputs, expand } = require('../src/variables');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'presets', name), 'utf8'));
}

for (const locale of ['zh-CN', 'en']) {
  test(`full command presets validate: ${locale}`, () => {
    const config = load(`defaults.${locale}.json`);
    assert.equal(validateConfig(config), config);
    assert.equal(config.groups.length, 6);
    assert.equal(config.groups.reduce((n, group) => n + group.commands.length, 0), 43);
    for (const group of config.groups) {
      for (const cmd of group.commands) {
        assert.equal(cmd.cwd, '${workspaceFolder}');
        assert.equal(cmd.terminal, 'reuse');
        assert.equal(commandSteps(cmd).length, 1);
        assert.equal(commandSteps(cmd)[0].execute, true);
        assert.ok(extractInputs(cmd.steps[0].command).every(name => name.length > 0));
      }
    }
    for (const id of [
      'preset-git-pull', 'preset-git-commit', 'preset-git-push',
      'preset-git-stash-save', 'preset-svn-update', 'preset-svn-commit',
    ]) {
      assert.equal(findCommand(config, id)?.command.confirm, true, id);
    }
  });

  test(`Git-only presets match the complete collection: ${locale}`, () => {
    const full = load(`defaults.${locale}.json`);
    const git = load(`git.${locale}.json`);
    assert.equal(validateConfig(git), git);
    assert.equal(git.groups.length, 1);
    assert.deepEqual(git.groups[0], full.groups[0]);
    assert.equal(git.groups[0].commands.length, 14);
  });
}

test('translated presets preserve the same executable commands and IDs', () => {
  const cn = load('defaults.zh-CN.json');
  const en = load('defaults.en.json');
  function executable(config) {
    return config.groups.map(group => ({
      id: group.id,
      commands: group.commands.map(({ title, ...rest }) => rest),
    }));
  }
  assert.deepEqual(executable(cn), executable(en));
});

test('input placeholders expand using shell quoting', () => {
  const cfg = load('git.zh-CN.json');
  const cmd = findCommand(cfg, 'preset-git-commit').command;
  const resolved = expand(cmd.steps[0].command, {
    workspaceFolder: '/tmp/work',
    inputs: { message: "fix: don't lose data" },
    env: {}, shell: 'posix',
  });
  assert.equal(resolved, "git commit -m 'fix: don'\\''t lose data'");
});
