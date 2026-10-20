// ============================================================================
// announcementMarkup.js
// Pure helpers shared by the browser and the server (no React, no Node modules):
//   types and limits       the three announcement types and every size limit
//   url helpers            safe links, the url of an announcement, media links
//   colours                names and #hex values for :colr:, :colrs: and :chip:
//   raw mode               :title: "title" style variables to fields and back
//   parseInline / Blocks   the markdown parser (renderer: components/announcementMarkup.js)
//   stripMarkup            plain text of any markup, for search, logs and previews
// ============================================================================
import { announcementColors } from './siteDesign';

// ----------------------------------------------------------------------------
// Types. The order of TYPE_ORDER is the order of the sections on /announcements.
// ----------------------------------------------------------------------------
export const ANNOUNCEMENT_TYPES = ['changelog', 'update', 'announcement'];
export const TYPE_ORDER = ['changelog', 'announcement', 'update'];

export const TYPE_META = {
  changelog: { id: 'changelog', label: 'Change-log', plural: 'Change-logs', folder: 'changelogs', blurb: 'What changed, version by version.' },
  announcement: { id: 'announcement', label: 'Announcement', plural: 'Announcements', folder: 'news', blurb: 'Important news from the team.' },
  update: { id: 'update', label: 'Update', plural: 'Updates', folder: 'updates', blurb: 'New things on the site and the server.' },
};

// Turns anything a person might type ("change-log", "Changelogs", "news") into a type id, or ''
export function normalizeType(value) {
  const key = String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (['changelog', 'changelogs', 'changes', 'patchnotes'].includes(key)) return 'changelog';
  if (['update', 'updates', 'patch'].includes(key)) return 'update';
  if (['announcement', 'announcements', 'news', 'notice'].includes(key)) return 'announcement';
  return '';
}

// ----------------------------------------------------------------------------
// Limits (the server checks every one of them again)
// ----------------------------------------------------------------------------
export const LIMITS = {
  title: 160,
  description: 300,
  body: 12000,
  image: 600,
  url: 500,
  label: 80,
  resources: 12,
  slug: 80,
  slugSegments: 4,
};

// Upload limits for images and videos (see lib/announcementsServer.js)
export const MEDIA_LIMITS = {
  imageBytes: 3 * 1024 * 1024,
  videoBytes: 4 * 1024 * 1024,
  chunkBytes: 400 * 1024,
};

export const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const VIDEO_MIMES = ['video/mp4', 'video/webm'];

// ----------------------------------------------------------------------------
// Text helpers
// ----------------------------------------------------------------------------

// lowercase, accents removed, everything else becomes a single dash
export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

// The url of an announcement is a path under /announcements, for example
// "changelogs/changelog-1". A full address or "/announcements/..." is accepted and shortened.
export function normalizeSlug(raw) {
  let value = String(raw ?? '').trim();
  if (!value) return { ok: true, value: '' };

  // Remove the address (https://kyriadon.vercel.app/ or kyriadon.vercel.app/), the query and the hash
  value = value.replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '');
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(value)) value = value.replace(/^[^/]+/, '');
  value = value.replace(/^\/+/, '').replace(/^announcements(\/|$)/i, '');

  // Every part is lowercased and cleaned, parts that end up empty are dropped
  const parts = value
    .split('/')
    .map((part) =>
      part
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, ''),
    )
    .filter(Boolean);

  if (!parts.length) return { ok: true, value: '' };
  if (parts.length > LIMITS.slugSegments) return { ok: false, message: `The url can have ${LIMITS.slugSegments} parts at most.` };
  const joined = parts.join('/');
  if (joined.length > LIMITS.slug) return { ok: false, message: `The url can be ${LIMITS.slug} characters at most.` };
  return { ok: true, value: joined };
}

// A link is only kept when it is http(s) or a path on this site. Everything else
// (javascript:, data:, file: ...) is dropped. A bare "example.com/page" becomes https.
export function safeUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value || value.length > LIMITS.url || /[\u0000-\u001F\u007F\s]/.test(value)) return '';
  if (value.startsWith('/')) return value.startsWith('//') || value.includes('\\') ? '' : value;
  let candidate = value;
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) return '';
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#]|$)/i.test(candidate)) return '';
    candidate = `https://${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? candidate : '';
  } catch {
    return '';
  }
}

// ----------------------------------------------------------------------------
// Media links. An uploaded file lives at /api/announcements/media/<id>. The first letter
// of the id tells what it is: i for an image, v for a video.
// ----------------------------------------------------------------------------
const MEDIA_RE = /^\/api\/announcements\/media\/([iv][0-9a-f]{24})$/;

export const mediaUrl = (id) => `/api/announcements/media/${id}`;

export function mediaIdOf(url) {
  const match = MEDIA_RE.exec(String(url ?? ''));
  return match ? match[1] : null;
}

export function mediaKindOf(url) {
  const id = mediaIdOf(url);
  if (!id) return null;
  return id[0] === 'i' ? 'image' : 'video';
}

// Every uploaded file an announcement points to (cover image, resources and the text)
export function collectMediaIds(item) {
  const ids = new Set();
  const add = (url) => {
    const id = mediaIdOf(url);
    if (id) ids.add(id);
  };
  add(item?.image);
  (item?.resources || []).forEach((resource) => add(resource?.url));
  const pattern = /\/api\/announcements\/media\/([iv][0-9a-f]{24})/g;
  let match = pattern.exec(String(item?.body ?? ''));
  while (match) {
    ids.add(match[1]);
    match = pattern.exec(String(item?.body ?? ''));
  }
  return [...ids];
}

// image, video or link, from an uploaded file or from the end of the address
export function guessKind(url) {
  const uploaded = mediaKindOf(url);
  if (uploaded) return uploaded;
  const path = String(url ?? '').split(/[?#]/)[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif)$/.test(path)) return 'image';
  if (/\.(mp4|webm|mov|ogv)$/.test(path)) return 'video';
  return 'link';
}

// ----------------------------------------------------------------------------
// Colours. A name from siteDesign.js (blue, red, babyblue ...) or a #hex value.
// ----------------------------------------------------------------------------
export function resolveColor(token) {
  const raw = String(token ?? '').trim().toLowerCase();
  if (!raw) return null;
  const name = raw.replace(/[\s_-]+/g, '');
  if (announcementColors[name]) return announcementColors[name];
  const hex = /^#?([0-9a-f]{6})$/.exec(raw) || /^#([0-9a-f]{3})$/.exec(raw);
  if (!hex) return null;
  let digits = hex[1];
  if (digits.length === 3) digits = digits.split('').map((char) => char + char).join('');
  return `#${digits}`;
}

// A list of tokens to { colors, unknown }
export function resolveColors(list) {
  const colors = [];
  const unknown = [];
  list.forEach((token) => {
    const trimmed = String(token).trim();
    if (!trimmed) return;
    const color = resolveColor(trimmed);
    if (color) colors.push(color);
    else unknown.push(trimmed);
  });
  return { colors, unknown };
}

// Smooth left to right gradient through the colours
export const gradientOf = (colors) => (colors.length === 1 ? colors[0] : `linear-gradient(90deg, ${colors.join(', ')})`);

// Chip gradient: the colours, then back again, so the hover flow loops without a seam
export const chipGradientOf = (colors) => `linear-gradient(90deg, ${[...colors, ...colors.slice(0, -1).reverse()].join(', ')})`;

// ----------------------------------------------------------------------------
// Raw mode: one panel of text with variables. A variable is a line that starts with
// :name: and a value, with or without quotes. Every other line is the main announcement.
//   :title: "Version 1.2 is here"
//   :url: "changelogs/changelog-1"
//   :type: "change-log"
//   :description: "A short summary for the card."
//   :image: "https://..."
//   :resource: "Label" | "https://..." | "link"
// \:title: at the start of a line stays plain text.
// ----------------------------------------------------------------------------
const VARIABLES = {
  title: 'title',
  name: 'title',
  url: 'url',
  slug: 'url',
  link: 'url',
  type: 'type',
  category: 'type',
  description: 'description',
  desc: 'description',
  summary: 'description',
  image: 'image',
  cover: 'image',
  resource: 'resource',
  resources: 'resource',
  body: 'body',
  announcement: 'body',
  main: 'body',
  content: 'body',
};

const VARIABLE_LINE = /^[ \t]*:([A-Za-z]+):(?:[ \t]+(.*)|[ \t]*)$/;

// "text" becomes text, with \" and \\ restored
function unquote(value) {
  const text = String(value ?? '').trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1).replace(/\\(["\\])/g, '$1');
  return text;
}

// Label | url | kind, quoted or not
function parseResource(value) {
  let text = String(value ?? '').trim();
  if (!text) return null;
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"') && !text.slice(1, -1).includes('"')) text = text.slice(1, -1);
  const parts = text.split('|').map((part) => unquote(part.trim()));
  if (parts.length === 1) return { label: '', url: parts[0], kind: '' };
  return { label: parts[0], url: parts[1], kind: parts[2] || '' };
}

// Raw text to { fields, problems }
export function parseRaw(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const fields = { title: '', url: '', type: '', description: '', body: '', image: '', resources: [] };
  const problems = [];
  const body = [];
  const seen = new Set();
  let typeText = '';

  lines.forEach((line, index) => {
    // An escaped variable stays text
    if (/^[ \t]*\\:[A-Za-z]+:/.test(line)) {
      body.push(line.replace('\\:', ':'));
      return;
    }
    const match = VARIABLE_LINE.exec(line);
    const key = match ? VARIABLES[match[1].toLowerCase()] : null;
    if (!key) {
      body.push(line);
      return;
    }
    const value = match[2] ?? '';
    if (key === 'body') {
      if (value.trim()) body.push(unquote(value));
      return;
    }
    if (key === 'resource') {
      const resource = parseResource(value);
      if (resource) fields.resources.push(resource);
      else problems.push(`Line ${index + 1}: :${match[1]}: needs a label and a link, like :resource: "Label" | "https://...".`);
      return;
    }
    if (seen.has(key)) problems.push(`Line ${index + 1}: :${match[1]}: is set twice. The last one is used.`);
    seen.add(key);
    if (key === 'type') typeText = unquote(value);
    else fields[key] = unquote(value);
  });

  if (typeText) {
    fields.type = normalizeType(typeText);
    if (!fields.type) problems.push(`Unknown type "${typeText}". Use change-log, update or announcement.`);
  }
  fields.body = body.join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
  return { fields, problems };
}

// Fields to raw text (the variables first, then the main announcement)
export function serializeRaw(fields) {
  const quote = (value) => `"${String(value ?? '').replace(/\s*\n\s*/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const lines = [
    `:title: ${quote(fields.title)}`,
    `:url: ${quote(fields.url)}`,
    `:type: ${quote(TYPE_META[fields.type] ? TYPE_META[fields.type].label : '')}`,
    `:description: ${quote(fields.description)}`,
    `:image: ${quote(fields.image)}`,
  ];
  (fields.resources || []).forEach((resource) => {
    lines.push(`:resource: ${quote(String(resource.label ?? '').replace(/\|/g, '/'))} | ${quote(resource.url)} | ${quote(resource.kind || guessKind(resource.url))}`);
  });
  lines.push('', fields.body || '');
  return lines.join('\n');
}

// ----------------------------------------------------------------------------
// Inline parser. Returns nodes: text, strong, em, strongem, u, del, mark, code, link, image,
// plain, colr, colrs and chip. Nothing here produces HTML, the renderer builds React elements.
// ----------------------------------------------------------------------------
const ESCAPABLE = '\\`*_~=[]()!:/|#';
const MAX_DEPTH = 8;

// :colr:blue/text/   :colrs:blue,red/text/   :chip:blue/text/:chip:
function tagAt(src, i, depth) {
  const match = /^:(colrs|colr|chip):/.exec(src.slice(i, i + 8));
  if (!match) return null;
  const start = i + match[0].length;
  const slash = src.indexOf('/', start);
  if (slash === -1) return null;
  const spec = src.slice(start, slash);
  if (!/^[#A-Za-z0-9_,\s-]+$/.test(spec) || spec.includes('\n')) return null;

  // The closing slash: a backslash protects the next character
  let j = slash + 1;
  while (j < src.length) {
    if (src[j] === '\\') {
      j += 2;
      continue;
    }
    if (src[j] === '/') break;
    j += 1;
  }
  if (j >= src.length) return null;

  const inner = src.slice(slash + 1, j).replace(/\\\//g, '/');
  let end = j + 1;
  if (match[1] === 'chip' && src.startsWith(':chip:', end)) end += 6;
  const { colors, unknown } = resolveColors(spec.split(','));
  return { end, node: { type: match[1], colors, unknown, children: parseInline(inner, depth + 1) } };
}

// `code`
function codeAt(src, i) {
  const close = src.indexOf('`', i + 1);
  if (close === -1 || close === i + 1) return null;
  return { end: close + 1, node: { type: 'code', text: src.slice(i + 1, close) } };
}

// ***both***  **bold**  __underline__  ~~strike~~  ==highlight==  *italic*
const MARKS = [
  ['***', 'strongem'],
  ['**', 'strong'],
  ['__', 'u'],
  ['~~', 'del'],
  ['==', 'mark'],
  ['*', 'em'],
];

function markAt(src, i, depth) {
  for (const [open, type] of MARKS) {
    if (!src.startsWith(open, i)) continue;
    const from = i + open.length;
    // An opening mark has to touch the text, and a single * must not start a ** pair
    if (src[from] === undefined || /\s/.test(src[from])) continue;
    if (open === '*' && src[from] === '*') continue;

    let close = from;
    for (;;) {
      close = src.indexOf(open, close);
      if (close === -1) break;
      if (open === '*' && src[close + 1] === '*') {
        close += 2;
        continue;
      }
      if (/\s/.test(src[close - 1])) {
        close += open.length;
        continue;
      }
      break;
    }
    if (close === -1 || close === from) continue;
    return { end: close + open.length, node: { type, children: parseInline(src.slice(from, close), depth + 1) } };
  }
  return null;
}

// [label](target) at position i: the pieces, or null
function bracketAt(src, i) {
  let level = 0;
  let j = i;
  for (; j < src.length; j += 1) {
    if (src[j] === '\\') {
      j += 1;
      continue;
    }
    if (src[j] === '\n') return null;
    if (src[j] === '[') level += 1;
    else if (src[j] === ']') {
      level -= 1;
      if (level === 0) break;
    }
  }
  if (j >= src.length || src[j + 1] !== '(') return null;
  const close = src.indexOf(')', j + 2);
  if (close === -1) return null;
  return { label: src.slice(i + 1, j), target: src.slice(j + 2, close).trim().split(/\s+/)[0] || '', end: close + 1 };
}

function linkAt(src, i, depth) {
  const parts = bracketAt(src, i);
  if (!parts) return null;
  const href = safeUrl(parts.target);
  const children = parseInline(parts.label, depth + 1);
  return { end: parts.end, node: href ? { type: 'link', href, children } : { type: 'plain', children } };
}

function imageAt(src, i) {
  if (src[i + 1] !== '[') return null;
  const parts = bracketAt(src, i + 1);
  if (!parts) return null;
  const url = safeUrl(parts.target);
  if (!url) return null;
  return { end: parts.end, node: { type: 'image', alt: stripMarkup(parts.label), src: url } };
}

// A bare https://... address becomes a link
function autolinkAt(src, i) {
  if (!/^https?:\/\//i.test(src.slice(i, i + 8))) return null;
  if (i > 0 && /[A-Za-z0-9]/.test(src[i - 1])) return null;
  let end = i;
  while (end < src.length && !/[\s<>"']/.test(src[end])) end += 1;
  const url = src.slice(i, end).replace(/[.,;:!?)\]]+$/, '');
  const href = safeUrl(url);
  if (!href) return null;
  return { end: i + url.length, node: { type: 'link', href, auto: true, children: [{ type: 'text', text: url }] } };
}

export function parseInline(source, depth = 0) {
  const src = String(source ?? '');
  const nodes = [];
  let text = '';
  let i = 0;
  const flush = () => {
    if (text) nodes.push({ type: 'text', text });
    text = '';
  };

  while (i < src.length) {
    const char = src[i];

    // A backslash in front of a markup character shows that character
    if (char === '\\' && i + 1 < src.length && ESCAPABLE.includes(src[i + 1])) {
      text += src[i + 1];
      i += 2;
      continue;
    }

    let hit = null;
    if (depth < MAX_DEPTH) {
      if (char === ':') hit = tagAt(src, i, depth);
      else if (char === '`') hit = codeAt(src, i);
      else if (char === '*' || char === '_' || char === '~' || char === '=') hit = markAt(src, i, depth);
      else if (char === '[') hit = linkAt(src, i, depth);
      else if (char === '!') hit = imageAt(src, i);
      else if (char === 'h' || char === 'H') hit = autolinkAt(src, i);
    }

    if (hit) {
      flush();
      nodes.push(hit.node);
      i = hit.end;
    } else {
      text += char;
      i += 1;
    }
  }
  flush();
  return nodes;
}

// ----------------------------------------------------------------------------
// Block parser. Returns blocks: p, h, small, quote, list, pre, hr and table.
//   # to ######   headings      -# small text      > quote     --- line
//   - * +  or  1.  lists (nested by indenting, - [ ] and - [x] tasks)
//   ``` code ```   fenced code   | a | b |  tables with a --- row below the header
// ----------------------------------------------------------------------------
const LIST_ITEM = /^([ \t]*)([-*+]|\d+[.)])[ \t]+(.*)$/;
const HR_LINE = /^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const FENCE_LINE = /^[ \t]*(```+|~~~+)[ \t]*([\w-]*)[ \t]*$/;
const HEADING_LINE = /^(#{1,6})[ \t]+(.+?)[ \t]*$/;
const TABLE_SEPARATOR = /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/;

// Cells of one table row, a \| stays inside its cell
function splitRow(line) {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  const cells = [];
  let cell = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\' && text[i + 1] === '|') {
      cell += '|';
      i += 1;
    } else if (text[i] === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += text[i];
    }
  }
  cells.push(cell.trim());
  return cells;
}

// One list, starting at line `start`. Deeper indented items become the children of the item above.
function parseList(lines, start) {
  const first = LIST_ITEM.exec(lines[start]);
  const baseIndent = first[1].replace(/\t/g, '    ').length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  let i = start;

  while (i < lines.length) {
    const match = LIST_ITEM.exec(lines[i]);
    if (!match) break;
    const indent = match[1].replace(/\t/g, '    ').length;
    if (indent < baseIndent) break;

    if (indent > baseIndent) {
      const nested = parseList(lines, i);
      if (items.length) items[items.length - 1].children.push(nested.block);
      else items.push({ text: '', task: null, children: [nested.block] });
      i = nested.next;
      continue;
    }

    if (/\d/.test(match[2]) !== ordered) break;
    let text = match[3];
    let task = null;
    const box = /^\[( |x|X)\][ \t]+(.*)$/.exec(text);
    if (box) {
      task = box[1] !== ' ';
      text = box[2];
    }
    items.push({ text, task, children: [] });
    i += 1;
  }
  return { block: { type: 'list', ordered, items }, next: i };
}

// True when this line starts something other than a paragraph
const startsBlock = (lines, i) => {
  const line = lines[i];
  return FENCE_LINE.test(line) || HEADING_LINE.test(line) || HR_LINE.test(line) || /^[ \t]{0,3}>/.test(line) || LIST_ITEM.test(line) || /^-# /.test(line) || (line.includes('|') && lines[i + 1] !== undefined && TABLE_SEPARATOR.test(lines[i + 1]) && lines[i + 1].includes('-'));
};

function blocksFromLines(lines, depth) {
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code
    const fence = FENCE_LINE.exec(line);
    if (fence) {
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'pre', lang: fence[2], text: body.join('\n') });
      continue;
    }

    const heading = HEADING_LINE.exec(line);
    if (heading) {
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (HR_LINE.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (/^-# /.test(line)) {
      blocks.push({ type: 'small', text: line.slice(3) });
      i += 1;
      continue;
    }

    // Quote: consecutive > lines, parsed again as blocks of their own
    if (/^[ \t]{0,3}>/.test(line)) {
      const inner = [];
      while (i < lines.length && /^[ \t]{0,3}>/.test(lines[i])) {
        inner.push(lines[i].replace(/^[ \t]{0,3}>[ \t]?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', blocks: depth < 4 ? blocksFromLines(inner, depth + 1) : [{ type: 'p', text: inner.join('\n') }] });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const list = parseList(lines, i);
      blocks.push(list.block);
      i = list.next;
      continue;
    }

    // Table: a header row, a --- row, then the body rows
    if (line.includes('|') && lines[i + 1] !== undefined && TABLE_SEPARATOR.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((cell) => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        if (left && right) return 'center';
        return right ? 'right' : 'left';
      });
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', head, align, rows });
      continue;
    }

    // Paragraph: lines up to the next blank line or the next block
    const paragraph = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'p', text: paragraph.join('\n') });
  }
  return blocks;
}

export function parseBlocks(source) {
  return blocksFromLines(String(source ?? '').replace(/\r\n?/g, '\n').split('\n'), 0);
}

// ----------------------------------------------------------------------------
// Plain text of any markup (custom tags and markdown removed)
// ----------------------------------------------------------------------------
export function stripMarkup(text) {
  return String(text ?? '')
    .replace(/:colrs?:[^\/\n]*\/((?:\\.|[^\/\\\n])*)\//g, '$1')
    .replace(/:chip:[^\/\n]*\/((?:\\.|[^\/\\\n])*)\/(?::chip:)?/g, '$1')
    .replace(/```[\w-]*/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]{0,3}(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d+[.)][ \t]+|-#[ \t]+)/gm, '')
    .replace(/(\*\*\*|\*\*|__|~~|==|\*|`)/g, '')
    .replace(/\\([\\`*_~=\[\]()!:\/|#])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// A short plain text preview, cut at a word
export function excerptOf(text, max = 180) {
  const plain = stripMarkup(text);
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 24))}\u2026`;
}

// ----------------------------------------------------------------------------
// Problems in the markup the editor can point out (unknown colours, a missing closing slash)
// ----------------------------------------------------------------------------
export function findMarkupProblems(text) {
  const problems = [];
  const seen = new Set();
  const add = (message) => {
    if (seen.has(message)) return;
    seen.add(message);
    problems.push(message);
  };

  String(text ?? '')
    .split('\n')
    .forEach((line, index) => {
      const pattern = /:(colrs|colr|chip):([#A-Za-z0-9_,\s-]+)\//g;
      let match = pattern.exec(line);
      while (match) {
        const { colors, unknown } = resolveColors(match[2].split(','));
        unknown.forEach((token) => add(`Line ${index + 1}: "${token}" is not a colour. Use a name like blue or a value like #3b9bff.`));
        if (!colors.length && !unknown.length) add(`Line ${index + 1}: :${match[1]}: needs a colour before the first /.`);

        // The text after the opening slash must end with a closing slash
        let j = match.index + match[0].length;
        let closed = false;
        while (j < line.length) {
          if (line[j] === '\\') {
            j += 2;
            continue;
          }
          if (line[j] === '/') {
            closed = true;
            break;
          }
          j += 1;
        }
        if (!closed) add(`Line ${index + 1}: :${match[1]}: is missing its closing /.`);
        match = pattern.exec(line);
      }
    });
  return problems;
}
