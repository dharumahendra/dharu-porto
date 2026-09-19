import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { ReactLenis, useLenis } from 'lenis/react';
import { useEffect, useLayoutEffect, useState, useRef, forwardRef, lazy, Suspense } from 'react';
import { HeroSection } from './components/HeroSection';
import { ProjectsSection } from './components/ProjectsSection';
import { ProjectsGrid } from './components/ProjectsGrid';
import { ContactSection } from './components/ContactSection';
import { StudioSection } from './components/StudioSection';
import { IdentitySectionAlt } from './components/IdentitySectionAlt';
import { ExperienceSection } from './components/ExperienceSection';
import { CustomScrollbar } from './components/CustomScrollbar';
// Two footer designs are kept; swap the import to Footer1 for the navy one.
import { Footer2 as FooterSection } from './components/Footer2';
import { pageEase, pageEaseCss, timeAtProgress } from './lib/page-ease';

// Pulls Three.js (~600 KB raw) into its own chunk so it no longer blocks first
// paint. The overlay is decorative, so it can arrive a beat after the content.
const LiquidEtherOverlay = lazy(() => import('./components/LiquidEtherOverlay'));
// Scratch route: nobody lands on it, so it stays out of the main bundle.
const CobaSection = lazy(() =>
  import('./components/CobaSection').then(m => ({ default: m.CobaSection }))
);

function ScrollToTop() {
  const lenis = useLenis();

  useLayoutEffect(() => {
    if (lenis && lenis.scroll !== 0) {
      // Forced: the page being left may still be holding the scroller stopped
      // (the experience section does while its cards are up), and an unforced
      // scrollTo is silently ignored then — the new page would open wherever
      // the old one was scrolled to.
      lenis.scrollTo(0, { immediate: true, force: true });
    }
  }, [lenis]);

  return null;
}

// Whether any page has mounted yet this visit; only later pages animate in.
let hasShownAPage = false;

// Page transition. The leaving page and the arriving one share one clock and
// one ease, so the hand-over reads as a single movement.
const PAGE_TRANSITION = 1.1;
// The curve — slow creep, abrupt switch, very fast run, short brake — lives in
// src/lib/page-ease.ts, where each phase is its own number. The blur/darken
// veil (.page-veil in index.css) is handed the same curve automatically.
const PAGE_EASE = pageEase;
const ENTER_SCALE = 0.92;
const ENTER_RADIUS = 40;
// The top corners square off once the arriving page is this close to landing
// (share of its travel), finishing as it lands. Timed from the curve itself,
// so it stays right whatever the curve is tuned to.
const RADIUS_FROM = 0.85;
const RADIUS_START = timeAtProgress(RADIUS_FROM);
// How far up the leaving page scrolls, as a share of the screen height. On the
// same clock and ease as the arriving page's rise, but a shorter distance, so
// the old page falls behind as the new one slides over it (a parallax).
const EXIT_DRIFT = 0.3;
const PAGE_BG = '#F5FAFF';

const MotionPage = forwardRef<HTMLDivElement, { children: React.ReactNode, pathname: string }>(
  ({ children, pathname }, ref) => {
    const isPresent = useIsPresent();
    const lenis = useLenis();
    const exitScrollRef = useRef(0);
    // Read by the scroll listener instead of the closure's `isPresent`. The
    // incoming page resets the scroll in its own layout effect, which can run
    // before this page's listener is re-subscribed with isPresent false; the
    // stale listener then recorded 0, and any re-render during the exit
    // snapped the leaving page back to its top.
    const isPresentRef = useRef(isPresent);
    isPresentRef.current = isPresent;
    // Every distance in the transition is a share of the *screen*, never of the
    // page: a share of the page's own height (the old '100%' / '-15%') meant
    // thousands of px on a long page, so the new page only showed up at the
    // very end of its entrance, already moving fast, and the leaving page tore
    // upwards. Read on every render, so the value in use is the one from the
    // render that starts the animation.
    const vh = window.innerHeight;
    const reduceMotion = useReducedMotion();
    // The first page of a visit shows at once (AnimatePresence initial={false}),
    // so there is no entrance to wait out and nothing to block clicks for.
    const [isEntering, setIsEntering] = useState(() => hasShownAPage);

    // Kunci layar selama animasi masuk berjalan.
    useLayoutEffect(() => {
      hasShownAPage = true;
      const timer = setTimeout(() => setIsEntering(false), PAGE_TRANSITION * 1000);
      return () => clearTimeout(timer);
    }, []);

    useLayoutEffect(() => {
      if (!lenis) return;
      
      const onScroll = (e: any) => {
        if (isPresentRef.current) {
          exitScrollRef.current = e.scroll;
        }
      };
      
      lenis.on('scroll', onScroll);
      return () => {
        lenis.off('scroll', onScroll);
      };
    }, [lenis, isPresent]);

    const exitScroll = exitScrollRef.current;

    // Fixed elements inside the leaving page (the navbar) start where they were
    // on screen and scroll up with it. The leaving page is made their containing
    // block (will-change: transform, below) from its very first frame, so
    // they are re-anchored to the part of it that was on screen. Without
    // this, the moment the exit transform applied they snapped to the page's
    // own top, far above the screen, and the navbar blinked out.
    const pageRef = useRef<HTMLDivElement | null>(null);

    // Where each fixed element sat on screen just before the exit, measured
    // during the render that starts it — the DOM is still in its old layout
    // then, before this render's styles are committed.
    const fixedBefore = useRef<Map<HTMLElement, number> | null>(null);
    if (!isPresent && !fixedBefore.current && pageRef.current) {
      const before = new Map<HTMLElement, number>();
      // Only candidates are checked, not the whole tree: one style read each.
      pageRef.current
        .querySelectorAll<HTMLElement>('.fixed, [style*="position: fixed"]')
        .forEach(el => {
          if (getComputedStyle(el).position === 'fixed') {
            before.set(el, el.getBoundingClientRect().top);
          }
        });
      fixedBefore.current = before;
    }

    useLayoutEffect(() => {
      const before = fixedBefore.current;
      if (isPresent || !before) return;
      // Now the leaving page is their containing block. Each is shifted back
      // to exactly where it was, whatever it is anchored by (top, bottom or
      // both) — measured, not worked out from its insets. Reading insets back
      // through getComputedStyle gave px values even where the CSS said
      // `auto`, and writing those back squashed the navbar.
      // From there they belong to the page and scroll up with it, navbar
      // included. `translate` rather than `transform`, so it can't clash with
      // a transform of their own.
      before.forEach((top, el) => {
        el.style.translate = `0 ${top - el.getBoundingClientRect().top}px`;
      });
    }, [isPresent]);

    return (
      <motion.div
        ref={el => {
          pageRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        key={pathname}
        // Entering: rises from just below the screen, a little small, its top
        // corners rounded like a sheet, and squares off as it lands. Scaled
        // from its top edge, which is the part on screen (the new page starts
        // at scroll 0), so the rounded corners stay in view the whole way.
        initial={
          reduceMotion
            ? { opacity: 0 }
            : {
                y: vh,
                scale: ENTER_SCALE,
                borderTopLeftRadius: ENTER_RADIUS,
                borderTopRightRadius: ENTER_RADIUS
              }
        }
        animate={
          reduceMotion
            ? { opacity: 1, transition: { duration: 0.3 } }
            : {
                y: 0,
                scale: 1,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                transition: {
                  default: { duration: PAGE_TRANSITION, ease: PAGE_EASE },
                  // Corners hold their round through the fast run and square
                  // off only as the page lands (see RADIUS_FROM).
                  borderTopLeftRadius: {
                    duration: PAGE_TRANSITION * (1 - RADIUS_START),
                    delay: PAGE_TRANSITION * RADIUS_START,
                    ease: 'easeOut'
                  },
                  borderTopRightRadius: {
                    duration: PAGE_TRANSITION * (1 - RADIUS_START),
                    delay: PAGE_TRANSITION * RADIUS_START,
                    ease: 'easeOut'
                  }
                }
              }
        }
        onAnimationComplete={() => {
          if (lenis) {
            lenis.resize();
          }
        }}
        // Leaving: scrolls up a little, behind the arriving page, under a
        // darkening blur. Not scaled. Transform only, so it never leaves the
        // compositor.
        exit={
          reduceMotion
            ? { opacity: 1, transition: { duration: 0.3 } }
            : {
                y: -EXIT_DRIFT * vh,
                transition: { duration: PAGE_TRANSITION, ease: PAGE_EASE }
              }
        }
        style={{
          position: isPresent ? 'relative' : 'fixed',
          top: isPresent ? 0 : -exitScroll,
          left: 0,
          width: '100%',
          minHeight: '100%',
          // Its own backdrop: the dark layer behind shows past the rounded
          // corners of an arriving page, so a page must never be see-through.
          backgroundColor: PAGE_BG,
          // Above the backdrop; the arriving page above the leaving one.
          zIndex: isPresent ? 50 : 1,
          // Arriving pages scale about their top edge.
          transformOrigin: '50% 0px',
          // Leaving: its own compositor layer from the first frame, and the
          // containing block for its fixed children (see pageRef above).
          willChange: isPresent ? undefined : 'transform',
          // `clip`, not `hidden`: hidden turns this wrapper into a scroll
          // container, which silently breaks `position: sticky` for everything
          // inside it. clip trims the overflow the same way without that.
          // Both axes while arriving, so the rounded corners clip the content.
          overflowX: 'clip',
          overflowY: isEntering ? 'clip' : undefined,
          pointerEvents: isPresent ? 'auto' : 'none'
        }}
      >
      {/* Blocker overlay: blokir semua klik selama animasi masuk berjalan */}
      {isEntering && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            pointerEvents: 'all',
            cursor: 'default',
          }}
          aria-hidden="true"
        />
      )}
      {isPresent && <ScrollToTop />}
      {children}
      {/* The veil over the page being left: darkens and blurs it. Not a CSS
          `filter` on the page — that re-rasterised every layer inside it
          (WebGL canvases, the 3D paper iframe) on every frame, which was the
          old stutter on navigation. Instead one screen-sized layer with a
          constant backdrop blur fades in (see .page-veil); the blur is done
          by the GPU and the fade on the compositor. It covers only what was
          on screen, and exists only while leaving. */}
      {!isPresent && (
        <div
          aria-hidden="true"
          // Above the page's own fixed navbar (z 99999), so that dims too.
          className="page-veil pointer-events-none absolute inset-x-0 z-[100001]"
          style={{
            top: exitScroll,
            // Taller than the screen by the drift, so the content the page
            // scrolls up into view is veiled too. Past the end of a short page
            // it simply hangs over the dark stage, which reads the same.
            height: vh * (1 + EXIT_DRIFT) + 2,
            // The veil's blur and darkening run on the pages' own clock and
            // curve (see .page-veil in index.css).
            ['--page-veil-duration' as string]: `${PAGE_TRANSITION}s`,
            ['--page-veil-ease' as string]: pageEaseCss
          }}
        />
      )}
    </motion.div>
  );
});

/**
 * Whether to load the fluid overlay yet. Its chunk is Three.js, and parsing and
 * booting it during page load competed with first paint. The fluid only ever
 * reacts to the pointer, so nothing is lost by waiting for the first pointer
 * or touch — or for the browser to go idle, so it is usually warm by then.
 */
function useFluidReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    const go = () => setReady(true);
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idleId = w.requestIdleCallback?.(go, { timeout: 4000 });
    const timer = idleId === undefined ? window.setTimeout(go, 2500) : undefined;
    window.addEventListener('pointermove', go, { once: true, passive: true });
    window.addEventListener('touchstart', go, { once: true, passive: true });
    return () => {
      if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener('pointermove', go);
      window.removeEventListener('touchstart', go);
    };
  }, [ready]);

  return ready;
}

export function App() {
  const location = useLocation();
  const fluidReady = useFluidReady();

  return (
    <>
    <ReactLenis id="main-scroll" root={false} options={{ lerp: 0.05, smoothWheel: true }} className="relative w-full h-screen overflow-x-hidden overflow-y-auto bg-[#F5FAFF]">
      {/* CustomScrollbar harus di dalam ReactLenis agar useLenis hook bisa mengakses context */}
      <CustomScrollbar />
      {/* initial={false}: the slide-up entrance is for moving between pages,
          not for arriving. On a fresh load it rendered the whole first page off
          screen and made the visitor wait out the slide before seeing
          anything — and because the first paint happened off screen, the
          browser never recorded a largest contentful paint at all. */}
      {/* The dark stage behind the pages. Always covered by the current page;
          it only shows past the rounded top corners of one arriving. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-[#07090c]" />
      <AnimatePresence initial={false}>
        <MotionPage key={location.pathname} pathname={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={
              <div className="flex flex-col w-full">
                <HeroSection />
                <IdentitySectionAlt />
                <ProjectsGrid />
                {/* No bento grid on the home page. */}
                <ExperienceSection tiles={[]} />
              </div>
            } />
            {/* Projects and Contact get their own content later, so they no
                longer share the home page's sections. */}
            <Route path="/projects" element={
              <div className="flex flex-col w-full">
                <ProjectsSection />
                <ProjectsGrid />
              </div>
            } />
            <Route path="/studio" element={
              <div className="flex flex-col w-full">
                <StudioSection />
              </div>
            } />
            <Route path="/contact" element={
              <div className="flex flex-col w-full">
                <ContactSection />
              </div>
            } />
            {/* Scratch route for experiments — intentionally blank. */}
            <Route path="/coba" element={
              <div className="flex flex-col w-full">
                <Suspense fallback={null}>
                  <CobaSection />
                </Suspense>
              </div>
            } />
          </Routes>
          {/* Closes every page, and moves with it through page transitions. */}
          <FooterSection />
        </MotionPage>
      </AnimatePresence>
    </ReactLenis>

    {/* Sibling of the scroll container, not a child: keeps the fluid pinned to
        the viewport and clear of the page transition. */}
    {fluidReady && (
      <Suspense fallback={null}>
        <LiquidEtherOverlay />
      </Suspense>
    )}
    </>
  );
}