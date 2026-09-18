import { motion, useInView, useReducedMotion, type MotionValue } from 'framer-motion';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from 'react';

// Matches the eases the sections use, so the replay moves like the entrance.
const REVEAL_EASE = [0.33, 1, 0.68, 1] as const;
const REVEAL_DURATION = 0.7;
const REVEAL_DISTANCE = 40;
// Each line trails the one before it in the direction of travel.
const LINE_STAGGER = 0.08;

export type RevealSide = 'below' | 'above';

/**
 * Tracks whether content should be shown or held off-screen for a replay, and
 * which side it last left through.
 *
 * The first appearance is left alone — each section already has its own
 * entrance, and running both at once would double the travel. Only once the
 * content has been seen and then left the screen entirely does it arm itself.
 *
 * Two observers on purpose. Hiding waits until the content is fully off-screen,
 * so nothing visibly vanishes; showing waits until it is a little way in, so
 * the reveal is actually seen rather than spent at the very edge.
 */
export function useScrollReveal(ref: RefObject<Element>) {
  const onScreen = useInView(ref, { margin: '0px' });
  const wellInView = useInView(ref, { margin: '-10% 0px -10% 0px' });
  const reduceMotion = useReducedMotion();

  const seen = useRef(false);
  const [hidden, setHidden] = useState(false);
  // Kept after the reveal fires, so line order can still follow the direction
  // the content arrived from while it animates in.
  const [side, setSide] = useState<RevealSide>('below');

  useEffect(() => {
    if (wellInView) {
      seen.current = true;
      setHidden(false);
    }
  }, [wellInView]);

  useEffect(() => {
    if (onScreen || !seen.current || !ref.current) return;
    // Wherever it went is where it comes back from.
    setSide(ref.current.getBoundingClientRect().top < 0 ? 'above' : 'below');
    setHidden(true);
  }, [onScreen, ref]);

  /** Motion props for one piece of the content, entering after `delay`. */
  const motionFor = (delay = 0, distance = REVEAL_DISTANCE) => {
    const offset = reduceMotion ? 0 : distance;
    return {
      initial: false as const,
      animate: hidden
        ? { y: side === 'below' ? offset : -offset, opacity: 0 }
        : { y: 0, opacity: 1 },
      transition: hidden
        ? // Off-screen by the time this runs, so there is nothing to animate.
          { duration: 0 }
        : {
            y: { duration: REVEAL_DURATION, delay, ease: REVEAL_EASE },
            opacity: { duration: 0.4, delay, ease: 'easeOut' as const }
          }
    };
  };

  /**
   * Delay for line `line` of `count`. The line nearest the side the content
   * comes in from leads: the top one when scrolling down onto it, the bottom
   * one when scrolling back up.
   */
  const lineDelay = (line: number, count: number, stagger = LINE_STAGGER) =>
    (side === 'above' ? count - 1 - line : line) * stagger;

  return { side, motionFor, lineDelay };
}

/**
 * Groups words into the lines the browser actually wrapped them onto. Wrapping
 * shifts with breakpoints, so lines are read back from each word's offsetTop
 * rather than hard-coded. Transforms don't affect offsetTop, so the animation
 * can't feed back into the measurement.
 */
function useWordLines(
  containerRef: RefObject<HTMLElement>,
  wordRefs: RefObject<(HTMLSpanElement | null)[]>,
  count: number
) {
  const [lines, setLines] = useState<number[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const next: number[] = [];
      let line = -1;
      let lastTop = -Infinity;
      (wordRefs.current ?? []).slice(0, count).forEach(el => {
        const top = el?.offsetTop ?? lastTop;
        // A little tolerance for sub-pixel differences between inline-blocks.
        if (top > lastTop + 2) {
          line += 1;
          lastTop = top;
        }
        next.push(line);
      });
      setLines(prev =>
        prev.length === next.length && prev.every((l, i) => l === next[i]) ? prev : next
      );
    };
    // No synchronous measure() here. Reading offsetTop inside a layout effect
    // forces layout on the spot, and with a block of text per section — each
    // interleaved with framer-motion writing its initial styles — that was a
    // forced layout per block during page load. A ResizeObserver reports every
    // target once when observation starts, after the browser has already laid
    // out, so the first reading lands in the same frame at no extra cost.
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    // An inline container (`as="span"`) never reports a size change, so the
    // block it sits in is watched as well.
    if (container.parentElement) ro.observe(container.parentElement);
    return () => ro.disconnect();
  }, [containerRef, wordRefs, count]);

  return lines;
}

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** A function gets the side the content is arriving from. */
  delay?: number | ((side: RevealSide) => number);
  distance?: number;
}

/** Replays a block as a single unit — for content that is only ever one line. */
export function ScrollReveal({ children, className, delay = 0, distance }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { side, motionFor } = useScrollReveal(ref);
  const resolvedDelay = typeof delay === 'function' ? delay(side) : delay;

  return (
    <motion.div ref={ref} className={className} {...motionFor(resolvedDelay, distance)}>
      {children}
    </motion.div>
  );
}

// Share of a lift's progress each line trails the one above it by.
const LIFT_STAGGER = 0.12;

/**
 * Where line `index` of `total` sits partway through a staggered lift, given
 * the whole group's 0–1 `progress`. Each line gets its own smoothstepped window
 * of that progress, the top one first, so the group peels away line by line on
 * the way up and settles back bottom line first on the way down.
 *
 * `rise` is 0–1 of the lift distance; `opacity` is gone by 70% of it.
 */
export function liftAt(progress: number, index: number, total: number) {
  const stagger = total > 1 ? Math.min(LIFT_STAGGER, 0.5 / (total - 1)) : 0;
  const span = 1 - (total - 1) * stagger;
  const t = Math.min(1, Math.max(0, (progress - index * stagger) / span));
  const rise = t * t * (3 - 2 * t);
  return { rise, opacity: 1 - Math.min(1, rise / 0.7) };
}

export interface LineLift {
  /** The group's 0–1 lift progress. */
  progress: MotionValue<number>;
  /** px each line travels upwards. */
  distance: number;
  /** Lines above this text in the same group, e.g. a label over a headline. */
  firstLine?: number;
  /** Lines in the whole group; defaults to firstLine plus this text's own. */
  totalLines?: number;
}

interface RevealLinesProps {
  text: string;
  as?: 'p' | 'h2' | 'h3' | 'span';
  className?: string;
  /**
   * Offset before the first line moves, for sequencing with siblings. A
   * function gets the side the text is arriving from.
   */
  delay?: number | ((side: RevealSide) => number);
  distance?: number;
  /** Lifts the text out line by line as `lift.progress` runs to 1. */
  lift?: LineLift;
  /** Reports how many lines the text currently wraps onto. */
  onLineCount?: (count: number) => void;
}

/** Replays plain text line by line, following however it wraps right now. */
export function RevealLines({
  text,
  as = 'p',
  className,
  delay = 0,
  distance,
  lift,
  onLineCount
}: RevealLinesProps) {
  // Typed as a paragraph so the ref fits the JSX below; the tag itself varies.
  const ref = useRef<HTMLParagraphElement>(null);
  const { side, motionFor, lineDelay } = useScrollReveal(ref);
  const baseDelay = typeof delay === 'function' ? delay(side) : delay;
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const liftRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lines = useWordLines(ref, wordRefs, words.length);
  const lineCount = lines.length ? lines[lines.length - 1] + 1 : 1;
  const Tag = as as 'p';

  useEffect(() => {
    onLineCount?.(lineCount);
  }, [lineCount, onLineCount]);

  // Written straight to the DOM on every change of the progress value, rather
  // than through React state, so the lift never re-renders the text.
  const liftProgress = lift?.progress;
  const liftDistance = lift?.distance ?? 0;
  const firstLine = lift?.firstLine ?? 0;
  const totalLines = lift?.totalLines ?? firstLine + lineCount;
  useEffect(() => {
    if (!liftProgress) return;
    const apply = (p: number) => {
      liftRefs.current.slice(0, words.length).forEach((el, i) => {
        if (!el) return;
        const { rise, opacity } = liftAt(p, firstLine + (lines[i] ?? 0), totalLines);
        el.style.transform = rise ? `translateY(${-rise * liftDistance}px)` : '';
        el.style.opacity = opacity < 1 ? String(opacity) : '';
      });
    };
    apply(liftProgress.get());
    return liftProgress.on('change', apply);
  }, [liftProgress, liftDistance, firstLine, totalLines, lines, words.length]);

  return (
    <Tag ref={ref} className={className}>
      {words.map((word, i) => (
        <span key={i}>
          {/* The lift gets its own layer so it never fights the reveal.
              inline-block is required: transforms don't apply to inline
              elements. */}
          <span
            ref={el => {
              liftRefs.current[i] = el;
            }}
            className="inline-block"
          >
            <motion.span
              ref={el => {
                wordRefs.current[i] = el;
              }}
              className="inline-block"
              {...motionFor(baseDelay + lineDelay(lines[i] ?? 0, lineCount), distance)}
            >
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 && ' '}
        </span>
      ))}
    </Tag>
  );
}

export default ScrollReveal;
