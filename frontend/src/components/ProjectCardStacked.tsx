import { Fragment, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import TiltedCard from '@/components/TiltedCard/TiltedCard';
import { ChromaticImage } from '@/components/ui/chromatic-image';
import { cn } from '@/lib/utils';

// Gap between neighbouring title letters as they shift on hover.
const LETTER_STAGGER_MS = 8;

// Tilt settings. Both are well under the component's defaults (14° and 1.1):
// those are tuned for a single showpiece, and at this width they would swing
// the card into its neighbours across the grid gap.
const TILT_DEGREES = 8;
const TILT_SCALE = 1.03;

export interface ProjectCardStackedProps {
  title: string;
  /** Tags rendered in order and separated by small round dots, e.g. CONCEPT • WEB • DESIGN. */
  stack: string[];
  src: string;
  alt: string;
  /** When set the whole card becomes a link. */
  href?: string;
  className?: string;
}

/**
 * Project tile, stacked layout: the image stands alone in its own rounded
 * frame, with the tag line and title sitting below it in flow (not overlaid),
 * dark text on the page background rather than white text on the photo.
 */
export function ProjectCardStacked({
  title,
  stack,
  src,
  alt,
  href,
  className
}: ProjectCardStackedProps) {
  const Wrapper = href ? 'a' : 'div';
  const chars = Array.from(title);
  // The first letter — the one directly under the arrow's path — is the
  // last to start its hover-in shift (see the delay-in formula below). The
  // arrow starts at that exact moment too, so the two move out together
  // instead of the arrow sliding in over a letter that hasn't budged yet.
  const arrowDelayInMs = (chars.length - 1) * LETTER_STAGGER_MS;

  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={cn(
        'group block cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#10171c] focus-visible:ring-offset-4 focus-visible:ring-offset-[#F5FAFF]',
        className
      )}
    >
      {/* The sizes are all `auto` / `100%` on purpose: the card keeps the size
          it already had, which comes from the aspect ratio on the image below.
          Passing the component's own pixel dimensions would resize the card.
          The tooltip and the mobile notice are the demo's furniture, not ours. */}
      <TiltedCard
        containerWidth="100%"
        containerHeight="auto"
        imageWidth="100%"
        imageHeight="auto"
        rotateAmplitude={TILT_DEGREES}
        scaleOnHover={TILT_SCALE}
        showTooltip={false}
        showMobileWarning={false}
      >
        <ChromaticImage
          src={src}
          alt={alt}
          // The warp fires only as the pointer crosses the card's edge. Inside,
          // the surface belongs to the tilt alone — two effects chasing the same
          // pointer at once read as noise.
          pointerMode="cross"
          className="aspect-[16/9] w-full rounded-2xl outline-1 -outline-offset-1 outline-black/10"
        />
      </TiltedCard>

      {/* Copy sits below the frame, in flow, rather than overlaid on the
          image — dark text on the page background instead of white on photo. */}
      <div className="pt-1 sm:pt-3">
        <p className="flex flex-wrap items-center gap-x-2 font-sans text-xs font-medium uppercase tracking-[0.08em] text-black sm:text-sm">
          {stack.map((item, i) => (
            <Fragment key={item}>
              {i > 0 && (
                <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-current" />
              )}
              <span>{item}</span>
            </Fragment>
          ))}
        </p>
        <div className="relative mt-1.5">
          {/* Overlaid rather than in flow, so the title sits flush with the
              stack line; the letters move aside to make room for it.
              The outer span is a mask the width of that gap: the arrow
              waits fully hidden past its left edge, then slides out from
              behind it — no fade — and slides back the same way. */}
          <span
            aria-hidden="true"
            style={{ '--arrow-delay-in': `${arrowDelayInMs}ms` } as CSSProperties}
            className="absolute inset-y-0 left-0 flex w-7 items-center overflow-hidden sm:w-9 lg:w-11"
          >
            {/* No delay going back to hidden (base state): the arrow and the
                first letter both start returning immediately, in step, same
                as the entrance. */}
            <span className="flex -translate-x-full transition-transform duration-300 ease-out [transition-delay:0ms] group-hover:translate-x-0 group-hover:[transition-delay:var(--arrow-delay-in)] group-focus-visible:translate-x-0 group-focus-visible:[transition-delay:var(--arrow-delay-in)]">
              <ArrowRight className="size-6 shrink-0 text-[#10171c] sm:size-8" strokeWidth={2.25} />
            </span>
          </span>
          <h3
            aria-label={title}
            // Aeonik only ships static 300/400/500/700 cuts, so a font-weight
            // between Regular and Medium would just resolve to Medium. A thin
            // text-stroke on top of Regular fakes the extra weight instead.
            style={{ WebkitTextStroke: '0.4px currentColor' }}
            className="font-sans text-3xl font-normal tracking-tight text-[#10171c] sm:text-4xl lg:text-5xl"
          >
            {/* Each letter shifts by the arrow's width on its own delay.
                The letter at the front of the motion leads: the last one
                on the way in, the first one on the way out.
                whitespace-pre keeps spaces from collapsing inside
                inline-block. */}
            {chars.map((char, i) => (
              <span
                key={i}
                aria-hidden="true"
                style={
                  {
                    '--delay-in': `${(chars.length - 1 - i) * LETTER_STAGGER_MS}ms`,
                    '--delay-out': `${i * LETTER_STAGGER_MS}ms`
                  } as CSSProperties
                }
                className="inline-block whitespace-pre transition-transform duration-300 ease-out [transition-delay:var(--delay-out)] group-hover:translate-x-7 group-hover:[transition-delay:var(--delay-in)] group-focus-visible:translate-x-7 group-focus-visible:[transition-delay:var(--delay-in)] sm:group-hover:translate-x-9 sm:group-focus-visible:translate-x-9 lg:group-hover:translate-x-11 lg:group-focus-visible:translate-x-11"
              >
                {char}
              </span>
            ))}
          </h3>
        </div>
      </div>
    </Wrapper>
  );
}
