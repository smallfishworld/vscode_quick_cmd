# Quick Cmd v0.3.0

## What's new

- **Inline command editor** in the Quick Cmd activity bar. Create and edit commands in
  one sidebar form instead of clicking through several Quick Input dialogs.
- **Native drag-and-drop ordering** of groups and commands, including moving a
  command into another group in the same configuration scope.
- **Multiple command steps** in a single saved command (up to 32 steps).
- **"换行执行" checkbox** alongside each step. The final unchecked step is
  inserted into the integrated terminal **without a trailing Enter**.
- **Backwards compatibility** with v0.1/v0.2 `command` configuration.

## Notes

Steps are sent together as a newline-delimited shell input. Avoid combining
interactive commands that consume stdin. Only the last step may leave the
"Send Enter" checkbox unchecked.

## Verify

- `npm run check`
- `npm test`
- GitHub Actions packages `quick-cmd-v0.3.0.vsix`.

Install the `.vsix` from the GitHub Release assets using VS Code's
**Extensions → ... → Install from VSIX**.
