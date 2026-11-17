// ============================================================================
// experimentsModal.js
// Experiments: features the site is trying out. Opened from the user menu (siteShell.js).
// Experiment 1: Distinct highlight colors. The person picks the colour of the site-wide text
// highlight from a dropdown, or lets it flow through every colour. The choice is kept by
// lib/selectionTone.js. The sample sentence is selected once, when the dialog has finished opening.
// ============================================================================
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { IconCheck, IconChevronDown, IconDistinctHighlight, Modal } from './siteShell';
import {
  CYCLE_SELECTION_TONE,
  readSelectionTone,
  resetSelectionTone,
  saveSelectionTone,
  selectionToneOptions,
  subscribeSelectionTone,
} from '../lib/selectionTone';

// Every choice in the menu: the colours, then Cycle in the plain ink colour
const options = [...selectionToneOptions, { id: CYCLE_SELECTION_TONE, label: 'Flow through all colors', light: 'var(--exp-ink)', main: 'var(--exp-ink)' }];

// Scrolls only the menu's own list so a row is in view (the dialog and the page never jump)
function reveal(list, row, centre = false) {
  if (!list || !row) return;
  const top = row.offsetTop;
  const bottom = top + row.offsetHeight;
  if (centre) list.scrollTop = top - (list.clientHeight - row.offsetHeight) / 2;
  else if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}

// ----------------------------------------------------------------------------
// Dropdown (listbox): a field that shows the choice, and a menu that opens under it.
// Keys: arrows, Home and End move; Enter or Space picks; Escape closes only the menu.
// ----------------------------------------------------------------------------
function ToneSelect({ tone, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const uid = useId().replace(/:/g, '');
  const current = options.find((option) => option.id === tone) || options[0];

  // While the menu is open: focus the chosen row, bring the whole menu into view once it has slid
  // open (only if the dialog is short), and close on a click outside
  useEffect(() => {
    if (!open) return undefined;
    const chosen = listRef.current?.querySelector('[aria-selected="true"]');
    chosen?.focus({ preventScroll: true });
    reveal(listRef.current, chosen, true);
    const settle = window.setTimeout(() => wrapRef.current?.scrollIntoView({ block: 'nearest' }), 260);
    const onDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      window.clearTimeout(settle);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const choose = (id) => {
    onChange(id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      // Only the menu closes; the dialog stays
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'Tab' && open) {
      setOpen(false);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') setOpen(true);
      return;
    }
    const rows = [...listRef.current.querySelectorAll('[role="option"]')];
    const at = rows.indexOf(document.activeElement);
    let next = at;
    if (event.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % rows.length;
    if (event.key === 'ArrowUp') next = at < 0 ? rows.length - 1 : (at - 1 + rows.length) % rows.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = rows.length - 1;
    rows[next]?.focus({ preventScroll: true });
    reveal(listRef.current, rows[next]);
  };

  return (
    <div className="expSelect" data-open={open} ref={wrapRef} onKeyDown={onKeyDown} style={{ '--c-light': current.light, '--c-main': current.main }}>
      <span id={`${uid}Label`} className="expFieldLabel">
        Highlight color
      </span>
      <button
        type="button"
        className="expSelectTrigger"
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${uid}List`}
        aria-labelledby={`${uid}Label ${uid}Value`}
        onClick={() => setOpen((value) => !value)}
      >
        <span id={`${uid}Value`}>{current.label}</span>
        <span className="expChevron">
          <IconChevronDown size={16} />
        </span>
      </button>

      <div className="expMenu">
        <div className="expMenuClip">
          <div className="expMenuList" id={`${uid}List`} role="listbox" aria-labelledby={`${uid}Label`} ref={listRef}>
            {options.map((option, index) => {
              const selected = option.id === tone;
              return (
                <Fragment key={option.id}>
                  {option.id === CYCLE_SELECTION_TONE && <div className="expMenuDivider" aria-hidden="true" />}
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    className="expOption"
                    style={{ '--i': index, '--c-light': option.light, '--c-main': option.main }}
                    onClick={() => choose(option.id)}
                  >
                    <span>{option.label}</span>
                    {selected && <IconCheck size={16} />}
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExperimentsModal({ onClose }) {
  const [tone, setTone] = useState(readSelectionTone);
  const sampleRef = useRef(null);

  // Stays in step with changes made elsewhere (another tab, the Reset button)
  useEffect(() => subscribeSelectionTone(setTone), []);

  // Selects the sample sentence ONCE, after the dialog has finished opening, so the real site highlight
  // is drawn a single time in its final place and is never redone while the person picks colors
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const node = sampleRef.current;
      const selection = window.getSelection();
      if (!node || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
    }, 360);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Modal
      titleId="experiments-title"
      title="Experiments"
      subtitle="Early features the site is trying out."
      onClose={onClose}
      tone="experiments"
      size="narrow"
      footer={
        <>
          <button type="button" className="btn btnSecondary" onClick={resetSelectionTone}>
            Reset to defaults
          </button>
          <button type="button" className="btn btnSecondary" onClick={onClose} data-autofocus>
            Done
          </button>
        </>
      }
    >
      <div className="expList">
        <section className="expCard" aria-labelledby="exp-highlight-title">
          <div className="expCardHead">
            <span className="expLogo">
              <IconDistinctHighlight size={26} />
            </span>
            <div className="expCardCopy">
              <h4 id="exp-highlight-title" className="expTitle">
                Distinct <mark className="mdHl">highlight</mark> colors
              </h4>
              <p className="expDesc">Pick the color of the text highlight across the whole site, or let it flow through all of them. Saved on this device.</p>
            </div>
          </div>

          <p className="expSample" ref={sampleRef}>
            Try it: select this sentence to see your highlight.
          </p>

          <ToneSelect tone={tone} onChange={saveSelectionTone} />
        </section>
      </div>
    </Modal>
  );
}
