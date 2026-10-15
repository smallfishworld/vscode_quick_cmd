'use strict';
const shared = require('../media/i18n');
const { quickCmdBuildLanguage } = require('../package.json');

/** Release variants pin their language; development follows the VS Code locale. */
function resolveLocale(hostLocale) {
  return quickCmdBuildLanguage || hostLocale || 'en';
}
module.exports = {
  ...shared,
  resolveLocale,
  setLocale: (locale) => shared.setLocale(resolveLocale(locale)),
};
