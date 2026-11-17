// ============================================================================
// experimentsModal.js
// Experiments: features the site is trying out. Opened from the user menu (siteShell.js).
// Experiment 1: Distinct highlight colors. The person picks the colour of the site-wide text
// highlight, or lets it flow through every colour. The choice is kept by lib/selectionTone.js.
// ============================================================================
import { useEffect, useState } from 'react';
import { Modal, IconDistinctHighlight } from './siteShell';
import {
  CYCLE_SELECTION_TONE,
  readSelectionTone,
  resetSelectionTone,
  saveSelectionTone,
  selectionToneOptions,
  subscribeSelectionTone,
} from '../lib/selectionTone';

export default function ExperimentsModal({ onClose }) {
  const [tone, setTone] = useState(readSelectionTone);

  // Stays in step with changes made elsewhere (another tab, the Reset button)
  useEffect(() => subscribeSelectionTone(setTone), []);

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
              <IconDistinctHighlight size={24} />
            </span>
            <div className="expCardCopy">
              <h4 id="exp-highlight-title" className="expTitle">
                Distinct <mark className="mdHl">highlight</mark> colors
              </h4>
              <p className="expDesc">Pick the color of the text highlight across the whole site, or let it flow through all of them. Saved on this device.</p>
            </div>
          </div>

          <div className="segmented expSegmented" role="group" aria-label="Highlight color">
            {selectionToneOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="segment expSegment"
                aria-pressed={tone === option.id}
                style={{ '--c-light': option.light, '--c-main': option.main }}
                onClick={() => saveSelectionTone(option.id)}
              >
                {option.label}
              </button>
            ))}
            <button type="button" className="segment expSegment" aria-pressed={tone === CYCLE_SELECTION_TONE} onClick={() => saveSelectionTone(CYCLE_SELECTION_TONE)}>
              Flow through all colors
            </button>
          </div>

          <p className="expTry">Try it: select this sentence to see your highlight.</p>
        </section>
      </div>
    </Modal>
  );
}
