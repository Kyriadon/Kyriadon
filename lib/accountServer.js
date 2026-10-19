// ============================================================================
// accountServer.js
// Server-side helpers for the Account modal: profile (username, display name,
// avatar), cooldowns, avatar validation, rate limits and small request helpers
// shared by the /api/account and /api/staff routes.
// Data lives in the key-value layer (lib/kvStore.js): Upstash Redis when it is
// connected, memory otherwise.
// ============================================================================
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import { countInWindow, kv, pairsToObject, run, storageKind } from './kvStore';
import { appendLogs, getRelease, makeEntry } from './logServer';

const P = 'kyriadon';

// ----------------------------------------------------------------------------
// Rules
// ----------------------------------------------------------------------------
export const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // "once per month"
export const DISPLAY_COOLDOWN_MS = 15 * 60 * 1000; // "once per 15 minutes"
export const AVATAR_MAX_BYTES = 256 * 1024;

// Names that could be mistaken for the team or the system
const RESERVED = new Set(['admin', 'administrator', 'staff', 'moderator', 'mod', 'owner', 'kyriadon', 'support', 'system', 'everyone', 'here', 'root', 'official', 'developer', 'dev', 'null', 'undefined']);

// Control, zero-width and direction-override characters (used to fake or hide names)
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFC]/g;

// Username: 3 to 20 characters, lowercase letters, numbers, dots and underscores
export function validateUsername(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value.length < 3 || value.length > 20) return { ok: false, code: 'invalid', message: 'Usernames are 3 to 20 characters long.' };
  if (!/^[a-z0-9](?:[a-z0-9_.]{1,18})[a-z0-9]$/.test(value)) return { ok: false, code: 'invalid', message: 'Use letters, numbers, dots and underscores. It must start and end with a letter or number.' };
  if (/[._]{2}/.test(value)) return { ok: false, code: 'invalid', message: 'Dots and underscores cannot follow each other.' };
  if (RESERVED.has(value.replace(/[._]/g, ''))) return { ok: false, code: 'reserved', message: 'That username is reserved.' };
  return { ok: true, value };
}

// Display name: 1 to 32 visible characters, spaces tidied
export function validateDisplayName(raw) {
  const value = String(raw ?? '').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, code: 'invalid', message: 'Enter a display name.' };
  if ([...value].length > 32) return { ok: false, code: 'invalid', message: 'Display names are up to 32 characters.' };
  return { ok: true, value };
}

// Until a person changes something, their Discord name is used for both
export function defaultUsername(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '_')
    .replace(/[._]{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 20);
  return base.length >= 3 ? base : `${base}user`.slice(0, 20);
}

export function defaultDisplayName(name) {
  const result = validateDisplayName(name);
  return result.ok ? result.value : 'Member';
}

// ----------------------------------------------------------------------------
// Keys
// ----------------------------------------------------------------------------
const profileKey = (id) => `${P}:profile:${id}`;
const avatarKey = (id) => `${P}:avatar:${id}`;
const claimKey = (username) => `${P}:username:${username}`;
const cooldownKey = (kind, id) => `${P}:cd:${kind}:${id}`;

// ----------------------------------------------------------------------------
// Profile: stored as a hash so that changing one field never overwrites another
// ----------------------------------------------------------------------------
export const avatarUrlFor = (id, version) => `/api/account/avatar/${id}?v=${encodeURIComponent(version)}`;

export async function readProfile(user) {
  const [flat, usernameTtl, displayTtl] = await run([['HGETALL', profileKey(user.id)], ['PTTL', cooldownKey('username', user.id)], ['PTTL', cooldownKey('display', user.id)]]);
  const stored = pairsToObject(flat);
  const now = Date.now();
  return {
    stored,
    profile: {
      username: stored.username || defaultUsername(user.name),
      displayName: stored.displayName || defaultDisplayName(user.name),
      avatarUrl: stored.avatarVersion ? avatarUrlFor(user.id, stored.avatarVersion) : null,
      hasCustomAvatar: Boolean(stored.avatarVersion),
      usernameAvailableAt: usernameTtl > 0 ? now + usernameTtl : 0,
      displayNameAvailableAt: displayTtl > 0 ? now + displayTtl : 0,
    },
  };
}

const fail = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

// Username: unique (case-insensitive), once every 30 days
export async function changeUsername(user, raw) {
  const checked = validateUsername(raw);
  if (!checked.ok) return checked;
  const next = checked.value;

  const { stored, profile } = await readProfile(user);
  if (next === profile.username) return { ok: true, unchanged: true, profile };
  if (profile.usernameAvailableAt) return fail('cooldown', 'You can only change your username once a month.', { availableAt: profile.usernameAvailableAt });

  // 1. Claim the name. Only one account can hold it, even if two people try at the same moment.
  const claimed = await kv.set(claimKey(next), user.id, { nx: true });
  if (!claimed && (await kv.get(claimKey(next))) !== user.id) return fail('taken', 'That username is already taken.');

  // 2. Start the cooldown. It is atomic, so two requests from the same person cannot both win.
  const cooldown = await kv.set(cooldownKey('username', user.id), String(Date.now()), { px: USERNAME_COOLDOWN_MS, nx: true });
  if (!cooldown) {
    if (claimed) await kv.del(claimKey(next));
    const ttl = await kv.pttl(cooldownKey('username', user.id));
    return fail('cooldown', 'You can only change your username once a month.', { availableAt: Date.now() + Math.max(ttl, 0) });
  }

  // 3. Save. If saving fails, nothing is used up.
  try {
    await kv.hset(profileKey(user.id), 'username', next);
  } catch (error) {
    await kv.del(cooldownKey('username', user.id)).catch(() => {});
    if (claimed) await kv.del(claimKey(next)).catch(() => {});
    throw error;
  }

  // 4. Free the old name for someone else (only if this account really held it)
  if (stored.username && stored.username !== next && (await kv.get(claimKey(stored.username))) === user.id) await kv.del(claimKey(stored.username));

  return { ok: true, profile: (await readProfile(user)).profile };
}

// Display name: not unique, once every 15 minutes
export async function changeDisplayName(user, raw) {
  const checked = validateDisplayName(raw);
  if (!checked.ok) return checked;
  const next = checked.value;

  const { profile } = await readProfile(user);
  if (next === profile.displayName) return { ok: true, unchanged: true, profile };
  if (profile.displayNameAvailableAt) return fail('cooldown', 'You can change your display name every 15 minutes.', { availableAt: profile.displayNameAvailableAt });

  const cooldown = await kv.set(cooldownKey('display', user.id), String(Date.now()), { px: DISPLAY_COOLDOWN_MS, nx: true });
  if (!cooldown) {
    const ttl = await kv.pttl(cooldownKey('display', user.id));
    return fail('cooldown', 'You can change your display name every 15 minutes.', { availableAt: Date.now() + Math.max(ttl, 0) });
  }

  try {
    await kv.hset(profileKey(user.id), 'displayName', next);
  } catch (error) {
    await kv.del(cooldownKey('display', user.id)).catch(() => {});
    throw error;
  }
  return { ok: true, profile: (await readProfile(user)).profile };
}

// ----------------------------------------------------------------------------
// Avatar: the browser sends a square PNG (it crops and shrinks it first). The server
// re-checks everything, because the browser cannot be trusted.
// ----------------------------------------------------------------------------
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_END = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

export function parseAvatar(dataUrl) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl || ''));
  if (!match) return fail('invalid', 'The avatar must be a PNG image.');
  if (match[1].length > Math.ceil((AVATAR_MAX_BYTES * 4) / 3) + 8) return fail('too_large', 'That image is too large. Try a smaller one.');
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length > AVATAR_MAX_BYTES) return fail('too_large', 'That image is too large. Try a smaller one.');
  const isPng = bytes.length > 33 && bytes.subarray(0, 8).equals(PNG_SIGNATURE) && bytes.subarray(12, 16).toString('latin1') === 'IHDR' && bytes.subarray(bytes.length - 12).equals(PNG_END);
  if (!isPng) return fail('invalid', 'The avatar must be a valid PNG image.');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== height || width < 64 || width > 512) return fail('invalid', 'The avatar must be a square image between 64 and 512 pixels.');
  return { ok: true, base64: match[1] };
}

export async function saveAvatar(user, dataUrl) {
  // Uploads are limited to 12 an hour per account
  const { count, retryMs } = await countInWindow(`${P}:rl:avatar:${user.id}`, 60 * 60 * 1000);
  if (count > 12) return fail('rate_limited', 'You changed your avatar too often. Try again later.', { availableAt: Date.now() + retryMs });

  const parsed = parseAvatar(dataUrl);
  if (!parsed.ok) return parsed;

  // The image goes first, then the version that points to it
  await kv.set(avatarKey(user.id), parsed.base64);
  await kv.hset(profileKey(user.id), 'avatarVersion', Date.now().toString(36));
  return { ok: true, profile: (await readProfile(user)).profile };
}

export async function removeAvatar(user) {
  await kv.hdel(profileKey(user.id), 'avatarVersion');
  await kv.del(avatarKey(user.id));
  return { ok: true, profile: (await readProfile(user)).profile };
}

export const readAvatar = (id) => kv.get(avatarKey(id));

// ----------------------------------------------------------------------------
// Request helpers
// ----------------------------------------------------------------------------

// The signed-in user (Discord ID and name come from the session, never from the request)
export async function getUser(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return null;
  return { id: String(session.user.id), name: String(session.user.name || 'Unknown').slice(0, 60) };
}

// State-changing requests must come from this site (defence in depth next to SameSite cookies)
export function isSameOrigin(req) {
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === req.headers.host || host === req.headers['x-forwarded-host'];
  } catch {
    return false;
  }
}

// JSON body, or null when the request is not JSON
export function jsonBody(req) {
  if (!/^application\/json/i.test(String(req.headers['content-type'] || ''))) return null;
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null;
}

// Rate limit by key: { limited, retryMs }
export async function limit(key, max, windowMs) {
  const { count, retryMs } = await countInWindow(`${P}:rl:${key}`, windowMs);
  return { limited: count > max, retryMs, count };
}

// Where a request came from (for the staff login log: an admin needs this to judge a login)
export function clientInfo(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  return {
    ip: forwarded.slice(0, 64),
    country: String(req.headers['x-vercel-ip-country'] || '').slice(0, 2),
    device: String(req.headers['user-agent'] || '').slice(0, 140),
  };
}

// Wraps a route: anything it throws becomes an API_ERROR log and a clean 500
export function withErrors(label, handler, { staffOnly = false } = {}) {
  return async function route(req, res) {
    try {
      return await handler(req, res);
    } catch (error) {
      try {
        const entry = makeEntry({ level: 'error', code: 'API_ERROR', reason: `${req.method} ${label} failed: ${error?.message || error}`, meta: { stack: String(error?.stack || '').slice(0, 1500) } }, { user: null, release: getRelease() });
        if (staffOnly) entry.staffOnly = true;
        await appendLogs([entry]);
      } catch {
        /* logging must never throw */
      }
      if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
      return undefined;
    }
  };
}

export { storageKind };
