// ============================================================================
// selectionTone.js
// The saved colour of the site-wide text highlight (components/textSelection.js and
// styles/selectionStyles.css, section 6). The choice lives on <html data-selection-tone="...">, so
// one attribute recolours the whole site, and in localStorage, so this device keeps it.
// Blue is the default: it is stored as nothing and shown as no attribute at all.
// ============================================================================
import { selectionPalette } from './siteDesign';

export const DEFAULT_SELECTION_TONE = 'blue';
export const CYCLE_SELECTION_TONE = 'cycle';

const STORAGE_KEY = 'kyriadon.selectionTone';
const CHANGE_EVENT = 'kyriadon:selection-tone';

const labels = {
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  grey: 'Grey',
  black: 'Black',
};

// Every single-colour tone with its swatch colours, in the order the modal shows them
export const selectionToneOptions = Object.keys(labels).map((id) => ({
  id,
  label: labels[id],
  light: selectionPalette[id].light,
  main: selectionPalette[id].main,
}));

export const isSelectionTone = (value) => value === CYCLE_SELECTION_TONE || Object.prototype.hasOwnProperty.call(labels, value);

export const selectionToneLabel = (tone) => (tone === CYCLE_SELECTION_TONE ? 'Flowing through all colors' : labels[tone] || labels[DEFAULT_SELECTION_TONE]);

// ----------------------------------------------------------------------------
// Reads the saved tone; private mode or blocked storage just means the default
// ----------------------------------------------------------------------------
export function readSelectionTone() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isSelectionTone(stored) ? stored : DEFAULT_SELECTION_TONE;
  } catch {
    return DEFAULT_SELECTION_TONE;
  }
}

// ----------------------------------------------------------------------------
// Puts a tone on <html>; the default removes the attribute, so the blue CSS applies untouched
// ----------------------------------------------------------------------------
export function applySelectionTone(tone) {
  const root = document.documentElement;
  if (!isSelectionTone(tone) || tone === DEFAULT_SELECTION_TONE) root.removeAttribute('data-selection-tone');
  else root.setAttribute('data-selection-tone', tone);
}

// ----------------------------------------------------------------------------
// Applies, saves and announces a tone (the modal, and the painter, listen for the announcement)
// ----------------------------------------------------------------------------
export function saveSelectionTone(tone) {
  const next = isSelectionTone(tone) ? tone : DEFAULT_SELECTION_TONE;
  applySelectionTone(next);
  try {
    if (next === DEFAULT_SELECTION_TONE) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not saved, but the tone still applies until the page closes
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  return next;
}

// Reset to defaults: the whole site goes back to the blue highlight
export const resetSelectionTone = () => saveSelectionTone(DEFAULT_SELECTION_TONE);

// ----------------------------------------------------------------------------
// Calls the listener with the new tone when it changes here or in another tab
// ----------------------------------------------------------------------------
export function subscribeSelectionTone(listener) {
  const onChange = (event) => listener(event.detail);
  const onStorage = (event) => {
    // A null key means the whole storage was cleared
    if (event.key === STORAGE_KEY || event.key === null) listener(readSelectionTone());
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
