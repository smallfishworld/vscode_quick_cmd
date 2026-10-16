# Quick Cmd v0.10.0

## 中文

- 新增 `presets/` 默认快捷命令库，包括 Git（14 条）、SVN（6 条）、Linux（7 条）、C/C++ 与 CMake（6 条）、网络诊断（5 条）和 Docker（5 条），共 **6 组、43 条命令**，同时提供中英文及仅 Git 的预设文件。
- 预设 JSON 随三个 VSIX 安装包一同打包，也可从 [GitHub presets 目录](https://github.com/smallfishworld/vscode_quick_cmd/tree/main/presets) 下载并手动导入。
- 新增 `quick-cmd-v0.10.0-marketplace.vsix`：保留英文与中文 VS Code 本地化配置，按宿主界面语言自动选择。
- 保留 GitHub 发行版的固定中文、固定英文两个 VSIX 以及 SHA256 校验和；自动化构建和校验覆盖全部三个包。
- 为 GitHub Actions 配置可选的 Marketplace OIDC 可信发布步骤（需先配置发布者授权及仓库开关）。

**兼容与安全：** 所有预设均不会自动执行。现有导入仍为替换全部命令，而不是增量合并；导入前请先导出备份。修改仓库或远端状态的关键命令启用了执行前确认。Linux 网络命令主要面向 POSIX/Linux Shell（Remote SSH、WSL 等）。

## English

- Added `presets/` with **43 commands across six groups**: Git (14), SVN (6), Linux (7), C/C++ & CMake (6), network diagnostics (5), and Docker (5). Both Chinese and English collections and Git-only collections are available.
- The JSON presets are bundled in all three VSIX installers and available for manual download from [GitHub](https://github.com/smallfishworld/vscode_quick_cmd/tree/main/presets).
- Added `quick-cmd-v0.10.0-marketplace.vsix`, which follows the host VS Code language for English/Chinese UI localization.
- Retained fixed Chinese and English GitHub release installers and SHA256 checksums, validating all three packages in CI.
- Prepared an optional GitHub Actions Marketplace publishing step using OIDC trusted publishing after publisher authorization.

**Compatibility and safety:** Presets are never executed automatically. Import still replaces all existing commands rather than merging; export a backup first. Potentially state-changing version-control commands require a send confirmation. Linux and networking examples target POSIX/Linux shells including Remote SSH and WSL.
