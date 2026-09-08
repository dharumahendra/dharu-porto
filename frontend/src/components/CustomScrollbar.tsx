import { useEffect, useRef, useState } from 'react';
import { useLenis } from 'lenis/react';

export function CustomScrollbar() {
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [hasScroll, setHasScroll] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync dengan posisi scroll Lenis yang sudah di-interpolate
  useLenis(({ scroll, limit }) => {
    const containerHeight = window.innerHeight;

    if (limit <= 0) {
      setHasScroll(false);
      return;
    }

    setHasScroll(true);

    const totalHeight = limit + containerHeight;
    const ratio = containerHeight / totalHeight;
    const height = Math.max(ratio * containerHeight, 48);
    const maxTop = containerHeight - height;
    const clampedScroll = Math.max(0, Math.min(scroll, limit));
    const top = (clampedScroll / limit) * maxTop;

    setThumbHeight(height);
    setThumbTop(top);
  });

  // Cleanup
  useEffect(() => {
    return () => {};
  }, []);

  if (!hasScroll) return null;

  return (
    <div
      aria-hidden="true"
      ref={containerRef}
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
      {/* Scrollbar thumb */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          width: isHovered ? '8px' : '6px',
          height: thumbHeight,
          top: thumbTop,
          background: 'rgba(16, 23, 28, 0.85)',
          borderRadius: '9999px',   // Ujung melengkung sempurna
          transition: 'width 0.2s ease, background 0.2s ease',
          pointerEvents: 'auto',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
    </div>
  );
}
