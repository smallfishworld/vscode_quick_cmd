'use strict';

const { randomUUID } = require('node:crypto');
const MAX_GROUPS = 200;
const MAX_COMMANDS = 1000;
const TERMINAL_MODES = ['new', 'reuse', 'active'];
const MAX_STEPS = 32;

/** Legacy commands use one implicit step; new commands save steps[] instead. */
function commandSteps(cmd) {
  if (Array.isArray(cmd.steps)) { return cmd.steps.map(step => ({ command: step.command, execute: step.execute !== false })); }
  return [{ command: cmd.command, execute: cmd.execute !== false }];
}

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
  if (cmd.steps !== undefined) {
    if (cmd.command !== undefined) { throw new Error('Use either command or steps, not both.'); }
    if (!Array.isArray(cmd.steps) || !cmd.steps.length || cmd.steps.length > MAX_STEPS) {
      throw new Error(`Command steps must contain 1 to ${MAX_STEPS} entries.`);
    }
    let length = 0;
    for (const [index, step] of cmd.steps.entries()) {
      if (!isObject(step)) { throw new Error('Each step must be an object.'); }
      checkText(step.command, 'Shell step', 8192);
      if (step.execute !== undefined && typeof step.execute !== 'boolean') { throw new Error('Step execute must be a boolean.'); }
      if (index < cmd.steps.length - 1 && step.execute === false) {
        throw new Error('Only the final step can disable newline execution, to avoid accidental execution of combined input.');
      }
      length += step.command.length;
    }
    if (length > 32768) { throw new Error('Combined command text is too long (32768 characters maximum).'); }
  } else {
    checkText(cmd.command, 'Shell command', 8192);
  }
  if (cmd.execute !== undefined && typeof cmd.execute !== 'boolean') {
    throw new Error('Command execute must be a boolean.');
  }
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
/** Reorder a group or command via a native TreeView drop. Target commands insert before the target. */
function moveDrop(config, source, target) {
  if (!source || !target) { throw new Error('Invalid drop target.'); }
  if (source.kind === 'group') {
    if (!['group', 'scope'].includes(target.kind)) { throw new Error('Drop a group onto another group or its scope.'); }
    if (source.groupId === target.groupId && target.kind === 'group') { return false; }
    const sourceIndex = config.groups.findIndex(group => group.id === source.groupId);
    if (sourceIndex === -1) { throw new Error('Group no longer exists.'); }
    const [group] = config.groups.splice(sourceIndex, 1);
    const targetIndex = target.kind === 'scope' ? config.groups.length
      : config.groups.findIndex(item => item.id === target.groupId);
    if (targetIndex === -1) { throw new Error('Target group no longer exists.'); }
    config.groups.splice(targetIndex, 0, group);
    return true;
  }
  if (source.kind !== 'command' || !['command', 'group'].includes(target.kind)) {
    throw new Error('Drop a command onto a command or group.');
  }
  const from = requireGroup(config, source.groupId);
  const to = requireGroup(config, target.groupId);
  const origin = from.commands.findIndex(item => item.id === source.commandId);
  if (origin < 0) { throw new Error('Command no longer exists.'); }
  if (target.kind === 'command' && target.commandId === source.commandId) { return false; }
  const [command] = from.commands.splice(origin, 1);
  const index = target.kind === 'group' ? to.commands.length
    : to.commands.findIndex(item => item.id === target.commandId);
  if (index < 0) { throw new Error('Target command no longer exists.'); }
  to.commands.splice(index, 0, command);
  return true;
}
function findCommand(config, id) {
  for (const group of config.groups) {
    const command = group.commands.find(item => item.id === id);
    if (command) { return { group, command }; }
  }
  return undefined;
}

module.exports = { emptyConfig, validateConfig, addGroup, addCommand, requireGroup, requireCommand, moveItem, moveDrop, commandSteps, findCommand, TERMINAL_MODES };
