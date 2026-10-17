'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validateConfig } = require('./model');

/** Load packaged examples as initial data; never read from project folders. */
function loadDefaultConfig(extensionPath, locale) {
  if (typeof extensionPath !== 'string' || !extensionPath) {
    throw new Error('Quick Cmd extension installation path is unavailable.');
  }
  const language = /^zh(?:-|$)/i.test(locale || '') ? 'zh-CN' : 'en';
  const filename = path.join(extensionPath, 'presets', `defaults.${language}.json`);
  return validateConfig(JSON.parse(fs.readFileSync(filename, 'utf8')));
}

module.exports = { loadDefaultConfig };
