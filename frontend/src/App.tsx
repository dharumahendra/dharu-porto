import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { ReactLenis, useLenis } from 'lenis/react';
import { useLayoutEffect, useState, useRef, forwardRef } from 'react';
import { HeroSection } from './components/HeroSection';
import { ProjectsSection } from './components/ProjectsSection';
import { ContactSection } from './components/ContactSection';
import { IdentitySectionAlt } from './components/IdentitySectionAlt';
import { CustomScrollbar } from './components/CustomScrollbar';

function ScrollToTop() {
  const lenis = useLenis();

  useLayoutEffect(() => {
    if (lenis && lenis.scroll !== 0) {
      lenis.scrollTo(0, { immediate: true });
    }
  }, [lenis]);

  return null;
}

const MotionPage = forwardRef<HTMLDivElement, { children: React.ReactNode, pathname: string }>(
  ({ children, pathname }, ref) => {
    const isPresent = useIsPresent();
    const lenis = useLenis();
    const exitScrollRef = useRef(0);
    const [isEntering, setIsEntering] = useState(true);

    // Kunci layar selama 1.5 detik (durasi maksimal exit animation)
    useLayoutEffect(() => {
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
        filter: ['blur(0px) brightness(1)', 'blur(2px) brightness(0.9)', 'blur(12px) brightness(0.3)'], 
        y: ['0%', '-4%', '-15%'],
        zIndex: 0,
        x: 0, // Keeps the component mounted longer
        transition: { 
          filter: { 
            duration: 1.5, 
            times: [0, 0.33, 1], 
            ease: ['easeOut', [0.53, 1, 0.36, 1]] 
          },
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
        overflowX: 'hidden',
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
    </motion.div>
  );
});

export function App() {
  const location = useLocation();

  return (
    <ReactLenis id="main-scroll" root={false} options={{ lerp: 0.05, smoothWheel: true }} className="relative w-full h-screen overflow-x-hidden overflow-y-auto bg-[#F5FAFF]">
      {/* CustomScrollbar harus di dalam ReactLenis agar useLenis hook bisa mengakses context */}
      <CustomScrollbar />
      <AnimatePresence>
        <MotionPage key={location.pathname} pathname={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={
              <div className="flex flex-col w-full">
                <HeroSection />
                <IdentitySectionAlt />
              </div>
            } />
            <Route path="/projects" element={
              <div className="flex flex-col w-full">
                <ProjectsSection />
                <IdentitySectionAlt />
              </div>
            } />
            <Route path="/contact" element={
              <div className="flex flex-col w-full">
                <ContactSection />
                <IdentitySectionAlt />
              </div>
            } />
          </Routes>
        </MotionPage>
      </AnimatePresence>
    </ReactLenis>
  );
}