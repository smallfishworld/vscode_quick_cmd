# Quick Cmd — VS Code 快捷命令面板

简体中文 | [English](README.md)

**Quick Cmd** 是一个轻量级 VS Code 插件：在左侧活动栏显示自定义命令列表，按分组管理，点击即可在 VS Code 内置终端执行。使用官方 Tree View 和 Terminal API，不依赖 Webview，也没有第三方运行时依赖。

## 第一版功能（v0.1.0）

- 左侧 Activity Bar 独立 **Quick Cmd** 图标及树形命令面板。
- **全局命令**：所有项目可用；**项目命令**：保存在项目的 `.vscode/quick-cmd.json`，可提交 Git 分享；支持多工作区文件夹。
- 新增、编辑、删除命令；新增、重命名、删除分组。
- 点击命令条目或行内执行按钮，在 **VS Code 内置终端** 运行。
- 每条命令单独配置工作目录：默认为项目根目录，也支持绝对路径、相对路径、`${workspaceFolder}`。
- 每次运行创建**独立终端**，避免把新命令输入到尚未执行完成的终端里；原来的输出会保留。
- 工作区未被信任（Workspace Trust）时禁止运行命令。
- 同时适用于本地开发及 VS Code Remote SSH 扩展宿主环境。

## 如何使用

1. 使用 VS Code 1.85 或更新版本打开本仓库，按 **F5** 启动扩展开发宿主；或者安装 GitHub Actions 产出的 `.vsix` 文件。
2. 点击左侧 **Quick Cmd** 图标。
3. 点击上方 **+**，选择保存位置（全局或具体项目文件夹），选择或创建命令分组。
4. 依次填写显示名称、Shell 命令、可选工作目录。
5. 点击命令即可执行；右键可编辑或删除。分组右键支持重命名、删除，项目根节点支持打开配置文件。

典型命令：`cmake --build build -j8`、`make clean`、`git status`、`ssh user@host`、`python3 scripts/build.py`。

## 项目配置示例

文件路径：`<项目根目录>/.vscode/quick-cmd.json`

```json
{
  "version": 1,
  "groups": [
    {
      "id": "build",
      "title": "编译构建",
      "commands": [
        {
          "id": "debug-build",
          "title": "Debug 编译",
          "command": "cmake --build build -j8",
          "cwd": "${workspaceFolder}"
        },
        {
          "id": "clean",
          "title": "清理",
          "command": "make clean"
        }
      ]
    }
  ]
}
```

字段说明：

- `version`：配置格式版本，当前为 `1`。
- `groups`：分组数组；各分组包含唯一 `id`、展示用 `title` 和 `commands` 数组。
- `commands`：命令对象数组；各命令包含唯一 `id`、`title`、`command`，以及可选 `cwd`。
- `cwd`：省略表示当前工作区根目录；相对路径以工作区根目录为基准。`${workspaceFolder}` 会展开为工作区绝对路径。全局命令运行时优先使用当前编辑器所在的工作区，否则使用第一个工作区。
- `command`：原样交给 VS Code 默认配置的终端 Shell 执行。不同平台请使用对应 Shell 语法；插件不会对命令字符串做额外变量替换。

项目配置是**严格 JSON**，不支持注释。遇到配置格式错误，插件会提示并阻止覆盖，避免数据丢失。全局命令存于 VS Code 插件全局状态，使用侧边栏编辑，不存到项目 JSON 中。

## 安全性与第一版边界

命令是可执行的 Shell 代码。执行陌生项目共享的命令前，请先检查配置内容。插件**不会**在启动、切换项目或配置文件变化时自动执行命令；未信任的工作区禁止执行。

第一版采用**每次执行创建新终端**的策略，不复用繁忙终端。运行状态检测、停止运行、终端复用、搜索、拖拽排序和多命令工作流作为后续迭代功能。执行失败后，终端仍保留输出，可直接查看错误信息。

不支持纯虚拟文件系统工作区（例如没有真实文件路径的部分远程仓库视图）。

## 开发与打包

工程基于 JavaScript (CommonJS) 开发，无需安装运行时第三方依赖。建议使用 Node.js 22：

```bash
npm run check  # 语法检查
npm test       # 单元测试
npm run package  # 打包 VSIX，需要联网下载 @vscode/vsce
```

GitHub Actions 在提交到 `main`、Pull Request 或手动触发时执行语法检查、单元测试并打包。构建成功后可从 Actions 的 **quick-cmd-vsix** Artifact 获取 `quick-cmd.vsix`，在 VS Code 扩展界面选择「从 VSIX 安装」。

## 开源协议

MIT，详见 [LICENSE](LICENSE)。

## P1 功能（v0.2.0）

新增以下能力，兼容旧版 `version: 1` 配置：

- **命令搜索**：`Ctrl+Alt+Q`（macOS `Cmd+Alt+Q`）或命令面板的 `Quick Cmd: Search Commands`。
- **终端模式**：`new` 每次新建（默认）；`reuse` 仅在 Shell Integration 确认终端空闲时复用，否则安全新建；`active` 使用当前活动终端，无法确认空闲时要求明确二次确认。
- **运行状态**：在支持 Shell Integration 的终端中显示运行中及退出码；右键可通过关闭专用终端停止最新命令，**不会停止非专用活动终端**。
- **变量与参数**：`${workspaceFolder}`、`${file}`、`${fileDirname}`、`${fileBasename}`、`${fileBasenameNoExtension}`、`${relativeFile}`、`${env:NAME}` 和 `${input:name}`；同一输入参数仅询问一次。
- **安全插值**：参数和文件路径按 Shell 类型自动加引号，不需要在命令模板中手动加引号；`quickCmd.shellType` 可选择 `auto/posix/powershell/cmd`。在 Windows 的 cmd.exe 模式，危险字符会拒绝插值。
- **命令属性**：支持 `description`、`icon`（Codicon 名称）、`confirm`（执行前确认）、`env`（字符串环境变量字典）、`terminal`。
- **命令管理**：右键复制命令、上移/下移命令与分组、作用域级 JSON 导入/导出（替换前确认）。
- **快捷键**：右键单个命令 `Copy Keybinding Snippet`，将 JSON 片段复制到剪贴板并打开 VS Code 的 `keybindings.json`，粘贴后自定义 `key`；插件也支持命令 `quickCmd.runById`，参数格式 `{"id":"命令ID","scopeId":"作用域ID"}`。

新增配置示例：

```json
{
  "id": "build-debug",
  "title": "Debug build",
  "command": "cmake --build ${workspaceFolder} --config ${input:config}",
  "cwd": "${workspaceFolder}",
  "description": "编译 Debug/Release",
  "icon": "tools",
  "terminal": "reuse",
  "confirm": false,
  "env": {"CMAKE_BUILD_PARALLEL_LEVEL": "8"}
}
```

`command` 是 Shell 文本，变量插值时自动加引号；不要在 `${...}` 两侧再加 Shell 引号。`cwd` 和 `env` 值使用纯文本替换。特殊字符不能用于 cmd.exe 参数插值的场景，建议切换到 PowerShell。

> VS Code 最低版本从 1.85 提升到 1.93，以使用 Shell Integration 事件 API。插件不自动执行任何项目命令，也不把命令是否发出误判为运行成功。
