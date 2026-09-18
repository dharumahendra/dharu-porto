import { motion, useInView } from 'framer-motion';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ThreeDPaper } from './ThreeDPaper';
import { RevealLines, ScrollReveal } from './ScrollReveal';

const HEADLINE_SIZE = "text-[10vw] sm:text-[8vw] lg:text-[6vw]";
const HEADLINE_CLASS =
  `font-sans font-semibold ${HEADLINE_SIZE} leading-[1.15] tracking-[-0.04em] text-[#10171c]`;
// The overflow-hidden rise mask clips at the line box, and leading-[1.15] is
// shorter than the font's descent, so "g"/"y" tails got cut. Extend the mask
// downward with padding and cancel it with an equal negative margin so layout
// is unchanged. Sharing the headline size keeps `em` in step with the glyphs.
const MASK_CLASS = `${HEADLINE_SIZE} w-full overflow-hidden pb-[0.25em] -mb-[0.25em]`;

// easeOutCubic. Deliberately gentler than an easeOutExpo curve like
// [0.16, 1, 0.3, 1], which front-loads ~85% of the travel into the first
// quarter of its duration — that made the rise look finished long before the
// tween actually ended, leaving dead air before the slide fired.
const RISE_EASE = [0.33, 1, 0.68, 1] as const;
// easeInOutCubic — eases out of rest and back into it, so the two words read as
// one smooth gesture rather than two snaps.
const SLIDE_EASE = [0.65, 0, 0.35, 1] as const;
const SLIDE_DURATION = 0.6;
// How far the trailing word of a line follows behind the leading one.
const WORD_STAGGER = 0.12;

const RISE_DURATION = 0.65;
// Second line trails the first slightly; the slide waits for both.
const RISE_STAGGER = 0.08;
const SLIDE_START = RISE_DURATION + RISE_STAGGER;

/**
 * How far a line has to be translated to sit centred in its row, measured from
 * wherever it comes to rest. The entrance starts there and animates back to 0,
 * so the resting layout is whatever the CSS already says — this only ever
 * describes the offset it arrives from.
 *
 * Reads layout values (`offsetWidth`, `offsetLeft`) rather than
 * `getBoundingClientRect`: transforms don't affect them, so the x animation
 * can't feed back into the measurement it is driven by.
 */
function useCentredStart(
  wrapRef: RefObject<HTMLElement>,
  textRef: RefObject<HTMLElement>
) {
  const [offset, setOffset] = useState(0);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) return;
    const measure = () => {
      const slack = wrap.offsetWidth - text.offsetWidth;
      // Both share the section as their offset parent, so subtracting gives
      // the line's left edge within its row — including whatever the flex
      // alignment and margins put there.
      const restLeft = text.offsetLeft - wrap.offsetLeft;
      // A line wider than its row has nowhere to travel; leave it alone rather
      // than starting it off-centre and clipping it against the mask.
      setOffset(slack <= 0 ? 0 : slack / 2 - restLeft);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(text);
    return () => ro.disconnect();
  }, [wrapRef, textRef]);

  return offset;
}

export function IdentitySectionAlt() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-20%" });

  // The two lines rest at opposite edges — "Designing Systems" right, "That
  // Endure" left — but they rise stacked and centred, then split outwards to
  // those resting spots. Measuring each row gives the offset its line starts
  // from; the resting layout itself is untouched.
  const topWrapRef = useRef<HTMLDivElement>(null);
  const topTextRef = useRef<HTMLHeadingElement>(null);
  const bottomWrapRef = useRef<HTMLDivElement>(null);
  const bottomTextRef = useRef<HTMLHeadingElement>(null);

  // Negative: the top line sits left of its resting spot and slides right.
  const topStart = useCentredStart(topWrapRef, topTextRef);
  // Positive: the bottom line sits right of its resting spot and slides left.
  const bottomStart = useCentredStart(bottomWrapRef, bottomTextRef);

  return (
    <section ref={containerRef} className="relative w-full min-h-screen bg-[#F5FAFF] overflow-hidden sm:py-0  py-20 flex flex-col justify-center">
      <div className="page-gutter w-full z-10 flex flex-col min-h-[70vh] justify-between gap-16">
        
        {/* Top: Headline — both lines rise centred and stacked, then part: the
            upper one slides right, the lower one left, each into the resting
            position its own CSS alignment already defines. */}
        <div className="w-full flex flex-col gap-0 mt-10 md:mt-0 pl-0 md:pl-[12vw] lg:pl-[22vw] xl:pl-[26vw]">
          {/* Two lines, so whichever one faces the direction of travel leads. */}
          <ScrollReveal delay={side => (side === 'above' ? 0.08 : 0)}>
          <div ref={topWrapRef} className={`${MASK_CLASS} flex justify-end`}>
            <motion.h2
              ref={topTextRef}
              initial={{ y: 80, opacity: 0 }}
              animate={isInView ? { y: 0, opacity: 1 } : { y: 80, opacity: 0 }}
              transition={{
                y: { duration: RISE_DURATION, delay: 0, ease: RISE_EASE },
                opacity: { duration: 0.35, delay: 0, ease: 'easeOut' },
              }}
              className={`${HEADLINE_CLASS} text-right md:mr-[4vw]`}
            >
              {/* The slide is per-word, and the word at the front of the motion
                  leads: travelling right, that's "Systems", with "Designing"
                  trailing into the gap it opens. Both travel the same distance,
                  so the line lands exactly right-aligned. inline-block is
                  required: transforms don't apply to inline elements. */}
              <motion.span
                className="inline-block"
                initial={{ x: topStart }}
                animate={isInView ? { x: 0 } : { x: topStart }}
                transition={{
                  duration: SLIDE_DURATION,
                  delay: SLIDE_START + WORD_STAGGER,
                  ease: SLIDE_EASE,
                }}
              >
                Designing
              </motion.span>{' '}
              <motion.span
                className="inline-block"
                initial={{ x: topStart }}
                animate={isInView ? { x: 0 } : { x: topStart }}
                transition={{
                  duration: SLIDE_DURATION,
                  delay: SLIDE_START,
                  ease: SLIDE_EASE,
                }}
              >
                Systems
              </motion.span>
            </motion.h2>
          </div>
          </ScrollReveal>

          <ScrollReveal delay={side => (side === 'above' ? 0 : 0.08)}>
          <div ref={bottomWrapRef} className={`${MASK_CLASS} flex justify-start`}>
            <motion.h2
              ref={bottomTextRef}
              initial={{ y: 80, opacity: 0 }}
              animate={isInView ? { y: 0, opacity: 1 } : { y: 80, opacity: 0 }}
              transition={{
                y: { duration: RISE_DURATION, delay: RISE_STAGGER, ease: RISE_EASE },
                opacity: { duration: 0.35, delay: RISE_STAGGER, ease: 'easeOut' },
              }}
              className={`${HEADLINE_CLASS} text-left`}
            >
              {/* Mirrors the line above: same distance, opposite direction, and
                  again the leading word is the one at the front of the motion —
                  travelling left, that's "That". */}
              <motion.span
                className="inline-block"
                initial={{ x: bottomStart }}
                animate={isInView ? { x: 0 } : { x: bottomStart }}
                transition={{
                  duration: SLIDE_DURATION,
                  delay: SLIDE_START,
                  ease: SLIDE_EASE,
                }}
              >
                That
              </motion.span>{' '}
              <motion.span
                className="inline-block"
                initial={{ x: bottomStart }}
                animate={isInView ? { x: 0 } : { x: bottomStart }}
                transition={{
                  duration: SLIDE_DURATION,
                  delay: SLIDE_START + WORD_STAGGER,
                  ease: SLIDE_EASE,
                }}
              >
                Endure
              </motion.span>
            </motion.h2>
          </div>
          </ScrollReveal>
        </div>

        {/* Bottom: Grid for Paragraph and Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-start w-full mt-10 md:mt-0">
          
          {/* Bottom Left: Paragraph — higher position */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            className="w-full pb-4 pr-4 self-start"
          >
            <RevealLines
              className="text-[#3a4048] font-sans text-base sm:text-lg leading-relaxed font"
              text="I am a software engineer with a deep focus on crafting robust backend architectures, scalable data pipelines, and decentralized Web3 solutions that stand the test of time."
            />
          </motion.div>

          {/* Bottom Right: Media Card — lower position (panoramic ratio) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
            animate={isInView ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.9, rotate: 0 }}
            transition={{ duration: 1, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-start md:justify-end mt-4 md:mt-12 self-end w-full"
          >
            <motion.div
              whileHover={{ scale: 1.02, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative w-full aspect-[16/9] rounded-[2rem] overflow-hidden cursor-pointer"
            >
              <ThreeDPaper variant="original" />
            </motion.div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
