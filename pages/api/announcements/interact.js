// ============================================================================
// /api/announcements/interact
//   POST  { action: "favourite" | "unfavourite" | "view", id }
//         favourite and unfavourite need a signed-in user, view counts once per person
//         (or address) every 6 hours. Expected outcomes answer 200 with ok: false.
// ============================================================================
import crypto from 'crypto';
import { getUser, isSameOrigin, jsonBody, limit, withErrors } from '../../../lib/accountServer';
import { isValidId, recordView, setFavourite } from '../../../lib/announcementsServer';
import { isVolatileHost } from '../../../lib/kvStore';

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSameOrigin(req)) return res.status(403).json({ error: 'Cross-site request refused' });
  const body = jsonBody(req);
  if (!body) return res.status(400).json({ error: 'Send JSON' });

  const action = String(body.action || '');
  const id = String(body.id || '');
  if (!['favourite', 'unfavourite', 'view'].includes(action) || !isValidId(id)) return res.status(400).json({ error: 'Unknown request' });

  const user = await getUser(req, res);
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if ((await limit(`anninteract:${user ? user.id : ip}`, 90, 60 * 1000)).limited) return res.status(429).json({ error: 'Too many requests' });

  // A view needs no account. The address is hashed, so it is never stored as it is.
  if (action === 'view') {
    const who = user ? user.id : crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
    return res.status(200).json({ ok: true, counted: await recordView(id, who) });
  }

  if (!user) return res.status(200).json({ ok: false, code: 'login', message: 'Log in to favourite announcements.' });
  if (isVolatileHost()) return res.status(200).json({ ok: false, code: 'storage', message: 'Favourites need the Upstash Redis database to be connected to this project.' });
  return res.status(200).json(await setFavourite(user, id, action === 'favourite'));
}

export default withErrors('/api/announcements/interact', handler);
