'use strict';
const vscode = acquireVsCodeApi();
const byId = id => document.getElementById(id);
const stepsElement = byId('steps');
let busy = false;

function showError(message) { byId('error').textContent = message || ''; }
function resetSteps(steps) {
  stepsElement.replaceChildren();
  for (const step of steps) { addStep(step); }
  if (!steps.length) { addStep({ command: '', execute: true }); }
}
function addStep(step = { command: '', execute: true }) {
  const row = document.createElement('div');
  row.className = 'step-row';
  const header = document.createElement('div'); header.className = 'step-header';
  const label = document.createElement('strong'); label.className = 'step-label';
  const remove = document.createElement('button');
  remove.type = 'button'; remove.textContent = 'Remove'; remove.className = 'secondary';
  remove.addEventListener('click', () => { if (stepsElement.children.length > 1) { row.remove(); renumber(); } });
  header.append(label, remove);
  const input = document.createElement('textarea');
  input.className = 'step-command'; input.placeholder = 'echo hello'; input.spellcheck = false;
  input.maxLength = 8192; input.value = step.command || '';
  const footer = document.createElement('div'); footer.className = 'step-footer';
  const checkLabel = document.createElement('label');
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
  checkbox.className = 'step-execute'; checkbox.checked = step.execute !== false;
  checkLabel.append(checkbox, document.createTextNode('换行执行'));
  footer.append(checkLabel);
  row.append(header, input, footer);
  stepsElement.append(row);
  renumber();
  input.focus();
}
function renumber() {
  [...stepsElement.children].forEach((row, index) => {
    row.querySelector('.step-label').textContent = 'Step ' + (index + 1);
    row.querySelector('button').disabled = stepsElement.children.length === 1;
  });
}
function formValues() {
  const title = byId('title').value.trim();
  if (!title) { throw new Error('Command name cannot be blank.'); }
  const steps = [...stepsElement.children].map(row => ({
    command: row.querySelector('textarea').value,
    execute: row.querySelector('input[type=checkbox]').checked
  }));
  if (steps.some(step => !step.command.trim())) { throw new Error('Command steps cannot be blank.'); }
  if (steps.some((step, i) => i !== steps.length - 1 && !step.execute)) {
    throw new Error('Only the last step can disable newline execution.');
  }
  const env = JSON.parse(byId('env').value.trim() || '{}');
  if (!env || typeof env !== 'object' || Array.isArray(env)) { throw new Error('Environment must be a JSON object.'); }
  const fields = { title, steps, terminal: byId('terminal').value, confirm: byId('confirm').checked };
  for (const id of ['cwd', 'description', 'icon']) {
    const value = byId(id).value.trim(); if (value) { fields[id] = value; }
  }
  if (Object.keys(env).length) { fields.env = env; }
  return fields;
}
byId('addStep').addEventListener('click', () => {
  if (stepsElement.children.length >= 32) { showError('Maximum 32 steps per command.'); return; }
  addStep();
});
byId('form').addEventListener('submit', event => {
  event.preventDefault(); if (busy) { return; }
  try {
    showError('');
    const fields = formValues();
    busy = true; byId('save').disabled = true;
    vscode.postMessage({ type: 'save', fields, groupId: byId('form').dataset.groupId });
  } catch (error) { showError(error.message); }
});
window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'empty') { byId('form').hidden = true; byId('empty').hidden = false; }
  if (msg.type === 'load') {
    byId('form').dataset.groupId = msg.groupId;
    byId('empty').hidden = true; byId('form').hidden = false;
    byId('context').textContent = msg.scopeLabel + ' / ' + msg.groupTitle + (msg.isEdit ? ' · Edit' : ' · New');
    const cmd = msg.command || {};
    for (const field of ['title', 'cwd', 'description', 'icon']) { byId(field).value = cmd[field] || ''; }
    byId('terminal').value = cmd.terminal || 'new';
    byId('confirm').checked = !!cmd.confirm;
    byId('env').value = JSON.stringify(cmd.env || {}, null, 2);
    resetSteps(cmd.steps || [{ command: cmd.command || '', execute: cmd.execute !== false }]);
    showError(''); byId('saved').textContent = ''; busy = false; byId('save').disabled = false;
  }
  if (msg.type === 'saved') { busy = false; byId('save').disabled = false; byId('saved').textContent = 'Saved'; }
  if (msg.type === 'error') { busy = false; byId('save').disabled = false; showError(msg.message); }
});
vscode.postMessage({ type: 'ready' });
