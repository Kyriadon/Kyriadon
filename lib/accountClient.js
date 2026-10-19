// ============================================================================
// accountClient.js
// Browser-side state for the Account modal and the admin review of staff logins.
// It imports nothing from the shell or from the server files, so any component
// can use it without creating an import loop.
//   AccountProvider / useAccount   your profile, roles and staff login state
//   useApprovals                   live review state of staff logins (admins)
//   openSync                       instant updates between tabs of one browser
// ============================================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

const CACHE_KEY = 'kyriadon:account';

// ----------------------------------------------------------------------------
// JSON helper: resolves with { ok, status, data }, rejects only on network failure
// ----------------------------------------------------------------------------
export async function sendJson(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* an empty or non-JSON body */
  }
  return { ok: response.ok, status: response.status, data };
}

// ----------------------------------------------------------------------------
// Instant messages between tabs of the same browser. BroadcastChannel where it
// exists, the "storage" event of localStorage everywhere else.
// ----------------------------------------------------------------------------
export function openSync(name, onMessage) {
  let channel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(name);
      channel.onmessage = (event) => onMessage(event.data);
    } catch {
      channel = null;
    }
  }
  const storageKey = `kyriadon:sync:${name}`;
  const onStorage = (event) => {
    if (event.key !== storageKey || !event.newValue) return;
    try {
      onMessage(JSON.parse(event.newValue).data);
    } catch {
      /* ignore a malformed message */
    }
  };
  if (!channel) window.addEventListener('storage', onStorage);

  return {
    send(data) {
      if (channel) {
        try {
          channel.postMessage(data);
        } catch {
          /* the channel was closed */
        }
        return;
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify({ data, n: Math.random() }));
      } catch {
        /* storage can be unavailable */
      }
    },
    close() {
      if (channel) channel.close();
      else window.removeEventListener('storage', onStorage);
    },
  };
}

// ----------------------------------------------------------------------------
// Time helpers
// ----------------------------------------------------------------------------
const pad = (value) => String(value).padStart(2, '0');

// 12:34 under an hour, 3h 20m under a day, 2d 4h beyond
export function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${pad(minutes)}:${pad(total % 60)}`;
}

// Milliseconds left until `target` (a server timestamp), re-rendering every second
export function useRemaining(target, now) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!target || target - now() <= 0) return undefined;
    const timer = setInterval(() => {
      setTick((value) => value + 1);
      if (target - now() <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [target, now]);
  return target ? Math.max(0, target - now()) : 0;
}

// ----------------------------------------------------------------------------
// Account state
// ----------------------------------------------------------------------------
const AccountContext = createContext({
  status: 'idle',
  profile: null,
  viewer: null,
  staff: null,
  storage: null,
  volatile: false,
  refresh: async () => null,
  apply: () => {},
  announce: () => {},
  now: () => Date.now(),
});

export const useAccount = () => useContext(AccountContext);

export function AccountProvider({ children }) {
  const { data: session, status: authStatus } = useSession();
  const userId = session?.user?.id || null;
  const [state, setState] = useState({ status: 'idle', data: null, offset: 0 });
  const sequence = useRef(0);
  const syncRef = useRef(null);

  // Loads everything about the account. Only the newest request may update the state.
  const refresh = useCallback(async () => {
    const mine = (sequence.current += 1);
    try {
      const response = await fetch('/api/account', { cache: 'no-store' });
      if (response.status === 401) {
        if (mine === sequence.current) setState({ status: 'idle', data: null, offset: 0 });
        return null;
      }
      if (!response.ok) throw new Error('Request failed');
      const data = await response.json();
      if (mine !== sequence.current) return data;
      setState({ status: 'ready', data, offset: data.serverNow - Date.now() });
      return data;
    } catch {
      if (mine === sequence.current) setState((previous) => ({ ...previous, status: previous.data?.viewer ? 'ready' : 'error' }));
      return null;
    }
  }, []);

  // Load when signed in, clear when signed out. The last known profile is shown straight
  // away so the header avatar does not flash the Discord one first.
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus !== 'authenticated' || !userId) {
      sequence.current += 1;
      setState({ status: 'idle', data: null, offset: 0 });
      return;
    }
    try {
      const cached = JSON.parse(localStorage.getItem(`${CACHE_KEY}:${userId}`) || 'null');
      if (cached?.username) setState({ status: 'loading', data: { profile: cached }, offset: 0 });
      else setState((previous) => ({ ...previous, status: 'loading' }));
    } catch {
      setState((previous) => ({ ...previous, status: 'loading' }));
    }
    refresh();
  }, [authStatus, userId, refresh]);

  // Remember the profile for the next visit
  useEffect(() => {
    if (!userId || !state.data?.profile || state.status !== 'ready') return;
    try {
      localStorage.setItem(`${CACHE_KEY}:${userId}`, JSON.stringify(state.data.profile));
    } catch {
      /* storage can be unavailable */
    }
  }, [userId, state.data, state.status]);

  // Other tabs: a change made in one is loaded by the others straight away
  useEffect(() => {
    const sync = openSync('kyriadon-account', () => refresh());
    syncRef.current = sync;
    return () => {
      sync.close();
      syncRef.current = null;
    };
  }, [refresh]);

  const announce = useCallback(() => syncRef.current?.send({ at: Date.now() }), []);

  // Updates part of the state at once (the server answer of a change), without a reload
  const apply = useCallback((patch) => {
    setState((previous) => ({ ...previous, data: { ...(previous.data || {}), ...patch } }));
  }, []);

  const offset = state.offset;
  const now = useCallback(() => Date.now() + offset, [offset]);

  const value = useMemo(
    () => ({
      status: state.status,
      profile: state.data?.profile || null,
      viewer: state.data?.viewer || null,
      staff: state.data?.staff || null,
      storage: state.data?.storage || null,
      volatile: Boolean(state.data?.volatile),
      refresh,
      apply,
      announce,
      now,
    }),
    [state, refresh, apply, announce, now],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

// ----------------------------------------------------------------------------
// Review of staff logins (admins)
// A record is { id, userId, userName, at, status: pending | approved | disapproved,
// decidedBy, decidedAt, action }. A decision is final, so a decided record never goes
// back to pending, whichever answer arrives last.
// ----------------------------------------------------------------------------
const POLL_MS = 3000;

const rank = (record) => (!record ? -1 : record.action ? 2 : record.status !== 'pending' ? 1 : 0);

// Of two versions of the same record, the one that is further along
export const pickApproval = (a, b) => (rank(b) > rank(a) ? b : a);

export function useApprovals({ enabled }) {
  const [records, setRecords] = useState({});
  const recordsRef = useRef(records);
  const revision = useRef(-1);
  const inflight = useRef(new Set());
  const syncRef = useRef(null);
  const stopped = useRef(false);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  // Merges records without ever moving one backwards
  const merge = useCallback((incoming) => {
    setRecords((previous) => {
      let next = previous;
      Object.entries(incoming).forEach(([id, record]) => {
        const chosen = pickApproval(previous[id], record);
        if (chosen !== previous[id]) {
          if (next === previous) next = { ...previous };
          next[id] = chosen;
        }
      });
      return next;
    });
  }, []);

  // One check for changes. The answer is tiny when nothing changed.
  const poll = useCallback(async () => {
    try {
      const response = await fetch(`/api/staff/approvals?rev=${revision.current}`, { cache: 'no-store' });
      if (response.status === 401 || response.status === 403) return 'stop';
      if (!response.ok) return 'retry';
      const data = await response.json();
      revision.current = data.rev;
      if (data.changed && data.approvals) merge(data.approvals);
      return 'ok';
    } catch {
      return 'retry';
    }
  }, [merge]);

  // Checks every few seconds while the tab is visible, at once when it comes back,
  // and instantly when another tab of this browser has just decided something
  useEffect(() => {
    if (!enabled) return undefined;
    stopped.current = false;
    let timer = null;
    let busy = false;
    let failures = 0;

    const loop = async () => {
      if (stopped.current || busy) return;
      busy = true;
      try {
        if (document.visibilityState === 'visible') {
          const result = await poll();
          if (result === 'stop') {
            stopped.current = true;
            return;
          }
          failures = result === 'retry' ? Math.min(failures + 1, 4) : 0;
        }
      } finally {
        busy = false;
      }
      if (!stopped.current) timer = setTimeout(loop, POLL_MS * (1 + failures * 2));
    };

    const wake = () => {
      if (document.visibilityState !== 'visible' || stopped.current) return;
      clearTimeout(timer);
      loop();
    };

    const sync = openSync('kyriadon-approvals', (message) => {
      if (message?.record?.id) merge({ [message.record.id]: message.record });
    });
    syncRef.current = sync;

    loop();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      stopped.current = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      sync.close();
      syncRef.current = null;
    };
  }, [enabled, poll, merge]);

  // Approve or disapprove. The screen changes immediately (the red ! disappears for this
  // admin at once), the server then confirms. If another admin was faster, their decision
  // replaces this one. Sending twice is impossible: a second click is ignored.
  const decide = useCallback(
    async (approval, op, me) => {
      const { id } = approval;
      if (inflight.current.has(id)) return { ok: false, code: 'busy' };
      const known = pickApproval(approval, recordsRef.current[id]);
      if (known.status !== 'pending') return { ok: false, code: 'already_decided', approval: known };

      inflight.current.add(id);
      const status = op === 'approve' ? 'approved' : 'disapproved';
      merge({ [id]: { ...known, status, decidedBy: me, decidedAt: Date.now() } });
      try {
        const { status: http, data } = await sendJson('/api/staff/approvals', 'POST', { id, op });
        if (data?.approval) {
          merge({ [id]: data.approval });
          if (data.ok) syncRef.current?.send({ record: data.approval });
          return data;
        }
        // The server refused (for example the role was removed): put the alert back
        setRecords((previous) => ({ ...previous, [id]: known }));
        return { ok: false, code: 'refused', message: http === 403 ? 'Only admins can review staff logins.' : 'The review could not be saved. Try again.' };
      } catch {
        setRecords((previous) => ({ ...previous, [id]: known }));
        return { ok: false, code: 'network', message: 'Could not reach the server. Try again.' };
      } finally {
        inflight.current.delete(id);
      }
    },
    [merge],
  );

  // Kick the session or block the login (only after a disapproval)
  const act = useCallback(
    async (approval, payload) => {
      const { id } = approval;
      if (inflight.current.has(`act:${id}`)) return { ok: false, code: 'busy' };
      inflight.current.add(`act:${id}`);
      try {
        const { data } = await sendJson('/api/staff/approvals', 'POST', { id, ...payload });
        if (data?.approval) {
          merge({ [id]: data.approval });
          if (data.ok) syncRef.current?.send({ record: data.approval });
        }
        return data || { ok: false, code: 'refused', message: 'The action could not be saved. Try again.' };
      } catch {
        return { ok: false, code: 'network', message: 'Could not reach the server. Try again.' };
      } finally {
        inflight.current.delete(`act:${id}`);
      }
    },
    [merge],
  );

  return { records, decide, act };
}
