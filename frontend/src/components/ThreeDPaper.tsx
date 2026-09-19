import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getScrollRoot } from '@/lib/scroll-root';

interface ThreeDPaperProps {
  variant?: 'original';
  className?: string;
  title?: string;
  date?: string;
  studio?: string;
  author1?: string;
  author2?: string;
  author3?: string;
  bgText?: string;
}

/**
 * ThreeDPaper — renders the Nocturne 3D translucent paper certificate.
 *
 * Uses the exact canonical source from ThreeUI (Three.js r149, custom GLSL,
 * CanvasTexture typography). The HTML is embedded via iframe from the public
 * directory to preserve all shaders, interactions, and responsive behavior.
 *
 * That document is ~632 KB with Three.js inlined, so each instance is its own JS
 * realm and WebGL context. Two things keep that affordable:
 *
 *  - it mounts once the browser is idle and the card is within half a screen of the
 *    viewport, so the scene is booted and warm before the visitor scrolls to
 *    it, without competing with page load;
 *  - it then stays mounted, and we post its viewport visibility across so the
 *    document can park its render loop while off-screen (see the
 *    `paper:visibility` listener in 3d-paper.html).
 *
 * Unmounting it off-screen would be cheaper still, but it would also mean
 * re-booting Three.js at the exact moment the card scrolls into view, which is
 * precisely where a stall is most visible.
 */
export function ThreeDPaper({
  className = '',
  title,
  date,
  studio,
  author1,
  author2,
  author3,
  bgText
}: ThreeDPaperProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [shouldMount, setShouldMount] = useState(false);

  // Stable URL, derived only from the content that actually varies. The old
  // `_t: Date.now()` cache-buster gave every card a unique URL, so the 632 KB
  // document was fetched once per instance instead of served from cache, and
  // any re-render minted a new src which reloaded the iframe from scratch.
  const src = useMemo(() => {
    const params = new URLSearchParams({
      title: title || "Dharu's Portfolio.",
      date: date || 'Feb 14, 2026',
      studio: studio || 'Nocturne Studio.',
      author1: author1 || 'By Nocturne Studio',
      author2: author2 || 'Ilya Marchetti',
      author3: author3 || 'Dara Okonkwo',
      bgText: bgText || 'NOCTURNE'
    });
    return `/3d-paper.html?${params.toString()}`;
  }, [title, date, studio, author1, author2, author3, bgText]);

  // Boot once the browser is idle AND the card is within half a screen of the
  // viewport. Idle alone booted it during page load wherever the card sat, and
  // that ~2 s of Three.js start-up was the second-largest stall on refresh. A
  // full screen of lead still caught it on load on phones, where the card sits
  // closer to the top; half a screen is still ahead of it scrolling in. The
  // timeout is the backstop for browsers without requestIdleCallback, and for
  // a page that never goes idle.
  const [isIdle, setIsIdle] = useState(false);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    });
    if (typeof ric.requestIdleCallback === 'function') {
      const id = ric.requestIdleCallback(() => setIsIdle(true), { timeout: 2000 });
      return () => ric.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setIsIdle(true), 800);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || isNear) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setIsNear(true);
          io.disconnect();
        }
      },
      { root: getScrollRoot(host), rootMargin: '50% 0px' }
    );
    io.observe(host);
    return () => io.disconnect();
  }, [isNear]);

  useEffect(() => {
    if (isIdle && isNear) setShouldMount(true);
  }, [isIdle, isNear]);

  // Tracked in a ref as well as pushed across, so the state can be replayed once
  // the iframe finishes loading — visibility usually settles before that.
  const isVisibleRef = useRef(false);
  const postVisibility = useCallback((visible: boolean) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    // '*' because the sandboxed document's origin is opaque ("null"), which no
    // targetOrigin can name. The message carries nothing but a boolean.
    win.postMessage({ type: 'paper:visibility', visible }, '*');
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const io = new IntersectionObserver(
      entries => {
        const visible = entries[0].isIntersecting;
        isVisibleRef.current = visible;
        postVisibility(visible);
      },
      { rootMargin: '120px' }
    );
    io.observe(host);
    return () => io.disconnect();
  }, [postVisibility]);

  // The iframe swallows wheel events, so it forwards them here and we re-emit
  // them on the host element; they bubble up to the Lenis wrapper and scroll
  // the page exactly as if the cursor were not over the card.
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      // The sandboxed frame reports origin "null", so the source window is
      // what identifies it.
      if (!iframeRef.current || ev.source !== iframeRef.current.contentWindow) return;
      const d = ev.data;
      if (!d || d.type !== 'paper:wheel') return;
      hostRef.current?.dispatchEvent(
        new WheelEvent('wheel', {
          deltaX: d.deltaX,
          deltaY: d.deltaY,
          deltaMode: d.deltaMode,
          bubbles: true,
          cancelable: true
        })
      );
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!shouldMount) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    let timer: number | undefined;
    const handleLoad = () => {
      // The listener only exists once the document has run, so the current
      // visibility has to be replayed here.
      postVisibility(isVisibleRef.current);
      // Small delay to let WebGL initialize
      timer = window.setTimeout(() => setIsReady(true), 300);
    };
    iframe.addEventListener('load', handleLoad);
    return () => {
      iframe.removeEventListener('load', handleLoad);
      if (timer) window.clearTimeout(timer);
    };
  }, [shouldMount, postVisibility]);

  return (
    <div
      ref={hostRef}
      className={`three-d-paper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        isolation: 'isolate',
        background: '#08080a',
        borderRadius: 'inherit'
      }}
    >
      {shouldMount && (
        <iframe
          ref={iframeRef}
          src={src}
          title="3D Paper – Nocturne"
          // @ts-ignore — allowTransparency is a valid HTML attribute
          allowTransparency={true}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            width: '100%',
            height: '100%',
            border: 0,
            background: '#08080a',
            opacity: isReady ? 1 : 0,
            transition: 'opacity 0.5s ease-out',
            touchAction: 'none'
          }}
          allow="accelerometer; autoplay"
          // Sandboxed without allow-same-origin, so the document gets an opaque
          // origin and Chrome runs it in its own process. Same-origin, it shared
          // this page's main thread: parsing the inlined Three.js blocked it for
          // ~0.5–1 s, and since the card sits right under the hero that landed
          // on the visitor's first scroll after every refresh.
          sandbox="allow-scripts"
          loading="lazy"
        />
      )}
    </div>
  );
}
