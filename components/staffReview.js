// ============================================================================
// staffReview.js
// Admin review of staff logins, used by the debug logs:
//   ApprovalBang   the red ! that bobs on a staff login nobody has reviewed yet
//   ApprovalPanel  Approve / Disapprove (inside the log details, admins only)
//   ActionModal    after a disapproval: kick the session or block the login (7 days at most)
// Styles live in styles/accountStyles.css.
// ============================================================================
import { useEffect, useState } from 'react';
import { IconCheck, IconLock, IconWarning, Modal } from './siteShell';

const DAY = 24 * 60 * 60 * 1000;
const UNITS = [
  { id: 'minutes', label: 'Minutes', ms: 60 * 1000 },
  { id: 'hours', label: 'Hours', ms: 60 * 60 * 1000 },
  { id: 'days', label: 'Days', ms: DAY },
];
const PRESETS = [
  { label: '1 hour', amount: 1, unit: 'hours' },
  { label: '6 hours', amount: 6, unit: 'hours' },
  { label: '1 day', amount: 1, unit: 'days' },
  { label: '3 days', amount: 3, unit: 'days' },
  { label: '7 days', amount: 7, unit: 'days' },
];
const MIN_BLOCK_MS = 60 * 1000;
const MAX_BLOCK_MS = 7 * DAY;
const MESSAGE_MAX = 200;

const formatWhen = (ms) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

// ----------------------------------------------------------------------------
// The red ! (it bobs up and down; the site's reduced-motion rule keeps it still when asked)
// ----------------------------------------------------------------------------
export function ApprovalBang({ size = 18 }) {
  return (
    <span className="approvalBang" role="img" aria-label="Staff login waiting for review" title="Staff login waiting for review">
      <svg viewBox="0 0 24 24" width={size} height={size} focusable="false" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="var(--color-critical)" />
        <path d="M12 7.2v6" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="12" cy="16.8" r="1.4" fill="#ffffff" />
      </svg>
    </span>
  );
}

// What was done after a disapproval, as a sentence
export function describeAction(action) {
  if (!action) return '';
  if (action.type === 'kick') return `${action.by?.name || 'An admin'} kicked the session.`;
  return `${action.by?.name || 'An admin'} blocked the login until ${formatWhen(action.until)}: ${action.message}`;
}

// ----------------------------------------------------------------------------
// Approve / Disapprove. Each needs a second click (the same confirm step as Delete),
// because a review can only be given once.
// ----------------------------------------------------------------------------
export function ApprovalPanel({ approval, onDecide, onOpenAction }) {
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const pending = approval.status === 'pending';

  // The confirmation expires after 4 seconds
  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(null), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const choose = async (op) => {
    if (busy) return;
    if (confirming !== op) {
      setConfirming(op);
      return;
    }
    setConfirming(null);
    setBusy(true);
    setNote('');
    const result = await onDecide(approval, op);
    setBusy(false);
    if (result?.ok && op === 'disapprove') onOpenAction(approval);
    else if (!result?.ok && result?.code === 'already_decided') setNote(`Another admin already ${result.approval?.status === 'approved' ? 'approved' : 'disapproved'} this login.`);
    else if (!result?.ok && result?.code !== 'busy') setNote(result?.message || 'The review could not be saved. Try again.');
  };

  return (
    <section className="detailSection detailWide acctReview" data-status={approval.status} aria-label="Staff login review">
      <h5 className="studioLabel">Review</h5>

      {pending ? (
        <>
          <div className="detailInline">
            <ApprovalBang />
            <span className="detailText">{approval.userName} logged in as staff. Approve it if this was them.</span>
          </div>
          <div className="studioRow">
            <button type="button" className={`btn ${confirming === 'approve' ? 'btnPrimary' : 'btnSecondary'}`} onClick={() => choose('approve')} disabled={busy}>
              <IconCheck size={16} />
              {confirming === 'approve' ? 'Confirm approve' : 'Approve'}
            </button>
            <button type="button" className={`btn ${confirming === 'disapprove' ? 'btnDanger' : 'btnSecondary'}`} onClick={() => choose('disapprove')} disabled={busy}>
              <IconWarning size={16} />
              {confirming === 'disapprove' ? 'Confirm disapprove' : 'Disapprove'}
            </button>
          </div>
          <p className="helperText">A review is final: it can only be given once, by one admin, and everyone sees it at once.</p>
        </>
      ) : (
        <>
          <div className="detailInline">
            <span className="badge" data-tone={approval.status === 'approved' ? 'success' : 'danger'}>
              {approval.status === 'approved' ? <IconCheck size={12} /> : <IconWarning size={12} />}
              {approval.status === 'approved' ? 'Approved' : 'Disapproved'}
            </span>
            <span className="detailText">
              by {approval.decidedBy?.name || 'an admin'}
              {approval.decidedAt ? ` on ${formatWhen(approval.decidedAt)}` : ''}
            </span>
          </div>
          {approval.action && <p className="detailText">{describeAction(approval.action)}</p>}
          {approval.status === 'disapproved' && !approval.action && (
            <div className="studioRow">
              <button type="button" className="btn btnDanger" onClick={() => onOpenAction(approval)}>
                <IconLock size={16} />
                Kick or block
              </button>
            </div>
          )}
        </>
      )}
      {note && (
        <p className="helperText acctNote" data-tone="error" role="alert">
          {note}
        </p>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// After a disapproval: kick the staff session, or block their login for a while
// with a message. Admins only (the server checks the role again). One action only.
// ----------------------------------------------------------------------------
export function ActionModal({ approval, onAct, onClose }) {
  const [type, setType] = useState('kick');
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState('days');
  const [message, setMessage] = useState('');
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const unitMs = UNITS.find((item) => item.id === unit).ms;
  const durationMs = Math.round(Number(amount) * unitMs);
  const durationOk = Number.isFinite(durationMs) && durationMs >= MIN_BLOCK_MS && durationMs <= MAX_BLOCK_MS;
  const messageOk = message.trim().length > 0;
  const done = Boolean(approval.action);
  const ready = !done && !busy && (type === 'kick' || (durationOk && messageOk));

  // The confirmation expires after 4 seconds, and any change cancels it
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  useEffect(() => setArmed(false), [type, amount, unit, message]);

  const run = async () => {
    if (!ready) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setBusy(true);
    setNote('');
    const result = await onAct(approval, type === 'kick' ? { op: 'kick' } : { op: 'block', durationMs, message: message.trim() });
    setBusy(false);
    if (result?.ok) onClose();
    else setNote(result?.message || 'The action could not be saved. Try again.');
  };

  const label = type === 'kick' ? 'Kick session' : 'Block login';

  return (
    <Modal
      titleId="staffActionTitle"
      title="Take action"
      subtitle={`Staff login by ${approval.userName}`}
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btnSecondary" onClick={onClose} data-autofocus>
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button type="button" className="btn btnDanger" onClick={run} disabled={!ready}>
              {armed ? `Confirm: ${label.toLowerCase()}` : label}
            </button>
          )}
        </>
      }
    >
      {done ? (
        <div className="stateBox" role="status">
          <IconCheck size={18} />
          <span>{describeAction(approval.action)}</span>
        </div>
      ) : (
        <>
          <div className="segmented" role="group" aria-label="Action">
            <button type="button" className="segment" aria-pressed={type === 'kick'} onClick={() => setType('kick')}>
              Kick session
            </button>
            <button type="button" className="segment" aria-pressed={type === 'block'} onClick={() => setType('block')}>
              Block login
            </button>
          </div>

          {type === 'kick' ? (
            <p className="helperText">Ends their staff session now. They can log in again straight away.</p>
          ) : (
            <section className="controlSection" aria-label="Block settings">
              <h5 className="studioLabel">Block for</h5>
              <div className="segmented" role="group" aria-label="Quick durations">
                {PRESETS.map((preset) => (
                  <button key={preset.label} type="button" className="segment" aria-pressed={Number(amount) === preset.amount && unit === preset.unit} onClick={() => { setAmount(String(preset.amount)); setUnit(preset.unit); }}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="studioRow">
                <label className="studioField acctAmount">
                  <span className="studioLabel">Amount</span>
                  <input className="studioInput" type="number" inputMode="numeric" min="1" max="10080" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={!durationOk} />
                </label>
                <div className="segmented" role="group" aria-label="Unit">
                  {UNITS.map((item) => (
                    <button key={item.id} type="button" className="segment" aria-pressed={unit === item.id} onClick={() => setUnit(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="helperText acctNote" data-tone={durationOk ? undefined : 'error'}>
                {durationOk ? `Blocked until ${formatWhen(Date.now() + durationMs)}. They are also logged out now.` : 'Choose between 1 minute and 7 days.'}
              </p>
              <label className="studioField">
                <span className="studioLabel">Message they will see</span>
                <textarea className="studioInput acctTextarea" value={message} maxLength={MESSAGE_MAX} rows={3} onChange={(event) => setMessage(event.target.value)} aria-invalid={!messageOk} />
              </label>
              <p className="helperText">
                {message.length} / {MESSAGE_MAX}
              </p>
            </section>
          )}
        </>
      )}
      {note && (
        <p className="helperText acctNote" data-tone="error" role="alert">
          {note}
        </p>
      )}
    </Modal>
  );
}
