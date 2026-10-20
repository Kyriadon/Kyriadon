// ============================================================================
// /api/announcements/media/[id]
//   GET  an image or video that staff uploaded for an announcement. The id is random and
//        never changes, so the browser may keep the file for a year. Videos can be played
//        and searched (Range requests are answered).
// ============================================================================
import { withErrors } from '../../../../lib/accountServer';
import { readMedia } from '../../../../lib/announcementsServer';

// Videos can be a few MB, more than the default answer limit allows
export const config = { api: { responseLimit: false } };

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const media = await readMedia(String(req.query.id || ''));
  if (!media) return res.status(404).json({ error: 'Not found' });
  const { meta, buffer } = media;

  res.setHeader('Content-Type', meta.mime);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");

  // Range: bytes=start-end
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (range && (range[1] || range[2])) {
    let start = range[1] ? parseInt(range[1], 10) : buffer.length - parseInt(range[2], 10);
    let end = range[1] && range[2] ? parseInt(range[2], 10) : buffer.length - 1;
    start = Math.max(0, start);
    end = Math.min(end, buffer.length - 1);
    if (start > end || start >= buffer.length) {
      res.setHeader('Content-Range', `bytes */${buffer.length}`);
      return res.status(416).end();
    }
    res.setHeader('Content-Range', `bytes ${start}-${end}/${buffer.length}`);
    res.setHeader('Content-Length', end - start + 1);
    res.status(206);
    return req.method === 'HEAD' ? res.end() : res.end(buffer.subarray(start, end + 1));
  }

  res.setHeader('Content-Length', buffer.length);
  res.status(200);
  return req.method === 'HEAD' ? res.end() : res.end(buffer);
}

export default withErrors('/api/announcements/media', handler);
