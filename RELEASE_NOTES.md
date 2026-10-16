# Quick Cmd v0.8.0

## 中文

- 列表字号分层更明显：命令比 VS Code 界面字号小 1 像素，分组比命令大 2 像素，文件夹与命令更容易区分。
- 分组展开时，在折叠箭头下方绘制一条缩进竖线，命令列始终可见。
- 命令行尾只保留编辑、运行按钮；删除改由右键命令弹出的原生菜单完成，删除前仍确认。
- 编辑栏标题栏同时提供“完成编辑”和新增的 × 两个关闭入口，两者走同一关闭流程，都保护未保存草稿。
- 保留紧凑布局、隐藏式编辑栏和中英文发行包。

## English

- Sharper list type hierarchy: commands are 1px smaller than the VS Code UI font and groups are 2px larger, so folders read clearly apart from commands.
- An expanded group now draws a vertical indent guide under its collapse arrow, keeping the command column visible.
- The command row keeps only Edit and Run; Delete moves to the native right-click menu and still asks for confirmation.
- The editor title bar now offers both **Done Editing** and a new **×**; both run the same close flow and protect unsaved drafts.
- Retain compact layout, an editor hidden until needed and both language editions.

Automated interaction and bilingual package checks cover this release. Actual VS Code font rendering has not been visually verified in a graphical host.

The visual mockups under `docs/ui-preview/` render the extension's own webview templates and client scripts, and were reviewed before this change landed.
