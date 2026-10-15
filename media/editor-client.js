'use strict';
const vscode = acquireVsCodeApi();
const { t, setLocale } = QuickCmdI18n;
setLocale(document.documentElement.lang);
const byId = (id) => document.getElementById(id);
const form = byId('form');
const stepsElement = byId('steps');
let readOnly = false;
let pendingEnvRows;
let token,
  revision = 0,
  baseline,
  busy = false,
  jsonMode = false,
  applying = false;
let savedTimer, undoSnapshot, dragging;
const paths = {
  more: 'M4 12h.01 M12 12h.01 M20 12h.01',
  reload: 'M20 7v5h-5 M20 12a8 8 0 1 0-2 5',
  terminal: 'M2 3h20v18H2z M6 8l4 4-4 4 M13 16h5',
  list: 'M8 6h12 M8 12h12 M8 18h12 M3 6h1 M3 12h1 M3 18h1',
  save: 'M4 3h14l3 3v15H3V3z M7 3v6h10V3 M7 21v-8h10v8',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  up: 'M5 14l7-7 7 7',
  down: 'M5 10l7 7 7-7',
  chevron: 'M6 9l6 6 6-6',
  add: 'M12 5v14 M5 12h14',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  check: 'M4 12l5 5L20 6',
  play: 'M7 4l14 8-14 8z',
  expand: 'M14 3h7v7 M21 3l-9 9 M10 3H3v18h18v-7',
  grip: 'M8 5h1 M15 5h1 M8 12h1 M15 12h1 M8 19h1 M15 19h1',
  tools: 'M14 4a5 5 0 0 0-6 6L3 17l4 4 7-7a5 5 0 0 0 6-6l-4 3-3-3 3-4z',
  beaker: 'M9 3h6 M10 3v7l-6 9v2h16v-2l-6-9V3 M8 14h8',
  rocket:
    'M8 15l-4 1 2-6 5-1 M9 15l-1 5 6-2 1-5 M8 12C10 5 15 3 21 3c0 6-2 11-9 13z M15 8h1',
  clear: 'M14 3l-4 8 M7 10l9 4-4 7H3l4-11z M7 15l-2 6 M11 17l-2 4',
};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(svg.namespaceURI, 'path');
  p.setAttribute('d', paths[name] || paths.terminal);
  svg.append(p);
  return svg;
}
for (const element of document.querySelectorAll('[data-i18n]'))
  element.textContent = t(element.dataset.i18n);
for (const element of document.querySelectorAll('[data-placeholder]'))
  element.placeholder = t(element.dataset.placeholder);
for (const element of document.querySelectorAll('[data-label]')) {
  element.title = t(element.dataset.label);
  element.setAttribute('aria-label', t(element.dataset.label));
}
for (const element of document.querySelectorAll('[data-icon]'))
  element.append(icon(element.dataset.icon));
function action(name, label, handler) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-button';
  b.title = t(label);
  b.setAttribute('aria-label', t(label));
  b.append(icon(name));
  b.addEventListener('click', handler);
  return b;
}
function raw() {
  const rows = [...stepsElement.children];
  return {
    title: byId('title').value,
    steps: rows.map((row, i) => {
      const step = {
        command: row.querySelector('.step-command').value,
        execute: i < rows.length - 1 || byId('trailingEnter').checked,
      };
      const name = row.querySelector('.step-name').value.trim();
      if (name) step.title = name;
      return step;
    }),
    cwd: byId('cwd').value,
    terminal: byId('terminal').value,
    confirm: byId('confirm').checked,
    description: byId('description').value,
    icon: byId('icon').value,
    envText: byId('env').value,
    ...(pendingEnvRows ? { envRows: pendingEnvRows } : {}),
  };
}
function dirty() {
  return baseline && JSON.stringify(raw()) !== JSON.stringify(baseline);
}
function setState(success = false) {
  const changed = dirty();
  const state = byId('saveState');
  state.className =
    'save-state' + (changed ? ' dirty' : success ? ' success' : '');
  state.replaceChildren();
  if (!changed && !busy) state.append(icon('check'));
  state.append(
    document.createTextNode(
      t(busy ? 'Saving…' : changed ? 'Unsaved changes' : 'Saved'),
    ),
  );
  byId('save').disabled = busy || !changed || readOnly;
  byId('saveRun').disabled = busy || readOnly;
  byId('editorFields').disabled = readOnly;
  byId('readOnlyHint').hidden = !readOnly;
  byId('enterHint').textContent = t(
    byId('trailingEnter').checked
      ? 'Trailing Enter will be sent.'
      : 'No trailing Enter will be sent.',
  );
  byId('terminalHint').hidden = byId('terminal').value !== 'active';
}
function changed() {
  if (applying || !token || readOnly) return;
  clearTimeout(savedTimer);
  setState();
  byId('error').hidden = true;
  const fields = raw();
  vscode.setState({ token, raw: fields, baseline, revision });
  vscode.postMessage({ type: 'draft', token, fields, baseRevision: revision });
  revision++;
}
function resize(input) {
  input.style.height = 'auto';
  input.style.height =
    Math.min(300, Math.max(38, input.scrollHeight + 2)) + 'px';
}
function renumber() {
  const rows = [...stepsElement.children];
  rows.forEach((row, i) => {
    row.classList.toggle('single', rows.length === 1);
    row.querySelector('.step-number').textContent = String(i + 1);
    row.querySelector('.step-name').placeholder = t('Step {0}', i + 1);
    row
      .querySelector('.step-command')
      .setAttribute(
        'aria-label',
        t('Step {0}', i + 1) + ' · ' + t('Command text'),
      );
    row.querySelector('.up-action').disabled = i === 0;
    row.querySelector('.down-action').disabled = i === rows.length - 1;
    row.querySelector('.delete-action').disabled = rows.length === 1;
  });
  byId('stepCount').textContent = t('{0} steps', rows.length);
  byId('addStep').disabled = rows.length >= 32;
  byId('addStep').title =
    rows.length >= 32 ? t('Maximum 32 steps.') : t('Add step');
}
function move(row, direction) {
  if (direction < 0 && row.previousElementSibling)
    stepsElement.insertBefore(row, row.previousElementSibling);
  if (direction > 0 && row.nextElementSibling)
    stepsElement.insertBefore(row.nextElementSibling, row);
  renumber();
  changed();
}
function makeStep(step = { command: '' }, focus = false) {
  const row = document.createElement('div');
  row.className = 'step-card';
  const head = document.createElement('div');
  head.className = 'step-head';
  const handle = action('grip', 'Drag to reorder', () => {});
  handle.classList.add('drag-handle');
  handle.draggable = true;
  handle.addEventListener('dragstart', (e) => {
    dragging = row;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'quick-cmd-step');
  });
  handle.addEventListener('dragend', () => {
    dragging = undefined;
    for (const r of stepsElement.children) r.classList.remove('drag-over');
  });
  row.addEventListener('dragover', (e) => {
    if (dragging && dragging !== row) {
      e.preventDefault();
      row.classList.add('drag-over');
    }
  });
  row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
  row.addEventListener('drop', (e) => {
    if (!dragging || dragging === row) return;
    e.preventDefault();
    const after =
      e.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
    stepsElement.insertBefore(dragging, after ? row.nextSibling : row);
    dragging = undefined;
    row.classList.remove('drag-over');
    renumber();
    changed();
  });
  const number = document.createElement('span');
  number.className = 'step-number';
  number.setAttribute('aria-hidden', 'true');
  const name = document.createElement('input');
  name.className = 'step-name';
  name.maxLength = 64;
  name.value = step.title || '';
  name.setAttribute('aria-label', t('Step name (optional)'));
  const preview = document.createElement('span');
  preview.className = 'step-preview';
  preview.textContent =
    step.title || step.command.split('\n')[0] || t('Command text');
  const command = document.createElement('textarea');
  command.className = 'step-command';
  command.rows = 1;
  command.spellcheck = false;
  command.maxLength = 8192;
  command.value = step.command;
  command.placeholder = 'cmake --build build -j8';
  command.addEventListener('input', () => {
    resize(command);
    preview.textContent =
      name.value || command.value.split('\n')[0] || t('Command text');
  });
  name.addEventListener('input', () => {
    preview.textContent = name.value || command.value.split('\n')[0];
  });
  const collapse = action('chevron', 'Collapse step', () => {
    const collapsed = row.classList.toggle('collapsed');
    command.hidden = collapsed;
    collapse.setAttribute('aria-expanded', String(!collapsed));
    collapse.title = t(collapsed ? 'Expand step' : 'Collapse step');
    collapse.setAttribute('aria-label', collapse.title);
  });
  collapse.classList.add('collapse-action');
  collapse.setAttribute('aria-expanded', 'true');
  const actions = document.createElement('div');
  actions.className = 'step-actions';
  const up = action('up', 'Move up', () => move(row, -1));
  up.classList.add('up-action');
  const down = action('down', 'Move down', () => move(row, 1));
  down.classList.add('down-action');
  const remove = action('trash', 'Delete step', () => {
    if (stepsElement.children.length <= 1) return;
    undoSnapshot = {
      steps: raw().steps,
      index: [...stepsElement.children].indexOf(row),
    };
    const next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    renumber();
    byId('stepUndo').hidden = false;
    changed();
    next.querySelector('.step-command').focus();
  });
  remove.classList.add('delete-action', 'danger');
  actions.append(up, down, remove);
  const more = action('more', 'More actions', () => {
    const open = row.classList.toggle('menu-open');
    more.setAttribute('aria-expanded', String(open));
  });
  more.classList.add('step-more');
  more.setAttribute('aria-expanded', 'false');
  head.append(handle, number, collapse, name, preview, more, actions);
  const error = document.createElement('p');
  error.className = 'field-error step-error';
  error.setAttribute('role', 'alert');
  error.hidden = true;
  row.append(head, command, error);
  stepsElement.append(row);
  command.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      move(row, e.key === 'ArrowUp' ? -1 : 1);
    }
  });
  const variables = document.createElement('select');
  variables.className = 'step-variables';
  variables.setAttribute('aria-label', t('Insert variable'));
  for (const [value, label] of [
    ['', 'Insert variable'],
    ['${workspaceFolder}', 'Workspace folder'],
    ['${file}', 'Current file'],
    ['${fileDirname}', 'Current file directory'],
    ['${fileBasename}', 'File name'],
    ['${fileBasenameNoExtension}', 'File name without extension'],
    ['${relativeFile}', 'Relative file path'],
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = t(label);
    variables.append(option);
  }
  variables.addEventListener('change', () => {
    if (!variables.value) return;
    command.setRangeText(
      variables.value,
      command.selectionStart,
      command.selectionEnd,
      'end',
    );
    variables.value = '';
    resize(command);
    changed();
    command.focus();
  });
  const insert = action('add', 'Insert variable', () => {
    variables.hidden = !variables.hidden;
    variables.focus();
  });
  variables.hidden = true;
  actions.prepend(insert);
  row.append(variables);
  if (focus) command.focus();
  requestAnimationFrame(() => resize(command));
  return row;
}
function renderSteps(steps) {
  stepsElement.replaceChildren();
  for (const step of steps) makeStep(step);
  renumber();
}
function renderEnv() {
  byId('envTable').replaceChildren();
  if (pendingEnvRows) {
    for (const [name, value] of pendingEnvRows) {
      envRow(name, value);
    }
    jsonMode = false;
    return;
  }
  let values;
  try {
    values = JSON.parse(byId('env').value || '{}');
    if (
      !values ||
      typeof values !== 'object' ||
      Array.isArray(values) ||
      Object.values(values).some((value) => typeof value !== 'string')
    ) {
      throw Error();
    }
  } catch {
    jsonMode = true;
    envMode();
    return;
  }
  for (const [name, value] of Object.entries(values)) {
    envRow(name, value);
  }
}
function envRow(name = '', value = '') {
  const row = document.createElement('div');
  row.className = 'env-row';
  for (const [v, label] of [
    [name, 'Name'],
    [value, 'Value'],
  ]) {
    const input = document.createElement('input');
    input.value = v;
    input.placeholder = t(label);
    input.setAttribute('aria-label', t(label));
    input.maxLength = label === 'Value' ? 2048 : 128;
    row.append(input);
  }
  const remove = action('trash', 'Remove variable', () => {
    row.remove();
    syncEnv();
    changed();
  });
  row.append(remove);
  byId('envTable').append(row);
  return row;
}
function syncEnv() {
  if (jsonMode) return;
  const env = {};
  let invalid = false;
  for (const row of byId('envTable').children) {
    const [key, value] = row.querySelectorAll('input');
    if (!key.value && !value.value) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key.value)) {
      invalid = true;
      continue;
    }
    if (Object.hasOwn(env, key.value)) {
      invalid = true;
      continue;
    }
    Object.defineProperty(env, key.value, {
      value: value.value,
      enumerable: true,
    });
  }
  pendingEnvRows = invalid
    ? [...byId('envTable').children].map((row) =>
        [...row.querySelectorAll('input')].map((input) => input.value),
      )
    : undefined;
  byId('env').value = JSON.stringify(env, null, 2);
}
function envMode() {
  byId('env').hidden = !jsonMode;
  byId('envTable').hidden = jsonMode;
  byId('addEnv').hidden = jsonMode;
  byId('envMode').textContent = t(jsonMode ? 'Edit as table' : 'Edit as JSON');
}
function render(rawValue) {
  applying = true;
  pendingEnvRows = rawValue.envRows;
  for (const key of ['title', 'cwd', 'description', 'icon'])
    byId(key).value = rawValue[key] || '';
  byId('terminal').value = rawValue.terminal || 'new';
  byId('confirm').checked = !!rawValue.confirm;
  byId('env').value = rawValue.envText || '{}';
  const steps = rawValue.steps || [{ command: '' }];
  byId('trailingEnter').checked = steps.at(-1)?.execute !== false;
  renderSteps(steps);
  renderEnv();
  envMode();
  updateIcons();
  byId('stepUndo').hidden = true;
  undoSnapshot = undefined;
  clearErrors();
  applying = false;
  setState();
}
function clearErrors() {
  for (const error of document.querySelectorAll('.field-error'))
    error.hidden = true;
  for (const input of document.querySelectorAll('.is-invalid')) {
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  }
}
function fieldError(input, error, text) {
  error.textContent = text;
  error.hidden = false;
  input.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');
  if (byId('advanced').contains(input)) byId('advanced').open = true;
  input.focus();
}
function validate() {
  clearErrors();
  const data = raw();
  if (!data.title.trim() || data.title.length > 128) {
    fieldError(
      byId('title'),
      byId('titleError'),
      t('Enter a command name (up to 128 characters).'),
    );
    return false;
  }
  let total = 0;
  for (const [i, step] of data.steps.entries()) {
    total += step.command.length;
    if (!step.command.trim()) {
      const row = stepsElement.children[i];
      row.classList.remove('collapsed');
      row.querySelector('.step-command').hidden = false;
      fieldError(
        row.querySelector('.step-command'),
        row.querySelector('.step-error'),
        t('Enter command text for step {0}.', i + 1),
      );
      return false;
    }
  }
  if (total > 32768) {
    fieldError(
      stepsElement.querySelector('.step-command'),
      byId('stepsError'),
      t('Combined command text cannot exceed 32768 characters.'),
    );
    return false;
  }
  if (data.icon && !/^[a-z][a-z0-9-]*$/.test(data.icon)) {
    fieldError(
      byId('icon'),
      byId('iconError'),
      t('Choose a valid command icon.'),
    );
    return false;
  }
  try {
    const env = JSON.parse(data.envText || '{}');
    if (!env || typeof env !== 'object' || Array.isArray(env))
      throw Error(
        'Environment variables must be a JSON object of string values.',
      );
    if (pendingEnvRows)
      throw Error(
        'Enter a valid environment variable name and a string value.',
      );
    for (const [key, value] of Object.entries(env))
      if (
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
        typeof value !== 'string' ||
        value.length > 2048
      )
        throw Error(
          'Enter a valid environment variable name and a string value.',
        );
    if (
      data.terminal === 'active' &&
      (data.cwd.trim() || Object.keys(env).length)
    ) {
      byId('error').textContent = t(
        'The active terminal cannot apply command-specific cwd or env. Use new or reuse mode.',
      );
      byId('error').hidden = false;
      byId('terminal').focus();
      return false;
    }
  } catch (e) {
    fieldError(
      jsonMode
        ? byId('env')
        : byId('envTable').querySelector('input') || byId('envMode'),
      byId('envError'),
      t(
        e instanceof SyntaxError
          ? 'Invalid environment variable JSON.'
          : e.message,
      ),
    );
    return false;
  }
  return true;
}
function save(run = false) {
  if (readOnly || busy || !validate()) return;
  busy = true;
  setState();
  vscode.postMessage({
    type: 'save',
    token,
    revision,
    groupId: form.dataset.groupId,
    fields: raw(),
    run,
  });
}
const iconOptions = [
  ['', 'terminal', 'Terminal'],
  ['tools', 'tools', 'Build'],
  ['play', 'play', 'Start'],
  ['beaker', 'beaker', 'Test'],
  ['rocket', 'rocket', 'Deploy'],
  ['clear-all', 'clear', 'Clean'],
  ['list-ordered', 'list', 'Steps'],
];
for (const [value, symbol, label] of iconOptions) {
  const b = action(symbol, label, () => {
    byId('icon').value = value;
    updateIcons();
    changed();
  });
  b.className = 'icon-choice';
  b.dataset.value = value;
  byId('iconPicker').append(b);
}
function updateIcons() {
  for (const b of byId('iconPicker').children)
    b.setAttribute(
      'aria-pressed',
      String(b.dataset.value === byId('icon').value),
    );
}
byId('new').addEventListener('click', () =>
  vscode.postMessage({ type: 'new' }),
);
byId('reopen').addEventListener('click', () =>
  vscode.postMessage({ type: 'reopen', token }),
);
byId('expand').addEventListener('click', () =>
  vscode.postMessage({ type: 'expand' }),
);
byId('addStep').addEventListener('click', () => {
  if (stepsElement.children.length >= 32) return;
  makeStep(undefined, true);
  renumber();
  changed();
});
byId('undo').addEventListener('click', () => {
  if (!undoSnapshot || stepsElement.children.length >= 32) return;
  // Reinsert the deleted step only, preserving any edits made after deletion.
  const step = undoSnapshot.steps[undoSnapshot.index];
  const row = makeStep(step);
  const target = stepsElement.children[undoSnapshot.index];
  if (target !== row) stepsElement.insertBefore(row, target);
  undoSnapshot = undefined;
  byId('stepUndo').hidden = true;
  renumber();
  changed();
  row.querySelector('.step-command').focus();
});
byId('addEnv').addEventListener('click', () => {
  envRow().querySelector('input').focus();
});
byId('envMode').addEventListener('click', () => {
  if (!jsonMode) {
    syncEnv();
    if (pendingEnvRows) {
      fieldError(
        byId('envTable').querySelector('input'),
        byId('envError'),
        t('Enter a valid environment variable name and a string value.'),
      );
      return;
    }
    jsonMode = true;
  } else {
    jsonMode = false;
    renderEnv();
  }
  envMode();
  changed();
});
for (const chip of document.querySelectorAll('[data-cwd]'))
  chip.addEventListener('click', () => {
    const input = byId('cwd');
    input.setRangeText(
      chip.dataset.cwd,
      input.selectionStart,
      input.selectionEnd,
      'end',
    );
    changed();
    input.focus();
  });
form.addEventListener('input', (event) => {
  const field = event.target.closest('.field, .step-card');
  if (field) {
    for (const error of field.querySelectorAll('.field-error')) {
      error.hidden = true;
    }
    for (const input of field.querySelectorAll('.is-invalid')) {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
    }
  }
  if (event.target.closest('#envTable')) syncEnv();
  if (event.target.id === 'icon') updateIcons();
  changed();
});
form.addEventListener('change', (event) => {
  if (event.target.tagName === 'SELECT' || event.target.type === 'checkbox')
    changed();
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  save();
});
byId('saveRun').addEventListener('click', () => save(true));
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (!form.hidden) save();
  }
});
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'empty') {
    form.hidden = true;
    byId('empty').hidden = false;
    token = undefined;
    return;
  }
  if (msg.type === 'readOnly') {
    readOnly = !!msg.value;
    setState();
    return;
  }
  if (msg.type === 'load') {
    readOnly = !!msg.readOnly;
    token = msg.token;
    revision = msg.revision || 0;
    baseline = msg.baseline;
    form.dataset.groupId = msg.groupId;
    byId('context').textContent =
      msg.groupTitle + ' · ' + t(msg.isEdit ? 'Edit command' : 'New command');
    form.hidden = false;
    byId('empty').hidden = true;
    busy = false;
    render(msg.raw || msg.command);
    return;
  }
  if (msg.token !== token) return;
  if (msg.type === 'revision') {
    revision = Math.max(revision, msg.revision);
  }
  if (msg.type === 'draft') {
    revision = msg.revision;
    baseline = msg.baseline;
    render(msg.raw);
  }
  if (msg.type === 'saved') {
    busy = false;
    baseline = msg.baseline;
    form.dataset.groupId = msg.groupId || form.dataset.groupId;
    setState(true);
    vscode.setState({ token, raw: raw(), baseline, revision });
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => setState(), 2000);
  }
  if (msg.type === 'error') {
    busy = false;
    setState();
    byId('error').textContent =
      msg.message || t('Save failed. Your changes have been retained.');
    byId('error').hidden = false;
  }
});
vscode.postMessage({ type: 'ready' });
