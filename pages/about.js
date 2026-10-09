// ============================================================================
// about.js
// About page (/about): purple hero, Discord server panel, registration guide,
// help panel and testing guide.
// The header, footer and search palette come from components/siteShell.js.
// All visual values live in lib/siteDesign.js and styles/aboutStyles.css.
// ============================================================================
import Link from 'next/link';
// React hooks, portal for the modal, and the shared colour tokens
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { gradientStops } from '../lib/siteDesign';
import {
  IconBook,
  IconCheck,
  IconChevron,
  IconChevronDown,
  IconClose,
  IconDiscord,
  IconInfo,
  IconSearch,
  IconSparkle,
  IconStar,
  IconUsers,
  SiteShell,
  formatCount,
  siteLinks,
  useFetch,
} from '../components/siteShell';

// ----------------------------------------------------------------------------
// Content: everything the page says lives here so copy is easy to edit
// ----------------------------------------------------------------------------
const content = {
  title: 'About - Kyriadon',
  description: 'How to register, get tested and join the Kyriadon community: step-by-step guides, help and the official Discord.',
  hero: {
    title: 'About Kyriadon',
    subtitle: 'How to register, get tested and join the community.',
    body: 'This page walks you through everything in order: join the Discord, complete registration, verify on the website and queue up for a test. Stuck at any point? Help is one click away.',
  },
};

// ----------------------------------------------------------------------------
// Discord channels used by the guides. When a channel ID is empty, or the server
// ID could not be loaded, the link opens the Discord invite instead.
// Paste the #Testing channel ID below.
// ----------------------------------------------------------------------------
const channels = {
  register: '1479437622970679386',
  testing: '1511301888375652522',
  support: '1479414074176700426',
};

// ----------------------------------------------------------------------------
// Fallbacks used when the Discord lookup fails or the server has no banner
// ----------------------------------------------------------------------------
const serverFallback = {
  name: "Kyriadon's Dungeon",
  description: 'Trapped In A Fucking Dungeon',
  banner: '/Server-Banner.jpg',
  icon: '/Server-Icon.jpg',
};

// Fields shown in the testing form preview
const testFormFields = [
  { label: 'Region', placeholder: 'Select your region' },
  { label: 'Gamemode', placeholder: 'Select a gamemode' },
  { label: 'Version', placeholder: 'Select a version' },
];

// ----------------------------------------------------------------------------
// Builds a deep link to a Discord channel, or falls back to the invite
// ----------------------------------------------------------------------------
const channelHref = (guildId, channelId) =>
  guildId && channelId ? `https://discord.com/channels/${guildId}/${channelId}` : siteLinks.discord;

// ----------------------------------------------------------------------------
// Mention: role-style chip for channels, websites and commands.
// Tones: register, testing, site (links) and command (plain box).
// ----------------------------------------------------------------------------
function Mention({ tone, href, children }) {
  const label = <span className="mentionName">{children}</span>;

  // Commands are not clickable
  if (tone === 'command') {
    return (
      <code className="mention" data-tone="command">
        {label}
      </code>
    );
  }

  // External links open in a new tab, internal links use the router
  if (href.startsWith('http')) {
    return (
      <a className="mention" data-tone={tone} href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }

  return (
    <Link className="mention" data-tone={tone} href={href}>
      {label}
    </Link>
  );
}

// ----------------------------------------------------------------------------
// One numbered step. The connector line to the next step is drawn in CSS.
// ----------------------------------------------------------------------------
function GuideStep({ number, title, children }) {
  return (
    <li className="guideStep">
      <span className="guideMarker" aria-hidden="true">
        {number}
      </span>
      <div className="guideBody">
        <h4 className="guideTitle">{title}</h4>
        {children}
      </div>
    </li>
  );
}

// ----------------------------------------------------------------------------
// Discord server panel: blurred server banner, server icon, live counts, Join
// ----------------------------------------------------------------------------
function DiscordPanel({ status, discord }) {
  const loading = status === 'loading';
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  // Server profile, with the requested fallbacks for anything missing
  const name = discord?.name || serverFallback.name;
  const description = discord?.description || serverFallback.description;
  const remoteBanner = discord?.banner || null;
  const useRemote = Boolean(remoteBanner) && !remoteFailed;
  const bannerSrc = useRemote ? remoteBanner : serverFallback.banner;

  // A broken remote banner falls back to the local one; a broken local one hides the image
  const onBannerError = () => (useRemote ? setRemoteFailed(true) : setFallbackFailed(true));

  return (
    <section className="panel panelGlow discordPanel" aria-label="Discord server">
      {/* Blurred banner with a flat scrim for readable text */}
      <div className="discordBanner" aria-hidden="true">
        {!loading && !fallbackFailed && <img src={bannerSrc} alt="" onError={onBannerError} />}
      </div>
      <div className="discordScrim" aria-hidden="true" />

      <div className="discordBody">
        {/* Icon, name and description */}
        <div className="discordHead">
          <img className="discordIcon" src={serverFallback.icon} alt="" width="56" height="56" />
          <div className="discordMeta">
            {loading ? (
              <>
                <span className="skeleton" style={{ width: '70%', height: '1.25rem' }} />
                <span className="skeleton" style={{ width: '90%' }} />
              </>
            ) : (
              <>
                <h3>{name}</h3>
                <p>{description}</p>
              </>
            )}
          </div>
        </div>

        {/* Live counts */}
        {loading ? (
          <span className="skeleton" style={{ width: '14rem', height: '3rem', borderRadius: 'var(--radius-control)' }} />
        ) : (
          <div className="discordStats">
            <span className="discordStat">
              <span className="discordStatIcon" aria-hidden="true">
                <IconUsers size={16} />
              </span>
              <strong>{formatCount(discord?.online)}</strong> online
            </span>
            <span className="discordStatDivider" aria-hidden="true" />
            <span className="discordStat">
              <strong>{formatCount(discord?.members)}</strong> members
            </span>
          </div>
        )}

        {/* Join */}
        <a className="btn btnLight discordJoin" href={siteLinks.discord} target="_blank" rel="noopener noreferrer">
          <IconDiscord size={18} />
          Join
        </a>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Registration guide: three steps
// ----------------------------------------------------------------------------
function RegistrationGuide({ guildId }) {
  return (
    <section className="panel panelGlow" id="registration" aria-labelledby="registrationTitle">
      <div className="panelHeader guideHeader">
        <div>
          <h3 id="registrationTitle">Registration guide</h3>
          <p className="guideSubtitle">Follow these steps in order to register and verify your account.</p>
        </div>
      </div>

      <ol className="guideSteps" role="list">
        <GuideStep number={1} title="Head to the registration channel">
          <p className="guideText">
            Complete the onboarding and discovery process and head to{' '}
            <Mention tone="register" href={channelHref(guildId, channels.register)}>
              #Register
            </Mention>
            .
          </p>
        </GuideStep>

        <GuideStep
          number={2}
          title={
            <>
              Type <Mention tone="command">/register</Mention> to join
            </>
          }
        >
          <p className="guideText">Complete the captcha and link your username.</p>
        </GuideStep>

        <GuideStep number={3} title="Accept the redirect and head to the website">
          <p className="guideText">
            After you are redirected to{' '}
            <Mention tone="site" href="/">
              kyriadon.vercel.app
            </Mention>
            , log in with Discord to complete your verification.
          </p>
        </GuideStep>
      </ol>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Help panel: Discord and the support guide
// ----------------------------------------------------------------------------
function HelpPanel({ guildId }) {
  return (
    <section className="panel panelGlow" aria-labelledby="helpTitle">
      <div className="panelHeader guideHeader">
        <div>
          <h3 id="helpTitle">Need help?</h3>
          <p className="guideSubtitle">Stuck on a step? Ask in the Discord or read the support guide.</p>
        </div>
      </div>

      <ul className="linkList">
        <li>
          <a className="linkRow" href={siteLinks.discord} target="_blank" rel="noopener noreferrer">
            <span className="linkIcon">
              <IconDiscord />
            </span>
            <span className="linkText">
              <span className="linkTitle">Ask in the Discord</span>
              <span className="linkDesc">Get help from the community</span>
            </span>
            <span className="linkChevron">
              <IconChevron />
            </span>
          </a>
        </li>
        <li>
                    {/* Opens the support channel in Discord */}
          <a className="linkRow" href={channelHref(guildId, channels.support)} target="_blank" rel="noopener noreferrer">
            <span className="linkIcon">
              <IconBook />
            </span>
            <span className="linkText">
              <span className="linkTitle">Read the support guide</span>
              <span className="linkDesc">Answers to common questions</span>
            </span>
            <span className="linkChevron">
              <IconChevron />
            </span>
          </a>
        </li>
      </ul>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Discord-style form preview (decorative, not interactive)
// ----------------------------------------------------------------------------
function FormPreview() {
  return (
    <div
      className="discordForm"
      role="img"
      aria-label="Preview of the testing form in Discord, asking for your region, gamemode and version"
    >
      <div className="discordFormHead">
        <span className="discordFormTitle">Request a test</span>
        <span className="discordFormClose">
          <IconClose size={20} />
        </span>
      </div>

      <div className="discordFormBody">
        {testFormFields.map((field) => (
          <div className="discordFormField" key={field.label}>
            <span className="discordFormLabel">
              {field.label}
              <span className="discordFormRequired">*</span>
            </span>
            <span className="discordFormSelect">
              <span>{field.placeholder}</span>
              <IconChevronDown size={18} />
            </span>
          </div>
        ))}
      </div>

      <div className="discordFormFoot">
        <span className="discordFormCancel">Cancel</span>
        <span className="discordFormSubmit">Submit</span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Testing guide: three steps with the form preview
// ----------------------------------------------------------------------------
function TestingGuide({ guildId }) {
  return (
    <section className="panel panelGlow" id="testing" aria-labelledby="testingTitle">
      <div className="panelHeader guideHeader">
        <div>
          <h3 id="testingTitle">Testing guide</h3>
          <p className="guideSubtitle">Once you are registered, here is how to get tested.</p>
        </div>
      </div>

      <ol className="guideSteps" role="list">
        <GuideStep number={1} title="How to test">
          <p className="guideText">
            Head to{' '}
            <Mention tone="testing" href={channelHref(guildId, channels.testing)}>
              #Testing
            </Mention>
            .
          </p>
        </GuideStep>

        <GuideStep number={2} title="Fill out the form to continue">
          <p className="guideText">Choose your region, gamemode and version.</p>
          <FormPreview />
          <p className="guideCaption">Preview of the form you will see in Discord.</p>
        </GuideStep>

        <GuideStep
          number={3}
          title={
            <>
              Wait patiently
              <span className="badge" data-tone="info">
                Max 20 slots
              </span>
            </>
          }
        >
          <p className="guideText">
            Wait for testers to come online and test you. The queue has a maximum of 20 slots, so be patient and wait your turn.
          </p>
        </GuideStep>
      </ol>
    </section>
  );
}

// ----------------------------------------------------------------------------
// RoleChip: non-clickable role-style chip (same look as Mention).
// `live` makes the gradient flow continuously.
// ----------------------------------------------------------------------------
function RoleChip({ tone, live = false, roleId, children }) {
  return (
    <span className="mention" data-tone={tone} data-flow={live ? 'live' : undefined} data-role-id={roleId}>
      <span className="mentionName">{children}</span>
    </span>
  );
}

// ----------------------------------------------------------------------------
// Icon chip: the "Icon" part of the Booster II custom role perk
// ----------------------------------------------------------------------------
function IconChip() {
  return (
    <span className="mention" data-tone="icon" role="img" aria-label="icon">
      <IconSparkle size={16} />
    </span>
  );
}

// ----------------------------------------------------------------------------
// Stars chip: golden role-style chip with a star icon before "Stars"
// ----------------------------------------------------------------------------
function StarsChip({ amount }) {
  return (
    <span className="mention" data-tone="gold">
      <span className="mentionName">
        {amount} <IconStar size={14} /> Stars
      </span>
    </span>
  );
}

// ----------------------------------------------------------------------------
// Booster tiers: tone, perks and Discord role IDs. Perks can contain chips and links.
// ----------------------------------------------------------------------------
const boosterTiers = [
  {
    id: 'booster-one',
    tone: 'boosterOne',
    name: 'Booster I',
    discordPerks: [
      <>Custom <RoleChip tone="boosterOne" roleId="1493948681026670732">@Booster I</RoleChip> role</>,
      'Reduced slow mode',
      'Enhanced voice chat perms',
    ],
    websitePerks: [
      <><StarsChip amount="+350" /> (+350 Stars per boost)</>,
      <>Special <strong>Booster</strong> tag</>,
      'Priority support',
    ],
  },
  {
    id: 'booster-two',
    tone: 'boosterTwo',
    name: 'Booster II',
    // Shows the "Advanced view" chip inside Try it out
    advanced: true,
    discordPerks: [
      <>Custom <RoleChip tone="boosterTwo" roleId="1493951439968407572">@Booster II</RoleChip> role</>,
      'Custom channel & voice chat creation permissions',
      <>Custom role with <RoleChip tone="spectrum" live>Gradient</RoleChip> and <IconChip /></>,
      'Priority testing and support',
      'Access to a booster-only channel',
    ],
    websitePerks: [
      <><StarsChip amount="+1050" /> (1050x3 for 6 boosts)</>,
      'Custom tag perms',
      <>Even better showcase in the <Mention tone="supporters" href="/supporters">Supporters</Mention> page</>,
      <>Custom website gradient access <span className="badge" data-tone="warning">BETA</span></>,
      <><RoleChip tone="skull">Skull Cracker</RoleChip> profile effect</>,
    ],
  },
];

// ----------------------------------------------------------------------------
// One group of perks (Discord or website) with check marks
// ----------------------------------------------------------------------------
function PerkGroup({ title, perks }) {
  return (
    <div className="perkGroup">
      <h5 className="perkGroupTitle">{title}</h5>
      <ul className="perkList" role="list">
        {perks.map((perk, index) => (
          <li className="perkItem" key={index}>
            <span className="perkCheck" aria-hidden="true">
              <IconCheck size={16} />
            </span>
            <span className="perkText">{perk}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------------------
// One booster tier: role preview, perks and the "Try it out" name preview.
// The tier hue flows in on hover (see section 9 of aboutStyles.css).
// ----------------------------------------------------------------------------
// One booster tier: role preview, perks, name preview and (Booster II) the Advanced view chip
function BoostTier({ tier }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [studioOpen, setStudioOpen] = useState(false);
  const studioButtonRef = useRef(null);
  const tryId = `${tier.id}-try`;

  // Closing the studio returns focus to the chip that opened it
  const closeStudio = () => {
    setStudioOpen(false);
    requestAnimationFrame(() => studioButtonRef.current?.focus());
  };

  return (
    <div className="boostTier" data-tone={tier.tone}>
      <h4 className="boostTierName">{tier.name}</h4>

      {/* What the role looks like (the gradient flows live) */}
      <div className="boostRole">
        <span className="boostRoleLabel">What the role looks like</span>
        <RoleChip tone={tier.tone} live>
          {tier.name}
        </RoleChip>
      </div>

      <PerkGroup title="Discord perks" perks={tier.discordPerks} />
      <PerkGroup title="Website perks" perks={tier.websitePerks} />

      {/* Try it out: type a name (max 15 characters) to see it in the role gradient */}
      <div className="boostTry">
        <button type="button" className="btn btnSecondary" aria-expanded={open} aria-controls={tryId} onClick={() => setOpen((value) => !value)}>
          Try it out
        </button>

        {open && (
          <div className="boostTryPanel" id={tryId}>
            <label className="boostField">
              <IconSearch size={18} />
              <input
                className="searchInput"
                type="text"
                value={name}
                maxLength={15}
                placeholder="Type your username"
                aria-label="Your username"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                onChange={(event) => setName(event.target.value)}
              />
              <span className="boostCount" aria-hidden="true">
                {name.length}/15
              </span>
            </label>

            {/* The name alone, in the tier gradient, without the box */}
            <div className="boostPreview" aria-live="polite">
              {name.trim() ? (
                <span className="mentionName boostName" data-flow="live">
                  {name}
                </span>
              ) : (
                <span className="boostHint">Your name appears here.</span>
              )}
            </div>

            {/* Advanced view (Booster II): opens the role studio */}
            {tier.advanced && (
              <button ref={studioButtonRef} type="button" className="mention mentionButton" data-tone={tier.tone} aria-haspopup="dialog" onClick={() => setStudioOpen(true)}>
                <span className="mentionName">Advanced view</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Role studio modal */}
      {studioOpen && <RoleStudio onClose={closeStudio} />}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Boosting perks panel: both tiers side by side
// ----------------------------------------------------------------------------
function BoostingPerks() {
  return (
    <section className="panel panelGlow boostPanel" id="boosting" aria-labelledby="boostingTitle">
      <div className="panelHeader guideHeader">
        <div>
          <h3 id="boostingTitle">Boosting perks</h3>
          <p className="guideSubtitle">Boost the Discord server to unlock perks on Discord and on the website.</p>
        </div>
      </div>

      <div className="boostTiers">
        {boosterTiers.map((tier) => (
          <BoostTier key={tier.id} tier={tier} />
        ))}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Role studio constants: limits, brush sizes and colour modes
// ----------------------------------------------------------------------------
const MAX_STOPS = 5;
const MIN_STOPS = 2;
const NAME_LIMIT = 15;
const ROLE_NAME_LIMIT = 20;
const GRID_W = 100;
const GRID_H = 75;

const brushes = [
  { id: 'thin', label: 'Thin', width: 3 },
  { id: 'medium', label: 'Medium', width: 5 },
  { id: 'thick', label: 'Thick', width: 8 },
];

const colorModes = [
  { id: 'solid', label: 'Solid' },
  { id: 'holographic', label: 'Holographic' },
  { id: 'gradient', label: 'Gradient' },
];

// ----------------------------------------------------------------------------
// Ten preset icons (24 x 24 grid, stroke style like the rest of the site)
// ----------------------------------------------------------------------------
const preset = (id, name, ...paths) => ({
  id,
  name,
  viewBox: '0 0 24 24',
  paths: paths.map((d) => ({ d, width: 2 })),
});

const presetIcons = [
  preset('crown', 'Crown', 'M3.5 8.5 7.5 12 12 5.5l4.5 6.5 4-3.5-1.5 9.5h-14L3.5 8.5Z'),
  preset('star', 'Star', 'm12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Z'),
  preset('heart', 'Heart', 'M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z'),
  preset('bolt', 'Bolt', 'M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z'),
  preset('flame', 'Flame', 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.3 2 2.5C11 8.5 11.3 5.5 12 3Z'),
  preset('diamond', 'Diamond', 'M6.5 4h11L21 9.5 12 20 3 9.5 6.5 4Z', 'M3 9.5h18', 'M9.5 4 8 9.5l4 10.5 4-10.5L14.5 4'),
  preset('skull', 'Skull', 'M12 3.5c-4 0-7 2.8-7 6.8 0 2.4 1.1 3.9 2.5 5V19h9v-3.7c1.4-1.1 2.5-2.6 2.5-5 0-4-3-6.8-7-6.8Z', 'M9.5 11h.01M14.5 11h.01', 'M10.5 19v-2.2M13.5 19v-2.2'),
  preset('shield', 'Shield', 'M12 3.5 5 6v5.5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-2.5Z', 'm9 12 2.2 2.2L15.2 10'),
  preset('moon', 'Moon', 'M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z'),
  preset('sparkle', 'Sparkle', 'M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9L11 3.5Z', 'M18.5 16.5v3M17 18h3'),
];

// ----------------------------------------------------------------------------
// Helper: list of [x, y] points to a smooth SVG path string
// ----------------------------------------------------------------------------
function toPath(points) {
  if (points.length === 1) return `M${points[0][0]} ${points[0][1]}h.01`;
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = Math.round(((points[i][0] + points[i + 1][0]) / 2) * 10) / 10;
    const midY = Math.round(((points[i][1] + points[i + 1][1]) / 2) * 10) / 10;
    d += `Q${points[i][0]} ${points[i][1]} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  return `${d}L${last[0]} ${last[1]}`;
}

// ----------------------------------------------------------------------------
// Helper: file-name friendly version of an icon name
// ----------------------------------------------------------------------------
const slugify = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'my-icon';

// ----------------------------------------------------------------------------
// Helper: turns the colour settings into one "paint" description.
// With flow on, the stops are mirrored so the gradient loops without a seam.
// ----------------------------------------------------------------------------
function buildPaint({ mode, solid, stops, flow }) {
  if (mode === 'solid') return { kind: 'solid', color: solid, first: solid };

  const items =
    mode === 'holographic'
      ? gradientStops.holographic.map((color, index, list) => ({ color, pos: (index / (list.length - 1)) * 100 }))
      : [...stops].sort((a, b) => a.pos - b.pos);

  const plain = items.map((item) => `${item.color} ${item.pos}%`).join(', ');
  const bar = `linear-gradient(90deg, ${plain})`;
  const first = items[0].color;

  if (!flow) return { kind: 'gradient', css: bar, bar, size: '100% 100%', flow: false, first };

  const forward = items.map((item) => `${item.color} ${item.pos / 2}%`);
  const mirror = [...items].reverse().map((item) => `${item.color} ${100 - item.pos / 2}%`);
  return { kind: 'gradient', css: `linear-gradient(90deg, ${[...forward, ...mirror].join(', ')})`, bar, size: '200% 100%', flow: true, first };
}

// ----------------------------------------------------------------------------
// RoleIcon: draws a preset or custom icon at a given height
// ----------------------------------------------------------------------------
function RoleIcon({ icon, size = 16 }) {
  if (!icon) return null;
  const [, , width, height] = icon.viewBox.split(' ').map(Number);
  return (
    <svg
      className="roleIcon"
      viewBox={icon.viewBox}
      width={(size * width) / height}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icon.paths.map((path, index) => (
        <path key={index} d={path.d} strokeWidth={path.width} />
      ))}
    </svg>
  );
}

// ----------------------------------------------------------------------------
// RoleLine: optional icon followed by the name in the configured paint
// ----------------------------------------------------------------------------
function RoleLine({ paint, icon, children }) {
  const textProps =
    paint.kind === 'solid'
      ? { 'data-kind': 'solid', style: { color: paint.color } }
      : { 'data-kind': 'gradient', 'data-flow': paint.flow, style: { '--role-paint': paint.css, '--role-size': paint.size } };

  return (
    <span className="roleLine">
      <RoleIcon icon={icon} size={16} />
      <span className="roleText" {...textProps}>
        {children}
      </span>
    </span>
  );
}

// ----------------------------------------------------------------------------
// IconDrawer: 100 x 75 canvas (shown scaled up) to draw, name, download and use an icon
// ----------------------------------------------------------------------------
function IconDrawer({ onUse }) {
  const svgRef = useRef(null);
  const draftRef = useRef(null);
  const [strokes, setStrokes] = useState([]);
  const [draft, setDraft] = useState(null);
  const [brushId, setBrushId] = useState('medium');
  const [iconName, setIconName] = useState('');
  const brush = brushes.find((item) => item.id === brushId);

  // Pointer position in canvas units
  const toPoint = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.min(GRID_W, Math.max(0, ((event.clientX - rect.left) / rect.width) * GRID_W));
    const y = Math.min(GRID_H, Math.max(0, ((event.clientY - rect.top) / rect.height) * GRID_H));
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  };

  // Start a stroke
  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draftRef.current = { width: brush.width, points: [toPoint(event)] };
    setDraft(draftRef.current);
  };

  // Extend the stroke (tiny movements are skipped to keep paths light)
  const onPointerMove = (event) => {
    const current = draftRef.current;
    if (!current) return;
    const point = toPoint(event);
    const last = current.points[current.points.length - 1];
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.8) return;
    draftRef.current = { ...current, points: [...current.points, point] };
    setDraft(draftRef.current);
  };

  // Finish the stroke
  const onPointerUp = () => {
    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (current) setStrokes((list) => [...list, current]);
  };

  // Path data for everything drawn so far
  const paths = strokes.map((stroke) => ({ d: toPath(stroke.points), width: stroke.width }));

  // Downloads the drawing as a white 100 x 75 SVG file
  const download = () => {
    const body = paths.map((path) => `<path d="${path.d}" stroke-width="${path.width}"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID_W} ${GRID_H}" width="${GRID_W}" height="${GRID_H}" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(iconName)}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Uses the drawing as the role icon
  const use = () =>
    onUse({ id: 'custom', name: iconName.trim() || 'My icon', viewBox: `0 0 ${GRID_W} ${GRID_H}`, paths });

  return (
    <div className="drawer">
      <svg
        ref={svgRef}
        className="drawCanvas"
        viewBox={`0 0 ${GRID_W} ${GRID_H}`}
        role="img"
        aria-label="Drawing canvas, 100 by 75 pixels"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Faint grid so proportions are easy to judge */}
        <defs>
          <pattern id="drawGrid" width="12.5" height="12.5" patternUnits="userSpaceOnUse">
            <path d="M12.5 0H0V12.5" fill="none" stroke="currentColor" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width={GRID_W} height={GRID_H} fill="url(#drawGrid)" className="drawGrid" />
        <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
          {[...strokes, draft].filter(Boolean).map((stroke, index) => (
            <path key={index} d={toPath(stroke.points)} strokeWidth={stroke.width} />
          ))}
        </g>
      </svg>

      <div className="drawTools">
        <p className="guideCaption">Canvas is 100 × 75 px. Draw with your mouse or finger.</p>

        <div className="studioRow">
          <div className="segmented" role="group" aria-label="Brush size">
            {brushes.map((item) => (
              <button key={item.id} type="button" className="segment" aria-pressed={item.id === brushId} onClick={() => setBrushId(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btnGhost btnCompact" disabled={!strokes.length} onClick={() => setStrokes((list) => list.slice(0, -1))}>
            Undo
          </button>
          <button type="button" className="btn btnGhost btnCompact" disabled={!strokes.length} onClick={() => setStrokes([])}>
            Clear
          </button>
        </div>

        <label className="studioField">
          <span className="studioLabel">Icon name</span>
          <input className="studioInput" type="text" value={iconName} maxLength={24} placeholder="My icon" autoComplete="off" spellCheck={false} onChange={(event) => setIconName(event.target.value)} />
        </label>

        <div className="studioRow">
          <button type="button" className="btn btnSecondary btnCompact" disabled={!strokes.length} onClick={download}>
            Download SVG
          </button>
          <button type="button" className="btn btnLight btnCompact" disabled={!strokes.length} onClick={use}>
            Use in role
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// RoleStudio: modal to customise the Booster II role (icon, colours, gradient)
// and preview it with a name, in chat and as a role chip
// ----------------------------------------------------------------------------
function RoleStudio({ onClose }) {
  const dialogRef = useRef(null);
  const nameRef = useRef(null);
  const nextStopId = useRef(gradientStops.boosterTwo.length + 1);
  const [name, setName] = useState('');
  const [roleName, setRoleName] = useState('Booster II');
  const [icon, setIcon] = useState(null);
  const [customIcon, setCustomIcon] = useState(null);
  const [mode, setMode] = useState('gradient');
  const [solid, setSolid] = useState(gradientStops.boosterTwo[1]);
  const [solidText, setSolidText] = useState(gradientStops.boosterTwo[1]);
  const [flow, setFlow] = useState(true);
  const [stops, setStops] = useState(() =>
    gradientStops.boosterTwo.map((color, index, list) => ({ id: index + 1, color, pos: Math.round((index / (list.length - 1)) * 100) })),
  );

  // Lock page scroll and focus the name field while the modal is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Escape closes, Tab stays inside the dialog
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // The paint and the chip box colour follow every change live
  const paint = useMemo(() => buildPaint({ mode, solid, stops, flow }), [mode, solid, stops, flow]);
  const chipBackground = `color-mix(in srgb, ${paint.first} 22%, var(--color-bg-raised))`;

  // Gradient stop editing (2 to 5 stops)
  const updateStop = (id, patch) => setStops((list) => list.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)));
  const removeStop = (id) => setStops((list) => (list.length <= MIN_STOPS ? list : list.filter((stop) => stop.id !== id)));
  const addStop = () => {
    const id = nextStopId.current;
    nextStopId.current += 1;
    setStops((list) => (list.length >= MAX_STOPS ? list : [...list, { id, color: '#ff9ad5', pos: 100 }]));
  };

  // Solid colour: picker and hex field stay in sync
  const pickSolid = (value) => {
    setSolid(value);
    setSolidText(value);
  };
  const typeSolid = (value) => {
    setSolidText(value);
    if (/^#[0-9a-f]{6}$/i.test(value)) setSolid(value.toLowerCase());
  };

  return createPortal(
    // Clicking the backdrop closes the studio
    <div
      className="studioBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="studioDialog" role="dialog" aria-modal="true" aria-labelledby="studioTitle" ref={dialogRef} onKeyDown={onKeyDown}>
        <div className="studioHeader">
          <div>
            <h3 id="studioTitle">Customize your role</h3>
            <p className="guideSubtitle">Design your Booster II role and preview it live.</p>
          </div>
          <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="studioBody">
          {/* Left: live previews */}
          <div className="studioPreview">
            <label className="boostField">
              <IconSearch size={18} />
              <input
                ref={nameRef}
                className="searchInput"
                type="text"
                value={name}
                maxLength={NAME_LIMIT}
                placeholder="Type your username"
                aria-label="Your username"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setName(event.target.value)}
              />
              <span className="boostCount" aria-hidden="true">
                {name.length}/{NAME_LIMIT}
              </span>
            </label>

            {/* Name as it appears in a Discord message */}
            <div className="studioPreviewBlock">
              <h5 className="studioLabel">Name preview</h5>
              <div className="discordMessage">
                <span className="discordAvatar" aria-hidden="true">
                  {(name.trim() || 'Y').charAt(0).toUpperCase()}
                </span>
                <div className="discordMessageBody">
                  <div className="discordMessageHead">
                    <RoleLine paint={paint} icon={icon}>
                      {name.trim() || 'Your name'}
                    </RoleLine>
                    <span className="discordMessageTime">Today at 12:00</span>
                  </div>
                  <p className="discordMessageText">This is how your name looks in chat.</p>
                </div>
              </div>
            </div>

            {/* The role as a chip (same style as the other role chips) */}
            <div className="studioPreviewBlock">
              <h5 className="studioLabel">Role preview</h5>
              <span className="mention" style={{ '--mention-bg': chipBackground }}>
                <RoleLine paint={paint} icon={icon}>
                  {roleName.trim() || 'Role'}
                </RoleLine>
              </span>
            </div>
          </div>

          {/* Right: editor */}
          <div className="studioEditor">
            <section className="studioSection" aria-labelledby="studioRoleTitle">
              <h4 id="studioRoleTitle" className="studioSectionTitle">
                Role name
              </h4>
              <input
                className="studioInput"
                type="text"
                value={roleName}
                maxLength={ROLE_NAME_LIMIT}
                aria-label="Role name"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setRoleName(event.target.value)}
              />
            </section>

            <section className="studioSection" aria-labelledby="studioIconTitle">
              <h4 id="studioIconTitle" className="studioSectionTitle">
                Icon
              </h4>
              <div className="studioIcons" role="group" aria-label="Role icon">
                <button type="button" className="studioIconTile studioIconNone" aria-pressed={!icon} aria-label="No icon" onClick={() => setIcon(null)}>
                  None
                </button>
                {presetIcons.map((item) => (
                  <button key={item.id} type="button" className="studioIconTile" aria-pressed={icon?.id === item.id} aria-label={item.name} onClick={() => setIcon(item)}>
                    <RoleIcon icon={item} size={22} />
                  </button>
                ))}
                {customIcon && (
                  <button type="button" className="studioIconTile" aria-pressed={icon?.id === 'custom'} aria-label={`${customIcon.name} (your drawing)`} onClick={() => setIcon(customIcon)}>
                    <RoleIcon icon={customIcon} size={22} />
                  </button>
                )}
              </div>

              <h5 className="studioLabel">Draw your own</h5>
              <IconDrawer
                onUse={(next) => {
                  setCustomIcon(next);
                  setIcon(next);
                }}
              />
            </section>

            <section className="studioSection" aria-labelledby="studioColorTitle">
              <h4 id="studioColorTitle" className="studioSectionTitle">
                Color
              </h4>

              <div className="studioRow">
                <div className="segmented" role="group" aria-label="Color mode">
                  {colorModes.map((item) => (
                    <button key={item.id} type="button" className="segment" aria-pressed={item.id === mode} onClick={() => setMode(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>
                {mode !== 'solid' && (
                  <label className="studioSwitch">
                    <input type="checkbox" checked={flow} onChange={(event) => setFlow(event.target.checked)} />
                    Flow live
                  </label>
                )}
              </div>

              {/* Solid: any colour */}
              {mode === 'solid' && (
                <div className="studioRow">
                  <input type="color" className="colorInput" value={solid} aria-label="Solid color" onChange={(event) => pickSolid(event.target.value)} />
                  <input className="studioInput studioHex" type="text" value={solidText} maxLength={7} aria-label="Hex color" spellCheck={false} autoComplete="off" onChange={(event) => typeSolid(event.target.value)} />
                </div>
              )}

              {/* Holographic: fixed pastel gradient */}
              {mode === 'holographic' && <div className="gradientBar" style={{ background: paint.bar }} />}

              {/* Gradient: editor with up to five stops */}
              {mode === 'gradient' && (
                <div className="stopList">
                  <div className="gradientBar" style={{ background: paint.bar }} />
                  {stops.map((stop, index) => (
                    <div className="stopRow" key={stop.id}>
                      <input type="color" className="colorInput" value={stop.color} aria-label={`Stop ${index + 1} color`} onChange={(event) => updateStop(stop.id, { color: event.target.value })} />
                      <input type="range" min="0" max="100" value={stop.pos} aria-label={`Stop ${index + 1} position`} onChange={(event) => updateStop(stop.id, { pos: Number(event.target.value) })} />
                      <span className="stopPos">{stop.pos}%</span>
                      <button type="button" className="btn btnGhost btnIcon btnCompact" disabled={stops.length <= MIN_STOPS} aria-label={`Remove stop ${index + 1}`} onClick={() => removeStop(stop.id)}>
                        <IconClose size={16} />
                      </button>
                    </div>
                  ))}
                  <div className="studioRow">
                    <button type="button" className="btn btnSecondary btnCompact" disabled={stops.length >= MAX_STOPS} onClick={addStop}>
                      Add stop
                    </button>
                    <span className="guideCaption">
                      {stops.length} of {MAX_STOPS} stops
                    </span>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        <div className="studioFooter">
          <p className="guideCaption">Changes are a preview only.</p>
          <button type="button" className="btn btnSecondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}


// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------
export default function About() {
  // Server profile and counts (name, description, banner, online, members)
  const { status, data } = useFetch('/api/stats');
  const discord = data?.discord || null;

  return (
    <SiteShell title={content.title} description={content.description}>
      <div className="aboutGrid">
        {/* Hero: same component and hover behaviour as the homepage, purple tone */}
        <section className="heroShell areaHero" aria-labelledby="heroTitle">
          <div className="heroPanel" data-tone="purple">
            <div className="heroGlow" aria-hidden="true" />
            <div className="heroContent">
              <h1 id="heroTitle">{content.hero.title}</h1>
              <h2>{content.hero.subtitle}</h2>
              <p>{content.hero.body}</p>
            </div>
          </div>
        </section>

        {/* Right: Discord server panel (stays in view on large screens) */}
        <aside className="aboutAside">
          <DiscordPanel status={status} discord={discord} />
        </aside>

        {/* Left: registration guide, help, testing guide */}
        <div className="aboutGuides">
          <RegistrationGuide guildId={discord?.guildId} />
          <TestingGuide guildId={discord?.guildId} />
          <BoostingPerks />
          <HelpPanel guildId={discord?.guildId} />
        </div>
      </div>
    </SiteShell>
  );
}
