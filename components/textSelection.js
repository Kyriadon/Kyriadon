// ============================================================================
// textSelection.js
// Site-wide text selection in the look of the == highlight (the purple pill of the markdown
// highlight and of the debug logs and punishments search), in the site's light blue.
//
// Why this is JavaScript: ::selection only accepts flat colours, so a browser selection can never
// have rounded pills or a flowing gradient. So the real selection is left exactly as it is (that
// is why dragging, double click, select all and Ctrl+C keep working natively), its own highlight
// is made see-through, and the selection is redrawn from its line rectangles as two click-through
// layers:
//   1. Tint layer: one rounded pill per line, light blue to azure, like .mdHl but blue.
//   2. Flow layer: the same pills multiplied over the text. Selected text is forced to white in
//      selectionStyles.css, so multiplying by the gradient turns the letters into the flowing
//      white, baby blue and azure gradient. The flow runs on the GPU (a moving transform).
//
// Staying glued to the text: both layers are anchored to the page, not the screen, so scrolling
// moves the pills together with the text without any JavaScript. They are only redrawn when the
// selection changes, when a long scroll brings new lines in, and every frame while an animation or
// transition plays on the selected text, so the pills follow the text instead of jumping.
//
// Text fields (inputs, textareas, editable content) keep the browser's own highlight, which
// selectionStyles.css colours light blue. If anything in here ever throws, or the browser cannot
// blend layers, the native light blue highlight takes over, so a selection never disappears.
// ============================================================================
import { useEffect } from 'react';

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------

// Width of one flow loop in pixels. The gradient tiles every period and its first and last stops
// match, so the loop has no seam. Handed to the CSS as --selection-period.
const FLOW_PERIOD_PX = 520;

// Pill shape, in em of the text it sits on (the .mdHl highlight uses 0.3em corners)
const RADIUS_EM = 0.3;
const PAD_X_EM = 0.14;
const PAD_Y_EM = 0.05;

// Anything smaller than this (visually hidden text, for example) gets no pill
const MIN_HEIGHT_PX = 3;

// Pieces of one line that touch (text next to a bold word, a link, a space) become one pill. They
// merge when their tops and bottoms differ by at most this, and the gap is at most this many em.
const MERGE_TOLERANCE_PX = 1.5;
const MERGE_GAP_EM = 0.45;

// Pills are kept for this many extra screens above and below the visible page, so scrolling never
// shows an undrawn line before the next redraw
const MARGIN_SCREENS = 1;

// A page scroll only redraws after moving this share of a screen
const SCROLL_REDRAW_SHARE = 0.5;

// While a selection exists the page is checked this often for layout changes that no event reports
const WATCH_MS = 400;

// Longest time the pills follow an animation or transition, and how long computed styles are reused
const TRACK_MAX_MS = 6000;
const STYLE_TTL_MS = 500;

// Text inside these tags is never highlighted by the painter
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'SELECT', 'OPTION', 'TITLE']);

// ----------------------------------------------------------------------------
// Computed styles, kept for a moment so repeated redraws (during an animation) stay cheap
// ----------------------------------------------------------------------------
const styleCache = new WeakMap();

function styleOf(element, now) {
  // Reuses a recent answer
  let cached = styleCache.get(element);
  if (cached && now - cached.at < STYLE_TTL_MS) return cached;

  // Reads only what the painter needs
  const style = getComputedStyle(element);
  cached = {
    at: now,
    em: parseFloat(style.fontSize) || 16,
    hidden: style.visibility === 'hidden',
    select: style.userSelect || style.webkitUserSelect || 'auto',
    position: style.position,
    display: style.display,
    overflowX: style.overflowX,
    overflowY: style.overflowY,
  };
  styleCache.set(element, cached);
  return cached;
}

// ----------------------------------------------------------------------------
// Reads how long one flow loop lasts from the --motion-flow token, so every pill can start in the
// same phase and the gradient looks like one continuous wave across all of them
// ----------------------------------------------------------------------------
function readFlowMs() {
  // Token value such as "5s"
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--motion-flow').trim();
  const value = parseFloat(raw);

  // Falls back to the token's default of five seconds
  if (!Number.isFinite(value) || value <= 0) return 5000;
  return raw.endsWith('ms') ? value : value * 1000;
}

// ----------------------------------------------------------------------------
// Whether the person is allowed to select this element's text. user-select: none is not inherited
// as a computed value, so the chain of parents is checked until an explicit value is found.
// ----------------------------------------------------------------------------
function allowsSelection(element, now) {
  for (let el = element; el && el !== document.documentElement; el = el.parentElement) {
    const value = styleOf(el, now).select;
    if (value === 'none') return false;
    if (value !== 'auto') return true;
  }
  return true;
}

// ----------------------------------------------------------------------------
// The visible area of the content of an element: the drawn area, cut down by every ancestor that
// clips its content (overflow hidden, auto, scroll or clip). Fixed elements ignore their ancestors'
// clipping, and absolute ones only obey the ancestors from their containing block upwards.
// ----------------------------------------------------------------------------
function clipOf(element, ctx) {
  // Answers already worked out in this redraw
  const known = ctx.clip.get(element);
  if (known) return known;

  const style = styleOf(element, ctx.now);
  const parent = element.parentElement;

  // What the surroundings allow: the drawn area, or the clip of the parent
  let base = ctx.view;
  if (parent && style.position !== 'fixed') {
    if (style.position === 'absolute') {
      // An absolute element is only clipped from its containing block upwards
      let holder = parent;
      while (holder && holder !== document.documentElement && styleOf(holder, ctx.now).position === 'static') {
        holder = holder.parentElement;
      }
      base = holder && holder !== document.documentElement ? clipOf(holder, ctx) : ctx.view;
    } else {
      base = clipOf(parent, ctx);
    }
  }

  // Inline and contents elements cannot clip anything, so they pass the clip through
  let box = base;
  const canClip = style.display !== 'inline' && style.display !== 'contents';
  const clipsX = canClip && style.overflowX !== 'visible';
  const clipsY = canClip && style.overflowY !== 'visible';

  // This element's own overflow cuts the clip down to its box
  if (clipsX || clipsY) {
    const rect = element.getBoundingClientRect();
    box = {
      l: clipsX ? Math.max(base.l, rect.left) : base.l,
      r: clipsX ? Math.min(base.r, rect.right) : base.r,
      t: clipsY ? Math.max(base.t, rect.top) : base.t,
      b: clipsY ? Math.min(base.b, rect.bottom) : base.b,
    };
  }

  ctx.clip.set(element, box);
  return box;
}

// ----------------------------------------------------------------------------
// Collects the line rectangles of the selected part of one text node
// ----------------------------------------------------------------------------
function addNodeLines(node, range, probe, ctx, raw) {
  // Empty text has nothing to highlight
  const text = node.data;
  if (!text) return;

  // Whitespace-only text only matters between pieces of a line, and the merge step bridges those
  if (!/\S/.test(text)) return;

  // Text in scripts and fields is skipped
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName)) return;

  // Text under an open dialog is covered by it, so only text inside the dialog gets pills
  if (ctx.modal && !ctx.modal.contains(parent)) return;

  // Unselectable and hidden text is not painted by the browser either
  const style = styleOf(parent, ctx.now);
  if (style.hidden || !allowsSelection(parent, ctx.now)) return;

  // The part of this node that is inside the selection
  const from = node === range.startContainer ? range.startOffset : 0;
  const to = node === range.endContainer ? range.endOffset : text.length;
  if (to <= from) return;

  // One rectangle per line of that part
  probe.setStart(node, from);
  probe.setEnd(node, to);
  const rects = probe.getClientRects();
  if (rects.length === 0) return;

  // Keeps the rectangles that are inside the visible area of the text's container
  const clip = clipOf(parent, ctx);
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    const inside = rect.right > clip.l && rect.left < clip.r && rect.bottom > clip.t && rect.top < clip.b;
    if (inside && rect.width >= 0.5 && rect.height >= MIN_HEIGHT_PX) {
      raw.push({ l: rect.left, t: rect.top, r: rect.right, b: rect.bottom, em: style.em, clip });
    }
  }
}

// ----------------------------------------------------------------------------
// Walks every text node of one selection range and collects its line rectangles
// ----------------------------------------------------------------------------
function addRangeLines(range, ctx, raw) {
  if (range.collapsed) return;

  // The element that holds the whole range (the document body for select all)
  const container = range.commonAncestorContainer;
  let root = container.parentElement;
  if (container.nodeType === Node.ELEMENT_NODE) root = container;
  if (container.nodeType === Node.DOCUMENT_NODE) root = document.body;
  if (!root) return;

  // Editable content keeps the native highlight
  if (root.closest('[contenteditable]:not([contenteditable="false"])')) return;

  // Visits the text nodes in document order and keeps the ones the range touches
  const probe = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (range.intersectsNode(node)) addNodeLines(node, range, probe, ctx, raw);
  }
}

// ----------------------------------------------------------------------------
// Joins the pieces of one line into a single pill and gives it its final shape: a little room around
// the letters, cut to the visible area, with .mdHl style rounded corners
// ----------------------------------------------------------------------------
function buildShapes(raw) {
  const shapes = [];
  let current = null;

  // Turns the finished line into a shape
  const flush = () => {
    if (!current) return;
    const padX = PAD_X_EM * current.em;
    const padY = PAD_Y_EM * current.em;
    const clip = current.clip;
    const l = Math.max(current.l - padX, clip.l);
    const r = Math.min(current.r + padX, clip.r);
    const t = Math.max(current.t - padY, clip.t);
    const b = Math.min(current.b + padY, clip.b);
    if (r - l >= 0.5 && b - t >= 0.5) {
      shapes.push({ x: l, y: t, w: r - l, h: b - t, r: Math.min(RADIUS_EM * current.em, (r - l) / 2, (b - t) / 2) });
    }
    current = null;
  };

  // A piece joins the line before it when it sits on the same line, in the same clip, right after it
  raw.forEach((piece) => {
    const joins =
      current &&
      current.clip === piece.clip &&
      Math.abs(current.t - piece.t) <= MERGE_TOLERANCE_PX &&
      Math.abs(current.b - piece.b) <= MERGE_TOLERANCE_PX &&
      piece.l - current.r <= MERGE_GAP_EM * piece.em &&
      piece.l - current.r >= -piece.em;

    if (joins) {
      current.l = Math.min(current.l, piece.l);
      current.r = Math.max(current.r, piece.r);
    } else {
      flush();
      current = { ...piece };
    }
  });
  flush();

  return shapes;
}

// ----------------------------------------------------------------------------
// Whether there is a selection the painter should draw (text fields draw their own)
// ----------------------------------------------------------------------------
function readSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  // A focused text field owns the selection, and the browser highlights it
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return null;

  return selection;
}

// ----------------------------------------------------------------------------
// A short text that changes when the selection moves on the page, used by the watcher
// ----------------------------------------------------------------------------
function signatureOf(selection) {
  const box = selection.getRangeAt(0).getBoundingClientRect();
  return `${box.left}|${box.top}|${box.width}|${box.height}`;
}

// ----------------------------------------------------------------------------
// Builds the two layers, starts listening and returns the function that stops everything
// ----------------------------------------------------------------------------
function startSelectionPainter() {
  // The browser must be able to blend layers, and must not be in a forced colours mode
  const canBlend = window.CSS && CSS.supports && CSS.supports('mix-blend-mode', 'multiply');
  const forcedColors = window.matchMedia && window.matchMedia('(forced-colors: active)').matches;
  if (!canBlend || forcedColors) return () => {};

  const root = document.documentElement;
  const flowMs = readFlowMs();

  // The two click-through layers, anchored to the page: tint underneath, flowing letters on top
  const makeLayer = (name) => {
    const layer = document.createElement('div');
    layer.className = `selLayer ${name}`;
    layer.style.setProperty('--selection-period', `${FLOW_PERIOD_PX}px`);
    layer.setAttribute('aria-hidden', 'true');
    layer.hidden = true;
    document.body.appendChild(layer);
    return layer;
  };
  const tintLayer = makeLayer('selTintLayer');
  const flowLayer = makeLayer('selFlowLayer');
  const tintPills = [];
  const flowPills = [];

  let frame = 0;
  let trackFrame = 0;
  let trackUntil = 0;
  let timer = 0;
  let lastSignature = '';
  let lastScrollX = 0;
  let lastScrollY = 0;
  let drawn = false;
  let stopped = false;

  // Writes the position and size of a pill, and only when they changed. Positions are relative to
  // the layer, which sits on the page, so scrolling never changes them.
  const place = (pill, shape, originX, originY, withPhase) => {
    const x = Math.round((shape.x - originX) * 4) / 4;
    const y = Math.round((shape.y - originY) * 4) / 4;
    const w = Math.round(shape.w * 4) / 4;
    const h = Math.round(shape.h * 4) / 4;
    const r = Math.round(shape.r * 4) / 4;
    const key = `${x}|${y}|${w}|${h}|${r}`;
    if (pill.kyKey === key) return;
    pill.kyKey = key;
    pill.style.transform = `translate(${x}px, ${y}px)`;
    pill.style.width = `${w}px`;
    pill.style.height = `${h}px`;
    pill.style.borderRadius = `${r}px`;

    // The flow gradient is tied to the page, so neighbouring pills show one continuous wave
    if (withPhase) pill.style.setProperty('--ko', String(-(((x % FLOW_PERIOD_PX) + FLOW_PERIOD_PX) % FLOW_PERIOD_PX)));
  };

  // Makes sure there are exactly as many pills as shapes, then places them
  const draw = (shapes) => {
    // Removes surplus pills
    while (tintPills.length > shapes.length) {
      tintPills.pop().remove();
      flowPills.pop().remove();
    }

    // Adds missing pills. Each new flow pill starts at the global phase of the loop, so pills
    // created while dragging stay in step with the ones already flowing.
    if (tintPills.length < shapes.length) {
      const tintBatch = document.createDocumentFragment();
      const flowBatch = document.createDocumentFragment();
      while (tintPills.length < shapes.length) {
        const tint = document.createElement('span');
        tint.className = 'selPill';
        const flow = document.createElement('span');
        flow.className = 'selPill';
        flow.style.setProperty('--kd', `-${Math.round(performance.now() % flowMs)}ms`);
        tintPills.push(tint);
        flowPills.push(flow);
        tintBatch.appendChild(tint);
        flowBatch.appendChild(flow);
      }
      tintLayer.appendChild(tintBatch);
      flowLayer.appendChild(flowBatch);
    }

    // Empty layers are hidden, so nothing is blended while there is no selection
    const empty = shapes.length === 0;
    tintLayer.hidden = empty;
    flowLayer.hidden = empty;
    drawn = !empty;
    if (empty) return;

    // Where the layer sits on screen right now (it is anchored to the page, so this moves with
    // scrolling and the pills keep their own coordinates)
    const origin = flowLayer.getBoundingClientRect();
    shapes.forEach((shape, index) => {
      place(tintPills[index], shape, origin.left, origin.top, false);
      place(flowPills[index], shape, origin.left, origin.top, true);
    });
  };

  // Starts or stops the watcher that catches layout changes during a selection
  const watch = (on) => {
    if (on && !timer) timer = window.setInterval(check, WATCH_MS);
    if (!on && timer) {
      window.clearInterval(timer);
      timer = 0;
    }
  };

  // Redraws the pills from the current selection
  const render = () => {
    if (stopped) return;

    // Without a drawable selection everything is cleared
    const selection = readSelection();
    if (!selection) {
      draw([]);
      watch(false);
      return;
    }

    // Per-redraw state. The drawn area is the screen plus a margin of extra screens above and below.
    const now = performance.now();
    const margin = root.clientHeight * MARGIN_SCREENS;
    const ctx = {
      now,
      view: { l: 0, t: -margin, r: root.clientWidth, b: root.clientHeight + margin },
      clip: new Map(),
      modal: document.querySelector('[aria-modal="true"]'),
    };

    // Collects the line pieces of every range (Firefox can have several) and draws the pills
    const raw = [];
    for (let i = 0; i < selection.rangeCount; i += 1) addRangeLines(selection.getRangeAt(i), ctx, raw);
    draw(buildShapes(raw));

    // Remembers what was drawn, for the scroll check and the watcher
    lastSignature = signatureOf(selection);
    lastScrollX = window.scrollX;
    lastScrollY = window.scrollY;
    watch(true);
  };

  // If the painter ever throws, the native light blue highlight takes over for good
  const fail = (error) => {
    if (process.env.NODE_ENV !== 'production') console.warn('textSelection: using the native highlight instead', error);
    stop();
  };
  const guardedRender = () => {
    try {
      render();
    } catch (error) {
      fail(error);
    }
  };

  // Draws once per frame, however many events arrive
  const schedule = () => {
    if (frame || stopped) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      guardedRender();
    });
  };

  // Redraws when the selection is still there but the page moved under it
  function check() {
    try {
      const selection = readSelection();
      if (selection && signatureOf(selection) !== lastSignature) schedule();
    } catch (error) {
      fail(error);
    }
  }

  // Scrolling: the page moves the pills itself, so a page scroll only redraws after a long way, to
  // bring new lines in. Scrolling inside a panel redraws every time, because the pills are not
  // anchored to the panel.
  const onScroll = (event) => {
    if (!drawn) return;
    if (event.target === document) {
      const farX = Math.abs(window.scrollX - lastScrollX) > root.clientWidth * SCROLL_REDRAW_SHARE;
      const farY = Math.abs(window.scrollY - lastScrollY) > root.clientHeight * SCROLL_REDRAW_SHARE;
      if (!farX && !farY) return;
    }
    schedule();
  };

  // While an animation or transition plays on the selected text, the pills are redrawn on every
  // frame, in the same frame as the text moves, so they stay glued to it
  const trackStep = () => {
    trackFrame = 0;
    if (stopped) return;
    guardedRender();
    if (performance.now() < trackUntil) trackFrame = window.requestAnimationFrame(trackStep);
  };

  // An animation or transition started somewhere: is it on the selected text?
  const onMotion = (event) => {
    if (!drawn || !(event.target instanceof Element)) return;
    const selection = readSelection();
    if (!selection) return;

    // The element must hold the selection or be inside it
    const range = selection.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const target = event.target;
    if (!(target.contains(common) || (common.contains(target) && range.intersectsNode(target)))) return;

    // How long it will run, read from the browser (falls back to one second)
    let duration = 1000;
    if (typeof target.getAnimations === 'function') {
      const found = target.getAnimations().find((animation) =>
        event.type === 'animationstart'
          ? animation.animationName === event.animationName
          : animation.transitionProperty === event.propertyName,
      );
      const timing = found && found.effect && found.effect.getComputedTiming();

      // Endless loops (the site's flowing gradients) never move text, so they are not followed
      if (timing && timing.iterations === Infinity) return;
      if (timing && Number.isFinite(timing.endTime)) duration = Math.max(0, timing.endTime - (found.currentTime || 0));
    }

    // Follows the motion until it is over, then one last redraw
    trackUntil = Math.max(trackUntil, performance.now() + Math.min(duration, TRACK_MAX_MS) + 80);
    if (!trackFrame) trackFrame = window.requestAnimationFrame(trackStep);
  };

  // Removes layers and listeners and hands the highlight back to the browser
  function stop() {
    if (stopped) return;
    stopped = true;
    if (frame) window.cancelAnimationFrame(frame);
    if (trackFrame) window.cancelAnimationFrame(trackFrame);
    watch(false);
    document.removeEventListener('selectionchange', schedule);
    document.removeEventListener('animationstart', onMotion, true);
    document.removeEventListener('transitionrun', onMotion, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', schedule);
    root.removeAttribute('data-selection');
    tintLayer.remove();
    flowLayer.remove();
  }

  // Selection changes (dragging, double click, select all, keyboard), long scrolls, resizing and
  // motion on the selected text all redraw the pills
  document.addEventListener('selectionchange', schedule);
  document.addEventListener('animationstart', onMotion, true);
  document.addEventListener('transitionrun', onMotion, true);
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('resize', schedule);

  // From here on the native highlight is see-through (selectionStyles.css)
  root.setAttribute('data-selection', 'custom');

  // Draws a selection that already exists
  schedule();

  return stop;
}

// ----------------------------------------------------------------------------
// The component: mounted once in pages/_app.js, it draws nothing itself
// ----------------------------------------------------------------------------
export default function TextSelection() {
  // Starts the painter after the first render and stops it when the app unmounts
  useEffect(() => startSelectionPainter(), []);
  return null;
}
