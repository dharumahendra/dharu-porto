import { useEffect, useId, useRef } from 'react';
import createGlobe from 'cobe';

type RGB = [number, number, number];
type Vec3 = [number, number, number];

const hex = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;

/** cobe's angles that turn [lat, lon] to face the viewer. */
const facing = (lat: number, lon: number) => ({
  phi: Math.PI - ((lon * Math.PI) / 180 - Math.PI / 2),
  theta: (lat * Math.PI) / 180
});

// cobe's own geometry (cobe 2.0.1, from its source): [lat, lon] to a point on
// the unit sphere, and that point turned by phi/theta into view space
// (x right, y up, z toward the viewer). The sphere is drawn at radius 0.8 of
// half the canvas.
const GLOBE_R = 0.8;
const toSphere = ([lat, lon]: [number, number]): Vec3 => {
  const a = (lat * Math.PI) / 180;
  const b = (lon * Math.PI) / 180 - Math.PI;
  return [-Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
};
const toView = ([x, y, z]: Vec3, phi: number, theta: number): Vec3 => {
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  return [cp * x + sp * z, sp * st * x + ct * y - cp * st * z, -sp * ct * x + st * y + cp * ct * z];
};

// Ambient spin, radians per second, and how far a pixel of drag turns it.
const SPIN = 0.12;
const DRAG = 0.005;

// The pin, in the overlay's 0–1000 units (the globe's radius is 400).
const PIN = {
  height: 72, // base to head centre
  head: 15, // head radius
  eye: 5.5, // the hole in the head
  stem: 3,
  ring: 22 // radius of the ring lying on the surface around the base
};

interface CobeGlobeProps {
  /** [lat, lon] marked, and turned to face the viewer on load. */
  location: [number, number];
  /**
   * #rrggbb that cobe's halo and rim light are drawn in, so they don't show:
   * the colour the globe sits on, or black when it is screen-blended.
   */
  backgroundHex: string;
  className?: string;
}

/**
 * CobeGlobe — a flat, dotted WebGL globe (cobe) in the site's blues, with a
 * pin standing on the given location. The pin is placed with cobe's own
 * projection: it stays upright, its ground ring flattens towards the
 * edge, and it sinks behind the horizon as the globe turns it away. The globe
 * turns slowly on its own and can be dragged sideways; with reduced motion it
 * holds still until dragged. Drawing stops while it is off screen.
 */
export function CobeGlobe({ location, backgroundHex, className }: CobeGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pinRef = useRef<SVGGElement>(null);
  const ringRef = useRef<SVGEllipseElement>(null);
  const stemRef = useRef<SVGLineElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const maskId = `globe-occlude-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = facing(...location);
    const theta = start.theta + 0.15;
    const here = toSphere(location);
    let phi = start.phi;
    let dragFrom: { x: number; phi: number } | null = null;
    const box = canvas.parentElement;
    let frame = 0;
    let visible = false;
    let last = 0;

    // cobe v2 takes width/height in CSS px and multiplies by the DPR itself.
    // It also wraps the canvas in a div of its own (100% × 100%), which is why
    // the canvas sits in a sized box of ours rather than being sized itself.
    const sizeOf = () => Math.max(1, Math.round(box?.clientWidth ?? canvas.clientWidth));
    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width: sizeOf(),
      height: sizeOf(),
      phi,
      theta,
      // Matte and flat. In dark mode cobe paints land dots in baseColor and the
      // sea at a tenth of it; a near-zero diffuse drops the 3D shading, and a
      // glow in the card's own colour makes the halo and rim light vanish.
      dark: 1,
      diffuse: 0.001,
      mapSamples: 16000,
      mapBrightness: 1.5,
      baseColor: hex('#A9BCDD'),
      markerColor: hex('#F5FAFF'),
      glowColor: hex(backgroundHex),
      markers: []
    });
    const wrapper = canvas.parentElement;

    const placePin = () => {
      const [nx, ny, nz] = toView(here, phi, theta);
      // Base on the surface, in overlay units (y down).
      const bx = 500 + nx * GLOBE_R * 500;
      const by = 500 - ny * GLOBE_R * 500;

      // Stem: always upright on screen, whatever the surface does under it.
      // The base still rides the surface, and the ring below still lies on it.
      const hx = bx;
      const hy = by - PIN.height;

      // A circle lying on the surface is seen as an ellipse: full width across
      // the normal, squashed by how far the surface faces away along it.
      const angle = (Math.atan2(-ny, nx) * 180) / Math.PI;
      const ring = ringRef.current;
      if (ring) {
        ring.setAttribute('rx', String(Math.max(PIN.ring * Math.abs(nz), 0.5)));
        ring.setAttribute('transform', `translate(${bx} ${by}) rotate(${angle})`);
      }
      stemRef.current?.setAttribute('x1', String(bx));
      stemRef.current?.setAttribute('y1', String(by));
      stemRef.current?.setAttribute('x2', String(hx));
      stemRef.current?.setAttribute('y2', String(hy));
      headRef.current?.setAttribute('transform', `translate(${hx} ${hy})`);

      // Round the back, the globe hides whatever of the pin falls on its
      // disc: it sinks behind the horizon rather than blinking out.
      const pin = pinRef.current;
      if (pin) {
        if (nz < 0) pin.setAttribute('mask', `url(#${maskId})`);
        else pin.removeAttribute('mask');
        // And what still peeks over the edge fades as it goes further round.
        pin.setAttribute('opacity', String(Math.min(1, Math.max(0, 1 + nz * 5))));
      }
    };
    const draw = (state: Parameters<typeof globe.update>[0]) => {
      globe.update(state);
      placePin();
    };
    draw({ width: sizeOf(), height: sizeOf(), phi });

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      if (!dragFrom && !reduceMotion) phi += SPIN * dt;
      draw({ phi });
      frame = requestAnimationFrame(tick);
    };
    const play = () => {
      if (!frame && visible) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const pause = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const resize = new ResizeObserver(() => draw({ width: sizeOf(), height: sizeOf(), phi }));
    if (box) resize.observe(box);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) play();
      else pause();
    });
    seen.observe(canvas);

    const onDown = (e: PointerEvent) => {
      dragFrom = { x: e.clientX, phi };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      if (!dragFrom) return;
      phi = dragFrom.phi + (e.clientX - dragFrom.x) * DRAG;
      // With reduced motion there is no loop running; draw the drag directly.
      if (!frame) draw({ phi });
    };
    const onUp = () => {
      dragFrom = null;
      canvas.style.cursor = 'grab';
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    return () => {
      pause();
      resize.disconnect();
      seen.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      globe.destroy();
      // destroy() leaves cobe's wrapper div behind; put the canvas back where
      // React left it so a remount (StrictMode, HMR) doesn't nest wrappers.
      if (wrapper && wrapper !== box) wrapper.replaceWith(canvas);
    };
  }, [location, backgroundHex, maskId]);

  return (
    <div aria-hidden="true" className={className} style={{ aspectRatio: '1' }}>
      <canvas
        ref={canvasRef}
        className="block size-full"
        // Sideways drags turn the globe; vertical ones still scroll the page.
        style={{ cursor: 'grab', touchAction: 'pan-y' }}
      />
      {/* The pin, drawn over the globe in the same square. Positions are set
          every frame from the globe's rotation. */}
      <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 size-full overflow-visible">
        <defs>
          {/* Everything but the globe's disc. */}
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-500" y="-500" width="2000" height="2000">
            <rect x="-500" y="-500" width="2000" height="2000" fill="#fff" />
            <circle cx="500" cy="500" r={GLOBE_R * 500} fill="#000" />
          </mask>
        </defs>
        <g ref={pinRef}>
          <ellipse ref={ringRef} ry={PIN.ring} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={2} />
          <line ref={stemRef} stroke="#fff" strokeWidth={PIN.stem} strokeLinecap="round" />
          <g ref={headRef}>
            {/* A ring rather than a disc: the hole reads as a pin head and,
                screen-blended, shows the card through it. */}
            <circle r={PIN.head} fill="#fff" />
            <circle r={PIN.eye} fill="#000" />
          </g>
        </g>
      </svg>
    </div>
  );
}
