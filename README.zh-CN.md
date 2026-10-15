# Quick Cmd — VS Code 快捷命令面板

简体中文 | [English](README.md)

**Quick Cmd** 是一个轻量级 VS Code 插件：在左侧活动栏显示自定义 Shell 命令，按分组管理，点击即可在 VS Code 内置终端执行。基于官方 Tree View 和 Terminal API 实现，无需 Webview、无第三方运行时依赖。

## 第一版功能（v0.1.0）

- VS Code 左侧 Activity Bar 独立 **Quick Cmd** 图标、树形分组命令栏。
- **全局命令**：所有项目可用；**项目命令**：保存到 `.vscode/quick-cmd.json`，可提交 Git 分享。
- 支持多个工作区文件夹，每个项目独立管理命令和分组。
- 新增、编辑、删除命令；新增、重命名、删除分组。
- 点击命令本身或行内 **运行** 按钮，在 VS Code 内置终端执行。
- 配置执行目录：默认项目根目录，也支持相对路径、绝对路径和 `${workspaceFolder}`。
- **每次执行打开独立终端**，防止多个命令相互干扰，执行输出保留。
- 遵循 VS Code Workspace Trust（工作区信任）机制，未信任的项目禁止执行。
- 适用于本地开发及 Remote SSH 远程工作区。

## 使用步骤

1. 用 VS Code 1.85+ 打开本仓库，按 **F5** 启动扩展开发宿主；或者下载安装 GitHub Actions 构建的 `.vsix`。
2. 点击左侧 **Quick Cmd** 图标。
3. 点击顶部 **+**，选择保存到全局或某个项目，再选择/创建命令分组。
4. 填写名称、Shell 命令、可选的执行目录。
5. 点击命令执行；右键菜单可编辑、删除，分组右键支持重命名、删除。

可配置命令示例：`cmake --build build -j8`、`make clean`、`git status`、`ssh user@host`、`python3 scripts/build.py`。

## 项目配置文件

路径：`<项目根目录>/.vscode/quick-cmd.json`。

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

字段说明：`version` 为配置格式版本（当前 1）；`groups` 为分组数组，每个分组含唯一 `id`、展示名称 `title`、命令数组 `commands`；命令必须具有唯一 `id`、`title`、`command`，`cwd` 可选。

- 不写 `cwd` 默认为工作区根目录，相对路径以根目录为基准。
- `${workspaceFolder}` 会展开为项目目录的绝对路径。全局命令优先使用当前编辑器的工作区，否则使用第一个工作区。
- `command` 原样送到 VS Code 终端，由当前配置的 Shell（bash、PowerShell 等）执行；插件不会展开命令文本中的变量。
- 配置文件必须使用**严格 JSON**，不支持注释。文件格式错误时，插件不会覆盖已有内容。
- 全局命令保存于 VS Code 插件全局状态，不写入项目文件。

## 安全性与第一版边界

**命令是可执行的代码。** 执行其他人共享的项目配置前，请检查具体命令。插件不会在启动、打开项目或文件变化时自动执行；工作区不受信任时禁止运行。

v0.1.0 采用 **每次执行新建终端** 策略，不会把新命令注入正在编译、烧录或监听日志的 Shell。搜索、拖拽排序、成功失败状态、停止进程、终端复用、多命令工作流将在后续版本迭代。终端输出会保留，便于排查失败原因。

暂不支持没有真实文件系统路径的纯虚拟工作区。

## 开发与打包

无运行时第三方依赖，建议使用 Node.js 22。

```bash
npm run check   # JavaScript 语法检查
npm test        # 单元测试
npm run package # 打包 VSIX（需下载 @vscode/vsce）
```

GitHub Actions 在提交到 `main`、PR 或手动触发时执行检查与打包，成功后可以从 Actions 页面下载 **quick-cmd-vsix**，在 VS Code 扩展界面选择「从 VSIX 安装」。

采用 MIT 开源协议，详见 [LICENSE](LICENSE)。
