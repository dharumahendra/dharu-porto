import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRightIcon, CalendarPlusIcon } from 'lucide-react';
import { useLenis } from 'lenis/react';
import { useNavigate } from 'react-router-dom';
import { CobeGlobe } from './CobeGlobe';
import { RevealLines, ScrollReveal } from './ScrollReveal';
import { CONTACT_EMAIL, SOCIAL_LINKS } from '../data/contact';

// The call button, light on the navy footer.
const PAPER = '#F5FAFF';

// Faces shown inline in the headline. Placeholders — swap for real portraits.
const AVATARS = ['/placeholder-1.jpg', '/placeholder-2.jpg', '/placeholder-3.jpg'];

// Each card leads to the work itself; asking for a call is the button's job.
const SERVICES = [
  { title: 'Design', body: 'Your story, crafted through user-driven visuals.' },
  { title: 'Development', body: 'Crafting appealing, functional digital experiences.' }
];

// Contact is left out on purpose: "Book a call" above is the one way in.
const PAGE_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Projects', to: '/projects' },
  { label: 'Studio', to: '/studio' }
];

// Where the local-time line and the globe marker point to.
const LOCATION = {
  place: 'Indonesia',
  timeZone: 'Asia/Jakarta',
  zone: 'WIB, UTC+7',
  coords: [-6.2088, 106.8456] as [number, number]
};

/** "It's 14:32 here", kept current so visitors can tell whether I'm awake. */
function LocalTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: LOCATION.timeZone
  }).format(now);

  return (
    <p className="mt-5 font-sans text-base text-white/60 sm:text-lg">
      It's <time className="tabular-nums text-white">{time}</time> here ({LOCATION.zone}).
    </p>
  );
}

const LINK_CLASS =
  'rounded text-white/85 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/70';

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-white/55">{title}</p>
      <ul className="mt-5 flex flex-col gap-3.5 text-[13px]">{children}</ul>
    </div>
  );
}

/**
 * Footer1 — closes every page: a headline with a row of faces set into
 * it, a short line of context and a "Book a call" action on the left, and one
 * card per service on the right; then a black panel with a call-to-action card
 * straddling its top edge, the site links, and the copyright line.
 */
export function Footer1() {
  const navigate = useNavigate();
  const lenis = useLenis();
  const year = new Date().getFullYear();

  return (
    <footer className="page-gutter w-full bg-[#273149] pb-8 pt-20 sm:pt-24 lg:pt-28">
      <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[1fr_minmax(0,19rem)] lg:items-center lg:gap-20">
        <div>
          <h2 className="font-sans text-[clamp(1.9rem,4.4vw,3.25rem)] font-medium leading-[1.12] tracking-[-0.035em] text-white">
            <ScrollReveal>
              <span className="block">
                Speak with our{' '}
                <span className="mx-[0.1em] inline-flex -space-x-[0.28em] align-middle">
                  {AVATARS.map(src => (
                    <img
                      key={src}
                      src={src}
                      alt=""
                      className="size-[0.95em] rounded-full object-cover ring-2 ring-[#17264A]"
                    />
                  ))}
                </span>{' '}
                experts
              </span>
            </ScrollReveal>
            <ScrollReveal delay={0.08}>
              <span className="block">about your project requirements.</span>
            </ScrollReveal>
          </h2>

          <RevealLines
            className="mt-6 max-w-[48ch] font-sans text-base leading-relaxed text-[#B7C6DF]"
            text="Let's talk about how we can craft a user experience that not only looks great but drives real growth for your product."
            delay={0.16}
          />

          <ScrollReveal delay={0.24} className="mt-9">
            <motion.button
              type="button"
              onClick={() => navigate('/contact')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex items-center gap-5 rounded-full py-2 pl-5 pr-2 font-sans text-sm font-semibold text-[#10171c] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#17264A] sm:text-base"
              style={{ backgroundColor: PAPER }}
            >
              Book a call
              <span className="flex size-7 items-center justify-center rounded-full bg-[#E4EBF4]">
                <CalendarPlusIcon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              </span>
            </motion.button>
          </ScrollReveal>
        </div>

        <ul className="flex flex-col gap-5">
          {SERVICES.map((service, i) => (
            <li key={service.title}>
              <ScrollReveal delay={0.12 + i * 0.08}>
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="group flex w-full items-start justify-between gap-4 rounded-xl border border-white/10 bg-[#242c3e] p-5 text-left outline-none transition-colors duration-200 hover:border-white hover:bg-white focus-visible:border-white focus-visible:bg-white"
                >
                  {/* The whole card turns white on hover (and keyboard focus), so
                      its text and arrow flip to ink with it. */}
                  <span>
                    <span className="block font-sans text-base font-medium text-white transition-colors duration-200 group-hover:text-[#10171c] group-focus-visible:text-[#10171c]">
                      {service.title}
                    </span>
                    <span className="mt-3 block max-w-[22ch] font-sans text-sm leading-snug text-[#B7C6DF] transition-colors duration-200 group-hover:text-[#3a4048] group-focus-visible:text-[#3a4048]">
                      {service.body}
                    </span>
                  </span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 group-hover:bg-[#10171c] group-hover:text-white group-focus-visible:bg-[#10171c] group-focus-visible:text-white">
                    <ArrowUpRightIcon className="size-4" strokeWidth={1.6} aria-hidden="true" />
                  </span>
                </button>
              </ScrollReveal>
            </li>
          ))}
        </ul>
      </div>

      {/* Closing panel. The call to action lives above, so the card here only
          says where and when you'd be reaching me; the black block below it is
          the site directory. */}
      <div className="relative mx-auto mt-24 w-full max-w-6xl sm:mt-28">
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 top-32 rounded-2xl bg-[#10171c] sm:top-36" />

        <div className="relative px-4 pb-8 sm:px-10 lg:px-16">
          <ScrollReveal>
            <div className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-[#131d2e] px-7 py-10 sm:px-12 sm:py-14">
              <CobeGlobe
                location={LOCATION.coords}
                // Screen drops black out: the near-black sea and the halo (drawn
                // black here) vanish, and only the land dots sit on the card.
                backgroundHex="#000000"
                className="absolute -right-28 top-4 -z-10 h-[130%] opacity-60 mix-blend-screen sm:-right-16 sm:opacity-100 lg:-right-4"
              />

              <h3 className="max-w-[16ch] font-sans text-[clamp(1.75rem,3.6vw,2.6rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-white">
                Based in {LOCATION.place}, working with teams anywhere.
              </h3>
              <LocalTime />
            </div>
          </ScrollReveal>

          <div className="mt-14 grid gap-12 font-sans text-sm md:grid-cols-[1fr_auto] md:gap-20">
            <div>
              <span className="text-lg font-semibold tracking-tight text-white">dharu</span>
              <p className="mt-4 text-white/55">Rather write than call?</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-2 inline-block rounded text-white outline-none hover:underline focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {CONTACT_EMAIL}
              </a>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:gap-16">
              <FooterColumn title="Pages">
                {PAGE_LINKS.map(link => (
                  <li key={link.to}>
                    <button type="button" onClick={() => navigate(link.to)} className={LINK_CLASS}>
                      {link.label}
                    </button>
                  </li>
                ))}
              </FooterColumn>
              <FooterColumn title="Social">
                {SOCIAL_LINKS.filter(link => link.kind !== 'email').map(link => (
                  <li key={link.kind}>
                    <a
                      href={link.href}
                      {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                      className={LINK_CLASS}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </FooterColumn>
            </div>
          </div>

          <div className="mt-24 flex items-center justify-between gap-4 font-sans text-xs text-white/50">
            <span>© {year} dharu. All rights reserved.</span>
            <button
              type="button"
              onClick={() => lenis?.scrollTo(0, { duration: 1.6 })}
              className="rounded outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
            >
              Back to top
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer1;
