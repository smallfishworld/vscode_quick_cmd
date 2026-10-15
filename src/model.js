'use strict';

const { randomUUID } = require('node:crypto');
const MAX_GROUPS = 200;
const MAX_COMMANDS = 1000;
const TERMINAL_MODES = ['new', 'reuse', 'active'];

function emptyConfig() { return { version: 1, groups: [] }; }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function checkText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`${field} must be a non-empty string of at most ${maxLength} characters.`);
  }
}
function checkFields(cmd) {
  checkText(cmd.id, 'Command id', 128);
  checkText(cmd.title, 'Command title', 128);
  checkText(cmd.command, 'Shell command', 8192);
  for (const [field, limit] of [['cwd', 2048], ['description', 512], ['icon', 80]]) {
    if (cmd[field] !== undefined && (typeof cmd[field] !== 'string' || cmd[field].length > limit)) {
      throw new Error(`Command ${field} must be a string of at most ${limit} characters.`);
    }
  }
  if (cmd.terminal !== undefined && !TERMINAL_MODES.includes(cmd.terminal)) {
    throw new Error('Command terminal must be new, reuse, or active.');
  }
  if (cmd.confirm !== undefined && typeof cmd.confirm !== 'boolean') {
    throw new Error('Command confirm must be a boolean.');
  }
  if (cmd.env !== undefined && (!isObject(cmd.env) || Object.entries(cmd.env).some(([key, value]) =>
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== 'string' || value.length > 2048))) {
    throw new Error('Command env must map valid environment variable names to strings of at most 2048 characters.');
  }
}
function validateConfig(config) {
  if (!isObject(config) || config.version !== 1 || !Array.isArray(config.groups)) {
    throw new Error('Invalid Quick Cmd config: expected { "version": 1, "groups": [] }.');
  }
  if (config.groups.length > MAX_GROUPS) { throw new Error(`Too many groups (limit: ${MAX_GROUPS}).`); }
  const ids = new Set(); let total = 0;
  for (const group of config.groups) {
    if (!isObject(group) || !Array.isArray(group.commands)) { throw new Error('Each group must contain a commands array.'); }
    checkText(group.id, 'Group id', 128); checkText(group.title, 'Group title', 128);
    if (ids.has(group.id)) { throw new Error(`Duplicate id: ${group.id}`); }
    ids.add(group.id);
    for (const cmd of group.commands) {
      if (!isObject(cmd)) { throw new Error('Each command must be an object.'); }
      checkFields(cmd);
      if (ids.has(cmd.id)) { throw new Error(`Duplicate id: ${cmd.id}`); }
      ids.add(cmd.id); total++;
    }
  }
  if (total > MAX_COMMANDS) { throw new Error(`Too many commands (limit: ${MAX_COMMANDS}).`); }
  return config;
}
function addGroup(config, title) {
  checkText(title, 'Group title', 128);
  if (config.groups.length >= MAX_GROUPS) { throw new Error('Group limit reached.'); }
  const group = { id: randomUUID(), title: title.trim(), commands: [] };
  config.groups.push(group); return group;
}
function requireGroup(config, groupId) {
  const group = config.groups.find(g => g.id === groupId);
  if (!group) { throw new Error('Group no longer exists. Refresh the view.'); }
  return group;
}
function requireCommand(config, groupId, commandId) {
  const command = requireGroup(config, groupId).commands.find(c => c.id === commandId);
  if (!command) { throw new Error('Command no longer exists. Refresh the view.'); }
  return command;
}
function addCommand(config, groupId, fields) {
  const group = requireGroup(config, groupId);
  if (group.commands.length >= MAX_COMMANDS) { throw new Error('Command limit reached.'); }
  const command = { ...fields, id: randomUUID(), title: fields.title.trim() };
  checkFields(command);
  group.commands.push(command); return command;
}
function moveItem(items, id, direction) {
  const i = items.findIndex(item => item.id === id);
  if (i < 0) { throw new Error('Item no longer exists.'); }
  const next = i + direction;
  if (next < 0 || next >= items.length) { return false; }
  [items[i], items[next]] = [items[next], items[i]];
  return true;
}
function findCommand(config, id) {
  for (const group of config.groups) {
    const command = group.commands.find(item => item.id === id);
    if (command) { return { group, command }; }
  }
  return undefined;
}

module.exports = { emptyConfig, validateConfig, addGroup, addCommand, requireGroup, requireCommand, moveItem, findCommand, TERMINAL_MODES };
