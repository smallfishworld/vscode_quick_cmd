'use strict';

const { randomUUID } = require('node:crypto');
const MAX_GROUPS = 200;
const MAX_COMMANDS = 1000;

/** A new empty, versioned configuration. */
function emptyConfig() { return { version: 1, groups: [] }; }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function checkText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(field + ' must be a non-empty string of at most ' + maxLength + ' characters.');
  }
}

/** Validate external configuration before reading or modifying it. */
function validateConfig(config) {
  if (!isObject(config) || config.version !== 1 || !Array.isArray(config.groups)) {
    throw new Error('Invalid Quick Cmd config: expected { "version": 1, "groups": [] }.');
  }
  if (config.groups.length > MAX_GROUPS) { throw new Error('Too many groups.'); }
  const ids = new Set();
  let count = 0;
  for (const group of config.groups) {
    if (!isObject(group) || !Array.isArray(group.commands)) {
      throw new Error('Each group must contain a commands array.');
    }
    checkText(group.id, 'Group id', 128);
    checkText(group.title, 'Group title', 128);
    if (ids.has(group.id)) { throw new Error('Duplicate id: ' + group.id); }
    ids.add(group.id);
    for (const cmd of group.commands) {
      if (!isObject(cmd)) { throw new Error('Each command must be an object.'); }
      checkText(cmd.id, 'Command id', 128);
      checkText(cmd.title, 'Command title', 128);
      checkText(cmd.command, 'Shell command', 8192);
      if (cmd.cwd !== undefined && (typeof cmd.cwd !== 'string' || cmd.cwd.length > 2048)) {
        throw new Error('Command cwd must be a string of at most 2048 characters.');
      }
      if (ids.has(cmd.id)) { throw new Error('Duplicate id: ' + cmd.id); }
      ids.add(cmd.id);
      count += 1;
    }
  }
  if (count > MAX_COMMANDS) { throw new Error('Too many commands.'); }
  return config;
}

function addGroup(config, title) {
  checkText(title, 'Group title', 128);
  if (config.groups.length >= MAX_GROUPS) { throw new Error('Group limit reached.'); }
  const group = { id: randomUUID(), title: title.trim(), commands: [] };
  config.groups.push(group);
  return group;
}

function requireGroup(config, groupId) {
  const group = config.groups.find(item => item.id === groupId);
  if (!group) { throw new Error('Group no longer exists. Refresh the view.'); }
  return group;
}

function requireCommand(config, groupId, commandId) {
  const command = requireGroup(config, groupId).commands.find(item => item.id === commandId);
  if (!command) { throw new Error('Command no longer exists. Refresh the view.'); }
  return command;
}

function addCommand(config, groupId, fields) {
  const group = requireGroup(config, groupId);
  checkText(fields.title, 'Command title', 128);
  checkText(fields.command, 'Shell command', 8192);
  const total = config.groups.reduce((sum, item) => sum + item.commands.length, 0);
  if (total >= MAX_COMMANDS) { throw new Error('Command limit reached.'); }
  const command = { id: randomUUID(), title: fields.title.trim(), command: fields.command };
  if (fields.cwd && fields.cwd.trim()) { command.cwd = fields.cwd.trim(); }
  group.commands.push(command);
  return command;
}

module.exports = { emptyConfig, validateConfig, addGroup, addCommand, requireGroup, requireCommand };
