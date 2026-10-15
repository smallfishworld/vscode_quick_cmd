import * as path from 'node:path';
import {ConfigError} from './model';

export interface VariableContext {
  workspaceFolder?: string;
  file?: string;
  env?: NodeJS.ProcessEnv;
}

/** Substitute supported variables. Unknown ${...} fragments remain shell expressions. */
export function resolveVariables(input: string, context: VariableContext): string {
  const file = context.file;
  const folder = context.workspaceFolder;
  const basename = file ? path.basename(file) : undefined;
  const values: Record<string, string | undefined> = {
    workspaceFolder: folder,
    workspaceFolderBasename: folder ? path.basename(folder) : undefined,
    file,
    fileBasename: basename,
    fileBasenameNoExtension: basename ? path.parse(basename).name : undefined,
    fileDirname: file ? path.dirname(file) : undefined,
    relativeFile: file && folder ? path.relative(folder, file) : undefined
  };
  return input.replace(/\$\{([^}]+)\}/g, (match, key: string) => {
    if (key.startsWith('env:')) {
      const envKey = key.slice(4);
      if (!envKey) { throw new ConfigError('Empty environment variable name'); }
      const result = (context.env ?? process.env)[envKey];
      if (result === undefined) { throw new ConfigError(`Environment variable is not set: ${envKey}`); }
      return result;
    }
    if (!Object.prototype.hasOwnProperty.call(values, key)) { return match; }
    if (values[key] === undefined) { throw new ConfigError(`Unavailable variable: ${key}`); }
    return values[key];
  });
}
