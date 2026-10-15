import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function ui(locale = 'zh-CN') {
  const w = new Window({
    url: 'https://quick-cmd.test',
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  let html = fs
    .readFileSync(path.join(root, 'media/editor.html'), 'utf8')
    .replaceAll('{{language}}', locale);
  html = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<link[^>]+>/g, '');
  w.document.write(html);
  const messages = [];
  w.acquireVsCodeApi = () => ({
    postMessage: (m) => messages.push(structuredClone(m)),
    setState() {},
  });
  w.eval(fs.readFileSync(path.join(root, 'media/i18n.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'media/editor-client.js'), 'utf8'));
  const baseline = {
    title: 'Build',
    steps: [
      { command: 'echo a', execute: true },
      { command: 'echo b', execute: false },
    ],
    cwd: '',
    terminal: 'new',
    confirm: false,
    description: '',
    icon: '',
    envText: '{}',
  };
  const send = (msg) =>
    w.dispatchEvent(new w.MessageEvent('message', { data: msg }));
  send({
    type: 'load',
    token: 'session',
    revision: 0,
    raw: baseline,
    baseline,
    groupId: 'group',
    scopeLabel: locale.startsWith('zh') ? '全局命令' : 'Global commands',
    groupTitle: 'Build',
    isEdit: true,
  });
  const $ = (id) => w.document.getElementById(id);
  const input = (element, value) => {
    element.value = value;
    element.dispatchEvent(new w.Event('input', { bubbles: true }));
  };
  return {
    w,
    $,
    send,
    messages,
    baseline,
    input,
    close: () => w.happyDOM.abort(),
  };
}

test('Chinese editor has translated labels, tooltips, placeholders and SVG controls', async () => {
  const f = ui();
  try {
    assert.equal(f.$('save').textContent.trim(), '保存命令');
    assert.equal(f.$('expand').getAttribute('aria-label'), '在主编辑区打开');
    assert.equal(f.$('title').placeholder, '例如：编译项目');
    assert.equal(
      f.w.document.querySelector('.delete-action').title,
      '删除步骤',
    );
    assert.equal(f.w.document.querySelectorAll('.icon-choice svg').length, 7);
    assert.equal(f.$('save').disabled, true);
    assert.ok(!f.$('context').textContent.includes('全局命令'));
    assert.equal(f.$('saveState').textContent.trim(), '已保存');
  } finally {
    await f.close();
  }
});

test('English locale does not contain fixed Chinese UI text', async () => {
  const f = ui('en');
  try {
    assert.equal(f.$('save').textContent.trim(), 'Save command');
    assert.ok(!/[\u3400-\u9fff]/.test(f.w.document.body.textContent));
  } finally {
    await f.close();
  }
});

test('adding, reordering and deleting steps preserve the group trailing-Enter choice', async () => {
  const f = ui();
  try {
    assert.equal(f.$('trailingEnter').checked, false);
    f.$('addStep').click();
    f.input(
      f.$('steps').lastElementChild.querySelector('.step-command'),
      'echo c',
    );
    f.$('steps').lastElementChild.querySelector('.up-action').click();
    let draft = f.messages.filter((m) => m.type === 'draft').at(-1);
    assert.deepEqual(
      draft.fields.steps.map((s) => s.command),
      ['echo a', 'echo c', 'echo b'],
    );
    assert.deepEqual(
      draft.fields.steps.map((s) => s.execute),
      [true, true, false],
    );
    f.$('steps').lastElementChild.querySelector('.delete-action').click();
    draft = f.messages.filter((m) => m.type === 'draft').at(-1);
    assert.deepEqual(
      draft.fields.steps.map((s) => s.execute),
      [true, false],
    );
    f.$('undo').click();
    assert.equal(f.$('steps').children.length, 3);
    assert.equal(f.$('trailingEnter').checked, false);
  } finally {
    await f.close();
  }
});

test('save acknowledgement keeps later typing dirty and ignores an older session', async () => {
  const f = ui();
  try {
    f.input(f.$('title'), 'Submitted');
    f.$('save').click();
    const save = f.messages.filter((m) => m.type === 'save').at(-1);
    assert.equal(save.fields.title, 'Submitted');
    assert.equal(f.$('save').disabled, true);
    f.input(f.$('title'), 'Typed after save');
    f.send({
      type: 'saved',
      token: 'session',
      baseline: save.fields,
      groupId: 'group',
    });
    assert.equal(f.$('title').value, 'Typed after save');
    assert.equal(f.$('saveState').textContent, '未保存');
    assert.equal(f.$('save').disabled, false);
    f.send({ type: 'saved', token: 'other-session', baseline: f.baseline });
    assert.equal(f.$('title').value, 'Typed after save');
  } finally {
    await f.close();
  }
});

test('environment table detects duplicate names without losing invalid row values', async () => {
  const f = ui();
  try {
    f.$('addEnv').click();
    f.$('addEnv').click();
    const rows = [...f.$('envTable').children];
    f.input(rows[0].children[0], 'MODE');
    f.input(rows[0].children[1], 'a');
    f.input(rows[1].children[0], 'MODE');
    f.input(rows[1].children[1], 'b');
    f.$('save').click();
    assert.equal(f.messages.filter((m) => m.type === 'save').length, 0);
    assert.equal(f.$('envError').hidden, false);
    const draft = f.messages.filter((m) => m.type === 'draft').at(-1);
    f.send({
      type: 'draft',
      token: 'session',
      raw: draft.fields,
      baseline: f.baseline,
      revision: 99,
    });
    assert.equal(f.$('envTable').children.length, 2);
    assert.equal(f.$('envTable').children[1].children[1].value, 'b');
  } finally {
    await f.close();
  }
});

test('keyboard save and field errors operate on the visible form', async () => {
  const f = ui();
  try {
    f.input(f.$('title'), '');
    f.$('save').click();
    assert.equal(f.$('titleError').hidden, false);
    assert.equal(f.w.document.activeElement.id, 'title');
    f.input(f.$('title'), 'Changed');
    f.w.document.dispatchEvent(
      new f.w.KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
      }),
    );
    assert.equal(f.messages.filter((m) => m.type === 'save').length, 1);
  } finally {
    await f.close();
  }
});

test('wide-editor ownership locks the sidebar and restores it on close', async () => {
  const f = ui();
  try {
    f.send({ type: 'readOnly', value: true });
    assert.equal(f.$('editorFields').disabled, true);
    assert.equal(f.$('saveRun').disabled, true);
    f.w.document.dispatchEvent(
      new f.w.KeyboardEvent('keydown', { key: 's', ctrlKey: true }),
    );
    assert.equal(f.messages.filter((m) => m.type === 'save').length, 0);
    f.send({ type: 'readOnly', value: false });
    assert.equal(f.$('editorFields').disabled, false);
    assert.equal(f.$('saveRun').disabled, false);
  } finally {
    await f.close();
  }
});
