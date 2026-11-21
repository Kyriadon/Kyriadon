// ============================================================================
// demoProfile.js
// A neutral demo profile for showing a profile effect: banner, avatar with a status dot, a status bubble,
// name, handle, badges, buttons, bio and member since. It is a display only, so nothing in it is a
// control. The effect lies on top of the whole card (components/profileEffect.js).
// ============================================================================
import { ProfileEffect } from './profileEffect';

// Six small badges; the tone picks the colour in the CSS
const BADGE_TONES = ['mint', 'azure', 'lime', 'sky', 'violet', 'sand'];

// Message bubble, for the main button
function IconMessage() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

// Four squares, for the second button
function IconGrid() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

// Three dots, for the third button
function IconMore() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18.5" cy="12" r="1.7" />
    </svg>
  );
}

export function DemoProfile({ effectSlug }) {
  return (
    <article className="fxProfile" aria-label="Demo profile with the effect on top">
      <div className="fxProfileBanner" aria-hidden="true" />

      <div className="fxProfileBody">
        {/* Avatar, status dot and the status bubble beside it */}
        <div className="fxAvatarRow">
          <div className="fxAvatarWrap">
            <div className="fxAvatar" aria-hidden="true">
              <svg viewBox="0 0 100 100" width="100%" height="100%" focusable="false">
                <circle cx="50" cy="39" r="17" fill="currentColor" />
                <path d="M16 100c2-25 16-38 34-38s32 13 34 38Z" fill="currentColor" />
              </svg>
            </div>
            <span className="fxStatus" aria-hidden="true" />
          </div>
          <p className="fxBubble">Your status here</p>
        </div>

        {/* Name and handle. They stay clear of the right edge, where effects are allowed to play. */}
        <h2 className="fxName">Display name</h2>
        <p className="fxHandle">
          <span>username</span>
          <span className="fxDot" aria-hidden="true" />
          <span>Role</span>
          <span className="fxTag">TAG</span>
        </p>

        <ul className="fxBadges" aria-hidden="true">
          {BADGE_TONES.map((tone) => (
            <li key={tone} data-tone={tone} />
          ))}
        </ul>

        <div className="fxActions" aria-hidden="true">
          <span className="fxBtn fxBtnMain"><IconMessage />Message</span>
          <span className="fxBtn fxBtnIcon"><IconGrid /></span>
          <span className="fxBtn fxBtnIcon"><IconMore /></span>
        </div>

        <section className="fxSection">
          <h3>Bio</h3>
          <p>A short line about you goes here, and the effect plays on top of it.</p>
        </section>

        <section className="fxSection">
          <h3>Member since</h3>
          <p>1 Jan 2026</p>
        </section>
      </div>

      <ProfileEffect slug={effectSlug} />
    </article>
  );
}

export default DemoProfile;
