import { useEffect, useState } from 'react';
import IridescentTrail from './IridescentTrail';

// §3 of the plan, ordered young/cool first through old/warm last — the
// direction the weight ratio actually travels as a stroke ages.
const TRAIL_COLORS = [
  '#FF4BD8', // magenta
  '#7A4BFF', // indigo
  '#2E6BFF', // blue
  '#3FE0F0', // cyan
  '#46C86E', // green
  '#FFB020', // amber
  '#FF6A2C', // orange
  '#E23A2E' // red
];

/**
 * TrailOverlay — a single app-wide iridescent trail mounted at the root, above
 * every page and section.
 *
 * Mounted outside <ReactLenis> and <AnimatePresence> on purpose: the page
 * transition animates `filter` on its wrapper, and a CSS filter creates a
 * containing block for `position: fixed` descendants, which would peg this to
 * the animating page instead of the viewport.
 *
 * `pointer-events-none` is load-bearing — the layer covers the whole viewport,
 * so without it nothing underneath would be clickable.
 */
export function TrailOverlay({ className = '' }: { className?: string }) {
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
      {/* Figures below are the calibration table from §2/§8 of the plan. */}
      <IridescentTrail
        colors={TRAIL_COLORS}
        pushStrength={25}
        curlScale={0.1}
        curlStrength={5}
        velocityDissipation={0.985}
        weight1Dissipation={0.95}
        weight2Dissipation={0.8}
        radius={0.05}
        aberration={0.006}
        refraction={0.03}
        simResolution={0.5}
        opacity={1}
        maxPixelRatio={1.5}
        // Lenis scrolls its own container rather than the window, so the trail
        // anchors to that element's scrollTop.
        scrollElementId="main-scroll"
      />
    </div>
  );
}

export default TrailOverlay;
