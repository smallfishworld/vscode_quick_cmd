import assert from 'node:assert/strict';
import test from 'node:test';
import {ConfigError, parseCommandFile, parseGroups} from '../src/model';

test('parseCommandFile accepts valid configuration', () => {
  const config = parseCommandFile({version: 1, groups: [{id: 'build', name: 'Build', commands: [
    {id: 'compile', name: 'Compile', command: 'make -j8', terminal: 'reuse', confirm: false}
  ]}]});
  assert.equal(config.groups[0].commands[0].command, 'make -j8');
});

test('an empty command collection is valid', () => {
  assert.deepEqual(parseGroups([]), []);
});

test('rejects invalid version and malformed input', () => {
  assert.throws(() => parseCommandFile({version: 2, groups: []}), ConfigError);
  assert.throws(() => parseGroups(null), ConfigError);
  assert.throws(() => parseGroups([{id: 'x', name: 'x'}]), /commands/);
});

test('rejects duplicate group and command ids', () => {
  assert.throws(() => parseGroups([
    {id: 'x', name: 'one', commands: []}, {id: 'x', name: 'two', commands: []}
  ]), /Duplicate group/);
  assert.throws(() => parseGroups([
    {id: 'a', name: 'A', commands: [{id: 'same', name: '1', command: 'echo 1'}]},
    {id: 'b', name: 'B', commands: [{id: 'same', name: '2', command: 'echo 2'}]}
  ]), /Duplicate command/);
});

test('rejects unexpected terminal and field types', () => {
  assert.throws(() => parseGroups([{id: 'x', name: 'X', commands: [
    {id: 'y', name: 'Y', command: 'x', terminal: 'active'}
  ]}]), /terminal/);
  assert.throws(() => parseGroups([{id: 'x', name: 'X', commands: [
    {id: 'y', name: 'Y', command: 'x', confirm: 'yes'}
  ]}]), /confirm/);
});
