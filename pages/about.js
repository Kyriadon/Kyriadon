// ============================================================================
// about.js
// About page (/about): purple hero, Discord server panel, registration guide,
// help panel and testing guide.
// The header, footer and search palette come from components/siteShell.js.
// All visual values live in lib/siteDesign.js and styles/aboutStyles.css.
// ============================================================================
import Link from 'next/link';
import { useState } from 'react';
import {
  IconBook,
  IconChevron,
  IconChevronDown,
  IconClose,
  IconDiscord,
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
  title: 'About | Kyriadon',
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
  testing: '',
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
          <HelpPanel />
          <TestingGuide guildId={discord?.guildId} />
        </div>
      </div>
    </SiteShell>
  );
}
