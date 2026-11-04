// ============================================================================
// staffNotes.js
// The staff notes board on the debug logs page: sticky notes that staff, managers, admins and
// developers leave for each other (phone and computer). Every note has a colour and a visibility
// (everyone, staff, managers, developers or admins), and the important ones can be pinned to the
// top. Authors can edit, copy and remove their own notes (admins can change any). Filter the
// board (all, pinned, mine) and search once it grows. The notes are stored by pages/api/notes.js,
// and the Command panel writes to the same board (@staff:note, @fetch:notes). All visual values
// live in styles/notesStyles.css.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconChevron, IconCopy, IconPencil, IconTrash, logEvent } from './siteShell';
import { NOTE_COLORS, NOTE_VISIBILITY, NOTE_VISIBILITY_LABEL } from '../lib/commandRegistry';

const OPEN_KEY = 'kyriadon:notesOpen';
const REFRESH_MS = 20000;
const TEXT_MAX = 300;
const SEARCH_FROM = 6; // the search box shows when the board has this many notes

// The paper and ink colour of each note colour
const COLORS = {
  yellow: { paper: '#fde68a', ink: '#3b2f05' },
  pink: { paper: '#fbcfe8', ink: '#4a1230' },
  blue: { paper: '#bfdbfe', ink: '#102a4c' },
  green: { paper: '#bbf7d0', ink: '#0b3a1f' },
  purple: { paper: '#ddd6fe', ink: '#2a1658' },
  orange: { paper: '#fed7aa', ink: '#4a2205' },
};

// "Only staff", "Only admins" ... for the label of a note that is not for everyone
const onlyLabel = (visibility) => `Only ${NOTE_VISIBILITY_LABEL[visibility].toLowerCase()}`;

// A small steady tilt for each note, taken from its id so it never jumps around
const tiltOf = (id) => {
  let total = 0;
  for (let index = 0; index < id.length; index += 1) total = (total * 31 + id.charCodeAt(index)) % 7;
  return (total - 3) * 0.6;
};

// "just now", "5 min ago", "3 h ago", "2 days ago"
const timeAgo = (time) => {
  const minutes = Math.floor(Math.max(0, Date.now() - time) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  const days = Math.floor(minutes / (60 * 24));
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

// The pin drawing
function PinIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
    </svg>
  );
}

// Talks to /api/notes
async function call(method, body) {
  const response = await fetch('/api/notes', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

// The colour dots under a note being written or edited
function ColorPicker({ value, onChange }) {
  return (
    <div className="noteColors" role="group" aria-label="Note colour">
      {NOTE_COLORS.map((name) => (
        <button key={name} type="button" className="noteColor" style={{ '--note-paper': COLORS[name].paper }} aria-pressed={value === name} aria-label={name} title={name} onClick={() => onChange(name)} data-nolog />
      ))}
    </div>
  );
}

// Who can see the note: Everyone, Staff, Managers, Developers or Admins
function VisibilityPicker({ value, onChange }) {
  return (
    <div className="noteWhoPick">
      <span className="noteWhoLabel">Who can see it</span>
      <div className="noteWhoOptions" role="group" aria-label="Who can see this note">
        {NOTE_VISIBILITY.map((name) => (
          <button key={name} type="button" className="noteWhoOption" aria-pressed={value === name} onClick={() => onChange(name)} data-nolog>
            {NOTE_VISIBILITY_LABEL[name]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StaffNotes() {
  const [state, setState] = useState({ status: 'loading', notes: [], me: null });
  const [open, setOpen] = useState(true);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ text: '', color: 'yellow', visibility: 'all', pinned: false });
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const composerRef = useRef(null);

  // On phones the board starts folded away (a saved choice wins)
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(OPEN_KEY);
    } catch {
      /* storage can be unavailable */
    }
    if (saved === 'open' || saved === 'closed') setOpen(saved === 'open');
    else setOpen(!window.matchMedia('(max-width: 640px)').matches);
  }, []);

  const toggleOpen = () => {
    setOpen((current) => {
      try {
        localStorage.setItem(OPEN_KEY, current ? 'closed' : 'open');
      } catch {
        /* storage can be unavailable */
      }
      return !current;
    });
  };

  const load = useCallback(async () => {
    try {
      const data = await call('GET');
      setState({ status: 'ready', notes: data.notes || [], me: data.viewer?.id || null });
    } catch (error) {
      setState((previous) => ({ ...previous, status: previous.notes.length ? 'ready' : 'error', error: error.message }));
    }
  }, []);

  // Load once, refresh every 20 seconds while the page is visible, and when the Command panel changes a note
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    window.addEventListener('kyriadon:notes-changed', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('kyriadon:notes-changed', load);
    };
  }, [load]);

  // A message that goes away by itself
  const say = (tone, text) => {
    setNotice({ tone, text });
    setTimeout(() => setNotice((current) => (current?.text === text ? null : current)), 4000);
  };

  // Runs a change on the server, then shows the new board
  const run = async (action, success) => {
    if (busy) return false;
    setBusy(true);
    try {
      await action();
      await load();
      if (success) say('ok', success);
      return true;
    } catch (error) {
      say('error', error.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startCompose = () => {
    setOpen(true);
    setComposing(true);
    logEvent({ code: 'NOTE_COMPOSE_OPENED', reason: 'Started a staff note' });
    setTimeout(() => composerRef.current?.focus(), 50);
  };

  const add = async () => {
    if (!draft.text.trim()) return;
    const done = await run(() => call('POST', draft), draft.visibility === 'all' ? 'Note added.' : `Note added. ${onlyLabel(draft.visibility)} can see it.`);
    if (done) {
      setDraft({ text: '', color: draft.color, visibility: 'all', pinned: false });
      setComposing(false);
    }
  };

  const saveEdit = async () => {
    if (!editing.text.trim()) return;
    const done = await run(() => call('PUT', { id: editing.id, text: editing.text, color: editing.color, visibility: editing.visibility }), 'Note saved.');
    if (done) setEditing(null);
  };

  const remove = (note) => {
    if (!window.confirm('Remove this note?')) return;
    run(() => call('DELETE', { id: note.id }), 'Note removed.');
  };

  const togglePin = (note) => run(() => call('PUT', { id: note.id, pinned: !note.pinned }), note.pinned ? 'Unpinned.' : 'Pinned to the top.');

  // Copies the text of a note
  const copy = async (note) => {
    try {
      await navigator.clipboard.writeText(note.text);
      say('ok', 'Copied the note.');
    } catch {
      say('error', 'The browser did not allow copying.');
    }
  };

  // Ctrl or Cmd + Enter adds or saves, Escape cancels
  const onKeyDown = (event, submit, cancel) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      cancel();
    }
  };

  const { notes, me } = state;
  const counts = { all: notes.length, pinned: notes.filter((note) => note.pinned).length, mine: notes.filter((note) => note.authorId === me).length };
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = notes.filter((note) => {
    if (filter === 'pinned' && !note.pinned) return false;
    if (filter === 'mine' && note.authorId !== me) return false;
    const haystack = `${note.text} ${note.authorName}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });

  return (
    <section className="panel panelGlow notesPanel" id="staffNotes" aria-labelledby="notesTitle">
      <div className="panelHeader notesHeader">
        <div className="notesHeaderStart">
          <span className="notesHeaderIcon" aria-hidden="true">
            <PinIcon />
          </span>
          <h3 id="notesTitle">Staff notes</h3>
          {state.status === 'ready' && <span className="badge" data-tone="neutral">{notes.length}</span>}
        </div>
        <div className="notesHeaderEnd">
          <button type="button" className="btn btnSecondary btnCompact" onClick={startCompose} disabled={composing} data-nolog>
            New note
          </button>
          <button type="button" className="btn btnGhost btnIcon btnCompact notesCollapse" data-open={open} onClick={toggleOpen} aria-expanded={open} aria-controls="notesBody" aria-label={open ? 'Fold the notes away' : 'Show the notes'} title={open ? 'Fold away' : 'Show'} data-nolog>
            <IconChevron size={16} />
          </button>
        </div>
      </div>

      {open && (
        <div className="notesBody" id="notesBody">
          {notice && (
            <p className="notesNotice" data-tone={notice.tone} role="status">
              {notice.text}
            </p>
          )}

          {composing && (
            <div className="stickyNote stickyDraft" style={{ '--note-paper': COLORS[draft.color].paper, '--note-ink': COLORS[draft.color].ink, '--note-rotate': '0deg' }}>
              <div className="noteSheet">
              <span className="notePin" aria-hidden="true" />
              <textarea ref={composerRef} className="noteInput" value={draft.text} maxLength={TEXT_MAX} rows={4} placeholder="Write a note for the team..." aria-label="New note" onChange={(event) => setDraft({ ...draft, text: event.target.value })} onKeyDown={(event) => onKeyDown(event, add, () => setComposing(false))} data-nolog />
              <div className="noteTools">
                <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
                <button type="button" className="notePinChoice" aria-pressed={draft.pinned} onClick={() => setDraft({ ...draft, pinned: !draft.pinned })} data-nolog>
                  <PinIcon size={14} />
                  Pin
                </button>
                <span className="noteCount">{draft.text.length}/{TEXT_MAX}</span>
              </div>
              <VisibilityPicker value={draft.visibility} onChange={(visibility) => setDraft({ ...draft, visibility })} />
              <div className="noteFormActions">
                <button type="button" className="btn btnPrimary btnCompact" onClick={add} disabled={busy || !draft.text.trim()} data-nolog>
                  Add note
                </button>
                <button type="button" className="btn btnGhost btnCompact" onClick={() => setComposing(false)} data-nolog>
                  Cancel
                </button>
              </div>
              </div>
            </div>
          )}

          {/* Filters and search: shown when there is something to filter */}
          {state.status === 'ready' && notes.length > 1 && (
            <div className="notesFilters">
              <div className="notesChips" role="group" aria-label="Show notes">
                {[
                  ['all', 'All'],
                  ['pinned', 'Pinned'],
                  ['mine', 'Mine'],
                ].map(([id, label]) => (
                  <button key={id} type="button" className="notesChip" aria-pressed={filter === id} onClick={() => setFilter(id)} data-nolog>
                    {label} <span className="notesChipCount">{counts[id]}</span>
                  </button>
                ))}
              </div>
              {notes.length >= SEARCH_FROM && <input className="notesSearch" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes..." aria-label="Search notes" autoComplete="off" spellCheck={false} data-nolog />}
            </div>
          )}

          {state.status === 'loading' && <div className="skeleton skeletonCard" aria-busy="true" />}
          {state.status === 'error' && (
            <div className="stateBox" role="alert">
              <span>{state.error || 'The notes could not be loaded.'}</span>
              <button type="button" className="btn btnSecondary btnCompact" onClick={load}>Try again</button>
            </div>
          )}
          {state.status === 'ready' && notes.length === 0 && !composing && <p className="notesEmpty">No notes yet. Stick one on the board for the team.</p>}
          {state.status === 'ready' && notes.length > 0 && shown.length === 0 && <p className="notesEmpty">No notes match.</p>}

          {shown.length > 0 && (
            <ul className="notesBoard">
              {shown.map((note) => {
                const color = COLORS[note.color] || COLORS.yellow;
                const isEditing = editing?.id === note.id;
                return (
                  <li key={note.id} className="stickyNote" data-pinned={note.pinned} style={{ '--note-paper': color.paper, '--note-ink': color.ink, '--note-rotate': isEditing ? '0deg' : `${tiltOf(note.id)}deg` }}>
                    {/* The list item stays still; the paper inside it moves, so hovering never flickers */}
                    <div className="noteSheet">
                    <span className="notePin" aria-hidden="true" />
                    {isEditing ? (
                      <>
                        <textarea className="noteInput" value={editing.text} maxLength={TEXT_MAX} rows={4} aria-label="Edit note" autoFocus onChange={(event) => setEditing({ ...editing, text: event.target.value })} onKeyDown={(event) => onKeyDown(event, saveEdit, () => setEditing(null))} data-nolog />
                        <div className="noteTools">
                          <ColorPicker value={editing.color} onChange={(next) => setEditing({ ...editing, color: next })} />
                          <span className="noteCount">{editing.text.length}/{TEXT_MAX}</span>
                        </div>
                        <VisibilityPicker value={editing.visibility} onChange={(visibility) => setEditing({ ...editing, visibility })} />
                        <div className="noteFormActions">
                          <button type="button" className="btn btnPrimary btnCompact" onClick={saveEdit} disabled={busy || !editing.text.trim()} data-nolog>
                            Save
                          </button>
                          <button type="button" className="btn btnGhost btnCompact" onClick={() => setEditing(null)} data-nolog>
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {note.visibility !== 'all' && <span className="noteWho">{onlyLabel(note.visibility)}</span>}
                        <p className="noteText">{note.text}</p>
                        <div className="noteFoot">
                          <span className="noteMeta">
                            <strong>{note.authorName}</strong>
                            <span title={new Date(note.updatedAt).toLocaleString()}>{timeAgo(note.updatedAt)}</span>
                          </span>
                          <span className="noteActions">
                            <button type="button" className="noteButton" onClick={() => copy(note)} aria-label="Copy note" title="Copy" data-nolog>
                              <IconCopy size={16} />
                            </button>
                            {note.canEdit && (
                              <>
                                <button type="button" className="noteButton" data-on={note.pinned} onClick={() => togglePin(note)} disabled={busy} aria-pressed={note.pinned} aria-label={note.pinned ? 'Unpin note' : 'Pin note'} title={note.pinned ? 'Unpin' : 'Pin to the top'} data-nolog>
                                  <PinIcon size={16} />
                                </button>
                                <button type="button" className="noteButton" onClick={() => setEditing({ id: note.id, text: note.text, color: note.color, visibility: note.visibility || 'all' })} disabled={busy} aria-label="Edit note" title="Edit" data-nolog>
                                  <IconPencil size={16} />
                                </button>
                                <button type="button" className="noteButton" onClick={() => remove(note)} disabled={busy} aria-label="Remove note" title="Remove" data-nolog>
                                  <IconTrash size={16} />
                                </button>
                              </>
                            )}
                          </span>
                        </div>
                      </>
                    )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
