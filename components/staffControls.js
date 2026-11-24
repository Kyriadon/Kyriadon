// ============================================================================
// staffControls.js
// The Staff Controls modal (opened from "Staff controls" in the user menu, only for staff
// who are logged in, and admins). It opens with a scene: "Loading Staff Controls" with the
// letters bobbing and a gradient flowing through them, then the translucent screen slides up
// with a motion blur and reveals the modal. Ctrl + F (Cmd + F on Apple devices) switches the
// modal to fullscreen and back. Every section is a note box with a Title Case title; the
// default titles, the timings and the colours live in lib/siteDesign.js (staffControls*).
// Styles: styles/staffControlsStyles.css. Reduced motion has a fallback for every effect.
// The Staff controls button that opens this modal lives in the Account modal (accountModal.js).
// ============================================================================
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { IconMegaphone, IconRows, Modal, logEvent } from './siteShell';
import { staffControlsText as text, staffControlsTiming as timing } from '../lib/siteDesign';
import { useAccount } from '../lib/accountClient';

// The Announcements manager is only downloaded when a staff member opens it
const AnnouncementManager = dynamic(() => import('./announcementManager'), { ssr: false });

const prefersReducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// ----------------------------------------------------------------------------
// Icons (stroke style, same as the rest of the site)
// ----------------------------------------------------------------------------
const iconProps = (size) => ({
  viewBox: '0 0 24 24',
  width: size,
  height: size,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
});

function IconExpand({ size = 18 }) {
  return (
    <svg {...iconProps(size)}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  );
}

function IconCollapse({ size = 18 }) {
  return (
    <svg {...iconProps(size)}>
      <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />
    </svg>
  );
}

function IconArrowRight({ size = 16 }) {
  return (
    <svg {...iconProps(size)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// ----------------------------------------------------------------------------
// Small pieces
// ----------------------------------------------------------------------------
function RoleChip({ role }) {
  return (
    <span className="mention" data-tone={role} data-flow={role === 'developer' ? 'live' : undefined}>
      <span className="mentionName">{role === 'developer' ? 'Developer' : 'Staff'}</span>
    </span>
  );
}

// The letters bob up and down once, in a wave. One blended gradient (teal, cyan, baby blue) runs across
// the WHOLE text and flows through it: every letter paints the same gradient, sized to the whole text
// (--w) and shifted by the letter's own distance from the left edge (--ox), so the colours blend from
// letter to letter instead of each letter having one colour. The sizes are measured, and measured
// again when the text changes size (for example when the font has loaded).
function FlowingText({ value }) {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const measure = () => {
      const box = root.getBoundingClientRect();
      root.style.setProperty('--w', `${Math.max(1, Math.ceil(box.width))}px`);
      root.querySelectorAll('.scLetter').forEach((letter) => {
        letter.style.setProperty('--ox', `${letter.getBoundingClientRect().left - box.left}px`);
      });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(root);
    document.fonts?.ready?.then(measure);
    return () => observer?.disconnect();
  }, [value]);

  let index = -1;
  return (
    <span className="scLoading" ref={rootRef} aria-hidden="true">
      {value.split(' ').map((word, wordIndex) => (
        <span className="scWord" key={`${word}-${wordIndex}`}>
          {[...word].map((character) => {
            index += 1;
            return (
              <span className="scLetter" key={index} style={{ '--i': index }}>
                {character}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

// The opening scene: a black screen with a translucent frosted sheet on top of it (the sheet blurs the
// black screen). It never shows the page behind it blurred. When it leaves, it slides up.
function Scene({ leaving }) {
  return (
    <div className="scScene" data-phase={leaving ? 'leaving' : 'loading'} role="status" aria-live="polite">
      <div className="scBlack" aria-hidden="true" />
      <div className="scSheet" aria-hidden="true" />
      <div className="scSceneInner">
        <span className="scSr">{text.loading}</span>
        <FlowingText value={text.loading} />
        <span className="scLoadingLine" aria-hidden="true" />
      </div>
    </div>
  );
}

// A section of the modal: a note box with a Title Case title
function NoteBox({ id, icon, title, children }) {
  return (
    <section className="scNote" aria-labelledby={id}>
      <header className="scNoteHead">
        <span className="scNoteIcon" aria-hidden="true">
          {icon}
        </span>
        <h4 id={id} className="scNoteTitle">
          {title}
        </h4>
        <RoleChip role="staff" />
      </header>
      {children}
    </section>
  );
}

// ----------------------------------------------------------------------------
// The modal
// ----------------------------------------------------------------------------
export default function StaffControls({ onClose }) {
  const { viewer, staff } = useAccount();
  const unlocked = Boolean(viewer?.admin || (viewer?.staff && staff?.loggedIn && !staff?.blocked));

  const [phase, setPhase] = useState('loading'); // loading, then leaving (the scene slides up), then ready
  const [fullscreen, setFullscreen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [modifier, setModifier] = useState('Ctrl');

  useEffect(() => {
    logEvent({ code: 'CONTROLS_PANEL_OPENED', reason: 'Opened the staff controls' });
    // Show the command key on Apple devices (set after mount to avoid a hydration mismatch)
    if (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) setModifier('\u2318');
  }, []);

  // The staff session ended (or was blocked) while this was open: close it
  useEffect(() => {
    if (viewer && !unlocked) onClose();
  }, [viewer, unlocked, onClose]);

  // Scene timeline: the loading text holds, then the screen slides up, then it is gone
  useEffect(() => {
    const hold = window.setTimeout(() => setPhase('leaving'), prefersReducedMotion() ? 700 : timing.holdMs);
    return () => window.clearTimeout(hold);
  }, []);

  useEffect(() => {
    if (phase !== 'leaving') return undefined;
    const done = window.setTimeout(() => setPhase('ready'), prefersReducedMotion() ? 220 : timing.leaveMs);
    return () => window.clearTimeout(done);
  }, [phase]);

  // Ctrl + F (Cmd + F on Apple devices) toggles fullscreen. While the Announcements manager is
  // open on top, or the scene is still loading, the browser keeps its own search.
  useEffect(() => {
    if (managerOpen || phase === 'loading') return undefined;
    const onKey = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'f') return;
      event.preventDefault();
      setFullscreen((value) => !value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [managerOpen, phase]);

  const openManager = () => {
    logEvent({ code: 'ANNOUNCEMENT_MANAGER_OPENED', reason: 'Opened the announcements manager' });
    setManagerOpen(true);
  };

  return (
    <>
      <Modal
        titleId="staffControlsTitle"
        title={text.title}
        subtitle={text.subtitle}
        tone="staff-controls"
        onClose={onClose}
        footer={
          <button type="button" className="btn btnSecondary" onClick={onClose} data-autofocus>
            Done
          </button>
        }
      >
        <div className="scRoot" data-phase={phase} data-fullscreen={fullscreen ? 'true' : 'false'}>
          {/* Fullscreen prompt: a note box with the key combination */}
          <div className="scHint" role="note">
            <span className="scNoteIcon" aria-hidden="true">
              {fullscreen ? <IconCollapse /> : <IconExpand />}
            </span>
            <div className="scHintBody">
              <strong className="scHintTitle">{text.fullscreenTitle}</strong>
              <p className="scHintText">
                Press{' '}
                <span className="kbdGroup">
                  <span className="kbd">{modifier}</span>
                  <span className="kbd">F</span>
                </span>{' '}
                to {fullscreen ? 'leave' : 'enter'} fullscreen.
              </p>
            </div>
            <button type="button" className="btn btnSecondary btnCompact" onClick={() => setFullscreen((value) => !value)} aria-pressed={fullscreen}>
              {fullscreen ? 'Leave Fullscreen' : 'Enter Fullscreen'}
            </button>
          </div>

          <div className="scGrid">
            {/* Announcements manager (moved here from the Account modal) */}
            <NoteBox id="scAnnouncementsTitle" icon={<IconMegaphone size={18} />} title={text.announcementsTitle}>
              <p className="scNoteText">
                Create, edit and review announcements, and see their statistics. You can change the ones you created{viewer?.admin ? ', and as an admin any other too' : ''}.
              </p>
              <div className="scNoteActions">
                <button type="button" className="btn btnPrimary" onClick={openManager}>
                  <IconMegaphone size={16} />
                  Open Announcements Manager
                </button>
              </div>
            </NoteBox>

            {/* Debug logs: what the page shows, its categories and its labels, and the way there */}
            <NoteBox id="scDebugTitle" icon={<IconRows size={18} />} title={text.debugLogsTitle}>
              <p className="scNoteText">Every user action, bug and error on the website is recorded in the debug logs, grouped into categories and marked with labels.</p>

              <div className="scLegend">
                <h5 className="scLegendTitle">Categories</h5>
                <ul className="scLegendList">
                  <li>
                    <span className="badge" data-tone="info">
                      Info
                    </span>
                    <span>Page views, clicks and other user actions.</span>
                  </li>
                  <li>
                    <span className="badge" data-tone="warning">
                      Warning
                    </span>
                    <span>Console warnings and problems that did not break anything.</span>
                  </li>
                  <li>
                    <span className="badge" data-tone="danger">
                      Error
                    </span>
                    <span>Errors and failures that need a fix.</span>
                  </li>
                </ul>
              </div>

              <div className="scLegend">
                <h5 className="scLegendTitle">Labels</h5>
                <ul className="scLegendList">
                  <li>
                    <RoleChip role="staff" />
                    <span>Can delete logs and see the server logs.</span>
                  </li>
                  <li>
                    <RoleChip role="developer" />
                    <span>Starts in the raw view and sees the logs relevant to the running release.</span>
                  </li>
                  <li>
                    <span className="badge" data-tone="danger">
                      Admin
                    </span>
                    <span>Reviews every staff login.</span>
                  </li>
                  <li>
                    <span className="badge" data-tone="neutral">
                      Pinned
                    </span>
                    <span>Server logs, like staff logins, stay at the top.</span>
                  </li>
                </ul>
              </div>

              <div className="scNoteActions">
                <Link className="btn btnPrimary" href="/debug-logs" onClick={onClose}>
                  <IconRows size={16} />
                  Open Debug Logs
                  <IconArrowRight />
                </Link>
              </div>
            </NoteBox>
          </div>
        </div>
      </Modal>

      {/* The opening scene sits above the whole page until it has slid away */}
      {phase !== 'ready' && createPortal(<Scene leaving={phase === 'leaving'} />, document.body)}

      {/* A sibling of the modal (not a child), so a key pressed in the manager never closes the controls */}
      {managerOpen && <AnnouncementManager onClose={() => setManagerOpen(false)} />}
    </>
  );
}
