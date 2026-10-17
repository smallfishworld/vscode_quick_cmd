'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Marketplace category names must match the VS Code extension manifest enum.
// https://code.visualstudio.com/api/references/extension-manifest
const SUPPORTED_CATEGORIES = new Set([
  'Programming Languages', 'Snippets', 'Linters', 'Themes', 'Debuggers',
  'Formatters', 'Keymaps', 'SCM Providers', 'Other', 'Extension Packs',
  'Language Packs', 'Data Science', 'Machine Learning', 'Visualization',
  'Notebooks', 'Education', 'Testing',
]);

function validateCategories(categories) {
  if (categories === undefined) return;
  if (!Array.isArray(categories) ||
      categories.some(category => typeof category !== 'string' ||
        !SUPPORTED_CATEGORIES.has(category))) {
    throw new Error('Unsupported VS Code Marketplace category: ' +
      JSON.stringify(categories));
  }
}

/**
 * Build one VSIX with both English and Chinese localizations. Staging is
 * isolated so neither the source manifest nor translated catalogs are changed.
 */
function stageExtension(root, buildRoot) {
  const stage = path.join(buildRoot, 'unified');
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  for (const name of ['src', 'media', 'presets', 'LICENSE', 'RELEASE_NOTES.md']) {
    fs.cpSync(path.join(root, name), path.join(stage, name), { recursive: true });
  }
  const icons = path.join(stage, 'media', 'codicons');
  fs.mkdirSync(icons, { recursive: true });
  for (const name of ['codicon.css', 'codicon.ttf']) {
    fs.copyFileSync(
      path.join(root, 'node_modules', '@vscode', 'codicons', 'dist', name),
      path.join(icons, name),
    );
  }
  fs.copyFileSync(
    path.join(root, 'node_modules', '@vscode', 'codicons', 'LICENSE'),
    path.join(icons, 'LICENSE'),
  );
  for (const name of ['README.md', 'README.zh-CN.md',
    'package.nls.json', 'package.nls.zh-cn.json']) {
    fs.copyFileSync(path.join(root, name), path.join(stage, name));
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  validateCategories(manifest.categories);
  delete manifest.quickCmdBuildLanguage;
  manifest.files = [
    'src/**', 'media/**', 'presets/**', 'README*.md', 'LICENSE',
    'RELEASE_NOTES.md', 'package.nls*.json',
  ];
  delete manifest.scripts;
  delete manifest.devDependencies;
  fs.writeFileSync(
    path.join(stage, 'package.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  return stage;
}

function packageExtension(root) {
  const buildRoot = path.join(root, '.build');
  const dist = path.join(root, 'dist');
  // Never allow installers from a previous version or language variant to leak
  // into CI artifacts or GitHub releases.
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const vsce = path.join(root, 'node_modules', '@vscode', 'vsce', 'vsce');
  const stage = stageExtension(root, buildRoot);
  const output = path.join(dist, `quick-cmd-v${version}.vsix`);
  const result = spawnSync(
    process.execPath,
    [vsce, 'package', '--no-dependencies', '--out', output],
    { cwd: stage, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Packaging failed (${result.status}).`);
}
if (require.main === module) {
  packageExtension(path.resolve(__dirname, '..'));
}
module.exports = { stageExtension, packageExtension, validateCategories };
