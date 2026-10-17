// ============================================================================
// punishmentsContent.js
// Everything the Punishments page (/rules/punishments) says, in one place:
//   content    page copy, the charter label, version and effective date
//   directory  channel and role chips (paste your real Discord IDs below)
//   kinds      the punishment types and their badge tone
//   levels     severity labels and tones
//   sections   the golden Screenshare charter, then the four main categories
// The charter text lives in lib/punishmentsCharter.js and the offenses in
// lib/punishmentsOffenses.js. Change a length there and the ladder, the search and the
// sidebar follow. Small helpers for writing entries live in lib/punishmentsKit.js.
// ============================================================================
import { charter } from './punishmentsCharter';
import { categories } from './punishmentsOffenses';

// ----------------------------------------------------------------------------
// Page copy
// ----------------------------------------------------------------------------
export const content = {
  title: 'Punishments - Kyriadon',
  description:
    'Exact ban lengths for every offense, the full Screenshare procedure and how appeals work: search the schedule, jump between categories and read every offense in detail.',
  hero: {
    title: 'Punishments',
    subtitle: 'Exact lengths for every offense, and how a screenshare works.',
    body: 'Every offense lists what counts, what happens on each repeat and how it can be appealed. The Screenshare procedure explains the tools, the commands and your rights as a player. Search for an offense, a tool or a command, or jump with the sidebar.',
  },
  back: { href: '/rules', label: 'Back to the rules' },
  search: { placeholder: 'Search offenses, tools and commands...' },
  nav: { title: 'Jump to' },
  // Shown on the golden Screenshare procedure panel (bottom left chip)
  charter: {
    label: 'Charter by Kyriadon',
    version: '1.0',
    effective: '2026-10-17',
  },
};

// ----------------------------------------------------------------------------
// Directory: the chips used inside the text. <#key> is a channel, <@&key> is a role.
// Channel `id` is the Discord channel ID; when it is empty (or the server ID could not be
// loaded) the chip opens the Discord invite instead, exactly like the About page.
// Tones come from lib/siteDesign.js (mentions). Role colours are the exact Discord role
// colours. Check these names and IDs against your server.
// ----------------------------------------------------------------------------
export const directory = {
  channels: {
    rules: { label: 'Rules', tone: 'rules', icon: 'book', id: '1475510046388650126' },
    register: { label: 'Register', tone: 'register', id: '1479437622970679386' },
    testing: { label: 'Testing', tone: 'testing', id: '1511301888375652522' },
    support: { label: 'Support', tone: 'site', id: '1479414074176700426' },
    // Paste these channel IDs when the channels exist
    screenshare: { label: 'Screenshare', tone: 'holo', id: '' },
    reports: { label: 'Reports', tone: 'testing', id: '' },
    appeals: { label: 'Appeals', tone: 'supporters', id: '' },
  },
  roles: {
    creator: { label: 'Creator', color: '#19c3f5' },
    developer: { label: 'Developer', color: '#7c7c7c' },
    staff: { label: 'Staff', color: '#a9a9ab' },
    screensharer: { label: 'Screensharer', color: '#4ade80' },
    'ss-manager': { label: 'Screenshare Manager', color: '#f5b301' },
    frozen: { label: 'Frozen', color: '#7cc4ff' },
  },
};

// ----------------------------------------------------------------------------
// Punishment kinds: always shown with a text label and, where it applies, an exact length.
// Tones are the shared badge tones (info, warning, danger, neutral, success).
// ----------------------------------------------------------------------------
export const kinds = {
  warn: { label: 'Warning', tone: 'warning' },
  mute: { label: 'Mute', tone: 'info' },
  kick: { label: 'Kick', tone: 'neutral' },
  ban: { label: 'Ban', tone: 'danger' },
  serverban: { label: 'Server ban', tone: 'danger' },
  testban: { label: 'Testing ban', tone: 'danger' },
  tierreset: { label: 'Tier removed', tone: 'warning' },
  perm: { label: 'Permanent ban', tone: 'danger' },
  none: { label: 'No punishment', tone: 'success' },
};

// ----------------------------------------------------------------------------
// Severity levels, from a slip to a case staff never take lightly
// ----------------------------------------------------------------------------
export const levels = {
  minor: { label: 'Minor', tone: 'info' },
  moderate: { label: 'Moderate', tone: 'warning' },
  severe: { label: 'Severe', tone: 'danger' },
  critical: { label: 'Critical', tone: 'danger' },
};

// ----------------------------------------------------------------------------
// Sections, in page order: the charter first, then the four main categories
// ----------------------------------------------------------------------------
export const sections = [charter, ...categories];
