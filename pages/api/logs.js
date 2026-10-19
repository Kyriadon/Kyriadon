// ============================================================================
// /api/logs
//   POST    any visitor: store a batch of client events (user is taken from the session)
//   GET     signed-in users: list logs plus the viewer's roles and the current release
//   DELETE  staff only: delete by ids, by level, or everything (the deletion is logged)
// ============================================================================
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { VIEW_REQUIRES_ROLE, appendLogs, deleteLogs, getRelease, getViewerRoles, makeEntry, rateLimited, readLogs } from '../../lib/logServer';
import { STAFF_ACTIONS_REQUIRE_LOGIN, getStaffSession, listApprovals } from '../../lib/staffServer';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

// Parses a JSON string body safely (sendBeacon may deliver text)
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
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id || null;
  const user = session?.user ? { id: String(userId), name: String(session.user.name || 'Unknown').slice(0, 60) } : null;
  const release = getRelease();

  // Store client events
  if (req.method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    if (rateLimited(ip)) return res.status(429).json({ error: 'Too many log events' });
    const body = parseBody(req.body);
    const events = Array.isArray(body?.events) ? body.events.slice(0, 25) : [];
    // STAFF_ codes belong to the server (staff login and review). A browser cannot create look-alikes.
    const fromBrowser = (event) => (/^\s*STAFF_/i.test(String(event?.code ?? '')) ? { ...event, code: `CLIENT_${String(event.code).trim()}` } : event);
    await appendLogs(events.map((event) => makeEntry(fromBrowser(event), { user, release })));
    return res.status(202).json({ accepted: events.length });
  }

  // Everything below needs a signed-in user
  if (!userId) return res.status(401).json({ error: 'Log in to view logs' });
  const viewer = { id: String(userId), name: user.name, ...(await getViewerRoles(userId)) };

  // Optional role gate for viewing (see VIEW_REQUIRES_ROLE in lib/logServer.js)
  if (VIEW_REQUIRES_ROLE && !viewer.staff && !viewer.developer) {
    if (req.method === 'GET') await appendLogs([makeEntry({ level: 'warning', code: 'VIEW_DENIED', reason: `${user.name} tried to open the debug logs without the Staff or Developer role.` }, { user, release })]);
    return res.status(403).json({ error: 'You do not have access to the debug logs' });
  }

  // List logs
  if (req.method === 'GET') {
    let logs = await readLogs();
    // Staff logins and reviews are only for staff and admins
    if (!viewer.staff && !viewer.admin) logs = logs.filter((log) => !log.staffOnly);
    // Only admins see where a staff login came from, and which ones still wait for a review
    if (!viewer.admin) logs = logs.map((log) => (log.staffOnly && log.meta?.ip ? { ...log, meta: { ...log.meta, ip: undefined } } : log));
    else {
      const approvals = await listApprovals(100);
      logs = logs.map((log) => (approvals[log.id] ? { ...log, approval: approvals[log.id] } : log));
    }
    return res.status(200).json({ logs, viewer, release, serverTime: new Date().toISOString() });
  }

  // Delete logs (staff only)
  if (req.method === 'DELETE') {
    const body = parseBody(req.body) || {};
    if (!viewer.staff) {
      await appendLogs([makeEntry({ level: 'warning', code: 'DELETE_DENIED', reason: `${user.name} tried to delete logs without the Staff role.` }, { user, release })]);
      return res.status(403).json({ error: 'Only staff can delete logs' });
    }
    // Optional: deleting also needs an active staff session (see STAFF_ACTIONS_REQUIRE_LOGIN)
    if (STAFF_ACTIONS_REQUIRE_LOGIN && !viewer.admin && !(await getStaffSession(userId, req))) {
      return res.status(403).json({ error: 'Log in as staff from the Account menu to delete logs' });
    }
    const payload = {
      all: body.all === true,
      level: ['info', 'warning', 'error'].includes(body.level) ? body.level : undefined,
      ids: Array.isArray(body.ids) ? body.ids.slice(0, 500).map(String) : undefined,
      // Staff logins and reviews can only be deleted by admins, so nobody can erase their own trace
      keep: viewer.admin ? undefined : (log) => Boolean(log.staffOnly),
    };
    const deleted = await deleteLogs(payload);
    const scope = payload.all ? 'all logs' : payload.level ? `${payload.level} logs` : 'selected logs';
    await appendLogs([makeEntry({ level: 'info', code: 'LOGS_DELETED', reason: `${user.name} deleted ${deleted} log(s) (${scope}).` }, { user, release })]);
    return res.status(200).json({ deleted });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

// Catches anything the route throws: the error is stored as an API_ERROR log and the client gets a clean 500
export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (error) {
    try {
      await appendLogs([makeEntry({ level: 'error', code: 'API_ERROR', reason: `${req.method} /api/logs failed: ${error?.message || error}`, meta: { stack: String(error?.stack || '').slice(0, 1500) } }, { user: null, release: getRelease() })]);
    } catch {
      /* logging must never throw */
    }
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
    return undefined;
  }
}

