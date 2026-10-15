# Quick Cmd

[简体中文](README.zh-CN.md) | English

**Quick Cmd** is a lightweight VS Code extension that lets you organize saved shell commands in a dedicated Activity Bar sidebar and run them in integrated terminals with one click. It uses native VS Code Tree Views, not Webviews, and has no third-party runtime dependencies.

## Features (v0.1.0)

- A dedicated **Quick Cmd** icon in VS Code's left Activity Bar.
- **Global** commands for all projects and **workspace** commands stored in `.vscode/quick-cmd.json`.
- Multiple workspace folders, each with its own independent groups and commands.
- Create, rename, or delete groups; add, edit, run, or delete commands.
- Click a command or its **Run** button to execute in the VS Code terminal.
- Configure working directory per command: project root, relative or absolute path, or `${workspaceFolder}`.
- **A fresh terminal per invocation**, so long-running commands aren't interrupted by a second click.
- Honors VS Code **Workspace Trust**: no execution in an untrusted workspace.
- Can work in local and Remote SSH extension hosts.

## Start using it

1. Open this project in VS Code 1.85+ and press **F5** to launch an Extension Development Host, or install the `.vsix` artifact built by GitHub Actions.
2. Click **Quick Cmd** in the Activity Bar.
3. Click **+** to add a command; choose **Global** or a workspace folder, then select or create a group.
4. Enter a name, shell command and optional working directory.
5. Click a command to run it. Right-click commands/groups for edit and delete actions.

Examples: `cmake --build build -j8`, `make clean`, `git status`, `python3 scripts/build.py`.

## Workspace configuration

Project commands are saved to `<workspace>/.vscode/quick-cmd.json` and can be committed to Git.

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

The `groups` array defines order. Every group and command must have a **unique ID**. A command requires `title` and `command`; `cwd` is optional.

- Blank `cwd` means the workspace root. Relative paths are resolved from that root.
- `${workspaceFolder}` expands to the folder's absolute path; for global commands the current editor's workspace is preferred, otherwise the first folder.
- Shell command text is passed **as-is** to the configured terminal shell. The extension does **not** expand variables in the command text.
- Configuration must be **strict JSON**. Invalid files are not overwritten by the extension.
- Global command definitions live in VS Code's extension global state instead of project files.

## Safety and limitations

**Saved commands are executable shell code.** Inspect shared workspace configurations before clicking commands. The extension never executes automatically at startup, after a file change, or when a workspace opens. Execution from untrusted workspaces is blocked.

Version 0.1.0 intentionally **does not reuse terminals** or report reliable success/failure status. Each invocation opens a new terminal to avoid injecting into a busy shell. Search, drag-to-reorder, execution status, stopping tasks, terminal reuse and workflow chaining are future enhancements. Terminal output is retained so failures can be inspected.

Virtual-only workspaces are not supported; a local or remote file-system workspace is required for project-specific commands.

## Development / package

There are no runtime dependencies. Node.js 22 is recommended for development.

```bash
npm run check
npm test
npm run package
```

The package script uses `@vscode/vsce` and may require network access to download it. GitHub Actions runs syntax checks, tests, and VSIX packaging on pushes, pull requests and manual dispatch. After a successful workflow, download the **quick-cmd-vsix** artifact and use **Extensions → Install from VSIX...** in VS Code.

MIT licensed — see [LICENSE](LICENSE).
