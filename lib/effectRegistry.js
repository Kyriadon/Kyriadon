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

// Heer, inspired by "Heer" by Afusic: a green night under which a beloved appears, is taken by the dark and is gone.
// The figure, the veil and the motes follow one 16 second story, everything else is the living night around it.
const heerLayers = [
  // The night: green sky, drifting mist, stars, the moon and a few fireflies
  { cls: 'heerSky' },
  { cls: 'heerMist', children: [{ cls: 'heerMistA' }, { cls: 'heerMistB' }] },
  { cls: 'heerStars', children: [{ cls: 'heerStarsFar' }, { cls: 'heerStarsMid' }, { cls: 'heerStarsNear' }] },
  { cls: 'heerMoon', children: [{ cls: 'heerMoonHalo' }, { cls: 'heerMoonDisc' }] },
  { cls: 'heerFlies', children: many('heerFly', 5) },
  // The light she brings: a halo and a ripple at her feet
  { cls: 'heerGlow' },
  { cls: 'heerRipple' },
  // The grass that frames the bottom corners
  { cls: 'heerReeds heerReedsLeft', children: many('heerReed', 7) },
  { cls: 'heerReeds heerReedsRight', children: many('heerReed', 8) },
  // Sparks as she appears
  { cls: 'heerSparks', children: many('heerSpark', 7) },
  // Heer herself: hair, scarf, gown and head
  {
    cls: 'heerFigure',
    children: [
      {
        cls: 'heerSway',
        children: [{ cls: 'heerHair' }, { cls: 'heerScarf' }, { cls: 'heerGown' }, { cls: 'heerHead' }],
      },
    ],
  },
  // The dark that takes her, and the light of her that it carries away
  { cls: 'heerVeil', children: [{ cls: 'heerVeilSmoke' }, { cls: 'heerVeilBody' }] },
  { cls: 'heerMotes', children: many('heerMote', 14) },
  // The dark frame of the night
  { cls: 'heerFrame' },
];

export const effects = {
  heer: {
    slug: 'heer',
    name: 'Heer',
    description: 'A beloved appears under the green night, is taken by the dark, and is gone.',
    // The caption on the showcase page, in announcement markup (the link goes to Afusic, the artist of Heer)
    caption: '# (:chip:lightgreen,limegreen,seagreen/Heer/:chip:) -- [Afusic](https://open.spotify.com/search/Afusic)\n\nA beloved appears under the green night, is taken by the dark, and is gone.',
    layers: heerLayers,
  },
};

// The slugs of all effects, and the effects as a list
export const effectSlugs = Object.keys(effects);
export const effectList = Object.values(effects);
