import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useLenis } from 'lenis/react';
import { Navbar } from './Navbar';
const ELEMEN_HERO = "/engine.png";

export function ProjectsSection() {
  // useScroll() always reads window.scrollY = 0 because Lenis scrolls its own container.
  // Fix: use useLenis to read scroll from the actual Lenis container.
  const scrollY = useMotionValue(0);
  useLenis(({ scroll }) => scrollY.set(scroll));

  const scrollOpacity = useTransform(scrollY, [160, 460], [1, 0]);

  return (
    <section className="relative w-full min-h-screen overflow-x-hidden bg-[#F5FAFF] flex flex-col">
      {/* Navigation */}
      <Navbar />

      {/* Removed flex-1 & overflow-hidden so content can push the section taller than the viewport, enabling Lenis scroll */}
      <div className="relative flex flex-col justify-start overflow-x-hidden pb-8 sm:pb-10">

        {/* Wrapper to allow absolute positioning of Scroll on desktop */}
        <div className="relative w-full">
          
          {/* Main Content */}
          <div className="pl-16 sm:pl-28 md:pl-40 lg:pl-60 flex flex-col">
            <div className="relative">
              {/* Layer 1: projects  */}
              <h1
                aria-hidden="true"
                className="-ml-[0.06em] pointer-events-none select-none font-semibold m-0 whitespace-nowrap font-sans leading-none text-[#10171c] text-[30vw] sm:text-[28vw] lg:text-[30vw] tracking-[-0.02em]">
                crafts
              </h1>

              {/* Layer 2: Box ELEMEN_HERO 1 */}
              <motion.div
                className="absolute pointer-events-none select-none right-[16%] sm:right-[26%] bottom-[10%] sm:-bottom-[10%] -translate-x-1/2 -translate-y-1/2 z-20 w-[70vw] max-w-[120px] sm:w-[50vw]"
                animate={{ y: [10, -10, 10], rotate: [0, 360] }}
                transition={{ 
                  y: { duration: 3, ease: 'easeInOut', repeat: Infinity },
                  rotate: { duration: 15, ease: 'linear', repeat: Infinity }
                }}>
                <img
                  src={ELEMEN_HERO}
                  alt="Hero Element Box"
                  className="w-full h-auto" />
              </motion.div>

              {/* Layer 2.5: Box ELEMEN_HERO 2 */}
              <motion.div
                className="absolute pointer-events-none select-none right-[10%] sm:right-[15%] bottom-[10%] sm:-bottom-[10%] -translate-x-1/2 -translate-y-1/2 z-20 w-[70vw] max-w-[120px] sm:w-[50vw]"
                animate={{ y: [10, -10, 10], rotate: [0, 360] }}
                transition={{ 
                  y: { duration: 3, ease: 'easeInOut', repeat: Infinity },
                  rotate: { duration: 15, ease: 'linear', repeat: Infinity }
                }}>
                <img
                  src={ELEMEN_HERO}
                  alt="Hero Element Box 2"
                  className="w-full h-auto" />
              </motion.div>
            </div>

            {/* Layer 3: Headline */}
            <div className="relative z-30  max-w-[640px]">
              <p className="text-[#10171c] font-bold font-sans leading-[0.95] tracking-tight text-xl sm:text-3xl md:text-5xl lg:text-6xl">
                Your story builds
                <br />
                our history.
              </p>
            </div>
          </div>

          {/* Scroll Indicator */}
          <motion.div 
            style={{ opacity: scrollOpacity }}
            className="px-6 sm:px-10 lg:px-14 pt-8 md:pt-0 md:absolute md:bottom-2 md:left-0 z-30"
          >
            <span className="text-sm sm:text-xl md:text-3xl font-bold font-sans text-[#9aa6ad]">Scroll</span>
          </motion.div>

        </div>

      </div>
    </section>);

}
