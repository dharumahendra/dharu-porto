import { useEffect, useRef, useState } from 'react';
import { useLenis } from 'lenis/react';
import { getScrollbarOverride, subscribeScrollbarOverride } from '@/lib/scrollbar-override';

// A change bigger than this (px of thumb travel) in one update is a jump —
// an invisible scroll jump, or a section taking the thumb over or handing it
// back — and is eased out rather than drawn in one frame. Anything smaller is
// ordinary scrolling, already smoothed by Lenis, and is drawn as is so the
// thumb never lags the page.
const JUMP_PX = 24;
// Time constant (s) of that easing: most of the way there in ~0.3 s.
const EASE_TAU = 0.1;

export function CustomScrollbar() {
  const [hasScroll, setHasScroll] = useState(false);
  const hasScrollRef = useRef(false);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  // Sync dengan posisi scroll Lenis yang sudah di-interpolate.
  // Lenis fires this every frame while scrolling, so the thumb is moved by
  // writing its style directly. Driving it through React state re-rendered this
  // component on every frame of every scroll, which showed up as scroll jank.
  // Only the rare show/hide flip goes through state.
  // `top` is where the thumb is drawn, `target` where it is heading; they only
  // differ while a jump is being eased out. Kept so a thumb that mounts after
  // the scroll that revealed it can still be placed straight away.
  const geometry = useRef({ height: 0, top: 0, target: 0 });
  const frame = useRef(0);
  // Where a thumb drag started; null when not dragging.
  const drag = useRef<{ startY: number; startScroll: number; last: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const place = (thumb: HTMLDivElement | null) => {
    if (!thumb) return;
    thumb.style.height = `${geometry.current.height}px`;
    // A transform rather than `top`, so moving the thumb never triggers layout.
    thumb.style.transform = `translateY(${geometry.current.top}px)`;
  };

  const ease = () => {
    let last = performance.now();
    const tick = (now: number) => {
      const g = geometry.current;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      g.top += (g.target - g.top) * (1 - Math.exp(-dt / EASE_TAU));
      if (Math.abs(g.target - g.top) < 0.5) {
        g.top = g.target;
        frame.current = 0;
      } else {
        frame.current = requestAnimationFrame(tick);
      }
      place(thumbRef.current);
    };
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  };

  const update = (scroll: number, limit: number) => {
    const scrollable = limit > 0;
    if (scrollable) {
      const containerHeight = window.innerHeight;
      const totalHeight = limit + containerHeight;
      const ratio = containerHeight / totalHeight;
      const height = Math.max(ratio * containerHeight, 48);
      const maxTop = containerHeight - height;

      const override = getScrollbarOverride();
      let position = scroll;
      if (override) {
        const { start, end } = override.range();
        position = start + (end - start) * override.fraction.get();
      }
      const clamped = Math.max(0, Math.min(position, limit));
      const target = (clamped / limit) * maxTop;

      const g = geometry.current;
      g.height = height;
      g.target = target;
      if (drag.current) {
        // Under the pointer the thumb must track the hand exactly, not ease.
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        g.top = target;
      } else if (frame.current || Math.abs(target - g.top) > JUMP_PX) {
        // Mid-ease, or a jump: let the easing carry it to the new target.
        ease();
      } else {
        g.top = target;
      }
      place(thumbRef.current);
    }
    if (scrollable !== hasScrollRef.current) {
      hasScrollRef.current = scrollable;
      setHasScroll(scrollable);
    }
  };

  const lenis = useLenis(({ scroll, limit }) => update(scroll, limit));

  // While a section drives the thumb the page usually isn't scrolling, so
  // Lenis stays quiet; the thumb follows the override's own changes instead.
  useEffect(() => {
    if (!lenis) return;
    let unsubscribeFraction: (() => void) | undefined;
    const refresh = () => update(lenis.scroll, lenis.limit);
    const watch = () => {
      unsubscribeFraction?.();
      unsubscribeFraction = getScrollbarOverride()?.fraction.on('change', refresh);
      refresh();
    };
    watch();
    const unsubscribe = subscribeScrollbarOverride(watch);
    return () => {
      unsubscribe();
      unsubscribeFraction?.();
    };
    // `update` only touches refs, so a stale copy behaves the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenis]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Scroll px per px of thumb travel, from the current geometry.
  const scrollPerPx = () => {
    if (!lenis) return 0;
    const maxTop = window.innerHeight - geometry.current.height;
    return maxTop > 0 ? lenis.limit / maxTop : 0;
  };

  // Where the thumb says the page is: the real scroll, or, while a section has
  // taken the thumb over, the point along its range that the thumb shows.
  const shownPosition = () => {
    if (!lenis) return 0;
    const override = getScrollbarOverride();
    if (!override) return lenis.scroll;
    const { start, end } = override.range();
    return start + (end - start) * override.fraction.get();
  };

  // Sends the dragged-to position on: to the section holding the thumb, if
  // any, else to the scroll. Not forced: while a section holds the page for
  // an animation (Lenis stopped, no override) the drag waits it out rather
  // than tearing the page out of its hold.
  const dragTo = (position: number) => {
    if (!lenis) return;
    const override = getScrollbarOverride();
    if (override?.seek) {
      const { start, end } = override.range();
      override.seek(end > start ? (position - start) / (end - start) : 0);
    } else {
      lenis.scrollTo(position, { immediate: true });
    }
  };

  const onThumbDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lenis || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startScroll: shownPosition(), last: shownPosition() };
    setDragging(true);
  };

  const onThumbMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !lenis) return;
    d.last = d.startScroll + (e.clientY - d.startY) * scrollPerPx();
    dragTo(d.last);
  };

  const onThumbUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    // Once more on release, in case the section was mid-animation and passed
    // on the last move.
    dragTo(drag.current.last);
    drag.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Pressing the track, off the thumb: glide so the thumb centres there.
  const onTrackDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lenis || e.button !== 0) return;
    e.preventDefault();
    const position = (e.clientY - geometry.current.height / 2) * scrollPerPx();
    if (getScrollbarOverride()?.seek) dragTo(position);
    else lenis.scrollTo(position, { duration: 0.8 });
  };

  if (!hasScroll) return null;

  return (
    <div
      aria-hidden="true"
      onPointerDown={onTrackDown}
      className="group/scrollbar"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        // Wider than the thumb so it is easy to grab; the track stays transparent.
        width: '14px',
        height: '100dvh',
        zIndex: 99999,
        touchAction: 'none'
      }}
    >
      {/* Scrollbar thumb. Hover widening is plain CSS, so it costs no render. */}
      <div
        ref={el => {
          thumbRef.current = el;
          place(el);
        }}
        onPointerDown={onThumbDown}
        onPointerMove={onThumbMove}
        onPointerUp={onThumbUp}
        onPointerCancel={onThumbUp}
        className={`absolute right-0.5 top-0 rounded-full transition-[width,background-color] duration-200 ease-in-out group-hover/scrollbar:w-2 ${
          dragging
            ? 'w-2 cursor-grabbing bg-[#10171c]'
            : 'w-1.5 cursor-grab bg-[rgba(16,23,28,0.85)]'
        }`}
        style={{ willChange: 'transform' }}
      />
    </div>
  );
}
