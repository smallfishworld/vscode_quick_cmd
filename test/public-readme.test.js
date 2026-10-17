'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// VSCE packages README.md as the public Marketplace extension overview.
for (const [name, internalSections, licenseHeading] of [
  ['README.md', ['Development', 'Marketplace publishing'], 'License'],
  ['README.zh-CN.md', ['开发与验证', 'VS Code Marketplace 发布'], '协议'],
]) {
  test(`${name} only exposes user-facing instructions`, () => {
    const text = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
    assert.match(text, /presets\/defaults/);
    assert.match(text, /presets\/git/);
    assert.match(text, /LICENSE/);
    assert.ok(text.includes(`## ${licenseHeading}`));
    for (const title of internalSections) {
      assert.ok(!text.includes(`## ${title}`), `Public section still contains ${title}`);
    }
    for (const privateConfig of [
      'VSCE_PAT', 'MARKETPLACE_PUBLISH_ENABLED', 'npm ci',
      'scripts/verify-packages.py', 'trusted-publishing',
    ]) {
      assert.ok(!text.includes(privateConfig), `Maintainer config leaked into ${name}: ${privateConfig}`);
    }
    assert.match(text.trimEnd(), /LICENSE\]\(LICENSE\)\.?$/);
  });
}
