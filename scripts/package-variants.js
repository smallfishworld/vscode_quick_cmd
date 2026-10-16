'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const LANGUAGES = ['zh-cn', 'en'];
const VARIANTS = [...LANGUAGES, 'marketplace'];

/** Prepare isolated release trees; never rewrite the checked-out source manifest. */
function stageVariant(root, buildRoot, locale) {
  if (!VARIANTS.includes(locale)) {
    throw new Error('Unsupported package language: ' + locale);
  }
  const stage = path.join(buildRoot, locale);
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  for (const name of ['src', 'media', 'presets', 'LICENSE', 'RELEASE_NOTES.md']) {
    fs.cpSync(path.join(root, name), path.join(stage, name), {
      recursive: true,
    });
  }
  const icons = path.join(stage, 'media', 'codicons');
  fs.mkdirSync(icons, { recursive: true });
  for (const name of ['codicon.css', 'codicon.ttf']) { fs.copyFileSync(path.join(root, 'node_modules', '@vscode', 'codicons', 'dist', name), path.join(icons, name)); }
  fs.copyFileSync(path.join(root, 'node_modules', '@vscode', 'codicons', 'LICENSE'), path.join(icons, 'LICENSE'));
  const readme = locale === 'zh-cn' ? 'README.zh-CN.md' : 'README.md';
  // Include both linked READMEs, with the chosen language as the package landing page.
  fs.copyFileSync(path.join(root, readme), path.join(stage, 'README.md'));
  fs.copyFileSync(
    path.join(root, 'README.zh-CN.md'),
    path.join(stage, 'README.zh-CN.md'),
  );
  if (locale === 'zh-cn') {
    fs.copyFileSync(
      path.join(root, 'README.md'),
      path.join(stage, 'README.en.md'),
    );
    for (const name of ['README.md', 'README.zh-CN.md']) {
      const filename = path.join(stage, name);
      fs.writeFileSync(
        filename,
        fs
          .readFileSync(filename, 'utf8')
          .replaceAll('[English](README.md)', '[English](README.en.md)'),
      );
    }
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  );
  if (locale !== 'marketplace') {
    manifest.quickCmdBuildLanguage = locale;
    manifest.displayName =
      locale === 'zh-cn' ? 'Quick Cmd 中文版' : 'Quick Cmd English';
  } else {
    // One Marketplace package supports both UI locales under one extension identity.
    delete manifest.quickCmdBuildLanguage;
    manifest.displayName = 'Quick Cmd';
  }
  manifest.files = [
    'src/**',
    'media/**',
    'presets/**',
    'README*.md',
    'LICENSE',
    'RELEASE_NOTES.md',
    'package.nls*.json',
  ];
  delete manifest.scripts;
  delete manifest.devDependencies;
  fs.writeFileSync(
    path.join(stage, 'package.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  const messages =
    locale === 'zh-cn' ? 'package.nls.zh-cn.json' : 'package.nls.json';
  // A single default catalog prevents the host locale from overriding the selected edition.
  fs.copyFileSync(
    path.join(root, messages),
    path.join(stage, 'package.nls.json'),
  );
  if (locale === 'marketplace') {
    fs.copyFileSync(
      path.join(root, 'package.nls.zh-cn.json'),
      path.join(stage, 'package.nls.zh-cn.json'),
    );
  }
  return stage;
}
function packageVariants(root) {
  const buildRoot = path.join(root, '.build');
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const { version } = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  );
  const vsce = path.join(root, 'node_modules', '@vscode', 'vsce', 'vsce');
  for (const locale of VARIANTS) {
    const stage = stageVariant(root, buildRoot, locale);
    const output = path.join(dist, `quick-cmd-v${version}-${locale}.vsix`);
    const result = spawnSync(
      process.execPath,
      [vsce, 'package', '--no-dependencies', '--out', output],
      { cwd: stage, stdio: 'inherit' },
    );
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`Packaging ${locale} failed (${result.status}).`);
    }
  }
}
if (require.main === module) {
  packageVariants(path.resolve(__dirname, '..'));
}
module.exports = { stageVariant, packageVariants, LANGUAGES, VARIANTS };
