import { motion, useInView } from 'framer-motion';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ProjectCard, type ProjectCardProps } from './ProjectCard';
import { ScrollReveal, useScrollReveal } from './ScrollReveal';

// Headline entrance: each wrapped line rises into place in turn and, while
// still rising, slides in from the right word by word — the leftmost word
// leads, the rest trail. Eases match IdentitySectionAlt so the page moves as one.
const RISE_EASE = [0.33, 1, 0.68, 1] as const;
const RISE_DURATION = 0.65;
const RISE_DISTANCE = 60;
// Each line trails the one above it by this much, for both the rise and slide.
const LINE_STAGGER = 0.08;
const SLIDE_EASE = [0.65, 0, 0.35, 1] as const;
const SLIDE_DURATION = 0.6;
const SLIDE_DISTANCE = 80;
// Lines carry several words, so this is tighter than IdentitySectionAlt's
// two-word stagger to keep the last word from lagging too far behind.
const WORD_STAGGER = 0.02;
// How far into its own rise a line starts sliding. The rise ease front-loads
// its movement, so by this point the line is mostly up and the slide flows
// straight on from it instead of waiting for every line to settle.
const SLIDE_OFFSET = 0.25;

// Card entrance: the tile hinges open from its inner corner — the corner
// nearest the middle of the grid sits at its final spot from the first frame
// while the outer edge swings up and the card grows to full size. The two
// columns mirror each other, so the row opens outwards from the centre.
const CARD_EASE = RISE_EASE;
const CARD_DURATION = 1.2;
// The fade tracks the movement rather than running on its own short clock —
// at the old 0.4s the card was fully opaque while still visibly swinging.
const CARD_FADE_DURATION = 0.7;
const CARD_SCALE = 0.92;
// Degrees of tilt on the outer edge. A wide card multiplies this: 6deg puts
// the far corner some 60px low before it swings up. Going much past this
// starts pushing the outer corner beyond `page-gutter` into a horizontal
// scrollbar.
const CARD_TILT = 6;
// The left card of a row leads; its neighbour trails by this much.
const CARD_STAGGER = 0.1;
// Matches the `lg:grid-cols-2` breakpoint below — above it the grid has two
// columns, which is what decides each card's hinge corner.
const TWO_COLUMN_QUERY = '(min-width: 1024px)';

export interface HeadlineSegment {
  text: string;
  /** De-emphasise this segment in the muted colour. */
  muted?: boolean;
}

interface ProjectsGridProps {
  /** Small muted eyebrow above the headline. */
  label?: string;
  /** Headline copy, as segments so it can be split into animated words. */
  headline?: HeadlineSegment[];
}

const DEFAULT_HEADLINE: HeadlineSegment[] = [
  { text: 'We are a' },
  { text: 'diligent', muted: true },
  { text: "team, that's passionate about turning ideas into digital realities." }
];

// Placeholder content — swap `src`/`title`/`stack` as real project work lands.
// Add `href` to a project to make its card a link.
const PROJECTS: ProjectCardProps[] = [
  { title: 'Themis', stack: ['TypeScript', 'Java', 'PostgreSQL'], src: '/placeholder-1.jpg', alt: 'Placeholder project one' },
  { title: 'AEVA Team', stack: ['TypeScript', 'Java', 'PostgreSQL'], src: '/placeholder-2.jpg', alt: 'Placeholder project two' },
  { title: 'CHR Innovations', stack: ['TypeScript', 'Java', 'PostgreSQL'], src: '/placeholder-3.jpg', alt: 'Placeholder project three' },
  { title: 'Profit Saloon', stack: ['TypeScript', 'Java', 'PostgreSQL'], src: '/placeholder-4.jpg', alt: 'Placeholder project four' },
  { title: 'Nocturne', stack: ['TypeScript', 'Java', 'PostgreSQL'], src: '/placeholder-5.jpg', alt: 'Placeholder project five' },
  { title: 'Meridian', stack: ['TypeScript', 'Java', 'PostgreSQL'], src: '/placeholder-6.jpg', alt: 'Placeholder project six' }
];

interface WordSlot {
  line: number;
  /** Position within its line, counted from the left. */
  col: number;
}

/**
 * Whether the project grid is currently two columns wide. The hinge corner and
 * tilt direction mirror per column, and those are transform values set in JS,
 * so the breakpoint has to be read here rather than left to a CSS media query.
 */
function useTwoColumns() {
  // Resolved during the very first render, not in the effect below. Framer
  // commits `initial` once, at mount, and never re-applies it while an element
  // is out of view — so a card that mounts believing it is in the left column
  // keeps that column's tilt even after the effect flips this to true, while
  // `transformOrigin` (an ordinary style prop) does update. The card ends up
  // with a right-column hinge and a left-column tilt, and reads as a plain
  // clockwise spin instead of an outer edge swinging up.
  const [twoColumns, setTwoColumns] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(TWO_COLUMN_QUERY).matches
  );

  useLayoutEffect(() => {
    const mq = window.matchMedia(TWO_COLUMN_QUERY);
    const sync = () => setTwoColumns(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return twoColumns;
}

export function ProjectsGrid({ label = 'Work', headline = DEFAULT_HEADLINE }: ProjectsGridProps = {}) {
  const headlineRef = useRef(null);
  const isInView = useInView(headlineRef, { once: true, margin: '-20%' });
  const twoColumns = useTwoColumns();

  const words = useMemo(
    () =>
      headline.flatMap(segment =>
        segment.text.split(/\s+/).filter(Boolean).map(text => ({ text, muted: segment.muted }))
      ),
    [headline]
  );

  // Lines come from the browser's own wrapping, which shifts with breakpoints,
  // so they're read back from each word's offsetTop rather than hard-coded.
  // Transforms don't affect offsetTop, so the animation can't feed back here.
  const textRef = useRef<HTMLHeadingElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [slots, setSlots] = useState<WordSlot[]>([]);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;
    const measure = () => {
      const next: WordSlot[] = [];
      let line = -1;
      let col = 0;
      let lastTop = -Infinity;
      wordRefs.current.slice(0, words.length).forEach(el => {
        const top = el?.offsetTop ?? lastTop;
        // A little tolerance for sub-pixel differences between inline-blocks.
        if (top > lastTop + 2) {
          line += 1;
          col = 0;
          lastTop = top;
        }
        next.push({ line, col: col++ });
      });
      setSlots(prev =>
        prev.length === next.length && prev.every((s, i) => s.line === next[i].line && s.col === next[i].col)
          ? prev
          : next
      );
    };
    // First reading comes from the observer's initial report, after layout,
    // rather than a forced layout inside this effect during page load.
    const ro = new ResizeObserver(measure);
    ro.observe(text);
    return () => ro.disconnect();
  }, [words]);

  // Scroll replay, line by line, on top of the one-off entrance above.
  const reveal = useScrollReveal(textRef);
  const lineCount = slots.length ? slots[slots.length - 1].line + 1 : 1;

  return (
    <section className="relative w-full bg-[#F5FAFF] page-gutter pb-24 pt-24 sm:pt-28 lg:pt-32">
      {/* overflow-x-clip keeps the slide's starting offset from widening the
          page on narrow screens; the y axis stays visible so descenders and
          the rise aren't cut off. */}
      <div ref={headlineRef} className="mb-12 w-full overflow-x-clip sm:mb-16 lg:mb-20">
        {/* The label counts as the line above the headline: first on the way
            down, last on the way back up. */}
        <ScrollReveal delay={side => (side === 'above' ? lineCount * 0.08 : 0)}>
          <p className="mb-4 font-sans text-sm font-medium text-[#9aa6ad] sm:mb-5">{label}</p>
        </ScrollReveal>
        <h2
          ref={textRef}
          className="max-w-[24ch] font-sans text-3xl font-semibold leading-[1.06] tracking-[-0.03em] text-[#10171c] sm:text-5xl lg:text-6xl xl:text-7xl"
        >
          {words.map((word, i) => {
            const { line, col } = slots[i] ?? { line: 0, col: i };
            const riseDelay = line * LINE_STAGGER;
            return (
              <span key={i}>
                {/* The rise and slide live on separate elements so each keeps
                    its own delay. inline-block is required: transforms don't
                    apply to inline elements. */}
                <motion.span
                  ref={el => {
                    wordRefs.current[i] = el;
                  }}
                  className={`inline-block ${word.muted ? 'text-[#9aa6ad]' : ''}`}
                  initial={{ y: RISE_DISTANCE, opacity: 0 }}
                  animate={isInView ? { y: 0, opacity: 1 } : { y: RISE_DISTANCE, opacity: 0 }}
                  transition={{
                    y: { duration: RISE_DURATION, delay: riseDelay, ease: RISE_EASE },
                    opacity: { duration: 0.35, delay: riseDelay, ease: 'easeOut' },
                  }}
                >
                  <motion.span
                    className="inline-block"
                    initial={{ x: SLIDE_DISTANCE }}
                    animate={isInView ? { x: 0 } : { x: SLIDE_DISTANCE }}
                    transition={{
                      duration: SLIDE_DURATION,
                      delay: riseDelay + SLIDE_OFFSET + col * WORD_STAGGER,
                      ease: SLIDE_EASE,
                    }}
                  >
                    <motion.span
                      className="inline-block"
                      {...reveal.motionFor(
                        reveal.lineDelay(line, lineCount) + (reveal.side === 'below' ? 0.08 : 0)
                      )}
                    >
                      {word.text}
                    </motion.span>
                  </motion.span>
                </motion.span>
                {i < words.length - 1 && ' '}
              </span>
            );
          })}
        </h2>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-10">
        {PROJECTS.map((project, i) => {
          // Column index within the row, so the pattern repeats row by row.
          // Single-column layouts treat every card as a left-hand one.
          const rightColumn = twoColumns && i % 2 === 1;
          // The hinge is the corner facing the middle of the grid. A positive
          // rotation drops the card's right edge, a negative one its left, so
          // each column starts with its *outer* edge low and swings it up.
          const pivot = rightColumn ? 'top left' : 'top right';
          const tilt = rightColumn ? CARD_TILT : -CARD_TILT;
          const delay = rightColumn ? CARD_STAGGER : 0;

          return (
            // Each card watches its own entry into the viewport, so tiles
            // further down the grid don't burn their animation while still
            // off-screen. `once` stays off: leaving the viewport rewinds the
            // card to its starting state, so the entrance plays again on every
            // pass. No viewport margin either — the card fires the moment any
            // part of it touches the viewport edge, instead of waiting to be
            // scrolled further in, and only rewinds once it is fully out of
            // sight.
            <motion.div
              key={project.title}
              className="will-change-transform"
              style={{ transformOrigin: pivot }}
              initial={{ scale: CARD_SCALE, rotate: tilt, opacity: 0 }}
              whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
              viewport={{ once: false, amount: 'some' }}
              transition={{
                duration: CARD_DURATION,
                delay,
                ease: CARD_EASE,
                opacity: { duration: CARD_FADE_DURATION, delay, ease: 'easeOut' },
              }}
            >
              <ProjectCard {...project} />
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
