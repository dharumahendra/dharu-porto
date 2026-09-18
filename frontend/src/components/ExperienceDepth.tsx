import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { MotionValue } from 'framer-motion';
import { useRef, type CSSProperties } from 'react';
import type { Experience } from '../data/experiences';

/*
 * Z-depth fly-through, ported from the z-depth-experience skill's reference
 * demo. Cards float in 3D space; the "camera" is the inverse transform of the
 * scene, flown forward by a GSAP timeline.
 *
 * One deliberate difference from the demo: the timeline is not pinned or
 * scrubbed by ScrollTrigger. This page scrolls a Lenis container rather than
 * the window, and the black box that hosts the scene is already pinned with
 * `position: sticky` — so the host hands in a 0–1 progress value and the
 * timeline is simply set to it. Snapping to cards is done through the same
 * host, which knows how to turn a progress value back into a scroll position.
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
  introDistance: 1800,
  hold: 0.9,
  move: 1,
  scrollPerUnit: 0.9,
  snap: true
};

// Timeline units for the opening fly-in to the first card. That stretch plays
// on the host's clock (`intro`), not on scroll.
const INTRO_UNITS = CONFIG.move * 1.4;

/** Timeline units after the fly-in, mirroring how the timeline below is built. */
function scrolledUnits(count: number) {
  return count * CONFIG.hold + (count - 1) * CONFIG.move + 0.3;
}

/** Scroll distance the fly-through needs, in viewport heights × 100 (svh). */
export function depthScrollVh(count: number) {
  return scrolledUnits(count) * CONFIG.scrollPerUnit * 100;
}

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
  /** 0–1 through the fly-through, driven by the host's scroll. */
  progress: MotionValue<number>;
  /** Scrolls the page so the fly-through lands at `p`. */
  seek: (p: number) => void;
  /** 0–1: the camera's fly-in to the first card, played by the host on a clock. */
  intro: MotionValue<number>;
  className?: string;
  style?: CSSProperties;
}

export function ExperienceDepth({
  experiences,
  label,
  progress,
  seek,
  intro,
  className = '',
  style
}: ExperienceDepthProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const ghostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Label positions as 0–1 progress, for the dots and snapping.
  const labelProgress = useRef<number[]>([]);
  // The timeline is built once, but `seek` changes identity once the host's
  // Lenis instance arrives; snapping reads it through this so it never calls a
  // stale one that does nothing.
  const seekRef = useRef(seek);
  seekRef.current = seek;

  const n = experiences.length;

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
      let stops: Pose[] = [];
      let held: Pose[] = [];
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
        stops = world.map(c => poseFor(c, CONFIG.stopDistance));
        held = world.map(c => poseFor(c, CONFIG.stopDistance - CONFIG.approachDrift));
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

      function setActive(i: number) {
        active = i;
        cardEls.forEach((el, j) => el.classList.toggle('is-active', j === i));
        dotRefs.current.forEach((el, j) => {
          el?.classList.toggle('is-active', j === i);
          if (el) el.setAttribute('aria-current', j === i ? 'step' : 'false');
        });
        gsap.to(root, { '--accent': experiences[i].accent, duration: 0.6, overwrite: true });
      }

      function render() {
        // Moving the world by the inverse of the camera = the viewer flies forward.
        scene!.style.transform = `rotateY(${-cam.ry}deg) translate3d(${-cam.x}px, ${-cam.y}px, ${-cam.z}px)`;

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

      /* ---------- timeline, driven by the host's progress ---------- */
      const P = (get: () => Pose) => ({
        x: () => get().x,
        y: () => get().y,
        z: () => get().z,
        ry: () => get().ry
      });
      const tl = gsap.timeline({ paused: true, onUpdate: render });
      tl.fromTo(cam, P(() => start), {
        ...P(() => stops[0]),
        duration: CONFIG.move * 1.4,
        ease: 'power2.out',
        immediateRender: false
      });
      for (let i = 0; i < n; i++) {
        const t0 = tl.duration();
        tl.fromTo(cam, P(() => stops[i]), {
          ...P(() => held[i]),
          duration: CONFIG.hold,
          ease: 'none',
          immediateRender: false
        });
        tl.addLabel(`card-${i}`, t0 + CONFIG.hold / 2);
        if (i < n - 1) {
          tl.fromTo(cam, P(() => held[i]), {
            ...P(() => stops[i + 1]),
            duration: CONFIG.move,
            ease: 'power2.inOut',
            immediateRender: false
          });
        }
      }
      tl.to({}, { duration: 0.3 }); // short breath before the box scrolls away

      // Scroll only covers what comes after the fly-in, so label positions are
      // expressed as progress through that part.
      const rest = tl.duration() - INTRO_UNITS;
      labelProgress.current = experiences.map(
        (_, i) => (tl.labels[`card-${i}`] - INTRO_UNITS) / rest
      );

      // The fly-in scales the whole target time rather than just its own
      // stretch: while it plays, a scroll that has already started pulls the
      // camera on proportionally instead of jumping once the fly-in lands. At
      // intro 1 it is plain scroll position again.
      const sync = () => tl.time(intro.get() * (INTRO_UNITS + progress.get() * rest));
      sync();
      render();
      const stopIntro = intro.on('change', sync);

      /* ---------- snap to the nearest card in the direction of travel ---------- */
      let snapTimer: number | undefined;
      let settledAt = progress.get();
      const unsubscribe = progress.on('change', p => {
        sync();
        if (!CONFIG.snap) return;
        window.clearTimeout(snapTimer);
        snapTimer = window.setTimeout(() => {
          const from = settledAt;
          settledAt = p;
          if (p <= 0 || p >= 1) return;
          const labels = labelProgress.current;
          const dir = Math.sign(p - from);
          const eps = 0.002;
          const target =
            dir > 0
              ? labels.find(l => l >= p - eps)
              : dir < 0
                ? [...labels].reverse().find(l => l <= p + eps)
                : undefined;
          if (target !== undefined && Math.abs(target - p) > eps) {
            settledAt = target;
            seekRef.current(target);
          }
        }, 180);
      });

      /* ---------- relayout on resize and once web fonts settle ---------- */
      const relayout = () => {
        computeLayout();
        tl.invalidate();
        tl.time(0);
        sync();
        render();
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
        unsubscribe();
        stopIntro();
        window.clearTimeout(snapTimer);
        window.removeEventListener('resize', relayout);
        if (onPointer) window.removeEventListener('pointermove', onPointer);
        tl.kill();
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
          background:
            'radial-gradient(120% 90% at 50% 50%, color-mix(in oklab, var(--accent) 16%, #000) 0%, #000 70%)',
          ...style
        } as CSSProperties
      }
      aria-label={label}
      role="region"
    >
      <div ref={viewportRef} className="absolute inset-0" style={{ perspectiveOrigin: '50% 50%' }}>
        {/* 0×0 at the viewport centre, so its origin is the camera's eye line.
            Nothing between here and the cards may set overflow, filter,
            opacity or clip-path — any of them flattens the 3D. */}
        <div
          ref={sceneRef}
          className="absolute left-1/2 top-1/2 h-0 w-0 will-change-transform"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Ghost cards: outlines only, so they read as depth, never as content. */}
          {Array.from({ length: CONFIG.ghosts }, (_, j) => {
            const exp = experiences[j % n];
            const kind = j % 3;
            return (
              <div
                key={`ghost-${j}`}
                ref={el => {
                  ghostRefs.current[j] = el;
                }}
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 flex aspect-[4/3] flex-col justify-between rounded-2xl border border-white/10 p-4 will-change-[transform,opacity]"
                style={{
                  width: `min(${Math.round(170 + rand(j + 40) * 150)}px, 52vw)`,
                  backfaceVisibility: 'hidden'
                }}
              >
                {kind === 0 && (
                  <>
                    <span className="font-sans text-xs text-white/40">{exp.period}</span>
                    <strong className="font-sans text-2xl font-semibold tracking-[-0.03em] text-white/50">
                      {exp.period.slice(0, 4)}
                    </strong>
                  </>
                )}
                {kind === 1 && (
                  <>
                    <span className="font-sans text-xs tabular-nums text-white/40">{pad((j % n) + 1)}</span>
                    <strong className="font-sans text-xl font-semibold leading-tight tracking-[-0.02em] text-white/50">
                      {exp.org.split('(')[0].trim()}
                    </strong>
                  </>
                )}
                {kind === 2 && (
                  <>
                    <span />
                    <i className="block h-[3px] w-2/5 rounded-full" style={{ background: exp.accent }} />
                  </>
                )}
              </div>
            );
          })}

          {experiences.map((exp, i) => (
            <article
              key={`${exp.org}-${exp.role}`}
              ref={el => {
                cardRefs.current[i] = el;
              }}
              className="group absolute left-0 top-0 w-[min(440px,82vw)] rounded-[20px] bg-[#F5FAFF] p-[clamp(20px,3vw,32px)] text-[#10171c] will-change-[transform,opacity]"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="flex items-baseline justify-between gap-3 font-sans text-sm text-[#9aa6ad]">
                <span className="tabular-nums" style={{ color: exp.accent }}>
                  {pad(i + 1)}
                </span>
                <span>{exp.period}</span>
              </div>
              <h3 className="mt-4 font-sans text-[clamp(1.5rem,3.2vw,2.1rem)] font-semibold leading-[1.06] tracking-[-0.03em]">
                {exp.role}
              </h3>
              <p className="mt-1 font-sans text-[#3a4048]">{exp.org}</p>
              <p className="mt-4 font-sans leading-relaxed text-[#3a4048]">{exp.summary}</p>
              <ul className="mt-4 grid gap-2">
                {exp.points.map((point, j) => (
                  <li
                    key={point}
                    className="relative translate-y-2.5 pl-5 font-sans text-[0.95rem] leading-snug opacity-0 transition-[opacity,transform] duration-[450ms] ease-out group-[.is-active]:translate-y-0 group-[.is-active]:opacity-100"
                    style={{ transitionDelay: `${j * 80}ms` }}
                  >
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

      {/* Lines up with the navbar row, which stays fixed above all of this. */}
      <div className="page-gutter pointer-events-none absolute left-0 top-0 pt-6 sm:pt-8">
        <p className="flex h-14 items-center font-sans text-sm font-medium text-white/60">{label}</p>
      </div>

      <nav
        aria-label="Jump to an experience"
        className="page-gutter pointer-events-auto absolute right-0 top-1/2 grid -translate-y-1/2 gap-3"
      >
        {experiences.map((exp, i) => (
          <button
            key={`dot-${exp.org}-${exp.role}`}
            ref={el => {
              dotRefs.current[i] = el;
            }}
            type="button"
            aria-label={`${exp.role}, ${exp.org}`}
            onClick={() => seek(labelProgress.current[i] ?? 0)}
            className="size-2.5 rounded-full border border-white/40 transition-[transform,background-color,border-color] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-white [&.is-active]:scale-[1.4] [&.is-active]:border-[var(--accent)] [&.is-active]:bg-[var(--accent)]"
          />
        ))}
      </nav>
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
