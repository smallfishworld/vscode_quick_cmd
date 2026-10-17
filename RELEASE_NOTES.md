# Quick Cmd v0.11.0

## 中文

- **中英文合并为单个 VSIX**：GitHub Releases 和 VS Code Marketplace 均使用 `quick-cmd-v0.11.0.vsix`，不再生成中文、英文固定版本。
- 插件使用 `vscode.env.language` 选择运行时界面语言，VS Code 自动根据 `package.nls.json` / `package.nls.zh-cn.json` 本地化命令、菜单及设置。中文显示中文，其他语言默认英文；切换 VS Code 界面语言并重载后生效。
- 保留扩展 ID `smallfishworld.vscode-quick-cmd` 和全局命令存储，不清除已有命令，可直接从旧版升级。
- 打包脚本只生成一个安装包，清空旧构建输出；自动化测试验证语言切换、两个语言目录和预设资源，并生成仅一条 SHA-256 记录。
- 保留 43 条 Git、SVN、Linux、C/C++ 与 CMake、网络及 Docker 快捷命令预设，仍由用户手动选择导入，不自动执行。
- Marketplace 自动上传同一个 VSIX，仍需要事先配置发布者权限和 GitHub OIDC（OpenID Connect）可信发布策略。

## English

- **One multilingual VSIX**: GitHub Releases and the VS Code Marketplace use the same `quick-cmd-v0.11.0.vsix`. Fixed-language installers have been removed.
- The extension reads `vscode.env.language` for runtime UI strings; VS Code selects `package.nls.json` or `package.nls.zh-cn.json` for manifest strings. Chinese UI uses Chinese; other languages fall back to English. Reload VS Code after changing display language.
- Preserves extension ID `smallfishworld.vscode-quick-cmd` and existing saved commands during upgrades.
- The build creates exactly one VSIX and a one-line SHA-256 manifest, with tests checking both language catalogs and all bundled resources.
- The 43 Git/SVN/Linux/CMake/networking/Docker command presets remain opt-in and are never executed automatically.
- Optional Marketplace publishing uses the same VSIX and requires authorized publisher OIDC trusted publishing.
