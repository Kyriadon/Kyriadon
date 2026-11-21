// ============================================================================
// profileEffect.js
// The effect layer that lies on top of a profile card. It is only a stack of empty elements, built from
// the layer list of the effect in lib/effectRegistry.js. Everything you see is drawn and animated by
// styles/profileEffects.css, so it is pure CSS. The layer is hidden from screen readers and never
// catches a click, so the profile underneath works as if it were not there.
// ============================================================================
import { effects } from '../lib/effectRegistry';

// One layer, and the layers inside it
function renderLayer(layer, key) {
  const inner = layer.children || [];
  return (
    <span key={key} className={layer.cls}>
      {inner.map((child, index) => renderLayer(child, index))}
    </span>
  );
}

export function ProfileEffect({ slug }) {
  const effect = effects[slug];
  if (!effect) return null;

  return (
    <span className="fxEffect" data-effect={slug} aria-hidden="true">
      {effect.layers.map((layer, index) => renderLayer(layer, index))}
    </span>
  );
}

export default ProfileEffect;
