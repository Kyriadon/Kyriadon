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
import { punishmentRoles } from '../lib/siteDesign';
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
  search: { placeholder: 'Search offences, tools...' },
  nav: { title: 'Jump to' },
  // Shown on the golden Screenshare procedure panel (bottom left): "Charter by" is plain text,
  // the author is the same chip as the footer credit
  charter: {
    by: 'Charter by',
    author: 'Kyriadon',
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
    // Support is yellow, Appeals pink and Announcements red. A report is a type of ticket opened
    // in Support, so there is no separate Reports channel.
    support: { label: 'Support', tone: 'gold', id: '1479414074176700426' },
    // Paste the Screenshare channel ID when it exists (until then the chip opens the Discord invite)
    screenshare: { label: 'Screenshare', tone: 'holo', id: '' },
    announcements: { label: 'Announcements', tone: 'announcements', id: '1479413573443911743' },
    appeals: { label: 'Appeals', tone: 'boosterOne', id: '1493196620676988958' },
  },
  roles: {
    // Roles with a gradient take it from punishmentRoles in lib/siteDesign.js (the chips and the
    // badges in the Definitions use the same colours)
    owner: { label: 'Owner', ...punishmentRoles.owner },
    developer: { label: 'Developer', color: '#7c7c7c' },
    staff: { label: 'Staff', color: '#a9a9ab' },
    member: { label: 'Member', ...punishmentRoles.member },
    reporter: { label: 'Reporter', ...punishmentRoles.reporter },
    screensharer: { label: 'Screensharer', ...punishmentRoles.screensharer },
    'ss-manager': { label: 'Screenshare Manager', ...punishmentRoles.ssManager },
    frozen: { label: 'Frozen', ...punishmentRoles.frozen },
  },
};

// ----------------------------------------------------------------------------
// Punishment kinds: always shown with a text label and, where it applies, an exact length.
// Tones are the shared badge tones (info, warning, danger, neutral, success) plus critical, a
// darker red than danger that marks the permanent ban and critical offenses.
// ----------------------------------------------------------------------------
export const kinds = {
  warn: { label: 'Warning', tone: 'warning' },
  mute: { label: 'Mute', tone: 'info' },
  kick: { label: 'Kick', tone: 'neutral' },
  ban: { label: 'Ban', tone: 'danger' },
  serverban: { label: 'Server ban', tone: 'danger' },
  testban: { label: 'Testing ban', tone: 'danger' },
  tierreset: { label: 'Tier removed', tone: 'warning' },
  perm: { label: 'Permanent ban', tone: 'critical' },
  none: { label: 'No punishment', tone: 'success' },
};

// ----------------------------------------------------------------------------
// Severity levels, from a slip to a case staff never take lightly
// ----------------------------------------------------------------------------
export const levels = {
  minor: { label: 'Minor', tone: 'info' },
  moderate: { label: 'Moderate', tone: 'warning' },
  severe: { label: 'Severe', tone: 'danger' },
  critical: { label: 'Critical', tone: 'critical' },
};

// ----------------------------------------------------------------------------
// Sections, in page order: the charter first, then the four main categories
// ----------------------------------------------------------------------------
export const sections = [charter, ...categories];
