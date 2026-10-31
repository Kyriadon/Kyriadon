// ============================================================================
// announcementCards.js
// The pieces every announcement surface shares (the /announcements page, the home panel,
// the manager preview):
//   TypeBadge / FavouriteButton / CopyLinkButton   small controls
//   AnnouncementContent   the expanded view: cover image, text, uploaded media and links
//   AnnouncementCard      the unexpanded card that opens in place
//   AnnouncementModal     the expanded view in a dialog (home panel)
// Each type has its own gradient family (lib/siteDesign.js): change-logs yellow,
// announcements red, updates blue. Styles live in styles/announcementStyles.css.
// ============================================================================
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TYPE_META } from '../lib/announcementMarkup';
import { fetchAnnouncement, formatDate, formatWhen, sendView, timeLeft } from '../lib/announcementsClient';
import { IconCheck, IconChevron, IconCopy, IconMegaphone, IconSparkle, IconWarning, Modal } from './siteShell';
import { AnnoInline, AnnoMarkup } from './announcementMarkup';

// ----------------------------------------------------------------------------
// Icons (stroke style, the same as the rest of the site)
// ----------------------------------------------------------------------------
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
const base = (size) => ({ viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', focusable: 'false', ...stroke });

const HEART_PATH = 'M12 20.2 4.9 13.3a4.6 4.6 0 0 1 0-6.5 4.5 4.5 0 0 1 6.4 0l.7.7.7-.7a4.5 4.5 0 0 1 6.4 0 4.6 4.6 0 0 1 0 6.5L12 20.2Z';

// Heart: outline, or filled once it is a favourite
export function IconFavourite({ size = 18, filled = false }) {
  return (<svg {...base(size)}><path d={HEART_PATH} fill={filled ? 'currentColor' : 'none'} /></svg>);
}

// Sheet with lines (change-logs)
export function IconChangelog({ size = 18 }) {
  return (<svg {...base(size)}><path d="M7 4.5h7.5l3.5 3.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6a1.5 1.5 0 0 1 1-1.5Z" /><path d="M9 11.5h6M9 15h6M9 8h3" /></svg>);
}

export function IconLinkChain({ size = 18 }) {
  return (<svg {...base(size)}><path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" /><path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" /></svg>);
}

export function IconExternal({ size = 18 }) {
  return (<svg {...base(size)}><path d="M14 5h5v5M19 5l-8 8" /><path d="M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18V9.5A1.5 1.5 0 0 1 7.5 8H10" /></svg>);
}

export function IconPlay({ size = 18 }) {
  return (<svg {...base(size)}><circle cx="12" cy="12" r="8.5" /><path d="m10.5 9 4.5 3-4.5 3V9Z" /></svg>);
}

export function IconPicture({ size = 18 }) {
  return (<svg {...base(size)}><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m5 17 4.5-4.5 3.5 3.5 2.5-2.5L19 16" /></svg>);
}

export function IconPlus({ size = 18 }) {
  return (<svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>);
}

export function IconEye({ size = 18 }) {
  return (<svg {...base(size)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></svg>);
}

export function IconBack({ size = 18 }) {
  return (<svg {...base(size)}><path d="m15 6-6 6 6 6" /></svg>);
}

export function IconBars({ size = 18 }) {
  return (<svg {...base(size)}><path d="M5 19.5V11M12 19.5V5M19 19.5v-6" /></svg>);
}

export const TYPE_ICON = { changelog: IconChangelog, announcement: IconMegaphone, update: IconSparkle };

// ----------------------------------------------------------------------------
// Small controls
// ----------------------------------------------------------------------------

// The type of an announcement as a chip in its own colour, always with a text label
export function TypeBadge({ type }) {
  const meta = TYPE_META[type] || TYPE_META.announcement;
  const Icon = TYPE_ICON[type] || IconMegaphone;
  return (
    <span className="annoBadge" data-type={type}>
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

// Heart button. `labelled` adds the words (used in dialogs), otherwise it is icon only.
export function FavouriteButton({ active, onToggle, labelled = false }) {
  const label = active ? 'Remove from favourites' : 'Add to favourites';
  return (
    <button type="button" className={labelled ? 'btn btnSecondary annoFavButton' : 'annoFav'} data-active={active} aria-pressed={active} aria-label={label} onClick={onToggle}>
      <IconFavourite size={labelled ? 16 : 18} filled={active} />
      {labelled && (active ? 'Favourited' : 'Favourite')}
    </button>
  );
}

// Copies the address of an announcement
export function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      setCopied(true);
    } catch {
      /* the clipboard can be unavailable */
    }
  };

  return (
    <button type="button" className="btn btnGhost btnCompact" onClick={copy}>
      {copied ? <IconCheck size={16} /> : <IconLinkChain size={16} />}
      {copied ? 'Link copied' : 'Copy link'}
    </button>
  );
}

// Names for well-known sites, so a resource shows "YouTube" instead of "youtu.be"
const KNOWN_SITES = { 'discord.gg': 'Discord', 'discord.com': 'Discord', 'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'github.com': 'GitHub', 'x.com': 'X', 'twitter.com': 'X', 'twitch.tv': 'Twitch', 'docs.google.com': 'Google Docs', 'drive.google.com': 'Google Drive' };

// Where a resource points, as short text: the site name (or host), a tag for files, and whether
// the link leaves this site. The editor uses it too, to fill in an empty label.
export function describeResource(url) {
  const value = String(url ?? '').trim();
  if (value.startsWith('/')) return { site: 'On this site', tag: '', external: false };
  let host = '';
  let path = '';
  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    path = parsed.pathname.toLowerCase();
  } catch {
    host = value.slice(0, 40);
  }
  const tag = /\.pdf$/.test(path) ? 'PDF' : /\.(zip|rar|7z|jar)$/.test(path) ? 'Download' : '';
  return { site: KNOWN_SITES[host] || host, tag, external: true };
}

// The full address of a resource (paths get the address of this site in front)
const fullUrl = (url) => (String(url).startsWith('/') ? `${window.location.origin}${url}` : url);

// A resource as a card: icon, label, the site it goes to, and a button that copies the link.
// Internal paths use the router, everything else opens in a new tab
function ResourceItem({ resource }) {
  const [copied, setCopied] = useState(false);
  const { site, tag } = describeResource(resource.url);
  const internal = resource.url.startsWith('/') && !resource.url.startsWith('/api/');

  // The tick on the copy button goes away after a moment
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  // Copy the link of this resource
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl(resource.url));
      setCopied(true);
    } catch {
      /* the clipboard can be unavailable */
    }
  };

  const inner = (
    <>
      <span className="annoResourceIcon" aria-hidden="true">{internal ? <IconLinkChain size={16} /> : <IconExternal size={16} />}</span>
      <span className="annoResourceText">
        <strong>{resource.label}</strong>
        <small>{tag ? `${site} \u00b7 ${tag}` : site}</small>
      </span>
    </>
  );

  return (
    <li className="annoResourceItem">
      {internal ? (
        <Link className="annoResource" href={resource.url}>{inner}</Link>
      ) : (
        <a className="annoResource" href={resource.url} target="_blank" rel="noopener noreferrer">{inner}</a>
      )}
      <button type="button" className="annoResourceCopy" onClick={copy} aria-label={`Copy the link to ${resource.label}`} title={copied ? 'Copied' : 'Copy link'}>
        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
      </button>
    </li>
  );
}

// Copies every link of the resources, one per line ("Label: link")
function CopyAllResources({ links }) {
  const [copied, setCopied] = useState(false);

  // The tick goes away after a moment
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  // Copy the list
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(links.map((resource) => `${resource.label}: ${fullUrl(resource.url)}`).join('\n'));
      setCopied(true);
    } catch {
      /* the clipboard can be unavailable */
    }
  };

  return (
    <button type="button" className="btn btnGhost btnCompact" onClick={copy}>
      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
      {copied ? 'Copied' : 'Copy all'}
    </button>
  );
}

// ----------------------------------------------------------------------------
// The expanded view: cover image, the main announcement, uploaded images and videos,
// and the links (shown as resource cards). `item` needs body and resources.
// ----------------------------------------------------------------------------
export function AnnouncementContent({ item }) {
  const resources = item.resources || [];
  const media = resources.filter((resource) => resource.kind === 'image' || resource.kind === 'video');
  const links = resources.filter((resource) => resource.kind === 'link');

  return (
    <div className="annoContent">
      {item.image && <img className="annoCover" src={item.image} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
      {item.body && <AnnoMarkup text={item.body} />}

      {media.length > 0 && (
        <div className="annoGallery">
          {media.map((resource, index) =>
            resource.kind === 'image' ? (
              <a key={index} className="annoGalleryItem" href={resource.url} target="_blank" rel="noopener noreferrer">
                <img src={resource.url} alt={resource.label} loading="lazy" decoding="async" />
                <span>{resource.label}</span>
              </a>
            ) : (
              <figure key={index} className="annoGalleryItem" data-kind="video">
                <video src={resource.url} controls preload="metadata" playsInline aria-label={resource.label} />
                <figcaption>{resource.label}</figcaption>
              </figure>
            ),
          )}
        </div>
      )}

      {links.length > 0 && (
        <section className="annoResourcesBlock" aria-label="Resources">
          <div className="annoResourcesHead">
            <h4 className="annoResourcesTitle">
              <IconLinkChain size={16} />
              Resources
              <span className="annoResourcesCount">{links.length}</span>
            </h4>
            {links.length > 1 && <CopyAllResources links={links} />}
          </div>
          <ul className="annoResources">
            {links.map((resource, index) => (
              <ResourceItem key={index} resource={resource} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Author and dates under an announcement
export function AnnouncementMeta({ item }) {
  const edited = item.updatedAt - item.createdAt > 60 * 1000;
  return (
    <p className="annoMeta">
      By {item.authorName} on <time dateTime={item.date}>{formatWhen(item.createdAt)}</time>
      {edited && <> (edited {formatDate(item.updatedAt)})</>}
    </p>
  );
}

// Shown when the announcement was deleted but the viewer favourited it
export function DeletedNote({ item }) {
  return (
    <div className="stateBox annoDeletedNote" role="status">
      <IconWarning size={18} />
      <span>Staff deleted this announcement. It stays here for {timeLeft(item.expiresAt)} because you favourited it. Remove the favourite to let it go now.</span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// The card. Clicking the title (or anywhere on the card) opens it in place. `detail` is
// { status, item } for the expanded view, loaded by the page.
// ----------------------------------------------------------------------------
export function AnnouncementCard({ item, index = 0, expanded, onToggle, detail, onFavourite, onRetry }) {
  const bodyId = `annoBody-${item.id}`;

  return (
    <article className="annoCard" data-type={item.type} data-expanded={expanded} data-deleted={item.deleted ? 'true' : undefined} style={{ '--i': index }}>
      <div className="annoCardHead">
        {item.image && !expanded && (
          <span className="annoThumb" aria-hidden="true">
            <img src={item.image} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.parentElement.style.display = 'none'; }} />
          </span>
        )}
        <div className="annoCardText">
          <div className="annoCardTop">
            <TypeBadge type={item.type} />
            <time className="newsDate" dateTime={item.date}>{formatDate(item.createdAt)}</time>
            {item.deleted && <span className="badge" data-tone="warning">Deleted, {timeLeft(item.expiresAt)} left</span>}
            <div className="annoCardActions">
              <FavouriteButton active={item.favourited} onToggle={() => onFavourite(item)} />
              <span className="annoChevron" data-open={expanded} aria-hidden="true"><IconChevron size={18} /></span>
            </div>
          </div>
          <h4 className="annoCardTitle">
            <button type="button" className="annoTitleButton" onClick={onToggle} aria-expanded={expanded} aria-controls={expanded ? bodyId : undefined}>
              <AnnoInline text={item.title} />
            </button>
          </h4>
          {item.description && <p className="annoCardDesc"><AnnoInline text={item.description} /></p>}
        </div>
      </div>

      {expanded && (
        <div id={bodyId} className="annoCardBody">
          {(!detail || detail.status === 'loading') && (
            <div aria-busy="true">
              <div className="skeleton skeletonCard" />
            </div>
          )}
          {detail?.status === 'error' && (
            <div className="stateBox" role="alert">
              <span>This announcement could not be loaded.</span>
              <button type="button" className="btn btnSecondary btnCompact" onClick={onRetry}>Try again</button>
            </div>
          )}
          {detail?.status === 'ready' && (
            <>
              {item.deleted && <DeletedNote item={item} />}
              <AnnouncementContent item={detail.item} />
              <div className="annoCardFoot">
                <AnnouncementMeta item={detail.item} />
                <div className="studioRow">
                  <CopyLinkButton url={item.url} />
                  {!item.deleted && (
                    <Link className="btn btnSecondary btnCompact" href={item.url}>
                      <IconExternal size={16} />
                      Open page
                    </Link>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

// ----------------------------------------------------------------------------
// The expanded view in a dialog (the home panel). It loads the full text itself.
// ----------------------------------------------------------------------------
export function AnnouncementModal({ item, onClose, onFavourite }) {
  const [state, setState] = useState({ status: 'loading', detail: null });
  const meta = TYPE_META[item.type] || TYPE_META.announcement;

  // Load the full text and count the view (a changed announcement loads again)
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', detail: null });
    fetchAnnouncement({ id: item.id }).then((result) => {
      if (cancelled) return;
      if (result.item) {
        setState({ status: 'ready', detail: result.item });
        if (!item.deleted) sendView(item.id);
      } else {
        setState({ status: result.error ? 'error' : 'missing', detail: null });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.updatedAt]);

  return (
    <Modal
      titleId="annoModalTitle"
      title={<AnnoInline text={item.title} />}
      subtitle={`${meta.label} \u00B7 ${formatDate(item.createdAt)}`}
      onClose={onClose}
      footer={
        <>
          <FavouriteButton active={item.favourited} onToggle={() => onFavourite(item)} labelled />
          <div className="footerGroup">
            {!item.deleted && (
              <Link className="btn btnSecondary" href={item.url}>
                <IconExternal size={16} />
                Open page
              </Link>
            )}
            <button type="button" className="btn btnPrimary" onClick={onClose} data-autofocus>
              Done
            </button>
          </div>
        </>
      }
    >
      <div className="annoModalBody" data-type={item.type}>
        {state.status === 'loading' && (
          <div aria-busy="true">
            <div className="skeleton skeletonCard" />
          </div>
        )}
        {state.status === 'error' && <div className="stateBox" role="alert">This announcement could not be loaded.</div>}
        {state.status === 'missing' && <div className="stateBox">This announcement is no longer available.</div>}
        {state.status === 'ready' && (
          <>
            {item.deleted && <DeletedNote item={item} />}
            <AnnouncementContent item={state.detail} />
            <AnnouncementMeta item={state.detail} />
          </>
        )}
      </div>
    </Modal>
  );
}
