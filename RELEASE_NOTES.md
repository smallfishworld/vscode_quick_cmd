# Quick Cmd v0.2.0 — P1 Release

- Command variables: `${workspaceFolder}`, `${file}`, `${fileDirname}`, `${fileBasename}`, `${fileBasenameNoExtension}`, `${relativeFile}`, `${env:NAME}`, and `${input:name}`.
- Input prompts and shell-specific quoting; optional per-command environment overrides.
- Terminal modes: always new, safely reuse only after VS Code Shell Integration reports idle, or explicitly use active terminal (with busy-terminal warning).
- Shell Integration exit codes shown when available; stop a command by closing its dedicated terminal.
- Per-command execution confirmation and custom Codicon.
- Search commands from the Command Palette or `Ctrl+Alt+Q` / `Cmd+Alt+Q`.
- Duplicate, move up/down, JSON import/export with schema checks and overwrite confirmation.
- Keybinding snippets for individual commands through the right-click menu.
- Keeps `.vscode/quick-cmd.json` at schema version 1 and reads existing v0.1.0 configurations.

**Install**: download `quick-cmd-v0.2.0.vsix` from this release, then choose *Extensions → ... → Install from VSIX* in VS Code 1.93+.

**Safety**: Quick Cmd never auto-executes repository commands. VS Code Shell Integration is required for reliable execution completion detection; the active-terminal mode always warns if safety cannot be established.
