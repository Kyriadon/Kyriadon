// ============================================================================
// /api/commands
//   POST  { prefix, command, args }  runs a server command of the debug logs Command panel.
//         Only users with the Developer role can use it. Every command that runs is logged.
// The commands themselves (names, colours, descriptions) live in lib/commandRegistry.js; the
// commands that only change the page (view, filter, search ...) are run in the browser.
// ============================================================================
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { appendLogs, deleteLogs, getRelease, getViewerRoles, makeEntry, rateLimited, readLogs } from '../../lib/logServer';
import { findCommand, findPrefix } from '../../lib/commandRegistry';

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

const DAY = 24 * 60 * 60 * 1000;
const LEVEL_OF = { errors: 'error', warnings: 'warning', info: 'info' };

// Parses a JSON string body safely
const parseBody = (body) => {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

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

  // Developers only
  if (!viewer.developer) {
    await appendLogs([makeEntry({ level: 'warning', code: 'COMMAND_DENIED', reason: `${user.name} tried to run a command without the Developer role.` }, { user, release })]);
    return res.status(403).json({ error: 'Only developers can run commands' });
  }
  if (rateLimited(`command:${userId}`, 30, 60 * 1000)) return res.status(429).json({ error: 'Too many commands. Wait a moment' });

  // The command must exist and be a server command
  const body = parseBody(req.body) || {};
  const prefix = findPrefix(body.prefix);
  const command = findCommand(prefix, body.command);
  if (!prefix || !command || command.where !== 'server') return res.status(400).json({ error: 'Unknown command' });
  const args = String(body.args ?? '').trim().slice(0, 300);
  if (command.required && !args) return res.status(400).json({ error: `Usage: @${prefix.id}:${command.id} ${command.args}` });
  const line = `@${prefix.id}:${command.id}${args ? ` ${args}` : ''}`;

  // Staff logins stay in the logs unless the developer is also an admin (same rule as deleting in the controls)
  const keep = viewer.admin ? undefined : (log) => Boolean(log.staffOnly);
  let message = '';
  let deleted;

  if (prefix.id === 'delete') {
    if (command.id === 'reset-logs') deleted = await deleteLogs({ all: true, keep });
    else if (LEVEL_OF[command.id]) deleted = await deleteLogs({ level: LEVEL_OF[command.id], keep });
    else {
      const logs = await readLogs();
      let ids = [];
      if (command.id === 'old') {
        const days = Math.min(Math.max(parseInt(args, 10) || 7, 1), 365);
        const cutoff = Date.now() - days * DAY;
        ids = logs.filter((log) => new Date(log.time).getTime() < cutoff).map((log) => log.id);
      } else if (command.id === 'code') {
        ids = logs.filter((log) => String(log.code).toUpperCase() === args.toUpperCase()).map((log) => log.id);
      } else if (command.id === 'user') {
        const wanted = args.toLowerCase();
        ids = logs.filter((log) => log.user && (String(log.user.name).toLowerCase() === wanted || String(log.user.id) === args)).map((log) => log.id);
      }
      deleted = ids.length ? await deleteLogs({ ids, keep }) : 0;
    }
    message = `Deleted ${deleted} log${deleted === 1 ? '' : 's'}.`;
  } else if (prefix.id === 'log') {
    await appendLogs([makeEntry({ level: command.id, code: 'DEV_COMMAND_LOG', reason: args }, { user, release })]);
    message = `Wrote an ${command.id} log.`;
  } else if (prefix.id === 'stats' && command.id === 'ping') {
    message = `Pong. Server time ${new Date().toISOString()}.`;
  }

  await appendLogs([makeEntry({ level: 'info', code: 'COMMAND_RUN', reason: `${user.name} ran ${line}${deleted !== undefined ? ` (${deleted} deleted)` : ''}.` }, { user, release })]);
  return res.status(200).json({ ok: true, message, deleted, serverTime: new Date().toISOString() });
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
