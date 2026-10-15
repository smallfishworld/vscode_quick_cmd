# v0.5.0 — Global groups only

- All commands now use one global collection; the tree starts directly at group → command.
- Removed project/global root nodes, scope selection, project JSON editing and project-file watching.
- Group view title is now Groups; import/export remains available in its title menu.
- Editor breadcrumbs and search results show only the group; keybindings need only the command ID.
- No project-command migration is included.

中文：命令统一全局保存，直接显示“分组 → 命令”，移除项目/全局范围选择和项目配置入口，不增加迁移逻辑。

# v0.4.0 — Command panel interaction and localization

- Single-click selects and edits; sending uses a separate play button. An optional setting restores single-click sending.
- Complete Chinese/English UI follows the VS Code display language, including menus, search, status and error messages.
- Consistent local SVG controls, a command-list Activity Bar mark and a common command icon picker.
- Protected, recoverable drafts; accurate save acknowledgements; external-edit conflict detection.
- Persistent save footer, compact expandable steps, drag/keyboard reordering, deletion undo and variable insertion.
- Group-level trailing Enter setting survives step insertion/deletion/reordering; terminal behavior is explained explicitly.
- Wide editor shares the sidebar draft; sidebar becomes read-only while the wide editor is open.
- Working directory and terminal usage are visible; environment variables support table and JSON editing.
- Tree drag-and-drop retains selection and offers guarded undo.
- Added draft-session and DOM interaction regressions; test-only dependencies are excluded from the VSIX.

中文：统一界面文案与图标，优化命令选中/发送、编辑布局、草稿保护、主编辑区模式和多步骤交互。详见中文使用说明。

# Quick Cmd v0.3.1

## Command editor UX improvements

- Reorganized the embedded sidebar editor to match the suggested compact card layout.
- Fully Chinese labels and helper text, 4/8/12/16 spacing and theme-aware controls.
- Named steps with numbered badges and hover/focus actions to move up, move down or delete.
- Full-width dashed **添加步骤** action instead of a small Add button.
- Clear inline validation errors, with highlighted fields and readable messages.
- Collapsible advanced settings, and one-click \`\${workspaceFolder}\` / \`\${fileDirname}\` insertion for the working directory.
- Full-width Save button and a confirmation that dismisses after two seconds without resetting the editor.
- The final-step **换行执行** checkbox retains its v0.3.0 send-vs-run semantics.

## Compatibility and verification

- Still uses config schema version 1; step titles are optional, so older projects require no migration.
- Run \`npm run check\` and \`npm test\`. CI packages a \`quick-cmd-v0.3.1.vsix\` for GitHub Release.
