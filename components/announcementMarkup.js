// ============================================================================
// announcementMarkup.js
// Draws announcement text as React elements (never as raw HTML, so nothing typed by
// staff can run as code):
//   AnnoMarkup   blocks: headings, paragraphs, lists, quotes, code, tables, images, videos
//   AnnoInline   one line: titles and descriptions (bold, links, colours and chips work too)
// The parser lives in lib/announcementMarkup.js. Styles live in styles/announcementStyles.css.
// Custom tags:  :colr:blue/text/   :colrs:blue,red/text/   :chip:blue/text/:chip:
// ============================================================================
import Link from 'next/link';
import { Fragment, useMemo } from 'react';
import { chipGradientOf, gradientOf, guessKind, parseBlocks, parseInline } from '../lib/announcementMarkup';
import { CopyButton } from './guideKit';

// Chips without a usable colour use the grey of the other chips on the site
const FALLBACK_COLOR = '#aab4c3';

// Text with line breaks: every \n becomes a <br>
function renderText(text, key) {
  const lines = text.split('\n');
  return (
    <Fragment key={key}>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </Fragment>
  );
}

// A picture or a video, chosen by its link
function Media({ src, alt }) {
  if (guessKind(src) === 'video') return <video className="annoVideo" src={src} controls preload="metadata" playsInline aria-label={alt || 'Video'} />;
  return <img className="annoImg" src={src} alt={alt} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none'; }} />;
}

// Inline nodes to React elements
function renderNodes(nodes, prefix = '') {
  return nodes.map((node, index) => {
    const key = `${prefix}${index}`;
    const children = node.children ? renderNodes(node.children, `${key}-`) : null;

    switch (node.type) {
      case 'text':
        return renderText(node.text, key);
      case 'strong':
        return <strong key={key}>{children}</strong>;
      case 'em':
        return <em key={key}>{children}</em>;
      case 'strongem':
        return <strong key={key}><em>{children}</em></strong>;
      case 'u':
        return <u key={key}>{children}</u>;
      case 'del':
        return <del key={key}>{children}</del>;
      case 'mark':
        return <mark key={key} className="mdHl">{children}</mark>;
      case 'code':
        return <code key={key} className="mdCode">{node.text}</code>;
      case 'plain':
        return <Fragment key={key}>{children}</Fragment>;
      case 'image':
        return <Media key={key} src={node.src} alt={node.alt} />;
      case 'link': {
        // Paths on this site use the router, other addresses open in a new tab
        if (node.href.startsWith('/') && !node.href.startsWith('/api/')) {
          return <Link key={key} className="annoLink" href={node.href}>{children}</Link>;
        }
        return <a key={key} className="annoLink" href={node.href} target="_blank" rel="noopener noreferrer">{children}</a>;
      }
      // :colr:blue/text/ one colour
      case 'colr':
        return node.colors.length ? <span key={key} style={{ color: node.colors[0] }}>{children}</span> : <Fragment key={key}>{children}</Fragment>;
      // :colrs:blue,red,green/text/ a smooth gradient (one colour is just that colour)
      case 'colrs':
        if (node.colors.length > 1) return <span key={key} className="annoGrad" style={{ '--anno-grad': gradientOf(node.colors) }}>{children}</span>;
        return node.colors.length ? <span key={key} style={{ color: node.colors[0] }}>{children}</span> : <Fragment key={key}>{children}</Fragment>;
      // :chip:blue/text/:chip: a chip, with several colours it flows on hover like the other chips
      case 'chip': {
        const colors = node.colors.length ? node.colors : [FALLBACK_COLOR];
        return (
          <span key={key} className="annoChip" data-flow={colors.length > 1 ? 'flow' : 'solid'} style={{ '--chip-color': colors[0], '--chip-gradient': chipGradientOf(colors) }}>
            <span className="annoChipName">{children}</span>
          </span>
        );
      }
      default:
        return null;
    }
  });
}

// One line of markup (titles, descriptions)
export function AnnoInline({ text }) {
  const nodes = useMemo(() => parseInline(String(text ?? '')), [text]);
  return <Fragment>{renderNodes(nodes)}</Fragment>;
}

// A list, with its nested lists
function renderList(block, key) {
  const Tag = block.ordered ? 'ol' : 'ul';
  return (
    <Tag className={`mdList${block.ordered ? ' mdOrdered' : ''}`} role="list" key={key}>
      {block.items.map((item, index) => (
        <li key={index} className={item.task !== null ? 'annoTaskItem' : undefined}>
          {item.task !== null && (
            <span className="annoTask" data-done={item.task} role="img" aria-label={item.task ? 'Done' : 'Not done'}>
              {item.task ? '\u2713' : ''}
            </span>
          )}
          {renderNodes(parseInline(item.text), `${key}-${index}-`)}
          {item.children.map((child, n) => renderList(child, `${key}-${index}-${n}`))}
        </li>
      ))}
    </Tag>
  );
}

// Blocks to React elements
function renderBlocks(blocks, prefix = '') {
  return blocks.map((block, index) => {
    const key = `${prefix}${index}`;
    switch (block.type) {
      case 'h': {
        const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : block.level === 3 ? 'h5' : 'h6';
        return <Tag key={key} className={`annoH annoH${Math.min(block.level, 4)}`}>{renderNodes(parseInline(block.text), `${key}-`)}</Tag>;
      }
      case 'small':
        return <p key={key} className="mdSmall">{renderNodes(parseInline(block.text), `${key}-`)}</p>;
      case 'quote':
        return <blockquote key={key} className="mdQuote annoQuote">{renderBlocks(block.blocks, `${key}-`)}</blockquote>;
      case 'hr':
        return <hr key={key} className="annoHr" />;
      case 'pre':
        return (
          <div key={key} className="mdCodeBlock">
            <pre className="mdPre">{block.text}</pre>
            <CopyButton text={block.text} />
          </div>
        );
      case 'list':
        return renderList(block, key);
      case 'table':
        return (
          <div key={key} className="annoTableWrap">
            <table className="annoTable">
              <thead>
                <tr>
                  {block.head.map((cell, n) => (
                    <th key={n} style={{ textAlign: block.align[n] || 'left' }}>{renderNodes(parseInline(cell), `${key}-h${n}-`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r}>
                    {block.head.map((_, n) => (
                      <td key={n} style={{ textAlign: block.align[n] || 'left' }}>{renderNodes(parseInline(row[n] || ''), `${key}-${r}-${n}-`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <p key={key} className="mdP">{renderNodes(parseInline(block.text), `${key}-`)}</p>;
    }
  });
}

// Markdown with the custom tags, as blocks
export function AnnoMarkup({ text, className = '' }) {
  const blocks = useMemo(() => parseBlocks(String(text ?? '')), [text]);
  return <div className={`md annoMd ${className}`.trim()}>{renderBlocks(blocks)}</div>;
}
