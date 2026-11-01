// ============================================================================
// /api/announcements
//   GET  the announcements for the page and the home panel.
//        Query: ?limit=4 (1 to 200, default 4), ?type=update|announcement|changelog,
//               ?id=<id> or ?slug=<url path> for one announcement with its full text.
//        Signed-in people get their favourites first, and a deleted announcement they
//        favourited stays in the list for 3 days.
// Staff manage announcements through /api/staff/announcements.
// ============================================================================
import { getUser, withErrors } from '../../lib/accountServer';
import { isValidId, listDrafts, listForViewer } from '../../lib/announcementsServer';
import { getViewerRoles } from '../../lib/logServer';
import { normalizeSlug, normalizeType } from '../../lib/announcementMarkup';

async function handler(req, res) {
  // Read-only endpoint
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // The answer depends on who asks (favourites), so it is never shared between people
  res.setHeader('Cache-Control', 'no-store');
  const user = await getUser(req, res);

  // Clamp the requested limit to a safe range
  const max = Math.min(Math.max(parseInt(req.query.limit, 10) || 4, 1), 200);
  const type = normalizeType(req.query.type);
  const id = isValidId(req.query.id) ? String(req.query.id) : '';
  const slugResult = normalizeSlug(req.query.slug);
  const slug = slugResult.ok ? slugResult.value : '';

  const result = await listForViewer(user ? user.id : null, { limit: max, type, id, slug });
  const viewer = { signedIn: Boolean(user), favourites: result.favourites || [] };

  // Staff get their own drafts (admins all of them) for the ghost cards, when the page asks (?drafts=1)
  let drafts = [];
  if (user && req.query.drafts === '1' && !req.query.id && !req.query.slug) {
    const roles = await getViewerRoles(user.id);
    if (roles.staff || roles.admin) drafts = await listDrafts(user, roles);
  }

  // One announcement (null when it does not exist, which is a normal answer)
  if (req.query.id || req.query.slug) return res.status(200).json({ item: result.item, viewer });
  return res.status(200).json({ announcements: result.items, total: result.total, drafts, viewer });
}

export default withErrors('/api/announcements', handler);
