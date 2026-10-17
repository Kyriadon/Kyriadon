// ============================================================================
// ruleArt.js
// Icons and enlarged panel art shared by the Rules page (/rules) and the
// Punishments page (/rules/punishments). Stroke icons match the topic icons on the
// About page; the panel art is drawn in the category colours and cropped by the lower
// right edge of its panel (decorative). The Discord mark comes from the shared shell.
// ============================================================================
import { IconDiscord } from './siteShell';

// ----------------------------------------------------------------------------
// Ban hammer (gavel), a solid glyph: a block between two caps with the handle running out
// of the block. The shapes are drawn upright, then turned 45 degrees and centred in the box.
// ----------------------------------------------------------------------------
export function GavelIcon({ size = 28 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      <g transform="translate(-1.32 1.32) rotate(45 12 12)">
        <rect x="8.11" y="5.11" width="7.78" height="7.78" rx="0.75" />
        <rect x="3.41" y="3.87" width="2.59" height="10.26" rx="1.3" />
        <rect x="17.99" y="3.87" width="2.59" height="10.26" rx="1.3" />
        <rect x="10.7" y="11.89" width="2.59" height="11.8" rx="1.3" />
      </g>
    </svg>
  );
}

// ----------------------------------------------------------------------------
// Icons (stroke style, same as the topic icons on the About page)
// ----------------------------------------------------------------------------
export function RuleIcon({ name, size = 22 }) {
  if (name === 'discord') return <IconDiscord size={size} />;
  if (name === 'gavel') return <GavelIcon size={size} />;
  const props = { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false };
  const icons = {
    users: (<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.5-3 2.8-4.7 5.5-4.7s5 1.7 5.5 4.7" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 14.6c1.9.5 3.1 2 3.5 4.4" /></>),
    hash: (<path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15M4 15h15" />),
    idcard: (<><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><circle cx="9" cy="11" r="2" /><path d="M6 16.2c.4-1.5 1.6-2.2 3-2.2s2.6.7 3 2.2M14.5 10.5H18M14.5 14H18" /></>),
    shield: (<><path d="M12 3.5 5 6v5.5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-2.5Z" /><path d="m9 12 2.2 2.2L15.2 10" /></>),
    layers: (<><path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" /><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" /></>),
    cube: (<><path d="M12 3.5 19.5 7.7v8.6L12 20.5l-7.5-4.2V7.7L12 3.5Z" /><path d="M12 12v8.5M4.5 7.7 12 12l7.5-4.3" /></>),
    scale: (<><path d="M12 4v16M8 20h8M5 7.5h14" /><path d="m5 7.5-2.5 6a3 3 0 0 0 5 0L5 7.5ZM19 7.5l-2.5 6a3 3 0 0 0 5 0L19 7.5Z" /></>),
    usercheck: (<><circle cx="10" cy="8" r="3.2" /><path d="M4 19.5c.5-3.2 2.9-5 6-5 1.3 0 2.4.3 3.4.8" /><path d="m15.5 17.5 2 2 3.5-3.8" /></>),
    // Punishments page: the charter scroll, the screenshare monitor and the crosshair
    scroll: (<><path d="M8 4.5h9.5a2 2 0 0 1 2 2V17a2.5 2.5 0 0 1-2.5 2.5H7.5A2.5 2.5 0 0 1 5 17V7.5" /><path d="M5 7.5a3 3 0 0 1 3-3" /><path d="M9 9.5h7M9 13h7M9 16.5h4" /></>),
    monitor: (<><rect x="3" y="4.5" width="18" height="12" rx="2.2" /><path d="M9 20h6M12 16.5V20" /><path d="m9.5 10.2 1.8 1.8 3.2-3.4" /></>),
    crosshair: (<><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2.2" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" /></>),
  };
  return <svg {...props}>{icons[name]}</svg>;
}

// ----------------------------------------------------------------------------
// Panel art: one enlarged illustration per category
// ----------------------------------------------------------------------------

// Minecraft: an isometric block built from small tiles, lighter on top, darker on the right
const BLOCK_FACES = [
  { origin: [12, 33], u: [48, -27], v: [48, 27], base: 0.6 },
  { origin: [12, 33], u: [48, 27], v: [0, 54], base: 0.36 },
  { origin: [60, 60], u: [48, -27], v: [0, 54], base: 0.2 },
];
const BLOCK_TILES = 4;

export function BlockArt() {
  const step = 1 / BLOCK_TILES;
  const tiles = BLOCK_FACES.flatMap((face, faceIndex) =>
    Array.from({ length: BLOCK_TILES * BLOCK_TILES }, (_, index) => {
      const column = index % BLOCK_TILES;
      const row = Math.floor(index / BLOCK_TILES);
      const point = (a, b) => [face.origin[0] + face.u[0] * a + face.v[0] * b, face.origin[1] + face.u[1] * a + face.v[1] * b].map((value) => value.toFixed(2)).join(' ');
      const a = column * step;
      const b = row * step;
      const shade = ((column * 5 + row * 3 + column * row + faceIndex * 2) % 4) * 0.09;
      return <polygon key={`${faceIndex}-${index}`} points={[point(a, b), point(a + step, b), point(a + step, b + step), point(a, b + step)].join(' ')} fill="currentColor" fillOpacity={(face.base + shade).toFixed(2)} stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" strokeLinejoin="round" />;
    }),
  );
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {tiles}
    </svg>
  );
}

// General: a shield with a check, two outlines deep
export function ShieldArt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3.5 5 6v5.5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-2.5Z" fill="currentColor" fillOpacity="0.16" strokeWidth="0.8" />
      <path d="M12 6 7.5 7.6v3.9c0 2.8 1.9 4.9 4.5 6 2.6-1.1 4.5-3.2 4.5-6V7.6L12 6Z" strokeWidth="0.6" strokeOpacity="0.7" />
      <path d="m9.2 11.9 2 2 3.8-3.9" strokeWidth="1.1" />
    </svg>
  );
}

// Cheating: a crosshair, three rings deep, with a filled core
export function CrosshairArt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.6" fill="currentColor" fillOpacity="0.1" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="5.4" strokeWidth="0.6" strokeOpacity="0.75" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" fillOpacity="0.55" strokeWidth="0.6" />
      <path d="M12 1.6v4.2M12 18.2v4.2M1.6 12h4.2M18.2 12h4.2" strokeWidth="1" />
    </svg>
  );
}

// Charter: a monitor with a check, a session bar and a window of scan lines (the screenshare)
export function MonitorArt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="2.4" y="3.6" width="19.2" height="13" rx="2.2" fill="currentColor" fillOpacity="0.14" strokeWidth="0.8" />
      <rect x="4.4" y="5.6" width="15.2" height="9" rx="1.2" strokeWidth="0.5" strokeOpacity="0.7" />
      <path d="M6.2 8h5.4M6.2 10.2h8.2M6.2 12.4h4.4" strokeWidth="0.6" strokeOpacity="0.8" />
      <path d="m14.3 11.9 1.5 1.5 2.7-3" strokeWidth="1.1" />
      <path d="M8.6 20.4h6.8M12 16.6v3.8" strokeWidth="0.9" />
    </svg>
  );
}
