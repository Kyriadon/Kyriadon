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

// Open book for the Rules chip (stroke icon, same 24px grid as the shared icons)
function IconBookOpen({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 6.5C10.4 5.2 8 4.5 4 4.5v13c4 0 6.4.7 8 2 1.6-1.3 4-2 8-2v-13c-4 0-6.4.7-8 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

// TESTING:
// ----------------------------------------------------------------------------
// Guide content helpers: channel and role names shown for Discord mentions
// ----------------------------------------------------------------------------
const channelMeta = {
  '1475510046388650126': { label: 'Rules', icon: 'book', tone: 'rules' },
  '1511301888375652522': { label: 'Testing', tone: 'testing' },
};

// Tier roles in the order they were provided (check these names against your server)
const tierRoleIds = [
  '1511269095851556895', '1511269046912552970', '1511268988452343868', '1511268924581478520', '1511268857967284244',
  '1511268786920099860', '1511268726585167936', '1511268670611914782', '1511268609907757159', '1511268533923876944',
];
const roleLabels = {
  '1511269414907936838': 'Elevated tier',
  ...Object.fromEntries(tierRoleIds.map((id, index) => [id, `${index % 2 === 0 ? 'HT' : 'LT'}${Math.floor(index / 2) + 1}`])),
};

const md = (...lines) => lines.join('\n');

// ----------------------------------------------------------------------------
// Mini markdown: **bold**, __underline__, `code`, [link](url), ==highlight==,
// <#channel>, <@&role>, ## heading, - list, > quote, -# small, ``` code ```
// ----------------------------------------------------------------------------
const INLINE = /(\*\*(?:[^*]|\*(?!\*))+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|==[^=]+==|<#\d+>|<@&\d+>)/g;

function renderInline(text, ctx, prefix = '') {
  return text.split(INLINE).map((part, index) => {
    const key = `${prefix}${index}`;
    if (index % 2 === 0) return part;
    if (part.startsWith('**')) return <strong key={key}>{renderInline(part.slice(2, -2), ctx, `${key}-`)}</strong>;
    if (part.startsWith('__')) return <u key={key}>{renderInline(part.slice(2, -2), ctx, `${key}-`)}</u>;
    if (part.startsWith('==')) return <mark key={key} className="mdHl">{renderInline(part.slice(2, -2), ctx, `${key}-`)}</mark>;
    if (part.startsWith('`')) return <code key={key} className="mdCode">{part.slice(1, -1)}</code>;
    if (part.startsWith('[')) {
      const [, label, href] = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      return <a key={key} className="mdLink" href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
    }
    if (part.startsWith('<#')) {
      const id = part.slice(2, -1);
      const meta = channelMeta[id] || { label: 'channel', tone: 'register' };
      return (
        <Mention key={key} tone={meta.tone} href={channelHref(ctx.guildId, id)}>
          {meta.icon ? <>#<IconBookOpen /> {meta.label}</> : `#${meta.label}`}
        </Mention>
      );
    }
    const id = part.slice(3, -1);
    return <RoleChip key={key} tone="holo" live roleId={id}>{`@${roleLabels[id] || 'Tier role'}`}</RoleChip>;
  });
}

function Md({ text, ctx }) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i += 1; continue; }
    if (line.startsWith('```')) {
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) { body.push(lines[i]); i += 1; }
      i += 1;
      blocks.push({ type: 'pre', text: body.join('\n') });
    } else if (line.startsWith('## ')) { blocks.push({ type: 'h', text: line.slice(3) }); i += 1; }
    else if (line.startsWith('-# ')) { blocks.push({ type: 'small', text: line.slice(3) }); i += 1; }
    else if (line.startsWith('> ')) { blocks.push({ type: 'quote', text: line.slice(2) }); i += 1; }
    else if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(lines[i].slice(2)); i += 1; }
      blocks.push({ type: 'ul', items });
    } else {
      const para = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^(```|## |-# |> |- )/.test(lines[i])) { para.push(lines[i]); i += 1; }
      blocks.push({ type: 'p', text: para.join(' ') });
    }
  }
  return (
    <div className="md">
      {blocks.map((block, index) => {
        if (block.type === 'h') return <h5 className="mdH" key={index}>{renderInline(block.text, ctx)}</h5>;
        if (block.type === 'pre') return <pre className="mdPre" key={index}>{block.text}</pre>;
        if (block.type === 'quote') return <blockquote className="mdQuote" key={index}>{renderInline(block.text, ctx)}</blockquote>;
        if (block.type === 'small') return <p className="mdSmall" key={index}>{renderInline(block.text, ctx)}</p>;
        if (block.type === 'ul') return <ul className="mdList" role="list" key={index}>{block.items.map((item, n) => <li key={n}>{renderInline(item, ctx)}</li>)}</ul>;
        return <p className="mdP" key={index}>{renderInline(block.text, ctx)}</p>;
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Embed: card with a flowing holographic line on the left edge (Discord-style)
// ----------------------------------------------------------------------------
function Embed({ title, art, children }) {
  return (
    <article className="embed">
      <span className="embedBar" aria-hidden="true" />
      <div className="embedBody">
        <h4 className="embedTitle">{title}</h4>
        {children}
        {art}
      </div>
    </article>
  );
}

// ----------------------------------------------------------------------------
// CSS illustrations that guide the reader (decorative)
// ----------------------------------------------------------------------------
const guideArt = {
  flow: (
    <div className="art artFlow" aria-hidden="true">
      <span>Evaluate</span><i /><span>Place</span><i /><span>Earn</span>
    </div>
  ),
  bars: (
    <div className="art artBars" aria-hidden="true">
      {[30, 48, 64, 80, 100].map((height) => <span key={height} style={{ '--h': `${height}%` }} />)}
    </div>
  ),
  timeline: (
    <div className="art artTimeline" aria-hidden="true">
      <span>Test</span><i /><span>Improve</span><i /><span>Retest</span>
    </div>
  ),
  shield: (
    <div className="art artShield" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5 5 6v5.5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-2.5Z" />
        <path d="m9 12 2.2 2.2L15.2 10" />
      </svg>
      <span>Consistency</span><span>Accuracy</span><span>Fairness</span>
    </div>
  ),
  menu: (
    <div className="art artMenu" aria-hidden="true">
      <span>Select a topic</span>
      <IconChevronDown size={18} />
    </div>
  ),
};

// ----------------------------------------------------------------------------
// Advanced guide embeds (standardised wording)
// ----------------------------------------------------------------------------
const guideEmbeds = [
  {
    title: 'What is tier testing?',
    art: 'flow',
    text: md(
      "Tier testing is an official ranking system designed to measure a player's ==skill level== through structured competitive evaluation.",
      '',
      'Using standardized testing procedures, players are placed into **skill-based tiers** that reflect their current ability within a specific gamemode.',
      '',
      'Unlike casual opinions or community perception, tier placements are ==earned through direct evaluation== against established standards.',
    ),
  },
  {
    title: 'Purpose of the tier list',
    art: 'bars',
    text: md(
      'The tier list exists to create a consistent and reliable method of measuring player skill.',
      '',
      'It provides:',
      '- Fair skill recognition',
      '- Competitive matchmaking',
      '- Clear progression goals',
      '- Community-wide standards',
      '- Accurate player comparisons',
      '',
      'Every placement is intended to represent ==demonstrated ability== rather than reputation or popularity.',
    ),
  },
  {
    title: 'What a tier represents',
    art: 'timeline',
    text: md(
      'Your tier represents your ==current performance level== at the time of testing.',
      '',
      '**A tier is not permanent.**',
      '',
      'As players improve, adapt and gain experience, their skill level may change over time.',
      '',
      'For this reason, retesting and tier progression are fundamental parts of the system.',
    ),
  },
  {
    title: 'Competitive integrity',
    art: 'shield',
    text: md(
      'The credibility of any tier list depends on consistency, accuracy and fair evaluation.',
      '',
      'All testing procedures, cooldowns, verification measures and rulebook policies exist to protect the ==integrity of the ranking system==.',
      '',
      'These standards ensure that every placement holds meaning and remains respected across the community.',
    ),
  },
  {
    title: 'Additional information',
    art: 'menu',
    text: md(
      'Server information, testing rules, cooldowns, gate keeping policies and detailed testing procedures can be accessed through the menu below.',
      '',
      'Please ==review all available information== before requesting a tier test.',
    ),
  },
];

const testedText = md(
  'Before requesting a tier test, you must review and understand the official testing rules.',
  '',
  'Please read <#1475510046388650126> carefully before proceeding.',
  '',
  'By participating in tier testing, you acknowledge that you are ==responsible for following all listed rules, policies and requirements==.',
  '',
  '> Failure to follow the rulebook may result in test invalidation or punishment.',
);

// ----------------------------------------------------------------------------
// Information hub content: servers, legal lists and written topics
// ----------------------------------------------------------------------------
const servers189 = [
  { name: 'Minemen', primary: 'minemen.club', alts: ['mineman.club', 'minemenclub.com'], regions: 'Supports AS, NA, EU, SA and AU proxies.' },
  { name: 'Hypixel', primary: 'hypixel.net', alts: [], regions: 'North America.' },
  { name: 'Axora', primary: 'play.rankedbw.com', alts: ['alt.rankedbw.com', 'sgp.rankedbw.com'], regions: 'Asia.' },
  { name: 'Veltrix', primary: 'veltrix.club', alts: [], regional: [['veltrix.club', 'AS'], ['eu.veltrix.club', 'EU']] },
];

const servers19 = [
  { name: 'Minemen', primary: 'minemen.club', regions: 'Supports multiple regional proxies.' },
  { name: 'Veltrix', primary: 'veltrix.club', regional: [['veltrix.club', 'AS'], ['eu.veltrix.club', 'EU']] },
  {
    name: 'CatPvP',
    primary: 'catpvp.xyz',
    regional: [['eu.catpvp.xyz', 'EU'], ['east.catpvp.xyz', 'NA East'], ['west.catpvp.xyz', 'NA West'], ['nac.catpvp.com', 'NA Central'], ['sa.catpvp.xyz', 'SA'], ['as.catpvp.xyz', 'AS'], ['me.catpvp.xyz', 'ME'], ['au.catpvp.xyz', 'AU']],
  },
  { name: 'MetalMC', primary: 'metalmc.vip', regional: [['eu.metalmc.vip', 'EU'], ['as.metalmc.vip', 'AS']] },
  { name: 'MeowMC', primary: 'meowmc.xyz', regional: [['as.meowmc.fun', 'AS']] },
];

const serversMore = [
  { name: 'LokaMC', primary: 'play.lokamc.com' },
  { name: 'CactusMC', primary: 'cactusmc.xyz' },
  { name: 'MCPvP', primary: 'mcpvp.club', alts: ['mcpvp.com'] },
  { name: 'Stray', primary: 'stray.gg' },
  { name: 'SMPPrac', primary: 'smpprac.com' },
  { name: 'SMPPvP', primary: 'play.smppvp.com' },
  { name: 'Vexaay', primary: 'vexaay.nl' },
  { name: 'FlowPvP', primary: 'flowpvp.gg' },
  { name: 'DiaSMP', primary: 'diasmp.com' },
  { name: 'NethFFA', primary: 'nethffa.com' },
];

const legal = {
  allowed: [
    {
      title: 'Mods',
      items: [
        'Library mods (ModMenu, Cloth Config, etc.)', 'Performance mods (Sodium, OptiFine, Exordium, etc.)', 'Fabulously Optimized', 'Simply Optimized', 'HUD mods', 'InventoryHUD+', 'KronHUD', 'CustomHUD', 'Gamma mods', 'Health Indicators', 'Zoom mods', "Marlow's Crystal Optimizer", 'HCsCR', 'Bed Optimizer', 'Totem pop counters', 'Hurt camera mods', 'ReplayMod', 'FreeLook', 'Visual mods (Iris, Cloaks+, etc.)', 'No Chat Reports', 'Better Hitreg', 'Ping Equalizer', 'Optimal Aim', 'Anchor Optimizer', 'Client-side crystals',
        { text: "Fair-Play Xaero's Minimap", href: 'https://www.curseforge.com/minecraft/mc-mods/xaeros-minimap-fair-play-edition' },
      ],
    },
    { title: 'Clients', items: ['Badlion Client', 'Lunar Client', 'Any other verified hack-free client'], note: 'Shield status features are not allowed for Axe, DSMP, SMP, Mace, UHC and Spear.' },
    { title: 'Software', items: ['ExitLag', 'Swills', 'Hone', 'Other optimization software'] },
    { title: 'Resource packs', items: ['PvP packs', 'Quality-of-life packs', 'Non-disruptive resource packs', 'Sky overlays', 'Sound overlays', 'Cosmetic overlays'] },
  ],
  banned: [
    {
      title: 'Mods',
      items: ["Xaero's Minimap (standard edition)", 'Inventory automation mods (Mouse Tweaks, Item Scroller, Arrow Shifter, InvMove, etc.)', 'ElytraSwap', 'Click Crystals', "Walksy's Crystal Optimizer", 'BetterPvP', 'Freecam (including Tweakeroo Freecam)', 'Accurate Block Placement'],
    },
    { title: 'Clients', items: ['Vape', 'Marlowww Client', 'Rapture Client', 'Slinky', 'Hydrogen', 'Raven B++', 'Raven XD', 'FDP Client', 'Rise', 'LiquidBounce', 'Sigma', 'Sigma 5.0', 'Any other modified or hack client'] },
    { title: 'Software', items: ['Macros', 'Auto clickers', { text: 'Forge 1.18.2–1.19.4 (unless used with Forge Legalizer)', href: 'https://modrinth.com/mod/forgelegalizer' }] },
    { title: 'Resource packs', items: ['X-ray resource packs'] },
  ],
  risk: {
    items: ['ViaFabric', 'MultiConnect', 'Feather Client', 'Lunar Client', 'Badlion Client', 'Any other PvP client not explicitly listed'],
    note: 'Use of these does not guarantee legality. Staff may request additional verification at any time.',
  },
};

const infoTopics = [
  {
    id: 'servers', icon: 'servers', title: 'Supported servers', stops: ['#38bdf8', '#7dd3fc', '#a5b4fc'],
    summary: 'Addresses, regions and versions we test on.',
    sections: [
      { md: md('Information regarding supported testing servers, alternate addresses, regional connections and version availability.', '', "We conduct tier tests in both **1.8.9** and **1.9+** PvP environments. Select an address to copy it.") },
      { title: '1.8.9 servers', servers: servers189 },
      { title: '1.9+ servers', servers: servers19 },
      { title: 'More 1.9+ servers', servers: serversMore, compact: true },
      { md: md('> Some servers may provide additional regional endpoints that are not publicly documented.', '', '## Important notes', '- Server availability may change without notice.', '- Testers may select specific servers depending on the gamemode being tested.', '- Regional addresses should be used whenever available for the best connection.', '- Alternate addresses exist solely as backup connections and are functionally equivalent to their primary addresses.', '', '> If a server experiences issues during a test, the tester may move the session to another approved server.') },
    ],
  },
  {
    id: 'procedures', icon: 'procedures', title: 'Testing procedures', stops: ['#a78bfa', '#f0abfc', '#fbcfe8'],
    summary: 'How to request a test and which gamemodes we run.',
    sections: [
      { md: md('Head to <#1511301888375652522> and click the **Test now** button. You will be prompted to answer a few questions. Once you fill them out, a custom testing ticket will be created for you to test in.', '', 'You will be pinged and tested within ==24–48 hours==.') },
      { title: 'Prompt questions', chips: ['Version', 'Game mode', 'Server'] },
      { md: 'We test in multiple gamemodes, divided by version. They are listed below.' },
      { title: '1.8 gamemodes', chips: ['Top Fight', 'Emerald Rush', 'Bed Fight', 'Boxing', 'Block Fight', 'Wall Run', 'Low - Mid (Veltrix exclusive)', 'Top Bridge (Veltrix exclusive)', 'Bridge', 'Fireball Fight', 'Sumo', 'Fireball Royale'] },
      { md: '**Bedwars 1v1:** FT 5 and FT 10 (will be explained in PPP).' },
      { title: '1.9+ gamemodes', chips: ['Sword, Speed', 'Sumo', 'DPOT', 'NPOT', 'UHC', 'Crystal', 'Cart', 'Mace', 'Spear', 'Unstable', 'Lifesteal', 'SMP', 'DSMP', 'Axe'] },
      { md: md('## General information', '- We have testers from all around the world to ensure the fastest and easiest tier-testing experience.', '- Ask questions if needed (FAQ coming soon).', "- When reporting a player or tester, don't forget to record and collect evidence against them.") },
    ],
  },
  {
    id: 'tiers', icon: 'tiers', title: 'Tier assignments', stops: ['#5eead4', '#7dd3fc', '#c4b5fd'],
    summary: 'The first half tier roles you can earn.',
    sections: [
      { md: 'There are **10** first half tier roles. They are listed below.' },
      { roles: tierRoleIds },
      { md: '-# Second tier roles are mentioned in PPP' },
    ],
  },
  {
    id: 'cooldowns', icon: 'cooldowns', title: 'Cooldowns', stops: ['#fbbf24', '#fde68a', '#fdba74'],
    summary: 'How long to wait before you can retest.',
    sections: [
      {
        md: md(
          'To maintain fairness and prevent excessive retesting, cooldowns apply after every completed tier test.',
          '', '## Standard cooldown',
          '- Each player receives a **4-day cooldown per gamemode**.',
          '- Cooldowns only apply to the specific gamemode tested.',
          '- Testing in other gamemodes during an active cooldown is allowed.',
          '', '**Example:**', '```', 'Day 1: Tested in Axe', 'Day 2: Can test SMP', 'Day 2: Can test Crystal', 'Day 2: Cannot test Axe', '```',
          '', 'Certain high-tier players are subject to longer cooldowns due to the significance of their placements.',
          '', '## Elevated tier cooldowns',
          '- Players holding any tier above <@&1511268786920099860> must wait **7 days** before retesting in the same gamemode.',
          '- Players holding any tier above <@&1511269414907936838> must wait **at least 30 days** before retesting in the same gamemode.',
          '', '## Important notes',
          '- Cooldowns are tracked separately for each gamemode.',
          '- Staff may deny retests that violate cooldown requirements.',
          '- Attempting to circumvent cooldowns may result in punishment or test invalidation.',
          '', '> Cooldowns exist to preserve tier stability and ensure rankings reflect consistent skill rather than short-term performance.',
        ),
      },
    ],
  },
  {
    id: 'rules', icon: 'rules', title: 'Testing rules', stops: ['#60a5fa', '#93c5fd', '#bfdbfe'],
    summary: 'General rules and your rights as a player.',
    sections: [
      {
        md: md(
          'The full rulebook is in <#1475510046388650126>.',
          '', '## General rules',
          '- Do not use any prohibited mods, clients, software, resource packs or exploits.',
          '- Do not stall, snipe, troll, throw matches or intentionally waste time.',
          '- Treat testers and other players with respect at all times.',
          '- Do not attempt to gain an unfair advantage through bugs, loopholes or external assistance.',
          '- Once warmups have ended, all results are final.',
          '- High ping, lag spikes, FPS issues or hardware problems are not grounds for a retest.',
          '', '## Player rights',
          '- You may record or screenshot your test at any time.',
          '- If a tester asks you to stop recording without valid reason, report the incident immediately.',
          '- You may request up to **5 warmup rounds** before the official test begins.',
          '', '## Important notes',
          '- Failure to follow these rules may result in test invalidation.',
          '- Staff decisions may be appealed through official channels.',
          '- Attempting to circumvent these rules will be treated as cheating.',
        ),
      },
    ],
  },
  {
    id: 'legal', icon: 'legal', title: 'Allowed and banned', stops: ['#34d399', '#fde68a', '#f87171'],
    summary: 'Mods, clients, software and packs, at a glance.',
    sections: [
      { legal },
      { md: '> Staff reserve the right to restrict any modification that provides an unfair competitive advantage, even if not explicitly listed above.' },
    ],
  },
  {
    id: 'gatekeeping', icon: 'gatekeeping', title: 'Gate keeping', stops: ['#c084fc', '#e879f9', '#f9a8d4'],
    summary: 'Why extra verification happens and what to do.',
    sections: [
      {
        md: md(
          'Players who significantly outperform their current tier may be subject to additional verification. This can include extended testing, screenshares, additional matches or delayed tier assignments.',
          '', 'These procedures exist to protect the integrity of the tier list and ensure that every placement is accurate.',
          '', '**Example:**', '```', 'A LT3 consistently defeating a LT2 by large margins.', '```',
          '', 'Gate keeping is a verification process used to ensure that exceptional performances are legitimate and that players are placed into the correct tier.',
          '', 'Contrary to popular belief, gate keeping is ==not a punishment==. It is a quality-control measure designed to protect the accuracy and credibility of the tier list.',
          '', '## What causes gate keeping?',
          '- Defeating players significantly above your current tier.',
          '- Consistently achieving one-sided results against higher tiers.',
          '- Displaying skill far beyond what is expected for your current placement.',
          '- Unusual improvement within a short period of time.',
          '- Any situation where staff require additional verification.',
          '', '## What happens during gate keeping?', 'Depending on the situation, staff may:',
          '- Extend your existing test.',
          '- Request additional matches against different opponents.',
          '- Review previous test results.',
          '- Conduct a screenshare.',
          '- Have multiple testers review your gameplay.',
          '- Delay tier assignment until verification is complete.',
          '', '## How long does it last?', 'There is no fixed duration.',
          '', 'Simple cases may be resolved within minutes, while more complex cases may require additional review before a final decision is reached.',
          '', '## What should I do?',
          '- Remain patient.',
          '- Cooperate with staff requests.',
          '- Continue playing normally.',
          '- Answer questions honestly.',
          '- Follow any verification instructions provided by staff.',
          '', '## Frequently asked questions',
          '**Does being gate kept mean I am cheating?**', 'No. Many legitimate players are gate kept after exceptional performances.',
          '', '**Does gate keeping mean I failed?**', 'No. Your results remain under review until verification is complete.',
          '', '**Can I refuse a screenshare?**', 'Refusing required verification may result in test invalidation or further investigation.',
          '', '**Can I appeal a decision?**', 'Yes. Appeals may be submitted through official staff channels if you believe a mistake was made.',
          '', '## Example scenario',
          '```', 'Current tier: LT3', 'Opponent tier: LT2', 'Result: Multiple dominant wins', '', 'Outcome:', 'Additional verification may be requested', 'before a tier is assigned.', '```',
          '', '> The purpose of gate keeping is to confirm exceptional performance, not to prevent it.',
        ),
      },
    ],
  },
].map((topic) => ({ ...topic, haystack: `${topic.title} ${topic.summary} ${JSON.stringify(topic.sections)}`.toLowerCase() }));

// ----------------------------------------------------------------------------
// Topic icons (stroke style, same as the rest of the site)
// ----------------------------------------------------------------------------
function TopicIcon({ name }) {
  const props = { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false };
  const icons = {
    servers: (<><rect x="3.5" y="4" width="17" height="6.5" rx="2" /><rect x="3.5" y="13.5" width="17" height="6.5" rx="2" /><path d="M7 7.25h.01M7 16.75h.01" /></>),
    procedures: (<><path d="M9 4.5h6a1 1 0 0 1 1 1V7H8V5.5a1 1 0 0 1 1-1Z" /><path d="M8 6H6.5A1.5 1.5 0 0 0 5 7.5v11A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 17.5 6H16" /><path d="m9 13 2 2 4-4" /></>),
    tiers: (<><path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" /><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" /></>),
    cooldowns: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
    rules: (<><path d="M6.5 4H19v13H6.5A1.5 1.5 0 0 0 5 18.5v-13A1.5 1.5 0 0 1 6.5 4Z" /><path d="M5 18.5A1.5 1.5 0 0 0 6.5 20H19" /></>),
    legal: (<><path d="M12 3.5 5 6v5.5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-2.5Z" /><path d="m9 12 2.2 2.2L15.2 10" /></>),
    gatekeeping: (<><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" /></>),
  };
  return <svg {...props}>{icons[name]}</svg>;
}

// ----------------------------------------------------------------------------
// Address chip: shows an address and copies it on click
// ----------------------------------------------------------------------------
function AddressChip({ value, tag }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard can be unavailable, the address stays selectable */
    }
  };
  return (
    <button type="button" className="addressChip" onClick={copy} aria-label={`Copy ${value}`}>
      <code>{value}</code>
      {tag && <span className="addressTag">{tag}</span>}
      <span className="addressCopy" aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

// Server card: primary, alternate and regional addresses
function ServerCard({ server }) {
  return (
    <div className="serverCard">
      <h6 className="serverName">{server.name}</h6>
      <div className="serverRow">
        <span className="serverLabel">Primary</span>
        <AddressChip value={server.primary} />
      </div>
      {server.alts && (
        <div className="serverRow">
          <span className="serverLabel">Alternate</span>
          {server.alts.length ? server.alts.map((alt) => <AddressChip key={alt} value={alt} />) : <span className="serverNone">None</span>}
        </div>
      )}
      {server.regional && (
        <div className="serverRow">
          <span className="serverLabel">Regional</span>
          {server.regional.map(([address, tag]) => <AddressChip key={address} value={address} tag={tag} />)}
        </div>
      )}
      {server.regions && <p className="serverRegions">{server.regions}</p>}
    </div>
  );
}

// Allowed, banned and at-your-own-risk lists
function LegalColumn({ tone, title, icon, groups }) {
  return (
    <section className="legalCol" data-tone={tone}>
      <h5 className="legalTitle">
        <span className="legalIcon" aria-hidden="true">{icon}</span>
        {title}
      </h5>
      {groups.map((group, index) => (
        <div className="legalGroup" key={group.title || index}>
          {group.title && <h6 className="legalGroupTitle">{group.title}</h6>}
          <div className="chipGrid">
            {group.items.map((item) =>
              typeof item === 'string' ? (
                <span className="infoChip" key={item}>{item}</span>
              ) : (
                <a className="infoChip infoChipLink" key={item.text} href={item.href} target="_blank" rel="noopener noreferrer">{item.text}</a>
              ),
            )}
          </div>
          {group.note && <p className="mdSmall">{group.note}</p>}
        </div>
      ))}
    </section>
  );
}

// One section of a topic (markdown, chips, roles, servers or the legal lists)
function TopicSection({ section, ctx }) {
  if (section.md) return <Md text={section.md} ctx={ctx} />;
  if (section.legal) {
    return (
      <div className="legal">
        <div className="legalColumns">
          <LegalColumn tone="allowed" title="Allowed" icon={<IconCheck size={16} />} groups={section.legal.allowed} />
          <LegalColumn tone="banned" title="Banned" icon={<IconClose size={16} />} groups={section.legal.banned} />
        </div>
        <LegalColumn tone="risk" title="Use at your own risk" icon={<IconInfo size={16} />} groups={[section.legal.risk]} />
      </div>
    );
  }
  return (
    <div className="topicSection">
      {section.title && <h5 className="mdH">{section.title}</h5>}
      {section.chips && <div className="chipGrid">{section.chips.map((chip) => <span className="infoChip" key={chip}>{chip}</span>)}</div>}
      {section.roles && <div className="chipGrid">{section.roles.map((id) => <RoleChip key={id} tone="holo" live roleId={id}>{`@${roleLabels[id]}`}</RoleChip>)}</div>}
      {section.servers && <div className="serverGrid" data-compact={section.compact ? 'true' : undefined}>{section.servers.map((server) => <ServerCard key={server.name} server={server} />)}</div>}
    </div>
  );
}

// ----------------------------------------------------------------------------
// ModalShell: shared dialog (portal, scroll lock, Escape, focus trap)
// ----------------------------------------------------------------------------
function ModalShell({ titleId, title, subtitle, onClose, toolbar, footer, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      const target = dialogRef.current?.querySelector('[data-autofocus]') || dialogRef.current;
      target?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')];
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
      <div className="studioDialog sheetDialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef} onKeyDown={onKeyDown}>
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
// Advanced guide: five embeds plus the two choice buttons
// ----------------------------------------------------------------------------
function AdvancedGuideModal({ ctx, onClose, onChoose }) {
  return (
    <ModalShell
      titleId="advancedGuideTitle"
      title="Advanced guide"
      subtitle="How tier testing works, explained in five short embeds."
      onClose={onClose}
      footer={
        <div className="choiceRow">
          <button type="button" className="choiceButton" data-choice="yes" onClick={() => onChoose('tested')} data-autofocus>
            <span className="choiceIcon"><IconCheck size={20} /></span>
            <span className="choiceText">I have been tested before</span>
          </button>
          <button type="button" className="choiceButton" data-choice="no" onClick={() => onChoose('newbie')}>
            <span className="choiceIcon"><IconClose size={20} /></span>
            <span className="choiceText">I haven&apos;t been tested before</span>
          </button>
        </div>
      }
    >
      {guideEmbeds.map((embed) => (
        <Embed key={embed.title} title={embed.title} art={guideArt[embed.art]}>
          <Md text={embed.text} ctx={ctx} />
        </Embed>
      ))}
    </ModalShell>
  );
}

// "I have been tested before": important information embed
function TestedModal({ ctx, onClose, onBack }) {
  return (
    <ModalShell
      titleId="testedTitle"
      title="Before you request a test"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btnGhost" onClick={onBack} data-autofocus>Back to the guide</button>
          <button type="button" className="btn btnSecondary" onClick={onClose}>Close</button>
        </>
      }
    >
      <Embed title="Important information">
        <Md text={testedText} ctx={ctx} />
      </Embed>
    </ModalShell>
  );
}

// ----------------------------------------------------------------------------
// "I haven't been tested before": searchable information hub with topic cards
// ----------------------------------------------------------------------------
function InfoHub({ ctx, onClose, onBack }) {
  const [query, setQuery] = useState('');
  const [topicId, setTopicId] = useState(null);
  const topic = infoTopics.find((item) => item.id === topicId);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? infoTopics.filter((item) => item.haystack.includes(needle)) : infoTopics;
  }, [query]);

  const toolbar = topic ? (
    <button type="button" className="btn btnGhost btnCompact topicBack" onClick={() => setTopicId(null)} data-autofocus>
      <IconChevron size={16} />
      All topics
    </button>
  ) : (
    <label className="boostField hubSearch">
      <IconSearch size={18} />
      <input className="searchInput" type="text" value={query} placeholder="Search servers, rules, cooldowns..." aria-label="Search the testing information" autoComplete="off" spellCheck={false} data-autofocus onChange={(event) => setQuery(event.target.value)} />
    </label>
  );

  return (
    <ModalShell
      titleId="infoHubTitle"
      title="Testing information"
      subtitle="Everything you need to know before your first test."
      onClose={onClose}
      toolbar={toolbar}
      footer={
        <>
          <button type="button" className="btn btnGhost" onClick={onBack}>Back to the guide</button>
          <button type="button" className="btn btnSecondary" onClick={onClose}>Close</button>
        </>
      }
    >
      {topic ? (
        <Embed title={topic.title}>
          {topic.sections.map((section, index) => (
            <TopicSection key={index} section={section} ctx={ctx} />
          ))}
        </Embed>
      ) : (
        <>
          <Embed title="No problem.">
            <Md
              ctx={ctx}
              text={md(
                'Before requesting your first test, we recommend reviewing the information below.',
                '',
                'The testing information panel contains everything you need to know about supported servers, testing rules, cooldowns, gate keeping, tier assignments and general testing procedures.',
                '',
                '> Understanding the testing process will help ensure a smooth and successful experience.',
              )}
            />
          </Embed>

          {results.length ? (
            <div className="topicGrid">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="topicCard"
                  style={{
                    '--topic-grad': `linear-gradient(135deg, ${item.stops.join(', ')})`,
                    '--topic-ring': `linear-gradient(90deg, ${[...item.stops, ...[...item.stops].reverse().slice(1)].join(', ')})`,
                    '--topic-color': item.stops[0],
                  }}
                  onClick={() => setTopicId(item.id)}
                >
                  <span className="topicIcon"><TopicIcon name={item.icon} /></span>
                  <span className="topicText">
                    <span className="topicTitle">{item.title}</span>
                    <span className="topicSummary">{item.summary}</span>
                  </span>
                  <span className="topicChevron"><IconChevron size={16} /></span>
                </button>
              ))}
            </div>
          ) : (
            <p className="searchState" role="status">No topics match &ldquo;{query.trim()}&rdquo;. Try a server name, a gamemode or a rule.</p>
          )}
        </>
      )}
    </ModalShell>
  );
}

// ----------------------------------------------------------------------------
// Testing guide: three steps, the form preview and the Advanced guide chip
// ----------------------------------------------------------------------------
function TestingGuide({ guildId }) {
  const [view, setView] = useState(null);
  const chipRef = useRef(null);
  const ctx = { guildId };

  // Closing returns focus to the Advanced guide chip
  const close = () => {
    setView(null);
    requestAnimationFrame(() => chipRef.current?.focus());
  };

  return (
    <section className="panel panelGlow" id="testing" aria-labelledby="testingTitle">
      <div className="panelHeader guideHeader">
        <div>
          <h3 id="testingTitle">Testing guide</h3>
          <p className="guideSubtitle">Once you are registered, here is how to get tested.</p>
        </div>
        <button ref={chipRef} type="button" className="mention mentionButton" data-tone="holo" data-flow="live" aria-haspopup="dialog" onClick={() => setView('guide')}>
          <span className="mentionName">Advanced guide</span>
        </button>
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

      {view === 'guide' && <AdvancedGuideModal key="guide" ctx={ctx} onClose={close} onChoose={setView} />}
      {view === 'tested' && <TestedModal key="tested" ctx={ctx} onClose={close} onBack={() => setView('guide')} />}
      {view === 'newbie' && <InfoHub key="newbie" ctx={ctx} onClose={close} onBack={() => setView('guide')} />}
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
