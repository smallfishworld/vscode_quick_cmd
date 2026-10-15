/** Persistent JSON model used by both the GUI and the configuration file. */
export type TerminalPolicy = 'reuse' | 'new';

export interface CommandDefinition {
  id: string;
  name: string;
  command: string;
  description?: string;
  cwd?: string;
  terminal?: TerminalPolicy;
  confirm?: boolean;
  enabled?: boolean;
}

export interface CommandGroup {
  id: string;
  name: string;
  commands: CommandDefinition[];
}

export interface CommandFile {
  version: 1;
  groups: CommandGroup[];
}

/** Human-readable error without leaking secrets from a command body. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ConfigError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ConfigError(`${label} must be a non-empty string`);
  }
  return value;
}

function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined) { return undefined; }
  if (typeof value !== 'string') { throw new ConfigError(`${label} must be a string`); }
  return value;
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) { return undefined; }
  if (typeof value !== 'boolean') { throw new ConfigError(`${label} must be a boolean`); }
  return value;
}

/** Validate external configuration before allowing its content to be executed or modified. */
export function parseGroups(value: unknown): CommandGroup[] {
  if (!Array.isArray(value)) { throw new ConfigError('groups must be an array'); }
  const groupIds = new Set<string>();
  const commandIds = new Set<string>();
  return value.map((raw, gi) => {
    const group = record(raw, `groups[${gi}]`);
    const id = text(group.id, `groups[${gi}].id`);
    if (groupIds.has(id)) { throw new ConfigError(`Duplicate group id: ${id}`); }
    groupIds.add(id);
    const name = text(group.name, `groups[${gi}].name`);
    if (!Array.isArray(group.commands)) { throw new ConfigError(`groups[${gi}].commands must be an array`); }
    const commands = group.commands.map((rawCommand: unknown, ci: number) => {
      const label = `groups[${gi}].commands[${ci}]`;
      const item = record(rawCommand, label);
      const commandId = text(item.id, `${label}.id`);
      if (commandIds.has(commandId)) { throw new ConfigError(`Duplicate command id: ${commandId}`); }
      commandIds.add(commandId);
      const terminal = optionalText(item.terminal, `${label}.terminal`);
      if (terminal !== undefined && terminal !== 'reuse' && terminal !== 'new') {
        throw new ConfigError(`${label}.terminal must be "reuse" or "new"`);
      }
      return {
        id: commandId,
        name: text(item.name, `${label}.name`),
        command: text(item.command, `${label}.command`),
        description: optionalText(item.description, `${label}.description`),
        cwd: optionalText(item.cwd, `${label}.cwd`),
        terminal: terminal as TerminalPolicy | undefined,
        confirm: optionalBoolean(item.confirm, `${label}.confirm`),
        enabled: optionalBoolean(item.enabled, `${label}.enabled`)
      };
    });
    return {id, name, commands};
  });
}

export function parseCommandFile(value: unknown): CommandFile {
  const root = record(value, 'configuration');
  if (root.version !== 1) { throw new ConfigError('Unsupported configuration version (expected 1)'); }
  return {version: 1, groups: parseGroups(root.groups)};
}
