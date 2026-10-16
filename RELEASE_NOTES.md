# Quick Cmd v0.9.0

## 中文

- 编辑栏“高级设置”默认展开，确认开关、描述、命令图标与环境变量不再需要手动点开。
- 标题栏 ✓ 改为“保存并完成编辑”：直接保存草稿并退出，不再弹确认框；保存失败时保持编辑，不丢输入。× 仍走保存/放弃/取消确认。
- 点击 ✓ 或 × 退出后焦点回到命令列表视图，不再停在终端或空编辑视图。
- 命令图标预设扩充到约 30 个（覆盖构建、调试、测试、部署、Git、云、数据库、文件、安全等常用场景）。
- 图标选择器改用 Codicon 字体渲染，与命令列表同源，修复同一图标在两处显示不一致的问题。
- 保留列表字号分层、缩进竖线、行尾编辑/运行按钮与中英文发行包。

## English

- The editor's **Advanced settings** section is now expanded by default, so confirmation, description, icon and environment variables are visible without an extra click.
- The title-bar ✓ is now **Save and Finish Editing**: it saves the draft and exits without a prompt, and keeps the editor open (preserving input) if saving fails. × still asks Save, Discard or Cancel.
- Finishing or closing the editor returns focus to the command list view instead of leaving you in the terminal or an empty editor view.
- The command icon presets grew to about 30, covering build, debug, test, deploy, Git, cloud, database, files and security.
- The icon picker now renders from the Codicon font, the same source as the command list, fixing icons that looked different in the two places.
- Retain the list type hierarchy, indent guide, row Edit/Run buttons and both language editions.

Automated interaction and bilingual package checks cover this release. Actual VS Code font rendering has not been visually verified in a graphical host.

The visual mockups under `docs/ui-preview/` render the extension's own webview templates and client scripts, and were reviewed before this change landed.
