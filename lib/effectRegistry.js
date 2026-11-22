// ============================================================================
// effectRegistry.js
// Every profile effect, as data. An effect is a list of layers, bottom to top. A layer is a class name
// and, optionally, the layers inside it. components/profileEffect.js turns the list into elements, and
// styles/profileEffects.css draws and animates them, so an effect is pure CSS and needs no images.
// The showcase page and the store (later) both read this list, so an effect lives in one place.
// ============================================================================

// `count` identical layers in a row (fireflies, grass blades, sparks): the CSS tells them apart by position
function many(cls, count) {
  return Array.from({ length: count }, () => ({ cls }));
}

// Heer, inspired by "Heer" by Afusic: a green night that fills the whole card, with a great crescent moon, stars,
// aurora and a beloved in the middle who fades in slowly, is taken by the dark and is gone.
// The layers run from the back to the front. The night is alive all the time; the wisp, the figure, the
// aura, the dark and the motes follow one story, and the petals drift on their own.
const heerLayers = [
  // The night: green sky, three flowing curtains of aurora, stars and sparkles, the moon and a few fireflies
  { cls: 'heerSky' },
  {
    cls: 'heerCurtains',
    children: [
      { cls: 'heerCurtain heerCurtainA', children: many('heerRay', 14) },
      { cls: 'heerCurtain heerCurtainB', children: many('heerRay', 14) },
      { cls: 'heerCurtain heerCurtainC', children: many('heerRay', 12) },
    ],
  },
  { cls: 'heerStars', children: [{ cls: 'heerStarsFar' }, { cls: 'heerStarsMid' }, { cls: 'heerStarsNear' }] },
  { cls: 'heerSparkles', children: many('heerSparkle', 9) },
  {
    cls: 'heerMoon',
    children: [{ cls: 'heerMoonHalo' }, { cls: 'heerMoonBody' }, { cls: 'heerMoonRock', children: [{ cls: 'heerMoonDisc' }] }],
  },
  { cls: 'heerFlies', children: many('heerFly', 6) },
  // The light she brings, and the lone wisp that waits while she is gone
  { cls: 'heerGlow' },
  { cls: 'heerWisp', children: [{ cls: 'heerWispCore' }, { cls: 'heerWispRing' }] },
  // The grass that frames the bottom corners
  { cls: 'heerReeds heerReedsLeft', children: many('heerReed', 7) },
  { cls: 'heerReeds heerReedsRight', children: many('heerReed', 8) },
  // Heer herself: hair, sleeves and hands, gown, scarf, sash, head, bangs, bun and hairpin
  {
    cls: 'heerFigure',
    children: [
      {
        cls: 'heerFloat',
        children: [
          { cls: 'heerPart heerHairBack' },
          { cls: 'heerPart heerSleeveL' },
          { cls: 'heerPart heerSleeveR' },
          { cls: 'heerHandL' },
          { cls: 'heerHandR' },
          { cls: 'heerPart heerGown' },
          { cls: 'heerPart heerScarf' },
          { cls: 'heerPart heerSash' },
          { cls: 'heerHead' },
          { cls: 'heerPart heerBangs' },
          { cls: 'heerBun' },
          { cls: 'heerPin' },
        ],
      },
    ],
  },
  // The dark that takes her, the petals of light and the motes of her that rise with it
  { cls: 'heerDark' },
  { cls: 'heerPetals', children: many('heerPetal', 9) },
  { cls: 'heerMotes', children: many('heerMote', 16) },
  // The glowing edge of the night
  { cls: 'heerFrame' },
];

export const effects = {
  heer: {
    slug: 'heer',
    name: 'Heer',
    description: 'A beloved appears under the green night, is taken by the dark, and is gone.',
    // The caption on the showcase page, in announcement markup (the link goes to Afusic, the artist of Heer)
    caption: '# :chip:lightgreen,limegreen,seagreen/Heer/:chip: — [Afusic](https://open.spotify.com/search/Afusic)\n\nA beloved appears under the green night, is taken by the dark, and is gone.',
    layers: heerLayers,
  },
};

// The slugs of all effects, and the effects as a list
export const effectSlugs = Object.keys(effects);
export const effectList = Object.values(effects);
