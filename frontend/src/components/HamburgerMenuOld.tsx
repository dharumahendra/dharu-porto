import { InstagramIcon, LinkedinIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { name: 'Home',    path: '/' },
  { name: 'Project', path: '/projects' },
  { name: 'Studio',  path: '/studio' },
  { name: 'Contact', path: '/contact' },
];

const SECONDARY_ITEMS = [
  { name: 'Playground', path: '#' },
  { name: 'Shop',        path: '#' },
  { name: 'Newsletter',  path: '#' },
];

interface HamburgerMenuOldProps {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  navWidth: number;
}

export function HamburgerMenuOld({ isMenuOpen, setIsMenuOpen, navWidth }: HamburgerMenuOldProps) {
  const location = useLocation();

  return (
    <AnimatePresence>
      {isMenuOpen && (
        <>
          {/* Backdrop — starts below navbar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.35 } }}
            exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.2 } }}
            className="fixed inset-0 top-[88px] sm:top-[104px] z-[60] pointer-events-auto"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Wrapper to clip the top edge, allowing the card to slide "out" of a slot */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed top-[88px] sm:top-[104px] right-6 sm:right-10 lg:right-14 bottom-10 z-[70] w-[calc(100%-3rem)] sm:w-[var(--nav-width)] pointer-events-none"
            style={{ clipPath: 'inset(0px -100px -100px -100px)', '--nav-width': `${navWidth}px` } as React.CSSProperties}
          >
            <motion.div
              variants={{
                hidden: { y: '-100%', transition: { type: 'spring', stiffness: 400, damping: 35 } },
                visible: { y: '0%', transition: { type: 'spring', stiffness: 400, damping: 26 } }
              }}
              className="w-full h-full bg-[#10171c] rounded-[2rem] sm:rounded-[2.5rem] flex flex-col pointer-events-auto overflow-hidden"
            >

              {/* Main nav links */}
              <nav className="flex-1 flex flex-col justify-center py-10 px-8 sm:px-12 -mt-4 tracking-[0.2em]">
                {NAV_ITEMS.map((item, i) => {
                  const isActive    = location.pathname === item.path;
                  const isClickable = item.path !== '#' && !isActive;
                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: 48 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        transition: { duration: 0.45, delay: 0.12 + i * 0.06, ease: [0.22, 1, 0.36, 1] },
                      }}
                      exit={{ opacity: 0, transition: { duration: 0.15, delay: i * 0.02 } }}
                    >
                      <motion.div
                        initial="idle"
                        whileHover={isClickable ? "hover" : "idle"}
                        className="relative"
                      >
                        <Link
                          to={isClickable ? item.path : '#'}
                          onClick={(e) => {
                            if (!isClickable) e.preventDefault();
                            else setIsMenuOpen(false);
                          }}
                          className={`group flex items-center py-[6px] sm:py-[10px] ${
                            isActive ? 'pointer-events-none' : 'cursor-pointer'
                          }`}
                        >
                          <motion.div
                            variants={{
                              idle: { x: 0 },
                              hover: { x: 48 }
                            }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="relative flex items-center"
                          >
                            {/* Hover Arrow */}
                            <motion.div
                              variants={{
                                idle: { opacity: 0, x: -20, scale: 0.5 },
                                hover: { opacity: 1, x: 0, scale: 1 }
                              }}
                              transition={{ duration: 0.3, ease: 'easeOut' }}
                              className="absolute right-full mr-4 text-white"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[6vw] h-[6vw] sm:w-[32px] sm:h-[32px]">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                              </svg>
                            </motion.div>

                            {/* Nav Text */}
                            <motion.span
                              variants={{
                                idle: { scale: 1, color: isActive ? '#3a4048' : '#ffffff' },
                                hover: { scale: 1.05, color: '#8a9298' }
                              }}
                              transition={{ duration: 0.3, ease: 'easeOut' }}
                              style={{ transformOrigin: 'left center' }}
                              className="font-sans font-semibold leading-none tracking-tight text-[13vw] sm:text-[45px]"
                            >
                              {item.name}
                            </motion.span>
                          </motion.div>
                        </Link>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Footer — secondary links + social icons */}
              <div className="flex items-end justify-between px-8 sm:px-12 pb-8 sm:pb-12">

                {/* Secondary links */}
                <div className="flex flex-col gap-[10px]">
                  {SECONDARY_ITEMS.map((item, i) => (
                    <motion.a
                      key={item.name}
                      href={item.path}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.45 + i * 0.05 } }}
                      exit={{ opacity: 0 }}
                      className="text-[#4e5a62] hover:text-[#8a9298] transition-colors duration-200 text-sm sm:text-[15px] font-medium"
                    >
                      {item.name}
                    </motion.a>
                  ))}
                </div>

                {/* Social icons */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.55 } }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <a href="#" aria-label="Instagram" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1c2126] text-[#5a6570] hover:text-white hover:bg-[#272d34] transition-all duration-200">
                    <InstagramIcon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  </a>
                  <a href="#" aria-label="Behance" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1c2126] text-[#5a6570] hover:text-white hover:bg-[#272d34] transition-all duration-200">
                    <span className="text-[13px] font-bold tracking-tighter leading-none">Be</span>
                  </a>
                  <a href="#" aria-label="LinkedIn" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1c2126] text-[#5a6570] hover:text-white hover:bg-[#272d34] transition-all duration-200">
                    <LinkedinIcon className="h-[17px] w-[17px]" strokeWidth={1.5} />
                  </a>
                </motion.div>
              </div>

            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
