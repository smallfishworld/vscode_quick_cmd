# Quick Cmd v0.7.0

## 中文

- 修复导入按钮空白，改用受支持的向下箭头；列表图标随安装包提供本地字体资源。
- 分组与命令使用相同主题文字颜色，移除分组命令数量。
- 紧凑列表默认分组 12 像素、命令 11 像素、行高 22 像素；可通过 `quickCmd.listFontSize` 调整，分组始终大 1 像素。
- 每条命令最右侧常显编辑铅笔；移除列表顶部编辑模式开关。主体点击发送，铅笔点击只编辑，默认隐藏编辑栏。
- 缩小表单控件及留白，保留原生移动视图能力，可合并到资源管理器等容器。
- 保留拖拽排序、跨分组移动与撤销、键盘操作、草稿保护和双语安装包。

## English

- Fix the blank Import icon with a supported down arrow; package local icon-font resources for the list.
- Use the same theme foreground for groups and commands and remove group command counts.
- Compact defaults: 12 px groups, 11 px commands and 22 px rows. `quickCmd.listFontSize` adjusts the list while keeping groups one pixel larger.
- Show a persistent pencil at each command’s far right and remove the global edit-mode switch. Body clicks send; pencil clicks only edit. The editor starts hidden.
- Reduce form controls and padding. Native Move View support allows merging into Explorer or another container.
- Retain drag ordering, cross-group moves with Undo, keyboard controls, protected drafts and bilingual installers.

Automated host, DOM, localization and package checks cover this release. Actual VS Code font rendering and drag feel still require graphical-host verification.
