// ============================================================================
// textSelection.js
// Site-wide text selection in the look of the == highlight (the purple pill of the markdown
// highlight and of the debug logs and punishments search), in the site's light blue.
//
// Why this is JavaScript: ::selection only accepts flat colours, so a browser selection can never
// have rounded pills or a flowing gradient. So the real selection is left exactly as it is (that
// is why dragging, double click, select all and Ctrl+C keep working natively), its own highlight
// is made see-through, and the selection is redrawn from its rectangles as two click-through layers:
//   1. Tint layer: one rounded pill per word, light blue to azure, like .mdHl but blue.
//   2. Flow layer: the same pills multiplied over the text. Selected text is forced to white in
//      selectionStyles.css, so multiplying by the gradient turns the letters into the flowing
//      white, baby blue and azure gradient.
// Text fields (inputs, textareas, editable content) keep the browser's own highlight, which
// selectionStyles.css colours light blue. If anything in here ever throws, or the browser cannot
// blend layers, the native light blue highlight takes over, so a selection never disappears.
// ============================================================================
import { useEffect } from 'react';

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------

// 'word' draws one pill per word (the look of the screenshot), 'line' draws one pill per line
const PILL_MODE = 'word';

// Past this many words on screen, or in one long text block, the highlight falls back to one pill
// per line, which keeps dragging smooth on phones
const WORD_BUDGET = 2400;
const BLOCK_CHAR_LIMIT = 6000;

// Pill shape, in em of the text it sits on (the .mdHl highlight uses 0.3em corners)
const RADIUS_EM = 0.3;

// Word pills grow a little past the letters but always keep a small gap to the next word pill,
// like the separate pills in the screenshot
const WORD_PAD_EM = 0.1;
const WORD_PAD_MAX_EM = 0.24;
const WORD_GAP_PX = 1.5;

// Line pills grow a little past the first and last letter
const LINE_PAD_EM = 0.16;

// Anything smaller than this (visually hidden text, for example) gets no pill
const MIN_HEIGHT_PX = 3;

// While a selection exists, the page is checked this often for layout changes that scroll and
// resize events do not report (images loading, panels moving, hover animations)
const WATCH_MS = 200;

// Text inside these tags is never highlighted by the painter
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'SELECT', 'OPTION', 'TITLE']);

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
function allowsSelection(element, ctx) {
  // Walks up until some element decides
  for (let el = element; el && el !== document.documentElement; el = el.parentElement) {
    let value = ctx.userSelect.get(el);

    // Reads the style once per element and frame
    if (value === undefined) {
      const style = getComputedStyle(el);
      value = style.userSelect || style.webkitUserSelect || 'auto';
      ctx.userSelect.set(el, value);
    }

    if (value === 'none') return false;
    if (value !== 'auto') return true;
  }
  return true;
}

// ----------------------------------------------------------------------------
// The visible area of the content of an element: the screen, cut down by every ancestor that clips
// its content (overflow hidden, auto, scroll or clip). Fixed elements ignore their ancestors'
// clipping, and absolute ones only obey the ancestors from their containing block upwards.
// ----------------------------------------------------------------------------
function clipOf(element, ctx) {
  // Answers already worked out in this frame
  const known = ctx.clip.get(element);
  if (known) return known;

  const style = getComputedStyle(element);
  const parent = element.parentElement;

  // What the surroundings allow: the screen, or the clip of the parent
  let base = ctx.view;
  if (parent && style.position !== 'fixed') {
    if (style.position === 'absolute') {
      // An absolute element is only clipped from its containing block upwards
      let holder = parent;
      while (holder && holder !== document.documentElement && getComputedStyle(holder).position === 'static') {
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
// Whether a fixed or sticky layer (a dialog and its backdrop, a sticky bar) sits on top of this
// text at the given rectangle, so no pill is drawn over it. Plain page elements, stretched links
// and click-through decorations never count as covering.
// ----------------------------------------------------------------------------
function isCovered(parent, rect, ctx) {
  // The centre of the rectangle is tested
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  // Off screen text is cut away by the clip anyway
  if (x < 0 || y < 0 || x >= ctx.view.r || y >= ctx.view.b) return false;

  // The text itself, or something inside or around it, is on top: not covered
  const hit = document.elementFromPoint(x, y);
  if (!hit || hit === parent || parent.contains(hit) || hit.contains(parent)) return false;

  // Finds the fixed or sticky layer the top element belongs to, once per element and frame
  let layer = ctx.layerOf.get(hit);
  if (layer === undefined) {
    layer = null;
    for (let el = hit; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const position = getComputedStyle(el).position;
      if (position === 'fixed' || position === 'sticky') {
        layer = el;
        break;
      }
    }
    ctx.layerOf.set(hit, layer);
  }

  // Only a layer that does not hold the text covers it
  return Boolean(layer) && !layer.contains(parent);
}

// ----------------------------------------------------------------------------
// Adds one pill, cut to the clip box, to the list of shapes
// ----------------------------------------------------------------------------
function pushShape(shapes, left, top, right, bottom, em, clip) {
  // Cuts the pill to what is visible
  const l = Math.max(left, clip.l);
  const t = Math.max(top, clip.t);
  const r = Math.min(right, clip.r);
  const b = Math.min(bottom, clip.b);
  if (r - l < 0.5 || b - t < 0.5) return;

  // Rounded like .mdHl, never rounder than half of the pill
  shapes.push({ x: l, y: t, w: r - l, h: b - t, r: Math.min(RADIUS_EM * em, (r - l) / 2, (b - t) / 2) });
}

// ----------------------------------------------------------------------------
// One pill per word of the selected part of a text node
// ----------------------------------------------------------------------------
function addWordShapes(node, from, to, probe, em, clip, shapes) {
  // Measures every selected word (a word that wraps gives one rectangle per line)
  const pieces = [];
  const pattern = /\S+/g;
  pattern.lastIndex = from;
  let match = pattern.exec(node.data);
  while (match !== null && match.index < to) {
    probe.setStart(node, match.index);
    probe.setEnd(node, Math.min(match.index + match[0].length, to));
    const list = probe.getClientRects();
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].width >= 0.5 && list[i].height >= MIN_HEIGHT_PX) pieces.push(list[i]);
    }
    match = pattern.exec(node.data);
  }

  // The smallest gap between two words on one line decides how far the pills may grow
  let gap = Infinity;
  for (let i = 1; i < pieces.length; i += 1) {
    const before = pieces[i - 1];
    const now = pieces[i];
    const sameLine = Math.abs(now.top - before.top) < before.height * 0.5;
    const between = now.left - before.right;
    if (sameLine && between > 0 && between < gap) gap = between;
  }

  // Grows by half of the free space minus the gap that stays, within sensible limits
  let pad = Number.isFinite(gap) ? (gap - WORD_GAP_PX) / 2 : WORD_PAD_EM * em;
  pad = Math.max(0, Math.min(pad, WORD_PAD_MAX_EM * em));

  // One pill per measured word
  pieces.forEach((rect) => pushShape(shapes, rect.left - pad, rect.top, rect.right + pad, rect.bottom, em, clip));
}

// ----------------------------------------------------------------------------
// One pill per line of the selected part of a text node
// ----------------------------------------------------------------------------
function addLineShapes(rects, em, clip, shapes) {
  const pad = LINE_PAD_EM * em;
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    if (rect.width >= 0.5 && rect.height >= MIN_HEIGHT_PX) {
      pushShape(shapes, rect.left - pad, rect.top, rect.right + pad, rect.bottom, em, clip);
    }
  }
}

// ----------------------------------------------------------------------------
// Turns the selected part of one text node into pills
// ----------------------------------------------------------------------------
function addNodeShapes(node, range, probe, ctx, shapes) {
  // Empty and whitespace-only text has nothing to highlight
  const text = node.data;
  if (!text || !/\S/.test(text)) return;

  // Text in scripts, fields and hidden or unselectable elements is skipped
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName) || !allowsSelection(parent, ctx)) return;

  // The part of this node that is inside the selection
  const from = node === range.startContainer ? range.startOffset : 0;
  const to = node === range.endContainer ? range.endOffset : text.length;
  if (to <= from) return;

  // Hidden text (visibility: hidden) is not painted by the browser either
  let style = ctx.style.get(parent);
  if (!style) {
    const computed = getComputedStyle(parent);
    style = { em: parseFloat(computed.fontSize) || 16, hidden: computed.visibility === 'hidden' };
    ctx.style.set(parent, style);
  }
  if (style.hidden) return;

  // The measuring range covers the whole selected part of the node
  probe.setStart(node, from);
  probe.setEnd(node, to);
  const rects = probe.getClientRects();
  if (rects.length === 0) return;

  // Nothing to draw when the text is outside its clip box (scrolled away, outside the screen)
  const clip = clipOf(parent, ctx);
  const box = probe.getBoundingClientRect();
  if (box.right <= clip.l || box.left >= clip.r || box.bottom <= clip.t || box.top >= clip.b) return;

  // Text under a dialog or a sticky bar gets no pill
  if (isCovered(parent, rects[0], ctx) && isCovered(parent, rects[rects.length - 1], ctx)) return;

  // Word pills while the budget lasts, line pills for long blocks and huge selections
  const useWords = PILL_MODE === 'word' && ctx.words < WORD_BUDGET && to - from < BLOCK_CHAR_LIMIT;
  if (useWords) {
    ctx.words += Math.ceil((to - from) / 6);
    addWordShapes(node, from, to, probe, style.em, clip, shapes);
  } else {
    addLineShapes(rects, style.em, clip, shapes);
  }
}

// ----------------------------------------------------------------------------
// Walks every text node of one selection range and collects its pills
// ----------------------------------------------------------------------------
function addRangeShapes(range, ctx, shapes) {
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
    if (range.intersectsNode(node)) addNodeShapes(node, range, probe, ctx, shapes);
  }
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

  // The two click-through layers: tint underneath, flowing letters on top
  const makeLayer = (name) => {
    const layer = document.createElement('div');
    layer.className = `selLayer ${name}`;
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
  let timer = 0;
  let lastSignature = '';
  let stopped = false;

  // Writes the position and size of a pill, and only when they changed
  const place = (pill, shape, withOffset) => {
    const x = Math.round(shape.x * 4) / 4;
    const y = Math.round(shape.y * 4) / 4;
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

    // The flow gradient is tied to the screen, so neighbouring pills show one continuous wave
    if (withOffset) pill.style.setProperty('--kx', String(x));
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
        flow.style.animationDelay = `-${Math.round(performance.now() % flowMs)}ms`;
        tintPills.push(tint);
        flowPills.push(flow);
        tintBatch.appendChild(tint);
        flowBatch.appendChild(flow);
      }
      tintLayer.appendChild(tintBatch);
      flowLayer.appendChild(flowBatch);
    }

    // Places every pill
    shapes.forEach((shape, index) => {
      place(tintPills[index], shape, false);
      place(flowPills[index], shape, true);
    });

    // Empty layers are hidden, so nothing is blended while there is no selection
    tintLayer.hidden = shapes.length === 0;
    flowLayer.hidden = shapes.length === 0;
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
    frame = 0;
    if (stopped) return;

    // Without a drawable selection everything is cleared
    const selection = readSelection();
    if (!selection) {
      draw([]);
      watch(false);
      return;
    }

    // Per-frame caches, so every element is measured at most once
    const ctx = {
      view: { l: 0, t: 0, r: root.clientWidth, b: root.clientHeight },
      clip: new Map(),
      userSelect: new Map(),
      style: new Map(),
      layerOf: new Map(),
      words: 0,
    };

    // Collects the pills of every range (Firefox can have several) and draws them
    const shapes = [];
    for (let i = 0; i < selection.rangeCount; i += 1) addRangeShapes(selection.getRangeAt(i), ctx, shapes);
    draw(shapes);
    lastSignature = signatureOf(selection);
    watch(true);
  };

  // Draws once per frame, however many events arrive
  const schedule = () => {
    if (!frame && !stopped) frame = window.requestAnimationFrame(guardedRender);
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

  // Redraws when the selection is still there but the page moved under it
  function check() {
    try {
      const selection = readSelection();
      if (selection && signatureOf(selection) !== lastSignature) schedule();
    } catch (error) {
      fail(error);
    }
  }

  // Removes layers and listeners and hands the highlight back to the browser
  function stop() {
    if (stopped) return;
    stopped = true;
    if (frame) window.cancelAnimationFrame(frame);
    watch(false);
    document.removeEventListener('selectionchange', schedule);
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    root.removeAttribute('data-selection');
    tintLayer.remove();
    flowLayer.remove();
  }

  // Selection changes (dragging, double click, select all, keyboard), any scrolling (also inside
  // panels) and resizing all redraw the pills
  document.addEventListener('selectionchange', schedule);
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
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
