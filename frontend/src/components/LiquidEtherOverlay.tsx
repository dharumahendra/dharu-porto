import { useEffect, useState } from 'react';
import LiquidEther from './LiquidEther';

// The stroke ramp, indexed by which way the boundary faces. Clear water is the
// target, so the ramp is symmetric and barely tinted: a faint aqua on both
// flanks running through clear at the crossover. The shader takes it from here,
// washing the lit flank towards white and driving the opposite one down into a
// deep version of the same aqua, the way a water edge bends a light background.
// Nothing here paints the interior — that is fully transparent.
const ETHER_COLORS = [
  '#BFE6F2', // flank
  '#DCF1F8',
  '#FFFFFF', // clear crossover
  '#DCF1F8',
  '#BFE6F2'  // flank
];

/**
 * LiquidEtherOverlay — a single app-wide fluid layer mounted at the root, above
 * every page and section.
 *
 * Mounted outside <ReactLenis> and <AnimatePresence> on purpose: the page
 * transition animates `filter` on its wrapper, and a CSS filter creates a
 * containing block for `position: fixed` descendants, which would peg this to
 * the animating page instead of the viewport. Living at the root also means it
 * survives navigation, so the fluid keeps flowing across route changes.
 *
 * `pointer-events-none` is load-bearing here — the layer covers the whole
 * viewport, so without it nothing underneath would be clickable.
 */
export function LiquidEtherOverlay({ className = '' }: { className?: string }) {
  // A permanently animating full-screen overlay is exactly what this setting is
  // meant to suppress, and skipping it avoids the WebGL cost entirely.
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (reducedMotion) return null;

  return (
    <div
      className={`fixed inset-0 z-[999999] pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <LiquidEther
        colors={ETHER_COLORS}
        mouseForce={20}
        cursorSize={34}
        isViscous={false}
        viscous={30}
        iterationsViscous={32}
        // Each Poisson iteration is a full-grid pass; 32 of them per frame was
        // the dominant GPU cost. At this scale 16 is visually indistinguishable.
        iterationsPoisson={16}
        resolution={0.4}
        maxPixelRatio={1.5}
        isBounce={false}
        // Scaled down, but the water behaviour is unchanged: a fast stroke still
        // lingers fadeSpeedBoost times longer and spreads wider than a slow one.
        fadeDuration={1.0}
        fadeSpeedBoost={3.5}
        speedSpread={0.6}
        // The stroke is the only thing drawn, so it runs at full strength.
        iridescence={1}
        glassAlpha={0.85}
        lightMode={true}
        // No idle self-animation: the fluid only ever reacts to the pointer.
        // The auto* and takeover props are inert while this is off.
        autoDemo={false}
      />
    </div>
  );
}

export default LiquidEtherOverlay;
