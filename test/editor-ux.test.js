'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  emptyConfig,
  addGroup,
  addCommand,
  commandSteps,
  validateConfig,
} = require('../src/model');
const { CommandEditorProvider } = require('../src/editor');
const root = path.join(__dirname, '..');

test('named command steps survive configuration read, export, and editing', () => {
  const cfg = emptyConfig();
  const group = addGroup(cfg, 'Build');
  const cmd = addCommand(cfg, group.id, {
    title: 'Pipeline',
    steps: [
      { title: '编译', command: 'make -j8', execute: true },
      { title: '检查', command: 'ctest', execute: false },
    ],
  });
  assert.deepEqual(commandSteps(cmd), cmd.steps);
  assert.equal(
    validateConfig(JSON.parse(JSON.stringify(cfg))).groups[0].commands[0]
      .steps[0].title,
    '编译',
  );
  assert.throws(
    () =>
      addCommand(cfg, group.id, {
        title: 'Invalid',
        steps: [{ command: 'echo hi', title: 'x'.repeat(65), execute: true }],
      }),
    /Step title/,
  );
  assert.equal(
    commandSteps({ command: 'echo legacy' })[0].command,
    'echo legacy',
  );
});

test('saving preserves editor focus and sends exactly one success message', async () => {
  const cfg = emptyConfig();
  const group = addGroup(cfg, 'Build');
  const cmd = addCommand(cfg, group.id, {
    title: 'Before',
    command: 'echo old',
  });
  const scope = { type: 'global', id: 'global', label: 'Global' };
  const store = {
    scopes: () => [scope],
    update: async (_, update) => {
      await update(cfg);
      validateConfig(cfg);
    },
  };
  const sent = [];
  let changes = 0;
  const editor = new CommandEditorProvider(
    { commands: { executeCommand: async () => {} } },
    {},
    store,
    () => changes++,
  );
  editor.view = {
    webview: {
      postMessage: (message) => {
        sent.push(message);
      },
    },
  };
  editor.selection = {
    scopeId: scope.id,
    groupId: group.id,
    commandId: cmd.id,
  };
  await editor.save(
    {
      title: 'After',
      steps: [{ title: '构建', command: 'make', execute: true }],
    },
    group.id,
  );
  assert.equal(changes, 1);
  assert.deepEqual(
    sent.map((message) => message.type),
    ['saved'],
  );
  assert.equal(editor.selection.commandId, cmd.id);
  assert.equal(cfg.groups[0].commands[0].steps[0].title, '构建');
  assert.equal(cfg.groups[0].commands[0].command, undefined);
});

test('editor exposes localized labels and accessible persistent actions', () => {
  const html = fs.readFileSync(path.join(root, 'media/editor.html'), 'utf8');
  for (const id of [
    'titleError',
    'stepsError',
    'addStep',
    'advanced',
    'cwdError',
    'envError',
    'save',
    'saveState',
    'trailingEnter',
    'expand',
  ]) {
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes('data-i18n="Save command"'));
  assert.ok(!html.includes('▣'));
});
