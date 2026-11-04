// ============================================================================
// /api/notes   (the staff notes board on the debug logs page)
//   GET     list the notes the viewer may see
//   POST    { text, color?, visibility?, pinned? }          add a note
//   PUT     { id, text?, color?, visibility?, pinned? }     change a note (its author, or an admin)
//   DELETE  { id }                                          remove a note (its author, or an admin)
// visibility is all, staff, manager, dev or admin (who can see the note).
// For staff, managers, admins and developers. The roles are checked here, not in the browser, and
// a note is only sent to the people its visibility allows. Adding, changing and removing notes is
// logged (without the text), and those logs are only visible to staff and admins.
// ============================================================================
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { appendLogs, getRelease, getViewerRoles, makeEntry, rateLimited } from '../../lib/logServer';
import { canSeeNote, createNote, deleteNote, listNotes, updateNote } from '../../lib/notesServer';
import { hasCommandAccess } from '../../lib/commandRegistry';

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

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
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id || null;
  if (!userId) return res.status(401).json({ error: 'Log in to see the staff notes' });
  const user = { id: String(userId), name: String(session.user.name || 'Unknown').slice(0, 60) };
  const roles = await getViewerRoles(userId);
  if (!hasCommandAccess(roles)) return res.status(403).json({ error: 'The staff notes are for staff, managers, admins and developers' });
  const viewer = { ...roles, id: user.id };

  // The log of an action: info, staff and admins only, and never the text of the note
  const release = getRelease();
  const log = async (code, reason) => {
    const entry = makeEntry({ level: 'info', code, reason }, { user, release });
    entry.staffOnly = true;
    await appendLogs([entry]);
  };

  if (req.method === 'GET') {
    const notes = (await listNotes(viewer)).map((note) => ({ ...note, visibility: note.visibility || 'all', canEdit: viewer.admin || note.authorId === user.id }));
    return res.status(200).json({ notes, viewer: { id: user.id, admin: Boolean(viewer.admin) } });
  }

  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (rateLimited(`notes:${userId}`, 60, 60 * 1000)) return res.status(429).json({ error: 'Too many changes. Wait a moment' });

  const body = parseBody(req.body) || {};
  let result;
  if (req.method === 'POST') result = await createNote(user, body);
  else if (req.method === 'PUT') result = await updateNote(user, viewer.admin, String(body.id || ''), body);
  else result = await deleteNote(user, viewer.admin, String(body.id || ''));
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  if (req.method === 'POST') await log('NOTE_ADDED', `${user.name} added a staff note for ${result.note.visibility}.`);
  else if (req.method === 'PUT') await log('NOTE_EDITED', `${user.name} changed a staff note${result.note.authorId !== user.id ? ` by ${result.note.authorName}` : ''}.`);
  else if (result.note) await log('NOTE_DELETED', `${user.name} removed a staff note${result.note.authorId !== user.id ? ` by ${result.note.authorName}` : ''}.`);
  const note = result.note && canSeeNote(result.note, viewer) ? { ...result.note, canEdit: true } : null;
  return res.status(200).json({ ok: true, note });
}

// Catches anything the route throws: the error is stored as an API_ERROR log and the client gets a clean 500
export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (error) {
    try {
      await appendLogs([makeEntry({ level: 'error', code: 'API_ERROR', reason: `${req.method} /api/notes failed: ${error?.message || error}` }, { user: null, release: getRelease() })]);
    } catch {
      /* logging must never throw */
    }
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
    return undefined;
  }
}
