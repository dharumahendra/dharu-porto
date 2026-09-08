import { useEffect, useRef, useState } from 'react';

interface ThreeDPaperProps {
  variant?: 'original';
  className?: string;
}

/**
 * ThreeDPaper — renders the Nocturne 3D translucent paper certificate.
 *
 * Uses the exact canonical source from ThreeUI (Three.js r149, custom GLSL,
 * CanvasTexture typography). The HTML is embedded via iframe from the public
 * directory to preserve all shaders, interactions, and responsive behavior.
 */
export function ThreeDPaper({ variant = 'original', className = '' }: ThreeDPaperProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      // Small delay to let WebGL initialize
      setTimeout(() => setIsReady(true), 300);
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, []);

  return (
    <div
      className={`three-d-paper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        isolation: 'isolate',
        background: '#08080a',
        borderRadius: 'inherit',
      }}
    >
      <iframe
        ref={iframeRef}
        src="/3d-paper.html"
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
          touchAction: 'none',
        }}
        allow="accelerometer; autoplay"
        loading="lazy"
      />
    </div>
  );
}
