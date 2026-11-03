// ============================================================================
// logServer.js
// Server-side helpers for the debug logs system: storage, release info,
// Discord role checks, input sanitising, rate limiting and fix hints.
// ============================================================================
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

// ----------------------------------------------------------------------------
// Role IDs (leave blank until you add them). Staff can delete logs; Developers
// get the raw view by default and the "relevant to this release" section.
// ----------------------------------------------------------------------------
export const STAFF_ROLE_ID = '1479039137469436005';
export const DEVELOPER_ROLE_ID = '1479525274507808819';

// Managers can use the @staff commands of the Command panel next to Staff. Put the Discord role ID of
// your Manager role in the MANAGER_ROLE_ID environment variable (blank: nobody has the role).
export const MANAGER_ROLE_ID = process.env.MANAGER_ROLE_ID || '';

// Admins review staff logins (the red ! in the debug logs) and can kick or block a staff session.
// Set ADMIN_ROLE_ID (the Discord role ID of your Admin role) and/or ADMIN_DISCORD_IDS (a comma
// separated list of Discord user IDs) in the Vercel environment variables. IDs listed there are
// admins even if the Discord role check is unavailable.
export const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || '';
const ADMIN_USER_IDS = (process.env.ADMIN_DISCORD_IDS || '')
  .split(/[\s,]+/)
  .filter(Boolean);

// Who may VIEW logs. false: any signed-in Discord user can view (only staff can delete).
// true: only Staff and Developer roles can view; everyone else gets "no access".
export const VIEW_REQUIRES_ROLE = false;

// How many logs are kept: the newest DEFAULT_LIMIT, unless a developer sets a limiter with
// @dev:set-limiter (LIMIT_MIN to LIMIT_MAX). LIMIT_MAX is also the most that is ever stored.
export const LIMIT_MIN = 10;
export const LIMIT_MAX = 5000;
export const DEFAULT_LIMIT = 2000;
const LEVELS = ['info', 'warning', 'error'];

// Temporary file on serverless hosts. Swap this block for a database when you need
// logs to survive redeploys (every function in this file keeps the same signature).
const STORE_FILE = path.join(os.tmpdir(), 'kyriadon-logs.json');

// ----------------------------------------------------------------------------
// Permanent storage: Upstash Redis through its REST API (no package needed).
// On Vercel add "Upstash for Redis" from the Marketplace and connect it to the
// project: it fills in KV_REST_API_URL and KV_REST_API_TOKEN for you. Without
// those variables (for example locally) the temporary storage above is used.
// ----------------------------------------------------------------------------
const REDIS_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const REDIS_KEY = 'kyriadon:logs';
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN);

// Runs Redis commands in one request and returns one result per command
async function redisRun(commands) {
  const response = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Redis responded with ${response.status}`);
  const results = await response.json();
  const failed = results.find((item) => item.error);
  if (failed) throw new Error(`Redis error: ${failed.error}`);
  return results.map((item) => item.result);
}

// ----------------------------------------------------------------------------
// Shared in-memory state (survives hot reloads and is shared by all API routes)
// ----------------------------------------------------------------------------
const shared = globalThis;
if (!shared.__kyriadonLogStore) {
  let initial = [];
  try {
    initial = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {
    /* first run, nothing stored yet */
  }
  shared.__kyriadonLogStore = { logs: Array.isArray(initial) ? initial : [], timer: null, hits: new Map(), roles: new Map() };
}
const store = shared.__kyriadonLogStore;

// Writes the store to disk shortly after the last change (best effort)
function persist() {
  clearTimeout(store.timer);
  store.timer = setTimeout(() => {
    fs.promises.writeFile(STORE_FILE, JSON.stringify(store.logs)).catch(() => {});
  }, 500);
}

// ----------------------------------------------------------------------------
// Storage: read, append, delete
// ----------------------------------------------------------------------------
export async function readLogs() {
  if (useRedis) {
    const [raw] = await redisRun([['LRANGE', REDIS_KEY, 0, -1]]);
    const parsed = raw.map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    });
    return parsed.filter(Boolean).sort((a, b) => (a.time < b.time ? 1 : -1));
  }
  return [...store.logs].sort((a, b) => (a.time < b.time ? 1 : -1));
}

// ----------------------------------------------------------------------------
// Settings set with the Command panel: the log limiter (@dev:set-limiter) and the log
// visibility rules (@toggle). Stored in Redis, or in a temporary file without Redis.
//   limiter:    { limit, what, how, by, at } or null
//   visibility: [{ audience: 'members' | 'staff', kind: 'level' | 'code', value }]
// ----------------------------------------------------------------------------
const SETTINGS_KEY = 'kyriadon:log-settings';
const SETTINGS_FILE = path.join(os.tmpdir(), 'kyriadon-log-settings.json');
const SETTINGS_CACHE_MS = 15 * 1000;

const cleanSettings = (value) => ({
  limiter: value?.limiter && Number.isInteger(value.limiter.limit) ? value.limiter : null,
  visibility: Array.isArray(value?.visibility) ? value.visibility.slice(0, 50) : [],
});

export async function readSettings() {
  if (store.settingsCache && Date.now() - store.settingsCache.at < SETTINGS_CACHE_MS) return store.settingsCache.value;
  let raw = null;
  try {
    if (useRedis) {
      const [text] = await redisRun([['GET', SETTINGS_KEY]]);
      raw = text ? JSON.parse(text) : null;
    } else {
      if (store.settings === undefined) {
        try {
          store.settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        } catch {
          store.settings = null;
        }
      }
      raw = store.settings;
    }
  } catch {
    raw = null;
  }
  const value = cleanSettings(raw);
  store.settingsCache = { at: Date.now(), value };
  return value;
}

export async function writeSettings(next) {
  const value = cleanSettings(next);
  if (useRedis) await redisRun([['SET', SETTINGS_KEY, JSON.stringify(value)]]);
  else {
    store.settings = value;
    fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(value)).catch(() => {});
  }
  store.settingsCache = { at: Date.now(), value };
  return value;
}

// How many logs are stored right now
export async function countLogs() {
  if (useRedis) {
    const [count] = await redisRun([['LLEN', REDIS_KEY]]);
    return Number(count) || 0;
  }
  return store.logs.length;
}

// Where the logs are stored, for @dev:storage
export const storageType = () => (useRedis ? 'Upstash Redis' : 'a temporary file (logs are lost on redeploys)');

// The logs a limiter wants deleted, given all logs. what: oldest | all | info | warning | error.
// how: trim (just enough to get back to the limit), half (down to half the limit) or clear (all of "what").
export function planLimiter(logs, policy) {
  if (!policy || logs.length <= policy.limit) return [];
  if (policy.what === 'all') return logs.map((log) => log.id);
  const matching = (policy.what === 'oldest' ? logs : logs.filter((log) => log.level === policy.what)).slice().sort((a, b) => (a.time < b.time ? -1 : 1));
  if (policy.how === 'clear') return matching.map((log) => log.id);
  const target = policy.how === 'half' ? Math.floor(policy.limit / 2) : policy.limit;
  return matching.slice(0, Math.max(logs.length - target, 0)).map((log) => log.id);
}

// The limiter in words
export function describeLimiter(policy) {
  if (!policy) return `No limiter. The newest ${DEFAULT_LIMIT} logs are kept.`;
  const target = policy.how === 'half' ? Math.floor(policy.limit / 2) : policy.limit;
  const what = policy.what === 'oldest' ? 'the oldest logs' : policy.what === 'all' ? 'all logs' : `${policy.what} logs`;
  const how = policy.what === 'all' || policy.how === 'clear' ? `deletes ${policy.what === 'oldest' ? 'every log' : what} at once` : policy.how === 'half' ? `deletes ${what} until ${target} are left` : `deletes ${what}, just enough to get back to ${target}`;
  return `Limit ${policy.limit} logs. When there are more, it ${how}.`;
}

// Applies the limiter to the stored logs. Returns how many logs it deleted. Without a limiter
// (or under the limit) nothing happens.
export async function enforceLimiter() {
  if (store.limiting) return 0;
  const { limiter } = await readSettings();
  if (!limiter || (await countLogs()) <= limiter.limit) return 0;
  store.limiting = true;
  try {
    const ids = planLimiter(await readLogs(), limiter);
    if (!ids.length) return 0;
    const removed = limiter.what === 'all' ? await deleteLogs({ all: true }) : await deleteLogs({ ids });
    const note = { id: crypto.randomUUID(), level: 'info', code: 'LIMITER_RAN', reason: `The log limiter deleted ${removed} log(s). ${describeLimiter(limiter)}`, fix: '', user: null, time: new Date().toISOString(), path: '', release: getRelease().sha, meta: {} };
    await appendLogs([note]);
    return removed;
  } finally {
    store.limiting = false;
  }
}

// The most logs the store keeps before the limiter even looks at them
const capFor = (limiter) => (!limiter ? DEFAULT_LIMIT : limiter.what === 'oldest' && limiter.how === 'trim' ? limiter.limit : LIMIT_MAX);

export async function appendLogs(entries) {
  const { limiter } = await readSettings();
  const cap = capFor(limiter);
  if (useRedis) {
    if (entries.length) await redisRun([['RPUSH', REDIS_KEY, ...entries.map((entry) => JSON.stringify(entry))], ['LTRIM', REDIS_KEY, -cap, -1]]);
  } else {
    entries.forEach((entry) => store.logs.push(entry));
    if (store.logs.length > cap) store.logs.splice(0, store.logs.length - cap);
    persist();
  }
  if (entries.length && limiter) await enforceLimiter();
}

// keep(log) can protect logs from deletion (staff logins are only deletable by admins, so a
// staff member cannot erase the trace of their own login).
export async function deleteLogs({ ids, level, all, keep }) {
  const protectLogs = typeof keep === 'function';
  if (useRedis) {
    if (all && !protectLogs) {
      const [count] = await redisRun([['LLEN', REDIS_KEY], ['DEL', REDIS_KEY]]);
      return count;
    }
    if (!all && !level && !Array.isArray(ids)) return 0;
    const [raw] = await redisRun([['LRANGE', REDIS_KEY, 0, -1]]);
    const set = new Set(Array.isArray(ids) ? ids : []);
    const doomed = raw.filter((item) => {
      try {
        const log = JSON.parse(item);
        if (protectLogs && keep(log)) return false;
        if (all) return true;
        return level ? log.level === level : set.has(log.id);
      } catch {
        return false;
      }
    });
    let removed = 0;
    for (let start = 0; start < doomed.length; start += 100) {
      const results = await redisRun(doomed.slice(start, start + 100).map((item) => ['LREM', REDIS_KEY, 0, item]));
      removed += results.reduce((sum, count) => sum + count, 0);
    }
    return removed;
  }
  const before = store.logs.length;
  const protectedOnly = (log) => protectLogs && keep(log);
  if (all) store.logs = store.logs.filter(protectedOnly);
  else if (level) store.logs = store.logs.filter((log) => log.level !== level || protectedOnly(log));
  else if (Array.isArray(ids)) {
    const set = new Set(ids);
    store.logs = store.logs.filter((log) => !set.has(log.id) || protectedOnly(log));
  }
  persist();
  return before - store.logs.length;
}

// ----------------------------------------------------------------------------
// Release: which deployment this server is running (set by Vercel)
// ----------------------------------------------------------------------------
export const getRelease = () => ({
  sha: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
  message: (process.env.VERCEL_GIT_COMMIT_MESSAGE || '').slice(0, 200),
  ref: process.env.VERCEL_GIT_COMMIT_REF || '',
  env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
});

// ----------------------------------------------------------------------------
// Fix suggestions added to error logs that do not carry their own
// ----------------------------------------------------------------------------
const FIX_HINTS = {
  JS_ERROR: 'Open the stack trace, find the failing component and guard the undefined value before using it.',
  UNHANDLED_REJECTION: 'Add a catch to the promise, or wrap the await in try/catch and show a fallback state.',
  FETCH_FAILED: 'Check that the endpoint is reachable, then add a retry or an error state for failed requests.',
  HTTP_5XX: 'Check the server logs for this route and fix the thrown error or the missing environment variable.',
  CONSOLE_ERROR: 'Find the console.error call that produced this message and fix the condition behind it.',
  RESOURCE_ERROR: 'Check that the file exists at this URL and is deployed, then fix the path or the host that serves it.',
  CSP_VIOLATION: 'Allow this source in the Content-Security-Policy header, or remove the code that loads it.',
  ROUTE_ERROR: 'Open the page that failed to load and check for a missing chunk, an error thrown in getServerSideProps, or a stale deployment.',
  XHR_FAILED: 'Check that the endpoint is reachable, then add a retry or an error state for failed requests.',
  API_ERROR: 'Open the stack trace in this log, fix the error thrown by the server route, and check its environment variables.',
  DISCORD_ROLE_CHECK_FAILED: 'Check DISCORD_BOT_TOKEN and DISCORD_GUILD_ID, that the bot is in your server, and Discord status. Until this is fixed, Staff and Developers are treated as ordinary members.',
};

const clip = (value, max) => String(value ?? '').slice(0, max);

// ----------------------------------------------------------------------------
// Turns a raw client event into a safe, complete log entry
// ----------------------------------------------------------------------------
export function makeEntry(raw, { user, release }) {
  const level = LEVELS.includes(raw?.level) ? raw.level : 'info';
  const code = clip(raw?.code, 60).replace(/[^A-Za-z0-9_.:-]/g, '_') || 'UNKNOWN';

  // Client time is accepted only when it is close to the server clock
  const clientTime = Date.parse(raw?.at);
  const time = Number.isFinite(clientTime) && Math.abs(Date.now() - clientTime) < 10 * 60 * 1000 ? new Date(clientTime) : new Date();

  const meta = {};
  if (raw?.meta && typeof raw.meta === 'object') {
    Object.entries(raw.meta)
      .slice(0, 6)
      .forEach(([key, value]) => {
        if (['string', 'number', 'boolean'].includes(typeof value)) meta[clip(key, 30)] = typeof value === 'string' ? clip(value, 1500) : value;
      });
  }

  return {
    id: crypto.randomUUID(),
    level,
    code,
    reason: clip(raw?.reason, 500),
    fix: level === 'error' ? clip(raw?.fix || FIX_HINTS[code] || '', 400) : '',
    user,
    time: time.toISOString(),
    path: clip(raw?.path, 120),
    release: release.sha,
    meta,
  };
}

// ----------------------------------------------------------------------------
// Simple per-key rate limit (log writes)
// ----------------------------------------------------------------------------
export function rateLimited(key, limit = 240, windowMs = 60 * 1000) {
  const now = Date.now();
  const hit = store.hits.get(key);
  if (!hit || now - hit.start > windowMs) {
    store.hits.set(key, { start: now, count: 1 });
    if (store.hits.size > 5000) store.hits.clear();
    return false;
  }
  hit.count += 1;
  return hit.count > limit;
}

// ----------------------------------------------------------------------------
// Logs a failed Discord role lookup as an error, at most once a minute so an
// outage cannot flood the logs. A 404 only means the user is not in your
// Discord server, which is normal, so it is not logged.
// ----------------------------------------------------------------------------
async function logRoleCheckFailure(userId, error) {
  if (error?.status === 404) return;
  const now = Date.now();
  if (now - (store.roleFailureAt || 0) < 60 * 1000) return;
  store.roleFailureAt = now;
  try {
    const reason = error?.name === 'AbortError' ? 'Discord did not respond within 5 seconds' : error?.message || 'Unknown error';
    await appendLogs([makeEntry({ level: 'error', code: 'DISCORD_ROLE_CHECK_FAILED', reason: `Could not read Discord roles for user ${userId}: ${reason}`, meta: { userId: String(userId), status: error?.status } }, { user: { id: String(userId), name: String(userId) }, release: getRelease() })]);
  } catch {
    /* logging must never break the role check */
  }
}

// ----------------------------------------------------------------------------
// Discord roles of a user in your server (needs DISCORD_BOT_TOKEN and
// DISCORD_GUILD_ID in .env and the role IDs above). Cached for 60 seconds.
// ----------------------------------------------------------------------------
export async function getViewerRoles(userId, { fresh = false } = {}) {
  const configured = Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID && (STAFF_ROLE_ID || DEVELOPER_ROLE_ID || ADMIN_ROLE_ID || MANAGER_ROLE_ID));
  // Admins listed by ID stay admins even when the Discord check is unavailable
  const adminById = Boolean(userId) && ADMIN_USER_IDS.includes(String(userId));
  const none = { staff: false, manager: false, developer: false, admin: adminById, configured };
  if (!userId || !configured) return none;

  // fresh skips the 60 second cache (used before anything security sensitive)
  const cached = store.roles.get(userId);
  if (!fresh && cached && Date.now() - cached.at < 60 * 1000) return cached.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      signal: controller.signal,
    });
    if (!response.ok) throw Object.assign(new Error(`Discord responded with ${response.status}`), { status: response.status });
    const member = await response.json();
    const roles = Array.isArray(member.roles) ? member.roles : [];
    const value = {
      staff: Boolean(STAFF_ROLE_ID) && roles.includes(STAFF_ROLE_ID),
      manager: Boolean(MANAGER_ROLE_ID) && roles.includes(MANAGER_ROLE_ID),
      developer: Boolean(DEVELOPER_ROLE_ID) && roles.includes(DEVELOPER_ROLE_ID),
      admin: adminById || (Boolean(ADMIN_ROLE_ID) && roles.includes(ADMIN_ROLE_ID)),
      configured,
    };
    store.roles.set(userId, { at: Date.now(), value });
    return value;
  } catch (error) {
    await logRoleCheckFailure(userId, error);
    return none;
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------------------------------------------------------
// Log visibility (@toggle): admins can hide levels or codes from normal members, or from staff
// (and members). Admins and developers always see everything.
// ----------------------------------------------------------------------------
export const audienceOf = (viewer) => (viewer?.admin || viewer?.developer ? null : viewer?.staff || viewer?.manager ? 'staff' : 'members');

export function isHiddenFrom(log, audience, rules) {
  if (!audience || !rules?.length) return false;
  return rules.some((rule) => {
    // A rule for staff also hides the log from members; a rule for members only hides it from members
    if (!(rule.audience === 'staff' || (rule.audience === 'members' && audience === 'members'))) return false;
    return rule.kind === 'level' ? log.level === rule.value : String(log.code).toUpperCase() === String(rule.value).toUpperCase();
  });
}
