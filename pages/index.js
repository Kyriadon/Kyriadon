// ============================================================================
// index.js
// Kyriadon homepage. Layout: hero panel, quick links, announcements, statistics.
// The header, footer and search palette come from components/siteShell.js.
// All visual values live in lib/siteDesign.js and styles/homeStyles.css.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { behavior, gradientStops } from '../lib/siteDesign';
import {
  IconChevron,
  IconDiscord,
  IconInfo,
  IconMegaphone,
  IconYouTube,
  SiteShell,
  formatCount,
  siteLinks,
  useFetch,
} from '../components/siteShell';

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
};

// Announcement categories: label and badge tone
const categoryMeta = {
  update: { label: 'Update', tone: 'info' },
  event: { label: 'Event', tone: 'success' },
  maintenance: { label: 'Maintenance', tone: 'warning' },
  community: { label: 'Community', tone: 'neutral' },
};

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
// Helper: announcement date formatting
// ----------------------------------------------------------------------------
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
};

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
    { id: 'discord', title: 'Join the Discord', description: 'Chat with the community', icon: <IconDiscord />, href: siteLinks.discord, external: true },
    { id: 'youtube', title: 'Watch on YouTube', description: 'Videos and showcases', icon: <IconYouTube />, href: siteLinks.youtube, external: true },
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
// Page
// ----------------------------------------------------------------------------
export default function Home() {
  return (
    <SiteShell title={content.siteName} description={content.description}>
      {({ openSearch }) => (
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
      )}
    </SiteShell>
  );
}
