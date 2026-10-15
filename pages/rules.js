// ============================================================================
// rules.js
// Rules page (/rules): red hero, search, exact ban lengths panel, a quick-scroll
// sidebar and three rule categories (Discord, Minecraft and General). Every
// category has three sub-categories with ten expandable rules each.
// The header, footer and search palette come from components/siteShell.js.
// All visual values live in lib/siteDesign.js and styles/rulesStyles.css.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconChevron, IconClose, IconDiscord, IconSearch, SiteShell } from '../components/siteShell';

// ----------------------------------------------------------------------------
// Content: everything the page says lives here so copy is easy to edit
// ----------------------------------------------------------------------------
const content = {
  title: 'Rules | Kyriadon',
  description:
    'The Kyriadon rules for Discord, Minecraft and the community in general: search them, jump between categories and open any rule for the full detail.',
  hero: {
    title: 'Community rules',
    subtitle: 'Keep Kyriadon fair, safe and fun for everyone.',
    body: 'These are the rules for the Kyriadon Discord server, our Minecraft servers and the community as a whole. Search for a topic, jump between categories with the sidebar and open any rule to read it in full.',
  },
  search: {
    placeholder: 'Search rules and topics...',
  },
  bans: {
    title: 'Exact ban lengths',
    description: 'How long each punishment lasts, rule by rule.',
    status: 'Coming soon',
  },
  nav: {
    title: 'Jump to',
  },
};

// Where the Discord terms of service chip leads
const discordTermsUrl = 'https://discord.com/terms';

// How far from the top of the window a rule counts as "current" in the sidebar (px).
// It stays below the scroll margin of the jump targets (see rulesStyles.css).
const SPY_OFFSET = 40;

// ----------------------------------------------------------------------------
// Rules. Each category has three sub-categories, each sub-category ten rules.
// A rule marked as key is highlighted. Ids and numbers are generated below.
// ----------------------------------------------------------------------------
const rule = (title, text, key = false) => ({ title, text, key });

const ruleBook = [
  {
    id: 'discord',
    icon: 'discord',
    name: 'Discord',
    title: 'Discord rules',
    summary: 'How we expect everyone to behave on the Kyriadon Discord server.',
    subs: [
      {
        id: 'respect',
        icon: 'users',
        title: 'Respect and behavior',
        summary: 'Treat every member the way you want to be treated.',
        rules: [
          rule('Be respectful to everyone', 'Treat every member and every staff member with respect. Disagreements are fine, personal attacks are not.', true),
          rule('No harassment or bullying', 'Do not target, pile on or repeatedly pester anyone, in public channels or in direct messages.', true),
          rule('No hate speech', 'Slurs, discrimination and hateful jokes about race, gender, religion, sexuality, disability or nationality are never allowed.', true),
          rule('No threats', 'Threats of violence, doxxing and encouraging self-harm are removed on sight and can lead to an immediate ban.'),
          rule('Keep drama out of chat', 'Settle personal conflicts privately or open a ticket. Do not drag arguments into public channels.'),
          rule('No NSFW content', 'Do not post sexual, graphic or shocking content anywhere on the server, including avatars, nicknames and statuses.'),
          rule('Keep voice chat civil', 'No shouting, soundboards, voice changers or music in voice channels unless everyone in the channel agrees.'),
          rule('English in public channels', 'Use English in public channels so moderators can follow the conversation. Other languages are fine in direct messages.'),
          rule('Respect privacy', "Never share another person's personal information, private messages or screenshots of private chats without their permission."),
          rule('Stop when asked', 'A joke that makes someone uncomfortable stops being a joke once they ask you to stop. Drop it when asked.'),
        ],
      },
      {
        id: 'channels',
        icon: 'hash',
        title: 'Channels and content',
        summary: 'Keep every channel useful and on topic.',
        rules: [
          rule('Use the right channel', 'Post in the channel that fits the topic. Read the channel description before you write.'),
          rule('Stay on topic', 'Keep conversations relevant to the channel. Off-topic chat belongs in the general channels.'),
          rule('No spam', 'Do not flood channels with repeated messages, emojis, stickers, capital letters or mentions.', true),
          rule('No advertising', 'Do not advertise servers, products or social accounts, and do not send unsolicited invites in channels or direct messages.', true),
          rule('Mind your mentions', 'Do not ping staff, roles or everyone without a good reason. Ping a person once and wait for an answer.'),
          rule('Safe links and files', 'Only share links and files you trust. Malware, IP grabbers, scam links and phishing are removed and reported to Discord.', true),
          rule('No leaks or piracy', "Do not share cracked software, leaked content or anything that breaks someone else's copyright."),
          rule('Bot commands in bot channels', 'Use bots only in the channels made for them so conversations stay readable.'),
          rule('Use spoiler tags', 'Mark spoilers, flashing images and sensitive topics so people can choose whether to open them.'),
          rule('Search before you ask', 'Check the pinned messages and the guides on the website before asking. Your answer may already be there.'),
        ],
      },
      {
        id: 'accounts',
        icon: 'idcard',
        title: 'Accounts and staff',
        summary: 'Your profile, tickets and working with the team.',
        rules: [
          rule("Follow Discord's terms", "You must follow Discord's terms of service and community guidelines at all times. You must be at least 13 years old, or the minimum age in your country.", true),
          rule('Keep your profile appropriate', 'Usernames, display names, avatars, banners and bios must follow the rules above. Staff may ask you to change them.'),
          rule('No impersonation', 'Do not pretend to be staff, a creator or another member, and do not copy anyone else\'s name or avatar.', true),
          rule('One account each', 'Use one Discord account. Alternate accounts used to dodge a punishment or inflate numbers are not allowed.'),
          rule('Follow staff instructions', 'Do what staff ask in the moment. If you disagree, comply first and open a ticket afterwards.', true),
          rule('Use tickets for support', 'Need help or want to report something? Open a ticket or contact a staff member instead of posting it in public channels.'),
          rule('Report, do not retaliate', 'If someone breaks a rule, report it. Do not argue with them, call them out in public or act as a moderator yourself.'),
          rule('Do not beg for roles', 'Do not ask staff for roles, permissions or tier changes. Roles are earned through registration and testing.'),
          rule('Respect direct messages', 'Do not send unwanted direct messages. If someone asks you to stop, stop. These rules apply to direct messages too.'),
          rule('Perks are not immunity', 'Boosters and supporters follow exactly the same rules as everyone else. Perks never protect against moderation.'),
        ],
      },
    ],
  },
  {
    id: 'minecraft',
    icon: 'cube',
    name: 'Minecraft',
    title: 'Minecraft rules',
    summary: 'Fair play, testing conduct and how to behave on our servers.',
    subs: [
      {
        id: 'fair-play',
        icon: 'shield',
        title: 'Fair play',
        summary: 'Win with skill, not software.',
        rules: [
          rule('No cheats', 'No hacked clients, autoclickers, reach, velocity, aimbot, triggerbot or any other advantage that normal gameplay does not give you.', true),
          rule('Only allowed mods', 'Only use mods from the allowed list. If a mod is not listed or you are unsure, ask staff before you join.', true),
          rule('No macros or scripts', 'Macros, key bindings that automate several actions and any scripted input are not allowed.'),
          rule('No exploits or bugs', 'Do not abuse glitches, duplication or unintended mechanics. Report them to staff instead.', true),
          rule('No ghosting or sniping', "Do not use outside information about an opponent's position or plans, such as spectating, stream watching or voice chat leaks."),
          rule('Vanilla visuals only', 'Resource packs and settings that change hitboxes, remove blocks or show more than vanilla does are not allowed.'),
          rule('Be honest about your setup', 'Tell testers and staff the truth about your ping, device, client and settings when asked.'),
          rule('Accept screenshares', 'Staff may ask for a screenshare or a recording. Refusing, stalling or leaving during a check counts as a failed check.', true),
          rule('Do not tamper with evidence', 'Do not delete files, close programs or change your setup after you have been asked to screenshare.'),
          rule('No selling or sharing cheats', 'Do not promote, sell, share or recommend cheats or cheat clients, including in direct messages.'),
        ],
      },
      {
        id: 'testing',
        icon: 'layers',
        title: 'Tier testing',
        summary: 'How to behave when you are being tested.',
        rules: [
          rule('Register first', 'Complete registration with /register and verify on the website before you queue for a test.', true),
          rule('Use your own account', 'Test on the account that is linked to you. Never test for someone else, and never let someone else test for you.', true),
          rule('Choose the right options', 'Pick your real region, gamemode and version in the form. Wrong details waste testers\' time and can void the result.'),
          rule('Be ready when called', 'When a tester accepts you, be online and ready. Missing your slot can cost you your place in the queue.'),
          rule('Wait your turn', 'The queue has a limited number of slots. Do not spam testers or try to skip the line.'),
          rule('Respect the testers', 'Testers give their time for free. Be polite, thank them and accept the result without arguing during the match.'),
          rule('No dodging or stalling', 'Do not leave, crash or stall a match to avoid losing. Dodging counts as a loss.', true),
          rule('No rigging or boosting', 'Do not arrange results, trade wins or play with friends to get a better tier. Results must be genuine.', true),
          rule('Cooldowns apply', 'After a test you must wait for the cooldown before testing again. Trying to bypass it can cancel your result.'),
          rule('Appeal through staff', 'If you think a result was wrong, ask in a ticket and include details. Public complaints do not change results.'),
        ],
      },
      {
        id: 'servers',
        icon: 'cube',
        title: 'Server conduct',
        summary: 'Behavior on the Minecraft servers themselves.',
        rules: [
          rule('Keep chat clean', 'The Discord respect rules apply to in-game chat, signs, books, names and skins too.', true),
          rule('No griefing', "Do not destroy, steal from or ruin other players' builds, items or matches."),
          rule('No spawn camping', 'Do not repeatedly kill players who are respawning or entering a match.'),
          rule('Team only when allowed', 'Only team up in modes that allow it. Do not work with opponents to farm kills or wins.'),
          rule('No leaderboard abuse', 'Do not farm kills, wins or points with alternate accounts or friends.'),
          rule('Do not waste staff time', 'No fake reports, spam commands or false alarms to staff in game.'),
          rule('No lag machines', 'Lag machines, crash devices and anything else that slows the server down for other players are not allowed.', true),
          rule('No real-money deals', 'Do not buy, sell or trade accounts, items, ranks or tiers for real money or outside currency.', true),
          rule('Join the right server', 'Join the server and gamemode you were assigned and follow the specific rules of each mode.'),
          rule('Follow event hosts', 'Follow instructions from staff, referees and event hosts during matches and events.'),
        ],
      },
    ],
  },
  {
    id: 'general',
    icon: 'shield',
    name: 'General',
    title: 'General rules',
    summary: 'The rules that apply everywhere Kyriadon exists: Discord, Minecraft, YouTube and this website.',
    subs: [
      {
        id: 'principles',
        icon: 'scale',
        title: 'Core principles',
        summary: 'The spirit behind every other rule.',
        rules: [
          rule('Treat people well', 'Everything else is built on this. Be kind, patient and fair with everyone you meet in the community.', true),
          rule('Fair play comes first', 'Competition is welcome, cheating is not. A win only counts if it was earned honestly.', true),
          rule('Follow the spirit, not just the letter', 'Looking for loopholes is still breaking the rules. Staff decide what the spirit of a rule is.', true),
          rule('Staff have the final say', 'Moderators make the final call in the moment. Disagreements are handled afterwards in a ticket, not in an argument.'),
          rule('Keep it suitable for everyone', 'The community includes younger members. Keep language, jokes and content suitable for all of them.'),
          rule('Be honest', 'Do not lie to staff, testers or members. Lying during an investigation is treated as seriously as the original offense.'),
          rule('Take responsibility', 'You are responsible for your account and everything done through it, including by friends or family.'),
          rule('Help others', 'Newcomers are welcome. Answer questions kindly and point people to the guides instead of mocking them.'),
          rule('Leave outside drama outside', 'Keep conflicts from other servers, games and personal feuds out of Kyriadon.'),
          rule('Represent the community well', 'Your behavior in public reflects on all of us. Do not use the Kyriadon name to harm others or mislead people.'),
        ],
      },
      {
        id: 'integrity',
        icon: 'usercheck',
        title: 'Accounts and integrity',
        summary: 'Who you are and how your account is used.',
        rules: [
          rule('Register honestly', 'Use your own Minecraft and Discord accounts when you register. Do not link accounts that belong to someone else.', true),
          rule('One person, one account', 'Alternate accounts used to avoid a punishment, a cooldown or a tier decision are not allowed.', true),
          rule('Never share your account', 'Do not give your account, session or login to anyone, and never log in for someone else.'),
          rule('Keep your details current', 'If you change your Minecraft name or Discord account, tell staff so your tier and records stay correct.'),
          rule('No false affiliation', 'Do not claim to represent Kyriadon, its staff or its servers without permission.'),
          rule('Tiers and roles are personal', 'Tiers, roles and perks belong to the person who earned them and cannot be transferred or traded.'),
          rule('Protect your login', 'Only log in with Discord on the official website address. Staff will never ask for your password or login codes.', true),
          rule('Report compromised accounts', 'If your account is hacked, tell staff right away. Actions taken from a compromised account can still count against you until it is reported.'),
          rule("Respect other people's data", 'Do not collect, leak or misuse member information, usernames or IDs from the website or the Discord server.'),
          rule('Give accurate information', 'Information you give staff, in forms or in tickets must be accurate. False details can cancel your registration.'),
        ],
      },
      {
        id: 'enforcement',
        icon: 'gavel',
        title: 'Enforcement and appeals',
        summary: 'What happens when a rule is broken.',
        rules: [
          rule('Rules apply to everyone', 'Staff, boosters, creators and long-time members follow the same rules as new members.', true),
          rule('Punishments scale', 'Staff choose a warning, mute, kick or ban based on severity, intent and history. Serious offenses can skip warnings.', true),
          rule('Ban evasion is serious', 'Joining on another account to get around a ban extends or upgrades the original punishment.', true),
          rule('Ignorance is no excuse', 'By joining Kyriadon you agree to read and follow these rules, including any updates.'),
          rule('Rules can change', 'Rules can be updated at any time. Major changes are announced, and the version on this page is always the current one.'),
          rule('How to report', 'Report rule breaking with a ticket or to a staff member, and include screenshots, clips, names and times.'),
          rule('Evidence matters', 'Staff act on evidence. Keep proof of what happened and never edit or crop it in a misleading way.'),
          rule('How appeals work', 'You can appeal a punishment once, through the official staff channels. Be honest, specific and polite.'),
          rule('No public callouts', 'Do not post punishment evidence, accusations or callouts in public. Use reports and appeals instead.'),
          rule('Staff are accountable', 'If a staff member breaks the rules, report it to another staff member or an admin. Abuse of power is taken seriously.'),
        ],
      },
    ],
  },
];

// ----------------------------------------------------------------------------
// Derived data: ids, numbers, counts and a lowercase search haystack per rule.
// Ids are used for the sidebar, scroll spy and deep links (/rules#discord-respect-1).
// ----------------------------------------------------------------------------
const categories = ruleBook.map((category) => {
  const subs = category.subs.map((sub, subIndex) => {
    const subId = `${category.id}-${sub.id}`;
    const rules = sub.rules.map((item, ruleIndex) => ({
      ...item,
      id: `${subId}-${ruleIndex + 1}`,
      number: ruleIndex + 1,
      textLower: item.text.toLowerCase(),
      haystack: `${category.name} ${category.title} ${sub.title} ${item.title} ${item.text}`.toLowerCase(),
    }));
    return { ...sub, id: subId, slot: subIndex + 1, count: rules.length, rules };
  });
  const count = subs.reduce((total, sub) => total + sub.count, 0);
  return { ...category, subs, count };
});

const totalRules = categories.reduce((total, category) => total + category.count, 0);
const ruleIds = new Set(categories.flatMap((category) => category.subs.flatMap((sub) => sub.rules.map((item) => item.id))));

const pad = (value) => String(value).padStart(2, '0');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const splitWords = (query) => query.trim().toLowerCase().split(/\s+/).filter(Boolean);
const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

// ----------------------------------------------------------------------------
// Highlight: wraps search matches in the same purple highlight as the debug logs
// ----------------------------------------------------------------------------
function Highlight({ text, query }) {
  const words = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (!words.length || !text) return text || null;
  return String(text)
    .split(new RegExp(`(${words.join('|')})`, 'ig'))
    .map((part, index) => (index % 2 ? <mark className="logHl" key={index}>{part}</mark> : part));
}

// ----------------------------------------------------------------------------
// Icons (stroke style, same as the topic icons on the About page). The Discord mark
// comes from the shared shell.
// ----------------------------------------------------------------------------
function RuleIcon({ name, size = 22 }) {
  if (name === 'discord') return <IconDiscord size={size} />;
  const props = { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false };
  const icons = {
    users: (<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.5-3 2.8-4.7 5.5-4.7s5 1.7 5.5 4.7" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 14.6c1.9.5 3.1 2 3.5 4.4" /></>),
    hash: (<path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15M4 15h15" />),
    idcard: (<><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><circle cx="9" cy="11" r="2" /><path d="M6 16.2c.4-1.5 1.6-2.2 3-2.2s2.6.7 3 2.2M14.5 10.5H18M14.5 14H18" /></>),
    shield: (<><path d="M12 3.5 5 6v5.5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-2.5Z" /><path d="m9 12 2.2 2.2L15.2 10" /></>),
    layers: (<><path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" /><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" /></>),
    cube: (<><path d="M12 3.5 19.5 7.7v8.6L12 20.5l-7.5-4.2V7.7L12 3.5Z" /><path d="M12 12v8.5M4.5 7.7 12 12l7.5-4.3" /></>),
    scale: (<><path d="M12 4v16M8 20h8M5 7.5h14" /><path d="m5 7.5-2.5 6a3 3 0 0 0 5 0L5 7.5ZM19 7.5l-2.5 6a3 3 0 0 0 5 0L19 7.5Z" /></>),
    usercheck: (<><circle cx="10" cy="8" r="3.2" /><path d="M4 19.5c.5-3.2 2.9-5 6-5 1.3 0 2.4.3 3.4.8" /><path d="m15.5 17.5 2 2 3.5-3.8" /></>),
    gavel: <GavelShapes />,
  };
  return <svg {...props}>{icons[name]}</svg>;
}

// Ban hammer (gavel): head, handle and the sound block
function GavelShapes() {
  return (
    <>
      <rect x="8.6" y="3.4" width="11.6" height="6.2" rx="1.8" transform="rotate(45 14.4 6.5)" />
      <path d="m11.2 10.8-7 7a1.7 1.7 0 0 0 2.4 2.4l7-7" />
      <path d="M14.5 20.5h6" />
    </>
  );
}

// ----------------------------------------------------------------------------
// Panel art: one enlarged illustration per category, drawn in the category colours
// and cropped by the lower right edge of its panel (decorative).
// ----------------------------------------------------------------------------

// Minecraft: an isometric block built from small tiles, lighter on top, darker on the right
const BLOCK_FACES = [
  { origin: [12, 33], u: [48, -27], v: [48, 27], base: 0.6 },
  { origin: [12, 33], u: [48, 27], v: [0, 54], base: 0.36 },
  { origin: [60, 60], u: [48, -27], v: [0, 54], base: 0.2 },
];
const BLOCK_TILES = 4;

function BlockArt() {
  const step = 1 / BLOCK_TILES;
  const tiles = BLOCK_FACES.flatMap((face, faceIndex) =>
    Array.from({ length: BLOCK_TILES * BLOCK_TILES }, (_, index) => {
      const column = index % BLOCK_TILES;
      const row = Math.floor(index / BLOCK_TILES);
      const point = (a, b) => [face.origin[0] + face.u[0] * a + face.v[0] * b, face.origin[1] + face.u[1] * a + face.v[1] * b].map((value) => value.toFixed(2)).join(' ');
      const a = column * step;
      const b = row * step;
      const shade = ((column * 5 + row * 3 + column * row + faceIndex * 2) % 4) * 0.09;
      return <polygon key={`${faceIndex}-${index}`} points={[point(a, b), point(a + step, b), point(a + step, b + step), point(a, b + step)].join(' ')} fill="currentColor" fillOpacity={(face.base + shade).toFixed(2)} stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" strokeLinejoin="round" />;
    }),
  );
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {tiles}
    </svg>
  );
}

// General: a shield with a check, two outlines deep
function ShieldArt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3.5 5 6v5.5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-2.5Z" fill="currentColor" fillOpacity="0.16" strokeWidth="0.8" />
      <path d="M12 6 7.5 7.6v3.9c0 2.8 1.9 4.9 4.5 6 2.6-1.1 4.5-3.2 4.5-6V7.6L12 6Z" strokeWidth="0.6" strokeOpacity="0.7" />
      <path d="m9.2 11.9 2 2 3.8-3.9" strokeWidth="1.1" />
    </svg>
  );
}

function CategoryArt({ id }) {
  if (id === 'discord') return <IconDiscord size={240} />;
  if (id === 'minecraft') return <BlockArt />;
  return <ShieldArt />;
}

// ----------------------------------------------------------------------------
// Ban hammer panel: placeholder for the exact ban lengths (does nothing for now)
// ----------------------------------------------------------------------------
function BanLengthsPanel() {
  return (
    <section className="panel panelGlow areaBans rulesBan" aria-labelledby="bansTitle">
      <span className="topicIcon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <GavelShapes />
        </svg>
      </span>
      <div className="rulesBanText">
        <h3 id="bansTitle">{content.bans.title}</h3>
        <p className="guideSubtitle">{content.bans.description}</p>
      </div>
      <span className="badge" data-tone="neutral">
        {content.bans.status}
      </span>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Rule: one expandable card. The heading holds the toggle button (ARIA accordion).
// ----------------------------------------------------------------------------
function RuleItem({ item, open, query, onToggle }) {
  return (
    <li className="ruleItem" id={item.id} data-key={item.key ? 'true' : undefined} data-open={open}>
      <h4 className="ruleHeading">
        <button type="button" id={`${item.id}-toggle`} className="ruleToggle" aria-expanded={open} aria-controls={`${item.id}-body`} onClick={() => onToggle(item.id, open)}>
          <span className="ruleNumber">{pad(item.number)}</span>
          <span className="ruleTitle">
            <Highlight text={item.title} query={query} />
          </span>
          {item.key && <span className="badge ruleKey">Key rule</span>}
          <span className="ruleChevron" aria-hidden="true">
            <IconChevron />
          </span>
        </button>
      </h4>
      <div className="ruleBody" id={`${item.id}-body`} role="region" aria-labelledby={`${item.id}-toggle`}>
        <div className="ruleBodyInner">
          <p className="ruleText">
            <Highlight text={item.text} query={query} />
          </p>
        </div>
      </div>
    </li>
  );
}

// ----------------------------------------------------------------------------
// Sub-category: a panel with its ten rules, tinted with the category family in its
// own accent
// ----------------------------------------------------------------------------
function RuleGroup({ sub, filtering, isOpen, query, onToggle }) {
  return (
    <section className="panel panelGlow ruleGroup" id={sub.id} data-slot={sub.slot} aria-labelledby={`${sub.id}Title`}>
      <div className="panelHeader guideHeader">
        <div className="ruleGroupHead">
          <span className="topicIcon" aria-hidden="true">
            <RuleIcon name={sub.icon} />
          </span>
          <div>
            <h3 id={`${sub.id}Title`}>
              <Highlight text={sub.title} query={query} />
            </h3>
            <p className="guideSubtitle">{sub.summary}</p>
          </div>
        </div>
        <span className="badge" data-tone="neutral">
          {filtering ? `${sub.rules.length} of ${sub.count}` : plural(sub.count, 'rule')}
        </span>
      </div>

      <ul className="ruleList" role="list" data-nolog>
        {sub.rules.map((item) => (
          <RuleItem key={item.id} item={item} open={isOpen(item)} query={query} onToggle={onToggle} />
        ))}
      </ul>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Category: gradient panel with the enlarged art in its lower right corner, then the
// three sub-categories. Discord also carries the terms of service chip.
// ----------------------------------------------------------------------------
function RuleCategory({ category, filtering, isOpen, query, onToggle }) {
  return (
    <section className="ruleCategory" id={category.id} data-category={category.id} aria-labelledby={`${category.id}Title`}>
      <div className="panel panelGlow ruleHead">
        <div className="ruleBackdrop" aria-hidden="true">
          <div className="ruleGlow" />
          <div className="ruleArt">
            <CategoryArt id={category.id} />
          </div>
        </div>

        <div className="ruleHeadBody">
          <div className="ruleHeadTop">
            <span className="topicIcon" aria-hidden="true">
              <RuleIcon name={category.icon} />
            </span>
            <div className="ruleHeadText">
              <h2 id={`${category.id}Title`}>
                <Highlight text={category.title} query={query} />
              </h2>
              <p className="ruleHeadSummary">{category.summary}</p>
            </div>
          </div>

          <div className="ruleHeadMeta">
            <span className="badge" data-tone="neutral">
              {plural(category.subs.length, 'sub-category', 'sub-categories')}
            </span>
            <span className="badge" data-tone="neutral">
              {filtering ? `${category.shown} of ${category.count} rules` : plural(category.count, 'rule')}
            </span>
            <span className="badge" data-tone="neutral">
              {plural(category.keys, 'key rule')}
            </span>
          </div>

          {category.id === 'discord' && (
            <p className="ruleNote">
              Discord&apos;s own rules always apply too:
              <a className="mention" data-tone="discord" href={discordTermsUrl} target="_blank" rel="noopener noreferrer">
                <span className="mentionName">
                  <IconDiscord size={14} />
                  Discord terms of service
                </span>
              </a>
            </p>
          )}
        </div>
      </div>

      {category.subs.map((sub) => (
        <RuleGroup key={sub.id} sub={sub} filtering={filtering} isOpen={isOpen} query={query} onToggle={onToggle} />
      ))}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Sidebar: quick scroll through categories, sub-categories and single rules. The
// category and sub-category you are reading stay open, the rest stay folded.
// ----------------------------------------------------------------------------
function RulesNav({ view, query, active, navRef, onJump }) {
  const activeCategory = active?.category ?? view[0]?.id;
  const activeSub = active?.sub ?? (active ? null : view[0]?.subs[0]?.id);

  return (
    <aside className="rulesSide">
      <nav className="panel panelGlow rulesNav" aria-labelledby="rulesNavTitle" data-nolog>
        <div className="panelHeader">
          <h3 id="rulesNavTitle">{content.nav.title}</h3>
        </div>

        <div className="navScroll" ref={navRef}>
          <ul className="navCats" role="list">
            {view.map((category) => {
              const categoryOpen = category.id === activeCategory;
              return (
                <li key={category.id} data-category={category.id} data-active={categoryOpen}>
                  <a
                    id={`nav-${category.id}`}
                    className="linkRow navCat"
                    href={`#${category.id}`}
                    aria-current={active?.id === category.id ? 'location' : undefined}
                    onClick={() => onJump({ id: category.id, category: category.id })}
                  >
                    <span className="linkIcon navCatIcon">
                      <RuleIcon name={category.icon} size={18} />
                    </span>
                    <span className="linkText">
                      <span className="linkTitle">
                        <Highlight text={category.name} query={query} />
                      </span>
                      <span className="linkDesc">{plural(category.shown, 'rule')}</span>
                    </span>
                    <span className="linkChevron navChevron">
                      <IconChevron />
                    </span>
                  </a>

                  {categoryOpen && (
                    <ul className="navSubs" role="list">
                      {category.subs.map((sub) => {
                        const subOpen = sub.id === activeSub;
                        return (
                          <li key={sub.id} data-slot={sub.slot} data-active={subOpen}>
                            <a
                              id={`nav-${sub.id}`}
                              className="navSub"
                              href={`#${sub.id}`}
                              aria-current={active?.id === sub.id ? 'location' : undefined}
                              onClick={() => onJump({ id: sub.id, category: category.id, sub: sub.id })}
                            >
                              <span className="navLabel">
                                <Highlight text={sub.title} query={query} />
                              </span>
                              <span className="navCount">{sub.rules.length}</span>
                            </a>

                            {subOpen && (
                              <ul className="navRules" role="list">
                                {sub.rules.map((item) => (
                                  <li key={item.id}>
                                    <a
                                      id={`nav-${item.id}`}
                                      className="navRule"
                                      href={`#${item.id}`}
                                      aria-current={active?.id === item.id ? 'location' : undefined}
                                      onClick={() => onJump({ id: item.id, category: category.id, sub: sub.id, rule: item.id }, true)}
                                    >
                                      <span className="navRuleNumber">{pad(item.number)}</span>
                                      <span className="navLabel">
                                        <Highlight text={item.title} query={query} />
                                      </span>
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </aside>
  );
}

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------
export default function Rules() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({});
  const [active, setActive] = useState(null);
  const navRef = useRef(null);
  const lockRef = useRef(0);

  const words = useMemo(() => splitWords(query), [query]);
  const filtering = words.length > 0;

  // A rule matches when every search word appears in its category, sub-category, title or text.
  // While searching, rules whose text matches open by themselves so the highlight is visible.
  const view = useMemo(
    () =>
      categories
        .map((category) => {
          const subs = category.subs
            .map((sub) => ({
              ...sub,
              rules: sub.rules
                .filter((item) => words.every((word) => item.haystack.includes(word)))
                .map((item) => ({ ...item, auto: filtering && words.some((word) => item.textLower.includes(word)) })),
            }))
            .filter((sub) => sub.rules.length > 0);
          const rules = subs.flatMap((sub) => sub.rules);
          return { ...category, subs, shown: rules.length, keys: rules.filter((item) => item.key).length };
        })
        .filter((category) => category.subs.length > 0),
    [words, filtering],
  );

  const shown = view.reduce((total, category) => total + category.shown, 0);

  // Your own toggles win over the automatic opening while searching
  const isOpen = useCallback((item) => open[item.id] ?? item.auto, [open]);
  const toggle = useCallback((id, current) => setOpen((previous) => ({ ...previous, [id]: !current })), []);

  // Deep links: /rules#discord-respect-1 opens that rule
  useEffect(() => {
    const apply = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (ruleIds.has(id)) setOpen((previous) => ({ ...previous, [id]: true }));
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  // Sidebar scroll spy: the last category, sub-category or rule that has reached the top of
  // the window is the current one. Entries are in document order, so the loop can stop early.
  const spyList = useMemo(
    () =>
      view.flatMap((category) => [
        { id: category.id, category: category.id },
        ...category.subs.flatMap((sub) => [
          { id: sub.id, category: category.id, sub: sub.id },
          ...sub.rules.map((item) => ({ id: item.id, category: category.id, sub: sub.id, rule: item.id })),
        ]),
      ]),
    [view],
  );

  useEffect(() => {
    let ticking = false;

    const update = () => {
      ticking = false;
      // Right after a sidebar click the page is still scrolling, so the click decides
      if (Date.now() < lockRef.current) return;
      let current = null;
      for (const entry of spyList) {
        const element = document.getElementById(entry.id);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= SPY_OFFSET) current = entry;
        else break;
      }
      setActive((previous) => (previous?.id === current?.id ? previous : current));
    };

    // Throttled to one update per animation frame
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [spyList]);

  // Keep the current sidebar entry in view inside the sidebar's own scroll area
  useEffect(() => {
    const box = navRef.current;
    const element = active ? document.getElementById(`nav-${active.id}`) : null;
    if (!box || !element) return;
    const inner = element.getBoundingClientRect();
    const outer = box.getBoundingClientRect();
    if (inner.top < outer.top) box.scrollTop -= outer.top - inner.top + 8;
    else if (inner.bottom > outer.bottom) box.scrollTop += inner.bottom - outer.bottom + 8;
  }, [active]);

  // Sidebar click: the browser scrolls to the anchor, the click sets the current entry and
  // single rules also open. The scroll spy rests while the page scrolls there.
  const jump = useCallback((entry, openRule = false) => {
    lockRef.current = Date.now() + 900;
    setActive(entry);
    if (openRule) setOpen((previous) => ({ ...previous, [entry.id]: true }));
    setTimeout(() => window.dispatchEvent(new Event('scroll')), 950);
  }, []);

  return (
    <SiteShell title={content.title} description={content.description}>
      <div className="rulesGrid">
        {/* Hero: same component as the home, about and debug pages, red tone */}
        <section className="heroShell areaHero" aria-labelledby="heroTitle">
          <div className="heroPanel" data-tone="red">
            <div className="heroGlow" aria-hidden="true" />
            <div className="heroContent">
              <h1 id="heroTitle">{content.hero.title}</h1>
              <h2>{content.hero.subtitle}</h2>
              <p>{content.hero.body}</p>
            </div>
          </div>
        </section>

        {/* Search: filters every category, sub-category and rule, matches in purple */}
        <div className="areaSearch">
          <label className="boostField rulesSearch">
            <IconSearch size={18} />
            <input
              className="searchInput"
              type="text"
              value={query}
              placeholder={content.search.placeholder}
              aria-label="Search the rules"
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
              data-nolog
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && query) setQuery('');
              }}
            />
            <span className="boostCount" role="status">
              {shown} of {totalRules}
            </span>
            {query && (
              <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={() => setQuery('')} aria-label="Clear search" data-nolog>
                <IconClose size={16} />
              </button>
            )}
          </label>
        </div>

        <BanLengthsPanel />

        <RulesNav view={view} query={query} active={active} navRef={navRef} onJump={jump} />

        <div className="rulesMain">
          {view.map((category) => (
            <RuleCategory key={category.id} category={category} filtering={filtering} isOpen={isOpen} query={query} onToggle={toggle} />
          ))}

          {view.length === 0 && (
            <div className="stateBox" role="status">
              <span>No rules match &ldquo;{query.trim()}&rdquo;. Try a different word or a category name.</span>
              <button type="button" className="btn btnSecondary btnCompact" onClick={() => setQuery('')} data-nolog>
                Clear search
              </button>
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
