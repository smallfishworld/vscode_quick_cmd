'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { emptyConfig, validateConfig, addGroup, addCommand, requireCommand } = require('../src/model');

test('create and validate groups with unique IDs', () => {
  const config = emptyConfig();
  const group = addGroup(config, ' Build ');
  const cmd = addCommand(config, group.id, { title: ' Debug ', command: 'cmake --build build', cwd: 'build' });
  assert.equal(group.title, 'Build');
  assert.equal(cmd.title, 'Debug');
  assert.equal(requireCommand(config, group.id, cmd.id).cwd, 'build');
  assert.equal(validateConfig(config), config);
});

test('reject invalid schema, duplicate IDs, and empty commands', () => {
  assert.throws(() => validateConfig({ version: 2, groups: [] }), /Invalid Quick Cmd config/);
  const config = emptyConfig();
  const group = addGroup(config, 'Commands');
  addCommand(config, group.id, { title: 'Run', command: 'echo okay' });
  addCommand(config, group.id, { title: 'Other', command: 'echo 2' });
  config.groups[0].commands[1].id = config.groups[0].commands[0].id;
  assert.throws(() => validateConfig(config), /Duplicate id/);
  assert.throws(() => addCommand(config, group.id, { title: 'Empty', command: '  ' }), /Shell command/);
});

test('reject missing group and invalid command data', () => {
  assert.throws(() => validateConfig({ version: 1, groups: [{ id: '1', title: 'Build', commands: [{}] }] }), /Command id/);
  assert.throws(() => addCommand(emptyConfig(), 'missing', { title: 'X', command: 'x' }), /Group no longer exists/);
});
