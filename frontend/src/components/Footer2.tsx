import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useIsPresent, useReducedMotion } from 'framer-motion';
import { ArrowRightIcon, ArrowUpIcon, GithubIcon, InstagramIcon, LinkedinIcon } from 'lucide-react';
import { useLenis } from 'lenis/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CONTACT_EMAIL, SOCIAL_LINKS, type SocialKind } from '../data/contact';

const INK = '#10171c';

// The pages themselves are the pill buttons in the bar below, so the columns
// only hold what those don't: the work by discipline, and a direct line.
const COLUMNS: { title: string; links: { label: string; to?: string; href?: string }[] }[] = [
  {
    title: 'Services',
    links: [
      { label: 'Design', to: '/projects' },
      { label: 'Development', to: '/projects' }
    ]
  },
  {
    title: 'Email me',
    links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` }]
  }
];

// The bar under the card: one pill per page except the one you're on, and
// the way back up.
const PAGES = [
  { label: 'Home', to: '/' },
  { label: 'Projects', to: '/projects' },
  { label: 'Studio', to: '/studio' },
  { label: 'Contact', to: '/contact' }
];

// Colours follow the navbar buttons: the light pill with a white knob, the
// ink pill with a graphite knob.
const PILL_CLASS =
  'flex items-center gap-6 rounded-full py-1 pl-7 pr-1 font-sans text-sm font-semibold uppercase tracking-wide outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-[#dfe6ea] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c2126] sm:gap-10 sm:pl-9';
const PILL_KNOB_CLASS = 'flex size-10 items-center justify-center rounded-full sm:size-11';

// Same hover as the navbar buttons: the pill grows a little and its icon
// squeezes, pops and settles.
const PILL_HOVER = { idle: { scale: 1 }, hover: { scale: 1.1 } };
const ICON_HOVER = {
  idle: { scale: 1, rotate: 0 },
  hover: {
    scale: [1, 0.8, 1.25, 1],
    rotate: 0,
    transition: { duration: 0.7, times: [0, 0.2, 0.4, 1], ease: 'easeInOut' as const }
  }
};

// How far into the bar's slide the first button starts dropping.
const BAR_LEAD = 0.12;
// Dropping in on scroll into view: each button's travel, and the gap between them.
const DROP_DURATION = 0.55;
const DROP_STAGGER = 0.06;
// Tucking back up on scroll away: the same, the other way.
const TUCK_DURATION = 0.5;
const TUCK_STAGGER = 0.06;

function SocialIcon({ kind }: { kind: SocialKind }) {
  const props = { className: 'size-[18px]', strokeWidth: 1.8, 'aria-hidden': true } as const;
  switch (kind) {
    case 'linkedin':
      return <LinkedinIcon {...props} />;
    case 'instagram':
      return <InstagramIcon {...props} />;
    case 'github':
      return <GithubIcon {...props} />;
    case 'behance':
      // No Behance glyph in the icon set; the wordmark's "Be" is its usual stand-in.
      return (
        <span aria-hidden="true" className="font-sans text-[13px] font-bold leading-none tracking-tighter">
          Be
        </span>
      );
    default:
      return null;
  }
}

const LINK_CLASS =
  'rounded text-sm text-[#3a4048] outline-none transition-colors hover:text-[#10171c] focus-visible:ring-2 focus-visible:ring-[#10171c]';

/**
 * Footer2 — a quiet, light alternative to Footer1: one white card holding the
 * name, a line about the work, the social icons and two link columns, with
 * the copyright row under a hairline; a dark bar tucked under it with a pill
 * for each of the other pages and "Go up"; below that the name set huge and faded, cut off by
 * the bottom of the page.
 */
export function Footer2() {
  const navigate = useNavigate();
  const lenis = useLenis();
  const year = new Date().getFullYear();
  const reduceMotion = useReducedMotion();

  // Every page but the current one. The footer moves with its page through
  // the transition, so a page on its way out keeps the path it was showing
  // rather than switching its pills to the page coming in.
  const { pathname } = useLocation();
  const isPresent = useIsPresent();
  const shownPath = useRef(pathname);
  if (isPresent) shownPath.current = pathname;
  const pagePills = PAGES.filter(page => page.to !== shownPath.current);

  const barSpot = useRef<HTMLDivElement>(null);
  // Shown once most of the bar is on screen, but tucked away again as soon
  // as any of it slips off the bottom on the way back up, rather than
  // waiting until most of it has gone.
  const barMostlyIn = useInView(barSpot, { amount: 0.6 });
  const barFullyIn = useInView(barSpot, { amount: 'all' });
  const [barShown, setBarShown] = useState(false);
  useEffect(() => {
    setBarShown(barMostlyIn);
  }, [barMostlyIn]);
  useEffect(() => {
    setBarShown(barFullyIn);
  }, [barFullyIn]);

  // Button i of the bar: hidden up behind the card, it drops into place in
  // turn, left to right, and on the way out tucks back right to left. The
  // lift is in its own heights, enough to clear the card from a second row
  // when the buttons wrap on a phone.
  const buttonCount = pagePills.length + 1;
  const dropIn = (i: number) => ({
    initial: false as const,
    animate: { y: barShown || reduceMotion ? '0%' : '-400%' },
    // Tucking back uses an ease-in-out: the ease-out of the drop made each
    // button snap away the moment it started.
    transition: barShown
      ? { duration: DROP_DURATION, ease: [0.22, 1, 0.36, 1] as const, delay: BAR_LEAD + i * DROP_STAGGER }
      : {
          duration: TUCK_DURATION,
          ease: [0.65, 0, 0.35, 1] as const,
          delay: (buttonCount - 1 - i) * TUCK_STAGGER
        }
  });

  // The bar itself slides down from behind the card first, the buttons
  // following once it is on its way; on the way out it goes up last.
  const barDrop = {
    initial: false as const,
    animate: { y: barShown || reduceMotion ? '0%' : '-100%' },
    transition: barShown
      ? { duration: DROP_DURATION, ease: [0.22, 1, 0.36, 1] as const, delay: 0 }
      : {
          duration: TUCK_DURATION,
          ease: [0.65, 0, 0.35, 1] as const,
          delay: (buttonCount - 1) * TUCK_STAGGER + TUCK_DURATION * 0.4
        }
  };

  return (
    <footer className="page-gutter relative w-full overflow-hidden bg-[#F5FAFF] pt-16 sm:pt-20">
      <div className="relative z-10 mx-auto w-full max-w-6xl rounded-[1.75rem]  bg-[#dfe6ed] px-6 py-10 sm:rounded-[2rem] sm:px-12 sm:py-12">
        <div className="grid gap-12 lg:grid-cols-[1fr_auto] lg:gap-24">
          <div>
            {/* Same wordmark treatment as the navbar logo, at footer size. */}
            <span
              className="font-sans text-xl font-medium tracking-[0.15em] [-webkit-text-stroke:0.6px_#10171c]"
              style={{ color: INK }}
            >
              dharu
            </span>
            <p className="mt-6 max-w-[46ch] font-sans text-sm leading-relaxed text-[#3a4048]">
              I design and build brands and websites for teams who want their product to look as good as it
              works, from the first sketch to the shipped page.
            </p>
            <ul className="mt-7 flex items-center gap-2">
              {SOCIAL_LINKS.filter(link => link.kind !== 'email').map(link => (
                <li key={link.kind}>
                  <a
                    href={link.href}
                    aria-label={link.label}
                    title={link.label}
                    {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                    className="flex size-9 items-center justify-center rounded-full text-[#10171c] outline-none transition-colors hover:bg-[#10171c]/[0.06] focus-visible:ring-2 focus-visible:ring-[#10171c]"
                  >
                    <SocialIcon kind={link.kind} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            {COLUMNS.map(column => (
              <div key={column.title}>
                <p className="font-sans text-sm font-semibold text-[#10171c]">{column.title}</p>
                <ul className="mt-5 flex flex-col gap-3">
                  {column.links.map(link => (
                    <li key={link.label}>
                      {link.href ? (
                        <a href={link.href} className={LINK_CLASS}>
                          {link.label}
                        </a>
                      ) : (
                        <button type="button" onClick={() => navigate(link.to!)} className={LINK_CLASS}>
                          {link.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12  pt-7 font-sans text-sm text-[#9aa6ad]">
          © {year} dharu. All rights reserved.
        </div>
      </div>

      {/* A dark bar tucked under the card, a little narrower than it, holding
          the page pills and the way back up. When it comes into view the bar
          slides down from behind the card, then each button drops in turn;
          scrolled away, the buttons tuck back first and the bar follows. */}
      <div
        ref={barSpot}
        className="relative mx-auto -mt-8 w-[calc(100%-1.5rem)] max-w-[calc(72rem-3rem)] sm:w-[calc(100%-3rem)]"
      >
        <motion.nav
          aria-label="Footer"
          {...barDrop}
          className="rounded-b-[1.75rem] bg-[#1c2126] px-5 pb-6 pt-14 sm:rounded-b-[2rem] sm:px-8 sm:pb-8 sm:pt-16"
        >
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            {/* Each pill sits in a wrapper that does the drop, so the hover's
                scale on the button itself stays separate from it. */}
            {pagePills.map((pill, i) => (
              <motion.div key={pill.to} {...dropIn(i)}>
                <motion.button
                  type="button"
                  onClick={() => navigate(pill.to)}
                  initial="idle"
                  whileHover="hover"
                  variants={PILL_HOVER}
                  className={`${PILL_CLASS} bg-[#dfe6ea] text-[#10171c] hover:bg-[#d3dbe0]`}
                >
                  {pill.label}
                  <span className={`${PILL_KNOB_CLASS} bg-white text-[#10171c]`}>
                    <motion.span variants={ICON_HOVER} className="flex">
                      <ArrowRightIcon className="size-4" strokeWidth={2.5} aria-hidden="true" />
                    </motion.span>
                  </span>
                </motion.button>
              </motion.div>
            ))}

            <motion.div {...dropIn(pagePills.length)} className="sm:ml-auto">
              <motion.button
                type="button"
                onClick={() => lenis?.scrollTo(0, { duration: 1.6 })}
                initial="idle"
                whileHover="hover"
                variants={PILL_HOVER}
                className={`${PILL_CLASS} bg-[#10171c] text-white`}
              >
                Go up
                <span className={`${PILL_KNOB_CLASS} bg-[#2D2E36]`}>
                  <motion.span variants={ICON_HOVER} className="flex">
                    <ArrowUpIcon className="size-4" strokeWidth={2.5} aria-hidden="true" />
                  </motion.span>
                </span>
              </motion.button>
            </motion.div>
          </div>
        </motion.nav>
      </div>

      {/* The name, set as large as the page allows and fading downwards; the
          footer's bottom edge cuts through it. Decorative, so hidden from
          assistive tech. */}
      <div aria-hidden="true" className="pointer-events-none relative -mt-[2vw] h-[15vw] select-none">
        <span
          className="absolute inset-x-0 top-0 block text-center font-display font-semibold leading-[0.8] tracking-[0.16em] text-transparent"
          style={{
            fontSize: '27vw',
            backgroundImage: 'linear-gradient(to bottom, rgba(16,23,28,0.07), rgba(16,23,28,0) 70%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text'
          }}
        >
          dharu
        </span>
      </div>
    </footer>
  );
}

export default Footer2;
