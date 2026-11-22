// ============================================================================
// demoProfile.js
// A blank demo profile. It follows the layout of a long Discord profile: banner, avatar with a status dot
// and a status bubble, name, handle and pill, a shelf of badges, the main button, the tabs, the orbs panel,
// then the sections (bio, member since, connections). Every field is an empty rounded area covered like the
// site's ||spoiler|| markdown, in the teal spoiler gradient, with no text and no badges. The card is a
// translucent teal box, and a diluted teal gradient flows slowly across it, on top of everything
// (styles/profileEffects.css). It is a display only, so nothing in it is a control.
// ============================================================================

// The tabs: w is the width of the label's cover. The first tab is the open one.
const TABS = [
  { key: 'main', w: '8.5cqw', active: true },
  { key: 'board', w: '10.2cqw' },
  { key: 'activity', w: '13.6cqw' },
  { key: 'wishlist', w: '13.8cqw' },
];

// The bio: paragraphs of lines. w is the width of a line's cover, as a share of the card's inner width.
const BIO = [
  [{ w: '93%' }, { w: '72%' }],
  [{ w: '100%' }, { w: '11%' }],
  [{ w: '42%' }],
];

// One blank field. The size comes from the custom properties, the look from .fxField.
function Field({ w, h, className = '' }) {
  return <span className={`fxField ${className}`.trim()} style={{ '--w': w, '--h': h }} />;
}

export function DemoProfile() {
  return (
    <article className="fxProfile" aria-label="Blank demo profile">
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

        {/* Name with its chevron, handle with its pill, and the shelf of badges */}
        <div className="fxIdentity">
          <div className="fxNameRow">
            <Field className="fxName" />
            <Field className="fxChevron" />
          </div>
          <div className="fxHandleRow">
            <Field className="fxHandle" />
            <Field className="fxPill" />
          </div>
          <div className="fxBadges">
            {Array.from({ length: 6 }, (_, n) => (
              <Field key={n} className="fxBadge" />
            ))}
            <Field className="fxBadgeMore" />
          </div>
        </div>

        <Field className="fxBtn" />

        <div className="fxTabs">
          {TABS.map((tab) => (
            <div key={tab.key} className="fxTab" data-active={tab.active ? 'true' : undefined}>
              <Field className="fxTabLabel" w={tab.w} />
            </div>
          ))}
        </div>

        {/* The orbs panel: a label and a value */}
        <div className="fxPanel">
          <Field className="fxPanelLabel" />
          <Field className="fxPanelValue" />
        </div>

        <section className="fxSection">
          <Field className="fxLabel" w="5.4cqw" />
          <div className="fxLines">
            {BIO.map((paragraph, p) => (
              <div key={p} className="fxPara">
                {paragraph.map((line, l) => (
                  <Field key={l} className="fxLine" w={line.w} />
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="fxSection">
          <Field className="fxLabel" w="24.7cqw" />
          <div className="fxMember">
            <Field className="fxIcon" />
            <Field className="fxDate" />
          </div>
        </section>

        <section className="fxSection">
          <Field className="fxLabel" w="27cqw" />
          <div className="fxPanel fxConnection">
            <Field className="fxConnIcon" />
            <Field className="fxConnName" />
            <Field className="fxConnCheck" />
            <Field className="fxConnGo" />
          </div>
        </section>
      </div>
    </article>
  );
}

export default DemoProfile;
