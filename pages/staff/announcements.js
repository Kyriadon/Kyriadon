// ============================================================================
// /api/staff/announcements  (the Announcements manager)
//   GET     every announcement with its views and favourites, plus the statistics
//   POST    create an announcement
//   PUT     edit one { id, expectedUpdatedAt, ...fields }
//   DELETE  delete one { id }
// Staff need the Staff role and an active staff login (admins only need the role). Staff can
// edit and delete the announcements they created, admins any of them. Every change is a log.
// Expected outcomes (a field is wrong, not allowed) answer 200 with ok: false.
// ============================================================================
import { jsonBody, withErrors } from '../../../lib/accountServer';
import { authorizeManager, createAnnouncement, deleteAnnouncement, managerSnapshot, updateAnnouncement } from '../../../lib/announcementsServer';
import { isVolatileHost, storageKind } from '../../../lib/kvStore';

export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };

async function handler(req, res) {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await authorizeManager(req, res, { write: req.method !== 'GET' });
  if (!auth) return undefined;
  const { user, roles } = auth;

  if (req.method === 'GET') {
    const snapshot = await managerSnapshot(user, roles);
    return res.status(200).json({ ...snapshot, viewer: { id: user.id, name: user.name, staff: roles.staff, admin: roles.admin }, volatile: isVolatileHost(), storage: storageKind, serverNow: Date.now() });
  }

  // Announcements must be shared by every server instance
  if (isVolatileHost()) return res.status(200).json({ ok: false, code: 'storage', message: 'Announcements need the Upstash Redis database to be connected to this project.' });

  const body = jsonBody(req);
  if (!body) return res.status(400).json({ error: 'Send JSON' });

  let result;
  if (req.method === 'POST') result = await createAnnouncement(user, body);
  else if (req.method === 'PUT') result = await updateAnnouncement(user, roles, String(body.id || ''), body, body.expectedUpdatedAt);
  else result = await deleteAnnouncement(user, roles, String(body.id || ''));
  return res.status(200).json(result);
}

export default withErrors('/api/staff/announcements', handler, { staffOnly: true });
