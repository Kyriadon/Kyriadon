// ============================================================================
// /api/search
// Enterprise-style search endpoint used by the Ctrl + K palette.
//
// How it is built to grow:
//   1. Every searchable system registers ONE source in the `sources` list.
//   2. A source is an async function that returns normalized items.
//   3. Results are scored, grouped by `type` and returned in one format,
//      so the palette UI never changes when a new source is added.
//
// When the Projects system exists, replace loadProjects() (or add a new
// source) and it appears in search automatically.
// Query: ?q=text (max 80 characters). An empty query returns featured items.
// ============================================================================
import fs from 'fs';
import path from 'path';

// ----------------------------------------------------------------------------
// Group labels shown in the palette, keyed by item type
// ----------------------------------------------------------------------------
const TYPE_LABELS = {
  mod: 'Mods',
  project: 'Projects',
  featured: 'Suggested',
};

// ----------------------------------------------------------------------------
// Text folding: lowercase and strip accents so "Café" matches "cafe"
// ----------------------------------------------------------------------------
const fold = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// ----------------------------------------------------------------------------
// Normalizes a raw record into the shape every source must return
// ----------------------------------------------------------------------------
function normalizeItem(raw) {
  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  const aliases = Array.isArray(raw.aliases) ? raw.aliases : [];
  return {
    id: String(raw.id),
    type: raw.type === 'mod' ? 'mod' : 'project',
    title: String(raw.title || ''),
    description: String(raw.description || ''),
    tags,
    href: raw.href || `/projects/${raw.id}`,
    featured: Boolean(raw.featured),
    // Pre-folded fields used only for matching
    index: {
      title: fold(raw.title),
      aliases: aliases.map(fold),
      tags: tags.map(fold),
      description: fold(raw.description),
    },
  };
}

// ----------------------------------------------------------------------------
// Source: mods and projects from data/projects.json (cached until the file changes)
// ----------------------------------------------------------------------------
let projectCache = { mtimeMs: 0, items: [] };

async function loadProjects() {
  const file = path.join(process.cwd(), 'data', 'projects.json');
  const { mtimeMs } = await fs.promises.stat(file);
  if (mtimeMs !== projectCache.mtimeMs) {
    const raw = JSON.parse(await fs.promises.readFile(file, 'utf8'));
    projectCache = { mtimeMs, items: raw.filter((entry) => entry && entry.id && entry.title).map(normalizeItem) };
  }
  return projectCache.items;
}

// ----------------------------------------------------------------------------
// Source registry: add future searchable systems here
// ----------------------------------------------------------------------------
const sources = [{ id: 'projects', load: loadProjects }];

// ----------------------------------------------------------------------------
// Scoring: every query word must match something, stronger fields score higher.
// Returns 0 when any word has no match, so the item is excluded.
// ----------------------------------------------------------------------------
function scoreItem(item, tokens) {
  const { title, aliases, tags, description } = item.index;
  const titleWords = title.split(/[\s\-_:]+/);
  let total = 0;

  for (const token of tokens) {
    let best = 0;
    if (title === token) best = 100;
    else if (title.startsWith(token)) best = 70;
    else if (titleWords.some((word) => word.startsWith(token))) best = 55;
    else if (title.includes(token)) best = 35;

    if (aliases.some((alias) => alias === token || alias.startsWith(token))) best = Math.max(best, 50);
    if (tags.some((tag) => tag.startsWith(token))) best = Math.max(best, 30);
    if (description.includes(token)) best = Math.max(best, 12);

    if (best === 0) return 0;
    total += best;
  }
  return total;
}

// ----------------------------------------------------------------------------
// Strips internal fields before sending an item to the browser
// ----------------------------------------------------------------------------
const toPublic = ({ id, type, title, description, tags, href }) => ({ id, type, title, description, tags, href });

// ----------------------------------------------------------------------------
// Groups ordered results by type, keeping the order of first appearance
// ----------------------------------------------------------------------------
function groupResults(items, forcedType) {
  const groups = new Map();
  items.forEach((item) => {
    const type = forcedType || item.type;
    if (!groups.has(type)) groups.set(type, { type, label: TYPE_LABELS[type] || type, results: [] });
    groups.get(type).results.push(toPublic(item));
  });
  return [...groups.values()];
}

export default async function handler(req, res) {
  // Read-only endpoint
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const started = Date.now();
  const query = String(req.query.q ?? '').slice(0, 80).trim();

  try {
    // A failing source never breaks search for the others
    const lists = await Promise.all(sources.map((source) => source.load().catch(() => [])));
    const items = lists.flat();

    let groups;
    if (!query) {
      // Empty query: featured items first, otherwise the first few entries
      const featured = items.filter((item) => item.featured);
      groups = groupResults((featured.length ? featured : items).slice(0, 6), 'featured');
    } else {
      const tokens = fold(query).split(/\s+/).filter(Boolean);
      const ranked = items
        .map((item) => ({ item, score: scoreItem(item, tokens) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
        .slice(0, 12)
        .map((entry) => entry.item);
      groups = groupResults(ranked);
    }

    const total = groups.reduce((sum, group) => sum + group.results.length, 0);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return res.status(200).json({ query, total, tookMs: Date.now() - started, groups });
  } catch (error) {
    return res.status(500).json({ error: 'Search is unavailable' });
  }
}
