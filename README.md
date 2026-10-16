# Quick Cmd — VS Code terminal command panel

English | [简体中文](README.zh-CN.md)

Save, organize and edit terminal commands in the VS Code sidebar. All commands are global, with groups, multiple steps, variables and Remote SSH, without third-party runtime dependencies.

## Install and start

Requires **VS Code 1.93+**. Download a `.vsix` from [Releases](https://github.com/smallfishworld/vscode_quick_cmd/releases) and choose **Install from VSIX** in the Extensions view. Pull request checks also produce a VSIX artifact.

1. Open **Quick Cmd** in the Activity Bar.
2. Choose **New Command**, then a group. The plus button beside a group creates a command directly in that group.
3. The editor starts hidden and appears when creating or editing a command. Fill in the name, command text, working directory and terminal usage, then save.
4. **Click a command to send using its saved Enter option. Hover a command to reveal Edit and Run at its far right; right-click a command to delete it from the native context menu, which still asks for confirmation. Edit opens the form without sending. Keyboard focus also reveals the actions.** Close the editor from its toolbar — either **Done Editing** or the **×** — after handling the draft.
5. Search with `Ctrl+Alt+Q` (`Cmd+Alt+Q` on macOS), then select a command to send it.

Releases provide `quick-cmd-v0.9.0-en.vsix` (fixed English) and `quick-cmd-v0.9.0-zh-cn.vsix` (fixed Chinese). Install one edition. Both share an extension identity and preserve commands when replacing the language package in the same host/profile; they cannot be installed side by side. Development builds follow the host locale. User-entered names, Shell code and variables are never translated.

## Command list

- Groups and commands use the same theme foreground, without command counts. Names and previews share the VS Code UI font and weight; commands are one pixel smaller than the host and groups are two pixels larger. `quickCmd.listFontSize=0` follows the host; positive values customize the command size (10–18 px).
- An expanded group draws a vertical indent guide under its collapse arrow, so the command column stays visible.
- Move the command view into Explorer or another container through the native view title **Move View** menu. Sizing only affects this extension.
- The list starts directly at **group → command**. All commands use VS Code global extension state, without project/global root nodes.
- Drag groups or commands to reorder; drop a command onto a group to append it. Drop a group onto empty list space to move it to the end.
- A move retains selection and offers Undo. Undo refuses to overwrite subsequent configuration changes.
- Right-click a command or group to open a native menu beside the pointer, with duplication, deletion, movement and keybinding actions. Command deletion lives here rather than on the row. Import/export remain in the top-right toolbar.
- Running status takes precedence over a custom icon. Unknown status is explicitly reported; sending text is not treated as successful execution.

## Editor

The top-right toolbar provides New Group, New Command, Search, Import, Export, Collapse All, Refresh and Settings. Import uses a supported down-arrow icon. The editor stays hidden until creating a command or clicking its hover-revealed row pencil; there is no global edit-mode switch. The compact form reduces padding and control sizes. The editor title bar offers **Save and Finish Editing** (✓) and **×**. ✓ saves the draft and returns to the command list; × asks Save, Discard or Cancel when there are unsaved changes. Both return focus to the command list view rather than leaving you in the terminal.

- **Protected drafts:** switching commands offers Save, Discard or Cancel. Drafts persist in the current VS Code workspace state and can recover after extension reload; they never execute or save commands automatically.
- **Accurate save state:** edits made while a save is pending remain unsaved after that request completes.
- **Persistent footer:** Save and Save and Send stay visible while content scrolls. Use `Ctrl+S` / `Cmd+S` while the editor has focus.
- **Wide editor:** open the same draft in the main editor area. While it is open, the sidebar mirrors the draft read-only; closing the wide editor restores sidebar editing.
- **Steps:** drag, move, collapse and delete with undo. `Alt+Up` / `Alt+Down` inside command text moves a step. Narrow sidebars provide a More Actions menu.
- **Command text:** automatically sized input and common workspace/file variable insertion; optional step names.
- **Visible common settings:** working directory and terminal usage. Advanced settings — expanded by default — contain confirmation, description, icons and environment variables.
- **Icons:** about 30 Codicon presets with previews, plus custom Codicon identifiers. The picker and the command list render from the same Codicon font, so a chosen icon looks the same in both places.
- **Environment variables:** edit a name/value table or switch to JSON; incomplete and invalid input is retained.
- **External changes:** saving refuses to overwrite a command changed elsewhere. Reopen Saved Version in the header reloads it after handling the draft.

## Steps and trailing Enter

A command can contain up to **32 steps**. Their text is joined with newlines and **sent once to one terminal**. This is not a workflow engine: steps do not wait for completion and do not stop automatically on failure. Use your Shell's own composition syntax, such as `&&` in a POSIX Shell, when appropriate.

**Send Trailing Enter** applies to the whole group. Adding, deleting and moving steps preserve this choice. Saving sets intermediate steps' `execute` values to `true` and stores the option on the final step.

Disabling trailing Enter **does not guarantee that no commands execute**: intermediate steps and embedded newlines can still trigger execution depending on the terminal and Shell. Use a single-line, single-step command for prefilled input. Interactive programs may consume later input and are unsuitable as intermediate steps.

## Terminal usage

| Mode                              | Behavior                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| New terminal each time            | Default; creates a dedicated terminal and retains earlier output                                                              |
| Prefer an idle dedicated terminal | Reuses only after Shell Integration confirms idle and directory/environment settings match; otherwise creates a new terminal  |
| Use the active terminal           | Uses its existing directory/environment; rejects custom directory/environment settings and asks when idle status is uncertain |

Untrusted workspaces allow editing but cannot send commands. Startup and configuration changes never execute commands. Stop Command closes a dedicated terminal; it cannot stop a non-dedicated active terminal.

## Configuration and variables

Commands use global extension state. Import/export uses strict JSON; comments are unsupported. Project `.vscode/quick-cmd.json` files are not read or written, and no project-command migration is performed. Exported configuration has this structure:

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
          "title": "Build and prepare logs",
          "steps": [
            {
              "title": "Build",
              "command": "cmake --build build -j8",
              "execute": true
            },
            {
              "title": "Logs",
              "command": "tail -f build/build.log",
              "execute": false
            }
          ],
          "cwd": "${workspaceFolder}",
          "terminal": "new",
          "icon": "tools",
          "confirm": false,
          "env": { "CMAKE_BUILD_PARALLEL_LEVEL": "8" }
        }
      ]
    }
  ]
}
```

Variables: `${workspaceFolder}`, `${file}`, `${fileDirname}`, `${fileBasename}`, `${fileBasenameNoExtension}`, `${relativeFile}`, `${env:NAME}`, `${input:name}`.

Command variables are Shell-quoted automatically; do not add quotes around the placeholders. Directory and environment values use plain-text expansion. `quickCmd.shellType` supports `auto`, `posix`, `powershell` and `cmd`.

Copy Keybinding Snippet creates a `quickCmd.runById` binding with `{"id":"command-id"}` arguments.

## Ready-to-import command presets

The [presets/](presets/README.md) folder contains optional, ready-to-import command collections in Chinese and English: Git, SVN, Linux utilities, C/C++ & CMake, network diagnostics, and Docker. [Full Chinese preset](presets/defaults.zh-CN.json) · [Full English preset](presets/defaults.en.json) · [Git-only Chinese preset](presets/git.zh-CN.json) · [Git-only English preset](presets/git.en.json).

**Import replaces all current commands**, rather than merging them. Export your existing configuration first. No preset is automatically loaded or executed. Linux and networking examples target POSIX/Linux terminals such as Remote SSH or WSL.

## Development

Node.js 22 is recommended:

```bash
npm ci
npm run check
npm test
npm run package
python3 scripts/verify-packages.py
```

Tests cover configuration, terminal sending, draft sessions, list interactions and editor interactions executed in Happy DOM. Happy DOM is a development-only dependency and is excluded from the extension package. DOM tests do not replace visual, font, drag-and-drop or sizing checks in a real VS Code window.

Outputs in `dist/` contain both language installers and `SHA256SUMS`. GitHub Actions builds and verifies both editions; release automation prepares a complete draft before publishing the bilingual assets.

The only engineering specifications are [requirements](docs/spec.md) and [design](docs/design.md). Follow [agent.md](agent.md) for constraints and change procedures.

## License

MIT — see [LICENSE](LICENSE).
