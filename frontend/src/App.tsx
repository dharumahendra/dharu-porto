import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
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
import { FooterSection } from './components/FooterSection';

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
      lenis.scrollTo(0, { immediate: true });
    }
  }, [lenis]);

  return null;
}

// Whether any page has mounted yet this visit; only later pages animate in.
let hasShownAPage = false;

const MotionPage = forwardRef<HTMLDivElement, { children: React.ReactNode, pathname: string }>(
  ({ children, pathname }, ref) => {
    const isPresent = useIsPresent();
    const lenis = useLenis();
    const exitScrollRef = useRef(0);
    // The first page of a visit shows at once (AnimatePresence initial={false}),
    // so there is no entrance to wait out and nothing to block clicks for.
    const [isEntering, setIsEntering] = useState(() => hasShownAPage);

    // Kunci layar selama 1.5 detik (durasi maksimal exit animation)
    useLayoutEffect(() => {
      hasShownAPage = true;
      const timer = setTimeout(() => setIsEntering(false), 1500);
      return () => clearTimeout(timer);
    }, []);

    useLayoutEffect(() => {
      if (!lenis) return;
      
      const onScroll = (e: any) => {
        if (isPresent) {
          exitScrollRef.current = e.scroll;
        }
      };
      
      lenis.on('scroll', onScroll);
      return () => {
        lenis.off('scroll', onScroll);
      };
    }, [lenis, isPresent]);

    return (
      <motion.div
        ref={ref}
        key={pathname}
      initial={{ 
        y: '100%', 
        scale: 0.85, 
        borderTopLeftRadius: '4rem', 
        borderTopRightRadius: '4rem',
        zIndex: 50 
      }}
      animate={{ 
        y: 0,
        scale: 1,
        borderTopLeftRadius: '0rem',
        borderTopRightRadius: '0rem',
        transition: { 
          default: { duration: 1, delay: 0.2, ease: [0.22, 1, 0.53, 1] },
          borderTopLeftRadius: { duration: 0.5, delay: 0.8, ease: 'easeOut' },
          borderTopRightRadius: { duration: 0.5, delay: 0.8, ease: 'easeOut' }
        }
      }}
      onAnimationComplete={() => {
        if (lenis) {
          lenis.resize();
        }
      }}
      exit={{
        y: ['0%', '-4%', '-15%'],
        zIndex: 0,
        x: 0, // Keeps the component mounted longer
        transition: {
          y: {
            duration: 1.5, 
            times: [0, 0.33, 1], 
            ease: ['easeOut', [0.53, 1, 0.36, 1]] 
          },
          x: { duration: 1.5 } 
        }
      }}
      style={{ 
        position: isPresent ? 'relative' : 'fixed', 
        top: isPresent ? 0 : -exitScrollRef.current, 
        left: 0, 
        width: '100%', 
        minHeight: '100%', 
        // `clip`, not `hidden`: hidden turns this wrapper into a scroll
        // container, which silently breaks `position: sticky` for everything
        // inside it. clip trims the overflow the same way without that.
        overflowX: 'clip',
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
      {/* The outgoing page dims under a black layer instead of animating a CSS
          `filter: blur() brightness()` on itself. A filter on a whole page
          re-rasterises every layer inside it (WebGL canvases, the 3D paper
          iframe) on every frame for the full 1.5 s, which was the stutter on
          navigation; fading one flat layer's opacity stays on the compositor.
          The black at 0.7 matches the old brightness(0.3). */}
      <motion.div
        aria-hidden="true"
        // Above the page's own fixed navbar (z 99999), which the old filter dimmed too.
        className="pointer-events-none absolute inset-0 z-[100001] bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0 }}
        exit={{
          opacity: [0, 0.1, 0.7],
          transition: { duration: 1.5, times: [0, 0.33, 1], ease: ['easeOut', [0.53, 1, 0.36, 1]] }
        }}
      />
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