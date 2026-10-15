# Quick Cmd v0.6.0

## 中文

- 同时发布固定中文和英文两份安装包，完整覆盖菜单、编辑栏、状态和错误提示。
- 编辑栏默认隐藏，新建或编辑时显示；右上角可打开或结束编辑，保留未保存修改保护。
- 分组文字和文件夹图标使用独立主题颜色，普通命令保持默认颜色。
- `docs/` 收敛为唯一需求 `spec.md` 与设计 `design.md`，根目录增加 `agent.md` 项目约束和变更流程。
- 使用隔离构建、锁定打包工具及双包解包校验，提供 `SHA256SUMS`。
- 按用户要求清理旧发布及其版本标签，重新以 v0.6.0 发布。

选择 `quick-cmd-v0.6.0-zh-cn.vsix`（中文）或 `quick-cmd-v0.6.0-en.vsix`（英文）安装。两包为同一扩展的语言版本，不能同时安装；替换语言包沿用同一宿主/配置档案中的全局命令。

## English

- Separate Chinese and English installers pin every UI surface to the selected language.
- The editor starts hidden and opens only for editing; top-right controls open or finish editing with draft protection.
- Group labels and folder icons use a dedicated theme color; commands retain their normal foreground.
- Consolidated requirements/design and documented project constraints and change procedures.
- Isolated builds, locked packaging tools, ZIP validation and SHA-256 checksums for both installers.
- Existing release history and its version tags are reset for the requested v0.6.0 publication.

Install either the `zh-cn` or `en` VSIX. Both share one extension identity and stored commands; they are alternatives, not side-by-side extensions.

Validation includes automated behavior and package checks. Theme rendering, native drag-and-drop and window sizing still require a real VS Code graphical host.
