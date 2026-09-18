import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform
} from 'framer-motion';
import { useLenis } from 'lenis/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RevealLines, ScrollReveal, liftAt, type RevealSide } from './ScrollReveal';
import { ExperienceDepth, ExperienceList, depthScrollVh } from './ExperienceDepth';
import { EXPERIENCES, type Experience } from '../data/experiences';

// Matches the eases the other sections use, so the page moves as one.
const RISE_EASE = [0.33, 1, 0.68, 1] as const;
const RISE_DURATION = 0.65;
const RISE_DISTANCE = 48;
// The black box, as a share of the viewport height before it grows.
const BOX_VH = 70;
// Seconds the box takes to grow to full screen once it pins. It plays on its
// own clock, so no scrolling is needed to finish it.
const GROW_DURATION = 0.9;
// The header clears out first, at the same pace as the growth: it lifts this
// far and fades, and the box waits GROW_DELAY before it starts growing.
const HEADER_LIFT_DISTANCE = 120;
// Scrolling back up, the page settles with the shrunken box's bottom edge this
// many px above the bottom of the screen.
// Kept below the pin gap ((100 - BOX_VH) / 2 svh): settling any higher would
// put the box back past its pin point and grow it straight away again.
const SHRINK_OFFSET = 40;
const GROW_DELAY = 0.2;
// Scroll distance, in viewport heights, that the end view (small box, header
// back above it) holds pinned before the section scrolls away to the footer.
const END_HOLD_VH = 60;
// Seconds for the camera to fly in to the first card once the box is full, and
// to pull back out from it when scrolling back up.
const ZOOM_IN_DURATION = 1.4;
const ZOOM_OUT_DURATION = 0.9;
// Matches rounded-3xl.
const BOX_RADIUS = 24;
// Bento tiles land in reading order, a touch quicker than the rows above.
const TILE_STAGGER = 0.07;
// Scroll replay: gap between successive lines of text.
const TEXT_STEP = 0.08;

export interface ExperienceEntry {
  role: string;
  organization: string;
  /** Free text — "2023 — Present", "Summer 2022", whatever reads best. */
  period: string;
  /** When set the row becomes a link to the organization. */
  href?: string;
}

/**
 * Tile footprints. Written out in full rather than composed at runtime:
 * Tailwind scans source text, so a class it never sees spelled out is a class
 * it never generates.
 */
export type TileSize = 'hero' | 'tall' | 'wide' | 'standard';

const TILE_SPAN: Record<TileSize, string> = {
  hero: 'md:col-span-2 lg:col-span-4 lg:row-span-2',
  tall: 'md:col-span-1 lg:col-span-2 lg:row-span-2',
  wide: 'md:col-span-2 lg:col-span-4',
  standard: 'md:col-span-1 lg:col-span-2'
};

export interface ExperienceTile extends ExperienceEntry {
  size?: TileSize;
  /** A line or two of context. Large tiles look thin without it. */
  note?: string;
  /** Photo tiles carry an image; the rest carry an abstract field. */
  src?: string;
  alt?: string;
}

interface ExperienceSectionProps {
  /** Small muted eyebrow above the headline. */
  label?: string;
  headline?: string;
  /** The cards flown through inside the black box. */
  experiences?: Experience[];
  /** The bento grid below the black box. */
  tiles?: ExperienceTile[];
}

// Placeholder content — swap as the real history lands.
const DEFAULT_TILES: ExperienceTile[] = [
  {
    size: 'hero',
    role: 'Core Maintainer',
    organization: 'Nocturne Protocol',
    period: '2023 — 2024',
    note: 'Owned the indexer and the settlement pipeline behind it.',
    src: '/placeholder-5.jpg',
    alt: 'Placeholder organization image'
  },
  {
    size: 'tall',
    role: 'Research Lead',
    organization: 'Meridian Collective',
    period: '2023',
    note: 'Distributed systems reading group, turned into a working spec.'
  },
  {
    size: 'standard',
    role: 'Mentor',
    organization: 'Profit Saloon',
    period: '2022 — 2023'
  },
  {
    size: 'standard',
    role: 'Speaker',
    organization: 'Celo Connect',
    period: '2022'
  },
  {
    size: 'wide',
    role: 'Engineering Volunteer',
    organization: 'Campus Dev Society',
    period: '2021 — 2022',
    note: 'Ran the backend track: forty students, one very tired database.',
    src: '/placeholder-2.jpg',
    alt: 'Placeholder organization image'
  },
  {
    size: 'standard',
    role: 'Contributor',
    organization: 'Themis OSS',
    period: '2021'
  }
];

/**
 * A large abstract field for the tiles that carry no photograph. Three
 * compositions, picked by position so the grid never repeats itself twice in a
 * row, drawn at low contrast in the tile's own colour. `slice` keeps the
 * geometry circular whatever shape the tile ends up.
 */
function AbstractField({ variant }: { variant: number }) {
  const shape = variant % 3;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {shape === 0 && (
        <g fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.28">
          {[26, 48, 70, 92, 114, 136].map(r => (
            <circle key={r} cx="168" cy="34" r={r} />
          ))}
        </g>
      )}
      {shape === 1 && (
        <g stroke="currentColor" strokeWidth="9" opacity="0.16">
          {[-40, 0, 40, 80, 120, 160, 200].map(offset => (
            <line key={offset} x1={offset} y1="210" x2={offset + 110} y2="-10" />
          ))}
        </g>
      )}
      {shape === 2 && (
        <g fill="currentColor" opacity="0.22">
          {Array.from({ length: 8 }, (_, row) =>
            Array.from({ length: 8 }, (_, col) => (
              <circle
                key={`${row}-${col}`}
                cx={14 + col * 25}
                cy={14 + row * 25}
                // Dots grow towards the bottom-right, which keeps the corner
                // where the text sits quiet.
                r={0.8 + (row + col) * 0.28}
              />
            ))
          )}
        </g>
      )}
    </svg>
  );
}

/**
 * One bento tile.
 *
 * Its own component rather than inline in the grid's map, so the surface
 * decisions below stay readable next to the content they drive.
 */
function BentoTile({ tile, index }: { tile: ExperienceTile; index: number }) {
  const Wrapper = tile.href ? 'a' : 'div';
  const hasPhoto = Boolean(tile.src);
  // Photo tiles read as dark by nature; the rest alternate so the grid never
  // lands two identical surfaces side by side.
  const ink = hasPhoto || index % 3 === 1;
  // The tile's text elements replay in order, each one a step behind the
  // last — reversed when scrolling back up, so the bottom one leads.
  const textCount = tile.note ? 4 : 3;
  const textStep = (n: number) => (side: RevealSide) =>
    (side === 'above' ? textCount - 1 - n : n) * TEXT_STEP;

  return (
    <Wrapper
      {...(tile.href ? { href: tile.href, target: '_blank', rel: 'noreferrer' } : {})}
      className={`group relative flex h-full w-full flex-col justify-end overflow-hidden rounded-3xl p-6 outline-1 -outline-offset-1 sm:p-8 lg:p-10 ${
        ink ? 'bg-[#10171c] text-white outline-white/10' : 'bg-white text-[#10171c] outline-black/10'
      } ${
        tile.href
          ? 'outline-none focus-visible:ring-2 focus-visible:ring-[#10171c] focus-visible:ring-offset-4 focus-visible:ring-offset-[#F5FAFF]'
          : ''
      }`}
    >
      {hasPhoto ? (
        <>
          {/* A plain <img>, not ChromaticImage: every one of those is a live
              WebGL context of its own, and the page already runs close to the
              browser's per-tab ceiling. */}
          <img
              src={tile.src}
              alt={tile.alt ?? ''}
              className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
          </>
        ) : (
          <>
            <AbstractField variant={index} />
            {/* The field runs edge to edge, so it would otherwise cross the
                text. Fading the tile's own colour back in over the lower half
                keeps the pattern reading as a backdrop. */}
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t to-transparent ${
                ink ? 'from-[#10171c] via-[#10171c]/80' : 'from-white via-white/80'
              }`}
            />
          </>
        )}

        <div className="relative">
          <RevealLines
            text={tile.period}
            delay={textStep(0)}
            distance={24}
            className={`font-sans text-xs font-medium uppercase tracking-[0.08em] ${
              ink ? 'text-white/60' : 'text-[#9aa6ad]'
            }`}
          />
          <RevealLines
            as="h3"
            text={tile.role}
            delay={textStep(1)}
            distance={24}
            className="mt-2 font-sans text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl"
          />
          <p className={`mt-1 font-sans text-sm sm:text-base ${ink ? 'text-white/75' : 'text-[#3a4048]'}`}>
            <RevealLines
              as="span"
              text={tile.organization}
              delay={textStep(2)}
              distance={24}
              className={tile.href ? 'group-hover:underline' : undefined}
            />
          </p>
          {tile.note && (
            <RevealLines
              text={tile.note}
              delay={textStep(3)}
              distance={24}
              className={`mt-4 max-w-[38ch] font-sans text-sm leading-relaxed sm:text-base ${
                ink ? 'text-white/70' : 'text-[#3a4048]'
              }`}
            />
          )}
      </div>
    </Wrapper>
  );
}

/**
 * ExperienceSection — a header over a plain black box, optionally followed by a
 * bento grid.
 *
 * The box pins once its centre reaches the centre of the viewport, which
 * triggers it to grow to cover the whole screen on its own — no further
 * scrolling needed. The navbar stays above it
 * (it is fixed at a far higher z-index), and the section label is held in the
 * top-left corner once the box has taken over.
 */
export function ExperienceSection({
  label = 'Experience',
  headline = 'Where the work happened.',
  experiences = EXPERIENCES,
  tiles = DEFAULT_TILES
}: ExperienceSectionProps = {}) {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-15%' });
  const bentoRef = useRef(null);
  // The grid sits a screen further down, so it watches for itself rather than
  // firing with the stage and finishing long before anyone sees it.
  const bentoInView = useInView(bentoRef, { once: true, margin: '-15%' });
  // Honoured throughout: the content still arrives, it just stops travelling.
  const reduceMotion = useReducedMotion();

  // Lenis scrolls its own container rather than the window, so the track's
  // position is read on every Lenis tick instead of from framer's window-based
  // useScroll.
  const trackRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  // Growth, 0–1. Triggered rather than scrubbed: pinning starts it and it runs
  // to full screen by itself; scrolling back above the pin point reverses it.
  const progress = useMotionValue(0);
  const grown = useRef(false);
  // 0–1: how far the header has lifted out of the box's way. It lifts line by
  // line — the label first, then each line the headline wraps onto — each on
  // the same smoothstep as the box's growth, so it all reads as one movement.
  const headerLift = useMotionValue(0);
  const [headlineLines, setHeadlineLines] = useState(1);
  const headerLines = 1 + headlineLines;
  const labelLiftRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apply = (p: number) => {
      const el = labelLiftRef.current;
      if (!el) return;
      const { rise, opacity } = liftAt(p, 0, headerLines);
      el.style.transform = rise ? `translateY(${-rise * HEADER_LIFT_DISTANCE}px)` : '';
      el.style.opacity = opacity < 1 ? String(opacity) : '';
    };
    apply(headerLift.get());
    return headerLift.on('change', apply);
  }, [headerLift, headerLines]);
  // Past the last card the whole thing plays back in reverse: the box shrinks
  // back down and a second copy of the header drops in above it, so the
  // section ends on the same view it started from. 0–1 for each.
  const endProgress = useMotionValue(0);
  const endHeader = useMotionValue(0);
  const ended = useRef(false);
  const endTimer = useRef<number>();
  const endLabelRef = useRef<HTMLParagraphElement>(null);
  // RevealLines lifts as its progress runs to 1; the end header does the
  // opposite, dropping into place as endHeader runs to 1.
  const endHeaderLift = useTransform(endHeader, v => 1 - v);

  useEffect(() => {
    const apply = (p: number) => {
      const el = endLabelRef.current;
      if (!el) return;
      const { rise, opacity } = liftAt(p, 0, headerLines);
      el.style.transform = rise ? `translateY(${-rise * HEADER_LIFT_DISTANCE}px)` : '';
      el.style.opacity = String(opacity);
    };
    apply(endHeaderLift.get());
    return endHeaderLift.on('change', apply);
  }, [endHeaderLift, headerLines]);

  // The rest of the track flies through the experience cards inside the box.
  const depthProgress = useMotionValue(0);
  // 0–1: the camera's fly-in to the first card, played on a clock once the box
  // is full rather than scrubbed by scroll.
  const intro = useMotionValue(0);
  const settleTimer = useRef<number>();
  // How far each axis has to stretch for the box to cover the viewport.
  const coverX = useMotionValue(1);
  const coverY = useMotionValue(1);
  const depthVh = depthScrollVh(experiences.length);

  /** How far the track has scrolled past the pin point, in px. */
  const pastPin = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;
    const pinTop = ((100 - BOX_VH) / 200) * window.innerHeight;
    return pinTop - track.getBoundingClientRect().top;
  }, []);

  const updateProgress = useCallback(() => {
    if (!trackRef.current) return;
    const depthPx = (depthVh / 100) * window.innerHeight;
    const past = pastPin();
    // The box pins the moment its centre reaches the viewport's centre, and
    // that is the trigger both ways. The header lifts clear first so the
    // growing box never runs into it; on the way back the box shrinks before
    // the header drops back in.
    const shouldGrow = past >= 0;
    if (shouldGrow !== grown.current) {
      grown.current = shouldGrow;
      const lenis = lenisRef.current;
      const box = stickyRef.current;
      window.clearTimeout(settleTimer.current);

      if (shouldGrow) {
        // A shrink that was still zooming out held the scroll; hand it back.
        lenis?.start();
        animate(headerLift, 1, { duration: GROW_DURATION, ease: 'linear' });
        animate(progress, 1, {
          duration: GROW_DURATION,
          delay: GROW_DELAY,
          ease: 'linear',
          // Once the box fills the screen, the camera flies in to the first
          // card on its own — no scrolling needed.
          onComplete: () => {
            if (grown.current) animate(intro, 1, { duration: ZOOM_IN_DURATION, ease: 'linear' });
          }
        });
      } else {
        // Leaving upwards reverses it all in order: the camera pulls back out
        // from the first card, then the box shrinks, then the header drops
        // back in. The zoom-out only takes as long as there is zoom left to
        // undo, so bailing out mid-fly-in doesn't add a dead pause.
        const zoomOut = intro.get() * ZOOM_OUT_DURATION;
        animate(intro, 0, { duration: zoomOut, ease: 'linear' });
        animate(progress, 0, { duration: GROW_DURATION, delay: zoomOut, ease: 'linear' });
        animate(headerLift, 0, {
          duration: GROW_DURATION,
          delay: zoomOut + GROW_DURATION * 0.2,
          ease: 'linear'
        });

        if (lenis && box) {
          // The page is held still while the camera pulls out, so the box
          // stays on screen for it. Then it settles as the box shrinks: at
          // rest the small box's bottom edge sits SHRINK_OFFSET px above the
          // bottom of the screen. The sticky wrapper is never scaled, so its
          // edge is the small box's edge whatever the growth is doing.
          if (zoomOut > 0) lenis.stop();
          settleTimer.current = window.setTimeout(() => {
            lenis.start();
            // Clamped a few px short of the pin gap, so a short screen can't
            // settle the box back onto its pin point.
            const pinGap = ((100 - BOX_VH) / 200) * window.innerHeight;
            const offset = Math.min(SHRINK_OFFSET, pinGap - 4);
            const settleBy = window.innerHeight - offset - box.getBoundingClientRect().bottom;
            // A fast fling may already have carried it past that spot; pulling
            // the page back down against the scroll would feel like a snag.
            if (settleBy > 0) {
              lenis.scrollTo(lenis.scroll - settleBy, { duration: GROW_DURATION, lock: true });
            }
          }, zoomOut * 1000);
        }
      }
    }

    // Past the end of the fly-through: shrink back and bring the header back
    // in, mirroring the way in — the box leads on the way out, the header on
    // the way back. The page is held still for the length of it, so the end
    // view has settled before scrolling carries on to the footer.
    const shouldEnd = past >= depthPx;
    if (shouldEnd !== ended.current) {
      ended.current = shouldEnd;
      const lenis = lenisRef.current;
      window.clearTimeout(endTimer.current);
      if (shouldEnd) {
        animate(endProgress, 1, { duration: GROW_DURATION, ease: 'linear' });
        animate(endHeader, 1, { duration: GROW_DURATION, delay: GROW_DURATION * 0.2, ease: 'linear' });
      } else {
        animate(endHeader, 0, { duration: GROW_DURATION, ease: 'linear' });
        animate(endProgress, 0, { duration: GROW_DURATION, delay: GROW_DELAY, ease: 'linear' });
      }
      if (lenis) {
        lenis.stop();
        endTimer.current = window.setTimeout(
          () => lenis.start(),
          (GROW_DURATION + GROW_DURATION * 0.2) * 1000
        );
      }
    }

    depthProgress.set(Math.min(Math.max(past / depthPx, 0), 1));
  }, [progress, headerLift, intro, endProgress, endHeader, depthProgress, depthVh, pastPin]);

  useEffect(
    () => () => {
      window.clearTimeout(settleTimer.current);
      window.clearTimeout(endTimer.current);
    },
    []
  );

  const lenis = useLenis(updateProgress);
  // updateProgress runs from inside Lenis's own callback, before this render's
  // `lenis` is in scope for it, so it reaches the instance through a ref.
  const lenisRef = useRef(lenis);
  lenisRef.current = lenis;

  // Turns a fly-through progress value back into a scroll position — used by
  // the progress dots and by snapping to the nearest card.
  const seekDepth = useCallback(
    (p: number) => {
      if (!lenis) return;
      const targetPast = p * (depthVh / 100) * window.innerHeight;
      lenis.scrollTo(lenis.scroll + (targetPast - pastPin()), { duration: 0.8 });
    },
    [lenis, depthVh, pastPin]
  );

  useLayoutEffect(() => {
    const box = stickyRef.current;
    if (!box) return;
    const measure = () => {
      // offsetWidth/Height ignore transforms, so the growth can't feed back.
      // A hair over 1:1 so no sub-pixel seam shows at the screen's edges.
      coverX.set((document.documentElement.clientWidth / Math.max(box.offsetWidth, 1)) * 1.01);
      coverY.set((window.innerHeight / Math.max(box.offsetHeight, 1)) * 1.01);
      updateProgress();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
    // reduceMotion swaps the track in or out, so the refs change with it.
  }, [coverX, coverY, updateProgress, reduceMotion]);

  // How grown the box actually is: grown by the way in, undone again by the
  // way out past the last card.
  const growth = useTransform([progress, endProgress], ([p, e]: number[]) => p * (1 - e));
  // Smoothstep, so the growth eases out of rest and settles into full screen.
  const eased = useTransform(growth, p => p * p * (3 - 2 * p));

  // Where the box is pinned. On the way in it pins centred; at the end it
  // slides down to rest with its bottom edge SHRINK_OFFSET px above the bottom
  // of the screen — the same spot it settles at when leaving upwards — which
  // leaves room above it for the header. Read from the viewport on every
  // change, so a resize is picked up on the next frame.
  const stickyTop = useTransform(endProgress, e => {
    const vh = window.innerHeight;
    const pinTop = ((100 - BOX_VH) / 200) * vh;
    const endTop = vh - SHRINK_OFFSET - (BOX_VH / 100) * vh;
    const s = e * e * (3 - 2 * e);
    return pinTop + (endTop - pinTop) * s;
  });
  // The fly-through is sized to the viewport, so it moves the other way to stay put.
  const depthTop = useTransform(stickyTop, t => -t);
  const boxScaleX = useTransform([eased, coverX], ([p, c]: number[]) => 1 + (c - 1) * p);
  const boxScaleY = useTransform([eased, coverY], ([p, c]: number[]) => 1 + (c - 1) * p);
  // The corners are drawn before the scale, so each axis is divided back out —
  // otherwise they'd balloon as the box stretches. They square off as it lands.
  const boxRadius = useTransform([eased, boxScaleX, boxScaleY], ([p, sx, sy]: number[]) => {
    const r = BOX_RADIUS * (1 - p);
    return `${r / sx}px / ${r / sy}px`;
  });
  // The fly-through fades in over the last stretch of the growth, and is taken
  // out of hit-testing entirely while invisible so it can't swallow clicks.
  const depthOpacity = useTransform(growth, [0.85, 1], [0, 1]);
  const depthVisibility = useTransform(depthOpacity, o => (o < 0.01 ? 'hidden' : 'visible'));

  const rise = (delay: number, active = isInView, distance = RISE_DISTANCE) => ({
    initial: { y: reduceMotion ? 0 : distance, opacity: 0 },
    animate: active ? { y: 0, opacity: 1 } : { y: reduceMotion ? 0 : distance, opacity: 0 },
    transition: {
      y: { duration: RISE_DURATION, delay, ease: RISE_EASE },
      opacity: { duration: 0.4, delay, ease: 'easeOut' as const }
    }
  });

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-[#F5FAFF] page-gutter py-10 sm:py-12 lg:py-16"
    >
      <div>
        <div className="shrink-0">
          {/* The label is the line above the headline: first on the way down,
              after the headline's lines on the way back up. The outer layer
              carries the lift, so it never fights the entrance and
              scroll-replay animations inside. */}
          <div ref={labelLiftRef}>
            <ScrollReveal delay={side => (side === 'above' ? 0.16 : 0)}>
              <motion.p
                {...rise(0)}
                className="mb-3 font-sans text-sm font-medium text-[#9aa6ad] sm:mb-4"
              >
                {label}
              </motion.p>
            </ScrollReveal>
          </div>
          <motion.h2
            {...rise(0.08)}
            className="max-w-[20ch] font-sans text-3xl font-semibold leading-[1.06] tracking-[-0.03em] text-[#10171c] sm:text-4xl lg:text-5xl"
          >
            <RevealLines
              as="span"
              text={headline}
              delay={side => (side === 'above' ? 0 : TEXT_STEP)}
              lift={{
                progress: headerLift,
                distance: HEADER_LIFT_DISTANCE,
                firstLine: 1,
                totalLines: headerLines
              }}
              onLineCount={setHeadlineLines}
            />
          </motion.h2>
        </div>

        {reduceMotion ? (
          <div className="mt-8 sm:mt-10 lg:mt-12">
            <ExperienceList experiences={experiences} label={label} />
          </div>
        ) : (
        /* The track is what gets scrolled through: the box's own height, the
           fly-through, and a short hold on the end view before the section
           lets go. The growth needs no scroll distance of its own. */
        <div
          ref={trackRef}
          className="relative mt-8 sm:mt-10 lg:mt-12"
          style={{ height: `${BOX_VH + depthVh + END_HOLD_VH}svh` }}
        >
          {/* Pinned so its centre sits on the viewport's centre — the growth
              starts exactly when the box's middle reaches the middle of the
              screen. */}
          <motion.div
            ref={stickyRef}
            className="sticky z-10"
            style={{ top: stickyTop, height: `${BOX_VH}svh` }}
          >
            {/* The header again, for the end of the section: sits above the
                box as the original did, and drops in line by line once the
                box has shrunk back. Hidden from assistive tech — the real
                heading is the one at the top. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-full mb-8 sm:mb-10 lg:mb-12"
            >
              <p
                ref={endLabelRef}
                className="mb-3 font-sans text-sm font-medium text-[#9aa6ad] opacity-0 sm:mb-4"
              >
                {label}
              </p>
              <h2 className="max-w-[20ch] font-sans text-3xl font-semibold leading-[1.06] tracking-[-0.03em] text-[#10171c] sm:text-4xl lg:text-5xl">
                <RevealLines
                  as="span"
                  text={headline}
                  lift={{
                    progress: endHeaderLift,
                    distance: HEADER_LIFT_DISTANCE,
                    firstLine: 1,
                    totalLines: headerLines
                  }}
                />
              </h2>
            </div>

            <motion.div {...rise(0.16)} className="absolute inset-0">
              {/* Scaled rather than resized: a transform stays on the
                  compositor, where animating width and height would re-lay-out
                  the page every frame. It has no content, so stretching it
                  unevenly to fit the screen's aspect ratio costs nothing. */}
              <motion.div
                aria-hidden="true"
                className="absolute inset-0 bg-black will-change-transform"
                style={{ scaleX: boxScaleX, scaleY: boxScaleY, borderRadius: boxRadius }}
              />
            </motion.div>

            {/* The fly-through, sized to the viewport rather than to the box:
                offset back up by the pin distance and out past the page gutter,
                so it sits exactly where the fully grown box ends up. It holds
                the section label in the top-left corner, in line with the
                navbar row, which stays fixed above everything. */}
            <motion.div
              className="pointer-events-none absolute w-screen"
              style={{
                top: depthTop,
                left: 'calc(50% - 50vw)',
                height: '100vh',
                opacity: depthOpacity,
                visibility: depthVisibility
              }}
            >
              <ExperienceDepth
                className="absolute inset-0"
                experiences={experiences}
                label={label}
                progress={depthProgress}
                seek={seekDepth}
                intro={intro}
              />
            </motion.div>
          </motion.div>
        </div>
        )}
      </div>

      {/* Bento. Six columns so a tile can take two thirds, a third or a half of
          the row, and tall rows so even the smallest footprint stays a big
          surface rather than a card. Skipped entirely when there are no tiles,
          so its top margin doesn't leave a gap below the stage. */}
      {tiles.length > 0 && (
      <div
        ref={bentoRef}
        className="mt-16 grid grid-cols-1 gap-4 sm:mt-20 sm:gap-5 md:grid-cols-2 lg:mt-24 lg:grid-cols-6 lg:gap-6 auto-rows-[minmax(15rem,1fr)] lg:auto-rows-[minmax(17rem,1fr)]"
      >
        {tiles.map((tile, i) => (
          <motion.div
            key={`${tile.organization}-${tile.role}`}
            {...rise(i * TILE_STAGGER, bentoInView, 32)}
            className={TILE_SPAN[tile.size ?? 'standard']}
          >
            <BentoTile tile={tile} index={i} />
          </motion.div>
        ))}
      </div>
      )}
    </section>
  );
}

export default ExperienceSection;
