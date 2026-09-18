import { motion, useReducedMotion } from 'framer-motion';
import { GithubIcon, InstagramIcon, LinkedinIcon, MailIcon } from 'lucide-react';
import { useLenis } from 'lenis/react';
import { useNavigate } from 'react-router-dom';
import { RevealLines, ScrollReveal } from './ScrollReveal';
import { CONTACT_EMAIL, SOCIAL_LINKS, type SocialKind } from '../data/contact';

// The accent is the deep end of the wave ramp below, so the headline's colour
// reads as coming from the same water rather than a separate brand blue.
const ACCENT = '#4A67A8';
const RISE_EASE = [0.33, 1, 0.68, 1] as const;

// Back to front: each layer is lower on the panel and darker. Written as
// cubic curves across a 1440-wide viewBox that is stretched to the panel, so
// the crests keep their rhythm at any width.
const WAVES = [
  { d: 'M0 118C240 58 430 162 720 112C1000 64 1210 152 1440 98V420H0Z', from: '#DCE4F0', to: '#B7C6DF' },
  { d: 'M0 192C210 128 470 232 770 170C1045 114 1250 212 1440 158V420H0Z', from: '#A9BCDD', to: '#8198C8' },
  { d: 'M0 268C255 198 525 302 830 240C1085 188 1285 272 1440 228V420H0Z', from: '#7C94C6', to: '#56709F' },
  { d: 'M0 332C300 280 565 364 885 312C1125 274 1300 334 1440 306V420H0Z', from: '#556D9F', to: '#34466F' }
];

function SocialIcon({ kind }: { kind: SocialKind }) {
  const props = { className: 'size-[18px]', strokeWidth: 1.6, 'aria-hidden': true } as const;
  switch (kind) {
    case 'email':
      return <MailIcon {...props} />;
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
  }
}

/** Four-pointed sparkle, as in the reference. */
function Sparkle({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z" />
    </svg>
  );
}

/**
 * FooterSection — one large rounded panel that closes every page: a two-line
 * invitation, a short line of context, the same "Reach me out" action as the
 * navbar, the email address, and the contact icons, sitting above layered
 * waves that settle into place as the panel scrolls in.
 */
export function FooterSection() {
  const navigate = useNavigate();
  const lenis = useLenis();
  const reduceMotion = useReducedMotion();
  const year = new Date().getFullYear();

  return (
    <footer className="page-gutter w-full bg-[#F5FAFF] pb-6 pt-10 sm:pb-8 sm:pt-12">
      <div className="relative isolate flex min-h-[92svh] flex-col overflow-hidden rounded-[2rem] bg-[#E9EFF6] sm:rounded-[2.5rem]">
        {/* Kept to the margins; on phones there is no margin wide enough, so
            they drop to the space between the text and the waves. */}
        <Sparkle className="absolute left-[10%] top-[62%] size-3 text-[#8AA2D0] sm:left-[14%] sm:top-[22%] sm:size-4" />
        <Sparkle className="absolute right-[8%] top-[46%] size-5 text-[#5F7EC0] sm:right-[9%] sm:top-[14%] sm:size-8" />

        {/* Invitation */}
        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-20 text-center sm:pt-24 lg:pt-28">
          <h2 className="text-balance font-sans text-[clamp(1.9rem,6.2vw,4.75rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-[#10171c]">
            <ScrollReveal delay={side => (side === 'above' ? 0.08 : 0)}>
              <span className="block">Have a project in mind?</span>
            </ScrollReveal>
            <ScrollReveal delay={side => (side === 'above' ? 0 : 0.08)}>
              <span className="block">
                Let's{' '}
                {/* nowrap, so the phrase and its underline never split across lines. */}
                <span className="relative inline-block whitespace-nowrap" style={{ color: ACCENT }}>
                  build it together.
                  {/* Drawn in like a pen stroke each time the line comes into view. */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 300 14"
                    preserveAspectRatio="none"
                    // Low enough to pass under the descenders (the g), not through them.
                    className="absolute -bottom-[0.34em] left-[4%] h-[0.22em] w-[92%] overflow-visible"
                  >
                    <motion.path
                      d="M3 9C60 3 150 2 297 7"
                      fill="none"
                      stroke={ACCENT}
                      strokeWidth={3}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      initial={{ pathLength: reduceMotion ? 1 : 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ amount: 'all' }}
                      transition={{ duration: 0.8, delay: 0.35, ease: [0.65, 0, 0.35, 1] }}
                    />
                  </svg>
                </span>
              </span>
            </ScrollReveal>
          </h2>

          <RevealLines
            className="mt-7 max-w-[46ch] font-sans text-base leading-relaxed text-[#5b6670] sm:mt-8 sm:text-lg"
            text="Tell me what you're working on, and I'll get back to you with a clear next step."
            delay={0.16}
          />

          <ScrollReveal delay={0.24} className="mt-9 sm:mt-10">
            <motion.button
              type="button"
              onClick={() => navigate('/contact')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="rounded-full bg-[#10171c] px-9 py-4 font-sans text-base font-semibold text-white shadow-[0_18px_40px_-18px_rgba(16,23,28,0.7)] outline-none focus-visible:ring-2 focus-visible:ring-[#10171c] focus-visible:ring-offset-4 focus-visible:ring-offset-[#E9EFF6] sm:text-lg"
            >
              Reach me out
            </motion.button>
          </ScrollReveal>

          <ScrollReveal delay={0.3} className="mt-5">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="rounded font-sans text-sm text-[#5b6670] underline-offset-4 outline-none hover:text-[#10171c] hover:underline focus-visible:ring-2 focus-visible:ring-[#10171c] sm:text-base"
            >
              {CONTACT_EMAIL}
            </a>
          </ScrollReveal>

          <ScrollReveal delay={0.36} className="mt-7">
            <ul className="flex flex-wrap items-center justify-center gap-2.5">
              {SOCIAL_LINKS.map(link => (
                <li key={link.kind}>
                  <a
                    href={link.href}
                    aria-label={link.label}
                    title={link.label}
                    {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                    className="flex size-11 items-center justify-center rounded-full border border-[#10171c]/10 bg-white/70 text-[#3a4048] outline-none transition-colors duration-200 hover:border-[#10171c] hover:bg-[#10171c] hover:text-white focus-visible:ring-2 focus-visible:ring-[#10171c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E9EFF6]"
                  >
                    <SocialIcon kind={link.kind} />
                  </a>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>

        {/* Waves. Pushed to the bottom by the spacer, so short screens keep the
            text clear and tall screens gain sea, not gap. */}
        <div className="flex-1" />
        <div aria-hidden="true" className="relative -mt-10 h-[clamp(220px,38svh,420px)] w-full">
          <svg viewBox="0 0 1440 420" preserveAspectRatio="none" className="absolute inset-0 size-full">
            <defs>
              {WAVES.map((wave, i) => (
                <linearGradient key={i} id={`footer-wave-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={wave.from} />
                  <stop offset="1" stopColor={wave.to} />
                </linearGradient>
              ))}
              {/* A soft shade along each crest, so the layers read as depth.
                  Static, so it is painted once rather than every frame. */}
              <filter id="footer-wave-shade" x="-5%" y="-20%" width="110%" height="140%">
                <feDropShadow dx="0" dy="-8" stdDeviation="12" floodColor="#1D2945" floodOpacity="0.2" />
              </filter>
              <filter id="footer-grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
                <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0" />
                <feComposite in2="SourceGraphic" operator="in" />
              </filter>
            </defs>
            {WAVES.map((wave, i) => (
              <motion.g
                key={i}
                initial={reduceMotion ? false : { y: 40 + i * 18 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 1.2, delay: i * 0.08, ease: RISE_EASE }}
              >
                <path d={wave.d} fill={`url(#footer-wave-${i})`} filter="url(#footer-wave-shade)" />
              </motion.g>
            ))}
            {/* Fine grain over the water, clipped to the front layers. */}
            <path d={WAVES[1].d} fill="#fff" filter="url(#footer-grain)" />
          </svg>

          {/* Closing line, on the deepest water. */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 px-6 pb-5 font-sans text-sm text-white/70 sm:px-10 sm:pb-7 lg:px-14">
            <span>© {year} dharu</span>
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

export default FooterSection;
