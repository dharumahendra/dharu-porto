import { motion } from 'framer-motion';
import { ArrowUpRight, ImagePlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Experience, ExperiencePhoto } from '../data/experiences';

/** A box in the fly-through's own coordinates (its top-left corner is 0,0). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Shown when an experience has no photos yet: four empty slots.
const PLACEHOLDER_SLOTS = 4;
// One soft curve for the whole morph: eases out of rest instead of jumping,
// and settles gently.
const EASE = [0.32, 0.72, 0, 1] as const;
const OPEN_DURATION = 0.75;
const CLOSE_DURATION = 0.6;
// Matches .mission-card's --card-radius.
const CARD_RADIUS = 24;
const PANEL_RADIUS = 32;
const PAPER = 'rgba(245, 250, 255, 1)';
const PAPER_CLEAR = 'rgba(245, 250, 255, 0)';

const pad = (i: number) => String(i).padStart(2, '0');

// Kept clear of the fixed navbar row (pt-8 + h-14, plus a little air) above,
// and of the screen's bottom edge below.
const NAV_CLEARANCE = 112;
const BOTTOM_GAP = 32;

/** Where the opened panel sits: below the navbar, centred in what is left. */
function panelBox(W: number, H: number): Box {
  const wide = W >= 768;
  const room = H - NAV_CLEARANCE - BOTTOM_GAP;
  const w = wide ? Math.min(920, W * 0.78) : W - 32;
  const h = wide ? Math.min(540, room) : room;
  return { x: (W - w) / 2, y: NAV_CLEARANCE + (room - h) / 2, w, h };
}

const toStyle = (b: Box, radius: number) => ({
  left: b.x,
  top: b.y,
  width: b.w,
  height: b.h,
  borderRadius: radius
});

interface ExperienceDetailProps {
  experience: Experience;
  index: number;
  /** How many experiences there are, for the card's "01 / 06". */
  total: number;
  /** The card's box on screen, which the panel grows out of and back into. */
  from: Box;
  /** The card's laid-out width (it is drawn smaller, through the perspective). */
  cardWidth: number;
  /** The fly-through's size. */
  bounds: { w: number; h: number };
  onClose: () => void;
}

/**
 * ExperienceDetail — an experience card opened up: the card grows into a large
 * paper panel with a photo gallery and the full description, then shrinks back
 * into the card on close. Rendered inside ExperienceDepth, over the
 * fly-through, by an AnimatePresence there.
 *
 * The panel carries an exact copy of the card's face. Opening, the copy scales
 * up and glides onto the panel's text column, where it crossfades into the
 * panel's own text; closing, the reverse, so the panel lands back on the card
 * already looking like it and the hand-over to the real card is invisible.
 * Every layer is laid out at its final size and only moved, scaled or clipped
 * by the growing box, so nothing reflows mid-animation.
 */
export function ExperienceDetail({
  experience: exp,
  index,
  total,
  from,
  cardWidth,
  bounds,
  onClose
}: ExperienceDetailProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const to = panelBox(bounds.w, bounds.h);
  const cardScale = from.w / Math.max(cardWidth, 1);
  const cardRadius = CARD_RADIUS * cardScale;
  // Where the card's copy travels to: onto the panel's text column (the right
  // column when wide, under the photos when narrow), scaled to its width, so
  // the card's header and title land on the panel's own.
  const wide = bounds.w >= 768;
  const column = wide
    ? { x: to.w * (1.05 / 2.05), y: 0, w: to.w * (1 / 2.05) }
    : { x: 0, y: to.h * 0.42, w: to.w };
  const columnScale = column.w / Math.max(cardWidth, 1);
  const photos = exp.photos?.length ? exp.photos : null;
  const slots = photos ? photos.length : PLACEHOLDER_SLOTS;
  const [selected, setSelected] = useState(0);
  const paragraphs = (exp.description ?? exp.summary).split(/\n\s*\n/);
  const titleId = `experience-detail-${index}`;

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // pointer-events-auto: the fly-through's wrapper turns them off.
    <div className="pointer-events-auto absolute inset-0 z-20">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-[#07090c]/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: OPEN_DURATION, ease: EASE } }}
        exit={{ opacity: 0, transition: { duration: CLOSE_DURATION, ease: EASE } }}
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // The card's paper, opened out: solid and matte, like the navbar. The
        // paper itself fades in only as the box starts to grow (and out as it
        // lands back), so the card copy's ticket notches stay cut out at rest.
        className="absolute overflow-hidden text-[#10171c]"
        initial={{ ...toStyle(from, cardRadius), backgroundColor: PAPER_CLEAR }}
        animate={{
          ...toStyle(to, PANEL_RADIUS),
          backgroundColor: PAPER,
          transition: {
            default: { duration: OPEN_DURATION, ease: EASE },
            backgroundColor: { duration: OPEN_DURATION * 0.25, ease: 'linear' }
          }
        }}
        exit={{
          ...toStyle(from, cardRadius),
          backgroundColor: PAPER_CLEAR,
          transition: {
            default: { duration: CLOSE_DURATION, ease: EASE },
            backgroundColor: { duration: CLOSE_DURATION * 0.2, delay: CLOSE_DURATION * 0.8, ease: 'linear' }
          }
        }}
      >
        {/* The card's face. Starts exactly on the card, then scales up and
            glides right onto the text column, on the box's own clock and
            curve (so it keeps inside the growing box all the way), and only
            hands over to the panel's text once it has nearly arrived. */}
        <motion.div
          aria-hidden="true"
          className="mission-card group is-active pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{ width: cardWidth }}
          initial={{ x: 0, y: 0, scale: cardScale, opacity: 1 }}
          animate={{
            x: column.x,
            y: column.y,
            scale: columnScale,
            opacity: 0,
            transition: {
              default: { duration: OPEN_DURATION, ease: EASE },
              // Fades out early in the glide, so the move reads as the card
              // dissolving rather than text sliding about.
              opacity: { duration: OPEN_DURATION * 0.35, ease: 'easeOut' }
            }
          }}
          exit={{
            x: 0,
            y: 0,
            scale: cardScale,
            opacity: 1,
            transition: {
              default: { duration: CLOSE_DURATION, ease: EASE },
              // Back in only over the last stretch, as it settles on the card.
              opacity: { duration: CLOSE_DURATION * 0.4, delay: CLOSE_DURATION * 0.6, ease: 'easeIn' }
            }
          }}
        >
          <CardFace experience={exp} index={index} total={total} />
        </motion.div>

        <div
          className="absolute left-0 top-0 grid grid-rows-[minmax(0,42%)_minmax(0,1fr)] md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:grid-rows-1"
          style={{ width: to.w, height: to.h }}
        >
          {/* Gallery: one large photo, the full set as thumbnails below. The
              perforation along its edge carries the ticket over from the card.
              Fades in on its own as the panel opens up beside the card. */}
          <motion.div
            className="relative flex min-h-0 flex-col gap-3 p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: OPEN_DURATION * 0.5, delay: OPEN_DURATION * 0.3, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: CLOSE_DURATION * 0.3, ease: 'easeIn' } }}
          >
            <span
              aria-hidden="true"
              className="absolute bottom-6 right-0 top-6 hidden border-r-2 border-dashed border-[#cfd8de] md:block"
            />
            <PhotoSlot photo={photos?.[selected]} number={selected + 1} large className="min-h-0 flex-1" />
            {slots > 1 && (
              <div className="grid shrink-0 gap-3" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
                {Array.from({ length: slots }, (_, j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setSelected(j)}
                    aria-label={photos ? `Show photo: ${photos[j].alt}` : `Photo ${j + 1}`}
                    aria-pressed={j === selected}
                    className={`aspect-[4/3] max-h-20 overflow-hidden rounded-xl outline-none transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-[#10171c] ${
                      j === selected ? 'ring-2 ring-[#10171c]' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <PhotoSlot photo={photos?.[j]} number={j + 1} className="h-full w-full" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* The story. Scrolls on its own; Lenis keeps its hands off it.
              Never on screen together with the card's copy: one fades out,
              then the other fades in. */}
          <motion.div
            data-lenis-prevent
            className="min-h-0 overflow-y-auto overscroll-contain p-[clamp(20px,3vw,40px)] md:pl-[clamp(20px,2.5vw,32px)]"
            initial={{ opacity: 0 }}
            // Appears once the card's copy has gone and the panel has nearly
            // settled; leaves first on close.
            animate={{ opacity: 1, transition: { duration: OPEN_DURATION * 0.4, delay: OPEN_DURATION * 0.6, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: CLOSE_DURATION * 0.3, ease: 'easeIn' } }}
          >
            <div className="pr-14">
              <MissionMeta index={index} period={exp.period} />
            </div>
            <h3
              id={titleId}
              className="mt-4 font-sans text-[clamp(1.75rem,3.4vw,2.6rem)] font-semibold leading-[1.04] tracking-[-0.03em]"
            >
              {exp.role}
            </h3>
            <p className="mt-1 font-sans font-medium text-[#3a4048]">{exp.org}</p>

            <div className="mt-6 space-y-4 font-sans leading-relaxed text-[#3a4048]">
              {paragraphs.map(p => (
                <p key={p}>{p}</p>
              ))}
            </div>

            <p className="mt-8 font-sans text-xs font-semibold uppercase tracking-[0.16em] text-[#9aa6ad]">Highlights</p>
            <ul className="mt-3 grid gap-2.5">
              {exp.points.map(point => (
                <li key={point} className="relative pl-5 font-sans text-[0.95rem] leading-snug">
                  <span aria-hidden="true" className="absolute left-0 top-[0.65em] h-0.5 w-2 bg-[#10171c]" />
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-[#dfe6ea] text-[#10171c] outline-none transition-colors duration-300 hover:bg-[#d3dbe0] focus-visible:ring-2 focus-visible:ring-[#10171c]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: OPEN_DURATION * 0.5, delay: OPEN_DURATION * 0.4, ease: 'easeOut' } }}
          exit={{ opacity: 0, scale: 0.8, transition: { duration: CLOSE_DURATION * 0.3, ease: 'easeIn' } }}
        >
          <X className="size-4" strokeWidth={2} />
        </motion.button>
      </motion.div>
    </div>
  );
}


/**
 * The ticket's header line, shared by the card and its opened panel: the
 * mission number in small caps, the period in the navbar's grey pill.
 */
export function MissionMeta({ index, period }: { index: number; period: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-[#9aa6ad] tabular-nums">
        Mission {pad(index + 1)}
      </span>
      <span className="rounded-full bg-[#dfe6ea] px-3 py-1 font-sans text-xs font-semibold tabular-nums text-[#10171c]">
        {period}
      </span>
    </div>
  );
}

/**
 * What's on a mission card: the body, then the stub torn off along the
 * perforation. Rendered by the card in the fly-through and, as a copy, by the
 * opened panel, so the two are always identical. The parent carries the
 * `mission-card` class (and `group`, for the points' reveal on .is-active).
 */
export function CardFace({ experience: exp, index, total }: { experience: Experience; index: number; total: number }) {
  return (
    <>
      <div className="mission-card__body p-[clamp(20px,3vw,32px)] pb-6">
        <MissionMeta index={index} period={exp.period} />
        <h3 className="mt-4 font-sans text-[clamp(1.5rem,3.2vw,2.1rem)] font-semibold leading-[1.06] tracking-[-0.03em]">
          {exp.role}
        </h3>
        <p className="mt-1 font-sans font-medium text-[#3a4048]">{exp.org}</p>
        <p className="mt-4 font-sans leading-relaxed text-[#3a4048]">{exp.summary}</p>
        <ul className="mt-4 grid gap-2">
          {exp.points.map((point, j) => (
            <li
              key={point}
              className="relative translate-y-2.5 pl-5 font-sans text-[0.95rem] leading-snug text-[#10171c] opacity-0 transition-[opacity,transform] duration-[450ms] ease-out group-[.is-active]:translate-y-0 group-[.is-active]:opacity-100"
              style={{ transitionDelay: `${j * 80}ms` }}
            >
              <span aria-hidden="true" className="absolute left-0 top-[0.65em] h-0.5 w-2 bg-[#10171c]" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      {/* The stub: the navbar's pill with its white circle, as the way in to
          the full log. */}
      <div className="mission-card__stub flex items-center justify-between gap-4 py-3 pl-[clamp(20px,3vw,32px)] pr-3">
        <span className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-[#9aa6ad] tabular-nums">
          {pad(index + 1)} / {pad(total)}
        </span>
        <span className="mission-card__pill flex items-center gap-4 rounded-full bg-[#dfe6ea] py-1 pl-5 pr-1 font-sans text-xs font-semibold uppercase tracking-wide">
          Open log
          <span className="grid size-9 place-items-center rounded-full bg-white">
            <ArrowUpRight className="mission-card__arrow size-4" strokeWidth={2} />
          </span>
        </span>
      </div>
    </>
  );
}

/** A photo, or an empty slot standing in for one. */
function PhotoSlot({
  photo,
  number,
  large = false,
  className = ''
}: {
  photo?: ExperiencePhoto;
  number: number;
  large?: boolean;
  className?: string;
}) {
  if (photo) {
    return (
      <img
        src={photo.src}
        alt={photo.alt}
        className={`rounded-[20px] object-cover ${className}`}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <div
      className={`relative grid place-items-center overflow-hidden border border-dashed border-[#c3ced5] bg-[#e7edf0] text-[#9aa6ad] ${
        large ? 'rounded-[20px]' : 'rounded-xl'
      } ${className}`}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <ImagePlus className={large ? 'size-8' : 'size-4'} strokeWidth={1.5} />
        {large && (
          <>
            <span className="font-sans text-sm font-semibold text-[#3a4048]">Photo {pad(number)}</span>
            <span className="font-sans text-xs">Add photos in data/experiences.ts</span>
          </>
        )}
      </div>
    </div>
  );
}