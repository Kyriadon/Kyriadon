// ============================================================================
// punishments.js
// Punishments page (/rules/punishments): crimson hero (a deeper red, it is a sub page of Rules), search, a quick-scroll sidebar,
// the golden Screenshare procedure charter and four main categories, every offense
// as a full embed with its exact punishment ladder.
// The header, footer and search palette come from components/siteShell.js. The
// panels, chips, embeds and sidebar reuse the rules page and About page styles.
// All wording lives in components/punishmentsContent.js (with punishmentsCharter.js and
// punishmentsOffenses.js beside it), all visual values in lib/siteDesign.js and
// styles/punishmentsStyles.css.
// ============================================================================
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BlockArt, CrosshairArt, GavelIcon, MonitorArt, RuleIcon, ShieldArt } from '../../components/ruleArt';
import { CopyButton, Highlight, Inline, Md, Mention, useScrollSpy } from '../../components/guideKit';
import { IconChevron, IconClose, IconDiscord, IconSearch, SiteShell, siteLinks, useFetch } from '../../components/siteShell';
import { content, directory, kinds, levels, sections } from '../../components/punishmentsContent';

// How far from the top of the window an entry counts as "current" in the sidebar (px).
// It stays below the scroll margin of the jump targets (see punishmentsStyles.css).
const SPY_OFFSET = 40;

const pad = (value) => String(value).padStart(2, '0');
const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;
const splitWords = (query) => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

// Dates are written in UTC so the server and the browser always agree
const formatDate = (iso) => new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const hostOf = (href) => new URL(href).hostname.replace(/^www\./, '');

// ----------------------------------------------------------------------------
// Derived data: ids, numbers, accent slots and a lowercase search haystack per embed.
// Ids are used for the sidebar, the scroll spy and deep links (/rules/punishments#cheating-clients).
// ----------------------------------------------------------------------------
// Chips and formatting marks are removed so search matches the words people read
const plainText = (value) =>
  value
    .replace(/<(?:#|@&)([a-z0-9-]+)>/g, (match, key) => directory.channels[key]?.label || directory.roles[key]?.label || key)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_=]/g, '');

const describeKind = (step) => `${kinds[step.kind].label} ${step.length || ''}`;

function blockText(block) {
  switch (block.type) {
    case 'md':
      return plainText(block.text);
    case 'ladder':
      return block.rows.map((item) => `${item.label} ${item.steps.map(describeKind).join(' ')} ${item.note || ''}`).join(' ');
    case 'facts':
      return block.items.map(([label, value]) => `${label} ${plainText(value)}`).join(' ');
    case 'terms':
      return block.items.map((item) => `${item.badge.label} ${plainText(item.text)}`).join(' ');
    case 'steps':
      return block.items.map((item) => `${plainText(item.title)} ${plainText(item.text)}`).join(' ');
    case 'tools':
      return block.items.map((item) => `${item.name} ${item.kind} ${plainText(item.text)} ${plainText(item.looks)}`).join(' ');
    case 'commands':
      return block.groups.flatMap((group) => group.items.map((item) => `${item.cmd} ${plainText(item.does)} ${plainText(item.looks)} ${item.flags.join(' ')}`)).join(' ');
    default:
      return '';
  }
}

const model = sections.map((section) => {
  const entries = section.entries.map((item, index) => ({
    ...item,
    id: `${section.id}-${item.slug}`,
    number: index + 1,
    // Each embed takes one of the three accents of its category family
    slot: (index % 3) + 1,
    haystack: `${section.name} ${section.title} ${item.title} ${item.level ? levels[item.level].label : ''} ${item.blocks.map(blockText).join(' ')}`.toLowerCase(),
  }));
  return { ...section, entries, count: entries.length };
});

const totalEntries = model.reduce((total, section) => total + section.count, 0);

// ----------------------------------------------------------------------------
// Panel art: the same enlarged illustration language as the rules page
// ----------------------------------------------------------------------------
function SectionArt({ id }) {
  if (id === 'discord') return <IconDiscord size={240} />;
  if (id === 'minecraft') return <BlockArt />;
  if (id === 'cheating') return <CrosshairArt />;
  if (id === 'charter') return <MonitorArt />;
  if (id === 'general') return <ShieldArt />;
  return <GavelIcon size={240} />;
}

// ----------------------------------------------------------------------------
// Badges: a punishment kind with its exact length, and a severity level. Both always
// carry a text label, colour is never the only signal.
// ----------------------------------------------------------------------------
function PunishBadge({ step }) {
  const kind = kinds[step.kind];
  return (
    <span className="badge punishBadge" data-tone={kind.tone}>
      {kind.label}
      {step.length && <span className="punishLength">{step.length}</span>}
    </span>
  );
}

function LevelBadge({ level }) {
  const item = levels[level];
  return (
    <span className="badge" data-tone={item.tone}>
      {item.label}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Blocks: the building parts of an embed. Content decides which ones an embed uses.
// ----------------------------------------------------------------------------
function Ladder({ rows }) {
  return (
    <ol className="punishLadder" role="list">
      {rows.map((item) => (
        <li className="punishStep" key={item.label}>
          <span className="punishStepLabel">{item.label}</span>
          <span className="punishStepKinds">
            {item.steps.map((step) => (
              <PunishBadge step={step} key={`${step.kind}-${step.length || ''}`} />
            ))}
          </span>
          {item.note && <span className="punishStepNote">{item.note}</span>}
        </li>
      ))}
    </ol>
  );
}

function Facts({ items, ctx, query }) {
  return (
    <dl className="punishFacts">
      {items.map(([label, value]) => (
        <div className="punishFact" key={label}>
          <dt>{label}</dt>
          <dd>
            <Inline text={value} ctx={ctx} query={query} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

// A role badge: the pill of every other badge, painted with the role's own gradient, so the
// badges in the Definitions match the role chips in the text (colours: punishmentRoles in siteDesign.js)
function RoleBadge({ role, label }) {
  return (
    <span className="badge" data-tone="role" style={{ '--role-color': role.color, '--role-gradient': role.gradient }}>
      <span className="badgeRoleText">{label}</span>
    </span>
  );
}

function Terms({ items, ctx, query }) {
  return (
    <ul className="punishTerms" role="list">
      {items.map((item) => (
        <li className="punishTerm" key={item.badge.label}>
          {directory.roles[item.badge.tone] ? (
            <RoleBadge role={directory.roles[item.badge.tone]} label={item.badge.label} />
          ) : (
            <span className="badge" data-tone={item.badge.tone}>
              {item.badge.label}
            </span>
          )}
          <span className="punishTermText">
            <Inline text={item.text} ctx={ctx} query={query} />
          </span>
        </li>
      ))}
    </ul>
  );
}

// Same numbered steps with a connector line as the guides on the About page
function Steps({ items, ctx, query }) {
  return (
    <ol className="guideSteps punishSteps">
      {items.map((item, index) => (
        <li className="guideStep" key={item.title}>
          <span className="guideMarker" aria-hidden="true">
            {index + 1}
          </span>
          <div className="guideBody">
            <h4 className="guideTitle">
              <Inline text={item.title} ctx={ctx} query={query} />
            </h4>
            <Md text={item.text} ctx={ctx} query={query} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tools({ items, ctx, query }) {
  return (
    <ul className="punishTools" role="list">
      {items.map((tool) => (
        <li className="punishTool" key={tool.name}>
          <div className="punishToolHead">
            <h4 className="punishToolName">
              <Highlight text={tool.name} query={query} />
            </h4>
            <span className="badge" data-tone="neutral">
              {tool.kind}
            </span>
            {tool.href && (
              <Mention tone={tool.tone || 'site'} href={tool.href}>
                {hostOf(tool.href)}
              </Mention>
            )}
          </div>
          <Md text={tool.text} ctx={ctx} query={query} />
          <p className="punishDetail">
            <span className="punishLabel">In practice</span>
            <Inline text={tool.looks} ctx={ctx} query={query} />
          </p>
        </li>
      ))}
    </ul>
  );
}

function Commands({ groups, ctx, query }) {
  return (
    <div className="punishCommands">
      {groups.map((group) => (
        <section className="punishCmdGroup" key={group.title} aria-label={group.title}>
          <div className="punishCmdGroupHead">
            <h4>{group.title}</h4>
            <span className="badge" data-tone="neutral">
              {group.hint}
            </span>
          </div>
          <ul className="punishCmdList" role="list" data-nolog>
            {group.items.map((item) => (
              <li className="punishCmd" key={item.cmd}>
                <div className="punishCmdTop">
                  <code className="mention" data-tone="command">
                    <span className="mentionName">
                      <Highlight text={item.cmd} query={query} />
                    </span>
                  </code>
                  <CopyButton text={item.cmd} />
                </div>
                <p className="punishCmdText">
                  <Inline text={item.does} ctx={ctx} query={query} />
                </p>
                <p className="punishDetail">
                  <span className="punishLabel">What staff look for</span>
                  <Inline text={item.looks} ctx={ctx} query={query} />
                </p>
                <div className="punishCmdFlags">
                  {item.flags.map((flag) => (
                    <span className="badge" data-tone={flag === 'Needs admin' ? 'warning' : 'success'} key={flag}>
                      {flag}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Block({ block, ctx, query }) {
  switch (block.type) {
    case 'md':
      return <Md text={block.text} ctx={ctx} query={query} />;
    case 'ladder':
      return <Ladder rows={block.rows} />;
    case 'facts':
      return <Facts items={block.items} ctx={ctx} query={query} />;
    case 'terms':
      return <Terms items={block.items} ctx={ctx} query={query} />;
    case 'steps':
      return <Steps items={block.items} ctx={ctx} query={query} />;
    case 'tools':
      return <Tools items={block.items} ctx={ctx} query={query} />;
    case 'commands':
      return <Commands groups={block.groups} ctx={ctx} query={query} />;
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------
// Embed: one offense or one part of the charter, with the category line on its left edge
// ----------------------------------------------------------------------------
function EntryEmbed({ entry, ctx, query }) {
  return (
    <article className="embed punishEmbed" id={entry.id} data-slot={entry.slot} data-level={entry.level || undefined} aria-labelledby={`${entry.id}-title`}>
      <span className="embedBar" aria-hidden="true" />
      <div className="embedBody">
        <header className="punishEmbedHead">
          <span className="ruleNumber punishNumber" aria-hidden="true">
            {pad(entry.number)}
          </span>
          <h3 className="embedTitle" id={`${entry.id}-title`}>
            <Highlight text={entry.title} query={query} />
          </h3>
          {entry.level && <LevelBadge level={entry.level} />}
        </header>
        {entry.blocks.map((block, index) => (
          <Block block={block} ctx={ctx} query={query} key={`${block.type}-${index}`} />
        ))}
      </div>
    </article>
  );
}

// ----------------------------------------------------------------------------
// Section: the gradient head panel with its enlarged art (same markup as a rules category),
// then the embeds. The charter carries the "Charter by Kyriadon" chip at the bottom left.
// ----------------------------------------------------------------------------
function PunishSection({ section, filtering, ctx, query }) {
  const isCharter = section.id === 'charter';
  return (
    <section className="ruleCategory punishSection" id={section.id} data-category={section.id} aria-labelledby={`${section.id}Title`}>
      <div className="panel panelGlow ruleHead">
        <div className="ruleBackdrop" aria-hidden="true">
          <div className="ruleGlow" />
          <div className="ruleArt">
            <SectionArt id={section.id} />
          </div>
        </div>

        <div className="ruleHeadBody">
          <div className="ruleHeadTop">
            <span className="topicIcon" aria-hidden="true">
              <RuleIcon name={section.icon} />
            </span>
            <div className="ruleHeadText">
              <h2 id={`${section.id}Title`}>
                <Highlight text={section.title} query={query} />
              </h2>
              <p className="ruleHeadSummary">{section.summary}</p>
            </div>
          </div>

          <div className="ruleHeadMeta">
            <span className="badge" data-tone="neutral">
              {filtering ? `${section.shown} of ${section.count} ${isCharter ? 'sections' : 'offenses'}` : plural(section.count, isCharter ? 'section' : 'offense')}
            </span>
            {isCharter && (
              <span className="badge" data-tone="neutral">
                Version {content.charter.version}
              </span>
            )}
            <span className="badge" data-tone="neutral">
              Effective {formatDate(content.charter.effective)}
            </span>
          </div>

          {isCharter && (
            <p className="punishCharterBy">
              <RuleIcon name="scroll" size={16} />
              <span>{content.charter.by}</span>
              <a className="roleChip" href={siteLinks.credit} target="_blank" rel="noopener noreferrer">
                <span className="roleName">{content.charter.author}</span>
              </a>
            </p>
          )}
        </div>
      </div>

      {section.entries.map((entry) => (
        <EntryEmbed key={entry.id} entry={entry} ctx={ctx} query={query} />
      ))}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Sidebar: quick scroll through the sections and their embeds. The section you are
// reading stays open, the rest stay folded.
// ----------------------------------------------------------------------------
function PunishNav({ view, query, active, navRef, onJump }) {
  const activeSection = active?.category ?? view[0]?.id;

  return (
    <aside className="rulesSide">
      <nav className="panel panelGlow rulesNav punishNav" aria-labelledby="punishNavTitle" data-nolog>
        <div className="panelHeader">
          <h3 id="punishNavTitle">{content.nav.title}</h3>
        </div>

        <div className="navScroll" ref={navRef}>
          <ul className="navCats" role="list">
            {view.map((section) => {
              const sectionOpen = section.id === activeSection;
              return (
                <li key={section.id} data-category={section.id} data-active={sectionOpen}>
                  <a
                    id={`nav-${section.id}`}
                    className="linkRow navCat"
                    href={`#${section.id}`}
                    aria-current={active?.id === section.id ? 'location' : undefined}
                    onClick={() => onJump({ id: section.id, category: section.id })}
                  >
                    <span className="linkIcon navCatIcon">
                      <RuleIcon name={section.icon} size={18} />
                    </span>
                    <span className="linkText">
                      <span className="linkTitle">
                        <Highlight text={section.name} query={query} />
                      </span>
                      <span className="linkDesc">{plural(section.shown, section.id === 'charter' ? 'section' : 'offense')}</span>
                    </span>
                    <span className="linkChevron navChevron">
                      <IconChevron />
                    </span>
                  </a>

                  {sectionOpen && (
                    <ul className="navSubs" role="list">
                      {section.entries.map((entry) => (
                        <li key={entry.id} data-slot={entry.slot} data-active={entry.id === active?.id}>
                          <a
                            id={`nav-${entry.id}`}
                            className="navSub"
                            href={`#${entry.id}`}
                            aria-current={active?.id === entry.id ? 'location' : undefined}
                            onClick={() => onJump({ id: entry.id, category: section.id })}
                          >
                            <span className="navLabel">
                              <Highlight text={entry.title} query={query} />
                            </span>
                            <span className="navCount">{pad(entry.number)}</span>
                          </a>
                        </li>
                      ))}
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
export default function Punishments() {
  const [query, setQuery] = useState('');
  const navRef = useRef(null);

  // The server ID turns the channel chips into real Discord channel links (same lookup as About)
  const { data } = useFetch('/api/stats');
  const guildId = data?.discord?.guildId || null;
  const ctx = useMemo(() => ({ guildId, channels: directory.channels, roles: directory.roles }), [guildId]);

  const words = useMemo(() => splitWords(query), [query]);
  const filtering = words.length > 0;

  // An embed matches when every search word appears in its section, title, level or text
  const view = useMemo(
    () =>
      model
        .map((section) => {
          const entries = section.entries.filter((entry) => words.every((word) => entry.haystack.includes(word)));
          return { ...section, entries, shown: entries.length };
        })
        .filter((section) => section.entries.length > 0),
    [words],
  );

  const shown = view.reduce((total, section) => total + section.shown, 0);

  // Sidebar scroll spy over the sections and their embeds, in document order
  const spyList = useMemo(
    () => view.flatMap((section) => [{ id: section.id, category: section.id }, ...section.entries.map((entry) => ({ id: entry.id, category: section.id }))]),
    [view],
  );
  const { active, jump } = useScrollSpy(spyList, SPY_OFFSET);

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

  return (
    <SiteShell title={content.title} description={content.description}>
      <div className="punishGrid">
        {/* Hero: same component as the home, about, debug and rules pages, crimson tone */}
        <section className="heroShell areaHero" aria-labelledby="heroTitle">
          <div className="heroPanel" data-tone="crimson">
            <div className="heroGlow" aria-hidden="true" />
            <div className="heroContent">
              <h1 id="heroTitle">{content.hero.title}</h1>
              <h2>{content.hero.subtitle}</h2>
              <p>{content.hero.body}</p>
              <Link className="btn btnSecondary btnCompact punishBack" href={content.back.href}>
                <IconChevron size={16} />
                {content.back.label}
              </Link>
            </div>
          </div>
        </section>

        {/* Search: filters every offense and charter section, matches in purple */}
        <div className="areaSearch">
          <label className="boostField rulesSearch">
            <IconSearch size={18} />
            <input
              className="searchInput"
              type="text"
              value={query}
              placeholder={content.search.placeholder}
              aria-label="Search punishments"
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
              {shown} of {totalEntries}
            </span>
            {query && (
              <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={() => setQuery('')} aria-label="Clear search" data-nolog>
                <IconClose size={16} />
              </button>
            )}
          </label>
        </div>

        <PunishNav view={view} query={query} active={active} navRef={navRef} onJump={jump} />

        <div className="rulesMain">
          {view.map((section) => (
            <PunishSection key={section.id} section={section} filtering={filtering} ctx={ctx} query={query} />
          ))}

          {view.length === 0 && (
            <div className="stateBox" role="status">
              <span>Nothing matches &ldquo;{query.trim()}&rdquo;. Try a different word, an offense or a command name.</span>
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
