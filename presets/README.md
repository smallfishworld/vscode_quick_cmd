# Quick Cmd command presets / 快捷命令预设

[简体中文](#简体中文) | [English](#english)

## 简体中文

本目录提供 Quick Cmd 的标准 JSON 快捷命令模板。**从 v0.11.5 开始，首次启动且插件专属 `config.json` 不存在时，插件自动载入与 VS Code 界面语言匹配的完整默认预设（6 组 43 条）；已有配置（包括空配置）不会被覆盖或再次初始化。** 命令不会自动执行；手动导入其他预设仍会替换现有命令。

| 文件 | 内容 |
| --- | --- |
| [defaults.zh-CN.json](defaults.zh-CN.json) | 六组默认预设：Git、SVN、Linux、C/C++ & CMake、网络诊断、Docker（共 43 条） |
| [git.zh-CN.json](git.zh-CN.json) | 仅 Git（14 条） |
| [defaults.en.json](defaults.en.json) | 英文名称的完整预设 |
| [git.en.json](git.en.json) | 英文名称的 Git 预设 |

**使用方式：** 下载上面的 JSON 文件，在 VS Code 的 Quick Cmd 面板点击右上角“导入”，选择文件后确认。已导入命令可以编辑、删除、拖拽排序。

**重要：当前插件的导入是整份替换，而不是追加合并。** 导入前先用面板的“导出”备份已有命令。不要连续导入 Git 文件和完整预设，否则后一次会替换前一次。预设中所有命令默认不会自动执行；只有点击命令才会发送到终端。

- 所有命令默认以 `${workspaceFolder}` 为工作目录，需先打开工作区；运行在 VS Code 当前扩展宿主的集成终端中。
- Git / SVN / CMake 跨平台程度较高，但 Linux/网络诊断命令偏向 **Linux 和 POSIX Shell**；Windows PowerShell 或 CMD 下部分命令无法直接使用，建议在 WSL 或 Remote SSH 环境执行。
- `${input:...}` 是 Quick Cmd 的运行时输入参数：如提交信息、分支、文件名、主机地址；扩展会做 Shell 引号处理，预设不要自行在变量外面重复加引号。
- `git commit` / `git push` / `git pull`、`svn commit` / `svn update` 等修改数据的命令均开启二次确认，但确认只确认“发送命令”，并不能保证 Shell 命令执行成功。
- CMake 示例使用 `build/` 目录；Docker、SVN、systemd、curl 等相关工具应预先安装。Linux 命令在无相应工具时可能执行失败。
- 预设使用 **单步骤命令**，避免多步骤连续发送时的意外执行问题；对网络访问或工作树修改等动作，请自行审查命令内容。

## English

These are bundled JSON preset collections for Quick Cmd. **Starting in v0.11.5, first activation with no config.json in the extension storage directory seeds all six groups (43 commands) in the VS Code display language. Existing configurations, including empty collections, are never overwritten or reseeded.** Commands are never executed automatically. Manual import of another preset still replaces the existing collection.

| File | Contents |
| --- | --- |
| [defaults.en.json](defaults.en.json) | All six groups (43 commands): Git, SVN, Linux, C/C++ & CMake, Network Diagnostics and Docker |
| [git.en.json](git.en.json) | Git only (14 commands) |
| [defaults.zh-CN.json](defaults.zh-CN.json) | Full preset with Chinese titles |
| [git.zh-CN.json](git.zh-CN.json) | Git preset with Chinese titles |

Download one JSON file, open Quick Cmd in VS Code, choose **Import** in the panel toolbar and confirm. You can then edit or remove imported commands.

**Important: Import replaces the entire existing command collection; it does not merge.** Export your current commands first as a backup. Importing another preset later replaces the previous one.

Most Git, SVN and CMake commands are portable; Linux and network commands target Linux/POSIX shells, including WSL and Remote SSH. Commands run with `${workspaceFolder}` as their working directory and require an open workspace. Quick Cmd quotes `${input:...}` arguments for the configured shell. Write operations such as commit, push, pull, or SVN update require confirmation, but sending a command does not guarantee successful execution.
