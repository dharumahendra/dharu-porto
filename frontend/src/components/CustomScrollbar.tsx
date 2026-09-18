import { useRef, useState } from 'react';
import { useLenis } from 'lenis/react';

export function CustomScrollbar() {
  const [hasScroll, setHasScroll] = useState(false);
  const hasScrollRef = useRef(false);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  // Sync dengan posisi scroll Lenis yang sudah di-interpolate.
  // Lenis fires this every frame while scrolling, so the thumb is moved by
  // writing its style directly. Driving it through React state re-rendered this
  // component on every frame of every scroll, which showed up as scroll jank.
  // Only the rare show/hide flip goes through state.
  // Last computed geometry, so a thumb that mounts after the scroll that
  // revealed it can still be placed straight away.
  const geometry = useRef({ height: 0, top: 0 });

  const place = (thumb: HTMLDivElement | null) => {
    if (!thumb) return;
    thumb.style.height = `${geometry.current.height}px`;
    // A transform rather than `top`, so moving the thumb never triggers layout.
    thumb.style.transform = `translateY(${geometry.current.top}px)`;
  };

  useLenis(({ scroll, limit }) => {
    const scrollable = limit > 0;
    if (scrollable) {
      const containerHeight = window.innerHeight;
      const totalHeight = limit + containerHeight;
      const ratio = containerHeight / totalHeight;
      const height = Math.max(ratio * containerHeight, 48);
      const maxTop = containerHeight - height;
      const clampedScroll = Math.max(0, Math.min(scroll, limit));
      geometry.current = { height, top: (clampedScroll / limit) * maxTop };
      place(thumbRef.current);
    }
    if (scrollable !== hasScrollRef.current) {
      hasScrollRef.current = scrollable;
      setHasScroll(scrollable);
    }
  });

  if (!hasScroll) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '6px',
        height: '100dvh',
        zIndex: 99999,
        pointerEvents: 'none',
        // Benar-benar tidak ada background — track transparan
      }}
    >
      {/* Scrollbar thumb. Hover widening is plain CSS, so it costs no render. */}
      <div
        ref={el => {
          thumbRef.current = el;
          place(el);
        }}
        className="absolute right-0 top-0 w-1.5 cursor-pointer rounded-full bg-[rgba(16,23,28,0.85)] transition-[width,background-color] duration-200 ease-in-out hover:w-2"
        style={{ pointerEvents: 'auto', willChange: 'transform' }}
      />
    </div>
  );
}
