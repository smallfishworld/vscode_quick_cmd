'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ConfigStore } = require('../src/store');
const { addGroup } = require('../src/model');
const { diskApi } = require('./helpers/disk-fs');
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-cmd-concurrency-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = { globalStorageUri: { fsPath: directory }, extensionPath: path.join(__dirname, '..'),
    globalState: { get() { throw Error('Legacy cache read'); }, update() { throw Error('Legacy cache write'); } } };
  return { directory, context, store: new ConfigStore(diskApi(), context) };
}
function child(script, directory) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['-e', script, require.resolve('../src/store'),
      require.resolve('../src/model'), require.resolve('./helpers/disk-fs'), directory, path.join(__dirname, '..')]);
    let stderr = '';
    proc.stderr.on('data', chunk => { stderr += chunk; });
    proc.on('error', reject);
    proc.on('exit', code => code === 0 ? resolve() : reject(Error(stderr || 'child failed: ' + code)));
  });
}
const setup = `
  const { ConfigStore } = require(process.argv[1]);
  const { addGroup } = require(process.argv[2]);
  const { diskApi } = require(process.argv[3]);
  const store = new ConfigStore(diskApi(), { globalStorageUri: { fsPath: process.argv[4] }, extensionPath: process.argv[5] });
`;

test('independent instances preserve concurrent updates to the same JSON file', async t => {
  const f = fixture(t);
  const stores = Array.from({ length: 5 }, () => new ConfigStore(diskApi(), f.context));
  await Promise.all(Array.from({ length: 20 }, (_, i) => stores[i % stores.length].update(undefined, async cfg => {
    await new Promise(resolve => setTimeout(resolve, 2));
    addGroup(cfg, 'Group ' + i);
  })));
  assert.equal((await f.store.read()).groups.length, 20);
  assert.deepEqual(fs.readdirSync(f.store.coordinationUri.fsPath), []);
});

test('independent extension host processes serialize JSON updates', async t => {
  const f = fixture(t);
  await Promise.all(Array.from({ length: 4 }, () => child(setup + `
    (async () => { for (let i=0;i<6;i++) await store.update(undefined, async cfg => {
      await new Promise(resolve => setTimeout(resolve, 3));
      addGroup(cfg, process.pid + ':' + i);
    }); })().catch(e => { console.error(e); process.exitCode=1; });
  `, f.directory)));
  const groups = (await f.store.read()).groups;
  assert.equal(groups.length, 24);
  assert.equal(new Set(groups.map(g => g.title)).size, 24);
});

test('concurrent first activation seeds defaults once without overwriting edits', async t => {
  const f = fixture(t);
  await Promise.all(Array.from({ length: 4 }, () => child(setup + `
    (async () => {
      await store.initializeDefaults('en');
      await store.update(undefined, cfg => addGroup(cfg, 'Host ' + process.pid));
    })().catch(e => { console.error(e); process.exitCode=1; });
  `, f.directory)));
  const cfg = await f.store.read();
  assert.equal(cfg.groups.length, 10);
  assert.equal(cfg.groups.reduce((n, g) => n + g.commands.length, 0), 43);
});

test('a crashed writer does not leave a permanent lock', async t => {
  const f = fixture(t);
  await child(setup + `store.exclusive(() => process.exit(0)).catch(() => process.exit(1));`, f.directory);
  await f.store.update(undefined, cfg => addGroup(cfg, 'After crash'));
  assert.equal((await f.store.read()).groups[0].title, 'After crash');
  assert.deepEqual(fs.readdirSync(f.store.coordinationUri.fsPath), []);
});
