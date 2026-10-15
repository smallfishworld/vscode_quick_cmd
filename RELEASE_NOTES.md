# Quick Cmd v0.6.1

## 中文

- 明确普通模式与编辑模式：普通模式点击命令按配置发送；只有显式进入编辑模式后，点击命令才打开编辑栏。
- 右上角直接显示新建分组、新建命令、编辑/完成、搜索、导入、导出、折叠、刷新、设置按钮。
- 默认隐藏编辑栏，完成编辑时处理草稿并退出模式；取消退出会保留修改和编辑状态。
- 命令名称后显示 Shell 内容摘要；搜索按当前模式直接发送或编辑，减少重复选择。
- 保留独立中英文安装包、分组颜色、全局配置和既有数据；正常新增发布，不清理历史。

## English

- Separate normal and edit modes: normal clicks send with the saved Enter option; edit-mode clicks open the form without sending.
- Direct top-right toolbar actions for groups, commands, edit/done, search, import/export, collapse, refresh and settings.
- The editor stays hidden during normal use. Done protects the draft before exiting; Cancel retains editing.
- Inline command previews and mode-aware search remove unnecessary interaction steps.
- Both language editions, group colors and stored global commands remain available. This release does not delete history.

Validation includes automated mode transitions, draft cancellation, language and package checks. Actual VS Code visual rendering still requires graphical-host verification.
