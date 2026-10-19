// ============================================================================
// /api/account
//   GET    signed-in users: your profile (avatar, username, display name, cooldowns),
//          your roles, and for staff the state of the staff login
//   PATCH  change one field: { field: "username" | "displayName", value }
//
// Expected outcomes (name taken, cooldown running) answer 200 with ok: false, so the
// debug logs do not fill up with HTTP warnings for things that are normal to see.
// ============================================================================
import { getViewerRoles } from '../../../lib/logServer';
import { changeDisplayName, changeUsername, getUser, isSameOrigin, jsonBody, limit, readProfile, storageKind, withErrors } from '../../../lib/accountServer';
import { getStaffState } from '../../../lib/staffServer';
import { isVolatileHost } from '../../../lib/kvStore';

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = await getUser(req, res);
  if (!user) return res.status(401).json({ error: 'Log in to open your account' });

  if (req.method === 'GET') {
    const roles = await getViewerRoles(user.id);
    const { profile } = await readProfile(user);
    const staff = roles.staff ? await getStaffState(user, req) : null;
    return res.status(200).json({
      serverNow: Date.now(),
      storage: storageKind,
      volatile: isVolatileHost(),
      viewer: { id: user.id, staff: roles.staff, admin: roles.admin },
      profile,
      staff,
    });
  }

  if (req.method === 'PATCH') {
    if (!isSameOrigin(req)) return res.status(403).json({ error: 'Cross-site request refused' });
    const body = jsonBody(req);
    if (!body) return res.status(400).json({ error: 'Send JSON' });
    if ((await limit(`account:${user.id}`, 30, 60 * 1000)).limited) return res.status(429).json({ error: 'Too many requests' });

    let result;
    if (body.field === 'username') result = await changeUsername(user, body.value);
    else if (body.field === 'displayName') result = await changeDisplayName(user, body.value);
    else return res.status(400).json({ error: 'Unknown field' });
    return res.status(200).json({ ...result, serverNow: Date.now() });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withErrors('/api/account', handler);
