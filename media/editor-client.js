'use strict';

const vscode = acquireVsCodeApi();
const byId = id => document.getElementById(id);
const stepsElement = byId('steps');
const form = byId('form');
const MAX_STEPS = 32;
let busy = false;
let savedTimer;
let contextLabel = '';

function hideSaved() {
  if (savedTimer !== undefined) { clearTimeout(savedTimer); savedTimer = undefined; }
  byId('saved').hidden = true;
}

function setBusy(value) {
  busy = value;
  byId('save').disabled = value;
  byId('save').textContent = value ? '保存中…' : '▣  保存命令';
}

function clearFieldError(element, messageId) {
  element.classList.remove('is-invalid');
  element.removeAttribute('aria-invalid');
  const message = byId(messageId);
  message.textContent = '';
  message.hidden = true;
}
function markFieldError(element, messageId, text) {
  element.classList.add('is-invalid');
  element.setAttribute('aria-invalid', 'true');
  const message = byId(messageId);
  message.textContent = text;
  message.hidden = false;
}
function clearErrors() {
  for (const [id, errorId] of [['title', 'titleError'], ['cwd', 'cwdError'], ['icon', 'iconError'], ['env', 'envError']]) {
    clearFieldError(byId(id), errorId);
  }
  for (const row of stepsElement.children) {
    row.classList.remove('is-invalid');
    row.querySelector('.step-command').classList.remove('is-invalid');
    row.querySelector('.step-command').removeAttribute('aria-invalid');
    row.querySelector('.step-error').textContent = '';
    row.querySelector('.step-error').hidden = true;
  }
  for (const id of ['error', 'stepsError']) {
    byId(id).textContent = '';
    byId(id).hidden = true;
  }
}
function showGlobalError(text) {
  byId('error').textContent = String(text);
  byId('error').hidden = false;
}
function rowError(row, text) {
  row.classList.add('is-invalid');
  const input = row.querySelector('.step-command');
  input.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');
  const error = row.querySelector('.step-error');
  error.textContent = text;
  error.hidden = false;
}

function makeAction(symbol, label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'step-action' + (label === '删除步骤' ? ' danger' : '');
  button.textContent = symbol;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', handler);
  return button;
}
function makeStep(step = { command: '', execute: true }, autofocus = false) {
  const row = document.createElement('div');
  row.className = 'step-card';
  const head = document.createElement('div');
  head.className = 'step-head';
  const number = document.createElement('span');
  number.className = 'step-number';
  number.setAttribute('aria-hidden', 'true');
  const name = document.createElement('input');
  name.type = 'text';
  name.className = 'step-name';
  name.maxLength = 64;
  name.value = step.title || '';
  name.setAttribute('aria-label', '步骤名称（可选）');
  const actions = document.createElement('div');
  actions.className = 'step-actions';
  const up = makeAction('↑', '上移步骤', () => {
    if (row.previousElementSibling) {
      stepsElement.insertBefore(row, row.previousElementSibling);
      renumber();
      up.focus();
    }
  });
  const down = makeAction('↓', '下移步骤', () => {
    if (row.nextElementSibling) {
      stepsElement.insertBefore(row.nextElementSibling, row);
      renumber();
      down.focus();
    }
  });
  const remove = makeAction('×', '删除步骤', () => {
    if (stepsElement.children.length > 1) {
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      renumber();
      next?.querySelector('.step-name')?.focus();
    }
  });
  actions.append(up, down, remove);
  head.append(number, name, actions);

  const command = document.createElement('textarea');
  command.className = 'step-command';
  command.placeholder = '例如：cmake --build build -j8';
  command.spellcheck = false;
  command.maxLength = 8192;
  command.value = step.command || '';
  const bottom = document.createElement('div');
  bottom.className = 'step-bottom';
  const checkLabel = document.createElement('label');
  checkLabel.className = 'step-execute-label';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'step-execute';
  checkbox.checked = step.execute !== false;
  checkLabel.append(checkbox, document.createTextNode('↵ 换行执行'));
  bottom.append(checkLabel);
  const error = document.createElement('p');
  error.className = 'field-error step-error';
  error.setAttribute('role', 'alert');
  error.hidden = true;
  row.append(head, command, bottom, error);
  stepsElement.append(row);
  if (autofocus) { command.focus(); }
  return row;
}

function renumber() {
  const rows = [...stepsElement.children];
  rows.forEach((row, index) => {
    const number = index + 1;
    row.querySelector('.step-number').textContent = String(number);
    const name = row.querySelector('.step-name');
    name.placeholder = '步骤 ' + number;
    row.querySelector('.step-command').setAttribute('aria-label', '步骤 ' + number + ' 的命令内容');
    const actions = row.querySelectorAll('.step-action');
    actions[0].disabled = index === 0;
    actions[1].disabled = index === rows.length - 1;
    actions[2].disabled = rows.length === 1;
    const execute = row.querySelector('.step-execute');
    const last = index === rows.length - 1;
    if (!last) { execute.checked = true; }
    execute.disabled = !last;
    execute.title = last ? '取消勾选则仅输入命令，不发送回车' : '非最后步骤必须换行执行';
    execute.setAttribute('aria-label', '步骤 ' + number + '：换行执行');
  });
  const navigation = byId('stepNav');
  navigation.replaceChildren();
  if (rows.length <= 8) {
    rows.forEach((row, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'step-jump';
      button.textContent = String(index + 1);
      button.title = '跳转到步骤 ' + (index + 1);
      button.setAttribute('aria-label', '跳转到步骤 ' + (index + 1));
      button.addEventListener('click', () => row.querySelector('.step-name').focus());
      navigation.append(button);
    });
  } else {
    const counter = document.createElement('span');
    counter.className = 'step-count';
    counter.textContent = '共 ' + rows.length + ' 步';
    navigation.append(counter);
  }
  byId('addStep').disabled = rows.length >= MAX_STEPS;
}

function resetSteps(steps) {
  stepsElement.replaceChildren();
  for (const step of steps) { makeStep(step); }
  if (!steps.length) { makeStep(); }
  renumber();
}
function validateForm() {
  clearErrors();
  let firstInvalid;
  function fail(element, callback) {
    if (!firstInvalid) { firstInvalid = element; }
    callback();
  }
  const title = byId('title').value.trim();
  if (!title || title.length > 128) {
    fail(byId('title'), () => markFieldError(byId('title'), 'titleError', '请输入命令名称（不超过 128 个字符）。'));
  }
  const steps = [...stepsElement.children].map(row => {
    const item = { command: row.querySelector('.step-command').value, execute: row.querySelector('.step-execute').checked };
    const name = row.querySelector('.step-name').value.trim();
    if (name) { item.title = name; }
    return item;
  });
  let totalSize = 0;
  steps.forEach((step, index) => {
    const row = stepsElement.children[index];
    totalSize += step.command.length;
    if (!step.command.trim()) {
      fail(row.querySelector('.step-command'), () => rowError(row, '第 ' + (index + 1) + ' 步的命令不能为空。'));
    }
    if (index !== steps.length - 1 && !step.execute) {
      fail(row.querySelector('.step-command'), () => rowError(row, '非最后一步必须勾选“换行执行”。'));
    }
  });
  if (totalSize > 32768) {
    byId('stepsError').textContent = '所有步骤的命令总长度不能超过 32768 个字符。';
    byId('stepsError').hidden = false;
    if (!firstInvalid) { firstInvalid = stepsElement.querySelector('.step-command'); }
  }
  const cwd = byId('cwd').value.trim();
  if (cwd.length > 2048) {
    fail(byId('cwd'), () => markFieldError(byId('cwd'), 'cwdError', '工作目录不能超过 2048 个字符。'));
  }
  const icon = byId('icon').value.trim();
  if (icon && !/^[a-z][a-z0-9-]*$/.test(icon)) {
    fail(byId('icon'), () => markFieldError(byId('icon'), 'iconError', '图标名称只能包含小写字母、数字与连字符。'));
  }
  let env;
  try {
    env = JSON.parse(byId('env').value.trim() || '{}');
    if (!env || typeof env !== 'object' || Array.isArray(env)) { throw new Error('请输入 JSON 对象。'); }
    for (const [key, value] of Object.entries(env)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== 'string' || value.length > 2048) {
        throw new Error('环境变量名无效，或值不是字符串／超过 2048 字符。');
      }
    }
  } catch (error) {
    fail(byId('env'), () => markFieldError(byId('env'), 'envError', '环境变量格式错误：' + error.message));
  }
  if (firstInvalid) {
    if (byId('advanced').contains(firstInvalid)) { byId('advanced').open = true; }
    firstInvalid.focus();
    return undefined;
  }
  const fields = {
    title, steps,
    terminal: byId('terminal').value,
    confirm: byId('confirm').checked
  };
  if (cwd) { fields.cwd = cwd; }
  for (const id of ['description', 'icon']) {
    const value = byId(id).value.trim();
    if (value) { fields[id] = value; }
  }
  if (Object.keys(env).length) { fields.env = env; }
  return fields;
}

byId('addStep').addEventListener('click', () => {
  if (stepsElement.children.length >= MAX_STEPS) { return; }
  hideSaved();
  clearErrors();
  makeStep(undefined, true);
  renumber();
});

for (const chip of document.querySelectorAll('[data-cwd]')) {
  chip.addEventListener('click', () => {
    const input = byId('cwd');
    const insert = chip.dataset.cwd;
    input.setRangeText(insert, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
}
form.addEventListener('input', event => {
  hideSaved();
  // Keep errors local to each field without repeatedly moving focus while typing.
  const input = event.target;
  if (input.id === 'title') { clearFieldError(input, 'titleError'); }
  if (input.id === 'cwd') { clearFieldError(input, 'cwdError'); }
  if (input.id === 'icon') { clearFieldError(input, 'iconError'); }
  if (input.id === 'env') { clearFieldError(input, 'envError'); }
  if (input.classList?.contains('step-command')) {
    const row = input.closest('.step-card');
    row?.classList.remove('is-invalid');
    input.classList.remove('is-invalid'); input.removeAttribute('aria-invalid');
    const error = row?.querySelector('.step-error');
    if (error) { error.textContent = ''; error.hidden = true; }
  }
  byId('error').hidden = true;
});
form.addEventListener('change', hideSaved);
form.addEventListener('submit', event => {
  event.preventDefault();
  if (busy) { return; }
  hideSaved();
  const fields = validateForm();
  if (!fields) { return; }
  setBusy(true);
  vscode.postMessage({ type: 'save', fields, groupId: form.dataset.groupId });
});

window.addEventListener('message', event => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') { return; }
  if (msg.type === 'empty') {
    hideSaved(); form.hidden = true; byId('empty').hidden = false;
  } else if (msg.type === 'load') {
    hideSaved();
    form.dataset.groupId = msg.groupId;
    byId('empty').hidden = true; form.hidden = false;
    contextLabel = msg.scopeLabel + ' / ' + msg.groupTitle;
    byId('context').textContent = contextLabel + (msg.isEdit ? ' · 编辑命令' : ' · 新建命令');
    const cmd = msg.command || {};
    for (const id of ['title', 'cwd', 'description', 'icon']) { byId(id).value = cmd[id] || ''; }
    byId('terminal').value = cmd.terminal || 'new';
    byId('confirm').checked = !!cmd.confirm;
    byId('env').value = JSON.stringify(cmd.env || {}, null, 2);
    resetSteps(cmd.steps || [{ command: cmd.command || '', execute: cmd.execute !== false }]);
    clearErrors();
    setBusy(false);
  } else if (msg.type === 'saved') {
    setBusy(false);
    byId('context').textContent = contextLabel + ' · 编辑命令';
    hideSaved();
    byId('saved').hidden = false;
    savedTimer = setTimeout(() => { byId('saved').hidden = true; savedTimer = undefined; }, 2000);
  } else if (msg.type === 'error') {
    setBusy(false);
    showGlobalError(msg.message || '保存失败，请检查配置并重试。');
  }
});

vscode.postMessage({ type: 'ready' });
