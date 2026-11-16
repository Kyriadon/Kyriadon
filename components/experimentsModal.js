// ============================================================================
// experimentsModal.js
// The Experiments modal (opened from "Experiments" in the user menu). It is the
// same shared Modal as the Account modal; tone="experiments" gives it the flowing
// white, azure, baby blue and purple surface (styles/experimentsStyles.css).
// ============================================================================
import { Modal } from './siteShell';

export default function ExperimentsModal({ onClose }) {
  return (
    <Modal
      titleId="experimentsTitle"
      title="Experiments"
      subtitle="Early features the site is trying out."
      size="narrow"
      tone="experiments"
      onClose={onClose}
      footer={
        <button type="button" className="btn btnSecondary" onClick={onClose} data-autofocus>
          Done
        </button>
      }
    >
      <p className="expText">Nothing to try right now. New experiments will show up here when they are ready.</p>
    </Modal>
  );
}
