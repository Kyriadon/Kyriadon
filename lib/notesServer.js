// ============================================================================
// notesServer.js
// Server side of the staff notes board on the debug logs page: the sticky notes that staff,
// managers, admins and developers leave for each other. Every note has a visibility: everyone
// with access to the board, or only staff, managers, developers or admins. Admins see every note,
// and the author always sees their own. Stored in Redis (the same Upstash variables as the
// logs), or in a temporary file without Redis. Roles are checked by the routes that call this
// file (pages/api/notes.js and pages/api/commands.js).
// ============================================================================
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { NOTE_COLORS, NOTE_VISIBILITY } from './commandRegistry';

export const NOTE_MAX = 40; // notes on the board
export const NOTE_TEXT_MAX = 300; // characters in one note

const REDIS_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN);
const KEY = 'kyriadon:staff-notes'; // note id to the note (JSON)
const FILE = path.join(os.tmpdir(), 'kyriadon-staff-notes.json');

// The role of the viewer that each visibility needs ('all' needs none)
const ROLE_OF = { staff: 'staff', manager: 'manager', dev: 'developer', admin: 'admin' };

// Runs Redis commands in one request and returns one result per command
async function redisRun(commands) {
  const response = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Redis responded with ${response.status}`);
  const results = await response.json();
  const failed = results.find((item) => item.error);
  if (failed) throw new Error(`Redis error: ${failed.error}`);
  return results.map((item) => item.result);
}

// Without Redis the notes live in memory (and in a temporary file, best effort)
const shared = globalThis;
if (!shared.__kyriadonNotes) {
  let initial = {};
  try {
    initial = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    /* first run, nothing stored yet */
  }
  shared.__kyriadonNotes = { notes: initial && typeof initial === 'object' && !Array.isArray(initial) ? initial : {} };
}
const memory = shared.__kyriadonNotes;
const persist = () => fs.promises.writeFile(FILE, JSON.stringify(memory.notes)).catch(() => {});

const parse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

async function readAll() {
  if (useRedis) {
    const [flat] = await redisRun([['HGETALL', KEY]]);
    const values = Array.isArray(flat) ? flat.filter((_, index) => index % 2 === 1) : Object.values(flat || {});
    return values.map(parse).filter((note) => note && note.id);
  }
  return Object.values(memory.notes);
}

async function readOne(id) {
  if (useRedis) {
    const [raw] = await redisRun([['HGET', KEY, id]]);
    return parse(raw);
  }
  return memory.notes[id] || null;
}

async function writeOne(note) {
  if (useRedis) await redisRun([['HSET', KEY, note.id, JSON.stringify(note)]]);
  else {
    memory.notes[note.id] = note;
    persist();
  }
}

async function removeOne(id) {
  if (useRedis) await redisRun([['HDEL', KEY, id]]);
  else {
    delete memory.notes[id];
    persist();
  }
}

// Text of a note: no control characters, at most two line breaks in a row, trimmed and cut
const cleanText = (value) =>
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, NOTE_TEXT_MAX);

const fail = (status, error) => ({ ok: false, status, error });
const validId = (id) => typeof id === 'string' && /^[a-f0-9]{12}$/.test(id);

// Only the person who wrote a note (or an admin) can change or remove it
const canChange = (note, user, admin) => Boolean(admin) || String(note.authorId) === String(user.id);

// Can this viewer ({ id, staff, manager, admin, developer }) see the note? Admins see every note,
// authors their own, and a note without a visibility (older notes) is for everyone.
export function canSeeNote(note, viewer) {
  if (!viewer) return false;
  if (viewer.admin || String(note.authorId) === String(viewer.id)) return true;
  const visibility = note.visibility || 'all';
  return visibility === 'all' ? true : Boolean(viewer[ROLE_OF[visibility]]);
}

// The notes this viewer may see: pinned first, then the most recently changed
export async function listNotes(viewer) {
  const notes = (await readAll()).filter((note) => canSeeNote(note, viewer));
  return notes.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt);
}

// Narrows a list of notes by filters: { color, visibility, authorId, author, pinned, text, sort }.
// text: every word has to be in the note. sort: newest (pinned first, the default) or oldest.
export function filterNotes(notes, filters = {}) {
  const words = String(filters.text || '').toLowerCase().split(/\s+/).filter(Boolean);
  const author = String(filters.author || '').toLowerCase();
  const found = notes.filter((note) => {
    if (filters.color && note.color !== filters.color) return false;
    if (filters.visibility && (note.visibility || 'all') !== filters.visibility) return false;
    if (filters.authorId && String(note.authorId) !== String(filters.authorId)) return false;
    if (author && !String(note.authorName).toLowerCase().includes(author)) return false;
    if (filters.pinned !== undefined && Boolean(note.pinned) !== filters.pinned) return false;
    const haystack = note.text.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  if (filters.sort === 'oldest') return [...found].sort((a, b) => a.createdAt - b.createdAt);
  return found;
}

export async function createNote(user, input) {
  const text = cleanText(input?.text);
  if (!text) return fail(400, 'Write something on the note first.');
  const all = await readAll();
  if (all.length >= NOTE_MAX) return fail(400, `The board is full (${NOTE_MAX} notes). Remove one first.`);
  const now = Date.now();
  const note = {
    id: crypto.randomBytes(6).toString('hex'),
    text,
    color: NOTE_COLORS.includes(input?.color) ? input.color : 'yellow',
    visibility: NOTE_VISIBILITY.includes(input?.visibility) ? input.visibility : 'all',
    pinned: input?.pinned === true,
    authorId: String(user.id),
    authorName: String(user.name).slice(0, 60),
    createdAt: now,
    updatedAt: now,
  };
  await writeOne(note);
  return { ok: true, note };
}

export async function updateNote(user, admin, id, patch) {
  const note = validId(id) ? await readOne(id) : null;
  if (!note) return fail(404, 'That note is gone.');
  if (!canChange(note, user, admin)) return fail(403, 'You can only change your own notes.');
  if (patch?.text !== undefined) {
    const text = cleanText(patch.text);
    if (!text) return fail(400, 'A note cannot be empty. Remove it instead.');
    note.text = text;
  }
  if (patch?.color !== undefined && NOTE_COLORS.includes(patch.color)) note.color = patch.color;
  if (patch?.visibility !== undefined && NOTE_VISIBILITY.includes(patch.visibility)) note.visibility = patch.visibility;
  if (patch?.pinned !== undefined) note.pinned = patch.pinned === true;
  note.updatedAt = Date.now();
  await writeOne(note);
  return { ok: true, note };
}

export async function deleteNote(user, admin, id) {
  const note = validId(id) ? await readOne(id) : null;
  if (!note) return { ok: true, note: null };
  if (!canChange(note, user, admin)) return fail(403, 'You can only remove your own notes.');
  await removeOne(id);
  return { ok: true, note };
}

// Removes every note (admins, @admin:clear-notes). Returns how many there were.
export async function clearNotes() {
  const count = (await readAll()).length;
  if (useRedis) await redisRun([['DEL', KEY]]);
  else {
    memory.notes = {};
    persist();
  }
  return count;
}
