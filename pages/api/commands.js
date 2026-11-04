// ============================================================================
// /api/commands
//   POST  { prefix, command, args }  runs a server command of the debug logs Command panel.
//         Who may run it depends on the prefix (see roles in lib/commandRegistry.js):
//         staff and managers, admins, developers. The roles are checked here, not in the browser.
//         Every command that runs is logged, and so is every refused attempt.
// The commands themselves (names, colours, descriptions) live in lib/commandRegistry.js; the
// commands that only change the page (view, filter, search ...) are run in the browser.
// ============================================================================
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import {
  DEFAULT_LIMIT,
  LIMIT_MAX,
  LIMIT_MIN,
  appendLogs,
  countLogs,
  deleteLogs,
  describeLimiter,
  enforceLimiter,
  getRelease,
  getViewerRoles,
  makeEntry,
  rateLimited,
  readLogs,
  readSettings,
  storageType,
  writeSettings,
} from '../../lib/logServer';
import { STAFF_ACTIONS_REQUIRE_LOGIN, getStaffSession } from '../../lib/staffServer';
import { NOTE_COLORS, NOTE_VISIBILITY, NOTE_VISIBILITY_LABEL, canUsePrefix, findCommand, findPrefix, hasCommandAccess, rolesOf } from '../../lib/commandRegistry';
import { clearNotes, createNote, filterNotes, listNotes } from '../../lib/notesServer';

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

const DAY = 24 * 60 * 60 * 1000;
const LEVELS = { info: 'info', warning: 'warning', warnings: 'warning', error: 'error', errors: 'error' };
const AUDIENCES = { members: 'members', member: 'members', users: 'members', normal: 'members', everyone: 'members', staff: 'staff', '@staff': 'staff' };
const AUDIENCE_TEXT = { members: 'normal members', staff: 'staff and members' };

// An answer for the person who ran the command (status 400 by default)
class CommandError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Parses a JSON string body safely
const parseBody = (body) => {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// ----------------------------------------------------------------------------
// Parameters: key:value words after a command, for example  color:blue for:admin limit:5
// ----------------------------------------------------------------------------
const PARAM_ALIASES = { colour: 'color', visible: 'for', to: 'for', pin: 'pinned', by: 'author' };
const VISIBILITY_ALIASES = { all: 'all', everyone: 'all', staff: 'staff', manager: 'manager', managers: 'manager', dev: 'dev', devs: 'dev', developer: 'dev', developers: 'dev', admin: 'admin', admins: 'admin' };
const FETCH_KEYS = ['color', 'for', 'author', 'pinned', 'text', 'sort', 'limit'];
const NOTE_KEYS = ['color', 'for', 'pinned'];

// Splits the arguments into { params, text }. With leadingOnly the parameters only count at the
// start and everything after them is the text (the message of a note).
function readParams(args, { leadingOnly = false } = {}) {
  const params = {};
  const words = [];
  const tokens = args.split(/\s+/).filter(Boolean);
  let index = 0;
  for (; index < tokens.length; index += 1) {
    const match = /^([a-z-]+):(.*)$/i.exec(tokens[index]);
    if (!match) {
      if (leadingOnly) break;
      words.push(tokens[index]);
    } else {
      const key = match[1].toLowerCase();
      params[PARAM_ALIASES[key] || key] = match[2];
    }
  }
  if (leadingOnly) words.push(...tokens.slice(index));
  return { params, text: words.join(' ') };
}

// Checks one parameter value
const pick = (value, options, message) => {
  const found = String(value).toLowerCase();
  if (!options.includes(found)) throw new CommandError(message);
  return found;
};
const asVisibility = (value) => {
  const found = VISIBILITY_ALIASES[String(value).toLowerCase()];
  if (!found) throw new CommandError(`Visibility must be one of: ${NOTE_VISIBILITY.join(', ')}.`);
  return found;
};
const asYesNo = (value) => {
  const found = String(value).toLowerCase();
  if (['yes', 'y', 'true', 'on', '1'].includes(found)) return true;
  if (['no', 'n', 'false', 'off', '0'].includes(found)) return false;
  throw new CommandError('Use yes or no.');
};
const rejectUnknown = (params, allowed) => {
  const unknown = Object.keys(params).find((key) => !allowed.includes(key));
  if (unknown) throw new CommandError(`Unknown parameter "${unknown}:". Use ${allowed.join(', ')}.`);
};

// "just now", "5 min ago", "3 h ago", "2 days ago"
const ago = (time) => {
  const minutes = Math.floor(Math.max(0, Date.now() - time) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  const days = Math.floor(minutes / (60 * 24));
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

// One note as a line of the answer
const noteLine = (note) => {
  const text = note.text.replace(/\s+/g, ' ');
  return `${note.pinned ? '[pinned] ' : ''}${note.authorName} (${NOTE_VISIBILITY_LABEL[note.visibility || 'all']}, ${note.color}, ${ago(note.updatedAt)}): ${text.length > 140 ? `${text.slice(0, 140)}...` : text}`;
};

// Runs one command and returns { message, deleted?, reload? }
async function runCommand({ prefix, command, args, user, viewer, release, req }) {
  // Staff logins stay in the logs unless the person is also an admin (same rule as deleting in the controls)
  const keep = viewer.admin ? undefined : (log) => Boolean(log.staffOnly);
  const key = `${prefix.id}:${command.id}`;
  const words = args.split(/\s+/).filter(Boolean);

  switch (key) {
    // ---------------------------------------------------------------- delete (developers)
    case 'delete:reset-logs':
      return done(await deleteLogs({ all: true, keep }));
    case 'delete:errors':
    case 'delete:warnings':
    case 'delete:info':
      return done(await deleteLogs({ level: LEVELS[command.id], keep }));
    case 'delete:old': {
      const days = Math.min(Math.max(parseInt(args, 10) || 7, 1), 365);
      const cutoff = Date.now() - days * DAY;
      const ids = (await readLogs()).filter((log) => new Date(log.time).getTime() < cutoff).map((log) => log.id);
      return done(ids.length ? await deleteLogs({ ids, keep }) : 0);
    }
    case 'delete:code': {
      const ids = (await readLogs()).filter((log) => String(log.code).toUpperCase() === args.toUpperCase()).map((log) => log.id);
      return done(ids.length ? await deleteLogs({ ids, keep }) : 0);
    }
    case 'delete:user': {
      const wanted = args.toLowerCase();
      const ids = (await readLogs()).filter((log) => log.user && (String(log.user.name).toLowerCase() === wanted || String(log.user.id) === args)).map((log) => log.id);
      return done(ids.length ? await deleteLogs({ ids, keep }) : 0);
    }

    // ---------------------------------------------------------------- log (developers)
    case 'log:info':
    case 'log:warning':
    case 'log:error':
      await appendLogs([makeEntry({ level: command.id, code: 'DEV_COMMAND_LOG', reason: args }, { user, release })]);
      return { message: `Wrote an ${command.id} log.`, reload: true };

    // ---------------------------------------------------------------- stats
    case 'stats:ping':
      return { message: `Pong. Server time ${new Date().toISOString()}.` };

    // ---------------------------------------------------------------- staff
    // A sticky note on the staff board: @staff:note [color:blue] [for:admin] [pinned:yes] <message>
    case 'staff:note': {
      const { params, text } = readParams(args, { leadingOnly: true });
      rejectUnknown(params, NOTE_KEYS);
      if (!text) throw new CommandError('Write the note after the parameters, for example @staff:note for:admin Check the audit logs.');
      const result = await createNote(user, {
        text,
        color: params.color ? pick(params.color, NOTE_COLORS, `Colour must be one of: ${NOTE_COLORS.join(', ')}.`) : undefined,
        visibility: params.for ? asVisibility(params.for) : 'all',
        pinned: params.pinned ? asYesNo(params.pinned) : false,
      });
      if (!result.ok) throw new CommandError(result.error, result.status);
      const { note } = result;
      return { message: `Stuck a ${note.color} note on the board${note.pinned ? ' and pinned it' : ''}. ${note.visibility === 'all' ? 'Everyone with access can see it.' : `Only ${NOTE_VISIBILITY_LABEL[note.visibility].toLowerCase()} can see it (and its author).`}`, notes: true };
    }

    // Find sticky notes: @fetch:notes [color:..] [for:..] [author:me] [pinned:yes] [text:..] [sort:..] [limit:..]
    // (@staff:notes does the same). Only the notes this person may see are ever looked at.
    case 'fetch:notes':
    case 'staff:notes': {
      const { params, text } = readParams(args);
      rejectUnknown(params, FETCH_KEYS);
      const filters = {
        color: params.color ? pick(params.color, NOTE_COLORS, `Colour must be one of: ${NOTE_COLORS.join(', ')}.`) : undefined,
        visibility: params.for ? asVisibility(params.for) : undefined,
        pinned: params.pinned ? asYesNo(params.pinned) : undefined,
        sort: params.sort ? pick(params.sort, ['newest', 'oldest'], 'Sort must be newest or oldest.') : undefined,
        text: [params.text, text].filter(Boolean).join(' ').replace(/_/g, ' '),
      };
      if (params.author) {
        if (params.author.toLowerCase() === 'me') filters.authorId = user.id;
        else filters.author = params.author.replace(/_/g, ' ');
      }
      const limit = params.limit === undefined ? 10 : Number(params.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new CommandError('Limit must be a whole number from 1 to 20.');
      const visible = await listNotes({ ...viewer, id: user.id });
      const found = filterNotes(visible, filters);
      if (!found.length) return { message: visible.length ? `No notes match. You can see ${plural(visible.length, 'note')} in total.` : 'There are no notes you can see yet.' };
      const shown = found.slice(0, limit);
      return { message: [`${plural(found.length, 'note')} found${shown.length < found.length ? `, showing ${shown.length}` : ''} (you can see ${visible.length} in total):`, ...shown.map(noteLine)].join('\n') };
    }
    case 'staff:clear-info':
    case 'staff:clear-warnings':
    case 'staff:clear-errors': {
      // The same rule as deleting in the log controls: a staff login is needed when the site asks for it
      if (STAFF_ACTIONS_REQUIRE_LOGIN && !viewer.admin && !(await getStaffSession(user.id, req))) throw new CommandError('Log in as staff from the Account menu to delete logs.', 403);
      return done(await deleteLogs({ level: LEVELS[command.id.replace('clear-', '')], keep }));
    }

    // ---------------------------------------------------------------- admin
    case 'admin:wipe-all':
      return done(await deleteLogs({ all: true }));
    case 'admin:clear-staff-logs': {
      const ids = (await readLogs()).filter((log) => log.staffOnly).map((log) => log.id);
      return done(ids.length ? await deleteLogs({ ids }) : 0);
    }
    case 'admin:clear-notes':
      return { message: `Removed ${plural(await clearNotes(), 'note')} from the staff board.`, notes: true };

    // ---------------------------------------------------------------- toggle (admins)
    case 'toggle:level':
    case 'toggle:code': {
      const audience = AUDIENCES[String(words[0] || '').toLowerCase()];
      if (!audience) throw new CommandError('Say who it is for: members or staff.');
      const isLevel = command.id === 'level';
      const value = isLevel ? LEVELS[String(words[1] || '').toLowerCase()] : String(words[1] || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 60).toUpperCase();
      if (!value) throw new CommandError(isLevel ? 'Pick a level: info, warning or error.' : 'Write the log code.');
      const settings = await readSettings();
      const same = (rule) => rule.audience === audience && rule.kind === command.id && String(rule.value).toUpperCase() === value.toUpperCase();
      const hidden = settings.visibility.some(same);
      if (!hidden && settings.visibility.length >= 50) throw new CommandError('There are already 50 rules. Remove some with @toggle:reset.');
      const visibility = hidden ? settings.visibility.filter((rule) => !same(rule)) : [...settings.visibility, { audience, kind: command.id, value, by: user.name }];
      await writeSettings({ ...settings, visibility });
      const what = isLevel ? `${value} logs` : `Logs with the code ${value}`;
      return { message: hidden ? `${what} are visible again for ${AUDIENCE_TEXT[audience]}.` : `${what} are now hidden from ${AUDIENCE_TEXT[audience]}. Run the command again to show them.`, reload: true };
    }
    case 'toggle:status': {
      const { visibility } = await readSettings();
      if (!visibility.length) return { message: 'Nothing is hidden. Everyone sees the logs their role allows.' };
      return { message: ['Hidden logs:', ...visibility.map((rule) => `${rule.kind === 'level' ? `${rule.value} logs` : `code ${rule.value}`} are hidden from ${AUDIENCE_TEXT[rule.audience]}`)].join('\n') };
    }
    case 'toggle:reset': {
      const settings = await readSettings();
      await writeSettings({ ...settings, visibility: [] });
      return { message: 'Every hidden log is visible again.', reload: true };
    }

    // ---------------------------------------------------------------- dev
    case 'dev:set-limiter': {
      const limit = Number(words[0]);
      if (!Number.isInteger(limit) || limit < LIMIT_MIN || limit > LIMIT_MAX) throw new CommandError(`The limit must be a whole number from ${LIMIT_MIN} to ${LIMIT_MAX}.`);
      const whatWord = String(words[1] || 'oldest').toLowerCase();
      const what = whatWord === 'oldest' || whatWord === 'all' ? whatWord : LEVELS[whatWord];
      if (!what) throw new CommandError('What to delete must be oldest, all, info, warning or error.');
      const howWord = String(words[2] || 'trim').toLowerCase();
      if (!['trim', 'half', 'clear'].includes(howWord)) throw new CommandError('How to delete must be trim, half or clear.');
      const limiter = { limit, what, how: what === 'all' ? 'clear' : howWord, by: user.name, at: new Date().toISOString() };
      await writeSettings({ ...(await readSettings()), limiter });
      const removed = await enforceLimiter();
      return { message: `Limiter set. ${describeLimiter(limiter)}${removed ? ` Deleted ${plural(removed, 'log')} right now.` : ''}`, deleted: removed, reload: true };
    }
    case 'dev:limiter': {
      const { limiter } = await readSettings();
      return { message: `${describeLimiter(limiter)} Right now there are ${plural(await countLogs(), 'log')}.${limiter ? ` Set by ${limiter.by}.` : ''}` };
    }
    case 'dev:clear-limiter':
      await writeSettings({ ...(await readSettings()), limiter: null });
      return { message: `The limiter is gone. The newest ${DEFAULT_LIMIT} logs are kept.` };
    case 'dev:storage': {
      const { limiter } = await readSettings();
      return { message: `Logs are stored in ${storageType()}. There are ${plural(await countLogs(), 'log')}. ${describeLimiter(limiter)}` };
    }
    case 'dev:fake': {
      const level = LEVELS[String(words[0] || '').toLowerCase()];
      const count = Number(words[1]);
      if (!level) throw new CommandError('Pick a level: info, warning or error.');
      if (!Number.isInteger(count) || count < 1 || count > 100) throw new CommandError('Write how many, from 1 to 100.');
      await appendLogs(Array.from({ length: count }, (_, index) => makeEntry({ level, code: 'DEV_FAKE', reason: `Test ${level} log ${index + 1} of ${count} from the command panel.` }, { user, release })));
      return { message: `Wrote ${plural(count, `${level} test log`)}.`, reload: true };
    }
    case 'dev:reload-roles': {
      const fresh = await getViewerRoles(user.id, { fresh: true });
      const have = rolesOf(fresh);
      return { message: have.length ? `Roles checked again: ${have.join(', ')}.` : 'Roles checked again: you have no roles.', reload: true };
    }

    default:
      throw new CommandError('That command is not available.');
  }
}

// A delete command's answer
const done = (deleted) => ({ message: `Deleted ${plural(deleted, 'log')}.`, deleted, reload: true });

async function handleRequest(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id || null;
  if (!userId) return res.status(401).json({ error: 'Log in to use commands' });
  const user = { id: String(userId), name: String(session.user.name || 'Unknown').slice(0, 60) };
  const release = getRelease();
  const viewer = await getViewerRoles(userId);
  const denied = async (reason) => {
    await appendLogs([makeEntry({ level: 'warning', code: 'COMMAND_DENIED', reason }, { user, release })]);
    return res.status(403).json({ error: 'Your roles do not allow that command' });
  };

  // Staff, managers, admins and developers only
  if (!hasCommandAccess(viewer)) return denied(`${user.name} tried to run a command without a role that allows it.`);
  if (rateLimited(`command:${userId}`, 30, 60 * 1000)) return res.status(429).json({ error: 'Too many commands. Wait a moment' });

  // The command must exist, be a server command, and belong to a prefix of one of the person's roles
  const body = parseBody(req.body) || {};
  const prefix = findPrefix(body.prefix);
  const command = findCommand(prefix, body.command);
  if (!prefix || !command || command.where !== 'server') return res.status(400).json({ error: 'Unknown command' });
  const args = String(body.args ?? '').trim().slice(0, 300);
  const line = `@${prefix.id}:${command.id}${args ? ` ${args}` : ''}`;
  // Commands with private text (notes) never put that text in the logs
  const shown = command.secret ? `@${prefix.id}:${command.id} (text hidden)` : line;
  if (!canUsePrefix(prefix, viewer)) return denied(`${user.name} tried to run ${shown} without the role for it.`);
  if (command.required && !args) return res.status(400).json({ error: `Usage: @${prefix.id}:${command.id} ${command.args}` });

  try {
    const result = await runCommand({ prefix, command, args, user, viewer, release, req });
    const entry = makeEntry({ level: 'info', code: 'COMMAND_RUN', reason: `${user.name} ran ${shown}${result.deleted !== undefined ? ` (${result.deleted} deleted)` : ''}.` }, { user, release });
    if (command.secret) entry.staffOnly = true;
    await appendLogs([entry]);
    return res.status(200).json({ ok: true, ...result, serverTime: new Date().toISOString() });
  } catch (error) {
    if (error instanceof CommandError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
}

// Catches anything the route throws: the error is stored as an API_ERROR log and the client gets a clean 500
export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (error) {
    try {
      await appendLogs([makeEntry({ level: 'error', code: 'API_ERROR', reason: `${req.method} /api/commands failed: ${error?.message || error}` }, { user: null, release: getRelease() })]);
    } catch {
      /* logging must never throw */
    }
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
    return undefined;
  }
}
