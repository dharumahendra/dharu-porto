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

export interface ProjectCardProps {
  title: string;
  /** Tech stack, rendered in order and separated by small round dots. */
  stack: string[];
  src: string;
  alt: string;
  /** When set the whole card becomes a link. */
  href?: string;
  className?: string;
}

/**
 * Project tile: full-bleed background image with the title and stack pinned
 * bottom-left. On hover (or keyboard focus) an arrow slides in ahead of the
 * title while its letters shift right one after another; the stack line stays
 * put.
 */
export function ProjectCard({
  title,
  stack,
  src,
  alt,
  href,
  className
}: ProjectCardProps) {
  const Wrapper = href ? 'a' : 'div';

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
        className="aspect-[16/9] w-full rounded-xl outline-1 -outline-offset-1 outline-black/10"
      >
        {/* Children render inside the component's own relative container,
            stacked above its canvas. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="pointer-events-none absolute inset-0 flex items-end">
          <div className="p-6 text-white sm:p-8 lg:p-10">
            <div className="relative">
              {/* Overlaid rather than in flow, so the title sits flush with the
                  stack line; the letters move aside to make room for it.
                  The outer span is a mask the width of that gap: the arrow
                  waits fully hidden past its left edge, then slides out from
                  behind it — no fade — and slides back the same way. */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 flex w-9 items-center overflow-hidden sm:w-11"
              >
                <span className="flex -translate-x-full transition-transform duration-300 ease-out group-hover:translate-x-0 group-focus-visible:translate-x-0">
                  <ArrowRight className="size-6 shrink-0 sm:size-8" strokeWidth={2.25} />
                </span>
              </span>
              <h3
                aria-label={title}
                className="font-sans text-xl font-semibold tracking-tight sm:text-2xl lg:text-4xl"
              >
                {/* Each letter shifts by the arrow's width on its own delay.
                    The letter at the front of the motion leads: the last one
                    on the way in, the first one on the way out.
                    whitespace-pre keeps spaces from collapsing inside
                    inline-block. */}
                {Array.from(title).map((char, i, chars) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    style={
                      {
                        '--delay-in': `${(chars.length - 1 - i) * LETTER_STAGGER_MS}ms`,
                        '--delay-out': `${i * LETTER_STAGGER_MS}ms`
                      } as CSSProperties
                    }
                    className="inline-block whitespace-pre transition-transform duration-300 ease-out [transition-delay:var(--delay-out)] group-hover:translate-x-9 group-hover:[transition-delay:var(--delay-in)] group-focus-visible:translate-x-9 group-focus-visible:[transition-delay:var(--delay-in)] sm:group-hover:translate-x-11 sm:group-focus-visible:translate-x-11"
                  >
                    {char}
                  </span>
                ))}
              </h3>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2.5 font-sans text-sm text-white/90 sm:gap-x-1.5 sm:text-lg lg:text-base">
              {stack.map((item, i) => (
                <Fragment key={item}>
                  {i > 0 && (
                    <span
                      aria-hidden="true"
                      className="size-1 shrink-0 rounded-full bg-current sm:size-1.2 translate-y-px"
                    />
                  )}
                  <span>{item}</span>
                </Fragment>
              ))}
            </p>
          </div>
        </div>
      </ChromaticImage>
      </TiltedCard>
    </Wrapper>
  );
}
