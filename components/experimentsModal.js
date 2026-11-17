// ============================================================================
// experimentsModal.js
// Experiments: features the site is trying out. Opened from the user menu (siteShell.js).
// Experiment 1: Distinct highlight colors. The person picks the colour of the site-wide text
// highlight, or lets it flow through every colour. The choice is kept by lib/selectionTone.js.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { Modal, IconDistinctHighlight } from './siteShell';
import { selectionCycleColors } from '../lib/siteDesign';
import {
  CYCLE_SELECTION_TONE,
  DEFAULT_SELECTION_TONE,
  readSelectionTone,
  resetSelectionTone,
  saveSelectionTone,
  selectionToneLabel,
  selectionToneOptions,
  subscribeSelectionTone,
} from '../lib/selectionTone';

// Every choice in keyboard order: the colours, then Cycle
const order = [...selectionToneOptions.map((option) => option.id), CYCLE_SELECTION_TONE];

// The conic ring of the Cycle choice, built from the same colours as the logo
const cycleRing = `conic-gradient(${[...selectionCycleColors, selectionCycleColors[0]].join(', ')})`;

// Check mark that draws itself on the chosen colour
function IconCheck() {
  return (
    <svg className="expCheck" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ExperimentsModal({ onClose }) {
  const [tone, setTone] = useState(readSelectionTone);
  const groupRef = useRef(null);

  // Stays in step with changes made elsewhere (another tab, the Reset button)
  useEffect(() => subscribeSelectionTone(setTone), []);

  const focusChoice = (id) => groupRef.current?.querySelector(`[data-tone-id="${id}"]`)?.focus();

  // Arrow keys move through the choices and select as they go, like any radio group
  const onGroupKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = Math.max(0, order.indexOf(tone));
    const next = order[(index + step + order.length) % order.length];
    saveSelectionTone(next);
    focusChoice(next);
  };

  const reset = () => {
    resetSelectionTone();
    // Focus stays inside the dialog, on the colour everything went back to
    focusChoice(DEFAULT_SELECTION_TONE);
  };

  // The preview reads the real tokens of the chosen tone; Cycle animates its own in CSS
  const previewStyle =
    tone === CYCLE_SELECTION_TONE
      ? undefined
      : {
          '--p-tint': `var(--selection-tone-${tone}-tint)`,
          '--p-flow': `var(--selection-tone-${tone}-flow)`,
          ...(tone === 'black' ? { '--p-edge': 'var(--selection-tone-black-edge)' } : null),
        };

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
          <button type="button" className="btn btnSecondary" onClick={reset}>
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
              <IconDistinctHighlight size={28} />
            </span>
            <div className="expCardCopy">
              <h4 id="exp-highlight-title" className="expTitle">
                Distinct <mark className="mdHl">highlight</mark> colors
              </h4>
              <p className="expDesc">Choose the color of the text highlight across the whole site, or let it flow through all of them. Select any text to see it.</p>
            </div>
          </div>

          <div className="expGroup" role="radiogroup" aria-label="Highlight color" ref={groupRef} onKeyDown={onGroupKeyDown}>
            <div className="expSwatches">
              {selectionToneOptions.map((option, index) => {
                const selected = tone === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className="expSwatch"
                    data-selected={selected}
                    data-tone-id={option.id}
                    tabIndex={selected ? 0 : -1}
                    style={{ '--i': index, '--sw-light': option.light, '--sw-main': option.main, '--sw-ink': option.id === 'black' ? '#ffffff' : '#0b0f16' }}
                    onClick={() => saveSelectionTone(option.id)}
                  >
                    <span className="expDot">{selected && <IconCheck />}</span>
                    <span className="expSwatchLabel">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              role="radio"
              aria-checked={tone === CYCLE_SELECTION_TONE}
              className="expCycle"
              data-selected={tone === CYCLE_SELECTION_TONE}
              data-tone-id={CYCLE_SELECTION_TONE}
              tabIndex={tone === CYCLE_SELECTION_TONE ? 0 : -1}
              style={{ '--ring': cycleRing }}
              onClick={() => saveSelectionTone(CYCLE_SELECTION_TONE)}
            >
              <span className="expDot expDotCycle">{tone === CYCLE_SELECTION_TONE && <IconCheck />}</span>
              <span className="expCycleCopy">
                <span className="expCycleTitle">Flow through all colors</span>
                <span className="expCycleText">The highlight keeps changing color on its own.</span>
              </span>
            </button>
          </div>

          <div className="expPreview" data-tone={tone} style={previewStyle}>
            <span className="expPreviewLabel">Preview</span>
            <p className="expPreviewLine">
              Every time you select text, <span key={tone} className="expPick"><span className="expPickText">it looks like this</span></span>.
            </p>
          </div>

          <p className="expStatus" role="status">
            {selectionToneLabel(tone)}
            {tone === DEFAULT_SELECTION_TONE ? ' (default)' : ''} · saved on this device
          </p>
        </section>
      </div>
    </Modal>
  );
}
