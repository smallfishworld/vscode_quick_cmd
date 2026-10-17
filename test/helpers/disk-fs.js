'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const uri = fsPath => ({ fsPath });
const wrap = fn => async (...args) => {
  try { return await fn(...args); }
  catch (error) { if (error.code === 'ENOENT') error.code = 'FileNotFound'; throw error; }
};
function diskApi() {
  return {
    Uri: { joinPath: (base, ...parts) => uri(path.join(base.fsPath, ...parts)) },
    workspace: { fs: {
      stat: wrap(file => fs.stat(file.fsPath)),
      createDirectory: directory => fs.mkdir(directory.fsPath, { recursive: true }),
      readDirectory: wrap(async directory => (await fs.readdir(directory.fsPath)).map(name => [name, 1])),
      readFile: wrap(file => fs.readFile(file.fsPath)),
      writeFile: (file, bytes) => fs.writeFile(file.fsPath, bytes),
      rename: wrap((from, to) => fs.rename(from.fsPath, to.fsPath)),
      delete: wrap(file => fs.unlink(file.fsPath)),
    } },
  };
}
module.exports = { diskApi };
