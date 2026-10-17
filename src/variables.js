'use strict';
const path = require('node:path');

function shellQuote(value, shell = 'posix') {
  const text = String(value);
  if (shell === 'powershell') { return `'${text.replaceAll("'", "''")}'`; }
  if (shell === 'cmd') {
    // cmd.exe expands percent-delimited variables even inside quotes; do not permit unsafe characters.
    if (/[\r\n%!"^&|<>]/.test(text)) {
      throw new Error('This value contains characters unsafe for cmd.exe interpolation. Use PowerShell instead.');
    }
    return `"${text}"`;
  }
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function extractInputs(...templates) {
  const result = new Set();
  for (const template of templates) {
    for (const match of String(template || '').matchAll(/\$\{input:([^}]+)\}/g)) {
      if (!/^[\w.-]{1,64}$/.test(match[1])) { throw new Error(`Invalid input name: ${match[1]}`); }
      result.add(match[1]);
    }
  }
  return [...result];
}

// This is deliberately a restricted lexer, not a shell parser. Quote an entire
// argument only when the template has not already changed its quoting context.
function checkInterpolationContext(template, shell = 'posix') {
  if (!/\$\{[^{}]+\}/.test(template)) return;
  const unsafe = () => { throw new Error('Place command variables outside quotes, escapes, comments, and shell expansions.'); };
  if (/\$\(|\$\[|\(\(|\[\[|`|<<|@['"]|--%/.test(template)) unsafe();
  let quote, escaped = false, comment = false;
  for (let i = 0; i < template.length; i++) {
    const ch = template[i];
    if (ch === '$' && template[i + 1] === '{') {
      const end = template.indexOf('}', i + 2);
      if (end !== -1) {
        if (quote || escaped || comment || template.slice(i + 2, end).includes('${')) unsafe();
        i = end;
        continue;
      }
    }
    if (escaped) { escaped = false; continue; }
    if (comment) { if (ch === '\n') comment = false; continue; }
    if ((shell === 'cmd' ? ch === '^' : ch === '\\' && shell !== 'powershell') && quote !== "'") {
      escaped = true;
      continue;
    }
    if (ch === '"' || (ch === "'" && shell !== 'cmd')) {
      if (quote === ch) quote = undefined;
      else if (!quote) quote = ch;
    } else if (!quote && ch === '#' && shell !== 'cmd') {
      comment = true;
    }
  }
}

/** Expand placeholders from a trusted whitelist; command values are always shell-quoted. */
function expand(template, ctx, quoted = true) {
  if (template === undefined || template === null) { return template; }
  if (quoted) checkInterpolationContext(String(template), ctx.shell);
  const file = ctx.file;
  const root = ctx.workspaceFolder;
  const fileValues = () => {
    if (!file) { throw new Error('Open a saved file to use ${file} variables.'); }
    return {
      file, fileBasename: path.basename(file), fileBasenameNoExtension: path.parse(file).name,
      fileDirname: path.dirname(file), relativeFile: root ? path.relative(root, file) : path.basename(file)
    };
  };
  return String(template).replace(/\$\{([^{}]+)\}/g, (_, name) => {
    let value;
    if (name === 'workspaceFolder') {
      if (!root) { throw new Error('${workspaceFolder} needs an open workspace.'); }
      value = root;
    } else if (['file', 'fileBasename', 'fileBasenameNoExtension', 'fileDirname', 'relativeFile'].includes(name)) {
      value = fileValues()[name];
    } else if (/^env:[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      const key = name.slice(4);
      if (!Object.hasOwn(ctx.env || process.env, key)) { throw new Error(`Environment variable ${key} is not set.`); }
      value = (ctx.env || process.env)[key];
    } else if (/^input:[\w.-]{1,64}$/.test(name)) {
      const key = name.slice(6);
      if (!Object.hasOwn(ctx.inputs || {}, key)) { throw new Error(`Input ${key} is missing.`); }
      value = ctx.inputs[key];
    } else {
      throw new Error(`Unknown variable: \${${name}}`);
    }
    return quoted ? shellQuote(value, ctx.shell) : String(value);
  });
}

function detectShell(vscode) {
  const config = vscode.workspace.getConfiguration?.('quickCmd');
  const preferred = config?.get('shellType', 'auto') || 'auto';
  if (preferred !== 'auto') { return preferred; }
  if (process.platform === 'win32') {
    const profile = vscode.workspace.getConfiguration('terminal.integrated')?.get('defaultProfile.windows', '') || '';
    return /cmd|command prompt/i.test(profile) ? 'cmd' : 'powershell';
  }
  return 'posix';
}
module.exports = { shellQuote, extractInputs, expand, detectShell };
