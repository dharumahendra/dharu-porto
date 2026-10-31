import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { AnimatePresence, type MotionValue } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Experience } from '../data/experiences';
import { CardFace, ExperienceDetail, type Box } from './ExperienceDetail';

// The space is monochrome, in the site's own palette: ink for the void, a
// pale ice blue for the nebulae, the trail and the ship's glow. No per-card
// colour — the cards' `accent` no longer tints anything here.
const SPACE_INK = '#07090c';
const SPACE_TINT = '#a9c2d4';
import type { SpaceScene } from './experience-space';
import { isInitialLoad, trackLoad } from '../lib/preload';

/*
 * Z-depth fly-through, ported from the z-depth-experience skill's reference
 * demo. Cards float in 3D space; the "camera" is the inverse transform of the
 * scene.
 *
 * Unlike the demo, the camera is not scrubbed by scroll. The host holds the
 * page still while the scene is up and hands in a card index (`step`); each
 * change flies the camera to that card on its own clock, in one eased move.
 * Scrubbing plus a debounced snap fought the smooth scroller's momentum and
 * read as stutter, and it made the visitor scroll through every gap.
 */

const CONFIG = {
  layout: 'spread' as 'spread' | 'winding' | 'zigzag' | 'scatter',
  step: 900,
  amplitude: 380,
  verticalAmp: 210,
  turnDeg: 10,
  perspective: 1000,
  tilt: 1,
  ghosts: 20,
  ghostClearance: 560,
  fogStart: 3400,
  fogRange: 4200,
  fogMin: 0.22,
  stopDistance: 220,
  // Must stay below stopDistance - 20, or a card starts fading while it is read.
  approachDrift: 70,
  introDistance: 1800
};

/** Seconds for the camera to fly from one card to the next. */
export const STEP_DURATION = 1.25;
// Jumping several cards at once (the dots) takes a little longer per extra
// card, so the flight doesn't turn into a blur.
export const STEP_EXTRA_PER_CARD = 0.3;

interface Pose {
  x: number;
  y: number;
  z: number;
  ry: number;
}

interface Placed extends Pose {
  tx: number;
  ty: number;
  tz: number;
}

const DEG = Math.PI / 180;
// Seeded, so the layout is identical on every reload.
const rand = (i: number) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
// Camera pose that looks straight at a card from `d` px in front of it.
const poseFor = (c: Pose, d: number): Pose => ({
  x: c.x + d * Math.sin(c.ry * DEG),
  y: c.y,
  z: c.z + d * Math.cos(c.ry * DEG),
  ry: c.ry
});
const pad = (i: number) => String(i).padStart(2, '0');

interface ExperienceDepthProps {
  experiences: Experience[];
  label: string;
  /** Index of the card the camera should be at. */
  step: MotionValue<number>;
  /** Asks the host to go to card `i` (the progress dots). */
  onSelect: (i: number) => void;
  /** 0–1: the camera's fly-in to the current card, played by the host on a clock. */
  intro: MotionValue<number>;
  /** Told when a card is opened, and again once it has fully closed. */
  onDetailChange?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

export function ExperienceDepth({
  experiences,
  label,
  step,
  onSelect,
  intro,
  onDetailChange,
  className = '',
  style
}: ExperienceDepthProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const ghostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const n = experiences.length;

  /* ---------- opening a card ---------- */
  // The card the camera is at, mirrored out of the GSAP scope for click handling.
  const activeRef = useRef(-1);
  const [opened, setOpened] = useState<{
    index: number;
    from: Box;
    cardWidth: number;
    bounds: { w: number; h: number };
  } | null>(null);
  // The card that is hidden while the panel stands in for it; cleared only
  // once the panel has shrunk all the way back, so the two never show at once.
  const [hiddenCard, setHiddenCard] = useState<number | null>(null);

  const openCard = useCallback(
    (i: number) => {
      const card = cardRefs.current[i];
      const root = rootRef.current;
      if (!card || !root) return;
      // Only the card being read opens; any other is flown to first.
      if (i !== activeRef.current) {
        onSelect(i);
        return;
      }
      const r = root.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      setOpened({
        index: i,
        from: { x: c.left - r.left, y: c.top - r.top, w: c.width, h: c.height },
        // Its laid-out width: the perspective draws it smaller than that, and
        // the panel's copy of it must wrap its text exactly the same way.
        cardWidth: card.offsetWidth,
        bounds: { w: r.width, h: r.height }
      });
      setHiddenCard(i);
      onDetailChange?.(true);
    },
    [onSelect, onDetailChange]
  );
  const closeCard = useCallback(() => setOpened(null), []);
  const onClosed = useCallback(() => {
    setHiddenCard(null);
    onDetailChange?.(false);
  }, [onDetailChange]);

  // Toggled on the element rather than through className: the cards' classes
  // are also flipped imperatively (is-active), and a re-render would wipe them.
  useEffect(() => {
    cardRefs.current.forEach((el, j) => el?.classList.toggle('is-expanded', j === hiddenCard));
  }, [hiddenCard]);

  useGSAP(
    () => {
      const root = rootRef.current;
      const scene = sceneRef.current;
      const viewport = viewportRef.current;
      if (!root || !scene || !viewport || n === 0) return;
      const cardEls = cardRefs.current.slice(0, n) as HTMLElement[];
      const ghostEls = ghostRefs.current.slice(0, CONFIG.ghosts) as HTMLDivElement[];
      viewport.style.perspective = `${CONFIG.perspective}px`;

      /* ---------- layout: card positions in world space ---------- */
      function buildLayout(): Pose[] {
        const k = Math.min(1, innerWidth / 1100); // shrink spread on small screens
        const A = CONFIG.amplitude * k;
        const V = CONFIG.verticalAmp * k;
        const S = CONFIG.step * (0.75 + 0.25 * k);
        const out: Pose[] = [];
        let px = 0;
        let pz = 0;
        let heading = 0;
        for (let i = 0; i < n; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          if (CONFIG.layout === 'spread') {
            out.push(
              i === 0
                ? { x: 0, y: 0, z: 0, ry: (rand(11) * 2 - 1) * CONFIG.turnDeg }
                : pickSpread(out, i, A, V, S)
            );
          } else if (CONFIG.layout === 'zigzag') {
            out.push({ x: side * A, y: ((i % 3) - 1) * V, z: -i * S, ry: -side * CONFIG.turnDeg * 0.6 });
          } else if (CONFIG.layout === 'scatter') {
            out.push({
              x: (rand(i) * 2 - 1) * A,
              y: (rand(i + 7) * 2 - 1) * V,
              z: -i * S - rand(i + 3) * S * 0.3,
              ry: (rand(i + 11) * 2 - 1) * CONFIG.turnDeg
            });
          } else {
            // winding: the path itself turns (left, left, right, right, ...)
            if (i > 0) {
              heading += (Math.floor((i - 1) / 2) % 2 === 0 ? 1 : -1) * CONFIG.turnDeg;
              const h = heading * DEG;
              px -= S * Math.sin(h);
              pz -= S * Math.cos(h);
            }
            const h = heading * DEG;
            const lateral = side * A * 0.45;
            out.push({
              x: px + lateral * Math.cos(h),
              y: (rand(i) * 2 - 1) * V,
              z: pz - lateral * Math.sin(h),
              ry: heading
            });
          }
        }
        return out;
      }

      /* "spread": try seeded random spots for card i and keep the one that, seen
         from every earlier stop, is least hidden behind the card being read
         there, while the next 1–2 cards still land on screen. */
      function pickSpread(placed: Pose[], i: number, A: number, V: number, S: number): Pose {
        const Pd = CONFIG.perspective;
        const W = innerWidth;
        const H = innerHeight;
        const cw = cardEls[i].offsetWidth;
        const ch = cardEls[i].offsetHeight;
        let best: Pose = { x: 0, y: 0, z: -i * S, ry: 0 };
        let bestScore = Infinity;
        for (let k = 0; k < 160; k++) {
          const seed = i * 1000 + k * 7;
          const a = rand(seed) * Math.PI * 2;
          const r = 0.3 + rand(seed + 1) * 3;
          const c = {
            x: Math.cos(a) * A * r,
            y: Math.sin(a) * V * r,
            z: -i * S - rand(seed + 2) * S * 0.35,
            ry: (rand(seed + 3) * 2 - 1) * CONFIG.turnDeg
          };
          let score = rand(seed + 4) * 0.05; // tiny jitter so ties stay irregular
          placed.forEach((prev, m) => {
            const cam = poseFor(prev, CONFIG.stopDistance);
            const s = Math.sin(cam.ry * DEG);
            const co = Math.cos(cam.ry * DEG);
            const dx = c.x - cam.x;
            const dz = c.z - cam.z;
            const f = Pd / (Pd + -(dx * s + dz * co));
            const sx = (dx * co - dz * s) * f;
            const sy = (c.y - cam.y) * f;
            const hw = (cw * f) / 2;
            const hh = (ch * f) / 2;
            const aF = Pd / (Pd + CONFIG.stopDistance);
            const aw = (cardEls[m].offsetWidth * aF) / 2;
            const ah = (cardEls[m].offsetHeight * aF) / 2;
            const ox = Math.max(0, Math.min(sx + hw, aw) - Math.max(sx - hw, -aw));
            const oy = Math.max(0, Math.min(sy + hh, ah) - Math.max(sy - hh, -ah));
            score += ((ox * oy) / (4 * hw * hh)) * 10; // hidden behind the active card
            if (i - m <= 2) {
              score +=
                (Math.max(0, Math.abs(sx) + hw * 0.5 - W / 2) +
                  Math.max(0, Math.abs(sy) + hh * 0.5 - H / 2)) /
                100; // off screen
            }
          });
          if (score < bestScore) {
            bestScore = score;
            best = c;
          }
        }
        return best;
      }

      let world: Placed[] = [];
      let ghosts: Pose[] = [];
      // Where the camera rests to read each card.
      let rests: Pose[] = [];
      let start: Pose = { x: 0, y: 0, z: 0, ry: 0 };

      // Camera-path centre at a given z (interpolated between cards).
      function pathAt(z: number): { x: number; y: number } {
        if (z >= world[0].z) return world[0];
        for (let i = 0; i < n - 1; i++) {
          const a = world[i];
          const b = world[i + 1];
          if (z <= a.z && z >= b.z) {
            const t = (a.z - z) / (a.z - b.z || 1);
            return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
          }
        }
        return world[n - 1];
      }

      function computeLayout() {
        world = buildLayout().map((c, i) => ({
          ...c,
          tx: (rand(i + 21) * 2 - 1) * 16 * CONFIG.tilt,
          ty: (rand(i + 23) * 2 - 1) * 32 * CONFIG.tilt,
          tz: (rand(i + 29) * 2 - 1) * 10 * CONFIG.tilt
        }));
        // Halfway through the old hold's forward drift: the framing every card
        // was read at when the camera was scrubbed.
        rests = world.map(c => poseFor(c, CONFIG.stopDistance - CONFIG.approachDrift / 2));
        start = poseFor(world[0], CONFIG.stopDistance + CONFIG.introDistance);

        const k = Math.min(1, innerWidth / 1100);
        const zNear = world[0].z + CONFIG.introDistance * 0.8;
        const zFar = world[n - 1].z - 2200;
        ghosts = ghostEls.map((el, j) => {
          const z = zNear + (zFar - zNear) * ((j + rand(j + 60) * 0.8) / CONFIG.ghosts);
          const c = pathAt(z);
          const a = rand(j + 70) * Math.PI * 2;
          const d = CONFIG.ghostClearance * (0.6 + 0.4 * k) * (1 + rand(j + 80) * 0.9);
          const g = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.6, z, ry: 0 };
          el.style.transform = `translate(-50%, -50%) translate3d(${g.x}px, ${g.y}px, ${g.z}px) rotateY(${(rand(j + 90) * 2 - 1) * 35}deg) rotateX(${(rand(j + 95) * 2 - 1) * 20}deg) rotateZ(${(rand(j + 99) * 2 - 1) * 14}deg)`;
          return g;
        });
      }
      computeLayout();

      /* ---------- camera ---------- */
      const cam: Pose = { ...start };
      let active = -1;

      /* ---------- the 3D space behind the cards ---------- */
      // Three.js arrives in its own chunk; until then the plain black shows.
      let space: SpaceScene | null = null;
      let disposed = false;
      let onScreen = false;
      const spaceBounds = () => space?.setBounds(start.z, world[n - 1].z);
      const syncRunning = () => space?.setRunning(onScreen && !document.hidden);
      // Held by the loading screen on a fresh load, so the scene is compiled
      // before anyone scrolls to it.
      const releaseLoad = isInitialLoad() ? trackLoad() : () => {};
      const loadTimeout = window.setTimeout(releaseLoad, 10000);
      import('./experience-space')
        .then(({ createSpaceScene }) => {
          if (disposed || !canvasRef.current) return;
          space = createSpaceScene(canvasRef.current, SPACE_TINT, SPACE_INK);
          spaceBounds();
          space.setCamera(cam);
          syncRunning();
          return space.ready;
        })
        .catch(() => {})
        .finally(releaseLoad);
      const visIO = new IntersectionObserver(entries => {
        onScreen = entries[0].isIntersecting;
        syncRunning();
      });
      visIO.observe(root);
      document.addEventListener('visibilitychange', syncRunning);

      function setActive(i: number) {
        active = i;
        activeRef.current = i;
        cardEls.forEach((el, j) => el.classList.toggle('is-active', j === i));
        dotRefs.current.forEach((el, j) => {
          el?.classList.toggle('is-active', j === i);
          if (el) el.setAttribute('aria-current', j === i ? 'step' : 'false');
        });
        gsap.to(root, { '--accent': experiences[i].accent, duration: 0.6, overwrite: true });      }

      function render() {
        // Moving the world by the inverse of the camera = the viewer flies forward.
        scene!.style.transform = `rotateY(${-cam.ry}deg) translate3d(${-cam.x}px, ${-cam.y}px, ${-cam.z}px)`;
        space?.setCamera(cam);

        const s = Math.sin(cam.ry * DEG);
        const co = Math.cos(cam.ry * DEG);
        const depthOf = (p: Pose) => -((p.x - cam.x) * s + (p.z - cam.z) * co);
        const opacityAt = (depth: number) =>
          depth < 20
            ? 0 // behind / inside the camera: hide
            : depth < 150
              ? (depth - 20) / 130 // fade while flying through it
              : 1 -
                Math.min(1, Math.max(0, (depth - CONFIG.fogStart) / CONFIG.fogRange)) *
                  (1 - CONFIG.fogMin); // far fog
        const paint = (el: HTMLElement, o: number) => {
          el.style.opacity = o.toFixed(3);
          el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        };

        let next = -1;
        let best = Infinity;
        world.forEach((c, i) => {
          const depth = depthOf(c);
          const el = cardEls[i];
          // Resting tilt straightens out as the camera arrives.
          const t = Math.min(1, Math.max(0, (depth - CONFIG.stopDistance) / 1400));
          el.style.transform = `translate(-50%, -50%) translate3d(${c.x}px, ${c.y}px, ${c.z}px) rotateY(${c.ry + c.ty * t}deg) rotateX(${c.tx * t}deg) rotateZ(${c.tz * t}deg)`;
          paint(el, opacityAt(depth));
          if (depth > 20 && depth < 700 && depth < best) {
            best = depth;
            next = i;
          }
        });
        ghosts.forEach((g, j) => paint(ghostEls[j], opacityAt(depthOf(g)) * 0.55));
        if (next !== -1 && next !== active) setActive(next);
      }

      /* ---------- flight ---------- */
      const clampStep = (i: number) => Math.min(n - 1, Math.max(0, Math.round(i)));
      // The camera's resting pose, flown between cards by one tween at a time.
      let current = clampStep(step.get());
      const focus: Pose = { ...rests[current] };

      // The fly-in blends from the start pose onto `focus`, eased out so the
      // camera glides into the first card rather than braking hard. At intro 1
      // the camera simply is `focus`.
      const sync = () => {
        const k = intro.get();
        const e = 1 - (1 - k) * (1 - k);
        cam.x = start.x + (focus.x - start.x) * e;
        cam.y = start.y + (focus.y - start.y) * e;
        cam.z = start.z + (focus.z - start.z) * e;
        cam.ry = start.ry + (focus.ry - start.ry) * e;
        render();
      };
      sync();
      const stopIntro = intro.on('change', sync);

      const unsubscribe = step.on('change', value => {
        const i = clampStep(value);
        const cards = Math.abs(i - current);
        current = i;
        gsap.killTweensOf(focus);
        // Not on screen yet (box still growing, or the fly-in hasn't started):
        // nothing to animate, just be there.
        if (intro.get() === 0) {
          Object.assign(focus, rests[i]);
          sync();
          return;
        }
        if (cards === 0) return;
        gsap.to(focus, {
          ...rests[i],
          duration: STEP_DURATION + (cards - 1) * STEP_EXTRA_PER_CARD,
          // One continuous ease-in-out per move — no scroll velocity feeding
          // in, so there is nothing for it to stutter against.
          ease: 'power3.inOut',
          onUpdate: sync
        });
      });

      /* ---------- relayout on resize and once web fonts settle ---------- */
      const relayout = () => {
        computeLayout();
        spaceBounds();
        gsap.killTweensOf(focus);
        Object.assign(focus, rests[current]);
        sync();
      };
      window.addEventListener('resize', relayout);
      document.fonts?.ready.then(relayout);

      /* ---------- subtle pointer parallax (desktop only) ---------- */
      let onPointer: ((e: PointerEvent) => void) | undefined;
      if (matchMedia('(pointer: fine)').matches) {
        const po = { x: 50, y: 50 };
        const apply = () => {
          viewport.style.perspectiveOrigin = `${po.x}% ${po.y}%`;
        };
        const qx = gsap.quickTo(po, 'x', { duration: 0.8, ease: 'power3', onUpdate: apply });
        const qy = gsap.quickTo(po, 'y', { duration: 0.8, ease: 'power3', onUpdate: apply });
        onPointer = e => {
          const r = root.getBoundingClientRect();
          qx(50 - ((e.clientX - r.left) / r.width - 0.5) * 10);
          qy(50 - ((e.clientY - r.top) / r.height - 0.5) * 10);
        };
        window.addEventListener('pointermove', onPointer);
      }

      return () => {
        disposed = true;
        visIO.disconnect();
        document.removeEventListener('visibilitychange', syncRunning);
        window.clearTimeout(loadTimeout);
        releaseLoad();
        space?.dispose();
        unsubscribe();
        stopIntro();
        gsap.killTweensOf(focus);
        window.removeEventListener('resize', relayout);
        if (onPointer) window.removeEventListener('pointermove', onPointer);
      };
    },
    { scope: rootRef, dependencies: [experiences, n] }
  );

  return (
    <div
      ref={rootRef}
      className={`overflow-hidden ${className}`}
      style={
        {
          '--accent': experiences[0]?.accent,
          background: SPACE_INK,
          ...style
        } as CSSProperties
      }
      aria-label={label}
      role="region"
    >
      {/* Stars, nebulae and the ship (experience-space.ts), behind the cards. */}
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* --cards-opacity, --cards-y, --cards-scale: the host fades the cards in
          (rising from below and scaling up) as the box grows, and out again on
          the way out. Set here, on the perspective container, and not below
          it: opacity or transforms between here and the cards would flatten
          the 3D. */}
      <div
        ref={viewportRef}
        className="absolute inset-0 [opacity:var(--cards-opacity,1)] [transform:translateY(var(--cards-y,0px))_scale(var(--cards-scale,1))]"
        style={{ perspectiveOrigin: '50% 50%' }}
      >
        {/* 0×0 at the viewport centre, so its origin is the camera's eye line.
            Nothing between here and the cards may set overflow, filter,
            opacity or clip-path — any of them flattens the 3D. */}
        <div
          ref={sceneRef}
          className="absolute left-1/2 top-1/2 h-0 w-0 will-change-transform"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Ghost cards: bare outlines, so they read as depth, never as content. */}
          {Array.from({ length: CONFIG.ghosts }, (_, j) => (
            <div
              key={`ghost-${j}`}
              ref={el => {
                ghostRefs.current[j] = el;
              }}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 aspect-[4/3] rounded-2xl border border-white/10 will-change-[transform,opacity]"
              style={{
                width: `min(${Math.round(170 + rand(j + 40) * 150)}px, 52vw)`,
                backfaceVisibility: 'hidden'
              }}
            />
          ))}

          {experiences.map((exp, i) => (
            <article
              key={`${exp.org}-${exp.role}`}
              ref={el => {
                cardRefs.current[i] = el;
              }}
              // A ticket of the site's paper: see .mission-card in index.css.
              // Clickable only once the host lets the fly-through take input
              // (--depth-pointer).
              className="mission-card group absolute left-0 top-0 w-[min(440px,82vw)] cursor-pointer rounded-[24px] outline-none will-change-[transform,opacity] [pointer-events:var(--depth-pointer,auto)] focus-visible:ring-2 focus-visible:ring-white/70"
              style={{ backfaceVisibility: 'hidden' }}
              role="button"
              tabIndex={0}
              aria-label={`${exp.role}, ${exp.org}: open details`}
              onClick={() => openCard(i)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  openCard(i);
                }
              }}
            >
              <CardFace experience={exp} index={i} total={n} />
            </article>
          ))}
        </div>
      </div>

      {/* Lines up with the navbar row, which stays fixed above all of this. */}
      <div className="page-gutter pointer-events-none absolute left-0 top-0 pt-6 sm:pt-8">
        <p className="flex h-14 items-center font-sans text-sm font-medium text-white/60">{label}</p>
      </div>

      <nav
        aria-label="Jump to an experience"
        // The host shows the dots only while the fly-through fills the screen
        // (--dots-opacity), and takes them out of hit-testing otherwise.
        className="page-gutter absolute right-0 top-1/2 grid -translate-y-1/2 gap-3 [opacity:var(--dots-opacity,1)] [pointer-events:var(--depth-pointer,auto)]"
      >
        {experiences.map((exp, i) => (
          <button
            key={`dot-${exp.org}-${exp.role}`}
            ref={el => {
              dotRefs.current[i] = el;
            }}
            type="button"
            aria-label={`${exp.role}, ${exp.org}`}
            onClick={() => onSelect(i)}
            className="size-2.5 rounded-full border border-white/40 transition-[transform,background-color,border-color] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-white [&.is-active]:scale-[1.4] [&.is-active]:border-[#F5FAFF] [&.is-active]:bg-[#F5FAFF]"
          />
        ))}
      </nav>

      <AnimatePresence onExitComplete={onClosed}>
        {opened && (
          <ExperienceDetail
            key={opened.index}
            experience={experiences[opened.index]}
            index={opened.index}
            from={opened.from}
            cardWidth={opened.cardWidth}
            total={n}
            bounds={opened.bounds}
            onClose={closeCard}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Reduced motion: the same content as a plain list, no 3D and no pinning. */
export function ExperienceList({ experiences, label }: { experiences: Experience[]; label: string }) {
  return (
    <div className="rounded-3xl bg-black px-4 py-16 sm:px-10" role="region" aria-label={label}>
      <p className="mb-8 text-center font-sans text-sm font-medium text-white/60">{label}</p>
      <div className="grid justify-items-center gap-6">
        {experiences.map((exp, i) => (
          <article
            key={`${exp.org}-${exp.role}`}
            className="w-[min(440px,100%)] rounded-[20px] bg-[#F5FAFF] p-[clamp(20px,3vw,32px)] text-[#10171c]"
          >
            <div className="flex items-baseline justify-between gap-3 font-sans text-sm text-[#9aa6ad]">
              <span className="tabular-nums" style={{ color: exp.accent }}>
                {pad(i + 1)}
              </span>
              <span>{exp.period}</span>
            </div>
            <h3 className="mt-4 font-sans text-2xl font-semibold leading-[1.06] tracking-[-0.03em]">{exp.role}</h3>
            <p className="mt-1 font-sans text-[#3a4048]">{exp.org}</p>
            <p className="mt-4 font-sans leading-relaxed text-[#3a4048]">{exp.summary}</p>
            <ul className="mt-4 grid gap-2">
              {exp.points.map(point => (
                <li key={point} className="relative pl-5 font-sans text-[0.95rem] leading-snug">
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-[0.65em] h-0.5 w-2"
                    style={{ background: exp.accent }}
                  />
                  {point}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
