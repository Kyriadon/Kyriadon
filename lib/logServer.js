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
export const DEVELOPER_ROLE_ID = '';

// Who may VIEW logs. false: any signed-in Discord user can view (only staff can delete).
// true: only Staff and Developer roles can view; everyone else gets "no access".
export const VIEW_REQUIRES_ROLE = false;

const MAX_LOGS = 2000;
const LEVELS = ['info', 'warning', 'error'];

// Temporary file on serverless hosts. Swap this block for a database when you need
// logs to survive redeploys (every function in this file keeps the same signature).
const STORE_FILE = path.join(os.tmpdir(), 'kyriadon-logs.json');

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
export const readLogs = () => [...store.logs].sort((a, b) => (a.time < b.time ? 1 : -1));

export function appendLogs(entries) {
  entries.forEach((entry) => store.logs.push(entry));
  if (store.logs.length > MAX_LOGS) store.logs.splice(0, store.logs.length - MAX_LOGS);
  persist();
}

export function deleteLogs({ ids, level, all }) {
  const before = store.logs.length;
  if (all) store.logs = [];
  else if (level) store.logs = store.logs.filter((log) => log.level !== level);
  else if (Array.isArray(ids)) {
    const set = new Set(ids);
    store.logs = store.logs.filter((log) => !set.has(log.id));
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
// Discord roles of a user in your server (needs DISCORD_BOT_TOKEN and
// DISCORD_GUILD_ID in .env and the role IDs above). Cached for 60 seconds.
// ----------------------------------------------------------------------------
export async function getViewerRoles(userId) {
  const configured = Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID && (STAFF_ROLE_ID || DEVELOPER_ROLE_ID));
  const none = { staff: false, developer: false, configured };
  if (!userId || !configured) return none;

  const cached = store.roles.get(userId);
  if (cached && Date.now() - cached.at < 60 * 1000) return cached.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Discord responded with ${response.status}`);
    const member = await response.json();
    const roles = Array.isArray(member.roles) ? member.roles : [];
    const value = {
      staff: Boolean(STAFF_ROLE_ID) && roles.includes(STAFF_ROLE_ID),
      developer: Boolean(DEVELOPER_ROLE_ID) && roles.includes(DEVELOPER_ROLE_ID),
      configured,
    };
    store.roles.set(userId, { at: Date.now(), value });
    return value;
  } catch {
    return none;
  } finally {
    clearTimeout(timer);
  }
}
