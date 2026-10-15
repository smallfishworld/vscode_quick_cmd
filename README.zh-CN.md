# Command Deck

简体中文 | [English](README.md)

**Command Deck** 是一个轻量级 VS Code 扩展：在左侧 Activity Bar 中管理自定义 Shell 命令，点击即可发送至 VS Code 内置终端。

## v0.1.0 已实现范围

- 原生侧边栏 Tree View，命令分组、说明、折叠。
- 图形化新建/编辑/删除命令；新建/重命名/删除分组；启用/禁用命令；上移/下移排序。
- 全局命令存储于用户设置 JSON，项目命令存储于 `.vscode/command-deck.json`。
- JSON 修改自动刷新；项目文件使用 Schema 校验提示。
- 每条命令独立复用终端，或每次新建终端。
- 自定义工作目录、执行前确认、禁用命令、多根工作区。
- 路径及环境变量替换；不受信任工作区禁止执行。

## 安装与开发

要求 VS Code 1.90+，开发构建使用 Node.js 20+。

```bash
npm install
npm test
npm run package
```

生成 `.vsix` 后在 VS Code 的“扩展 → … → 从 VSIX 安装”中安装。也可先 `npm run build`，再在本项目按 **F5** 启动扩展开发宿主。GitHub Actions 会在推送代码后打包 VSIX Artifact。

## 使用方法

1. 点击左侧 **Command Deck** 图标。
2. 点击 **Add Group**，选择全局命令或项目，添加分组。
3. 点击 **Add Command**，选择分组，填写名称、命令、描述、工作目录、终端策略等。
4. 单击命令即在内置终端执行。
5. 右键菜单可以编辑、删除、调整顺序、打开 JSON。

项目 JSON 示例位于 [`examples/.vscode/command-deck.json`](examples/.vscode/command-deck.json)，复制到你的工程下 `.vscode/command-deck.json` 即可。项目 JSON 格式：

```json
{
  "version": 1,
  "groups": [
    {
      "id": "build",
      "name": "构建",
      "commands": [
        {
          "id": "cmake-build",
          "name": "编译",
          "command": "cmake --build build -j8",
          "cwd": "${workspaceFolder}",
          "terminal": "reuse",
          "confirm": false,
          "enabled": true
        }
      ]
    }
  ]
}
```

全局命令使用 **用户 Settings JSON** 的 `commandDeck.globalGroups` 属性，属性值直接是 `groups` 数组。两种配置都能由图形界面修改，也可以直接编辑 JSON。配置中的 `id` 应在所属作用域唯一。

### 支持的变量

`${workspaceFolder}`、`${workspaceFolderBasename}`、`${file}`、`${fileBasename}`、`${fileBasenameNoExtension}`、`${fileDirname}`、`${relativeFile}`、`${env:NAME}`。

未知 `${...}` 表达式保持原样，以兼容 Shell 自身的变量展开。路径和变量按文本直接替换，**需要自行加引号处理空格和特殊字符**，如 `cat "${file}"`。缺少所需变量时提示错误。

### 终端执行细节

- `reuse`（默认）：每条命令有自己的终端。`cwd` 只在终端创建时生效；若在终端内手动 `cd`，再次运行时沿用新的当前目录。
- `new`：每次新建终端并应用工作目录。
- 远程 SSH 使用工作区扩展宿主的执行环境，命令在远程终端中运行。
- VS Code `Terminal.sendText()` **无法可靠获取执行结束状态和退出码**。发送命令不代表执行成功，也无法自动判断终端是否忙碌；同一终端忙碌时不要重复点击。

### 安全约束

- 不会在插件启动或打开项目时自动执行命令，必须用户主动点击。
- 未受信任工作区禁止执行，包括全局命令。
- 不建议在 JSON 文件中明文保存令牌或口令。
- 项目 JSON 配置错误会显示错误节点，不会静默覆盖；GUI 保存会按统一格式重写 JSON，不支持注释。

完整需求、交互、验收标准见 [需求文档](docs/requirements.zh-CN.md)。开源协议 MIT。
