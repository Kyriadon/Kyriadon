// ============================================================================
// accountModal.js
// The Account modal (opened from "Account" in the user menu): avatar (upload or
// draw), username (once a month), display name (once every 15 minutes) and, for
// staff, the staff login. It uses the shared Modal, buttons, inputs, chips and
// panels of the site; styles live in styles/accountStyles.css.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { IconCheck, IconEraser, IconLock, IconMegaphone, IconPencil, IconTrash, IconUndo, IconUpload, IconWarning, Modal, logEvent } from './siteShell';
import { avatarPalette } from '../lib/siteDesign';
import { formatRemaining, sendJson, useAccount, useRemaining } from '../lib/accountClient';

// The Announcements manager is only downloaded when a staff member opens it
const AnnouncementManager = dynamic(() => import('./announcementManager'), { ssr: false });

// The picture is edited at 256 x 256 and shrunk further only if the file would be too large
const SIZE = 256;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_SAVE_BYTES = 240 * 1024;
const BRUSH_SIZES = [
  { id: 'small', label: 'Small', width: 5 },
  { id: 'medium', label: 'Medium', width: 12 },
  { id: 'large', label: 'Large', width: 26 },
];

const formatDate = (ms) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// ----------------------------------------------------------------------------
// Client-side checks (the server checks everything again)
// ----------------------------------------------------------------------------
function usernameProblem(raw) {
  const value = raw.trim().toLowerCase();
  if (value.length < 3 || value.length > 20) return 'Usernames are 3 to 20 characters long.';
  if (!/^[a-z0-9](?:[a-z0-9_.]{1,18})[a-z0-9]$/.test(value)) return 'Use letters, numbers, dots and underscores. Start and end with a letter or number.';
  if (/[._]{2}/.test(value)) return 'Dots and underscores cannot follow each other.';
  return '';
}

function displayNameProblem(raw) {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (!value) return 'Enter a display name.';
  if ([...value].length > 32) return 'Display names are up to 32 characters.';
  return '';
}

// ----------------------------------------------------------------------------
// Small pieces
// ----------------------------------------------------------------------------
function RoleChip({ role }) {
  return (
    <span className="mention" data-tone={role}>
      <span className="mentionName">{role === 'staff' ? 'Staff' : role}</span>
    </span>
  );
}

// A status line under a control: errors are announced at once, other messages politely
function Note({ note }) {
  if (!note?.text) return null;
  return (
    <p className="helperText acctNote" data-tone={note.tone} role={note.tone === 'error' ? 'alert' : 'status'}>
      {note.text}
    </p>
  );
}

// ----------------------------------------------------------------------------
// Avatar editing: load, drawing pad, adjust pad, export
// ----------------------------------------------------------------------------
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      // Very large photos are shrunk once, so adjusting stays smooth and the final result is sharp
      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      if (longest <= 1024) {
        resolve(image);
        return;
      }
      const ratio = 1024 / longest;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * ratio);
      canvas.height = Math.round(image.naturalHeight * ratio);
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('load'));
    };
    image.src = url;
  });
}

// PNG data URL of the editor canvas, shrunk step by step if the file would be too large
function exportAvatar(canvas) {
  for (const size of [256, 192, 128, 96]) {
    const output = document.createElement('canvas');
    output.width = size;
    output.height = size;
    const context = output.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(canvas, 0, 0, size, size);
    const url = output.toDataURL('image/png');
    if (url.length * 0.75 <= MAX_SAVE_BYTES) return url;
  }
  return null;
}

// Drawing pad: brush, eraser, colours, undo, clear, background
function DrawPad({ canvasRef }) {
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState(avatarPalette[4]);
  const [brush, setBrush] = useState('medium');
  const [canUndo, setCanUndo] = useState(false);
  const history = useRef([]);
  const stroke = useRef(null);
  const width = BRUSH_SIZES.find((item) => item.id === brush).width;

  const context = () => canvasRef.current.getContext('2d', { willReadFrequently: true });

  const remember = () => {
    history.current.push(context().getImageData(0, 0, SIZE, SIZE));
    if (history.current.length > 25) history.current.shift();
    setCanUndo(true);
  };

  const undo = () => {
    const previous = history.current.pop();
    if (previous) context().putImageData(previous, 0, 0);
    setCanUndo(history.current.length > 0);
  };

  const clear = () => {
    remember();
    context().clearRect(0, 0, SIZE, SIZE);
  };

  // Paints behind what is already drawn, so strokes stay
  const fillBackground = () => {
    remember();
    const ctx = context();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();
  };

  // Pointer position in picture pixels (the canvas is scaled by CSS)
  const pointOf = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) * SIZE) / rect.width, y: ((event.clientY - rect.top) * SIZE) / rect.height };
  };

  const paint = (from, to) => {
    const ctx = context();
    ctx.save();
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  };

  const dot = (at) => {
    const ctx = context();
    ctx.save();
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(at.x, at.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    remember();
    const at = pointOf(event);
    stroke.current = { id: event.pointerId, last: at };
    dot(at);
  };

  const onPointerMove = (event) => {
    const current = stroke.current;
    if (!current || current.id !== event.pointerId) return;
    // Coalesced events keep fast strokes smooth
    const events = event.nativeEvent.getCoalescedEvents?.() || [];
    (events.length ? events : [event.nativeEvent]).forEach((item) => {
      const next = pointOf(item);
      paint(current.last, next);
      current.last = next;
    });
  };

  const endStroke = (event) => {
    if (stroke.current?.id !== event.pointerId) return;
    stroke.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    }
  };

  return (
    <div className="acctEditor" onKeyDown={onKeyDown}>
      <div className="acctCanvasFrame">
        <canvas
          ref={canvasRef}
          className="acctCanvas"
          width={SIZE}
          height={SIZE}
          data-tool={tool}
          aria-label="Drawing area for your avatar"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
        <span className="acctCanvasMask" aria-hidden="true" />
      </div>
      <p className="helperText">The circle shows what stays visible on the site.</p>

      <div className="studioRow">
        <div className="segmented" role="group" aria-label="Tool">
          <button type="button" className="segment acctSegment" aria-pressed={tool === 'brush'} onClick={() => setTool('brush')}>
            <IconPencil size={16} />
            Brush
          </button>
          <button type="button" className="segment acctSegment" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>
            <IconEraser size={16} />
            Eraser
          </button>
        </div>
        <div className="segmented" role="group" aria-label="Brush size">
          {BRUSH_SIZES.map((item) => (
            <button key={item.id} type="button" className="segment" aria-pressed={brush === item.id} onClick={() => setBrush(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="acctSwatches" role="group" aria-label="Colour">
        {avatarPalette.map((hex) => (
          <button key={hex} type="button" className="acctSwatch" style={{ '--swatch': hex }} aria-label={`Colour ${hex}`} aria-pressed={color === hex && tool === 'brush'} onClick={() => { setColor(hex); setTool('brush'); }} />
        ))}
        <label className="acctSwatch acctSwatchCustom" aria-label="Custom colour">
          <input type="color" value={color} onChange={(event) => { setColor(event.target.value); setTool('brush'); }} />
        </label>
      </div>

      <div className="studioRow">
        <button type="button" className="btn btnSecondary btnCompact" onClick={undo} disabled={!canUndo}>
          <IconUndo size={16} />
          Undo
        </button>
        <button type="button" className="btn btnSecondary btnCompact" onClick={fillBackground}>
          Fill background
        </button>
        <button type="button" className="btn btnSecondary btnCompact" onClick={clear}>
          <IconTrash size={16} />
          Clear
        </button>
      </div>
    </div>
  );
}

// Adjust pad: drag the picture, zoom with the slider
function AdjustPad({ canvasRef, source }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

  const layout = useCallback(
    (level) => {
      const scale = Math.max(SIZE / source.width, SIZE / source.height) * level;
      const width = source.width * scale;
      const height = source.height * scale;
      return { width, height, maxX: Math.max(0, (width - SIZE) / 2), maxY: Math.max(0, (height - SIZE) / 2) };
    },
    [source],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = layout(zoom);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, (SIZE - width) / 2 + offset.x, (SIZE - height) / 2 + offset.y, width, height);
  }, [canvasRef, layout, source, zoom, offset]);

  const move = (dx, dy, level = zoom) => {
    const { maxX, maxY } = layout(level);
    setOffset((previous) => ({ x: clamp(previous.x + dx, -maxX, maxX), y: clamp(previous.y + dy, -maxY, maxY) }));
  };

  const onPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    move(((event.clientX - current.x) * SIZE) / rect.width, ((event.clientY - current.y) * SIZE) / rect.height);
    current.x = event.clientX;
    current.y = event.clientY;
  };

  const endDrag = (event) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const changeZoom = (event) => {
    const next = Number(event.target.value);
    setZoom(next);
    move(0, 0, next); // keeps the picture covering the whole square
  };

  return (
    <div className="acctEditor">
      <div className="acctCanvasFrame">
        <canvas ref={canvasRef} className="acctCanvas" data-tool="move" width={SIZE} height={SIZE} aria-label="Your picture. Drag to move it." onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} />
        <span className="acctCanvasMask" aria-hidden="true" />
      </div>
      <label className="studioField">
        <span className="studioLabel">Zoom</span>
        <input className="acctRange" type="range" min="1" max="3" step="0.01" value={zoom} onChange={changeZoom} />
      </label>
      <p className="helperText">Drag the picture to move it. The circle shows what stays visible on the site.</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Avatar section
// ----------------------------------------------------------------------------
function AvatarSection({ account }) {
  const { data: session } = useSession();
  const { profile } = account;
  const [mode, setMode] = useState('view'); // view | draw | adjust
  const [source, setSource] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);

  const current = profile.avatarUrl || session?.user?.image || null;

  const cancel = () => {
    setMode('view');
    setSource(null);
  };

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      setNote({ tone: 'error', text: 'Choose a PNG, JPEG, WebP or GIF image.' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setNote({ tone: 'error', text: 'That file is larger than 8 MB.' });
      return;
    }
    try {
      setSource(await loadImage(file));
      setNote(null);
      setMode('adjust');
    } catch {
      setNote({ tone: 'error', text: 'That image could not be opened.' });
    }
  };

  const send = async (request) => {
    setBusy(true);
    setNote(null);
    try {
      const { data } = await request();
      if (data?.ok) {
        account.apply({ profile: data.profile });
        account.announce();
        cancel();
        return true;
      }
      setNote({ tone: 'error', text: data?.message || data?.error || 'The avatar could not be saved.' });
    } catch {
      setNote({ tone: 'error', text: 'Could not reach the server. Try again.' });
    } finally {
      setBusy(false);
    }
    return false;
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    const image = exportAvatar(canvas);
    if (!image) {
      setNote({ tone: 'error', text: 'That picture is too detailed to save. Try a simpler one.' });
      return;
    }
    if (await send(() => sendJson('/api/account/avatar', 'POST', { image }))) {
      setNote({ tone: 'success', text: 'Avatar saved.' });
      logEvent({ code: 'ACCOUNT_AVATAR_CHANGED', reason: 'Changed their avatar' });
    }
  };

  const reset = async () => {
    if (busy) return;
    if (await send(() => sendJson('/api/account/avatar', 'DELETE'))) {
      setNote({ tone: 'success', text: 'Back to your Discord avatar.' });
      logEvent({ code: 'ACCOUNT_AVATAR_RESET', reason: 'Went back to the Discord avatar' });
    }
  };

  return (
    <section className="controlSection" aria-labelledby="acctAvatarTitle">
      <h4 id="acctAvatarTitle" className="studioSectionTitle">
        Avatar
      </h4>

      {mode === 'view' && (
        <div className="acctAvatarRow">
          {current ? <img className="acctAvatar" src={current} alt="Your avatar" width="96" height="96" /> : <span className="acctAvatar" aria-hidden="true" />}
          <div className="acctAvatarActions">
            <div className="studioRow">
              <button type="button" className="btn btnSecondary" onClick={() => fileRef.current?.click()} disabled={busy}>
                <IconUpload size={16} />
                Upload image
              </button>
              <button type="button" className="btn btnSecondary" onClick={() => { setNote(null); setMode('draw'); }} disabled={busy}>
                <IconPencil size={16} />
                Draw
              </button>
            </div>
            {profile.hasCustomAvatar && (
              <button type="button" className="btn btnGhost btnCompact" onClick={reset} disabled={busy}>
                Use my Discord avatar
              </button>
            )}
            <input ref={fileRef} className="acctFileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickFile} tabIndex={-1} aria-hidden="true" />
          </div>
        </div>
      )}

      {mode === 'draw' && <DrawPad canvasRef={canvasRef} />}
      {mode === 'adjust' && source && <AdjustPad canvasRef={canvasRef} source={source} />}

      {mode !== 'view' && (
        <div className="studioRow">
          <button type="button" className="btn btnPrimary" onClick={save} disabled={busy}>
            {busy ? 'Saving...' : 'Save avatar'}
          </button>
          <button type="button" className="btn btnSecondary" onClick={cancel} disabled={busy}>
            Cancel
          </button>
        </div>
      )}

      {mode === 'view' && <p className="helperText">PNG, JPEG, WebP or GIF up to 8 MB, or draw your own. It is cropped to a square.</p>}
      <Note note={note} />
    </section>
  );
}

// ----------------------------------------------------------------------------
// Username and display name: one field, one cooldown
// ----------------------------------------------------------------------------
function NameSection({ account, field, title, value, availableAt, prefix, maxLength, problemOf, confirmChange, lockedText, help }) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState(null);
  const remaining = useRemaining(availableAt, account.now);
  const locked = remaining > 0;
  const inputId = `acct-${field}`;

  // A saved change (here or in another tab) becomes the new starting point
  useEffect(() => setDraft(value), [value]);

  // The confirmation step expires after 5 seconds
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);

  const normalized = field === 'username' ? draft.trim().toLowerCase() : draft.replace(/\s+/g, ' ').trim();
  const changed = normalized !== value;
  const problem = changed ? problemOf(draft) : '';
  const disabled = busy || locked || !changed || Boolean(problem);

  const submit = async (event) => {
    event.preventDefault();
    if (disabled) return;
    // Changes that lock the field for a long time ask for a second click
    if (confirmChange && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setBusy(true);
    setNote(null);
    try {
      const { data } = await sendJson('/api/account', 'PATCH', { field, value: draft });
      if (data?.ok) {
        account.apply({ profile: data.profile });
        if (!data.unchanged) {
          account.announce();
          logEvent({ code: field === 'username' ? 'ACCOUNT_USERNAME_CHANGED' : 'ACCOUNT_DISPLAY_NAME_CHANGED', reason: `Changed their ${title.toLowerCase()}` });
          setNote({ tone: 'success', text: `${title} saved.` });
        }
      } else {
        if (data?.code === 'cooldown' && data.availableAt) account.apply({ profile: { ...account.profile, [field === 'username' ? 'usernameAvailableAt' : 'displayNameAvailableAt']: data.availableAt } });
        setNote({ tone: 'error', text: data?.message || data?.error || 'Could not save that. Try again.' });
      }
    } catch {
      setNote({ tone: 'error', text: 'Could not reach the server. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="controlSection" aria-labelledby={`${inputId}-title`}>
      <h4 id={`${inputId}-title`} className="studioSectionTitle">
        {title}
      </h4>
      <form className="acctInlineForm" onSubmit={submit} noValidate>
        <label className="studioField acctGrow" htmlFor={inputId}>
          <span className="studioLabel">{title}</span>
          <span className="acctInputWrap">
            {prefix && <span className="acctPrefix" aria-hidden="true">{prefix}</span>}
            <input id={inputId} className="studioInput" data-prefixed={Boolean(prefix)} type="text" value={draft} maxLength={maxLength} disabled={locked} spellCheck={false} autoComplete="off" onChange={(event) => { setDraft(event.target.value); setArmed(false); }} aria-invalid={Boolean(problem)} aria-describedby={`${inputId}-help`} />
          </span>
        </label>
        <button type="submit" className={`btn ${armed ? 'btnDanger' : 'btnSecondary'} acctSave`} disabled={disabled}>
          {armed ? 'Confirm change' : 'Save'}
        </button>
      </form>
      <p id={`${inputId}-help`} className="helperText acctNote" data-tone={problem ? 'error' : undefined}>
        {problem || (locked ? lockedText(remaining, availableAt) : help)}
      </p>
      <Note note={note} />
    </section>
  );
}

// ----------------------------------------------------------------------------
// Staff login (staff only)
// ----------------------------------------------------------------------------
function StaffSection({ account }) {
  const { staff, volatile, now, refresh, apply } = account;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const blockedLeft = useRemaining(staff?.blocked?.until, now);

  // While logged in or blocked, check every few seconds, so a kick or the end of a block shows up here
  const watching = Boolean(staff?.loggedIn || staff?.blocked);
  useEffect(() => {
    if (!watching) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [watching, refresh]);

  const explain = (data) => {
    switch (data?.code) {
      case 'bad_password':
        return `Wrong password. ${data.attemptsLeft} attempt${data.attemptsLeft === 1 ? '' : 's'} left.`;
      case 'locked':
        return `Too many attempts. Try again in ${formatRemaining((data.retryAt || now()) - now())}.`;
      default:
        return data?.message || data?.error || 'Staff login failed. Try again.';
    }
  };

  const login = async (event) => {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setNote(null);
    try {
      const { data } = await sendJson('/api/staff/login', 'POST', { password });
      setPassword('');
      if (data?.staff) apply({ staff: data.staff });
      if (!data?.ok && data?.code !== 'blocked') setNote({ tone: 'error', text: explain(data) });
    } catch {
      setNote({ tone: 'error', text: 'Could not reach the server. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const { data } = await sendJson('/api/staff/login', 'DELETE');
      if (data?.staff) apply({ staff: data.staff });
      else await refresh();
    } catch {
      setNote({ tone: 'error', text: 'Could not reach the server. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="controlSection" aria-labelledby="acctStaffTitle">
      <h4 id="acctStaffTitle" className="studioSectionTitle relevantTitle">
        Staff login
        <RoleChip role="staff" />
      </h4>

      {volatile && (
        <div className="stateBox" role="alert">
          <IconWarning size={18} />
          <span>Staff login needs the Upstash Redis database to be connected to this project.</span>
        </div>
      )}

      {!volatile && staff?.blocked && (
        <div className="stateBox acctBlocked" role="status">
          <IconLock size={20} />
          <strong>Your staff login is blocked</strong>
          <span>Until {formatDate(staff.blocked.until)} ({formatRemaining(blockedLeft)} left).</span>
          {staff.blocked.message && <blockquote className="acctQuote">{staff.blocked.message}</blockquote>}
        </div>
      )}

      {!volatile && !staff?.blocked && staff?.loggedIn && (
        <div className="acctSession">
          <div className="detailInline">
            <span className="badge" data-tone="success">
              <IconCheck size={12} />
              Logged in
            </span>
            <span className="helperText acctInline">Since {formatDate(staff.since)}. Ends {formatDate(staff.expiresAt)}.</span>
          </div>
          <button type="button" className="btn btnSecondary" onClick={logout} disabled={busy}>
            Log out
          </button>
        </div>
      )}

      {!volatile && !staff?.blocked && !staff?.loggedIn && (
        <>
          {staff?.notice?.type === 'kicked' && (
            <div className="stateBox" role="status">
              <IconWarning size={18} />
              <span>An admin ended your last staff session. Log in again to continue.</span>
            </div>
          )}
          {staff && !staff.configured ? (
            <p className="helperText">Staff login is not set up for your account yet. Ask an admin.</p>
          ) : (
            <form className="acctInlineForm" onSubmit={login} noValidate>
              <label className="studioField acctGrow" htmlFor="acct-staff-password">
                <span className="studioLabel">Staff password</span>
                <input id="acct-staff-password" className="studioInput" type="password" value={password} maxLength={200} spellCheck={false} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} />
              </label>
              <button type="submit" className="btn btnPrimary acctSave" disabled={busy || !password}>
                {busy ? 'Checking...' : 'Log in'}
              </button>
            </form>
          )}
          <p className="helperText">Every staff login is recorded in the server logs for staff and admins.</p>
        </>
      )}
      <Note note={note} />
    </section>
  );
}

// ----------------------------------------------------------------------------
// Announcements: staff who are logged in (and admins) open the Announcements manager here
// ----------------------------------------------------------------------------
function AnnouncementsSection({ account, onOpen }) {
  const { viewer, staff } = account;
  const unlocked = Boolean(viewer?.admin || (viewer?.staff && staff?.loggedIn && !staff?.blocked));

  return (
    <section className="controlSection" aria-labelledby="acctAnnouncementsTitle">
      <h4 id="acctAnnouncementsTitle" className="studioSectionTitle relevantTitle">
        Announcements
        <RoleChip role="staff" />
      </h4>
      {unlocked ? (
        <>
          <p className="helperText acctInline">Create, edit and review announcements, and see their statistics. You can change the ones you created{viewer?.admin ? ', and as an admin any other too' : ''}.</p>
          <button type="button" className="btn btnPrimary" onClick={onOpen}>
            <IconMegaphone size={16} />
            Open announcements manager
          </button>
        </>
      ) : (
        <p className="helperText acctInline">Log in as staff above to open the announcements manager.</p>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// The modal
// ----------------------------------------------------------------------------
function AccountDialog({ onClose, onOpenManager }) {
  const account = useAccount();
  const { status, profile, viewer, staff, storage } = account;

  // Always show fresh data when the modal opens
  useEffect(() => {
    account.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lockedUsername = useMemo(
    () => (remaining, at) => `You can change your username again on ${formatDate(at)} (in ${formatRemaining(remaining)}).`,
    [],
  );
  const lockedDisplay = useMemo(() => (remaining) => `You can change your display name again in ${formatRemaining(remaining)}.`, []);

  return (
    <Modal
      titleId="accountTitle"
      title="Account"
      subtitle="Your avatar, username and display name."
      size="narrow"
      onClose={onClose}
      footer={
        <button type="button" className="btn btnSecondary" onClick={onClose} data-autofocus>
          Done
        </button>
      }
    >
      {!profile && status !== 'error' && (
        <div aria-busy="true">
          <div className="skeleton skeletonCard" />
        </div>
      )}

      {!profile && status === 'error' && (
        <div className="stateBox" role="alert">
          <span>Your account could not be loaded.</span>
          <button type="button" className="btn btnSecondary btnCompact" onClick={account.refresh}>
            Try again
          </button>
        </div>
      )}

      {profile && (
        <>
          <AvatarSection account={account} />
          <NameSection
            account={account}
            field="username"
            title="Username"
            value={profile.username}
            availableAt={profile.usernameAvailableAt}
            prefix="@"
            maxLength={20}
            problemOf={usernameProblem}
            confirmChange
            lockedText={lockedUsername}
            help="3 to 20 characters: letters, numbers, dots and underscores. You can change it once a month."
          />
          <NameSection
            account={account}
            field="displayName"
            title="Display name"
            value={profile.displayName}
            availableAt={profile.displayNameAvailableAt}
            maxLength={40}
            problemOf={displayNameProblem}
            lockedText={lockedDisplay}
            help="Up to 32 characters. You can change it every 15 minutes."
          />
          {storage === 'memory' && account.volatile && <p className="helperText acctNote" data-tone="error">Changes are not saved permanently until the Upstash Redis database is connected.</p>}
          {viewer?.staff && staff && <StaffSection account={account} />}
          {(viewer?.staff || viewer?.admin) && <AnnouncementsSection account={account} onOpen={onOpenManager} />}
        </>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// The account modal with the Announcements manager next to it (a sibling, not a child,
// so a key pressed in the manager never closes the account modal)
// ----------------------------------------------------------------------------
export default function AccountModal({ onClose }) {
  const [managerOpen, setManagerOpen] = useState(false);

  const openManager = () => {
    logEvent({ code: 'ANNOUNCEMENT_MANAGER_OPENED', reason: 'Opened the announcements manager' });
    setManagerOpen(true);
  };

  return (
    <>
      <AccountDialog onClose={onClose} onOpenManager={openManager} />
      {managerOpen && <AnnouncementManager onClose={() => setManagerOpen(false)} />}
    </>
  );
}
