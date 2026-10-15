import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture() {
  const w = new Window({
    url: 'https://quick-cmd.test',
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  const html = fs
    .readFileSync(path.join(root, 'media/list.html'), 'utf8')
    .replaceAll('{{language}}', 'zh-cn')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<link[^>]+>/g, '');
  w.document.write(html);
  w.scrollTo = () => {};
  const style = w.document.createElement('style');
  style.textContent = fs.readFileSync(
    path.join(root, 'media/list.css'),
    'utf8',
  );
  w.document.head.append(style);
  const messages = [];
  let state;
  w.acquireVsCodeApi = () => ({
    postMessage: (packet) => messages.push(structuredClone(packet)),
    getState: () => state,
    setState: (value) => {
      state = value;
    },
  });
  w.eval(fs.readFileSync(path.join(root, 'media/i18n.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'media/list-client.js'), 'utf8'));
  const model = {
    type: 'model',
    token: 'session',
    fontSize: 11,
    groups: [
      {
        id: 'g',
        title: 'Build',
        commands: [
          {
            id: 'a',
            title: 'Make',
            preview: 'make',
            tooltip: 'make',
            icon: 'terminal',
          },
          {
            id: 'b',
            title: '<script>unsafe</script>',
            preview: 'echo b',
            tooltip: 'echo b',
            icon: 'tools',
          },
        ],
      },
    ],
  };
  const send = (packet) =>
    w.dispatchEvent(new w.MessageEvent('message', { data: packet }));
  send(model);
  return { w, model, send, messages, close: () => w.happyDOM.abort() };
}
test('compact list uses font hierarchy and persistent row edit without count or blue decoration', async () => {
  const f = fixture();
  try {
    const doc = f.w.document;
    assert.equal(
      doc.documentElement.style.getPropertyValue('--command-size'),
      '11px',
    );
    assert.equal(
      doc.documentElement.style.getPropertyValue('--group-size'),
      '12px',
    );
    assert.equal(doc.querySelector('.group-row .name').textContent, 'Build');
    assert.equal(doc.querySelectorAll('.edit-button').length, 2);
    assert.equal(
      f.w.getComputedStyle(doc.querySelector('.edit-button')).visibility,
      'visible',
    );
    assert.equal(
      f.w.getComputedStyle(doc.querySelector('.edit-button')).opacity,
      '1',
    );
    assert.equal(
      doc.querySelector('.edit-button').getAttribute('aria-label'),
      '编辑命令',
    );
    assert.equal(
      doc.querySelectorAll('script').length,
      0,
      'user labels are text, not HTML',
    );
    assert.equal(doc.querySelectorAll('.count,.badge').length, 0);
  } finally {
    await f.close();
  }
});
test('editing a row never runs it; clicking its body sends exactly once', async () => {
  const f = fixture();
  try {
    const row = f.w.document.querySelector('.command-row');
    row.querySelector('.edit-button').click();
    assert.equal(f.messages.filter((m) => m.type === 'edit').length, 1);
    assert.equal(f.messages.filter((m) => m.type === 'run').length, 0);
    row.querySelector('.name').click();
    assert.equal(f.messages.filter((m) => m.type === 'run').length, 1);
    assert.equal(f.messages.at(-1).commandId, 'a');
  } finally {
    await f.close();
  }
});
test('collapsed state survives model refresh and toolbar collapse does not execute', async () => {
  const f = fixture();
  try {
    f.w.document.querySelector('.group-row').click();
    assert.equal(f.w.document.querySelector('[role=group]').hidden, true);
    f.send({ ...f.model, fontSize: 12 });
    assert.equal(f.w.document.querySelector('[role=group]').hidden, true);
    f.w.document.querySelector('.group-row').click();
    assert.equal(f.w.document.querySelector('[role=group]').hidden, false);
    f.send({ type: 'collapseAll' });
    assert.equal(f.w.document.querySelector('[role=group]').hidden, true);
    assert.equal(f.messages.filter((m) => m.type === 'run').length, 0);
  } finally {
    await f.close();
  }
});
test('keyboard navigation selects without running, F2 edits, Enter sends', async () => {
  const f = fixture();
  try {
    let group = f.w.document.querySelector('.group-row');
    group.focus();
    group.dispatchEvent(
      new f.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    const row = f.w.document.activeElement;
    assert.equal(row.dataset.commandId, 'a');
    assert.equal(f.messages.filter((m) => m.type === 'run').length, 0);
    row.dispatchEvent(
      new f.w.KeyboardEvent('keydown', { key: 'F2', bubbles: true }),
    );
    assert.equal(f.messages.at(-1).type, 'edit');
    row.dispatchEvent(
      new f.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    assert.equal(f.messages.at(-1).type, 'run');
  } finally {
    await f.close();
  }
});
test('dragging sends only record identities and defers model refresh until drop', async () => {
  const f = fixture();
  try {
    const doc = f.w.document;
    const event = (type) => {
      const e = new f.w.Event(type, { bubbles: true, cancelable: true });
      e.dataTransfer = { effectAllowed: '', setData() {} };
      return e;
    };
    doc.querySelectorAll('.command-row')[1].dispatchEvent(event('dragstart'));
    f.send({ ...f.model, fontSize: 14 });
    assert.equal(
      doc.documentElement.style.getPropertyValue('--command-size'),
      '11px',
    );
    doc.querySelector('.group-row').dispatchEvent(event('drop'));
    assert.deepEqual(f.messages.at(-1), {
      type: 'drop',
      token: 'session',
      source: { kind: 'command', groupId: 'g', commandId: 'b' },
      target: { kind: 'group', groupId: 'g' },
    });
    assert.equal(
      doc.documentElement.style.getPropertyValue('--command-size'),
      '14px',
    );
    doc.querySelector('.group-row').dispatchEvent(event('dragstart'));
    doc.querySelector('#list').dispatchEvent(event('drop'));
    assert.equal(f.messages.at(-1).target.kind, 'root');
    assert.equal(f.messages.filter((m) => m.type === 'run').length, 0);
  } finally {
    await f.close();
  }
});
