'use strict';
const GROUP_SCHEME = 'quick-cmd-group';
const GROUP_COLOR = 'quickCmd.groupForeground';

/** Decorates only group resources; commands keep their normal foreground. */
class GroupDecorationProvider {
  constructor(vscode) {
    this.vscode = vscode;
  }
  provideFileDecoration(uri) {
    if (uri.scheme !== GROUP_SCHEME) {
      return undefined;
    }
    return { color: new this.vscode.ThemeColor(GROUP_COLOR), propagate: false };
  }
}
module.exports = { GroupDecorationProvider, GROUP_SCHEME, GROUP_COLOR };
