'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stageVariant } = require('../scripts/package-variants');
const { GroupDecorationProvider } = require('../src/group-decoration');
const root = path.resolve(__dirname, '..');

test('language packages pin host and editor language without changing source or extension identity', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-cmd-packages-'));
  const source = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  try {
    let identity;
    for (const locale of ['zh-cn', 'en']) {
      const stage = stageVariant(root, dir, locale);
      const manifest = JSON.parse(
        fs.readFileSync(path.join(stage, 'package.json'), 'utf8'),
      );
      const catalog = JSON.parse(
        fs.readFileSync(path.join(stage, 'package.nls.json'), 'utf8'),
      );
      assert.equal(manifest.quickCmdBuildLanguage, locale);
      assert.equal(manifest.devDependencies, undefined);
      assert.equal(
        catalog['quickCmd.commands'],
        locale === 'zh-cn' ? '分组' : 'Groups',
      );
      assert.equal(
        fs.existsSync(path.join(stage, 'package.nls.zh-cn.json')),
        false,
      );
      const i18n = require(path.join(stage, 'src/i18n'));
      i18n.setLocale(locale === 'en' ? 'zh-cn' : 'en');
      assert.equal(
        i18n.t('Save command'),
        locale === 'en' ? 'Save command' : '保存命令',
      );
      assert.equal(i18n.resolveLocale('opposite-host-locale'), locale);
      const current = manifest.publisher + '.' + manifest.name;
      if (identity) assert.equal(current, identity);
      identity = current;
      assert.equal(fs.existsSync(path.join(stage, 'test')), false);
      assert.equal(fs.existsSync(path.join(stage, 'agent.md')), false);
    }
    assert.equal(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
      source,
    );
    assert.throws(() => stageVariant(root, dir, '../wrong'), /Unsupported/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('group text decoration uses a theme token and cannot affect command resources', () => {
  const provider = new GroupDecorationProvider({
    ThemeColor: class {
      constructor(id) {
        this.id = id;
      }
    },
  });
  const decoration = provider.provideFileDecoration({
    scheme: 'quick-cmd-group',
  });
  assert.equal(decoration.color.id, 'quickCmd.groupForeground');
  assert.equal(decoration.propagate, false);
  assert.equal(provider.provideFileDecoration({ scheme: 'file' }), undefined);
});
