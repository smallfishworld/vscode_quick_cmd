# Quick Cmd v0.7.1

## 中文

- 右键修正版：命令和分组菜单改为鼠标旁的原生上下文菜单，移除顶部快速选择框；菜单动作始终绑定右键目标。

- 列表名称和命令摘要统一采用 VS Code 界面字体与字重，移除摘要的等宽字体；默认字号跟随宿主，分组仍大 1 像素。
- `quickCmd.listFontSize` 默认改为 0（跟随宿主）；显式自定义字号仍可用。
- 命令行尾在鼠标悬停时显示编辑、运行、删除按钮；键盘聚焦和无悬停能力设备也可访问。
- 编辑和删除不触发命令发送，运行遵循已保存的末尾回车选项，删除仍需确认。刷新保留当前按钮焦点。
- 保留紧凑布局、隐藏式编辑栏和中英文发行包。

## English

- Context-menu revision: commands and groups now use native menus beside the pointer instead of a top-of-window QuickPick; actions resolve the right-clicked record.

- Use the VS Code UI font and weight for both names and command previews, removing the preview monospace override. Default size follows the host; groups remain 1px larger.
- Default `quickCmd.listFontSize` to 0 (follow host), retaining explicit custom sizes.
- Reveal Edit, Run and Delete at the right of a hovered command row. Keyboard focus and devices without hover also expose the actions.
- Edit and Delete never send commands; Run respects the saved trailing-Enter option, and Delete retains confirmation. Refresh preserves action focus.
- Retain compact layout, an editor hidden until needed and both language editions.

Automated interaction and bilingual package checks cover this release. Actual VS Code font rendering has not been visually verified in a graphical host.

This replaces the previous 0.7.1 release and tag after bilingual package verification, as explicitly requested. Other releases are preserved.
