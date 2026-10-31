/**
 * Initial-load registry for the loading screen.
 *
 * Anything heavy that would otherwise boot while the visitor is scrolling (the
 * 3D paper iframe, the fluid overlay, fonts…) claims a task here while the
 * loader is up, and releases it once it has actually rendered. The loader stays
 * until every task is released, so the first scroll never lands on a stall.
 *
 * Only the first load of a visit is gated. Once the loader has gone, claiming a
 * task is a no-op, and components fall back to their own lazy boot.
 */

type Listener = () => void;

let finished = false;
let total = 0;
let done = 0;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach(l => l());

/** True until the loading screen has finished. */
export function isInitialLoad() {
  return !finished;
}

/**
 * Claims a task and returns the function that releases it. Safe to call more
 * than once; extra calls do nothing.
 */
export function trackLoad(): () => void {
  if (finished) return () => {};
  total++;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    done++;
    emit();
  };
}

/** Releases a task once the promise settles, whichever way it goes. */
export function trackPromise(p: Promise<unknown>) {
  const release = trackLoad();
  p.then(release, release);
}

export function getLoadProgress() {
  return { total, done };
}

export function subscribeLoad(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by the loader once it has gone; later claims become no-ops. */
export function finishInitialLoad() {
  finished = true;
  emit();
}
