'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CommandTreeProvider } = require('../src/tree');
const { setLocale } = require('../src/i18n');

test('tree selection edits, state overrides custom icons, and reveal resolves parents', async () => {
  setLocale('zh-cn');
  const scope = { id: 'global', type: 'global', label: '全局命令' };
  const cfg = {
    groups: [
      {
        id: 'g',
        title: 'Build',
        commands: [{ id: 'a', title: 'A', icon: 'rocket', command: 'echo a' }],
      },
    ],
  };
  const vscode = {
    EventEmitter: class {
      constructor() {
        this.event = () => {};
      }
      fire() {}
      dispose() {}
    },
    TreeItem: class {
      constructor(label) {
        this.label = label;
      }
    },
    ThemeIcon: class {
      constructor(id) {
        this.id = id;
      }
    },
    TreeItemCollapsibleState: { Expanded: 1, None: 0 },
  };
  let status = { monitored: true, busy: true };
  const tree = new CommandTreeProvider(
    vscode,
    { scopes: () => [scope], read: async () => cfg },
    { status: () => status },
  );
  const root = (await tree.getChildren())[0];
  const group = (await tree.getChildren(root))[0];
  let item = (await tree.getChildren(group))[0];
  assert.equal(item.command.command, 'quickCmd.selectCommand');
  assert.equal(item.iconPath.id, 'loading~spin');
  assert.equal(item.description, '运行中');
  assert.equal((await tree.getParent(item)).groupId, 'g');
  assert.equal((await tree.getParent(group)).scope.id, 'global');
  status = { monitored: true, busy: false, exitCode: 2 };
  item = (await tree.getChildren(group))[0];
  assert.equal(item.iconPath.id, 'error');
  assert.equal(item.description, '执行失败 · 退出码 2');
  status = { monitored: false, busy: true };
  item = (await tree.getChildren(group))[0];
  assert.equal(item.description, '已发送 · 状态未知');
  setLocale('en');
});
