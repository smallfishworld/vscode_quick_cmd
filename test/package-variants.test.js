'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stageExtension, validateCategories } = require('../scripts/package-variants');
const root = path.resolve(__dirname, '..');

test('one installer has both languages, preserves the extension ID and does not modify source', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-cmd-package-'));
  const source = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  try {
    const stage = stageExtension(root, dir);
    assert.equal(path.basename(stage), 'unified');
    const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'package.json'), 'utf8'));
    const en = JSON.parse(fs.readFileSync(path.join(stage, 'package.nls.json'), 'utf8'));
    const zh = JSON.parse(fs.readFileSync(path.join(stage, 'package.nls.zh-cn.json'), 'utf8'));
    assert.equal(manifest.publisher + '.' + manifest.name, 'smallfishworld.vscode-quick-cmd');
    assert.equal(manifest.quickCmdBuildLanguage, undefined);
    assert.deepEqual(manifest.categories, ['Other']);
    assert.doesNotThrow(() => validateCategories(manifest.categories));
    assert.equal(manifest.devDependencies, undefined);
    assert.equal(en['quickCmd.commands'], 'Groups');
    assert.equal(zh['quickCmd.commands'], '分组');
    assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
    assert.ok(fs.statSync(path.join(stage, 'media/codicons/codicon.ttf')).size > 0);
    assert.ok(fs.existsSync(path.join(stage, 'presets/defaults.zh-CN.json')));
    assert.ok(fs.existsSync(path.join(stage, 'presets/defaults.en.json')));
    assert.equal(manifest.contributes.views.quickCmd[0].type, 'webview');
    const contextMenus = manifest.contributes.menus['webview/context'];
    assert.equal(contextMenus.length, 13);
    assert.ok(contextMenus.every(item =>
      item.when.includes("webviewId == 'quickCmd.commands'") &&
      item.when.includes('webviewSection')));
    assert.ok(!manifest.contributes.commands.some(cmd => cmd.command === 'quickCmd.showEditor'));
    assert.equal(
      manifest.contributes.commands.find(cmd => cmd.command === 'quickCmd.importConfig').icon,
      '$(arrow-down)',
    );

    const i18n = require(path.join(stage, 'src/i18n'));
    const samples = [
      { locale: 'zh-cn', expected: '保存命令' },
      { locale: 'zh-CN', expected: '保存命令' },
      { locale: 'en', expected: 'Save command' },
      { locale: 'fr', expected: 'Save command' },
    ];
    for (const { locale, expected } of samples) {
      i18n.setLocale(locale);
      assert.equal(i18n.resolveLocale(locale), locale);
      assert.equal(i18n.t('Save command'), expected);
    }
    assert.equal(fs.existsSync(path.join(stage, 'test')), false);
    assert.equal(fs.existsSync(path.join(stage, 'agent.md')), false);
    assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), source);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Marketplace rejects unsupported category names even when the VSIX built.
test('reject invalid Marketplace categories before packaging', () => {
  assert.doesNotThrow(() => validateCategories(['Other']));
  assert.throws(() => validateCategories(['Other', 'Productivity']), /Unsupported VS Code Marketplace category/);
  assert.throws(() => validateCategories(['Productivity']), /Unsupported VS Code Marketplace category/);
});
