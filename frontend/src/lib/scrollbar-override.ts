import type { MotionValue } from 'framer-motion';

/**
 * Lets a section take over where the custom scrollbar's thumb sits.
 *
 * The experience section holds the page still while its cards are up and
 * moves between spots with invisible jumps, so the real scroll position says
 * nothing useful there: the thumb sat frozen while the cards changed, then
 * snapped when the page was let go. While an override is set, the thumb is
 * placed at `fraction` of the way between two scroll positions instead.
 */
export interface ScrollbarOverride {
  /** Scroll positions (Lenis `scroll`) the fraction runs between. Read on every update, so a resize is picked up. */
  range: () => { start: number; end: number };
  /** 0–1 between `start` and `end`. */
  fraction: MotionValue<number>;
  /**
   * Called while the thumb is dragged, with where the hand has put it as a
   * fraction of the same range. It can run past 0 or 1 when the drag heads
   * out of the section; the section decides what that means (which card,
   * whether to let the page go) and moves `fraction` itself.
   */
  seek?: (fraction: number) => void;
}

let current: ScrollbarOverride | null = null;
const listeners = new Set<() => void>();

export function setScrollbarOverride(next: ScrollbarOverride | null) {
  if (next === current) return;
  current = next;
  listeners.forEach(fn => fn());
}

export function getScrollbarOverride() {
  return current;
}

export function subscribeScrollbarOverride(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
