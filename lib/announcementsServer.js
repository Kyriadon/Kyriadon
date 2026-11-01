// ============================================================================
// announcementsServer.js
// Server-side logic for announcements (/announcements, the home panel and the staff
// Announcements manager):
//   storage      announcements live in the key-value layer (lib/kvStore.js), the old
//                data/announcements.json is imported once as the first announcements
//   permissions  staff create, edit and delete their own, admins can change any
//   favourites   one hash per person and one per announcement (so counts are exact)
//   trash        a deleted announcement is kept for 3 days for the people who favourited it
//   statistics   views, favourites and posting activity for the manager
//   media        image and video uploads, sent in chunks and stored as base64 chunks
//   logging      every change is a log in the debug logs (staff only for denied attempts)
// ============================================================================
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { isVolatileHost, kv, run } from './kvStore';
import { appendLogs, getRelease, getViewerRoles, makeEntry } from './logServer';
import { getUser, isSameOrigin, limit } from './accountServer';
import { getBlock, getStaffSession } from './staffServer';
import {
  IMAGE_MIMES,
  LIMITS,
  MEDIA_LIMITS,
  TYPE_META,
  VIDEO_MIMES,
  collectMediaIds,
  excerptOf,
  guessKind,
  mediaIdOf,
  mediaKindOf,
  mediaUrl,
  normalizeSlug,
  normalizeType,
  safeUrl,
  slugify,
  stripMarkup,
} from './announcementMarkup';

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------

// Staff need an active staff login (the password in the Account menu) to manage announcements.
// Admins are exempt, the same way they are for deleting logs. Set this to false and the Staff
// role alone is enough.
export const ANNOUNCEMENTS_REQUIRE_STAFF_LOGIN = true;

// A deleted announcement stays available to the people who favourited it for this long
export const DELETED_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

const MAX_ANNOUNCEMENTS = 200;
const MAX_DRAFTS = 50;
const MAX_FAVOURITES = 100;
const VIEW_DEDUPE_MS = 6 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// ----------------------------------------------------------------------------
// Keys
// ----------------------------------------------------------------------------
const P = 'kyriadon:ann';
const H_ITEMS = `${P}:items`; // id to the announcement (JSON)
const H_TRASH = `${P}:trash`; // id to the deleted announcement (JSON, with deletedAt)
const H_SLUGS = `${P}:slugs`; // url path to id (this is what keeps every url unique)
const H_MEDIA = `${P}:media`; // media id to its description (JSON)
const H_DRAFTS = `${P}:drafts`; // id to the draft (JSON): an unfinished announcement for its author and the admins
const SEED_KEY = `${P}:seeded`;
const PURGE_LOCK = `${P}:purge-lock`;
const MEDIA_LOCK = `${P}:media-lock`;
const viewsKey = (id) => `${P}:views:${id}`;
const favByKey = (id) => `${P}:favby:${id}`; // hash: person to when they favourited it
const favKey = (userId) => `${P}:fav:${userId}`; // hash: announcement to when it was favourited
const seenKey = (id, who) => `${P}:seen:${id}:${who}`;
const chunkKey = (id, n) => `${P}:media:${id}:${n}`;

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const MEDIA_ID_RE = /^[iv][0-9a-f]{24}$/;
export const isValidId = (value) => ID_RE.test(String(value ?? ''));

// ----------------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------------
const parse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const fail = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });
const bad = (field, message) => fail('invalid', message, { field });

// Control, zero-width and direction-override characters
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFC]/g;
const BODY_INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFC]/g;

// One tidy line of at most `max` characters
const cleanLine = (raw, max) => [...String(raw ?? '').replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('');

// Multi-line text: line breaks stay, invisible characters go
const cleanBody = (raw, max) => [...String(raw ?? '').replace(/\r\n?/g, '\n').replace(BODY_INVISIBLE, '').trim()].slice(0, max).join('');

const clip = (value, max) => String(value ?? '').slice(0, max);

const hostOf = (url) => {
  try {
    return new URL(url, 'https://kyriadon.local').host.replace(/^www\./, '') || 'Link';
  } catch {
    return 'Link';
  }
};

// ----------------------------------------------------------------------------
// Logging: a log write must never undo or block something that already happened
// ----------------------------------------------------------------------------
async function logSafe({ level = 'info', code, reason, user = null, meta, fix, staffOnly = false }) {
  try {
    const entry = makeEntry({ level, code, reason, meta, fix }, { user, release: getRelease() });
    if (staffOnly) entry.staffOnly = true;
    await appendLogs([entry]);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Could not write an announcement log:', error?.message || error);
  }
}

const labelOf = (item) => `"${clip(stripMarkup(item.title), 80)}"`;

// ----------------------------------------------------------------------------
// The first announcements: data/announcements.json, imported once into the store
// ----------------------------------------------------------------------------
const SEED_FILE = path.join(process.cwd(), 'data', 'announcements.json');
const SEED_TYPES = { update: 'update', event: 'announcement', maintenance: 'announcement', community: 'announcement', changelog: 'changelog', announcement: 'announcement' };

async function readSeed() {
  try {
    const raw = JSON.parse(await fs.promises.readFile(SEED_FILE, 'utf8'));
    return raw
      .filter((entry) => entry && isValidId(entry.id) && entry.title && entry.date)
      .map((entry) => {
        const type = SEED_TYPES[entry.category] || 'announcement';
        const createdAt = Date.parse(`${String(entry.date).slice(0, 10)}T12:00:00Z`) || Date.now();
        return {
          id: String(entry.id),
          slug: `${TYPE_META[type].folder}/${String(entry.id)}`,
          type,
          title: cleanLine(entry.title, LIMITS.title),
          description: cleanLine(entry.excerpt, LIMITS.description),
          body: cleanBody(entry.excerpt, LIMITS.body),
          image: '',
          resources: [],
          authorId: 'seed',
          authorName: 'Kyriadon',
          createdAt,
          updatedAt: createdAt,
        };
      });
  } catch {
    return [];
  }
}

// Writes the old announcements once. HSETNX never overwrites, so a second run changes nothing.
async function ensureSeeded() {
  if (isVolatileHost() || (await kv.get(SEED_KEY))) return;
  const seeds = await readSeed();
  for (const item of seeds) {
    await kv.hsetnx(H_ITEMS, item.id, JSON.stringify(item));
    await kv.hsetnx(H_SLUGS, item.slug, item.id);
  }
  await kv.set(SEED_KEY, '1');
}

// ----------------------------------------------------------------------------
// Reading the store. Without the Upstash database on Vercel nothing can be saved, so
// the old file is shown as it is (read only).
// ----------------------------------------------------------------------------
async function readItems() {
  if (isVolatileHost()) return readSeed();
  await ensureSeeded();
  const all = await kv.hgetall(H_ITEMS);
  return Object.values(all)
    .map(parse)
    .filter((item) => item && item.id && item.title)
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function readTrash() {
  if (isVolatileHost()) return [];
  return Object.values(await kv.hgetall(H_TRASH))
    .map(parse)
    .filter((item) => item && item.id);
}

// ----------------------------------------------------------------------------
// Housekeeping, at most once every few minutes (the lock is atomic)
// ----------------------------------------------------------------------------

// Removes deleted announcements once their 3 days are over, with their favourites and views
async function purgeTrash() {
  if (isVolatileHost() || !(await kv.set(PURGE_LOCK, '1', { px: 10 * 60 * 1000, nx: true }))) return;
  const doomed = (await readTrash()).filter((item) => item.deletedAt + DELETED_RETENTION_MS <= Date.now());
  if (!doomed.length) return;
  for (const item of doomed) {
    const fans = Object.keys(await kv.hgetall(favByKey(item.id)));
    if (fans.length) await run(fans.map((userId) => ['HDEL', favKey(userId), item.id]));
    await kv.del(favByKey(item.id), viewsKey(item.id));
    await kv.hdel(H_TRASH, item.id);
  }
  await logSafe({ code: 'ANNOUNCEMENT_TRASH_PURGED', reason: `Removed ${doomed.length} deleted announcement(s) after 3 days.`, meta: { count: doomed.length } });
}

// Removes unfinished uploads (after 1 hour) and uploads no announcement uses (after 1 day)
async function pruneMedia() {
  if (isVolatileHost() || !(await kv.set(MEDIA_LOCK, '1', { px: 30 * 60 * 1000, nx: true }))) return;
  const index = await kv.hgetall(H_MEDIA);
  const ids = Object.keys(index);
  if (!ids.length) return;
  const [items, trash] = await Promise.all([readItems(), readTrash()]);
  const used = new Set([...items, ...trash].flatMap((item) => collectMediaIds(item)));
  let removed = 0;
  for (const id of ids) {
    const meta = parse(index[id]);
    const age = Date.now() - (meta?.at || 0);
    const stale = !meta || (meta.status !== 'ready' && age > HOUR) || (meta.status === 'ready' && !used.has(id) && age > DAY);
    if (!stale) continue;
    if (meta?.total) await kv.del(...Array.from({ length: meta.total }, (_, n) => chunkKey(id, n)));
    await kv.hdel(H_MEDIA, id);
    removed += 1;
  }
  if (removed) await logSafe({ code: 'ANNOUNCEMENT_MEDIA_PRUNED', reason: `Removed ${removed} unused or unfinished upload(s).`, meta: { count: removed } });
}

// ----------------------------------------------------------------------------
// What the browser gets
// ----------------------------------------------------------------------------
function shape(item, { detail = false, favourited = false, deleted = false } = {}) {
  const description = item.description || excerptOf(item.body, 200);
  const out = {
    id: item.id,
    slug: item.slug,
    url: `/announcements/${item.slug}`,
    type: item.type,
    // The home panel reads category and excerpt, so both stay
    category: item.type,
    title: item.title,
    description,
    excerpt: excerptOf(description, 200),
    image: item.image || '',
    authorName: item.authorName,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    date: new Date(item.createdAt).toISOString(),
    favourited,
  };
  if (deleted) {
    out.deleted = true;
    out.expiresAt = item.deletedAt + DELETED_RETENTION_MS;
  }
  if (detail) {
    out.body = item.body || '';
    out.resources = item.resources || [];
  }
  return out;
}

// ----------------------------------------------------------------------------
// Public reads: the list, or one announcement by id or url. Favourites come first, and a
// deleted announcement still shows for the people who favourited it.
// ----------------------------------------------------------------------------
export async function listForViewer(userId, { limit: max = 4, type = '', id = '', slug = '' } = {}) {
  await purgeTrash().catch(() => {});
  const [items, favourites] = await Promise.all([readItems(), userId ? kv.hgetall(favKey(userId)) : {}]);
  const favouriteIds = Object.keys(favourites);
  const liveIds = new Set(items.map((item) => item.id));

  let trash = [];
  if (favouriteIds.some((favourite) => !liveIds.has(favourite))) {
    trash = (await readTrash()).filter((item) => favourites[item.id] && item.deletedAt + DELETED_RETENTION_MS > Date.now());
    // Favourites of announcements that are gone for good are tidied away
    const known = new Set([...liveIds, ...trash.map((item) => item.id)]);
    const stale = favouriteIds.filter((favourite) => !known.has(favourite));
    if (stale.length) run(stale.map((favourite) => ['HDEL', favKey(userId), favourite])).catch(() => {});
  }

  if (id || slug) {
    const match = (item) => (id ? item.id === id : item.slug === slug);
    const found = items.find(match) || trash.find(match);
    if (!found) return { item: null, favourites: favouriteIds };
    return { item: shape(found, { detail: true, favourited: Boolean(favourites[found.id]), deleted: !liveIds.has(found.id) }), favourites: favouriteIds };
  }

  const all = [...items.map((item) => shape(item, { favourited: Boolean(favourites[item.id]) })), ...trash.map((item) => shape(item, { favourited: true, deleted: true }))]
    .filter((item) => !type || item.type === type)
    .sort((a, b) => Number(b.favourited) - Number(a.favourited) || b.createdAt - a.createdAt);
  return { total: all.length, items: all.slice(0, max), favourites: favouriteIds };
}

// How many announcements there are (the home statistics), or null when it cannot be read
export async function countAnnouncements() {
  try {
    if (isVolatileHost()) return (await readSeed()).length;
    await ensureSeeded();
    return await kv.hlen(H_ITEMS);
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Permissions: admins change anything, staff only what they created
// ----------------------------------------------------------------------------
export const canModify = (user, roles, item) => Boolean(roles.admin) || String(item.authorId) === String(user.id);

// For the staff routes: the signed-in user and their roles, or null after the answer was sent.
// Staff need the Staff role right now (checked against Discord, not the cache) and, unless they
// are admins, an active staff login that is not blocked.
export async function authorizeManager(req, res, { write = false } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  const user = await getUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Log in first' });
    return null;
  }
  if (write && !isSameOrigin(req)) {
    res.status(403).json({ error: 'Cross-site request refused' });
    return null;
  }
  if ((await limit(`annmanage:${user.id}`, 150, 60 * 1000)).limited) {
    res.status(429).json({ error: 'Too many requests' });
    return null;
  }

  const roles = await getViewerRoles(user.id, { fresh: true });
  if (!roles.staff && !roles.admin) {
    if (!(await limit(`anndeny:${user.id}`, 1, 5 * 60 * 1000)).limited) {
      await logSafe({ level: 'warning', code: 'ANNOUNCEMENT_ACCESS_DENIED', reason: `${user.name} tried to use the announcements manager without the Staff role.`, user, staffOnly: true });
    }
    res.status(403).json({ error: 'Only staff can manage announcements' });
    return null;
  }

  if (ANNOUNCEMENTS_REQUIRE_STAFF_LOGIN && !roles.admin) {
    const [session, block] = await Promise.all([getStaffSession(user.id, req), getBlock(user.id)]);
    if (!session || block) {
      res.status(403).json({ error: 'Log in as staff from the Account menu first', code: 'staff_login' });
      return null;
    }
  }
  return { user, roles };
}

// ----------------------------------------------------------------------------
// Checking what the editor sends (the editor checks it too, but cannot be trusted)
// ----------------------------------------------------------------------------
function checkFields(raw) {
  const title = cleanLine(raw?.title, LIMITS.title);
  if (!title) return bad('title', 'Add a title.');
  const type = normalizeType(raw?.type);
  if (!type) return bad('type', 'Pick a type: change-log, update or announcement.');
  const description = cleanLine(raw?.description, LIMITS.description);
  const body = cleanBody(raw?.body, LIMITS.body);
  if (!description && !body) return bad('body', 'Add a description or a main announcement.');

  let image = '';
  if (String(raw?.image ?? '').trim()) {
    image = safeUrl(raw.image);
    if (!image) return bad('image', 'The image link is not valid. Use an https:// link or upload a file.');
    if (guessKind(image) === 'video') return bad('image', 'The image has to be a picture, not a video.');
  }

  const list = Array.isArray(raw?.resources) ? raw.resources : [];
  if (list.length > LIMITS.resources) return bad('resources', `Add up to ${LIMITS.resources} resources.`);
  const resources = [];
  for (const entry of list) {
    const url = safeUrl(entry?.url);
    if (!url) return bad('resources', `"${cleanLine(entry?.label || entry?.url, 40)}" is not a valid link.`);
    let kind = ['image', 'video', 'link'].includes(entry?.kind) ? entry.kind : guessKind(url);
    kind = mediaKindOf(url) || kind;
    const label = cleanLine(entry?.label, LIMITS.label) || (kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : hostOf(url));
    resources.push({ kind, label, url });
  }
  return { ok: true, value: { title, type, description, body, image, resources, urlInput: String(raw?.url ?? '') } };
}

// Every uploaded file the announcement points to has to exist and be finished
async function checkMedia(fields) {
  const urls = [fields.image, ...fields.resources.map((resource) => resource.url)];
  const ids = [...new Set(urls.map(mediaIdOf).filter(Boolean))];
  if (!ids.length) return { ok: true };
  const metas = (await run(ids.map((id) => ['HGET', H_MEDIA, id]))).map(parse);
  if (metas.some((meta) => !meta || meta.status !== 'ready')) return bad('resources', 'An uploaded file is missing. Upload it again.');
  if (mediaKindOf(fields.image) === 'video') return bad('image', 'The image has to be a picture, not a video.');
  return { ok: true };
}

// Gives the announcement its url. Typing nothing builds one from the type and the title.
// HSETNX makes the claim atomic: of two people choosing the same url, one gets it.
async function claimSlug(item, urlInput, previousSlug) {
  const normalized = normalizeSlug(urlInput);
  if (!normalized.ok) return bad('url', normalized.message);
  let base = normalized.value;
  const automatic = !base;
  if (automatic) base = `${TYPE_META[item.type].folder}/${slugify(stripMarkup(item.title)) || item.id}`;
  if (previousSlug && base === previousSlug) return { ok: true, slug: base };

  let candidate = base;
  for (let n = 2; n < 25; n += 1) {
    if (await kv.hsetnx(H_SLUGS, candidate, item.id)) return { ok: true, slug: candidate };
    if ((await kv.hget(H_SLUGS, candidate)) === item.id) return { ok: true, slug: candidate };
    if (!automatic) return bad('url', 'That url is already used by another announcement.');
    candidate = `${base}-${n}`.slice(0, LIMITS.slug);
  }
  return bad('url', 'Could not find a free url. Choose one yourself.');
}

// ----------------------------------------------------------------------------
// Create, edit, delete
// ----------------------------------------------------------------------------
export async function createAnnouncement(user, raw) {
  const checked = checkFields(raw);
  if (!checked.ok) return checked;
  if ((await kv.hlen(H_ITEMS)) >= MAX_ANNOUNCEMENTS) return fail('limit', `There are already ${MAX_ANNOUNCEMENTS} announcements. Delete an old one first.`);
  const media = await checkMedia(checked.value);
  if (!media.ok) return media;

  const { urlInput, ...fields } = checked.value;
  const now = Date.now();
  const item = { id: crypto.randomBytes(6).toString('hex'), ...fields, slug: '', authorId: user.id, authorName: user.name, createdAt: now, updatedAt: now };
  const claimed = await claimSlug(item, urlInput, '');
  if (!claimed.ok) return claimed;
  item.slug = claimed.slug;

  try {
    await kv.hset(H_ITEMS, item.id, JSON.stringify(item));
  } catch (error) {
    await kv.hdel(H_SLUGS, item.slug).catch(() => {});
    throw error;
  }
  await logSafe({ code: 'ANNOUNCEMENT_CREATED', reason: `${user.name} created the ${TYPE_META[item.type].label.toLowerCase()} ${labelOf(item)}.`, user, meta: { id: item.id, slug: item.slug, type: item.type } });
  return { ok: true, item };
}

export async function updateAnnouncement(user, roles, id, raw, expectedUpdatedAt) {
  const existing = isValidId(id) ? parse(await kv.hget(H_ITEMS, id)) : null;
  if (!existing) return fail('not_found', 'That announcement no longer exists.');
  if (!canModify(user, roles, existing)) {
    await logSafe({ level: 'warning', code: 'ANNOUNCEMENT_ACCESS_DENIED', reason: `${user.name} tried to edit ${labelOf(existing)}, which ${existing.authorName} created.`, user, meta: { id }, staffOnly: true });
    return fail('forbidden', 'You can only edit announcements you created.');
  }
  if (expectedUpdatedAt && Number(expectedUpdatedAt) !== existing.updatedAt) {
    return fail('conflict', 'Someone changed this announcement while you were editing. Reload it, then make your changes again.', { item: existing });
  }

  const checked = checkFields(raw);
  if (!checked.ok) return checked;
  const media = await checkMedia(checked.value);
  if (!media.ok) return media;

  const { urlInput, ...fields } = checked.value;
  // Leaving the url empty keeps the one the announcement already has
  const claimed = await claimSlug({ ...existing, ...fields }, urlInput.trim() ? urlInput : existing.slug, existing.slug);
  if (!claimed.ok) return claimed;

  const next = { ...existing, ...fields, slug: claimed.slug, updatedAt: Math.max(Date.now(), existing.updatedAt + 1), editedBy: { id: user.id, name: user.name } };
  try {
    await kv.hset(H_ITEMS, id, JSON.stringify(next));
  } catch (error) {
    if (claimed.slug !== existing.slug) await kv.hdel(H_SLUGS, claimed.slug).catch(() => {});
    throw error;
  }
  // The old url is free again (only if this announcement really held it)
  if (claimed.slug !== existing.slug && (await kv.hget(H_SLUGS, existing.slug)) === id) await kv.hdel(H_SLUGS, existing.slug);

  const changed = ['title', 'type', 'description', 'body', 'image', 'resources', 'slug'].filter((key) => JSON.stringify(existing[key]) !== JSON.stringify(next[key]));
  await logSafe({ code: 'ANNOUNCEMENT_UPDATED', reason: `${user.name} edited ${labelOf(next)}${existing.authorId !== user.id ? ` (created by ${existing.authorName})` : ''}.`, user, meta: { id, slug: next.slug, changed: changed.join(', ') || 'nothing' } });
  return { ok: true, item: next };
}

// Delete moves the announcement to the trash. The people who favourited it keep it for 3 days.
export async function deleteAnnouncement(user, roles, id) {
  const existing = isValidId(id) ? parse(await kv.hget(H_ITEMS, id)) : null;
  if (!existing) return fail('not_found', 'That announcement no longer exists.');
  if (!canModify(user, roles, existing)) {
    await logSafe({ level: 'warning', code: 'ANNOUNCEMENT_ACCESS_DENIED', reason: `${user.name} tried to delete ${labelOf(existing)}, which ${existing.authorName} created.`, user, meta: { id }, staffOnly: true });
    return fail('forbidden', 'You can only delete announcements you created.');
  }

  await kv.hset(H_TRASH, id, JSON.stringify({ ...existing, deletedAt: Date.now(), deletedBy: { id: user.id, name: user.name } }));
  await kv.hdel(H_ITEMS, id);
  if ((await kv.hget(H_SLUGS, existing.slug)) === id) await kv.hdel(H_SLUGS, existing.slug);

  const keptFor = await kv.hlen(favByKey(id));
  await logSafe({ code: 'ANNOUNCEMENT_DELETED', reason: `${user.name} deleted ${labelOf(existing)}${existing.authorId !== user.id ? ` (created by ${existing.authorName})` : ''}. It stays for ${keptFor} favourite(s) for 3 days.`, user, meta: { id, slug: existing.slug, type: existing.type, favourites: keptFor } });
  return { ok: true, keptFor };
}

// ----------------------------------------------------------------------------
// Favourites and views
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// Drafts: an unfinished announcement saved for later. Only its author sees it (and the admins).
// It is not an announcement yet: no url, no views, and it is not in the public list.
// ----------------------------------------------------------------------------
function shapeDraft(draft, user, { full = false } = {}) {
  const out = {
    id: draft.id,
    type: draft.type,
    title: draft.title,
    description: full ? draft.description : draft.description || excerptOf(draft.body, 200),
    authorName: draft.authorName,
    mine: String(draft.authorId) === String(user.id),
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
  if (full) Object.assign(out, { url: draft.url, image: draft.image, body: draft.body, resources: draft.resources });
  return out;
}

// The drafts the viewer may see: their own, or all of them for admins. Newest first.
export async function listDrafts(user, roles, { full = false } = {}) {
  if (isVolatileHost()) return [];
  const all = Object.values(await kv.hgetall(H_DRAFTS)).map(parse).filter((draft) => draft && draft.id);
  return all
    .filter((draft) => canModify(user, roles, draft))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((draft) => shapeDraft(draft, user, { full }));
}

// Saves a draft (a new one, or the one with this id). Nothing has to be complete or valid yet.
export async function saveDraft(user, roles, raw) {
  const title = cleanLine(raw?.title, LIMITS.title);
  const description = cleanLine(raw?.description, LIMITS.description);
  const body = cleanBody(raw?.body, LIMITS.body);
  const list = Array.isArray(raw?.resources) ? raw.resources.slice(0, LIMITS.resources) : [];
  const resources = list
    .map((entry) => ({ kind: ['image', 'video', 'link'].includes(entry?.kind) ? entry.kind : 'link', label: cleanLine(entry?.label, LIMITS.label), url: cleanLine(entry?.url, LIMITS.url) }))
    .filter((entry) => entry.label || entry.url);
  if (!title && !description && !body && !resources.length) return bad('title', 'Write something first, then save it as a draft.');

  const id = isValidId(raw?.id) ? String(raw.id) : '';
  const existing = id ? parse(await kv.hget(H_DRAFTS, id)) : null;
  if (existing && !canModify(user, roles, existing)) return fail('forbidden', 'You can only change your own drafts.');
  if (!existing && (await kv.hlen(H_DRAFTS)) >= MAX_DRAFTS) return fail('limit', `There are already ${MAX_DRAFTS} drafts. Delete an old one first.`);

  const now = Date.now();
  const draft = {
    id: existing ? existing.id : crypto.randomBytes(6).toString('hex'),
    title,
    type: normalizeType(raw?.type) || 'update',
    description,
    body,
    resources,
    image: cleanLine(raw?.image, LIMITS.url),
    url: cleanLine(raw?.url, LIMITS.slug),
    authorId: existing ? existing.authorId : user.id,
    authorName: existing ? existing.authorName : user.name,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  await kv.hset(H_DRAFTS, draft.id, JSON.stringify(draft));
  await logSafe({ code: 'ANNOUNCEMENT_DRAFT_SAVED', reason: `${user.name} saved the draft ${title ? `"${stripMarkup(title).slice(0, 60)}"` : '(untitled)'}${existing && String(existing.authorId) !== String(user.id) ? ` (created by ${existing.authorName})` : ''}.`, user, meta: { id: draft.id } });
  return { ok: true, draft: shapeDraft(draft, user, { full: true }) };
}

// Deletes a draft. A draft that is already gone (for example because it was published) is fine.
export async function deleteDraft(user, roles, id) {
  const draft = isValidId(id) ? parse(await kv.hget(H_DRAFTS, id)) : null;
  if (!draft) return { ok: true };
  if (!canModify(user, roles, draft)) return fail('forbidden', 'You can only delete your own drafts.');
  await kv.hdel(H_DRAFTS, id);
  await logSafe({ code: 'ANNOUNCEMENT_DRAFT_DELETED', reason: `${user.name} deleted the draft ${draft.title ? `"${stripMarkup(draft.title).slice(0, 60)}"` : '(untitled)'}.`, user, meta: { id } });
  return { ok: true };
}

export async function setFavourite(user, id, on) {
  if (!isValidId(id)) return fail('not_found', 'That announcement is not available.');
  const key = favKey(user.id);
  let title = id;

  if (on) {
    const item = parse(await kv.hget(H_ITEMS, id));
    if (!item) return fail('not_found', 'That announcement is no longer available.');
    title = labelOf(item);
    if (!(await kv.hget(key, id)) && (await kv.hlen(key)) >= MAX_FAVOURITES) return fail('limit', `You can favourite ${MAX_FAVOURITES} announcements at most.`);
    const now = String(Date.now());
    await run([['HSET', key, id, now], ['HSET', favByKey(id), user.id, now]]);
  } else {
    const item = parse(await kv.hget(H_ITEMS, id)) || parse(await kv.hget(H_TRASH, id));
    if (item) title = labelOf(item);
    await run([['HDEL', key, id], ['HDEL', favByKey(id), user.id]]);
  }
  await logSafe({ code: on ? 'ANNOUNCEMENT_FAVOURITED' : 'ANNOUNCEMENT_UNFAVOURITED', reason: `${user.name} ${on ? 'favourited' : 'removed the favourite from'} ${title}.`, user, meta: { id } });
  return { ok: true, favourited: on };
}

// Counts a view once per person (or address) every 6 hours
export async function recordView(id, who) {
  if (isVolatileHost() || !isValidId(id) || !(await kv.hget(H_ITEMS, id))) return false;
  const first = await kv.set(seenKey(id, who), '1', { px: VIEW_DEDUPE_MS, nx: true });
  if (first) await kv.incr(viewsKey(id));
  return first;
}

// ----------------------------------------------------------------------------
// Manager data: every announcement with its numbers, plus the statistics
// ----------------------------------------------------------------------------
function buildStats(rows, user, trashed) {
  const totals = { announcements: rows.length, changelog: 0, announcement: 0, update: 0, views: 0, favourites: 0, mine: 0, trashed };
  const byType = { changelog: { count: 0, views: 0, favourites: 0 }, announcement: { count: 0, views: 0, favourites: 0 }, update: { count: 0, views: 0, favourites: 0 } };
  const authors = new Map();
  const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
  const days = Array.from({ length: 14 }, (_, n) => ({ key: dayKey(Date.now() - (13 - n) * DAY), count: 0 }));
  const dayMap = new Map(days.map((day) => [day.key, day]));

  rows.forEach((row) => {
    totals[row.type] += 1;
    totals.views += row.views;
    totals.favourites += row.favourites;
    if (String(row.authorId) === String(user.id)) totals.mine += 1;
    byType[row.type].count += 1;
    byType[row.type].views += row.views;
    byType[row.type].favourites += row.favourites;
    const author = authors.get(row.authorId) || { name: row.authorName, count: 0 };
    author.count += 1;
    authors.set(row.authorId, author);
    const day = dayMap.get(dayKey(row.createdAt));
    if (day) day.count += 1;
  });

  const top = (field) =>
    [...rows]
      .filter((row) => row[field] > 0)
      .sort((a, b) => b[field] - a[field])
      .slice(0, 5)
      .map((row) => ({ id: row.id, title: row.title, type: row.type, value: row[field] }));

  return {
    totals,
    byType,
    topViews: top('views'),
    topFavourites: top('favourites'),
    authors: [...authors.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    days,
  };
}

export async function managerSnapshot(user, roles) {
  await Promise.all([purgeTrash(), pruneMedia()].map((task) => task.catch(() => {})));
  const items = await readItems();
  const counters = items.length ? await run(items.flatMap((item) => [['GET', viewsKey(item.id)], ['HLEN', favByKey(item.id)]])) : [];
  const rows = items.map((item, n) => ({
    ...item,
    url: `/announcements/${item.slug}`,
    views: isVolatileHost() ? 0 : Number(counters[n * 2]) || 0,
    favourites: isVolatileHost() ? 0 : Number(counters[n * 2 + 1]) || 0,
    canEdit: canModify(user, roles, item),
    canDelete: canModify(user, roles, item),
  }));
  const trashed = isVolatileHost() ? 0 : await kv.hlen(H_TRASH);
  return { items: rows, stats: buildStats(rows, user, trashed) };
}

// ----------------------------------------------------------------------------
// Media. The browser shrinks pictures first and sends every file in pieces of 400 KB
// (a request to the database is limited to about 1 MB). The first piece is checked by its
// first bytes, so a file cannot pretend to be something else. Videos are limited to 4 MB.
// ----------------------------------------------------------------------------
function detectMime(bytes) {
  if (bytes.length >= 12) {
    if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (bytes.subarray(0, 4).toString('latin1') === 'GIF8') return 'image/gif';
    if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
    if (bytes.subarray(4, 8).toString('latin1') === 'ftyp') return 'video/mp4';
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
  }
  return '';
}

// One piece of an upload. Piece 0 starts it (no uploadId yet) and answers with the id.
export async function uploadChunk(user, body) {
  const index = Number(body?.index);
  const total = Number(body?.total);
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || total > 12 || index < 0 || index >= total) return fail('invalid', 'The upload was not valid.');

  const data = typeof body?.data === 'string' ? body.data : '';
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > Math.ceil((MEDIA_LIMITS.chunkBytes * 4) / 3) + 8) return fail('invalid', 'The upload was not valid.');
  const bytes = Buffer.from(data, 'base64');
  if (!bytes.length || bytes.length > MEDIA_LIMITS.chunkBytes) return fail('invalid', 'The upload was not valid.');
  // Every piece but the last has the full size, so the real file size can be worked out
  if (index < total - 1 && bytes.length !== MEDIA_LIMITS.chunkBytes) return fail('invalid', 'The upload was not valid.');

  let id = String(body?.uploadId || '');
  let meta;
  if (index === 0 && !id) {
    const mime = detectMime(bytes);
    if (!IMAGE_MIMES.includes(mime) && !VIDEO_MIMES.includes(mime)) {
      await logSafe({ level: 'warning', code: 'ANNOUNCEMENT_MEDIA_REJECTED', reason: `${user.name} tried to upload a file that is not a supported image or video.`, user, staffOnly: true });
      return fail('invalid', 'Use a PNG, JPEG, WebP, GIF, MP4 or WebM file.');
    }
    const kind = IMAGE_MIMES.includes(mime) ? 'image' : 'video';
    const max = kind === 'image' ? MEDIA_LIMITS.imageBytes : MEDIA_LIMITS.videoBytes;
    if (total > Math.ceil(max / MEDIA_LIMITS.chunkBytes)) return fail('too_large', `${kind === 'image' ? 'Images' : 'Videos'} can be ${Math.round(max / 1024 / 1024)} MB at most.`);
    id = `${kind === 'image' ? 'i' : 'v'}${crypto.randomBytes(12).toString('hex')}`;
    meta = { status: 'pending', kind, mime, total, name: cleanLine(body?.name, 80), by: user.id, at: Date.now() };
  } else {
    meta = MEDIA_ID_RE.test(id) ? parse(await kv.hget(H_MEDIA, id)) : null;
    if (!meta || meta.status !== 'pending' || meta.by !== user.id || meta.total !== total) return fail('invalid', 'This upload is no longer valid. Start again.');
  }

  await kv.set(chunkKey(id, index), data);
  if (index === total - 1) meta.lastLen = bytes.length;
  await kv.hset(H_MEDIA, id, JSON.stringify(meta));
  return { ok: true, uploadId: id, kind: meta.kind };
}

// All pieces are there: the file is checked once more and becomes available
export async function finishUpload(user, id) {
  const meta = MEDIA_ID_RE.test(String(id)) ? parse(await kv.hget(H_MEDIA, id)) : null;
  if (!meta || meta.status !== 'pending' || meta.by !== user.id) return fail('invalid', 'This upload is no longer valid. Start again.');

  // PTTL answers -2 for a key that does not exist (and does not move any data)
  const present = await run(Array.from({ length: meta.total }, (_, n) => ['PTTL', chunkKey(id, n)]));
  if (present.some((value) => value === -2) || !meta.lastLen) return fail('invalid', 'Part of the file did not arrive. Try again.');

  const size = (meta.total - 1) * MEDIA_LIMITS.chunkBytes + meta.lastLen;
  const max = meta.kind === 'image' ? MEDIA_LIMITS.imageBytes : MEDIA_LIMITS.videoBytes;
  if (size > max) {
    await kv.del(...Array.from({ length: meta.total }, (_, n) => chunkKey(id, n)));
    await kv.hdel(H_MEDIA, id);
    return fail('too_large', `${meta.kind === 'image' ? 'Images' : 'Videos'} can be ${Math.round(max / 1024 / 1024)} MB at most.`);
  }

  await kv.hset(H_MEDIA, id, JSON.stringify({ ...meta, status: 'ready', size, at: Date.now() }));
  await logSafe({ code: 'ANNOUNCEMENT_MEDIA_UPLOADED', reason: `${user.name} uploaded a ${meta.kind} (${Math.max(1, Math.round(size / 1024))} KB).`, user, meta: { id, kind: meta.kind, size } });
  return { ok: true, id, url: mediaUrl(id), kind: meta.kind, mime: meta.mime, name: meta.name, size };
}

// The whole file, or null when it does not exist (used by /api/announcements/media/[id])
export async function readMedia(id) {
  if (!MEDIA_ID_RE.test(String(id))) return null;
  const meta = parse(await kv.hget(H_MEDIA, id));
  if (!meta || meta.status !== 'ready') return null;
  const parts = await Promise.all(Array.from({ length: meta.total }, (_, n) => kv.get(chunkKey(id, n))));
  if (parts.some((part) => !part)) return null;
  return { meta, buffer: Buffer.concat(parts.map((part) => Buffer.from(part, 'base64'))) };
}
