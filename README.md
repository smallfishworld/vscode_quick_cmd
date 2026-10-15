# Command Deck

[简体中文](README.zh-CN.md) | English

**Command Deck** is a lightweight Visual Studio Code extension that organizes custom terminal commands in an Activity Bar sidebar. Click a command to send it to a VS Code integrated terminal.

## v0.1.0 features

- Native Activity Bar / Tree View with groups and command descriptions.
- Add, edit, enable/disable, rename, remove, and reorder commands/groups using the GUI.
- Global commands in User Settings JSON; project commands in `.vscode/command-deck.json`.
- Automatic refresh when the project JSON or global settings change.
- Dedicated reusable terminal per command, or a new terminal per run.
- Configurable working directory, optional execution confirmation, disabled commands.
- Variable expansion and support for multi-root workspaces.
- Workspace Trust protection: untrusted workspaces cannot run commands.
- JSON schema with editor diagnostics and completion for project configuration.

## Installation and development

Requires VS Code 1.90+ and Node.js 20+ for building.

```sh
npm install
npm test
npm run package
```

Install the generated `.vsix` with **Extensions → … → Install from VSIX…**, or open this repository in VS Code and press **F5** to launch an Extension Development Host (after `npm run build`). GitHub Actions also packages a VSIX build artifact after a successful push.

## Quick start

1. Open the **Command Deck** icon in the left Activity Bar.
2. Click **Add Group** and select either **Global Commands** or a workspace folder.
3. Click **Add Command**, pick its group, and enter a name, shell command, optional description and working directory.
4. Click the new command in the tree to run it in the integrated terminal.
5. Right-click an item to edit, delete, move or open the underlying JSON file.

To edit JSON directly, right-click a project root → **Open Configuration JSON**. For global commands, choose **Open Configuration JSON** to open User Settings JSON, then edit `commandDeck.globalGroups` as an array of groups. The project file template is under [`examples/.vscode/command-deck.json`](examples/.vscode/command-deck.json).

```json
{
  "version": 1,
  "groups": [
    {
      "id": "build",
      "name": "Build",
      "commands": [
        {
          "id": "compile",
          "name": "Compile",
          "command": "cmake --build build -j8",
          "cwd": "${workspaceFolder}",
          "terminal": "reuse",
          "confirm": false,
          "enabled": true
        }
      ]
    }
  ]
}
```

Each `id` must be unique among groups/commands in the same scope. The project file has `version: 1`; global settings contain only the `groups` array, stored under `commandDeck.globalGroups`. Commands are never run automatically.

### Supported variables

`${workspaceFolder}`, `${workspaceFolderBasename}`, `${file}`, `${fileBasename}`, `${fileBasenameNoExtension}`, `${fileDirname}`, `${relativeFile}` and `${env:NAME}`.

Unknown `${...}` expressions are left unchanged so ordinary shell parameter expansions continue working. If a required file or environment variable is unavailable, execution fails with a readable message. Variable substitution is literal: **quote paths with spaces and shell metacharacters yourself** (e.g. `cat "${file}"`). Do not treat commands or config files from untrusted contributors as safe.

### Terminal behavior

- `reuse` (default): a dedicated terminal per command, reused until closed. `cwd` is applied **when creating** the terminal. If you `cd` inside it, later runs continue from the new shell directory.
- `new`: starts a fresh terminal every time with the configured `cwd`.
- Commands execute in the extension host's workspace environment; in Remote SSH scenarios, install/enable this workspace extension on the remote host.
- `sendText` sends commands but cannot report a reliable exit code, running state or completion time. Launching a command does **not** mean it succeeded; do not send another command to the same terminal while it is busy.

## Safety and current limitations

- The extension does not execute anything on startup. All commands require a user click.
- Workspace Trust is checked before execution, including global commands.
- Confirmation is opt-in. Avoid putting passwords or tokens directly in config files.
- GUI edits rewrite the project JSON in a normalized format (comments are not supported). If JSON is invalid, the GUI refuses to overwrite it and shows an error node.
- No command chaining, process status, prompt-time inputs, or drag-and-drop sorting in v0.1.0. These are planned enhancements.
- Project config writes use VS Code's FileSystem API. If another process edits the same file at exactly the same time, resolve changes with source control.

## Design and acceptance criteria

See [Requirements (中文)](docs/requirements.zh-CN.md). MIT License.
