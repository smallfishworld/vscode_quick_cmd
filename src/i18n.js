'use strict';

const shared = require('../media/i18n');

/** UI locale comes from VS Code; Chinese variants use Chinese, otherwise English. */
function resolveLocale(hostLocale) {
  return hostLocale || 'en';
}

module.exports = {
  ...shared,
  resolveLocale,
  setLocale: (hostLocale) => shared.setLocale(resolveLocale(hostLocale)),
};
