// ============================================================================
// guideKit.js
// Building blocks shared by the guide-style pages (Rules, About, Punishments):
//   Highlight     purple search highlight (same look as the debug logs)
//   Mention       role-style chip for channels, websites and commands
//   Inline / Md   mini markdown with Discord-style chips (see the syntax below)
//   CopyButton    compact icon button that copies a command
//   useScrollSpy  sidebar scroll spy with the click lock used by the Rules sidebar
// All visual values live in lib/siteDesign.js and the page stylesheets.
// ============================================================================
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { roleChipPaint } from '../lib/siteDesign';
import { IconBook, IconCheck, IconCopy, siteLinks } from './siteShell';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ----------------------------------------------------------------------------
// Highlight: wraps search matches in the same purple highlight as the debug logs
// ----------------------------------------------------------------------------
export function Highlight({ text, query = '' }) {
  const words = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (!words.length || !text) return text || null;
  return String(text)
    .split(new RegExp(`(${words.join('|')})`, 'ig'))
    .map((part, index) => (index % 2 ? <mark className="logHl" key={index}>{part}</mark> : part));
}

// ----------------------------------------------------------------------------
// Builds a deep link to a Discord channel, or falls back to the invite
// ----------------------------------------------------------------------------
export const channelHref = (guildId, channelId) =>
  guildId && channelId ? `https://discord.com/channels/${guildId}/${channelId}` : siteLinks.discord;

// ----------------------------------------------------------------------------
// Mention: role-style chip for channels, websites and commands.
// Tones: register, testing, rules, site, holo, gold ... (links) and command (plain box).
// ----------------------------------------------------------------------------
export function Mention({ tone, href, children }) {
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
// Role chip: a role in its exact colour on the neutral dark chip surface (same chip as the
// tier and PPP roles on the About page). Without a colour it falls back to the grey chip.
// ----------------------------------------------------------------------------
function RoleMention({ role }) {
  if (!role?.color) {
    return (
      <span className="mention" data-tone="site">
        <span className="mentionName">@{role?.label || 'role'}</span>
      </span>
    );
  }
  const paint = roleChipPaint(role.color);
  return (
    <span className="mention" data-tone="role" style={{ '--role-color': paint.color, '--role-light': paint.light }}>
      <span className="mentionName">@{role.label}</span>
    </span>
  );
}

// ----------------------------------------------------------------------------
// Mini markdown
//   Inline: **bold**  __underline__  ==highlight==  `command`  [label](url)
//           <#channel>  <@&role>   (channel and role keys come from ctx)
//   Blocks: ## heading   -# small   > quote   - list   1. numbered list   ```text fence```
// `ctx` is { guildId, channels, roles }; `query` is the page search (matches stay purple).
// ----------------------------------------------------------------------------
const INLINE = /(\*\*(?:[^*]|\*(?!\*))+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|==[^=]+==|<#[a-z0-9-]+>|<@&[a-z0-9-]+>)/g;

function renderInline(text, ctx, query, prefix = '') {
  return text.split(INLINE).map((part, index) => {
    const key = `${prefix}${index}`;
    if (index % 2 === 0) return part ? <Highlight text={part} query={query} key={key} /> : null;
    if (part.startsWith('**')) return <strong key={key}>{renderInline(part.slice(2, -2), ctx, query, `${key}-`)}</strong>;
    if (part.startsWith('__')) return <u key={key}>{renderInline(part.slice(2, -2), ctx, query, `${key}-`)}</u>;
    if (part.startsWith('==')) return <mark key={key} className="mdHl">{renderInline(part.slice(2, -2), ctx, query, `${key}-`)}</mark>;
    // Commands and code: the grey mono chip, like the commands in the rules
    if (part.startsWith('`')) {
      return (
        <code className="mention" data-tone="command" key={key}>
          <span className="mentionName">
            <Highlight text={part.slice(1, -1)} query={query} />
          </span>
        </code>
      );
    }
    // Links become website chips
    if (part.startsWith('[')) {
      const [, label, href] = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      return (
        <Mention key={key} tone="site" href={href}>
          {label}
        </Mention>
      );
    }
    if (part.startsWith('<#')) {
      const meta = ctx?.channels?.[part.slice(2, -1)] || { label: 'channel', tone: 'register' };
      return (
        <Mention key={key} tone={meta.tone} href={channelHref(ctx?.guildId, meta.id)}>
          {meta.icon === 'book' ? <>#<IconBook size={15} /> {meta.label}</> : `#${meta.label}`}
        </Mention>
      );
    }
    return <RoleMention key={key} role={ctx?.roles?.[part.slice(3, -1)]} />;
  });
}

export function Inline({ text, ctx, query = '' }) {
  return <Fragment>{renderInline(text, ctx, query)}</Fragment>;
}

// Splits markdown into blocks, then renders them
function parseBlocks(text) {
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
    } else if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, '')); i += 1; }
      blocks.push({ type: 'ol', items });
    } else {
      const para = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^(```|## |-# |> |- |\d+\. )/.test(lines[i])) { para.push(lines[i]); i += 1; }
      blocks.push({ type: 'p', text: para.join(' ') });
    }
  }
  return blocks;
}

export function Md({ text, ctx, query = '' }) {
  return (
    <div className="md">
      {parseBlocks(text).map((block, index) => {
        if (block.type === 'h') return <h5 className="mdH" key={index}>{renderInline(block.text, ctx, query)}</h5>;
        if (block.type === 'pre') {
          return (
            <div className="mdCodeBlock" key={index}>
              <pre className="mdPre">{block.text}</pre>
              <CopyButton text={block.text} />
            </div>
          );
        }
        if (block.type === 'quote') return <blockquote className="mdQuote" key={index}>{renderInline(block.text, ctx, query)}</blockquote>;
        if (block.type === 'small') return <p className="mdSmall" key={index}>{renderInline(block.text, ctx, query)}</p>;
        if (block.type === 'ul') return <ul className="mdList" role="list" key={index}>{block.items.map((item, n) => <li key={n}>{renderInline(item, ctx, query)}</li>)}</ul>;
        if (block.type === 'ol') return <ol className="mdList mdOrdered" key={index}>{block.items.map((item, n) => <li key={n}>{renderInline(item, ctx, query)}</li>)}</ol>;
        return <p className="mdP" key={index}>{renderInline(block.text, ctx, query)}</p>;
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// CopyButton: compact icon button, shows a check for a moment once the text is copied
// ----------------------------------------------------------------------------
export function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1200);
    } catch {
      /* the clipboard can be unavailable, the text stays selectable */
    }
  };

  return (
    <button type="button" className="btn btnGhost btnIcon btnCompact copyButton" onClick={copy} aria-label={copied ? 'Copied' : label} title={copied ? 'Copied' : label} data-nolog>
      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
    </button>
  );
}

// ----------------------------------------------------------------------------
// useScrollSpy: the last entry that has reached the top of the window is the current one.
// `list` is in document order ({ id, ... }), so the loop can stop early. Right after a
// sidebar click the page is still scrolling, so the click decides for a moment.
// Returns { active, jump(entry) }.
// ----------------------------------------------------------------------------
export function useScrollSpy(list, offset = 40) {
  const [active, setActive] = useState(null);
  const lockRef = useRef(0);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      ticking = false;
      if (Date.now() < lockRef.current) return;
      let current = null;
      for (const entry of list) {
        const element = document.getElementById(entry.id);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= offset) current = entry;
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
  }, [list, offset]);

  // Sidebar click: the browser scrolls to the anchor, the click sets the current entry
  const jump = useCallback((entry) => {
    lockRef.current = Date.now() + 900;
    setActive(entry);
    setTimeout(() => window.dispatchEvent(new Event('scroll')), 950);
  }, []);

  return { active, jump };
}
