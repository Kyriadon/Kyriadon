// ============================================================================
// commandRegistry.js
// The Command panel of the debug logs (developers only): every prefix and command with its
// colour and description, plus the parser, the colouring and the suggestions. Shared by the
// panel (components/commandPanel.js) and the server (pages/api/commands.js).
//
// A command looks like   @prefix:command   or   @prefix:command arguments
//   @delete:reset-logs        @search:for login        @log:warning Deploy started
// The @ always has the same colour, every prefix has its own, and the command has a light tint
// of its prefix colour. To add a command, add it to its prefix below and handle it in the
// panel (client commands) or in pages/api/commands.js (server commands).
//
// Every prefix lists the roles that may use it. The roles are the ones of getViewerRoles in
// lib/logServer.js: staff, manager, admin and developer. The server checks them again.
// ============================================================================

// The @ always has this colour
export const AT_COLOR = '#ff6fb5';
const MUTED = '#8a94a7';
const ARGS_COLOR = '#cbd5e1';

// The colour of a command: a light tint of its prefix colour
export const commandTint = (color) => `color-mix(in srgb, ${color} 42%, white)`;

// where: 'server' commands are run by /api/commands, 'client' commands by the panel itself.
// danger: asks to be run twice (the second Enter confirms).
// args: shown after the command in the guide; required: the command does nothing without them.
export const PREFIXES = [
  {
    id: 'delete',
    color: '#f87171',
    roles: ['developer'],
    who: 'Developers',
    title: 'Delete logs',
    commands: [
      { id: 'reset-logs', where: 'server', danger: true, desc: 'Delete every log' },
      { id: 'errors', where: 'server', danger: true, desc: 'Delete all error logs' },
      { id: 'warnings', where: 'server', danger: true, desc: 'Delete all warning logs' },
      { id: 'info', where: 'server', danger: true, desc: 'Delete all info logs' },
      { id: 'old', where: 'server', danger: true, args: '[days]', desc: 'Delete logs older than some days (7 if you leave it out)' },
      { id: 'code', where: 'server', danger: true, args: '<CODE>', required: true, desc: 'Delete every log with this code' },
      { id: 'user', where: 'server', danger: true, args: '<name or id>', required: true, desc: 'Delete every log of one user' },
    ],
  },
  {
    id: 'log',
    color: '#2dd4bf',
    roles: ['developer'],
    who: 'Developers',
    title: 'Write a log',
    commands: [
      { id: 'info', where: 'server', args: '<message>', required: true, desc: 'Write an info log' },
      { id: 'warning', where: 'server', args: '<message>', required: true, desc: 'Write a warning log' },
      { id: 'error', where: 'server', args: '<message>', required: true, desc: 'Write an error log' },
    ],
  },
  {
    id: 'stats',
    color: '#facc15',
    roles: ['staff', 'manager', 'admin', 'developer'],
    who: 'Staff, managers, admins and developers',
    title: 'Numbers',
    commands: [
      { id: 'logs', where: 'client', desc: 'Total logs and how many per level' },
      { id: 'today', where: 'client', desc: 'Logs of the last 24 hours' },
      { id: 'codes', where: 'client', desc: 'The most common log codes' },
      { id: 'users', where: 'client', desc: 'Who makes the most logs' },
      { id: 'pages', where: 'client', desc: 'The pages with the most logs' },
      { id: 'release', where: 'client', desc: 'The current release' },
      { id: 'ping', where: 'server', desc: 'How fast the server answers' },
    ],
  },
  {
    id: 'view',
    color: '#60a5fa',
    roles: ['staff', 'manager', 'admin', 'developer'],
    who: 'Staff, managers, admins and developers',
    title: 'Log view',
    commands: [
      { id: 'raw', where: 'client', desc: 'Show the logs as raw boxes' },
      { id: 'advanced', where: 'client', desc: 'Show the logs as cards' },
      { id: 'toggle', where: 'client', desc: 'Switch between raw and advanced' },
    ],
  },
  {
    id: 'filter',
    color: '#818cf8',
    roles: ['staff', 'manager', 'admin', 'developer'],
    who: 'Staff, managers, admins and developers',
    title: 'Level filter',
    commands: [
      { id: 'all', where: 'client', desc: 'Show every level' },
      { id: 'errors', where: 'client', desc: 'Only errors' },
      { id: 'warnings', where: 'client', desc: 'Only warnings' },
      { id: 'info', where: 'client', desc: 'Only info' },
      { id: 'reset', where: 'client', desc: 'Clear the filter and the search' },
    ],
  },
  {
    id: 'search',
    color: '#22d3ee',
    roles: ['staff', 'manager', 'admin', 'developer'],
    who: 'Staff, managers, admins and developers',
    title: 'Search',
    commands: [
      { id: 'for', where: 'client', args: '<text>', required: true, desc: 'Search everywhere in the logs' },
      { id: 'code', where: 'client', args: '<CODE>', required: true, desc: 'Search for a log code' },
      { id: 'user', where: 'client', args: '<name>', required: true, desc: 'Search for a user' },
      { id: 'page', where: 'client', args: '<path>', required: true, desc: 'Search for a page' },
      { id: 'clear', where: 'client', desc: 'Empty the search' },
    ],
  },
  {
    id: 'sort',
    color: '#c084fc',
    roles: ['staff', 'manager', 'admin', 'developer'],
    who: 'Staff, managers, admins and developers',
    title: 'Order',
    commands: [
      { id: 'newest', where: 'client', desc: 'Newest logs first' },
      { id: 'oldest', where: 'client', desc: 'Oldest logs first' },
      { id: 'errors-first', where: 'client', desc: 'Errors first, then warnings, then info' },
    ],
  },
  {
    id: 'limit',
    color: '#4ade80',
    roles: ['staff', 'manager', 'admin', 'developer'],
    who: 'Staff, managers, admins and developers',
    title: 'How many to show',
    commands: ['10', '25', '60', '100', '250', '500'].map((count) => ({ id: count, where: 'client', desc: `Show ${count} logs at a time` })).concat([{ id: 'all', where: 'client', desc: 'Show every log' }]),
  },
  {
    id: 'export',
    color: '#fb923c',
    roles: ['staff', 'manager', 'admin', 'developer'],
    who: 'Staff, managers, admins and developers',
    title: 'Download',
    commands: [
      { id: 'json', where: 'client', desc: 'Download the shown logs as JSON' },
      { id: 'csv', where: 'client', desc: 'Download the shown logs as CSV' },
      { id: 'txt', where: 'client', desc: 'Download the shown logs as text' },
      { id: 'jsonl', where: 'client', desc: 'Download the shown logs as JSON lines' },
      { id: 'copy', where: 'client', desc: 'Copy the shown logs as JSON' },
    ],
  },
  {
    id: 'refresh',
    color: '#a3e635',
    roles: ['staff', 'manager', 'admin', 'developer'],
    who: 'Staff, managers, admins and developers',
    title: 'Refresh',
    commands: [
      { id: 'logs', where: 'client', desc: 'Load the logs again now' },
      { id: 'page', where: 'client', desc: 'Reload the whole page' },
    ],
  },
  {
    id: 'staff',
    color: '#d6a77a',
    roles: ['staff', 'manager', 'admin', 'developer'],
    who: 'Staff and managers (admins and developers too)',
    title: 'Staff tools',
    commands: [
      { id: 'me', where: 'client', desc: 'Show only the logs you caused' },
      { id: 'logins', where: 'client', desc: 'Show staff logins and reviews' },
      { id: 'note', where: 'server', args: '<message>', required: true, desc: 'Write a note that only staff and admins can see' },
      { id: 'clear-info', where: 'server', danger: true, desc: 'Delete all info logs (like the controls)' },
      { id: 'clear-warnings', where: 'server', danger: true, desc: 'Delete all warning logs (like the controls)' },
      { id: 'clear-errors', where: 'server', danger: true, desc: 'Delete all error logs (like the controls)' },
    ],
  },
  {
    id: 'admin',
    color: '#e879f9',
    roles: ['admin'],
    who: 'Admins',
    title: 'Admin tools',
    commands: [
      { id: 'wipe-all', where: 'server', danger: true, desc: 'Delete every log, staff logins and reviews too' },
      { id: 'clear-staff-logs', where: 'server', danger: true, desc: 'Delete only the staff logins and reviews' },
      { id: 'audit', where: 'client', desc: 'Show every command that was run' },
      { id: 'denied', where: 'client', desc: 'Show every refused attempt' },
    ],
  },
  {
    id: 'dev',
    color: '#34d399',
    roles: ['developer'],
    who: 'Developers',
    title: 'Developer tools',
    commands: [
      { id: 'set-limiter', where: 'server', danger: true, args: '<10-5000> [what] [how]', required: true, desc: 'Limit the logs. what: oldest, all, info, warning or error. how: trim, half or clear' },
      { id: 'limiter', where: 'server', desc: 'Show the limiter and how many logs there are' },
      { id: 'clear-limiter', where: 'server', desc: 'Remove the limiter (the newest 2000 logs are kept)' },
      { id: 'storage', where: 'server', desc: 'Where the logs are stored, and how many' },
      { id: 'fake', where: 'server', args: '<info|warning|error> <1-100>', required: true, desc: 'Write test logs' },
      { id: 'reload-roles', where: 'server', desc: 'Check your roles again right now' },
    ],
  },
  {
    id: 'toggle',
    color: '#fb7185',
    roles: ['admin'],
    who: 'Admins',
    title: 'Who sees which logs',
    commands: [
      { id: 'level', where: 'server', args: '<members|staff> <info|warning|error>', required: true, desc: 'Hide or show a level for members or staff. Run it again to undo' },
      { id: 'code', where: 'server', args: '<members|staff> <CODE>', required: true, desc: 'Hide or show one log code for members or staff' },
      { id: 'status', where: 'server', desc: 'List what is hidden from whom' },
      { id: 'reset', where: 'server', desc: 'Show everything to everyone again' },
    ],
  },
  {
    id: 'help',
    color: '#e2e8f0',
    roles: ['staff', 'manager', 'admin', 'developer'],
    who: 'Staff, managers, admins and developers',
    title: 'Help',
    commands: [
      { id: 'all', where: 'client', desc: 'List every prefix' },
      { id: 'prefixes', where: 'client', desc: 'List every prefix with its commands' },
      { id: 'shortcuts', where: 'client', desc: 'Keys that work in the panel' },
      { id: 'whoami', where: 'client', desc: 'Your roles, and what they let you use' },
    ],
  },
  {
    id: 'clear',
    color: '#94a3b8',
    roles: ['staff', 'manager', 'admin', 'developer'],
    who: 'Staff, managers, admins and developers',
    title: 'Tidy up',
    commands: [
      { id: 'output', where: 'client', desc: 'Empty this screen' },
      { id: 'history', where: 'client', desc: 'Forget the commands you ran' },
      { id: 'search', where: 'client', desc: 'Empty the search' },
    ],
  },
];

// Does the viewer ({ staff, manager, admin, developer }) have one of the roles of this prefix?
export const canUsePrefix = (prefix, viewer) => Boolean(prefix && viewer && prefix.roles.some((role) => viewer[role]));

// The prefixes a viewer may use
export const usablePrefixes = (viewer) => PREFIXES.filter((prefix) => canUsePrefix(prefix, viewer));

// Can the viewer open the Command panel at all?
export const hasCommandAccess = (viewer) => usablePrefixes(viewer).length > 0;

// The roles a viewer has, as words
export const rolesOf = (viewer) => ['staff', 'manager', 'admin', 'developer'].filter((role) => viewer?.[role]);

export const findPrefix = (id) => PREFIXES.find((prefix) => prefix.id === String(id || '').toLowerCase());
export const findCommand = (prefix, id) => (prefix ? prefix.commands.find((command) => command.id === String(id || '').toLowerCase()) : undefined);

// Reads a command line. { ok: true, prefix, command, args } (command is null for a bare prefix)
// or { ok: false, error }.
export function parseCommand(line, viewer) {
  const text = String(line ?? '').trim();
  if (!text) return { ok: false, error: 'Type a command, for example @help' };
  if (!text.startsWith('@')) return { ok: false, error: 'Commands start with @. Try @help' };
  const match = /^@([a-z]+)(?::([a-z0-9-]+))?(?:\s+([\s\S]*))?$/i.exec(text);
  if (!match) return { ok: false, error: 'That is not a command. Use @prefix:command, for example @delete:reset-logs' };
  const prefix = findPrefix(match[1]);
  if (!prefix || (viewer && !canUsePrefix(prefix, viewer))) return { ok: false, error: prefix ? `@${prefix.id} is for ${prefix.who.toLowerCase()}. Your roles do not include it` : `Unknown prefix @${match[1].toLowerCase()}. Type @help:prefixes to see them all` };
  if (!match[2]) return { ok: true, prefix, command: null, args: '' };
  const command = findCommand(prefix, match[2]);
  if (!command) return { ok: false, error: `@${prefix.id} has no command "${match[2].toLowerCase()}". Type @${prefix.id} to see its commands` };
  return { ok: true, prefix, command, args: (match[3] || '').trim() };
}

// Splits a line into coloured pieces: [{ text, color }]. Colours appear while you type: a
// half-typed prefix already has the colour of the prefix it starts.
export function tokenize(line) {
  const text = String(line ?? '');
  if (!text) return [];
  const match = /^(\s*)(@)([a-z]*)(:?)([a-z0-9-]*)(\s*)([\s\S]*)$/i.exec(text);
  if (!match) return [{ text, color: MUTED }];
  const [, lead, at, typedPrefix, colon, typedCommand, space, rest] = match;
  const tokens = [];
  if (lead) tokens.push({ text: lead, color: MUTED });
  tokens.push({ text: at, color: AT_COLOR });
  const exact = findPrefix(typedPrefix);
  const partial = typedPrefix ? PREFIXES.find((prefix) => prefix.id.startsWith(typedPrefix.toLowerCase())) : null;
  const known = exact || partial;
  if (typedPrefix) tokens.push({ text: typedPrefix, color: known ? known.color : MUTED });
  if (colon) tokens.push({ text: colon, color: MUTED });
  if (typedCommand) {
    const lower = typedCommand.toLowerCase();
    const knownCommand = exact && (findCommand(exact, lower) || exact.commands.find((command) => command.id.startsWith(lower)));
    tokens.push({ text: typedCommand, color: knownCommand ? commandTint(exact.color) : MUTED });
  }
  if (space) tokens.push({ text: space, color: MUTED });
  if (rest) tokens.push({ text: rest, color: ARGS_COLOR });
  return tokens;
}

// Suggestions for the line being typed: prefixes first, then the commands of the prefix.
// Each is { insert, kind, color, desc }.
export function suggest(line, viewer) {
  const text = String(line ?? '').trimStart();
  const allowed = viewer ? usablePrefixes(viewer) : PREFIXES;
  if (!text) return allowed.map((prefix) => ({ insert: `@${prefix.id}:`, kind: 'prefix', color: prefix.color, desc: prefix.title }));
  if (!text.startsWith('@') || /\s/.test(text)) return [];
  const colonAt = text.indexOf(':');
  if (colonAt === -1) {
    const typed = text.slice(1).toLowerCase();
    return allowed.filter((prefix) => prefix.id.startsWith(typed)).map((prefix) => ({ insert: `@${prefix.id}:`, kind: 'prefix', color: prefix.color, desc: prefix.title }));
  }
  const prefix = findPrefix(text.slice(1, colonAt));
  if (!prefix || !allowed.includes(prefix)) return [];
  const typed = text.slice(colonAt + 1).toLowerCase();
  return prefix.commands
    .filter((command) => command.id.startsWith(typed) && !(command.id === typed && !command.args))
    .map((command) => ({ insert: `@${prefix.id}:${command.id}${command.args ? ' ' : ''}`, kind: 'command', color: prefix.color, desc: command.desc }));
}
