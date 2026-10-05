// ============================================================================
// index.js
// Kyriadon homepage. Layout: header (icon, search, login), hero panel,
// quick links, announcements, statistics, footer.
// All visual values live in lib/siteDesign.js and styles/homeStyles.css.
// ============================================================================
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { behavior, gradientStops } from '../lib/siteDesign';

// ----------------------------------------------------------------------------
// Content: everything the page says lives here so copy is easy to edit
// ----------------------------------------------------------------------------
const content = {
  siteName: 'Kyriadon',
  description:
    "The home of Kyriadon's Minecraft mods and projects: search the library, read announcements and follow community stats.",
  hero: {
    title: 'Everything Kyriadon, in one place',
    subtitle: 'Mods, announcements and community stats for the Kyriadon Minecraft community.',
    body: "Search the full library of Kyriadon's mods and projects, catch the latest announcements, and see how the community is doing. Log in with Discord to get started.",
  },
  socials: {
    discord: 'https://discord.gg/B6czYB7wa7',
    youtube: 'https://youtube.com/@Kyriadon',
    nameMc: 'https://namemc.com/profile/Kyriadon.1',
  },
  // Where the "Kyriadon" credit in the footer leads when clicked
  creditHref: 'https://discord.gg/B6czYB7wa7',
};

// Announcement categories: label and badge tone
const categoryMeta = {
  update: { label: 'Update', tone: 'info' },
  event: { label: 'Event', tone: 'success' },
  maintenance: { label: 'Maintenance', tone: 'warning' },
  community: { label: 'Community', tone: 'neutral' },
};

// Local storage key for recent searches in the palette
const RECENT_KEY = 'kyriadon:recentSearches';

// ----------------------------------------------------------------------------
// Icons. UI icons are stroke-based (1.75 width, round caps).
// Brand icons (Discord, YouTube, NameMC) are filled marks.
// ----------------------------------------------------------------------------
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// Magnifying glass
function IconSearch({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

// Right-pointing chevron
function IconChevron({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// Close (X)
function IconClose({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

// Megaphone for announcements
function IconMegaphone({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
    </svg>
  );
}

// Discord mark
function IconDiscord({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

// YouTube mark
function IconYouTube({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// NameMC mark (simplified blocky "N"; swap the path for the official favicon if you prefer)
function IconNameMc({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M4 4h4.2l7.6 9.4V4H20v16h-4.2L8.2 10.6V20H4z" />
    </svg>
  );
}

// K mark with the bubblegum pink to blue gradient (footer slug)
function IconKMark({ size = 18 }) {
  const [a, b, c] = gradientStops.slugK;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="slugGradient" gradientUnits="userSpaceOnUse" x1="5" y1="4" x2="20" y2="20">
          <stop offset="0" stopColor={a} />
          <stop offset="0.55" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <path
        d="M7 4.5v15M17.5 4.5 8.5 12.5M11.5 11l6 8.5"
        fill="none"
        stroke="url(#slugGradient)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Heart: pink at rest, gradient layer fades in on hover (see .heart in the CSS)
const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

function IconHeart({ size = 16 }) {
  const [a, b, c] = gradientStops.heart;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="heartGradient" gradientUnits="userSpaceOnUse" x1="2" y1="3" x2="22" y2="21">
          <stop offset="0" stopColor={a} />
          <stop offset="0.5" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <path className="heartBase" fill="currentColor" d={HEART_PATH} />
      <path className="heartGlow" fill="url(#heartGradient)" d={HEART_PATH} />
    </svg>
  );
}

// ----------------------------------------------------------------------------
// Grid <-> List icon that morphs smoothly between the two shapes.
// Four rectangles are interpolated frame by frame, so reversing mid-animation
// continues from the current shape instead of jumping.
// ----------------------------------------------------------------------------
const GRID_RECTS = [
  { x: 3, y: 3, w: 8, h: 8, r: 2 },
  { x: 13, y: 3, w: 8, h: 8, r: 2 },
  { x: 3, y: 13, w: 8, h: 8, r: 2 },
  { x: 13, y: 13, w: 8, h: 8, r: 2 },
];

const LIST_RECTS = [
  { x: 3, y: 1.875, w: 18, h: 3, r: 1.5 },
  { x: 3, y: 7.625, w: 18, h: 3, r: 1.5 },
  { x: 3, y: 13.375, w: 18, h: 3, r: 1.5 },
  { x: 3, y: 19.125, w: 18, h: 3, r: 1.5 },
];

// Linear interpolation between two rectangles
const lerpRect = (from, to, t) => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
  w: from.w + (to.w - from.w) * t,
  h: from.h + (to.h - from.h) * t,
  r: from.r + (to.r - from.r) * t,
});

// mode "grid" shows the Grid icon, mode "list" shows the List icon
function MorphIcon({ mode }) {
  const initial = mode === 'grid' ? GRID_RECTS : LIST_RECTS;
  const [rects, setRects] = useState(initial);
  const currentRef = useRef(initial);

  // Animate from whatever shape is on screen to the new target shape
  useEffect(() => {
    const to = mode === 'grid' ? GRID_RECTS : LIST_RECTS;
    const from = currentRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reduced motion: switch shape instantly
    if (reduceMotion) {
      currentRef.current = to;
      setRects(to);
      return undefined;
    }

    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / behavior.morphMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const next = to.map((rect, i) => lerpRect(from[i], rect, eased));
      currentRef.current = next;
      setRects(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  // The same rectangles are drawn twice: plain, and with the hover gradient on top
  const draw = (fill) =>
    rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.r} fill={fill} />);
  const gradientId = mode === 'grid' ? 'viewGradGrid' : 'viewGradList';

  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="viewGradGrid" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
          <stop offset="0" stopColor={gradientStops.viewGrid[0]} />
          <stop offset="1" stopColor={gradientStops.viewGrid[1]} />
        </linearGradient>
        <linearGradient id="viewGradList" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
          <stop offset="0" stopColor={gradientStops.viewList[0]} />
          <stop offset="1" stopColor={gradientStops.viewList[1]} />
        </linearGradient>
      </defs>
      <g className="viewIconBase">{draw('currentColor')}</g>
      <g className="viewIconGlow">{draw(`url(#${gradientId})`)}</g>
    </svg>
  );
}

// ----------------------------------------------------------------------------
// Hook: fetch JSON with loading, error and retry states
// ----------------------------------------------------------------------------
function useFetch(url) {
  const [state, setState] = useState({ status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', data: null });
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => setState({ status: 'ready', data }))
      .catch((err) => {
        if (err.name !== 'AbortError') setState({ status: 'error', data: null });
      });
    return () => controller.abort();
  }, [url, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

// ----------------------------------------------------------------------------
// Hook: scroll direction edge fades.
// Scrolling down fades the top edge, scrolling up fades the bottom edge.
// The fade eases out again once scrolling stops.
// ----------------------------------------------------------------------------
function useScrollFade({ idleMs, threshold }) {
  const [fade, setFade] = useState({ top: false, bottom: false });

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    let timer;

    // Only commit state when something actually changed (avoids re-render spam)
    const commit = (next) =>
      setFade((prev) => (prev.top === next.top && prev.bottom === next.bottom ? prev : next));

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const delta = y - lastY;
      if (Math.abs(delta) < threshold) return;

      commit({ top: delta > 0 && y > 8, bottom: delta < 0 && y < maxY - 8 });
      lastY = y;
      clearTimeout(timer);
      timer = setTimeout(() => commit({ top: false, bottom: false }), idleMs);
    };

    // Throttled to one update per animation frame
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [idleMs, threshold]);

  return fade;
}

// ----------------------------------------------------------------------------
// Helpers: date and number formatting
// ----------------------------------------------------------------------------
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const numberFormat = new Intl.NumberFormat('en');

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
};

const formatCount = (value) => (typeof value === 'number' ? numberFormat.format(value) : '\u2014');

// Wraps matched query words in <mark> for search results
function highlight(text, query) {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!tokens.length || !text) return text;
  // With a capture group, odd indexes are the matches
  return text.split(new RegExp(`(${tokens.join('|')})`, 'ig')).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

// ----------------------------------------------------------------------------
// Announcements panel: latest four, list or gallery view
// ----------------------------------------------------------------------------
function AnnouncementsPanel() {
  const { status, data, retry } = useFetch('/api/announcements?limit=4');
  const [view, setView] = useState('list');
  const items = data?.announcements ?? [];

  // The toggle previews the layout it switches to: Grid icon in list view, List icon in gallery view
  const nextView = view === 'list' ? 'gallery' : 'list';
  const iconMode = view === 'list' ? 'grid' : 'list';

  return (
    <section className="panel panelGlow areaNews" id="announcements" aria-labelledby="announcementsTitle">
      <div className="panelHeader">
        <h3 id="announcementsTitle">Announcements</h3>
        <button
          type="button"
          className="viewToggle"
          onClick={() => setView(nextView)}
          aria-label={`Switch to ${nextView} view`}
        >
          <MorphIcon mode={iconMode} />
        </button>
      </div>

      {/* Loading placeholders */}
      {status === 'loading' && (
        <div className="newsList" data-view={view} aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeletonCard" />
          ))}
        </div>
      )}

      {/* Error state with retry */}
      {status === 'error' && (
        <div className="stateBox" role="alert">
          <span>Announcements could not be loaded.</span>
          <button type="button" className="btn btnSecondary btnCompact" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {status === 'ready' && items.length === 0 && <div className="stateBox">No announcements yet. Check back soon.</div>}

      {/* Items: keyed by view so a view change replays the small entrance */}
      {status === 'ready' && items.length > 0 && (
        <div className="newsList" data-view={view} key={view}>
          {items.map((item, index) => {
            const meta = categoryMeta[item.category] || categoryMeta.community;
            return (
              <article className="newsItem" key={item.id} style={{ '--i': index }}>
                <div className="newsTop">
                  <span className="badge" data-tone={meta.tone}>
                    {meta.label}
                  </span>
                  <time className="newsDate" dateTime={item.date}>
                    {formatDate(item.date)}
                  </time>
                </div>
                <h4 className="newsTitle">{item.title}</h4>
                {item.excerpt && <p className="newsExcerpt">{item.excerpt}</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Statistics panel: Discord counts plus site totals
// ----------------------------------------------------------------------------
const statTiles = [
  { key: 'members', label: 'Discord members', pick: (d) => d.discord?.members },
  { key: 'online', label: 'Online now', pick: (d) => d.discord?.online, live: true },
  { key: 'projects', label: 'Mods and projects', pick: (d) => d.projects },
  { key: 'announcements', label: 'Announcements', pick: (d) => d.announcements },
];

function StatsPanel() {
  const { status, data } = useFetch('/api/stats');
  const unavailable = status === 'error' || (status === 'ready' && !data?.discord);

  return (
    <section className="panel panelGlow areaStats" aria-labelledby="statsTitle">
      <div className="panelHeader">
        <h3 id="statsTitle">Statistics</h3>
      </div>

      <div className="statGrid" aria-busy={status === 'loading'}>
        {statTiles.map((tile) => (
          <div className="statTile" key={tile.key}>
            <span className="statLabel">
              {tile.live && <span className="liveDot" aria-hidden="true" />}
              {tile.label}
            </span>
            {status === 'loading' ? (
              <span className="skeleton" style={{ width: '60%' }} />
            ) : (
              <span className="statValue">{formatCount(data ? tile.pick(data) : null)}</span>
            )}
          </div>
        ))}
      </div>

      {unavailable && <p className="helperText">Live Discord counts are unavailable right now.</p>}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Quick links panel
// ----------------------------------------------------------------------------
function QuickLinksPanel({ onOpenSearch }) {
  // Each link is either an in-page action, an anchor or an external URL
  const links = [
    { id: 'search', title: 'Search mods', description: 'Find any mod or project', icon: <IconSearch />, action: onOpenSearch },
    { id: 'news', title: 'Latest announcements', description: 'What is new right now', icon: <IconMegaphone />, href: '#announcements' },
    { id: 'discord', title: 'Join the Discord', description: 'Chat with the community', icon: <IconDiscord />, href: content.socials.discord, external: true },
    { id: 'youtube', title: 'Watch on YouTube', description: 'Videos and showcases', icon: <IconYouTube />, href: content.socials.youtube, external: true },
  ];

  return (
    <section className="panel panelGlow areaLinks" aria-labelledby="linksTitle">
      <div className="panelHeader">
        <h3 id="linksTitle">Quick links</h3>
      </div>
      <ul className="linkList">
        {links.map((link) => {
          // Shared inner layout for buttons and anchors
          const inner = (
            <>
              <span className="linkIcon">{link.icon}</span>
              <span className="linkText">
                <span className="linkTitle">{link.title}</span>
                <span className="linkDesc">{link.description}</span>
              </span>
              <span className="linkChevron">
                <IconChevron />
              </span>
            </>
          );
          return (
            <li key={link.id}>
              {link.action ? (
                <button type="button" className="linkRow" onClick={link.action}>
                  {inner}
                </button>
              ) : (
                <a
                  className="linkRow"
                  href={link.href}
                  {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {inner}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Search palette (Ctrl/Cmd + K).
// Talks to /api/search, which merges every registered source, so new systems
// such as Projects show up here without any change to this component.
// ----------------------------------------------------------------------------
function SearchPalette({ open, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ status: 'idle', groups: [] });
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState([]);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  // Flat list of results for keyboard navigation, plus each group's start index
  const { flat, groups } = useMemo(() => {
    let offset = 0;
    const withOffsets = state.groups.map((group) => {
      const start = offset;
      offset += group.results.length;
      return { ...group, start };
    });
    return { flat: state.groups.flatMap((group) => group.results), groups: withOffsets };
  }, [state.groups]);

  // On open: reset, load recent searches, lock page scroll and focus the input
  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setActive(0);
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'));
    } catch {
      setRecent([]);
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Debounced, cancellable search: a newer query always cancels the older one
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setState((prev) => ({ ...prev, status: 'loading' }));
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
          if (!res.ok) throw new Error('Search failed');
          const data = await res.json();
          setState({ status: 'ready', groups: data.groups || [] });
          setActive(0);
        } catch (err) {
          if (err.name !== 'AbortError') setState({ status: 'error', groups: [] });
        }
      },
      query ? 160 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  // Keep the highlighted option visible while arrowing through a long list
  useEffect(() => {
    document.getElementById(`searchOption-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // Remember the last five distinct queries
  const rememberQuery = useCallback((value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      const existing = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      const next = [trimmed, ...existing.filter((entry) => entry !== trimmed)].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* storage can be unavailable (private mode), search still works */
    }
  }, []);

  // Open a result and close the palette
  const choose = useCallback(
    (item) => {
      if (!item) return;
      rememberQuery(query);
      onClose();
      router.push(item.href);
    },
    [onClose, query, rememberQuery, router],
  );

  // Keyboard model: arrows move, Enter opens, Escape closes, Tab stays inside
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!flat.length) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + delta + flat.length) % flat.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(flat[active]);
    } else if (event.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll('input, button');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  if (!open) return null;

  const showRecent = !query && recent.length > 0;

  return (
    // Clicking the backdrop closes the palette
    <div
      className="searchBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="searchDialog" role="dialog" aria-modal="true" aria-label="Search" ref={dialogRef} onKeyDown={onKeyDown}>
        {/* Input row (ARIA combobox pattern) */}
        <div className="searchField">
          <IconSearch />
          <input
            ref={inputRef}
            className="searchInput"
            type="text"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="searchResults"
            aria-autocomplete="list"
            aria-activedescendant={flat.length ? `searchOption-${active}` : undefined}
            placeholder="Search for a mod..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
          />
          <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={onClose} aria-label="Close search">
            <IconClose />
          </button>
        </div>

        <div className="searchBody">
          {/* Recent searches */}
          {showRecent && (
            <div className="searchRecent">
              <span className="searchGroupLabel" style={{ padding: 0 }}>
                Recent
              </span>
              {recent.map((entry) => (
                <button type="button" className="searchChip" key={entry} onClick={() => setQuery(entry)}>
                  {entry}
                </button>
              ))}
            </div>
          )}

          {/* Status messages (announced politely to screen readers) */}
          {state.status === 'error' && (
            <div className="searchState" role="status">
              Search is unavailable right now. Try again in a moment.
            </div>
          )}
          {state.status === 'loading' && flat.length === 0 && (
            <div className="searchState" role="status">
              Searching...
            </div>
          )}
          {state.status === 'ready' && flat.length === 0 && (
            <div className="searchState" role="status">
              {query ? `No results for \u201C${query.trim()}\u201D. Try a different name or tag.` : 'Start typing to search mods and projects.'}
            </div>
          )}

          {/* Grouped results */}
          <div id="searchResults" role="listbox" aria-label="Search results">
            {groups.map((group) => (
              <div key={group.type} role="group" aria-labelledby={`searchGroup-${group.type}`}>
                <div className="searchGroupLabel" id={`searchGroup-${group.type}`}>
                  {group.label}
                </div>
                {group.results.map((item, i) => {
                  const index = group.start + i;
                  return (
                    <div
                      key={item.id}
                      id={`searchOption-${index}`}
                      className="searchResult"
                      role="option"
                      aria-selected={index === active}
                      onMouseMove={() => index !== active && setActive(index)}
                      onClick={() => choose(item)}
                    >
                      <span className="searchResultIcon" aria-hidden="true">
                        {item.title.charAt(0).toUpperCase()}
                      </span>
                      <span className="searchResultText">
                        <span className="searchTitle">{highlight(item.title, query)}</span>
                        {item.description && <span className="searchDesc">{highlight(item.description, query)}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="searchFooter" aria-hidden="true">
          <span className="searchHint">
            <span className="kbd">{'\u2191'}</span>
            <span className="kbd">{'\u2193'}</span> navigate
          </span>
          <span className="searchHint">
            <span className="kbd">{'\u21B5'}</span> open
          </span>
          <span className="searchHint">
            <span className="kbd">Esc</span> close
          </span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------
export default function Home() {
  const { data: session, status: authStatus } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [modifierLabel, setModifierLabel] = useState('Ctrl');
  const triggerRef = useRef(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const fade = useScrollFade(behavior.scrollFade);

  // Show the command key on Apple devices (set after mount to avoid hydration mismatch)
  useEffect(() => {
    if (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) setModifierLabel('\u2318');
  }, []);

  // Ctrl/Cmd + K toggles the palette from anywhere on the page
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((isOpen) => !isOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  // Closing returns focus to the search trigger
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return (
    <>
      <Head>
        <title>{content.siteName}</title>
        <meta name="description" content={content.description} />
        <meta property="og:title" content={content.siteName} />
        <meta property="og:description" content={content.description} />
        <meta property="og:type" content="website" />
        <link rel="icon" href="/Server-Icon.jpg" />
      </Head>

      <div className="page">
        {/* Environment: one limited ambient glow and the scroll edge fades */}
        <div className="ambient" aria-hidden="true" />
        <div className="edgeFade edgeFadeTop" data-active={fade.top} aria-hidden="true" />
        <div className="edgeFade edgeFadeBottom" data-active={fade.bottom} aria-hidden="true" />

        {/* Header: icon tile (left), search (center), login (right) */}
        <header className="header">
          <div className="headerStart">
            <a className="logoTile" href="/" aria-label="Kyriadon home">
              <img src="/Server-Icon.jpg" alt="" width="48" height="48" decoding="async" />
            </a>
          </div>

          <div className="headerCenter">
            <button type="button" className="searchTrigger" onClick={openSearch} ref={triggerRef} aria-label="Search mods" aria-keyshortcuts="Control+K Meta+K">
              <IconSearch />
              <span className="searchLabel">Search for a mod...</span>
              <span className="kbdGroup" aria-hidden="true">
                <span className="kbd">{modifierLabel}</span>
                <span className="kbd">K</span>
              </span>
            </button>
          </div>

          <div className="headerEnd">
            {authStatus === 'authenticated' ? (
<div className="userChip" data-menu-open={userMenuOpen} ref={userMenuRef}>
  <button
    type="button"
    className="btn btnGhost btnIcon btnCompact"
    onClick={() => setUserMenuOpen(!userMenuOpen)}
    aria-label="User menu"
    aria-expanded={userMenuOpen}
  >
    {session.user?.image && <img className="userAvatar" src={session.user.image} alt="" width="32" height="32" />}
  </button>
  <div className="userMenu">
    <button type="button" className="userMenuItem" onClick={() => { setUserMenuOpen(false); /* navigate to account */ }}>
      Account
    </button>
    <button type="button" className="userMenuItem" onClick={() => { setUserMenuOpen(false); /* navigate to notifications */ }}>
      Notifications
    </button>
    <button type="button" className="userMenuItem userMenuLogout" onClick={() => { setUserMenuOpen(false); signOut(); }}>
      Log out
    </button>
  </div>
</div>

        <main className="main">
          <div className="homeGrid">
            {/* Hero: states what the site is. The shell stays still, only the panel lays down on hover. */}
            <section className="heroShell areaHero" aria-labelledby="heroTitle">
              <div className="heroPanel">
                <div className="heroGlow" aria-hidden="true" />
                <div className="heroContent">
                  <h1 id="heroTitle">{content.hero.title}</h1>
                  <h2>{content.hero.subtitle}</h2>
                  <p>{content.hero.body}</p>
                </div>
              </div>
            </section>

            {/* Lower right: announcements, then statistics. Lower left: quick links. */}
            <QuickLinksPanel onOpenSearch={openSearch} />
            <AnnouncementsPanel />
            <StatsPanel />
          </div>
        </main>

        {/* Footer: K slug with icon-only socials (left), credit (right) */}
        <footer className="footer">
          <div className="footerSlug">
            <span className="slugMark" aria-hidden="true">
              <IconKMark />
            </span>
            <span className="slugDivider" aria-hidden="true" />
            <a className="socialLink" href={content.socials.discord} target="_blank" rel="noopener noreferrer" aria-label="Discord">
              <IconDiscord />
            </a>
            <a className="socialLink" href={content.socials.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <IconYouTube />
            </a>
            <a className="socialLink" href={content.socials.nameMc} target="_blank" rel="noopener noreferrer" aria-label="NameMC">
              <IconNameMc />
            </a>
          </div>

          <p className="credit">
            Made with
            <span className="heart" role="img" aria-label="love">
              <IconHeart />
            </span>
            by
            <a className="roleChip" href={content.creditHref} target="_blank" rel="noopener noreferrer">
              <span className="roleName">Kyriadon</span>
            </a>
          </p>
        </footer>
      </div>

      {/* Search palette renders above everything */}
      <SearchPalette open={searchOpen} onClose={closeSearch} />
    </>
  );
}
