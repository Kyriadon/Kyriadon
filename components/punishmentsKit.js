// ============================================================================
// punishmentsKit.js
// Helpers used by the punishment content files. They only build plain data, so
// pages/rules/punishments.js stays the single place that decides how it looks.
//
// Block types an embed can use (see pages/rules/punishments.js):
//   md        text with chips (see components/guideKit.js for the syntax)
//   ladder    the punishment ladder: one row per offense, each row one or more steps
//   facts     label / value pairs
//   terms     a badge with an explanation
//   steps     numbered steps with a connector line
//   tools     screenshare tools
//   commands  Windows commands with copy buttons
// ============================================================================

// Joins lines into one markdown string
export const md = (...lines) => lines.join('\n');

// A punishment: its kind (see kinds in punishmentsContent.js) and an optional exact length
export const step = (kind, length) => (length ? { kind, length } : { kind });

// One row of a ladder: the label ("1st offense"), its punishments and an optional note
export const row = (label, steps, note) => (note ? { label, steps, note } : { label, steps });

// Row labels: "1st offense", "2nd offense" ... and, for the last row, "3rd offense or later"
const ordinal = (n) => `${n}${[, 'st', 'nd', 'rd'][n % 100 >= 11 && n % 100 <= 13 ? 0 : n % 10] || 'th'}`;
export const nth = (n, orLater = false) => `${ordinal(n)} offense${orLater ? ' or later' : ''}`;

// Builds a ladder where every row has one punishment: pass one [kind, length, note] per
// row, the last row automatically reads "... or later". A single row reads "Every offense".
// ladderOf(['warn'], ['mute', '1 hour'], ['ban', '7 days'])
export const ladderOf = (...items) => ({
  type: 'ladder',
  rows: items.map(([kind, length, note], index) =>
    row(items.length === 1 ? 'Every offense' : nth(index + 1, index === items.length - 1), [step(kind, length)], note),
  ),
});

// Ladder with explicit rows: ladder(row(...), row(...))
export const ladder = (...rows) => ({ type: 'ladder', rows });

// Text, facts, terms and steps
export const text = (...lines) => ({ type: 'md', text: md(...lines) });
export const facts = (...items) => ({ type: 'facts', items });
export const terms = (...items) => ({ type: 'terms', items });
export const steps = (...items) => ({ type: 'steps', items });

// A glossary line: badge label, badge tone and the explanation
export const term = (label, tone, body) => ({ badge: { label, tone }, text: body });

// A numbered step
export const stage = (title, body) => ({ title, text: body });

// Tools and commands
export const tools = (...items) => ({ type: 'tools', items });
export const commands = (...groups) => ({ type: 'commands', groups });
export const group = (title, hint, ...items) => ({ title, hint, items });
export const command = (cmd, does, looks, ...flags) => ({ cmd, does, looks, flags });

// Offense entry: slug becomes part of the deep link (/rules/punishments#cheating-clients)
export const entry = (slug, title, level, ...blocks) => ({ slug, title, level, blocks });
