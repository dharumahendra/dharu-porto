import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLenis } from 'lenis/react';
import { pageEase } from '../lib/page-ease';
import {
  finishInitialLoad,
  getLoadProgress,
  subscribeLoad,
  trackLoad,
  trackPromise
} from '../lib/preload';

// Shown at least this long, so a warm-cache load doesn't flash it.
const MIN_DURATION = 900;
// Whatever is still loading by now is let go; the site must always open.
const MAX_DURATION = 15000;
// The lift-off, on the same clock and curve as the page transitions.
const EXIT_DURATION = 1.1;
const STAGE_BG = '#07090c';
const INK = '#F5FAFF';

const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

/**
 * LoadingScreen — covers the site on a fresh load until everything heavy has
 * actually rendered (the 3D paper's shaders, the fluid overlay, fonts, images),
 * then lifts away like a sheet. Scrolling is held until it has gone, so the
 * first scroll never lands on a scene still booting.
 *
 * Must be rendered inside <ReactLenis> (it stops the scroller), and after the
 * page content, so the content's effects have claimed their tasks first.
 */
export function LoadingScreen() {
  const lenis = useLenis();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const counterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Hold the scroller for as long as the screen is up.
  useEffect(() => {
    if (!lenis) return;
    if (visible) lenis.stop();
    else {
      lenis.start();
      lenis.resize();
    }
  }, [lenis, visible]);

  // The page's own tasks: fonts, every eager asset (window load), and a
  // minimum on-screen time.
  useEffect(() => {
    if (document.fonts?.ready) trackPromise(document.fonts.ready);
    if (document.readyState !== 'complete') {
      trackPromise(new Promise(r => window.addEventListener('load', r, { once: true })));
    }
    trackPromise(new Promise(r => window.setTimeout(r, MIN_DURATION)));
  }, []);

  // Done once every claimed task is released.
  useEffect(() => {
    let cancelled = false;
    const hold = trackLoad(); // one frame of grace for late claims
    nextFrame().then(hold);

    const check = async () => {
      const { total, done } = getLoadProgress();
      if (cancelled || total === 0 || done < total) return;
      // Two frames for the browser to paint everything once, behind the
      // screen, before it lifts.
      await nextFrame();
      await nextFrame();
      if (!cancelled) setReady(true);
    };
    const unsubscribe = subscribeLoad(check);
    const timeout = window.setTimeout(() => setReady(true), MAX_DURATION);
    check();
    return () => {
      cancelled = true;
      unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  // The counter eases towards the real progress rather than jumping, and holds
  // short of 100 until everything really is done. Written straight to the DOM
  // so it costs no React renders.
  useEffect(() => {
    let shown = 0;
    let raf = 0;
    const tick = () => {
      const { total, done } = getLoadProgress();
      const target = ready ? 100 : total ? Math.min(99, (done / total) * 100) : 0;
      shown += (target - shown) * (ready ? 0.25 : 0.08);
      if (ready && 100 - shown < 0.5) shown = 100;
      if (counterRef.current) {
        counterRef.current.textContent = String(Math.floor(shown)).padStart(2, '0');
      }
      if (barRef.current) barRef.current.style.transform = `scaleX(${shown / 100})`;
      if (ready && shown === 100) {
        // A beat on 100 before lifting.
        window.setTimeout(() => setVisible(false), 250);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  return (
    <AnimatePresence onExitComplete={finishInitialLoad}>
      {visible && (
        <motion.div
          key="loader"
          role="progressbar"
          aria-label="Loading"
          aria-busy="true"
          className="fixed inset-0 z-[2000000] flex flex-col justify-between overflow-hidden px-4 py-5 sm:px-8 sm:py-7"
          style={{ backgroundColor: STAGE_BG, color: INK, cursor: 'progress' }}
          initial={false}
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0.4 } }
              : {
                  y: '-100%',
                  borderBottomLeftRadius: 40,
                  borderBottomRightRadius: 40,
                  transition: { duration: EXIT_DURATION, ease: pageEase }
                }
          }
        >
          <div className="flex items-start justify-between text-xs uppercase tracking-[0.18em] opacity-60 sm:text-sm">
            <span>Dharu's Portfolio</span>
            <span>{new Date().getFullYear()}</span>
          </div>

          <motion.div
            exit={reduceMotion ? undefined : { y: -40, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeIn' }}
            className="flex items-end justify-between gap-6"
          >
            <span
              ref={counterRef}
              className="font-light leading-[0.8] tabular-nums"
              style={{ fontSize: 'clamp(5rem, 22vw, 18rem)', letterSpacing: '-0.04em' }}
            >
              00
            </span>
            <span className="mb-2 max-w-[14rem] text-right text-xs leading-relaxed opacity-60 sm:mb-4 sm:text-sm">
              Preparing the scenes, so every scroll stays smooth.
            </span>
          </motion.div>

          {/* Progress line along the bottom edge. */}
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
            <div
              ref={barRef}
              className="h-full origin-left"
              style={{ backgroundColor: INK, transform: 'scaleX(0)' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
