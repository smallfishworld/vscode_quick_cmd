# Quick Cmd — VS Code terminal command panel

English | [简体中文](README.zh-CN.md)

Save, organize and edit terminal commands in the VS Code sidebar. Supports global/project groups, multiple steps, variables and Remote SSH, without third-party runtime dependencies.

## Install and start

Requires **VS Code 1.93+**. Download a `.vsix` from [Releases](https://github.com/smallfishworld/vscode_quick_cmd/releases) and choose **Install from VSIX** in the Extensions view. Pull request checks also produce a VSIX artifact.

1. Open **Quick Cmd** in the Activity Bar.
2. Choose **New Command**, then a scope and group. The plus button beside a group creates a command directly in that group.
3. Fill in the name, command text, working directory and terminal usage, then save.
4. **Click a command to inspect/edit it; use its play button to send it to the terminal.** Enable `quickCmd.singleClickRuns` to restore the previous single-click send behavior.
5. Search with `Ctrl+Alt+Q` (`Cmd+Alt+Q` on macOS), then choose to edit or send.

The entire interface follows VS Code's display language: Chinese for Chinese locales, English otherwise. User-entered names, Shell code and variable identifiers are never translated.

## Command list

- Global commands are available in every workspace; project commands live in `.vscode/quick-cmd.json` and can be shared through Git. Multi-root workspaces and Remote SSH are supported.
- Drag groups or commands to reorder; drop a command onto a group to append it. Moves stay within one configuration scope.
- A move retains selection and offers Undo. Undo refuses to overwrite subsequent configuration changes.
- Context menus provide duplication, deletion, movement, keybinding configuration, and scope-level import/export.
- Running status takes precedence over a custom icon. Unknown status is explicitly reported; sending text is not treated as successful execution.

## Editor

- **Protected drafts:** switching commands offers Save, Discard or Cancel. Drafts persist in the current VS Code workspace state and can recover after extension reload; they never execute or write project configuration automatically.
- **Accurate save state:** edits made while a save is pending remain unsaved after that request completes.
- **Persistent footer:** Save and Save and Send stay visible while content scrolls. Use `Ctrl+S` / `Cmd+S` while the editor has focus.
- **Wide editor:** open the same draft in the main editor area. While it is open, the sidebar mirrors the draft read-only; closing the wide editor restores sidebar editing.
- **Steps:** drag, move, collapse and delete with undo. `Alt+Up` / `Alt+Down` inside command text moves a step. Narrow sidebars provide a More Actions menu.
- **Command text:** automatically sized input and common workspace/file variable insertion; optional step names.
- **Visible common settings:** working directory and terminal usage. Advanced settings contain confirmation, description, icons and environment variables.
- **Icons:** common icons have previews; custom Codicon identifiers remain supported.
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

Project configuration is strict JSON; comments are unsupported. Global commands use VS Code extension state. Legacy `command` strings and `version: 1` remain compatible; the editor writes `steps` on save.

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

Copy Keybinding Snippet creates a `quickCmd.runById` binding with `{"id":"command-id","scopeId":"scope-id"}` arguments.

## Development

Node.js 22 is recommended:

```bash
npm ci
npm run check
npm test
npm run package
```

Tests cover configuration, terminal sending, draft sessions and editor interactions executed in Happy DOM. Happy DOM is a development-only dependency and is excluded from the extension package. DOM tests do not replace visual, font, drag-and-drop or sizing checks in a real VS Code window.

GitHub Actions checks and packages pull requests and the main branch. Version changes on main trigger GitHub Release packaging.

## License

MIT — see [LICENSE](LICENSE).
