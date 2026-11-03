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
import { canUsePrefix, findCommand, findPrefix, hasCommandAccess, rolesOf } from '../../lib/commandRegistry';

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
    case 'staff:note': {
      // A note only staff and admins can see (the same flag the staff logins use)
      const entry = makeEntry({ level: 'info', code: 'STAFF_NOTE', reason: args }, { user, release });
      entry.staffOnly = true;
      await appendLogs([entry]);
      return { message: 'Wrote a staff note. Only staff and admins can see it.', reload: true };
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
  if (!canUsePrefix(prefix, viewer)) return denied(`${user.name} tried to run ${line} without the role for it.`);
  if (command.required && !args) return res.status(400).json({ error: `Usage: @${prefix.id}:${command.id} ${command.args}` });

  try {
    const result = await runCommand({ prefix, command, args, user, viewer, release, req });
    await appendLogs([makeEntry({ level: 'info', code: 'COMMAND_RUN', reason: `${user.name} ran ${line}${result.deleted !== undefined ? ` (${result.deleted} deleted)` : ''}.` }, { user, release })]);
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
