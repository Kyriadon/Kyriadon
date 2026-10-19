// ============================================================================
// /api/account/avatar
//   POST    save a new avatar: { image: "data:image/png;base64,..." }
//   DELETE  go back to the Discord avatar
// The browser crops and shrinks the image first; the server checks it again.
// ============================================================================
import { getUser, isSameOrigin, jsonBody, limit, removeAvatar, saveAvatar, withErrors } from '../../../../lib/accountServer';

export const config = { api: { bodyParser: { sizeLimit: '400kb' } } };

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = await getUser(req, res);
  if (!user) return res.status(401).json({ error: 'Log in to change your avatar' });

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSameOrigin(req)) return res.status(403).json({ error: 'Cross-site request refused' });
  if ((await limit(`avatarreq:${user.id}`, 30, 60 * 1000)).limited) return res.status(429).json({ error: 'Too many requests' });

  if (req.method === 'DELETE') return res.status(200).json(await removeAvatar(user));

  const body = jsonBody(req);
  if (!body) return res.status(400).json({ error: 'Send JSON' });
  return res.status(200).json(await saveAvatar(user, body.image));
}

export default withErrors('/api/account/avatar', handler);
