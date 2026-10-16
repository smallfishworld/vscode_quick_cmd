'use strict';
const vscode = acquireVsCodeApi();
const { t, setLocale } = QuickCmdI18n;
setLocale(document.documentElement.lang);
const $ = (id) => document.getElementById(id);
const saved = vscode.getState?.() || {};
let collapsed = new Set(Array.isArray(saved.collapsed) ? saved.collapsed : []);
let selected = saved.selected || '';
let token, model, dragging, pending;
function persist() {
  vscode.setState({
    collapsed: [...collapsed],
    selected,
    scroll: window.scrollY,
  });
}
function send(type, node = {}) {
  vscode.postMessage({ type, token, ...node });
}
function glyph(name, extra = '') {
  const icon = document.createElement('span');
  const safe = /^[a-z][a-z0-9-]*$/.test(name) ? name : 'terminal';
  icon.className = 'codicon codicon-' + safe + (extra ? ' ' + extra : '');
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}
function key(node) {
  return node.kind === 'group' ? 'g:' + node.groupId : 'c:' + node.commandId;
}
function choose(row, node, notify = true) {
  selected = key(node);
  for (const current of document.querySelectorAll('.row')) {
    current.classList.toggle('selected', current === row);
    current.setAttribute('aria-selected', String(current === row));
    current.tabIndex = current === row ? 0 : -1;
  }
  persist();
  if (notify) {
    send('select', node);
  }
}
function button(icon, label, className, action) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.title = t(label);
  b.setAttribute('aria-label', t(label));
  b.append(glyph(icon));
  b.addEventListener('click', (event) => {
    event.stopPropagation();
    action();
  });
  return b;
}
function bindRow(row, node) {
  row.classList.add('row');
  row.dataset.key = key(node);
  row.dataset.kind = node.kind;
  row.dataset.vscodeContext = JSON.stringify({
    ...node,
    webviewSection: node.kind,
    quickCmdListContext: true,
    quickCmdToken: token,
    preventDefaultContextMenuItems: true,
  });
  row.dataset.groupId = node.groupId;
  if (node.commandId) {
    row.dataset.commandId = node.commandId;
  }
  row.setAttribute('role', 'treeitem');
  row.tabIndex = selected === key(node) ? 0 : -1;
  row.setAttribute('aria-selected', String(selected === key(node)));
  row.classList.toggle('selected', selected === key(node));
  row.draggable = true;
  // Let VS Code show its native menu at the pointer; right-click only selects.
  row.addEventListener('contextmenu', () => {
    choose(row, node);
  });
  row.addEventListener('dragstart', (event) => {
    if (event.target.closest('button')) {
      event.preventDefault();
      return;
    }
    dragging = node;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-quick-cmd', JSON.stringify(node));
  });
  row.addEventListener('dragover', (event) => {
    if (!dragging) {
      return;
    }
    if (dragging.kind === 'group' && node.kind === 'command') {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    clearDrop();
    row.classList.add(
      node.kind === 'group' && dragging.kind === 'command'
        ? 'drop-inside'
        : 'drop-before',
    );
  });
  row.addEventListener('dragleave', () => {
    row.classList.remove('drop-inside', 'drop-before');
  });
  row.addEventListener('drop', (event) => {
    if (!dragging) {
      return;
    }
    if (dragging.kind === 'group' && node.kind === 'command') {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    send('drop', { source: dragging, target: node });
    finishDrag();
  });
  row.addEventListener('dragend', finishDrag);
}
function clearDrop() {
  for (const row of document.querySelectorAll('.drop-before,.drop-inside')) {
    row.classList.remove('drop-before', 'drop-inside');
  }
}
function finishDrag() {
  dragging = undefined;
  clearDrop();
  if (pending) {
    const next = pending;
    pending = undefined;
    render(next);
  }
}
function render(data) {
  model = data;
  token = data.token;
  const activeKey = document.activeElement?.closest?.('.row')?.dataset.key;
  const activeAction = document.activeElement?.dataset?.action;
  const scroll = window.scrollY;
  // Zero follows the live VS Code UI font size; explicit sizes only affect this view.
  if (data.fontSize > 0) {
    document.documentElement.style.setProperty(
      '--command-size',
      data.fontSize + 'px',
    );
  } else {
    document.documentElement.style.removeProperty('--command-size');
  }
  const groups = Array.isArray(data.groups) ? data.groups : [];
  collapsed = new Set(
    [...collapsed].filter((id) => groups.some((group) => group.id === id)),
  );
  $('list').replaceChildren();
  $('empty').hidden = groups.length > 0;
  $('error').hidden = true;
  for (const group of groups) {
    const section = document.createElement('section');
    section.className = 'group';
    const node = { kind: 'group', groupId: group.id };
    const row = document.createElement('div');
    row.className = 'group-row';
    bindRow(row, node);
    row.setAttribute('aria-level', '1');
    row.setAttribute('aria-expanded', String(!collapsed.has(group.id)));
    const caret = glyph(
      collapsed.has(group.id) ? 'chevron-right' : 'chevron-down',
      'caret',
    );
    const text = document.createElement('span');
    text.className = 'text';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = group.title;
    text.append(name);
    row.append(
      caret,
      glyph(collapsed.has(group.id) ? 'folder' : 'folder-opened'),
      text,
      button('add', 'New command', 'add-button', () => send('add', node)),
    );
    row.title = group.title;
    const children = document.createElement('div');
    children.setAttribute('role', 'group');
    children.hidden = collapsed.has(group.id);
    row.addEventListener('click', () => {
      choose(row, node);
      toggle(group.id);
    });
    for (const command of group.commands) {
      const cmd = { kind: 'command', groupId: group.id, commandId: command.id };
      const item = document.createElement('div');
      item.className = 'command-row';
      bindRow(item, cmd);
      item.setAttribute('aria-level', '2');
      item.title = command.tooltip;
      const body = document.createElement('span');
      body.className = 'text';
      const title = document.createElement('span');
      title.className = 'name';
      title.textContent = command.title;
      const preview = document.createElement('span');
      preview.className = 'preview';
      preview.textContent = command.preview;
      body.append(title, preview);
      const actions = document.createElement('span');
      actions.className = 'row-actions';
      // 删除走行级右键的原生上下文菜单，不在行尾放按钮。
      for (const [action, icon, label] of [
        ['edit', 'edit', 'Edit command'],
        ['run', 'play', 'Run command'],
      ]) {
        const control = button(
          icon,
          label,
          'action-button ' + action + '-button',
          () => {
            choose(item, cmd);
            send(action, cmd);
          },
        );
        control.dataset.action = action;
        actions.append(control);
      }
      item.append(
        glyph(command.icon, command.running ? 'spin' : ''),
        body,
        actions,
      );
      item.addEventListener('click', () => {
        choose(item, cmd);
        send('run', cmd);
      });
      children.append(item);
    }
    section.append(row, children);
    $('list').append(section);
  }
  const rows = [...document.querySelectorAll('.row')];
  if (!rows.some((row) => row.tabIndex === 0) && rows[0]) {
    rows[0].tabIndex = 0;
  }
  if (activeKey) {
    const active = rows.find((row) => row.dataset.key === activeKey);
    if (active) {
      (activeAction
        ? [...active.querySelectorAll('.action-button')].find(
            (button) => button.dataset.action === activeAction,
          ) || active
        : active
      ).focus({ preventScroll: true });
    }
  }
  window.scrollTo?.(0, scroll || saved.scroll || 0);
}
function toggle(id, expand) {
  const shouldExpand = expand === undefined ? collapsed.has(id) : expand;
  if (shouldExpand) {
    collapsed.delete(id);
  } else {
    collapsed.add(id);
  }
  persist();
  if (model) {
    render(model);
  }
}
function rowNode(row) {
  return {
    kind: row.dataset.kind,
    groupId: row.dataset.groupId,
    ...(row.dataset.commandId ? { commandId: row.dataset.commandId } : {}),
  };
}
$('list').addEventListener('keydown', (event) => {
  if (event.target.closest('button')) {
    return;
  }
  const row = event.target.closest('.row');
  if (!row) {
    return;
  }
  const node = rowNode(row);
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    row.click();
  }
  if (event.key === 'F2' && node.kind === 'command') {
    event.preventDefault();
    send('edit', node);
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    if (node.kind === 'group') {
      toggle(node.groupId, event.key === 'ArrowRight');
    } else if (event.key === 'ArrowLeft') {
      const group = [...document.querySelectorAll('.group-row')].find(
        (item) => item.dataset.groupId === node.groupId,
      );
      group?.focus();
    }
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    const rows = [...document.querySelectorAll('.row')].filter(
      (item) => !item.closest('[hidden]'),
    );
    const next = rows[rows.indexOf(row) + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
      choose(next, rowNode(next));
      next.focus();
    }
  }
});
$('list').addEventListener('dragover', (event) => {
  if (dragging?.kind === 'group') {
    event.preventDefault();
  }
});
$('list').addEventListener('drop', (event) => {
  if (dragging?.kind === 'group') {
    event.preventDefault();
    send('drop', { source: dragging, target: { kind: 'root' } });
    finishDrag();
  }
});
for (const element of document.querySelectorAll('[data-i18n]')) {
  element.textContent = t(element.dataset.i18n);
}
$('newGroup').addEventListener('click', () => send('newGroup'));
window.addEventListener('scroll', persist);
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') {
    return;
  }
  if (data.type === 'model') {
    if (dragging) {
      pending = data;
    } else {
      render(data);
    }
  }
  if (data.type === 'error') {
    $('error').textContent = data.message;
    $('error').hidden = false;
  }
  if (data.type === 'collapseAll' && model) {
    collapsed = new Set(model.groups.map((group) => group.id));
    persist();
    render(model);
  }
  if (data.type === 'reveal' && model) {
    collapsed.delete(data.groupId);
    selected =
      data.kind === 'group' ? 'g:' + data.groupId : 'c:' + data.commandId;
    render(model);
    const row = [...document.querySelectorAll('.row')].find(
      (item) => item.dataset.key === selected,
    );
    row?.scrollIntoView?.({ block: 'nearest' });
  }
});
vscode.postMessage({ type: 'ready' });
