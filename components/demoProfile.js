// ============================================================================
// demoProfile.js
// A blank demo profile for showing a profile effect. It follows the layout of a long Discord profile:
// banner, avatar with a status dot and a status bubble, name, handle, three buttons, then the sections
// (bio, member since, connections, roles, mutual servers, note, activity). Every field is an empty,
// rounded rectangle like the panels of this site, with no text and no badges. It is a display only, so
// nothing in it is a control. The effect lies on top of the whole card (components/profileEffect.js).
// ============================================================================
import { ProfileEffect } from './profileEffect';

// The sections under the buttons. label is the width of the small field above the section, and every row
// is one field: h is its height in cqw (a hundredth of the card's width), w is an optional width and cols
// splits the row into that many fields side by side.
const SECTIONS = [
  { key: 'bio', label: '12cqw', rows: [{ h: 24 }] },
  { key: 'since', label: '22cqw', rows: [{ h: 9, w: '58%' }] },
  { key: 'connections', label: '26cqw', rows: [{ h: 11 }, { h: 11 }, { h: 11 }] },
  { key: 'roles', label: '14cqw', rows: [{ h: 8, cols: 3 }, { h: 8, cols: 2 }] },
  { key: 'mutual', label: '30cqw', rows: [{ h: 11 }, { h: 11 }] },
  { key: 'note', label: '10cqw', rows: [{ h: 16 }] },
  { key: 'activity', label: '18cqw', rows: [{ h: 22 }] },
];

// One blank field. The size comes from the custom properties, the look from .fxField.
function Field({ w, h, className = '' }) {
  return <span className={`fxField ${className}`.trim()} style={{ '--w': w, '--h': h }} />;
}

export function DemoProfile({ effectSlug }) {
  return (
    <article className="fxProfile" aria-label="Blank demo profile with the effect on top">
      <div className="fxProfileBanner" aria-hidden="true" />

      <div className="fxProfileBody" aria-hidden="true">
        {/* Avatar, status dot and the status bubble beside it */}
        <div className="fxAvatarRow">
          <div className="fxAvatarWrap">
            <div className="fxAvatar" />
            <span className="fxStatus" />
          </div>
          <Field className="fxBubble" />
        </div>

        {/* Name and handle. They stay clear of the right edge, where effects are allowed to play. */}
        <div className="fxIdentity">
          <Field className="fxName" />
          <Field className="fxHandle" />
        </div>

        <div className="fxActions">
          <Field className="fxBtnMain" />
          <Field className="fxBtnIcon" />
          <Field className="fxBtnIcon" />
        </div>

        <div className="fxRule" />

        {SECTIONS.map((section) => (
          <section key={section.key} className="fxSection">
            <Field className="fxLabel" w={section.label} />
            {section.rows.map((row, index) =>
              row.cols ? (
                <div key={index} className="fxRow">
                  {Array.from({ length: row.cols }, (_, n) => (
                    <Field key={n} h={`${row.h}cqw`} />
                  ))}
                </div>
              ) : (
                <Field key={index} h={`${row.h}cqw`} w={row.w} />
              )
            )}
          </section>
        ))}
      </div>

      <ProfileEffect slug={effectSlug} />
    </article>
  );
}

export default DemoProfile;
