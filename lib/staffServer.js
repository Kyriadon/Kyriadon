// ============================================================================
// staffServer.js
// Server-side logic for staff login and the admin review of every staff login:
//   passwords    read from Vercel environment variables, never sent to the browser
//   sessions     bound to a private cookie, expire on their own, can be kicked
//   approvals    one decision per staff login, final, decided by the first admin
//   blocks       a time-limited ban (7 days at most) with a message
//   audit logs   every step is a server log that only staff and admins can read
// ============================================================================
import crypto from 'crypto';
import { clientInfo, limit } from './accountServer';
import { countInWindow, kv, pairsToObject, run } from './kvStore';
import { appendLogs, getRelease, makeEntry } from './logServer';

const P = 'kyriadon:staff';

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------
export const STAFF_SESSION_MS = 12 * 60 * 60 * 1000; // a staff session ends by itself after 12 hours
export const MAX_BLOCK_MS = 7 * 24 * 60 * 60 * 1000; // a block lasts 7 days at most
export const MIN_BLOCK_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5; // wrong passwords allowed per account...
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // ...in this window, then the account is locked until it passes
const MAX_IP_ATTEMPTS = 20;
const MAX_APPROVALS = 500; // review records kept (the oldest are dropped first)
const COOKIE_NAME = 'kyriadon_staff';

// Kicking or blocking only matters if something checks the staff session. Today the Staff
// role alone lets someone delete logs. Set this to true and deleting logs also requires an
// active staff session (admins are exempt), which makes kicking and blocking take effect there.
export const STAFF_ACTIONS_REQUIRE_LOGIN = false;

// Control characters and direction overrides are removed from admin messages
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFC]/g;

// ----------------------------------------------------------------------------
// Keys
// ----------------------------------------------------------------------------
const sessionKey = (id) => `${P}:session:${id}`;
const banKey = (id) => `${P}:ban:${id}`;
const noticeKey = (id) => `${P}:notice:${id}`;
const attemptKey = (id) => `${P}:attempts:${id}`;
const ipKey = (ip) => `${P}:attempts-ip:${ip}`;
const H_BASE = `${P}:approvals`;
const H_DECISION = `${P}:approval-decisions`;
const H_ACTION = `${P}:approval-actions`;
const REV_KEY = `${P}:approvals-rev`;

const parse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Compares two secrets without leaking where they differ
const sameSecret = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());

// ----------------------------------------------------------------------------
// Passwords. They live in Vercel environment variables (the repository is public):
//   STAFF_PASSWORDS  JSON object, Discord user ID to that person's password:
//                    {"123456789012345678":"first password","234567890123456789":"second"}
//   STAFF_PASSWORD   optional one password for every staff member who has no entry above
// ----------------------------------------------------------------------------
function passwordConfig() {
  const raw = process.env.STAFF_PASSWORDS || '';
  let map = {};
  let invalid = false;
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) map = parsed;
      else invalid = true;
    } catch {
      invalid = true;
    }
  }
  return { map, shared: process.env.STAFF_PASSWORD || '', invalid };
}

function expectedPassword(userId) {
  const { map, shared } = passwordConfig();
  const own = map[String(userId)];
  if (typeof own === 'string' && own) return own;
  if (typeof own === 'number') return String(own);
  return shared || null;
}

export const isStaffPasswordConfigured = (userId) => Boolean(expectedPassword(userId));

// ----------------------------------------------------------------------------
// Audit log: every entry is staff only (see logs.js for how they are filtered)
// ----------------------------------------------------------------------------
export async function staffLog({ level = 'info', code, reason, user, meta, entry: existing }) {
  const entry = existing || makeEntry({ level, code, reason, meta }, { user: user || null, release: getRelease() });
  entry.staffOnly = true;
  await appendLogs([entry]);
  return entry;
}

// A log write must never undo something that already happened, so it only reports
const staffLogSafe = (details) =>
  staffLog(details).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Could not write a staff log:', error?.message || error);
  });

// ----------------------------------------------------------------------------
// Cookie: the session is tied to the browser that logged in, so someone who only
// has the Discord account (not the browser) never inherits a staff session
// ----------------------------------------------------------------------------
function readStaffCookie(req) {
  const header = String(req.headers.cookie || '');
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === COOKIE_NAME) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return '';
}

function addCookie(res, cookie) {
  const existing = res.getHeader('Set-Cookie');
  const list = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
  res.setHeader('Set-Cookie', [...list, cookie]);
}

function setStaffCookie(req, res, sid) {
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  addCookie(res, `${COOKIE_NAME}=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(STAFF_SESSION_MS / 1000)}${secure ? '; Secure' : ''}`);
}

function clearStaffCookie(req, res) {
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  addCookie(res, `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`);
}

// ----------------------------------------------------------------------------
// Sessions, blocks and notices
// ----------------------------------------------------------------------------
export async function getStaffSession(userId, req) {
  const record = parse(await kv.get(sessionKey(userId)));
  const cookie = readStaffCookie(req);
  if (!record || !record.sid || !cookie || !sameSecret(cookie, record.sid)) return null;
  return record.expiresAt > Date.now() ? record : null;
}

export const hasStaffSession = async (userId, req) => Boolean(await getStaffSession(userId, req));

export async function getBlock(userId) {
  const record = parse(await kv.get(banKey(userId)));
  return record && record.until > Date.now() ? record : null;
}

const endSession = (userId) => kv.del(sessionKey(userId));

// What the Account modal shows a staff member
export async function getStaffState(user, req) {
  const [session, block, notice] = await Promise.all([getStaffSession(user.id, req), getBlock(user.id), kv.get(noticeKey(user.id))]);
  const parsedNotice = parse(notice);
  return {
    configured: isStaffPasswordConfigured(user.id),
    loggedIn: Boolean(session) && !block,
    since: session?.at || null,
    expiresAt: session?.expiresAt || null,
    blocked: block ? { until: block.until, message: block.message } : null,
    notice: parsedNotice ? { type: parsedNotice.type, at: parsedNotice.at } : null,
  };
}

// ----------------------------------------------------------------------------
// Login
// Result: { ok: true } or { ok: false, code, message, ... }. Codes the browser handles:
//   not_configured, blocked, locked, bad_password
// ----------------------------------------------------------------------------
const rejected = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

export async function staffLogin(req, res, user, password) {
  if (await getStaffSession(user.id, req)) return { ok: true, already: true };
  const info = clientInfo(req);

  // A block stops the login before the password is even looked at
  const block = await getBlock(user.id);
  if (block) {
    // At most one log line every 5 minutes per person, so retrying cannot flood the logs
    if (!(await limit(`staffblocklog:${user.id}`, 1, 5 * 60 * 1000)).limited) await staffLogSafe({ level: 'warning', code: 'STAFF_LOGIN_REFUSED', reason: `${user.name} tried to log in as staff while blocked until ${new Date(block.until).toISOString()}.`, user, meta: { ip: info.ip, country: info.country } });
    return rejected('blocked', 'Your staff login is blocked.', { until: block.until, blockMessage: block.message });
  }

  const config = passwordConfig();
  if (config.invalid && !(await limit('staffcfglog', 1, 10 * 60 * 1000)).limited) {
    await staffLogSafe({ level: 'error', code: 'STAFF_CONFIG_INVALID', reason: 'The STAFF_PASSWORDS environment variable is not a valid JSON object, so it was ignored.' });
  }
  if (!expectedPassword(user.id)) return rejected('not_configured', 'Staff login is not set up for your account yet. Ask an admin.');

  // Every attempt is counted BEFORE the password is checked, so a burst of parallel guesses
  // cannot get more tries than the limit allows. A correct password during a lock is refused too.
  const [byUser, byIp] = await Promise.all([countInWindow(attemptKey(user.id), ATTEMPT_WINDOW_MS), countInWindow(ipKey(info.ip), ATTEMPT_WINDOW_MS)]);
  if (byUser.count > MAX_ATTEMPTS || byIp.count > MAX_IP_ATTEMPTS) return rejected('locked', 'Too many attempts. Try again later.', { retryAt: Date.now() + Math.max(byUser.retryMs, byIp.retryMs) });

  if (String(password).length > 200 || !sameSecret(password, expectedPassword(user.id))) {
    await staffLogSafe({ level: 'warning', code: 'STAFF_LOGIN_FAILED', reason: `${user.name} entered a wrong staff password (attempt ${byUser.count} of ${MAX_ATTEMPTS}).`, user, meta: { ip: info.ip, country: info.country, device: info.device } });
    if (byUser.count >= MAX_ATTEMPTS) {
      await staffLogSafe({ level: 'warning', code: 'STAFF_LOGIN_LOCKED', reason: `${user.name} was locked out of staff login for 15 minutes after ${MAX_ATTEMPTS} wrong passwords.`, user, meta: { ip: info.ip } });
      return rejected('locked', 'Too many attempts. Try again later.', { retryAt: Date.now() + byUser.retryMs });
    }
    return rejected('bad_password', 'Wrong password.', { attemptsLeft: MAX_ATTEMPTS - byUser.count });
  }

  // Success: session, review record, log. The log's ID is the review record's ID.
  const sid = crypto.randomBytes(32).toString('hex');
  const at = Date.now();
  const expiresAt = at + STAFF_SESSION_MS;
  const entry = makeEntry({ level: 'info', code: 'STAFF_LOGIN', reason: `${user.name} logged in as staff.`, meta: { ip: info.ip, country: info.country, device: info.device, session: sid.slice(0, 8) } }, { user, release: getRelease() });
  try {
    await kv.set(sessionKey(user.id), JSON.stringify({ sid, requestId: entry.id, at, expiresAt }), { px: STAFF_SESSION_MS });
    await createApproval({ id: entry.id, userId: user.id, userName: user.name, at });
    await staffLog({ entry });
  } catch (error) {
    await endSession(user.id).catch(() => {});
    await kv.hdel(H_BASE, entry.id).catch(() => {});
    throw error;
  }
  await kv.del(attemptKey(user.id), noticeKey(user.id)).catch(() => {});
  setStaffCookie(req, res, sid);
  return { ok: true, since: at, expiresAt };
}

// The staff member ends their own session
export async function staffLogout(req, res, user) {
  const session = await getStaffSession(user.id, req);
  if (session) {
    await endSession(user.id);
    await staffLogSafe({ level: 'info', code: 'STAFF_LOGOUT', reason: `${user.name} logged out of staff.`, user });
  }
  clearStaffCookie(req, res);
  return { ok: true, wasLoggedIn: Boolean(session) };
}

// ----------------------------------------------------------------------------
// Approvals. One record per staff login, in three hashes:
//   base      who logged in and when (never changes)
//   decision  approved or disapproved, written with HSETNX: the first admin wins, always
//   action    kick or block after a disapproval, also written with HSETNX
// ----------------------------------------------------------------------------
async function bumpRevision() {
  await kv.incr(REV_KEY);
}

export async function currentRevision() {
  return Number(await kv.get(REV_KEY)) || 0;
}

async function createApproval(base) {
  await kv.hset(H_BASE, base.id, JSON.stringify(base));
  await bumpRevision();
  if ((await kv.hlen(H_BASE)) > MAX_APPROVALS) await pruneApprovals();
}

// Drops the oldest review records, keeping 80% of the limit
async function pruneApprovals() {
  const [flat] = await run([['HGETALL', H_BASE]]);
  const records = Object.values(pairsToObject(flat)).map(parse).filter(Boolean).sort((a, b) => a.at - b.at);
  const doomed = records.slice(0, Math.max(0, records.length - Math.floor(MAX_APPROVALS * 0.8))).map((record) => record.id);
  if (!doomed.length) return;
  await Promise.all([kv.hdel(H_BASE, ...doomed), kv.hdel(H_DECISION, ...doomed), kv.hdel(H_ACTION, ...doomed)]);
}

// What admins see: the record plus its decision and action
const compose = (base, decision, action) => ({
  id: base.id,
  userId: base.userId,
  userName: base.userName,
  at: base.at,
  status: decision ? decision.status : 'pending',
  decidedBy: decision ? decision.by : null,
  decidedAt: decision ? decision.at : null,
  action: action || null,
});

export async function getApproval(id) {
  const [base, decision, action] = await run([['HGET', H_BASE, id], ['HGET', H_DECISION, id], ['HGET', H_ACTION, id]]);
  const record = parse(base);
  return record ? compose(record, parse(decision), parse(action)) : null;
}

// The newest review records as { id: record }
export async function listApprovals(max = 100) {
  const [base, decisions, actions] = await kv.hgetallMany([H_BASE, H_DECISION, H_ACTION]);
  const out = {};
  Object.values(base)
    .map(parse)
    .filter(Boolean)
    .sort((a, b) => b.at - a.at)
    .slice(0, max)
    .forEach((record) => {
      out[record.id] = compose(record, parse(decisions[record.id]), parse(actions[record.id]));
    });
  return out;
}

// Approve or disapprove. Final: whoever writes first wins, everyone else gets the winner back.
export async function decide(id, status, admin) {
  const approval = await getApproval(id);
  if (!approval) return { ok: false, code: 'not_found', message: 'That staff login no longer exists.' };
  const won = await kv.hsetnx(H_DECISION, id, JSON.stringify({ status, by: admin, at: Date.now() }));
  if (!won) return { ok: false, code: 'already_decided', message: 'This staff login was already reviewed.', approval: await getApproval(id) };
  await bumpRevision();
  return { ok: true, approval: await getApproval(id), target: approval };
}

// Cleans an admin's message
export const cleanMessage = (raw) => [...String(raw ?? '').replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim()].slice(0, 200).join('');

// After a disapproval: kick the session, or block the login for a while (with a message).
// Also final: only one action per review.
export async function takeAction(id, { type, durationMs, message }, admin) {
  const approval = await getApproval(id);
  if (!approval) return { ok: false, code: 'not_found', message: 'That staff login no longer exists.' };
  if (approval.status !== 'disapproved') return { ok: false, code: 'not_disapproved', message: 'Disapprove the login first.', approval };

  const now = Date.now();
  const action = { type, by: admin, at: now };
  if (type === 'block') {
    action.until = now + durationMs;
    action.message = message;
  }
  const won = await kv.hsetnx(H_ACTION, id, JSON.stringify(action));
  if (!won) return { ok: false, code: 'already_actioned', message: 'An action was already taken for this login.', approval: await getApproval(id) };

  let ended = false;
  try {
    if (type === 'block') await kv.set(banKey(approval.userId), JSON.stringify({ until: action.until, message, by: admin, at: now, requestId: id }), { px: durationMs });
    ended = (await endSession(approval.userId)) > 0;
    await kv.set(noticeKey(approval.userId), JSON.stringify({ type: type === 'block' ? 'blocked' : 'kicked', at: now }), { px: 7 * 24 * 60 * 60 * 1000 });
  } catch (error) {
    // Nothing was applied for sure, so the action can be tried again
    await kv.hdel(H_ACTION, id).catch(() => {});
    throw error;
  }
  await bumpRevision();
  return { ok: true, approval: await getApproval(id), ended };
}

// "2 days 3 hours" style duration for log lines
export function describeDuration(ms) {
  const minutes = Math.round(ms / 60000);
  const parts = [];
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (mins && !days) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
  return parts.join(' ') || '0 minutes';
}

export { staffLogSafe };
