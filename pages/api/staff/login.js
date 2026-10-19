// ============================================================================
// /api/staff/login
//   POST    staff only: log in with your staff password { password }
//   DELETE  staff only: end your own staff session
// The password is compared on the server against the Vercel environment variables
// STAFF_PASSWORDS / STAFF_PASSWORD. It is never sent to the browser and never logged.
// Expected outcomes (wrong password, blocked, locked) answer 200 with ok: false.
// ============================================================================
import { getViewerRoles } from '../../../lib/logServer';
import { getUser, isSameOrigin, jsonBody, limit, withErrors } from '../../../lib/accountServer';
import { isVolatileHost } from '../../../lib/kvStore';
import { getStaffState, staffLogSafe, staffLogin, staffLogout } from '../../../lib/staffServer';

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = await getUser(req, res);
  if (!user) return res.status(401).json({ error: 'Log in first' });

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSameOrigin(req)) return res.status(403).json({ error: 'Cross-site request refused' });
  if ((await limit(`staffreq:${user.id}`, 40, 60 * 1000)).limited) return res.status(429).json({ error: 'Too many requests' });

  // The role is checked against Discord right now, not from the 60 second cache
  const roles = await getViewerRoles(user.id, { fresh: true });
  if (!roles.staff) {
    if (!(await limit(`staffdeny:${user.id}`, 1, 5 * 60 * 1000)).limited) await staffLogSafe({ level: 'warning', code: 'STAFF_LOGIN_DENIED', reason: `${user.name} tried to use the staff login without the Staff role.`, user });
    return res.status(403).json({ error: 'Only staff can use this' });
  }

  // Sessions, blocks and approvals must be shared by every server instance
  if (isVolatileHost()) return res.status(200).json({ ok: false, code: 'storage', message: 'Staff login needs the Upstash Redis database to be connected to this project.' });

  if (req.method === 'DELETE') {
    const result = await staffLogout(req, res, user);
    return res.status(200).json({ ...result, staff: await getStaffState(user, req).then((state) => ({ ...state, loggedIn: false, since: null, expiresAt: null })) });
  }

  const body = jsonBody(req);
  if (!body) return res.status(400).json({ error: 'Send JSON' });
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) return res.status(200).json({ ok: false, code: 'empty', message: 'Enter your staff password.' });

  const result = await staffLogin(req, res, user, password);
  if (result.ok && !result.already) {
    // The cookie was only just set, so the state is built here instead of read back
    return res.status(200).json({ ...result, staff: { configured: true, loggedIn: true, since: result.since, expiresAt: result.expiresAt, blocked: null, notice: null } });
  }
  return res.status(200).json({ ...result, staff: await getStaffState(user, req) });
}

export default withErrors('/api/staff/login', handler, { staffOnly: true });
