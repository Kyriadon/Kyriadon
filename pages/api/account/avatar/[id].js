// ============================================================================
// /api/account/avatar/[id]
// Serves a saved avatar. The URL carries a version (?v=), so browsers may cache it
// for a year: a new avatar gets a new URL.
// ============================================================================
import { readAvatar, withErrors } from '../../../../lib/accountServer';

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const id = String(req.query.id || '');
  if (!/^\d{5,25}$/.test(id)) return res.status(404).end();
  const base64 = await readAvatar(id);
  if (!base64) return res.status(404).end();

  const image = Buffer.from(base64, 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', image.length);
  // Whatever was uploaded can only ever be shown as a picture
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'no-cache');
  return res.status(200).send(req.method === 'HEAD' ? undefined : image);
}

export default withErrors('/api/account/avatar', handler);
