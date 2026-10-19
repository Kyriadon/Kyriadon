// ============================================================================
// kvStore.js
// Small key-value layer for accounts, staff sessions, approvals and rate limits.
// It talks to Upstash Redis through its REST API (the same KV_REST_API_URL and
// KV_REST_API_TOKEN variables the debug logs already use, no package needed).
// Without those variables (for example locally) everything runs in memory with
// exactly the same behaviour, so the rest of the code never has to care.
//
// Every operation below maps to one atomic Redis command, which is what makes
// "only once" rules (cooldowns, one decision per approval) safe when several
// requests arrive at the same moment.
// ============================================================================

const REDIS_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN);

// 'redis' keeps data between requests and between serverless instances; 'memory' does not
export const storageKind = useRedis ? 'redis' : 'memory';

// On Vercel every request can land on a different instance, so memory is not shared and
// anything that must be reliable (staff sessions, approvals, bans) has to refuse to run.
export const isVolatileHost = () => !useRedis && Boolean(process.env.VERCEL);

// ----------------------------------------------------------------------------
// In-memory fallback: a tiny interpreter for the handful of commands used below.
// Values are always strings, like in Redis.
// ----------------------------------------------------------------------------
const shared = globalThis;
if (!shared.__kyriadonKv) shared.__kyriadonKv = { strings: new Map(), hashes: new Map() };
const mem = shared.__kyriadonKv;

function liveEntry(key) {
  const entry = mem.strings.get(key);
  if (!entry) return null;
  if (entry.exp && entry.exp <= Date.now()) {
    mem.strings.delete(key);
    return null;
  }
  return entry;
}

function hashOf(key, create) {
  let hash = mem.hashes.get(key);
  if (!hash && create) {
    hash = new Map();
    mem.hashes.set(key, hash);
  }
  return hash || null;
}

// Runs one Redis-style command in memory (also used by the tests as a fake Redis)
export function memoryExec(command) {
  const [name, key, ...rest] = command;
  switch (String(name).toUpperCase()) {
    case 'GET':
      return liveEntry(key)?.value ?? null;
    case 'SET': {
      const [value, ...options] = rest;
      let px = 0;
      let nx = false;
      for (let i = 0; i < options.length; i += 1) {
        const option = String(options[i]).toUpperCase();
        if (option === 'PX') px = Number(options[(i += 1)]);
        else if (option === 'EX') px = Number(options[(i += 1)]) * 1000;
        else if (option === 'NX') nx = true;
      }
      if (nx && liveEntry(key)) return null;
      mem.strings.set(key, { value: String(value), exp: px > 0 ? Date.now() + px : 0 });
      return 'OK';
    }
    case 'DEL': {
      let removed = 0;
      [key, ...rest].forEach((item) => {
        if (liveEntry(item)) removed += 1;
        mem.strings.delete(item);
        if (mem.hashes.delete(item)) removed += 1;
      });
      return removed;
    }
    case 'PTTL': {
      const entry = liveEntry(key);
      if (!entry) return -2;
      return entry.exp ? Math.max(1, entry.exp - Date.now()) : -1;
    }
    case 'PEXPIRE': {
      const entry = liveEntry(key);
      if (!entry) return 0;
      entry.exp = Date.now() + Number(rest[0]);
      return 1;
    }
    case 'INCR': {
      const entry = liveEntry(key);
      const next = (entry ? Number(entry.value) || 0 : 0) + 1;
      mem.strings.set(key, { value: String(next), exp: entry ? entry.exp : 0 });
      return next;
    }
    case 'HSET': {
      const hash = hashOf(key, true);
      const isNew = !hash.has(String(rest[0]));
      hash.set(String(rest[0]), String(rest[1]));
      return isNew ? 1 : 0;
    }
    case 'HSETNX': {
      const hash = hashOf(key, true);
      if (hash.has(String(rest[0]))) return 0;
      hash.set(String(rest[0]), String(rest[1]));
      return 1;
    }
    case 'HGET':
      return hashOf(key, false)?.get(String(rest[0])) ?? null;
    case 'HGETALL': {
      const hash = hashOf(key, false);
      return hash ? [...hash.entries()].flat() : [];
    }
    case 'HDEL': {
      const hash = hashOf(key, false);
      if (!hash) return 0;
      return rest.reduce((count, field) => count + (hash.delete(String(field)) ? 1 : 0), 0);
    }
    case 'HLEN':
      return hashOf(key, false)?.size || 0;
    default:
      throw new Error(`Unsupported command ${name}`);
  }
}

// ----------------------------------------------------------------------------
// Redis over REST: several commands in one request, one result per command
// ----------------------------------------------------------------------------
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

// Runs commands in order and returns one result per command (in memory or on Redis)
export async function run(commands) {
  if (useRedis) return redisRun(commands);
  return commands.map((command) => memoryExec(command));
}

// Flat [field, value, field, value] array (how Redis returns a hash) to an object
export const pairsToObject = (flat) => {
  const out = {};
  for (let i = 0; i < (flat || []).length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
};

// ----------------------------------------------------------------------------
// The operations the rest of the code uses
// ----------------------------------------------------------------------------
export const kv = {
  get: async (key) => (await run([['GET', key]]))[0],

  // Returns true when the value was written. With nx it is only written if the key is free,
  // so exactly one of several simultaneous callers gets true.
  set: async (key, value, { px, nx } = {}) => {
    const command = ['SET', key, String(value)];
    if (px) command.push('PX', Math.max(1, Math.round(px)));
    if (nx) command.push('NX');
    return (await run([command]))[0] === 'OK';
  },

  del: async (...keys) => (await run([['DEL', ...keys]]))[0],

  // Remaining lifetime in milliseconds, or a negative number when there is none
  pttl: async (key) => (await run([['PTTL', key]]))[0],

  incr: async (key) => (await run([['INCR', key]]))[0],

  hset: async (hash, field, value) => (await run([['HSET', hash, field, String(value)]]))[0],

  // True for the first caller only: this is what makes a decision final
  hsetnx: async (hash, field, value) => (await run([['HSETNX', hash, field, String(value)]]))[0] === 1,

  hget: async (hash, field) => (await run([['HGET', hash, field]]))[0],

  hgetall: async (hash) => pairsToObject((await run([['HGETALL', hash]]))[0]),

  hdel: async (hash, ...fields) => (fields.length ? (await run([['HDEL', hash, ...fields]]))[0] : 0),

  hlen: async (hash) => (await run([['HLEN', hash]]))[0],

  // Several reads in one round trip: [[hash], ...] to [object, ...]
  hgetallMany: async (hashes) => (await run(hashes.map((hash) => ['HGETALL', hash]))).map(pairsToObject),
};

// ----------------------------------------------------------------------------
// Fixed-window counter: how many times has this key been used in the last
// windowMs? The counter starts on the first use and resets by itself.
// ----------------------------------------------------------------------------
export async function countInWindow(key, windowMs) {
  const [, count, ttl] = await run([['SET', key, '0', 'PX', windowMs, 'NX'], ['INCR', key], ['PTTL', key]]);
  let retryMs = ttl > 0 ? ttl : windowMs;
  // A counter without an expiry would block someone forever, so one is always guaranteed
  if (ttl === -1) {
    await run([['PEXPIRE', key, windowMs]]);
    retryMs = windowMs;
  }
  return { count, retryMs };
}
