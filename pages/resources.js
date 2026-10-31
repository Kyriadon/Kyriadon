// ============================================================================
// resources.js
// Resources page (/resources): a hero and four panels that lead to the Projects,
// Announcements, Appeals and Applications pages. Every panel has its own art in its lower
// right corner, which zooms in on hover. For now only the Announcements panel is a link
// (to /resources/announcements); the other three do nothing until their pages exist: give a panel an
// href below to turn it into a link.
// The header, footer and search palette come from components/siteShell.js. All visual values
// live in lib/siteDesign.js and styles/resourcesStyles.css.
// ============================================================================
import Link from 'next/link';
import { IconChevron, IconMegaphone, IconRules, IconSparkle, IconUsers, SiteShell } from '../components/siteShell';

// ----------------------------------------------------------------------------
// Content: everything the page says lives here so copy is easy to edit
// ----------------------------------------------------------------------------
const content = {
  title: 'Resources - Kyriadon',
  description: 'Everything Kyriadon in one place: projects, announcements, appeals and applications.',
  hero: {
    title: 'Resources',
    subtitle: 'Everything in one place.',
    body: 'Find our projects, the latest announcements, appeals and applications from here.',
  },
};

// ----------------------------------------------------------------------------
// Panel art: one enlarged illustration per panel. The strokes run through a gradient of the
// two colours of the panel (the same stroke style as the art of the rules page).
// ----------------------------------------------------------------------------
function Art({ id, children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={`url(#${id})`} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
          <stop offset="0" style={{ stopColor: 'var(--res-light)' }} />
          <stop offset="1" style={{ stopColor: 'var(--res-light-2)' }} />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

// Projects: three stacked layers
function ProjectsArt() {
  return (
    <Art id="resArtProjects">
      <path d="M12 3.5 3.5 8l8.5 4.5L20.5 8 12 3.5Z" fill="currentColor" fillOpacity="0.16" strokeWidth="0.8" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5" strokeWidth="0.8" />
      <path d="m3.5 16 8.5 4.5 8.5-4.5" strokeWidth="0.8" strokeOpacity="0.7" />
    </Art>
  );
}

// Announcements: a megaphone with two sound waves
function AnnouncementsArt() {
  return (
    <Art id="resArtAnnouncements">
      <path d="M4 10v4a1 1 0 0 0 1 1h2.5l7 4V5l-7 4H5a1 1 0 0 0-1 1Z" fill="currentColor" fillOpacity="0.16" strokeWidth="0.8" />
      <path d="m8.5 15 1.3 4.5" strokeWidth="0.8" />
      <path d="M17.5 9.5a3.5 3.5 0 0 1 0 5" strokeWidth="0.8" />
      <path d="M20 7.2a7 7 0 0 1 0 9.6" strokeWidth="0.6" strokeOpacity="0.7" />
    </Art>
  );
}

// Appeals: a pair of scales
function AppealsArt() {
  return (
    <Art id="resArtAppeals">
      <path d="M12 4v16M7.5 20h9M5 7.5h14" strokeWidth="0.8" />
      <path d="M5 7.5 2.5 13.5a3 3 0 0 0 5 0L5 7.5Z" fill="currentColor" fillOpacity="0.16" strokeWidth="0.8" />
      <path d="m19 7.5-2.5 6a3 3 0 0 0 5 0L19 7.5Z" fill="currentColor" fillOpacity="0.16" strokeWidth="0.8" />
    </Art>
  );
}

// Applications: a clipboard with a check
function ApplicationsArt() {
  return (
    <Art id="resArtApplications">
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" fill="currentColor" fillOpacity="0.16" strokeWidth="0.8" />
      <rect x="9" y="2.5" width="6" height="3.5" rx="1" strokeWidth="0.8" />
      <path d="m8.5 12.5 2.2 2.2 4.3-4.4" strokeWidth="1.1" />
      <path d="M8.5 17.5h7" strokeWidth="0.6" strokeOpacity="0.7" />
    </Art>
  );
}

// ----------------------------------------------------------------------------
// The panels. `from` and `to` are the two colours of the panel gradient (design tokens): purple
// for Projects, the announcements cyan, and light and dark pink for Appeals and Applications.
// A panel with an href is a link, a panel without one does nothing.
// ----------------------------------------------------------------------------
const LIGHT_PINK = 'var(--mention-booster-one-light)';
const DARK_PINK = 'color-mix(in srgb, var(--mention-booster-one-color) 60%, black)';

const cards = [
  { id: 'projects', title: 'Projects', description: 'See what we are building and working on.', icon: IconSparkle, art: <ProjectsArt />, from: 'var(--mention-booster-two-light)', to: 'var(--mention-booster-two-color)' },
  { id: 'announcements', title: 'Announcements', description: 'Change-logs, announcements and updates from the team.', icon: IconMegaphone, art: <AnnouncementsArt />, from: 'var(--anno-theme-light)', to: 'var(--anno-theme-main)', href: '/resources/announcements' },
  { id: 'appeals', title: 'Appeals', description: 'Think a punishment was a mistake? Appeal it here.', icon: IconRules, art: <AppealsArt />, from: LIGHT_PINK, to: DARK_PINK },
  { id: 'applications', title: 'Applications', description: 'Want to join the team? Apply here.', icon: IconUsers, art: <ApplicationsArt />, from: DARK_PINK, to: LIGHT_PINK },
];

// ----------------------------------------------------------------------------
// One panel: the glow and the art sit behind the text, clipped to the panel shape
// ----------------------------------------------------------------------------
function ResourceCard({ card }) {
  const Icon = card.icon;
  const body = (
    <>
      <span className="resBackdrop" aria-hidden="true">
        <span className="resGlow" />
        <span className="resArt">{card.art}</span>
      </span>
      <span className="topicIcon resIcon" aria-hidden="true">
        <Icon size={22} />
      </span>
      <span className="resText">
        <h3 className="resTitle">{card.title}</h3>
        <span className="guideSubtitle">{card.description}</span>
      </span>
      <span className="linkChevron resChevron" aria-hidden="true">
        <IconChevron />
      </span>
    </>
  );

  // The two panel colours reach the CSS through variables
  const style = { '--res-from': card.from, '--res-to': card.to };
  if (card.href) {
    return (
      <Link className="panel panelGlow resCard" href={card.href} style={style}>
        {body}
      </Link>
    );
  }
  return (
    <div className="panel panelGlow resCard" style={style}>
      {body}
    </div>
  );
}

// ----------------------------------------------------------------------------
// /resources
// ----------------------------------------------------------------------------
export default function ResourcesPage() {
  return (
    <SiteShell title={content.title} description={content.description}>
      <div className="resPage">
        {/* Hero: the same component as the other pages */}
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

        {/* The four panels */}
        <div className="resCards">
          {cards.map((card) => (
            <ResourceCard key={card.id} card={card} />
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
