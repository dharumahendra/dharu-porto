import { MessageSquareIcon } from 'lucide-react';
import { motion, useIsPresent } from 'framer-motion';
import { useLenis } from 'lenis/react';
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HamburgerMenuNew } from './HamburgerMenuNew';

// const NAV_ITEMS = [
//   { name: 'Home',     path: '/' },
//   { name: 'Project',     path: '/projects' },
//   { name: 'Studio', path: '/studio' },
//   { name: 'Contact',  path: '/contact' },
// ];

// const SECONDARY_ITEMS = [
//   { name: 'Playground', path: '#' },
//   { name: 'Shop',        path: '#' },
//   { name: 'Newsletter',  path: '#' },
// ];

export function Navbar() {
  const [showLogo, setShowLogo]   = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location  = useLocation();
  const navigate  = useNavigate();
  // const lenis     = useLenis();

  const isContactPage = location.pathname === '/contact';
  const buttonText    = isContactPage ? 'Show my projects' : 'Reach Me Out';
  const buttonPath    = isContactPage ? '/projects' : '/contact';

  const navRef = useRef<HTMLElement>(null);
  const [navWidth, setNavWidth] = useState(480); // Default fallback

  useEffect(() => {
    const updateWidth = () => {
      if (navRef.current) {
        setNavWidth(navRef.current.offsetWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // useLenis reads the actual Lenis container scroll (window scroll is always 0 in this setup)
  // Called every scroll frame; only touch state when the answer actually flips,
  // so scrolling doesn't queue a Navbar update on every frame.
  const showLogoRef = useRef(true);
  // A page on its way out keeps its navbar as it was. The page coming in
  // resets the shared scroll to 0 straight away, and without this the leaving
  // navbar read that as its own scroll and slid its logo back in mid-transition.
  const isPresent = useIsPresent();
  const isPresentRef = useRef(isPresent);
  isPresentRef.current = isPresent;
  useLenis(({ scroll }) => {
    if (!isPresentRef.current) return;
    const next = scroll <= 300;
    if (next === showLogoRef.current) return;
    showLogoRef.current = next;
    setShowLogo(next);
  });

  return (
    <>
      {/* Spacer so fixed header doesn't overlap content */}
      <div className="h-[88px] sm:h-[104px] w-full shrink-0" />

      <header 
        className="fixed top-0 left-0 w-full z-[99999] flex items-center justify-between page-gutter pt-6 sm:pt-8 shrink-0 pointer-events-none"
        style={{ '--nav-width': `${navWidth}px` } as React.CSSProperties}
      >

        {/* Logo — slides up when scrolled */}
        <a
          href="#"
          className={`transition-transform duration-1000 select-none ease-in-out text-2xl sm:text-3xl font-sans font-medium tracking-[0.15em] text-[#10171c] [-webkit-text-stroke:1.5px_#10171c] ${
            showLogo ? 'translate-y-0 pointer-events-auto' : '-translate-y-24 pointer-events-none'
          }`}
        >
          dharu
        </a>

        {/* Nav buttons — hover effects UNCHANGED */}
        <nav ref={navRef} className="pointer-events-auto flex items-center gap-6 sm:gap-8">

          {/* Reach out Me */}
          <motion.button
            type="button"
            onClick={() => {
              navigate(buttonPath);
              setIsMenuOpen(false);
            }}
            initial="idle"
            whileHover="hover"
            className="hidden sm:flex items-center gap-10 rounded-full bg-[#dfe6ea] pl-10 pr-1 py-1 text-sm font-semibold tracking-wide text-[#10171c] transition-colors duration-300 hover:bg-[#d3dbe0]"
            variants={{ idle: { scale: 1 }, hover: { scale: 1.10 } }}
          >
            <span className="uppercase">{buttonText}</span>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
              <motion.div
                variants={{
                  idle: { scale: 1, rotate: 0 },
                  hover: {
                    scale: [1, 0.8, 1.25, 1],
                    rotate: 0,
                    transition: { duration: 0.7, times: [0, 0.2, 0.4, 1], ease: 'easeInOut' },
                  },
                }}
              >
                <MessageSquareIcon className="h-4 w-4" strokeWidth={2.5} />
              </motion.div>
            </span>
          </motion.button>

          {/* Menu / Close */}
          <motion.button
            type="button"
            initial="idle"
            whileHover="hover"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="relative z-[80] flex text-md items-center gap-10 rounded-full bg-[#10171c] pl-10 pr-1 py-1 text-sm font-semibold tracking-wide text-white transition-colors duration-300"
            variants={{ idle: { scale: 1 }, hover: { scale: 1.10 } }}
          >
            <div className="relative h-5 overflow-hidden uppercase">
              <motion.div
                animate={{ y: isMenuOpen ? '-50%' : '0%' }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="flex flex-col"
              >
                <span className="h-5 flex items-center justify-center">Menu</span>
                <span className="h-5 flex items-center justify-center">Close</span>
              </motion.div>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2D2E36]">
              <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                variants={{
                  idle: { rotate: 0, transition: { type: 'tween', ease: 'easeOut', duration: 0.3 } },
                  hover: {
                    rotate: [0, 105, 90],
                    transition: { duration: 0.6, times: [0, 0.4, 1], ease: ['easeOut', 'easeInOut'] },
                  },
                }}
              >
                <circle cx="4"  cy="12" r="1" />
                <circle cx="20" cy="12" r="1" />
              </motion.svg>
            </span>
          </motion.button>
        </nav>

        {/* ── MENU PANEL ─────────────────────────────────────────────────────── */}
        <HamburgerMenuNew
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          navWidth={navWidth}
        />

      </header>
    </>
  );
}
