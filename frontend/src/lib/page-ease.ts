/**
 * The page-transition curve: a slow creep, then an abrupt switch to a very
 * fast run, then a short brake.
 *
 * A cubic-bezier can't draw that — with only two control points the bend from
 * slow to fast is always a long, gentle one. So the curve is built from a
 * speed profile instead, then integrated into position over time. Each phase
 * is one of the numbers below, as a share of the whole transition's time.
 *
 *   speed
 *     │                 ┌───────────────┐
 *     │                 │   FAST_SPEED  │
 *     │                 │               │╲
 *     │   ┌─────────────┘               │ ╲
 *     │  ╱  SLOW_SPEED  │← GAP →│       │  ╲ ← BRAKE
 *     └─┴───────────────┴───────────────┴───┴── time
 *       START          SLOW_UNTIL                1
 */

/** Easing out of rest at the very beginning, so the page doesn't jolt. */
const START = 0.5;
/** How long the slow creep lasts, from the start. */
const SLOW_UNTIL = 0.2;
/** How long the switch from slow to fast takes. Smaller = more abrupt. */
const GAP = 0.05;
/** How long the brake at the very end takes. Smaller = a harder stop. */
const BRAKE = 0.31;
/** Speeds, relative to each other. Only their ratio matters: 1 : 10 means the
 *  fast run is ten times the speed of the creep. */
const SLOW_SPEED = 5;
const FAST_SPEED = 10;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

function speedAt(t: number) {
  if (t < START) return SLOW_SPEED * smooth(t / START);
  if (t < SLOW_UNTIL) return SLOW_SPEED;
  if (t < SLOW_UNTIL + GAP) {
    return SLOW_SPEED + (FAST_SPEED - SLOW_SPEED) * smooth((t - SLOW_UNTIL) / GAP);
  }
  if (t < 1 - BRAKE) return FAST_SPEED;
  return FAST_SPEED * (1 - smooth((t - (1 - BRAKE)) / BRAKE));
}

// Integrated once into a table of position against time, 0–1 on both axes.
const SAMPLES = 400;
const table: number[] = (() => {
  const out = [0];
  let total = 0;
  const dt = 1 / SAMPLES;
  for (let i = 1; i <= SAMPLES; i++) {
    // Midpoint rule: accurate enough at this resolution.
    total += speedAt((i - 0.5) * dt) * dt;
    out.push(total);
  }
  return out.map(v => v / total);
})();

/** The curve as a function, for framer-motion's `ease`. */
export function pageEase(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const x = t * SAMPLES;
  const i = Math.floor(x);
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

/**
 * The same curve for CSS, as a `linear()` easing (evenly spaced stops). Used
 * by the blur/darken veil so it moves exactly with the pages.
 */
export const pageEaseCss = `linear(${Array.from({ length: 61 }, (_, i) =>
  Number(pageEase(i / 60).toFixed(4))
).join(', ')})`;

/** When (0–1 of the time) the pages have covered `progress` of the distance. */
export function timeAtProgress(progress: number) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (pageEase(mid) < progress) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
