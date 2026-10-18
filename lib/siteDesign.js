// ============================================================================
// siteDesign.js
// Single source of truth for the Kyriadon design system (see the Design Doctrine).
// Every token below is converted to a CSS custom property by buildCssVariables()
// and injected once in pages/_app.js. Components and stylesheets consume the
// variables; they never invent values of their own.
// ============================================================================

// ----------------------------------------------------------------------------
// Helper: build a linear-gradient string from an angle and a list of stops
// ----------------------------------------------------------------------------
const linear = (angle, list) => `linear-gradient(${angle}deg, ${list.join(', ')})`;

// ----------------------------------------------------------------------------
// Fonts: named families (Doctrine 4.1). Components may never declare their own.
// Soft, rounded geometric sans for display/headings, friendly sans for UI/body.
// ----------------------------------------------------------------------------
export const fonts = {
  // One Google Fonts request that covers every family below
  googleUrl:
    'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@500;600;700;800&display=swap',
  families: {
    display: "'Outfit', 'Figtree', system-ui, sans-serif",
    heading: "'Outfit', 'Figtree', system-ui, sans-serif",
    body: "'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif",
    ui: "'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    // Controlled family for brand moments (role names, credits)
    special: "'Outfit', 'Figtree', system-ui, sans-serif",
  },
};

// ----------------------------------------------------------------------------
// Typography: every heading level and body role has its own definition
// (Doctrine 4.2 and 4.3). Hierarchy is family + size + weight + leading + tracking.
// ----------------------------------------------------------------------------
export const typography = {
  h1: { family: 'var(--font-display)', size: 'clamp(2.25rem, 1.4rem + 3.2vw, 3.75rem)', weight: 700, lineHeight: 1.04, tracking: '-0.035em' },
  h2: { family: 'var(--font-heading)', size: 'clamp(1.15rem, 1rem + 0.8vw, 1.6rem)', weight: 600, lineHeight: 1.25, tracking: '-0.015em' },
  h3: { family: 'var(--font-heading)', size: '1.125rem', weight: 600, lineHeight: 1.3, tracking: '-0.01em' },
  h4: { family: 'var(--font-heading)', size: '1rem', weight: 600, lineHeight: 1.35, tracking: '-0.005em' },
  h5: { family: 'var(--font-ui)', size: '0.875rem', weight: 600, lineHeight: 1.4, tracking: '0em' },
  h6: { family: 'var(--font-ui)', size: '0.75rem', weight: 600, lineHeight: 1.4, tracking: '0.02em' },
  body: { family: 'var(--font-body)', size: '1rem', weight: 400, lineHeight: 1.65, tracking: '0em' },
  bodySecondary: { family: 'var(--font-body)', size: '0.9375rem', weight: 400, lineHeight: 1.6, tracking: '0em' },
  caption: { family: 'var(--font-ui)', size: '0.8125rem', weight: 400, lineHeight: 1.5, tracking: '0em' },
  meta: { family: 'var(--font-mono)', size: '0.75rem', weight: 500, lineHeight: 1.4, tracking: '0em' },
  label: { family: 'var(--font-ui)', size: '0.8125rem', weight: 600, lineHeight: 1.4, tracking: '0.01em' },
  helper: { family: 'var(--font-ui)', size: '0.75rem', weight: 400, lineHeight: 1.5, tracking: '0em' },
  overline: { family: 'var(--font-ui)', size: '0.6875rem', weight: 600, lineHeight: 1.4, tracking: '0.08em' },
};

// ----------------------------------------------------------------------------
// Spacing scale (Doctrine 16): 4px base, no random values
// ----------------------------------------------------------------------------
export const spacing = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
};

// ----------------------------------------------------------------------------
// Radius family (Doctrine 17): a component's radius communicates its category
// ----------------------------------------------------------------------------
export const radii = {
  tile: '2px', // server icon tile (explicit brief)
  subtle: '8px', // kbd keys, role chips, small inline elements
  control: '12px', // buttons, inputs, view toggles
  card: '16px', // cards and list rows
  panel: '24px', // panels
  modal: '28px', // modals and palettes
  pill: '999px', // badges, footer slug, social buttons
};

// ----------------------------------------------------------------------------
// Motion (Doctrine 14): fast, subtle, purposeful. "lay*" drives the hero panel.
// ----------------------------------------------------------------------------
export const motion = {
  fast: '140ms',
  base: '240ms',
  slow: '420ms',
  lay: '620ms',
  flow: '5s',
  ease: 'cubic-bezier(0.22, 0.9, 0.3, 1)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  layAngle: '11deg',
  layShift: '22px',
  perspective: '1400px',
};

// ----------------------------------------------------------------------------
// Layout (Doctrine 15): readable width on monitors, never stretch uncontrolled
// ----------------------------------------------------------------------------
export const layout = {
  maxWidth: '1180px',
  searchWidth: '26rem',
  // Width of single-purpose strips (a search field, a status panel) that sit centred above
  // the page grid on large screens instead of stretching across every column
  centeredWidth: '44rem',
  fadeHeight: '6rem',
  logoSize: '3rem',
};

// ----------------------------------------------------------------------------
// Buttons (Doctrine 10): one shared geometry for every family
// ----------------------------------------------------------------------------
export const buttons = {
  height: '2.5rem',
  heightCompact: '2rem',
  paddingX: '1rem',
  gap: '0.5rem',
  size: '0.875rem',
  weight: 600,
  // Hover on the primary button is only a slight brightening, no movement
  hoverBrightness: 1.1,
};

// ----------------------------------------------------------------------------
// Gradient stops: kept as arrays so SVG icons can reuse the exact same colours
// ----------------------------------------------------------------------------
export const gradientStops = {
  viewGrid: ['#22e3ff', '#3dff9a'], // neon blue to green (Grid icon hover)
  viewList: ['#5aa7ff', '#ff6fd0'], // blue to pink (List icon hover)
  slugK: ['#ff9ad5', '#b7a4ff', '#6ec6ff'], // bubblegum pink to blue (K mark)
  heart: ['#ff6fb5', '#b388ff', '#5ee7ff'], // heart hover
  star: ['#ffe08a', '#f5b301'], // Stars icon: light gold, gold
  boosterTwo: ['#d9c2ff', '#a56bff', '#7c3aed'], // Booster II role studio default gradient
  holographic: ['#a9c9ff', '#ffbbec', '#ffc3a0'], // Discord-style holographic role colours
};

// ----------------------------------------------------------------------------
// Roles (Doctrine 8): one family of related gradients, distinguishable by hue
// ----------------------------------------------------------------------------
export const roles = {
  creator: {
    name: 'Creator',
    purpose: 'Author and owner of the Kyriadon project',
    color: '#19c3f5',
    background: 'rgba(8, 44, 70, 0.72)',
    // First and last stops match so the hover shimmer loops without a seam
    gradient: linear(90, ['#19c3f5', '#7be4ff', '#b8c4ff', '#7be4ff', '#19c3f5']),
  },
  staff: {
    name: 'Staff',
    purpose: 'Moderators and team members',
    color: '#a9a9ab',
    background: 'rgba(60, 60, 64, 0.72)',
    // First and last stops match so the hover shimmer loops without a seam
    gradient: linear(90, ['#a9a9ab', '#e2e2e2', '#c4c4c7', '#e2e2e2', '#a9a9ab']),
  },
  member: {
    name: 'Member',
    purpose: 'Community members',
    color: '#aab4c3',
    background: 'rgba(40, 48, 60, 0.72)',
    gradient: linear(90, ['#aab4c3', '#e2e8f2', '#c7d0e0', '#e2e8f2', '#aab4c3']),
  },
};

// ----------------------------------------------------------------------------
// Mentions: role-style chips for channels, websites and commands (guides).
// They share the role chip geometry; only colour differs. Gradient stops are a
// palindrome so the hover shimmer loops without a seam.
// ----------------------------------------------------------------------------
export const mentions = {
  // #Register: dark purple, light purple, light blue, pink
  register: {
    background: 'rgba(40, 26, 92, 0.72)',
    gradient: linear(90, ['#7c5cff', '#b8a2ff', '#7cc4ff', '#ff9ad5', '#7cc4ff', '#b8a2ff', '#7c5cff']),
  },
  // #Testing: red to orange
  testing: {
    background: 'rgba(84, 24, 22, 0.72)',
    gradient: linear(90, ['#ff4d5e', '#ff7a45', '#ffa94d', '#ff7a45', '#ff4d5e']),
  },
  // #Announcements: red to light red
  announcements: {
    background: 'rgba(92, 22, 32, 0.72)',
    gradient: linear(90, ['#ff3b4e', '#ff7a85', '#ffc2c8', '#ff7a85', '#ff3b4e']),
  },
  // Website address: grey and white
  site: {
    background: 'rgba(40, 48, 60, 0.72)',
    gradient: linear(90, ['#9aa4b4', '#ffffff', '#c9d1de', '#ffffff', '#9aa4b4']),
  },
  // Slash command: grey box, light blue text
  command: {
    background: 'rgba(48, 54, 66, 0.72)',
    color: '#7cc4ff',
  },
  // Booster I: light pink to pink (color = hue accent, light = soft end of the gradient)
  boosterOne: {
    background: 'rgba(92, 26, 62, 0.72)',
    color: '#ff5fae',
    light: '#ffc2e0',
    gradient: linear(90, ['#ffc2e0', '#ff5fae', '#ffc2e0']),
  },
  // Booster II: light purple to purple to deep purple
  boosterTwo: {
    background: 'rgba(48, 26, 96, 0.72)',
    color: '#a56bff',
    light: '#d9c2ff',
    gradient: linear(90, ['#d9c2ff', '#a56bff', '#7c3aed', '#a56bff', '#d9c2ff']),
  },
  // Custom role gradient showcase: the full spectrum, repeated so one loop fills the window
  spectrum: {
    background: 'rgba(24, 28, 38, 0.8)',
    gradient: linear(90, [
      '#ff4d5e', '#ffa94d', '#ffe14d', '#4dff88', '#4dd9ff', '#6c7bff', '#c04dff', '#ff4dc4',
      '#ff4d5e', '#ffa94d', '#ffe14d', '#4dff88', '#4dd9ff', '#6c7bff', '#c04dff', '#ff4dc4',
      '#ff4d5e',
    ]),
  },
  // Skull Cracker profile effect: silver to white on a dark grey box (every letter stays readable)
  skull: {
    background: 'rgb(44, 48, 58)',
    gradient: linear(90, ['#9aa1ad', '#ffffff', '#c3c9d3', '#ffffff', '#9aa1ad']),
  },
  // Role icon chip
  icon: {
    background: 'rgba(48, 54, 66, 0.72)',
    color: '#d9c2ff',
  },
  // Stars currency: golden, yellow, light yellow
  gold: {
    background: 'rgba(84, 58, 8, 0.72)',
    gradient: linear(90, ['#f5b301', '#ffd84d', '#fff1a8', '#ffd84d', '#f5b301']),
  },
    // Rules channel: blue and light blue
  rules: {
    background: 'rgba(14, 44, 96, 0.72)',
    gradient: linear(90, ['#3b9bff', '#7cc4ff', '#bfe6ff', '#7cc4ff', '#3b9bff']),
  },
  // Holographic chip (Advanced guide): the full holographic range
  holo: {
    background: 'rgba(24, 28, 44, 0.8)',
    gradient: linear(90, ['#7dd3fc', '#a5b4fc', '#f0abfc', '#fde68a', '#86efac', '#fde68a', '#f0abfc', '#a5b4fc', '#7dd3fc']),
  },
  // Guide role chips (tier and PPP roles): neutral dark surface. The exact Discord role
  // colour is added per chip, see roleChipPaint() below.
  role: {
    background: 'rgba(24, 28, 38, 0.72)',
  },
  // PPP chip (crown): purple family taken from the PPP role colours
  ppp: {
    background: 'rgba(44, 26, 92, 0.72)',
    color: '#d9bfff',
    gradient: linear(90, ['#9168ff', '#c46bff', '#e2bcff', '#c46bff', '#9168ff']),
  },
  // Supporters link: purple, light purple, pink, light pink
  supporters: {
    background: 'rgba(52, 28, 96, 0.72)',
    gradient: linear(90, ['#8b5cf6', '#c4b5fd', '#f472b6', '#fbcfe8', '#f472b6', '#c4b5fd', '#8b5cf6']),
  },
  // Discord links (rules page): holographic in Discord's own colours, blurple to the
  // holographic role tones (light blue, pink, peach)
  discord: {
    background: 'rgba(30, 34, 84, 0.72)',
    color: '#aab4ff',
    gradient: linear(90, ['#7b86ff', '#a9c9ff', '#ffbbec', '#ffc3a0', '#ffbbec', '#a9c9ff', '#7b86ff']),
  },
};

// ----------------------------------------------------------------------------
// Guide roles (Doctrine 8): the exact Discord role colours, in the same order as the
// role id lists in pages/about.js.
// Contrast rule (Doctrine 6.4): a role keeps its hue, but a colour that is too dark to
// read on the chip surface is lifted just enough to reach `min`. Set `min` to 1 to show
// the raw Discord colours. `sweep` is how far the hover tint moves toward white.
// ----------------------------------------------------------------------------
// HT1, LT1, HT2, LT2, HT3, LT3, HT4, LT4, HT5, LT5
export const tierRoleColors = ['#2a567e', '#3e76a6', '#4ea2be', '#5acac2', '#2eaaa6', '#4a7282', '#4a8e8a', '#46969a', '#56a6ba', '#9adec6'];
// Premium, PUGs, PUGs Trial, PUPs I, PUPs II, PUPs III, PUPs IV
export const pppRoleColors = ['#1e0a3a', '#6e1e7a', '#5e26d2', '#621ea2', '#6a3a9a', '#723e9a', '#664aae'];
export const roleContrast = { surface: '#1a1f29', min: 3, sweep: 0.4 };

const hexToRgb = (hex) => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastRatio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const rgbToHsl = ([r, g, b]) => {
  const [rn, gn, bn] = [r, g, b].map((v) => v / 255);
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [0, 0, l];
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  return [(h * 60 + 360) % 360, s, l];
};
const hslToRgb = ([h, s, l]) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgb.map((v) => (v + m) * 255);
};

// Returns the readable text colour of a role and the lighter tint of the same hue that
// sweeps through the chip on hover.
export function roleChipPaint(hex) {
  const surface = hexToRgb(roleContrast.surface);
  const [h, s, startLightness] = rgbToHsl(hexToRgb(hex));
  let lightness = startLightness;
  let color = hexToRgb(hex);
  while (contrastRatio(color, surface) < roleContrast.min && lightness < 0.95) {
    lightness += 0.01;
    color = hslToRgb([h, s, lightness]);
  }
  const light = color.map((v) => v + (255 - v) * roleContrast.sweep);
  return { color: rgbToHex(color), light: rgbToHex(light) };
}

// ----------------------------------------------------------------------------
// Developer role (Doctrine 8). The exact Role Studio stops are #313131, #5b5b5b and
// #7c7c7c (Gradient, 3 stops, Flow live). Those are too dark for the chip surface, so the
// whole ramp moves up together, keeping its order and spacing, until the darkest stop
// reaches the contrast minimum (Doctrine 6.4). It lives here because it needs the colour
// helpers above. Staff reuses the existing roles.staff tokens.
// ----------------------------------------------------------------------------
const developerStops = ['#313131', '#5b5b5b', '#7c7c7c'];

function liftStops(stops) {
  const surface = hexToRgb(roleContrast.surface);
  const hsl = stops.map((hex) => rgbToHsl(hexToRgb(hex)));
  const paint = (shift) => hsl.map(([h, s, l]) => rgbToHex(hslToRgb([h, s, Math.min(0.95, l + shift)])));
  let shift = 0;
  while (contrastRatio(hexToRgb(paint(shift)[0]), surface) < roleContrast.min && shift < 0.8) shift += 0.01;
  return paint(shift);
}

const [developerDark, developerMid, developerLight] = liftStops(developerStops);

roles.developer = {
  name: 'Developer',
  purpose: 'Builds and maintains the Kyriadon website',
  color: developerMid,
  background: 'rgba(32, 36, 44, 0.78)',
  // First and last stops match so the live flow loops without a seam
  gradient: linear(90, [developerDark, developerMid, developerLight, developerMid, developerDark]),
};

// ----------------------------------------------------------------------------
// Punishments page roles (Doctrine 8): the roles the Screenshare procedure names, each with
// its own gradient. First and last stops match so the hover shimmer loops without a seam.
// Frozen is the lightest blue, Screensharer a light gold and Screenshare Manager the same gold,
// darker. Creator is red and Reporter a light red. Member reuses the liquid grey above.
// Every stop stays above the contrast minimum on the chip surface (Doctrine 6.4).
// ----------------------------------------------------------------------------
export const punishmentRoles = {
  frozen: { color: '#bfe6ff', gradient: linear(90, ['#9fd8ff', '#d6efff', '#f2faff', '#d6efff', '#9fd8ff']) },
  screensharer: { color: '#ffe58a', gradient: linear(90, ['#ffe58a', '#fff3b8', '#ffd84d', '#fff3b8', '#ffe58a']) },
  ssManager: { color: '#d19400', gradient: linear(90, ['#a86f00', '#d19400', '#f0b000', '#d19400', '#a86f00']) },
  creator: { color: '#ff4d5e', gradient: linear(90, ['#e11d48', '#ff4d5e', '#ff8a8a', '#ff4d5e', '#e11d48']) },
  reporter: { color: '#ffb3b3', gradient: linear(90, ['#ffb3b3', '#ffd6d6', '#ff9a9a', '#ffd6d6', '#ffb3b3']) },
  member: { color: roles.member.color, gradient: roles.member.gradient },
};

// ----------------------------------------------------------------------------
// Gradients (Doctrine 7): each one is named, centralized and has a single scope
// ----------------------------------------------------------------------------
export const gradients = {
  // Brand reference gradient (azure, light blue, baby blue)
  brand: linear(135, ['#3b9bff', '#7cc4ff', '#bfe6ff']),
  // The ONLY environment gradient: one soft azure glow, masked to the top of the page
  ambient: 'radial-gradient(60% 55% at 16% 0%, rgba(59, 155, 255, 0.22) 0%, rgba(59, 155, 255, 0) 70%)',
  // Hero panel: creamy holographic azure + light blue + baby blue, light to dark
  holoHero: [
    'radial-gradient(55% 70% at 8% 0%, rgba(125, 200, 255, 0.55) 0%, rgba(125, 200, 255, 0) 70%)',
    'radial-gradient(40% 50% at 30% 12%, rgba(224, 242, 255, 0.2) 0%, rgba(224, 242, 255, 0) 70%)',
    'radial-gradient(60% 80% at 62% 38%, rgba(59, 155, 255, 0.34) 0%, rgba(59, 155, 255, 0) 72%)',
    'linear-gradient(135deg, rgba(20, 62, 130, 0.4) 0%, rgba(6, 16, 40, 0.92) 100%)',
  ].join(', '),
  // Panel hover border: flowing holographic ring (first and last stops match)
   holoFlow: 'linear-gradient(90deg, #7dd3fc, #a5b4fc, #f0abfc, #fde68a, #86efac, #7dd3fc)',
  // Embed left line: one purple family, light to main hue (two stops only, static)
  embedLine: linear(180, ['#d9c2ff', '#a56bff']),
  // About page hero: same construction as holoHero, shifted to purple
  holoHeroPurple: [
    'radial-gradient(55% 70% at 8% 0%, rgba(176, 150, 255, 0.55) 0%, rgba(176, 150, 255, 0) 70%)',
    'radial-gradient(40% 50% at 30% 12%, rgba(240, 230, 255, 0.2) 0%, rgba(240, 230, 255, 0) 70%)',
    'radial-gradient(60% 80% at 62% 38%, rgba(124, 92, 255, 0.34) 0%, rgba(124, 92, 255, 0) 72%)',
    'linear-gradient(135deg, rgba(62, 32, 130, 0.4) 0%, rgba(14, 8, 40, 0.92) 100%)',
  ].join(', '),
  // Debug logs hero: same construction as holoHero, shifted to pink
  holoHeroPink: [
    'radial-gradient(55% 70% at 8% 0%, rgba(255, 150, 205, 0.55) 0%, rgba(255, 150, 205, 0) 70%)',
    'radial-gradient(40% 50% at 30% 12%, rgba(255, 232, 244, 0.2) 0%, rgba(255, 232, 244, 0) 70%)',
    'radial-gradient(60% 80% at 62% 38%, rgba(236, 72, 153, 0.34) 0%, rgba(236, 72, 153, 0) 72%)',
    'linear-gradient(135deg, rgba(130, 28, 84, 0.4) 0%, rgba(40, 8, 26, 0.92) 100%)',
  ].join(', '),
  // Rules hero: same construction as holoHero, shifted to red
  holoHeroRed: [
    'radial-gradient(55% 70% at 8% 0%, rgba(255, 120, 110, 0.55) 0%, rgba(255, 120, 110, 0) 70%)',
    'radial-gradient(40% 50% at 30% 12%, rgba(255, 236, 232, 0.2) 0%, rgba(255, 236, 232, 0) 70%)',
    'radial-gradient(60% 80% at 62% 38%, rgba(230, 57, 70, 0.34) 0%, rgba(230, 57, 70, 0) 72%)',
    'linear-gradient(135deg, rgba(140, 24, 32, 0.4) 0%, rgba(40, 8, 10, 0.92) 100%)',
  ].join(', '),
  // Punishments hero: same construction as holoHeroRed, a deeper crimson because the page is a
  // sub page of the rules
  holoHeroCrimson: [
    'radial-gradient(55% 70% at 8% 0%, rgba(255, 96, 120, 0.5) 0%, rgba(255, 96, 120, 0) 70%)',
    'radial-gradient(40% 50% at 30% 12%, rgba(255, 232, 238, 0.2) 0%, rgba(255, 232, 238, 0) 70%)',
    'radial-gradient(60% 80% at 62% 38%, rgba(200, 30, 66, 0.36) 0%, rgba(200, 30, 66, 0) 72%)',
    'linear-gradient(135deg, rgba(120, 14, 40, 0.42) 0%, rgba(34, 6, 14, 0.92) 100%)',
  ].join(', '),
  // Destructive primary action (Delete): red to crimson, white text stays above 4.5:1
  danger: linear(135, ['#dc2626', '#9f1239']),
};

// ----------------------------------------------------------------------------
// Themes (Doctrine 6): semantic colour tokens. Dark is the only theme for now.
// ----------------------------------------------------------------------------
export const themes = {
  dark: {
    colors: {
      // Base palette
      bgPage: '#040507',
      bgRaised: '#0a0d12',
      panel: 'rgba(10, 14, 20, 0.62)',
      card: 'rgba(255, 255, 255, 0.035)',
      cardHover: 'rgba(255, 255, 255, 0.065)',
      modal: 'rgba(11, 15, 22, 0.94)',
      input: 'rgba(255, 255, 255, 0.045)',
      backdrop: 'rgba(2, 4, 8, 0.66)',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(255, 255, 255, 0.14)',
      divider: 'rgba(255, 255, 255, 0.06)',
      inset: 'rgba(255, 255, 255, 0.07)',
      // Text
      textPrimary: '#f4f7fb',
      textSecondary: '#aab4c3',
      textMuted: '#6f7a8b',
      textDisabled: '#474f5c',
      textOnHolo: 'rgba(244, 247, 251, 0.9)',
      textOnHoloSoft: 'rgba(244, 247, 251, 0.74)',
      onAccent: '#ffffff',
      // Accent family
      azure: '#3b9bff',
      lightBlue: '#7cc4ff',
      babyBlue: '#bfe6ff',
      focus: '#7cc4ff',
      // Server icon tile: dark, watery blue
      waterTile: '#0a2a45',
      tileBorder: 'rgba(124, 196, 255, 0.18)',
      // Authentication button (Discord blurple)
      discord: '#5865f2',
      // Server panel: flat scrim over the blurred server banner keeps text readable
      bannerScrim: 'rgba(4, 5, 7, 0.5)',
      // Discord form preview (modelled on Discord's own modal colours)
      discordModal: '#313338',
      discordField: '#1e1f22',
      discordText: '#dbdee1',
      discordLabel: '#b5bac1',
      discordPlaceholder: '#949ba4',
      // Heart in the footer credit
      heart: '#ff6fb5',
      heartGlow: 'rgba(255, 111, 181, 0.7)',
      heartGlowWide: 'rgba(179, 136, 255, 0.5)',
      // Semantic states (always paired with text or an icon, never colour alone)
      success: '#34d399',
      successSoft: 'rgba(52, 211, 153, 0.14)',
      warning: '#fbbf24',
      warningSoft: 'rgba(251, 191, 36, 0.14)',
      danger: '#f87171',
      dangerSoft: 'rgba(248, 113, 113, 0.14)',
      info: '#60a5fa',
      infoSoft: 'rgba(96, 165, 250, 0.14)',
      neutral: '#94a3b8',
      neutralSoft: 'rgba(148, 163, 184, 0.14)',
    },
    shadows: {
      raised: '0 1px 2px rgba(0, 0, 0, 0.4)',
      panel: '0 18px 40px -20px rgba(0, 0, 0, 0.75)',
      modal: '0 32px 90px -24px rgba(0, 0, 0, 0.9)',
    },
  },
};

export const defaultTheme = 'dark';

// ----------------------------------------------------------------------------
// Log levels (debug logs): info is blue, warning is yellow, error is red. Each level
// has one accent colour and one card gradient (accent tint to a deep shade of the
// same hue). Always shown together with an icon and a text label.
// ----------------------------------------------------------------------------
const levelColors = themes[defaultTheme].colors;

export const levels = {
  info: {
    color: levelColors.info,
    gradient: linear(135, ['rgba(96, 165, 250, 0.30)', 'rgba(30, 58, 138, 0.20)']),
  },
  warning: {
    color: levelColors.warning,
    gradient: linear(135, ['rgba(251, 191, 36, 0.26)', 'rgba(120, 53, 15, 0.20)']),
  },
  error: {
    color: levelColors.danger,
    gradient: linear(135, ['rgba(248, 113, 113, 0.28)', 'rgba(127, 29, 29, 0.22)']),
  },
};

// ----------------------------------------------------------------------------
// Rule categories (rules page): one gradient family per category. Each has a main
// colour, a light and a deep shade, a panel gradient built like the hero gradients
// (light glow, soft white, main glow, then light to dark), a left line (same two-stop
// construction as the embed line) and three accents, one per sub-category, so every
// rule inherits its category's family with an accent of its own. Discord uses its
// blurple, Minecraft the bubblegum pink of the heart and K mark, and General the
// silver grey of the website and Skull Cracker chips.
// The Punishments page adds two more: the golden Screenshare procedure (charter) and
// emerald Cheating.
// ----------------------------------------------------------------------------
const ruleGradient = (light, soft, main, deep, dark) =>
  [
    `radial-gradient(55% 70% at 8% 0%, rgba(${light}, 0.55) 0%, rgba(${light}, 0) 70%)`,
    `radial-gradient(40% 50% at 30% 12%, rgba(${soft}, 0.2) 0%, rgba(${soft}, 0) 70%)`,
    `radial-gradient(60% 80% at 62% 38%, rgba(${main}, 0.34) 0%, rgba(${main}, 0) 72%)`,
    `linear-gradient(135deg, rgba(${deep}, 0.4) 0%, rgba(${dark}, 0.92) 100%)`,
  ].join(', ');

export const ruleCategories = {
  discord: {
    color: '#5865f2',
    light: '#aab4ff',
    deep: '#2e3496',
    gradient: ruleGradient('165, 180, 255', '236, 238, 255', '88, 101, 242', '46, 52, 150', '12, 14, 40'),
    line: linear(180, ['#aab4ff', '#5865f2']),
    accent: { one: '#7b86ff', two: '#c4a3ff', three: '#8ec5ff' },
  },
  // Pink family (same hues as the debug logs hero and the Booster I chip); accents are the
  // heart trio: pink, lavender and light blue
  minecraft: {
    color: '#ff5fae',
    light: '#ffc2e0',
    deep: '#8a1f56',
    gradient: ruleGradient('255, 150, 205', '255, 232, 244', '236, 72, 153', '130, 28, 84', '40, 8, 26'),
    line: linear(180, ['#ffc2e0', '#ff5fae']),
    accent: { one: '#ff6fb5', two: '#b388ff', three: '#7cc4ff' },
  },
  // Silver grey family (same greys as the website chip); accents are silver white, steel
  // blue and soft lilac
  general: {
    color: '#aab4c3',
    light: '#e3e9f2',
    deep: '#3a4456',
    gradient: ruleGradient('165, 178, 200', '240, 244, 252', '148, 163, 184', '62, 72, 92', '14, 17, 24'),
    line: linear(180, ['#e3e9f2', '#94a3b8']),
    accent: { one: '#dfe5ee', two: '#94b4e0', three: '#c3b4e6' },
  },
  // Punishments page: the Screenshare procedure is golden (same golds as the Stars icon and
  // the gold chip); its accents are yellow gold, gold and amber
  charter: {
    color: '#f5b301',
    light: '#ffe08a',
    deep: '#7a5200',
    gradient: ruleGradient('255, 214, 102', '255, 244, 214', '245, 179, 1', '122, 82, 0', '36, 24, 4'),
    line: linear(180, ['#ffe08a', '#f5b301']),
    accent: { one: '#ffd84d', two: '#f5b301', three: '#ffb454' },
  },
  // Punishments page: Cheating is emerald (the hero's green family); its accents are emerald,
  // aqua and light green
  cheating: {
    color: '#34d399',
    light: '#a7f3d0',
    deep: '#0f6b4b',
    gradient: ruleGradient('110, 231, 183', '226, 252, 241', '16, 185, 129', '6, 95, 70', '4, 28, 20'),
    line: linear(180, ['#a7f3d0', '#10b981']),
    accent: { one: '#34d399', two: '#5eead4', three: '#86efac' },
  },
};

// ----------------------------------------------------------------------------
// Behaviour settings consumed by JavaScript (not CSS)
// ----------------------------------------------------------------------------
export const behavior = {
  // Scroll edge fade: scrolling down fades the top, scrolling up fades the bottom
  scrollFade: { idleMs: 900, threshold: 4 },
  // Grid <-> List icon morph duration
  morphMs: 360,
};

// ----------------------------------------------------------------------------
// Converts a camelCase key to kebab-case for CSS variable names
// ----------------------------------------------------------------------------
const toKebab = (value) => String(value).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

// ----------------------------------------------------------------------------
// Flattens a nested token object into a list of "--prefix-key: value;" strings
// ----------------------------------------------------------------------------
const flatten = (prefix, tokens, out = []) => {
  Object.entries(tokens).forEach(([key, value]) => {
    const name = `${prefix}-${toKebab(key)}`;
    if (value && typeof value === 'object') flatten(name, value, out);
    else out.push(`--${name}:${value};`);
  });
  return out;
};

// ----------------------------------------------------------------------------
// Builds the full :root block of CSS variables for a theme.
// Called once in pages/_app.js and injected into <head>.
// ----------------------------------------------------------------------------
export function buildCssVariables(themeName = defaultTheme) {
  const theme = themes[themeName] || themes[defaultTheme];
  const declarations = [
    ...flatten('font', fonts.families),
    ...flatten('type', typography),
    ...flatten('color', theme.colors),
    ...flatten('shadow', theme.shadows),
    ...flatten('space', spacing),
    ...flatten('radius', radii),
    ...flatten('motion', motion),
    ...flatten('layout', layout),
    ...flatten('button', buttons),
    ...flatten('gradient', gradients),
    ...flatten('role', roles),
    ...flatten('mention', mentions),
    ...flatten('level', levels),
    ...flatten('rule', ruleCategories),
  ];
  return `:root{${declarations.join('')}}`;
}
