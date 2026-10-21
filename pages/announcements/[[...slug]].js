// ============================================================================
// [[...slug]].js
// The announcements pages:
//   /announcements                      every announcement in three categories (change-logs
//                                       yellow, announcements red, updates blue), favourites on top
//   /announcements/<url of one>         one announcement, for example
//                                       /announcements/changelogs/changelog-1
// Built like the other pages: a hero on top, a sticky side panel on the left (search and
// filter, or the other announcements) and the content on the right. The header, footer and
// search palette come from components/siteShell.js. The page theme is cyan. All visual values
// live in lib/siteDesign.js and styles/announcementStyles.css.
// ============================================================================
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconSearch, IconClose, SiteShell, logEvent } from '../../components/siteShell';
import { AnnouncementCard, AnnouncementContent, AnnouncementMeta, CopyLinkButton, DeletedNote, FavouriteButton, IconBack, IconFavourite, TYPE_ICON, TypeBadge } from '../../components/announcementCards';
import { AnnoInline } from '../../components/announcementMarkup';
import { TYPE_META, TYPE_ORDER, stripMarkup } from '../../lib/announcementMarkup';
import { fetchAnnouncement, formatDate, requestFavourite, sendView, useAnnouncementFeed } from '../../lib/announcementsClient';

const description = 'Change-logs, announcements and updates from the Kyriadon team. Favourite the ones you want to keep.';

// ----------------------------------------------------------------------------
// One category: its own colour, a count and a grid of cards. An opened card takes the
// full width of the grid.
// ----------------------------------------------------------------------------
function CategorySection({ id, type, title, blurb, icon, items, expandedId, details, onToggle, onFavourite, onRetry, emptyText }) {
  const Icon = icon || TYPE_ICON[type];
  return (
    <section className="panel panelGlow annoSection" id={id} data-type={type} aria-labelledby={`${id}Title`}>
      <div className="panelHeader annoSectionHead">
        <span className="annoSectionIcon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="annoSectionTitles">
          <h3 id={`${id}Title`}>{title}</h3>
          <p className="annoSectionBlurb">{blurb}</p>
        </div>
        <span className="badge annoCount" data-type={type}>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="stateBox">{emptyText}</div>
      ) : (
        <div className="annoList">
          {items.map((item, index) => (
            <AnnouncementCard
              key={item.id}
              item={item}
              index={index}
              expanded={expandedId === item.id}
              detail={details[item.id]}
              onToggle={() => onToggle(item)}
              onFavourite={onFavourite}
              onRetry={() => onRetry(item)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// /announcements
// ----------------------------------------------------------------------------
function AnnouncementsIndex() {
  const feed = useAnnouncementFeed({ limit: 200 });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});

  // Loads the full text of one announcement for its opened view
  const loadDetail = useCallback(async (item) => {
    setDetails((previous) => ({ ...previous, [item.id]: { status: 'loading' } }));
    const result = await fetchAnnouncement({ id: item.id });
    setDetails((previous) => ({ ...previous, [item.id]: result.item ? { status: 'ready', item: result.item } : { status: 'error' } }));
    if (result.item && !item.deleted) sendView(item.id);
  }, []);

  // A reload that brings changed announcements throws the old full texts away
  const signature = feed.items.map((item) => `${item.id}:${item.updatedAt}`).join('|');
  useEffect(() => {
    setDetails({});
    setExpandedId((current) => (current && feed.items.some((item) => item.id === current) ? current : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // The opened card needs its full text, also after the texts were thrown away
  useEffect(() => {
    if (!expandedId || details[expandedId]) return;
    const item = feed.items.find((entry) => entry.id === expandedId);
    if (item) loadDetail(item);
  }, [expandedId, details, feed.items, loadDetail]);

  const toggle = useCallback((item) => {
    setExpandedId((current) => {
      if (current === item.id) return null;
      logEvent({ code: 'ANNOUNCEMENT_OPENED', reason: `Opened the announcement "${stripMarkup(item.title).slice(0, 60)}"` });
      return item.id;
    });
  }, []);

  const favourite = useCallback(
    async (item) => {
      const on = !item.favourited;
      const result = await feed.toggleFavourite(item, on);
      if (result?.code === 'login') return;
      if (!result?.ok) logEvent({ level: 'warning', code: 'ANNOUNCEMENT_FAVOURITE_FAILED', reason: result?.message || 'The favourite could not be saved' });
    },
    [feed],
  );

  // Search and type filter
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = useMemo(
    () =>
      feed.items.filter((item) => {
        if (filter !== 'all' && item.type !== filter) return false;
        const haystack = `${stripMarkup(item.title)} ${stripMarkup(item.description)} ${item.authorName}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feed.items, filter, query],
  );

  const favourites = visible.filter((item) => item.favourited);
  const counts = TYPE_ORDER.reduce((totals, type) => ({ ...totals, [type]: feed.items.filter((item) => item.type === type).length }), {});
  const shared = { expandedId, details, onToggle: toggle, onFavourite: favourite, onRetry: loadDetail };

  const ready = feed.status === 'ready';

  return (
    <SiteShell title="Announcements | Kyriadon" description={description}>
      <div className="annoGrid" data-ready={ready}>
        {/* Hero: same component as the other pages, cyan tone */}
        <section className="heroShell areaHero" aria-labelledby="heroTitle">
          <div className="heroPanel" data-tone="cyan">
            <div className="heroGlow" aria-hidden="true" />
            <div className="heroContent">
              <h1 id="heroTitle">Announcements</h1>
              <h2>Everything new, in one place.</h2>
              <p>Change-logs, announcements and updates from the team. Open one to read it in full, and favourite the ones you want to keep at the top.</p>
            </div>
          </div>
        </section>

        {/* Left: search and the type filter, like the navigation panel of the rules page */}
        {ready && (
          <aside className="annoSide">
            <section className="panel panelGlow annoFind" aria-labelledby="annoFindTitle">
              <div className="panelHeader">
                <h3 id="annoFindTitle">Find one</h3>
                <span className="badge" role="status">{visible.length} of {feed.items.length}</span>
              </div>
              <label className="boostField annoSearch">
                <IconSearch size={18} />
                <input className="searchInput" type="text" value={query} placeholder="Search announcements..." aria-label="Search announcements" autoComplete="off" spellCheck={false} data-nolog onChange={(event) => setQuery(event.target.value)} />
                {query && (
                  <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={() => setQuery('')} aria-label="Clear search" data-nolog>
                    <IconClose size={16} />
                  </button>
                )}
              </label>
              <div className="annoFilters" role="group" aria-label="Type">
                <button type="button" className="annoFilter" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} data-nolog>
                  <span className="annoFilterName">All</span>
                  <span className="annoFilterCount">{feed.items.length}</span>
                </button>
                {TYPE_ORDER.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className="annoFilter"
                    data-type={type}
                    aria-pressed={filter === type}
                    onClick={() => {
                      setFilter(type);
                      logEvent({ code: 'ANNOUNCEMENTS_FILTERED', reason: `Filtered announcements: ${TYPE_META[type].plural}` });
                    }}
                    data-nolog
                  >
                    <span className="annoFilterName">{TYPE_META[type].plural}</span>
                    <span className="annoFilterCount">{counts[type]}</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        )}

        {/* Right: favourites on top, then the three categories */}
        <div className="annoMain">
          {feed.status === 'loading' && (
            <section className="panel annoSection" aria-busy="true">
              {[0, 1, 2].map((item) => <div key={item} className="skeleton skeletonCard" />)}
            </section>
          )}

          {feed.status === 'error' && (
            <section className="panel annoSection" role="alert">
              <div className="stateBox">
                <span>Announcements could not be loaded.</span>
                <button type="button" className="btn btnSecondary btnCompact" onClick={feed.reload}>Try again</button>
              </div>
            </section>
          )}

          {ready && (
            <>
              {favourites.length > 0 && (
                <CategorySection id="favourites" type="favourite" title="Favourites" blurb="The ones you saved. They stay for 3 days after staff delete them." icon={IconFavourite} items={favourites} {...shared} emptyText="" />
              )}

              {TYPE_ORDER.filter((type) => filter === 'all' || filter === type).map((type) => (
                <CategorySection
                  key={type}
                  id={`${type}s`}
                  type={type}
                  title={TYPE_META[type].plural}
                  blurb={TYPE_META[type].blurb}
                  items={visible.filter((item) => item.type === type && !item.favourited)}
                  emptyText={words.length ? `No ${TYPE_META[type].plural.toLowerCase()} match your search.` : `No ${TYPE_META[type].plural.toLowerCase()} yet. Check back soon.`}
                  {...shared}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

// ----------------------------------------------------------------------------
// /announcements/<url of one announcement>
// ----------------------------------------------------------------------------
function AnnouncementDetail({ slug }) {
  const [state, setState] = useState({ status: 'loading', item: null, viewer: { signedIn: false } });
  const more = useAnnouncementFeed({ limit: 6 });

  // Load the announcement and count the view
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', item: null, viewer: { signedIn: false } });
    fetchAnnouncement({ slug }).then((result) => {
      if (cancelled) return;
      if (result.error) setState({ status: 'error', item: null, viewer: { signedIn: false } });
      else if (!result.item) setState({ status: 'missing', item: null, viewer: result.viewer || { signedIn: false } });
      else {
        setState({ status: 'ready', item: result.item, viewer: result.viewer || { signedIn: false } });
        if (!result.item.deleted) sendView(result.item.id);
        logEvent({ code: 'ANNOUNCEMENT_OPENED', reason: `Opened the announcement page "${stripMarkup(result.item.title).slice(0, 60)}"` });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const { item, viewer } = state;

  const favourite = async () => {
    const on = !item.favourited;
    const result = await requestFavourite(item.id, on, viewer.signedIn);
    if (result.ok) setState((previous) => ({ ...previous, item: { ...previous.item, favourited: on } }));
  };

  const others = more.items.filter((entry) => !item || entry.id !== item.id).slice(0, 3);
  const title = item ? `${stripMarkup(item.title)} | Kyriadon` : 'Announcements | Kyriadon';

  // The side panel only exists while it has something to show; without it the article is centred
  const solo = more.status !== 'loading' && others.length === 0;

  return (
    <SiteShell title={title} description={item ? stripMarkup(item.description) || description : description}>
      <div className="annoGrid annoDetailGrid" data-solo={solo}>
        <div className="annoBackRow">
          <Link className="btn btnGhost btnCompact" href="/announcements">
            <IconBack size={16} />
            All announcements
          </Link>
        </div>

        {!solo && (
          <aside className="annoSide">
            <section className="panel panelGlow annoMore" aria-labelledby="annoMoreTitle">
              <div className="panelHeader">
                <h3 id="annoMoreTitle">More announcements</h3>
              </div>
              {more.status === 'loading' ? (
                <div aria-busy="true">
                  <div className="skeleton skeletonCard" />
                </div>
              ) : (
                <ul className="linkList">
                  {others.map((entry) => (
                    <li key={entry.id}>
                      <Link className="linkRow annoMoreRow" data-type={entry.type} href={entry.url}>
                        <span className="linkText">
                          <span className="linkTitle"><AnnoInline text={entry.title} /></span>
                          <span className="linkDesc">{TYPE_META[entry.type].label} on {formatDate(entry.createdAt)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        )}

        <div className="annoMain">
          {state.status === 'loading' && (
            <section className="panel annoArticle" aria-busy="true">
              <div className="skeleton skeletonCard" />
              <div className="skeleton skeletonCard" />
            </section>
          )}

          {state.status === 'error' && (
            <section className="panel annoArticle" role="alert">
              <div className="stateBox">This announcement could not be loaded. Try again in a moment.</div>
            </section>
          )}

          {state.status === 'missing' && (
            <section className="panel annoArticle">
              <div className="stateBox">
                <strong>Announcement not found</strong>
                <span>It does not exist, or staff removed it.</span>
                <Link className="btn btnSecondary btnCompact" href="/announcements">See all announcements</Link>
              </div>
            </section>
          )}

          {state.status === 'ready' && (
            <article className="panel annoArticle" data-type={item.type}>
              <header className="annoArticleHead">
                <div className="annoCardTop">
                  <TypeBadge type={item.type} />
                  <time className="newsDate" dateTime={item.date}>{formatDate(item.createdAt)}</time>
                  {item.deleted && <span className="badge" data-tone="warning">Deleted</span>}
                </div>
                <h1 className="annoArticleTitle"><AnnoInline text={item.title} /></h1>
                {item.description && <p className="annoArticleLead"><AnnoInline text={item.description} /></p>}
                <div className="studioRow">
                  <FavouriteButton active={item.favourited} onToggle={favourite} labelled />
                  <CopyLinkButton url={item.url} />
                </div>
              </header>
              {item.deleted && <DeletedNote item={item} />}
              <AnnouncementContent item={item} />
              <AnnouncementMeta item={item} />
            </article>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

// ----------------------------------------------------------------------------
// The route: no url part shows the index, anything else is one announcement. A page that
// is built before the router knows its url only shows the shell for a moment.
// ----------------------------------------------------------------------------
export default function AnnouncementsRoute() {
  const router = useRouter();
  if (!router.isReady) {
    return (
      <SiteShell title="Announcements | Kyriadon" description={description}>
        <div className="annoGrid" data-ready="false" aria-busy="true">
          <div className="annoMain">
            <div className="skeleton skeletonCard" />
          </div>
        </div>
      </SiteShell>
    );
  }
  const parts = router.query.slug;
  const slug = Array.isArray(parts) ? parts.join('/') : parts || '';
  return slug ? <AnnouncementDetail slug={slug} /> : <AnnouncementsIndex />;
}
