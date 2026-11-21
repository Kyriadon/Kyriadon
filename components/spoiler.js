// ============================================================================
// spoiler.js
// The spoiler: ||hidden text|| in the markdown, and a switch on resources.
// It is covered by a smooth grey. With a mouse, an aurora glow flows over it on hover (and on keyboard
// focus). One click, tap or Enter / Space clears the cover and the glow for good, and the content
// fades in. Styles live in styles/announcementStyles.css, colours and timing in lib/siteDesign.js.
//
// The same component covers every kind of content, chosen with `kind`:
//   text    a run of text inside a line (wraps with the line, like the == highlight)
//   image   a picture inside the text (||![alt](url)||)
//   video   a video inside the text
//   box     a block that has its own look: a resource card or a gallery item (use as="div")
//
// While it is covered, the content is not painted, cannot be selected, copied or tabbed to, and is not
// read out: the styles hide it with visibility, so nothing here has to touch it.
//
// Inside a link or a button (a card title, the home panel) a click belongs to that control, so the
// spoiler there stays covered, with no button role of its own. Open the announcement to read it.
// ============================================================================
import { useEffect, useRef, useState } from 'react';

// What the screen reader hears on a covered spoiler, by kind
const LABELS = {
  text: 'Spoiler, press to reveal',
  image: 'Spoiler image, press to reveal',
  video: 'Spoiler video, press to reveal',
  box: 'Spoiler, press to reveal',
};

// Controls that already own a click: a spoiler inside one of them cannot be a button as well
const OWNS_CLICK = 'a, button, summary, [role="button"], [role="link"]';

export function Spoiler({ as: Tag = 'span', kind = 'text', className = '', label, children }) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const [locked, setLocked] = useState(false);

  // Looks once, after the first render, whether a link or a button holds this spoiler
  useEffect(() => {
    const parent = ref.current ? ref.current.parentElement : null;
    setLocked(Boolean(parent && parent.closest(OWNS_CLICK)));
  }, []);

  // Live means it can still be opened by the person. It only opens, it never closes again.
  const live = !revealed && !locked;
  const reveal = () => setRevealed(true);

  const onKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      reveal();
    }
  };

  // After the reveal the element stays focusable by script (tabIndex -1), so a keyboard user who
  // opened it keeps their place instead of losing focus to the page
  return (
    <Tag
      ref={ref}
      className={`mdSpoiler${className ? ` ${className}` : ''}`}
      data-kind={kind}
      data-revealed={revealed ? 'true' : 'false'}
      data-locked={locked && !revealed ? 'true' : undefined}
      role={live ? 'button' : undefined}
      tabIndex={live ? 0 : revealed ? -1 : undefined}
      aria-label={live ? label || LABELS[kind] || LABELS.text : undefined}
      onClick={live ? reveal : undefined}
      onKeyDown={live ? onKeyDown : undefined}
    >
      <span className="mdSpoilerBody">{children}</span>
    </Tag>
  );
}

export default Spoiler;
