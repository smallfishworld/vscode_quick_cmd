# Quick Cmd

[简体中文](README.zh-CN.md) | English

**Quick Cmd** is a lightweight VS Code extension that lets you save shell commands, organize them in groups, and execute them with one click from a dedicated Activity Bar sidebar. It uses native VS Code Tree Views and integrated terminals, without Webviews, third-party runtime dependencies, or background command execution.

## Features (v0.1.0)

- Dedicated **Quick Cmd** icon in the left Activity Bar.
- **Global** commands (available in all workspaces) and **workspace** commands (saved in `.vscode/quick-cmd.json`). Supports multiple workspace folders.
- Add, edit, run, and delete commands; create, rename, and delete groups.
- Click a command row or its **Run** icon to launch it in an integrated terminal.
- Per-command working directory: project root by default, absolute paths, relative paths, or `${workspaceFolder}`.
- Each invocation opens a **new terminal**. Existing long-running commands aren't interrupted or accidentally sent extra text.
- Honors VS Code **Workspace Trust**: commands won't run from an untrusted folder.
- Workspace configuration can also be maintained as regular JSON in version control.
- Works in local and Remote SSH VS Code extension hosts (where integrated terminals are available).

## Get started

1. Open the repository in VS Code (1.85+).
2. Press **F5** to launch an Extension Development Host. Alternatively install the packaged `.vsix` using **Extensions → ... → Install from VSIX...**.
3. Click **Quick Cmd** in the left Activity Bar.
4. Click **+** to add a command, choose Global or a workspace folder, and choose/create a group.
5. Enter a display name, the shell command, and optionally a working directory.
6. Click the command to run it. Right-click entries to edit, rename, or delete them.

Example commands: `cmake --build build -j8`, `make clean`, `git status`, `ssh user@host`, or `python3 scripts/build.py`.

## Workspace configuration

Workspace commands live in `<workspace>/.vscode/quick-cmd.json` and can be shared with teammates. Example:

```json
{
  "version": 1,
  "groups": [
    {
      "id": "build",
      "title": "Build",
      "commands": [
        {
          "id": "debug-build",
          "title": "Debug build",
          "command": "cmake --build build -j8",
          "cwd": "${workspaceFolder}"
        },
        {
          "id": "clean",
          "title": "Clean",
          "command": "cmake --build build --target clean"
        }
      ]
    }
  ]
}
```

- `version`: schema version (currently `1`).
- `groups`: ordered groups, each with a unique `id`, visible `title`, and `commands` array.
- `commands`: unique `id`, visible `title`, required nonempty `command`, and optional `cwd`.
- `cwd`: empty/omitted means workspace root; relative paths are resolved from the workspace root. `${workspaceFolder}` expands to that workspace folder's absolute path. In a global command it means the current editor's workspace (or the first open folder).
- The command text is passed **as-is** to the configured VS Code terminal shell. Use shell-appropriate syntax (PowerShell, bash, etc.). No variable expansion is performed on the command text by the extension.
- The file must be **strict JSON**, not JSON with comments. The extension validates it and will not overwrite invalid configurations.

Global commands are stored in the extension's VS Code global state and edited from the sidebar, not from a project file.

## Safety and behavior

**Commands are executable code.** Inspect project command files before running entries from a repository you do not trust. Nothing runs automatically on startup, file change, or workspace open. The extension refuses to launch commands in an untrusted workspace.

In v0.1.0, terminal tabs are intentionally not reused. This makes concurrent build, flash, deploy, and monitor commands safer. Execution success/failure indicators, process stopping, terminal reuse, filtering, drag-to-reorder, and multi-command workflows are planned enhancements rather than v0.1.0 features. If a command fails, its output stays in the terminal.

This extension requires a real local or remote file-system workspace for project-specific commands and does not support virtual-only workspaces.

## Development and packaging

No `npm install` is needed to run or test the extension (Node.js 22 is recommended for development):

```bash
npm run check
npm test
# Package a local VSIX (downloads the packaging CLI if necessary)
npm run package
```

GitHub Actions runs syntax checks, unit tests, and VSIX packaging on `main`, PRs, and manual dispatch. The downloadable `quick-cmd-vsix` artifact contains `quick-cmd.vsix` once CI succeeds.

## License

MIT — see [LICENSE](LICENSE).

## P1 (v0.2.0)

- Search commands with `Ctrl+Alt+Q` (`Cmd+Alt+Q` on macOS) or the Command Palette.
- Shell variables: `${workspaceFolder}`, `${file}`, `${fileDirname}`, `${fileBasename}`, `${fileBasenameNoExtension}`, `${relativeFile}`, `${env:NAME}`, `${input:name}`. Variable values are shell-quoted automatically; don't wrap placeholders in your own shell quotes.
- Terminal strategies: `new` (default), `reuse` (only after Shell Integration confirms idle; otherwise creates a fresh terminal), `active` (warns if potentially busy).
- Optional confirmation before running, environment variables (`env`), descriptions, and Codicon icons (`icon`).
- Shell Integration-based command exit status where supported; stop a command by closing its dedicated terminal.
- Duplicate, move commands/groups up or down, import/export a JSON scope, and copy a JSON keybinding snippet for any command.
- Configure quoting using `quickCmd.shellType` (`auto`, `posix`, `powershell`, `cmd`).
- Use `quickCmd.runById` with keybindings JSON arguments `{ "id": "command-id", "scopeId": "global" }` or the workspace URI as scopeId.
- Existing v0.1 configurations remain compatible. VS Code 1.93+ is required.

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for installation and change details.

---

## v0.3.0: Sidebar editor, drag-to-order, and command steps

Open **Quick Cmd** in the Activity Bar. Use **+** next to a group (or the view title)
to open the **Command Editor** below the command tree. All command fields now live in
one form; right-click an existing command and select **Edit** to modify it.

- **Drag and drop** a group before another group, or a command before another
  command. Drop a command onto a group to append it. Drops are intentionally
  restricted to the same configuration scope (global or a single workspace).
- **Multiple steps**: press **+ Add** in the editor to configure up to 32 ordered
  command lines. Steps run in one integrated terminal, in their stored order.
- **"换行执行" (Send Enter)**: each row displays a checkbox after the command field.
  The final row determines whether a trailing Enter is sent. Uncheck it to
  paste the final line into the terminal **without executing that line**.
  Earlier rows must remain checked to avoid accidentally combining commands.
- Existing v0.2.0 JSON files with a single `"command"` string remain supported.

A multi-step command is sent to the terminal as one string with newline characters
between steps, using `Terminal.sendText(combined, lastStep.execute)`. This is
best for normal shell commands. Avoid combining commands that prompt for or
consume standard input, because such programs can consume subsequent terminal input.
The extension does not claim process-by-process orchestration.

Example:

```json
{
  "title": "Build then stage log command",
  "steps": [
    { "command": "cmake --build build -j8", "execute": true },
    { "command": "tail -f build/build.log", "execute": false }
  ],
  "terminal": "new"
}
```

