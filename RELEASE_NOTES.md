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
