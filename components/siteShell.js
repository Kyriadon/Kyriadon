// ============================================================================
// siteShell.js
// Shared page shell used by every page: ambient environment, scroll edge fades,
// header (icon, search, login or user menu), footer, and the search palette.
// Pages only provide their own content; the shell never changes per page.
// ============================================================================
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { signIn, signOut, useSession } from 'next-auth/react';
import { behavior, gradientStops } from '../lib/siteDesign';

// ----------------------------------------------------------------------------
// Shared destinations: social links and where the footer credit leads
// ----------------------------------------------------------------------------
export const siteLinks = {
  discord: 'https://discord.gg/B6czYB7wa7',
  youtube: 'https://youtube.com/@Kyriadon',
  nameMc: 'https://namemc.com/profile/Kyriadon.1',
  // Where the "Kyriadon" credit in the footer leads when clicked
  credit: 'https://discord.gg/B6czYB7wa7',
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
export function IconSearch({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

// Right-pointing chevron
export function IconChevron({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// Close (X)
export function IconClose({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

// Megaphone for announcements
export function IconMegaphone({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
    </svg>
  );
}


// Discord mark
export function IconDiscord({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

// YouTube mark
export function IconYouTube({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136C4.495 20.455 12 20.455 12 20.455s7.505 0 9.377-.505a3.016 3.016 0 0 0 2.121-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// NameMC mark (simplified blocky "N"; swap the path for the official favicon if you prefer)
export function IconNameMc({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M4 4h4.2l7.6 9.4V4H20v16h-4.2L8.2 10.6V20H4z" />
    </svg>
  );
}

// K mark with the bubblegum pink to blue gradient (footer slug)
export function IconKMark({ size = 18 }) {
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

export function IconHeart({ size = 16 }) {
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

// Two people (community and online counts)
export function IconUsers({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.5-3 2.8-4.7 5.5-4.7s5 1.7 5.5 4.7" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 14.6c1.9.5 3.1 2 3.5 4.4" />
    </svg>
  );
}

// Open book (guides)
export function IconBook({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <path d="M6.5 4H19v13H6.5A1.5 1.5 0 0 0 5 18.5v-13A1.5 1.5 0 0 1 6.5 4Z" />
      <path d="M5 18.5A1.5 1.5 0 0 0 6.5 20H19" />
    </svg>
  );
}

// Downward chevron (select fields)
export function IconChevronDown({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// Circled "i" (about and information)
export function IconInfo({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2" />
      <path d="M12 7.8h.01" />
    </svg>
  );
}

// Check mark (perk lists)
export function IconCheck({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

// Star in two golds (Stars currency)
export function IconStar({ size = 18 }) {
  const [light, gold] = gradientStops.star;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path fill={gold} d="M12 2.5l2.6 6.6 7.1.4-5.5 4.6 1.8 6.9-6-3.9-6 3.9 1.8-6.9-5.5-4.6 7.1-.4L12 2.5Z" />
      <path fill={light} d="M12 2.5v14.7l-6 3.9 1.8-6.9-5.5-4.6 7.1-.4L12 2.5Z" />
    </svg>
  );
}

// Sparkle (role icon preview)
export function IconSparkle({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...strokeProps}>
      <path d="M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9L11 3.5Z" />
      <path d="M18.5 16.5v3M17 18h3" />
    </svg>
  );
}

// ----------------------------------------------------------------------------
// Hook: fetch JSON with loading, error and retry states
// ----------------------------------------------------------------------------
export function useFetch(url) {
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
// Helper: number formatting (a dash stands in for a missing value)
// ----------------------------------------------------------------------------
const numberFormat = new Intl.NumberFormat('en');

export const formatCount = (value) => (typeof value === 'number' ? numberFormat.format(value) : '\u2014');

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
// SiteShell: wraps a page. `children` can be plain content or a function that
// receives { openSearch }, for pages that need to open the search palette.
// ----------------------------------------------------------------------------
export function SiteShell({ title, description, children }) {
  const { data: session, status: authStatus } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [modifierLabel, setModifierLabel] = useState('Ctrl');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const triggerRef = useRef(null);
  const userMenuRef = useRef(null);
  const fade = useScrollFade(behavior.scrollFade);

  // Records page views, errors, failed requests, console warnings and clicks (debug logs)
  useLogCapture();

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

  // User menu closes on outside click and Escape
  useEffect(() => {
    if (!userMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  // Closing returns focus to the search trigger
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <link rel="icon" href="/Server-Icon.jpg" />
      </Head>

      <div className="page">
        {/* Environment: one limited ambient glow and the scroll edge fades */}
        <div className="ambient" aria-hidden="true" />
        <div className="edgeFade edgeFadeTop" data-active={fade.top} aria-hidden="true" />
        <div className="edgeFade edgeFadeBottom" data-active={fade.bottom} aria-hidden="true" />

        {/* Header: icon tile (left), search (center), login or user menu (right) */}
        <header className="header">
          <div className="headerStart">
            <Link className="logoTile" href="/" aria-label="Kyriadon home">
              <img src="/Server-Icon.jpg" alt="" width="48" height="48" decoding="async" />
            </Link>
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
                  onClick={() => setUserMenuOpen((open) => !open)}
                  aria-label="User menu"
                  aria-expanded={userMenuOpen}
                >
                  {session.user?.image && <img className="userAvatar" src={session.user.image} alt="" width="32" height="32" />}
                </button>

                <div className="userMenu">
                  <button type="button" className="userMenuItem" onClick={() => setUserMenuOpen(false)}>
                    Account
                  </button>
                  <button type="button" className="userMenuItem" onClick={() => setUserMenuOpen(false)}>
                    Notifications
                  </button>
                  <button
                    type="button"
                    className="userMenuItem userMenuLogout"
                    onClick={() => {
                      setUserMenuOpen(false);
                      signOut();
                    }}
                  >
                    Log out
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btnPrimary" onClick={() => signIn('discord')}>
                <IconDiscord size={20} />
                Login
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="main">{typeof children === 'function' ? children({ openSearch }) : children}</main>

        {/* Footer: K slug with icon-only socials (left), credit (right) */}
        <footer className="footer">
          <div className="footerSlug">
            <span className="slugMark" aria-hidden="true">
              <IconKMark />
            </span>
            <span className="slugDivider" aria-hidden="true" />
            <a className="socialLink" href={siteLinks.discord} target="_blank" rel="noopener noreferrer" aria-label="Discord">
              <IconDiscord />
            </a>
            <a className="socialLink" href={siteLinks.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <IconYouTube />
            </a>
            <a className="socialLink" href={siteLinks.nameMc} target="_blank" rel="noopener noreferrer" aria-label="NameMC">
              <IconNameMc />
            </a>
          </div>

          <p className="credit">
            Made with
            <span className="heart" role="img" aria-label="love">
              <IconHeart />
            </span>
            by
            <a className="roleChip" href={siteLinks.credit} target="_blank" rel="noopener noreferrer">
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

// ----------------------------------------------------------------------------
// Debug log icons (stroke style, same as the rest of the site)
// ----------------------------------------------------------------------------
const iconBase = (size) => ({ viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', focusable: 'false', ...strokeProps });

export function IconFilter({ size = 18 }) {
  return (<svg {...iconBase(size)}><path d="M4 5.5h16l-6.2 7.3V19l-3.6-1.8v-4.4L4 5.5Z" /></svg>);
}

export function IconCode({ size = 18 }) {
  return (<svg {...iconBase(size)}><path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 6l-3 12" /></svg>);
}

export function IconRows({ size = 18 }) {
  return (<svg {...iconBase(size)}><rect x="4" y="4.5" width="16" height="6" rx="1.8" /><rect x="4" y="13.5" width="16" height="6" rx="1.8" /></svg>);
}

export function IconDownload({ size = 18 }) {
  return (<svg {...iconBase(size)}><path d="M12 4.5v10M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></svg>);
}

export function IconTrash({ size = 18 }) {
  return (<svg {...iconBase(size)}><path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7M10 11v5M14 11v5" /></svg>);
}

export function IconCopy({ size = 18 }) {
  return (<svg {...iconBase(size)}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></svg>);
}

export function IconRefresh({ size = 18 }) {
  return (<svg {...iconBase(size)}><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" /></svg>);
}

export function IconWarning({ size = 18 }) {
  return (<svg {...iconBase(size)}><path d="M12 4.5 3.5 19h17L12 4.5Z" /><path d="M12 10v4M12 16.8h.01" /></svg>);
}

export function IconAlert({ size = 18 }) {
  return (<svg {...iconBase(size)}><circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6M15 9l-6 6" /></svg>);
}

export function IconLock({ size = 18 }) {
  return (<svg {...iconBase(size)}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>);
}

// ----------------------------------------------------------------------------
// Modal: shared dialog (portal, scroll lock, Escape, focus trap). Clicks inside
// are not logged as user actions (data-nolog) to keep the logs readable.
// ----------------------------------------------------------------------------
export function Modal({ titleId, title, subtitle, onClose, toolbar, footer, size, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      const target = dialogRef.current?.querySelector('[data-autofocus]') || dialogRef.current;
      target?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="studioBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="studioDialog sheetDialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef} onKeyDown={onKeyDown} data-size={size} data-nolog>
        <div className="studioHeader">
          <div>
            <h3 id={titleId}>{title}</h3>
            {subtitle && <p className="guideSubtitle">{subtitle}</p>}
          </div>
          <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        {toolbar && <div className="sheetToolbar">{toolbar}</div>}
        <div className="sheetBody">{children}</div>
        {footer && <div className="studioFooter">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ----------------------------------------------------------------------------
// Client logger: events are queued and sent to /api/logs in small batches.
// Limits: 60 events per minute per tab, identical events collapsed for 3 seconds.
// ----------------------------------------------------------------------------
const LOG_ENDPOINT = '/api/logs';
const logQueue = [];
const recentEvents = new Map();
let logTimer = null;
let windowStart = 0;
let windowCount = 0;
let capturing = false;

// Records one event (level: info, warning or error)
export function logEvent({ level = 'info', code, reason = '', fix, meta } = {}) {
  if (typeof window === 'undefined' || !code) return;
  const now = Date.now();
  if (now - windowStart > 60000) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= 60) return;

  const key = `${level}|${code}|${reason}`;
  if (now - (recentEvents.get(key) || 0) < 3000) return;
  recentEvents.set(key, now);
  if (recentEvents.size > 200) recentEvents.clear();

  windowCount += 1;
  logQueue.push({ level, code, reason: String(reason).slice(0, 500), fix, meta, path: window.location.pathname, at: new Date().toISOString() });
  if (!logTimer) logTimer = setTimeout(() => flushLogs(false), 4000);
}

// Sends queued events (sendBeacon when the page is closing)
function flushLogs(useBeacon) {
  clearTimeout(logTimer);
  logTimer = null;
  if (!logQueue.length) return;
  const body = JSON.stringify({ events: logQueue.splice(0, 25) });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(LOG_ENDPOINT, new Blob([body], { type: 'application/json' }));
  } else {
    (window.__kyriadonFetch || window.fetch)(LOG_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }
  if (logQueue.length) logTimer = setTimeout(() => flushLogs(false), 1000);
}

// Turns console arguments into one readable line
const describeArgs = (args) =>
  args
    .map((arg) => (typeof arg === 'string' ? arg : arg?.message || (() => { try { return JSON.stringify(arg); } catch { return String(arg); } })()))
    .join(' ')
    .slice(0, 500);

// Installs the global capture once per page load: errors, rejections, failed
// requests, console warnings and errors, clicks, and the page view itself.
function useLogCapture() {
  const router = useRouter();

  useEffect(() => {
    logEvent({ code: 'PAGE_VIEW', reason: `Opened ${router.asPath.split(/[?#]/)[0]}` });
    if (window.__kyriadonLogging) return undefined;
    window.__kyriadonLogging = true;

    window.addEventListener('error', (event) => {
      logEvent({ level: 'error', code: 'JS_ERROR', reason: event.message || event.error?.message || 'Unknown script error', meta: { source: event.filename, line: event.lineno, column: event.colno, stack: event.error?.stack?.slice(0, 1500) } });
    });

    window.addEventListener('unhandledrejection', (event) => {
      logEvent({ level: 'error', code: 'UNHANDLED_REJECTION', reason: event.reason?.message || String(event.reason), meta: { stack: event.reason?.stack?.slice(0, 1500) } });
    });

    // Failed images, scripts, stylesheets and media (these errors do not bubble, so they are caught in the capture phase)
    window.addEventListener(
      'error',
      (event) => {
        const element = event.target;
        if (!element || element === window || element === document || !element.tagName) return;
        const tag = element.tagName.toLowerCase();
        const url = String([element.currentSrc, element.src, element.href].find((value) => typeof value === 'string' && value) || '').slice(0, 300);
        const blocking = ['script', 'link', 'iframe'].includes(tag);
        logEvent({ level: blocking ? 'error' : 'warning', code: 'RESOURCE_ERROR', reason: `Failed to load <${tag}> ${url.slice(0, 160)}`.trim(), meta: { tag, url } });
      },
      true,
    );

    // Content Security Policy blocks
    document.addEventListener('securitypolicyviolation', (event) => {
      const directive = event.effectiveDirective || event.violatedDirective || 'policy';
      const blocked = String(event.blockedURI || 'inline').slice(0, 300);
      logEvent({ level: 'error', code: 'CSP_VIOLATION', reason: `Blocked by ${directive}: ${blocked.slice(0, 160)}`, meta: { directive, blocked, source: event.sourceFile, line: event.lineNumber } });
    });

    // Failed page navigations (cancelled ones are normal and skipped)
    router.events?.on('routeChangeError', (error, url) => {
      if (error?.cancelled) return;
      logEvent({ level: 'error', code: 'ROUTE_ERROR', reason: `${error?.message || 'Navigation failed'} (${String(url || '').split(/[?#]/)[0].slice(0, 160)})`, meta: { stack: error?.stack?.slice(0, 1500) } });
    });

    // Failed XMLHttpRequests (some libraries use these instead of fetch)
    if (window.XMLHttpRequest) {
      const xhrOpen = XMLHttpRequest.prototype.open;
      const xhrSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
        this.__kyriadonRequest = { method: String(method || 'GET').toUpperCase(), target: String(url || '').slice(0, 160) };
        return xhrOpen.call(this, method, url, ...rest);
      };
      XMLHttpRequest.prototype.send = function patchedSend(...args) {
        const request = this.__kyriadonRequest;
        if (request && !request.target.includes(LOG_ENDPOINT)) {
          let aborted = false;
          this.addEventListener(
            'abort',
            () => {
              aborted = true;
            },
            { once: true },
          );
          this.addEventListener(
            'loadend',
            () => {
              if (aborted) return;
              if (this.status === 0) logEvent({ level: 'error', code: 'XHR_FAILED', reason: `Network error (${request.method} ${request.target})` });
              else if (this.status >= 400) logEvent({ level: this.status >= 500 ? 'error' : 'warning', code: this.status >= 500 ? 'HTTP_5XX' : 'HTTP_4XX', reason: `${this.status} from ${request.target}` });
            },
            { once: true },
          );
        }
        return xhrSend.apply(this, args);
      };
    }

    // Failed requests (the log endpoint itself is skipped to avoid loops)
    const originalFetch = window.fetch.bind(window);
    window.__kyriadonFetch = originalFetch;
    window.fetch = async (...args) => {
      const target = String(typeof args[0] === 'string' ? args[0] : args[0]?.url || args[0] || '');
      try {
        const response = await originalFetch(...args);
        if (!response.ok && !target.includes(LOG_ENDPOINT)) {
          logEvent({ level: response.status >= 500 ? 'error' : 'warning', code: response.status >= 500 ? 'HTTP_5XX' : 'HTTP_4XX', reason: `${response.status} from ${target.slice(0, 160)}` });
        }
        return response;
      } catch (error) {
        if (!target.includes(LOG_ENDPOINT)) logEvent({ level: 'error', code: 'FETCH_FAILED', reason: `${error?.message || 'Network error'} (${target.slice(0, 160)})` });
        throw error;
      }
    };

    // Console warnings and errors
    ['warn', 'error'].forEach((method) => {
      const original = console[method].bind(console);
      console[method] = (...args) => {
        original(...args);
        if (capturing) return;
        capturing = true;
        try {
          logEvent({ level: method === 'error' ? 'error' : 'warning', code: method === 'error' ? 'CONSOLE_ERROR' : 'CONSOLE_WARN', reason: describeArgs(args) });
        } finally {
          capturing = false;
        }
      };
    });

    // User clicks on buttons and links
    document.addEventListener(
      'click',
      (event) => {
        const element = event.target.closest?.('button, a, [role="button"]');
        if (!element || element.closest('[data-nolog]')) return;
        const label = (element.getAttribute('aria-label') || element.textContent || element.getAttribute('href') || '').trim().replace(/\s+/g, ' ').slice(0, 80);
        logEvent({ code: 'USER_CLICK', reason: `${element.tagName === 'A' ? 'Link' : 'Button'}: ${label || 'unlabelled'}` });
      },
      true,
    );

    // Send what is left when the tab is hidden or closed
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushLogs(true);
    });
    window.addEventListener('pagehide', () => flushLogs(true));
    return undefined;
  }, [router.asPath]);
}
