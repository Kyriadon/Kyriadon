// ============================================================================
// /api/staff/announcementMedia  (uploads for the Announcements manager)
//   POST  { op: "chunk", uploadId, index, total, name, data }  one piece of a file (base64)
//   POST  { op: "finish", uploadId }                           the file is complete
// Pieces are 400 KB, because a request to the database is limited to about 1 MB. Images can be
// 3 MB and videos 4 MB. The same access rules as the manager apply.
// ============================================================================
import { jsonBody, withErrors } from '../../../lib/accountServer';
import { authorizeManager, finishUpload, uploadChunk } from '../../../lib/announcementsServer';
import { isVolatileHost } from '../../../lib/kvStore';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await authorizeManager(req, res, { write: true });
  if (!auth) return undefined;
  if (isVolatileHost()) return res.status(200).json({ ok: false, code: 'storage', message: 'Uploads need the Upstash Redis database to be connected to this project.' });

  const body = jsonBody(req);
  if (!body) return res.status(400).json({ error: 'Send JSON' });
  const result = body.op === 'finish' ? await finishUpload(auth.user, body.uploadId) : await uploadChunk(auth.user, body);
  return res.status(200).json(result);
}

export default withErrors('/api/staff/announcementMedia', handler, { staffOnly: true });
