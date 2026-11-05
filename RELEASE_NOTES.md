# Quick Cmd v0.11.7

## 中文

- 统一新增与编辑命令的交互：所有“新建命令”入口直接进入编辑栏，不再弹出原生的分组选择框；目标分组改为在编辑栏顶部的分组下拉框中选择。
- 编辑栏顶部的分组下拉框也可用于把已有命令移动到其他分组（保存时生效）：显式改选优先；未改选时命令被外部（如拖拽）移动则跟随命令本身，不回移。
- 新建与编辑共用同一套草稿保护：已打开的目标再次进入只聚焦、不重置草稿；仅更改分组也算未保存修改，关闭或切换时受确认保护。
- 修复：把分组下拉改选到其他分组后，点击目标分组的“新建”会误弹“切换前保存”确认框；同槽位判定现在以下拉当前分组为准。
- 修复：升级后恢复的旧版本草稿（没有分组选择字段）不再被误判为“未保存”，关闭时不再弹出多余确认。
- 修复：编辑期间所选分组被其他窗口删除后，重新加载编辑栏不再出现虚假的“未保存”状态，自动回退到仍存在的分组。
- 保留 v0.11.6 的 JSON 存储、命令变量转义防护与终端复用规则。

## English

- Creating and editing commands now share one interaction: every New Command entry opens the editor directly instead of a native group-selection dialog; the target group is chosen from the dropdown in the editor header.
- The header group dropdown can also move an existing command into another group on save: an explicit choice wins, while an untouched dropdown follows commands that were moved externally (for example by drag and drop).
- Creating and editing share the same draft protection: an already-open target regains focus without resetting the draft, and a group-only change counts as unsaved and is protected on close or switch.
- Fixed: after retargeting the group dropdown, clicking New on the targeted group wrongly prompted to save before switching; the open-slot check now follows the dropdown's current group.
- Fixed: drafts persisted by older versions (without a group choice) are no longer reported unsaved after upgrade, and closing them no longer prompts unnecessarily.
- Fixed: when the chosen group is deleted from another window while editing, reloading the editor no longer shows a phantom unsaved state and falls back to an existing group.
- Preserve v0.11.6 JSON storage, command-variable escaping safeguards and terminal reuse rules.

Validation covers automated tests, independent Node processes, shell argument handling, and VSIX content verification. Actual VS Code multi-window, Remote SSH and graphical host acceptance have not been performed. Marketplace publication follows the existing repository workflow settings.
