# Quick Cmd v0.11.4

## 中文

- 首次激活且未保存过全局快捷命令配置时，自动导入完整的 6 组、43 条预设命令；使用 VS Code UI 语言选择简体中文或英文。
- 若存在任何已保存配置，包括空列表和用户主动删除全部命令后的空配置，则绝不重复导入、追加或覆盖。插件重新安装后仍以全局配置是否存在为准。
- 初始化与编辑写入共用串行队列，防止首屏显示空列表或并发操作覆盖用户配置；默认命令只保存，不会执行。
- 预设文件缺失、现存配置损坏时明确报错而不清空数据；增加首次使用、重装、语言切换、并发及故障回归测试。
- README 保持面向用户，保留简明的默认命令说明；沿用同一个中英文自动适配 VSIX 和原扩展 ID。

## English

- Automatically seed the full 6-group / 43-command collection on the first extension activation with no saved configuration, choosing Chinese or English from the VS Code display language.
- Existing saved configurations, including intentionally empty ones, are never merged with or overwritten by presets. Reinstalls also respect any state still persisted by VS Code.
- Serialize initialization with edits so views never see placeholder data while seeding; no preset executes automatically.
- Preserve data and report errors for missing preset files or invalid existing configs; add first-run, reinstall, locale, concurrency and failure regression coverage.
- Keep public README content user-focused and preserve the existing multilingual VSIX and extension identifier.
