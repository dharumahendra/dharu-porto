import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * IridescentTrail — paint/velocity feedback trail, per the Lusion replication
 * plan.
 *
 * Three ping-pong passes per frame:
 *   A  velocity — mouse movement injects velocity, which dissipates
 *   B  paint    — advects two weight channels along velocity + curl noise,
 *                 each decaying at a different rate
 *   C  composite— maps the weight ratio (i.e. trail age) onto an iridescent
 *                 ramp, with per-channel dispersion, and draws to screen
 *
 * The two decay rates are the whole trick: weight1 (slow) and weight2 (fast)
 * separate as a stroke ages, so their ratio is a free "age" signal that drives
 * the colour sweep without storing a timestamp per texel.
 *
 * Note this composites over transparent, not over a rendered backdrop. It
 * therefore cannot refract the page behind it — WebGL has no access to DOM
 * pixels. The dispersion below is applied to the trail's own lookup, which
 * still yields RGB fringing at the edges, but true background warping would
 * require the page content to live inside this canvas.
 */

export interface IridescentTrailProps {
  /** Velocity injected per unit of pointer movement. */
  pushStrength?: number;
  /** Curl-noise spatial frequency, as roughly "cycles across the viewport / 40". */
  curlScale?: number;
  /** Curl-noise displacement magnitude. */
  curlStrength?: number;
  /** Per-frame velocity decay at 60fps. */
  velocityDissipation?: number;
  /** Per-frame decay of the slow ("old", warm) paint channel at 60fps. */
  weight1Dissipation?: number;
  /** Per-frame decay of the fast ("young", cool) paint channel at 60fps. */
  weight2Dissipation?: number;
  /** Brush radius in UV units. */
  radius?: number;
  /** Chromatic aberration offset. */
  aberration?: number;
  /** How far the dispersion lookup is pushed along the velocity field. */
  refraction?: number;
  /** Simulation texture scale relative to the canvas. */
  simResolution?: number;
  /** Iridescent ramp, young/cool first through old/warm last. */
  colors?: string[];
  /** Overall trail opacity. */
  opacity?: number;
  /** Upper bound on devicePixelRatio for the composite pass. */
  maxPixelRatio?: number;
  /**
   * Id of the scrolling element to anchor the trail to, so it sticks to the
   * page rather than the viewport. Falls back to window scroll when absent.
   * Pass null to disable anchoring.
   */
  scrollElementId?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_COLORS = [
  '#FF4BD8', // youngest: magenta
  '#7A4BFF', // indigo
  '#2E6BFF', // blue
  '#3FE0F0', // cyan
  '#46C86E', // green
  '#FFB020', // amber
  '#FF6A2C', // orange
  '#E23A2E' // oldest: red
];

const VERT = `
precision highp float;
attribute vec3 position;
varying vec2 vUv;
void main(){
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const VELOCITY_FRAG = `
precision highp float;
uniform sampler2D u_vel;
uniform vec2  u_mouse;
uniform vec2  u_mouseVel;
uniform float u_pushStrength;
uniform float u_radius;
uniform float u_velDissipation;
uniform float u_scrollDelta;
uniform vec2  u_aspect;
varying vec2 vUv;

void main(){
  // Scroll anchoring: resample the previous field shifted by how far the page
  // moved, so the trail travels with the content instead of the viewport.
  vec2 src = vUv - vec2(0.0, u_scrollDelta);
  vec2 vel = texture2D(u_vel, src).xy * u_velDissipation;

  // Aspect-corrected so the brush stays circular on wide viewports.
  float d = distance(vUv * u_aspect, u_mouse * u_aspect);
  float falloff = smoothstep(u_radius, 0.0, d);

  vel += u_mouseVel * u_pushStrength * falloff;
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
`;

const PAINT_FRAG = `
precision highp float;
uniform sampler2D u_prevPaint;
uniform sampler2D u_vel;
uniform vec2  u_dissipations;
uniform float u_curlScale;
uniform float u_curlStrength;
uniform float u_dt;
uniform vec2  u_mouse;
uniform float u_radius;
uniform float u_inject;
uniform float u_scrollDelta;
uniform vec2  u_aspect;
varying vec2 vUv;

// Simplex noise (Ashima Arts / Stefan Gustavson, MIT).
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x){ return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Curl of a scalar noise potential. Taking the curl makes the field
// divergence-free, so the flow swirls rather than pooling into sources.
vec2 curl(vec2 p){
  float e = 0.1;
  float n1 = snoise(p + vec2(0.0, e));
  float n2 = snoise(p - vec2(0.0, e));
  float n3 = snoise(p + vec2(e, 0.0));
  float n4 = snoise(p - vec2(e, 0.0));
  return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
}

void main(){
  vec2 vel = texture2D(u_vel, vUv).xy;

  // The plan's curlScale/curlStrength are in the original bundle's own units.
  // 40.0 maps scale to roughly cycles-across-viewport; 0.02 brings the raw
  // finite-difference derivative (which runs to ~5) into the same uv/sec scale
  // as the velocity field.
  vec2 flow = curl(vUv * u_curlScale * 40.0) * u_curlStrength * 0.02;

  // Semi-Lagrangian advection: look back along the flow.
  vec2 uvBack = vUv - (vel + flow) * u_dt - vec2(0.0, u_scrollDelta);
  vec4 paint = texture2D(u_prevPaint, uvBack);

  paint.x *= u_dissipations.x; // weight1 — slow, so it dominates in old trail
  paint.y *= u_dissipations.y; // weight2 — fast, so it marks fresh trail

  float d = distance(vUv * u_aspect, u_mouse * u_aspect);
  float falloff = smoothstep(u_radius, 0.0, d);
  paint.xy += vec2(falloff * u_inject);

  gl_FragColor = vec4(clamp(paint.xy, 0.0, 4.0), 0.0, 1.0);
}
`;

const COMPOSITE_FRAG = `
precision highp float;
uniform sampler2D u_paint;
uniform sampler2D u_vel;
uniform sampler2D u_palette;
uniform float u_aberration;
uniform float u_refraction;
uniform float u_opacity;
varying vec2 vUv;

// Ratio of the two weights is a free age signal: equal when freshly painted,
// drifting toward weight1 as the faster channel decays away beneath it.
float ageAt(vec2 uv){
  vec2 p = texture2D(u_paint, uv).xy;
  float mixT = p.x / max(p.x + p.y, 1e-4);
  return clamp((mixT - 0.5) * 2.0, 0.0, 1.0);
}
float amountAt(vec2 uv){
  vec2 p = texture2D(u_paint, uv).xy;
  return clamp(p.x + p.y, 0.0, 1.0);
}

void main(){
  vec2 vel = texture2D(u_vel, vUv).xy;
  vec2 refr = vel * u_refraction;

  // Chromatic aberration: each channel reads the ramp at a slightly different
  // offset along the flow, so the head of a stroke splits into an RGB fringe.
  vec2 uvR = vUv + refr * (1.0 + u_aberration);
  vec2 uvG = vUv + refr;
  vec2 uvB = vUv + refr * (1.0 - u_aberration);

  vec3 col = vec3(
    texture2D(u_palette, vec2(ageAt(uvR), 0.5)).r,
    texture2D(u_palette, vec2(ageAt(uvG), 0.5)).g,
    texture2D(u_palette, vec2(ageAt(uvB), 0.5)).b
  );

  float amount = amountAt(uvG);
  // Specular-ish bloom where the paint piles up.
  col += vec3(pow(amount, 3.0)) * 0.35;

  float a = smoothstep(0.0, 0.30, amount) * u_opacity;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(a, 0.0, 1.0));
}
`;

export default function IridescentTrail({
  pushStrength = 25,
  curlScale = 0.1,
  curlStrength = 5,
  velocityDissipation = 0.985,
  weight1Dissipation = 0.95,
  weight2Dissipation = 0.8,
  radius = 0.05,
  aberration = 0.006,
  refraction = 0.03,
  simResolution = 0.5,
  colors = DEFAULT_COLORS,
  opacity = 1,
  maxPixelRatio = 2,
  scrollElementId = 'main-scroll',
  className = '',
  style = {}
}: IridescentTrailProps): React.ReactElement {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    const gl = renderer.getContext();
    if (!gl) return;

    renderer.autoClear = false;
    renderer.setClearColor(new THREE.Color(0x000000), 0);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    renderer.setPixelRatio(pixelRatio);
    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    // ---- palette LUT -------------------------------------------------------
    const stops = colors.length > 1 ? colors : [colors[0] ?? '#ffffff', colors[0] ?? '#ffffff'];
    const lut = new Uint8Array(stops.length * 4);
    stops.forEach((hex, i) => {
      const c = new THREE.Color(hex);
      lut[i * 4 + 0] = Math.round(c.r * 255);
      lut[i * 4 + 1] = Math.round(c.g * 255);
      lut[i * 4 + 2] = Math.round(c.b * 255);
      lut[i * 4 + 3] = 255;
    });
    const paletteTex = new THREE.DataTexture(lut, stops.length, 1, THREE.RGBAFormat);
    paletteTex.magFilter = THREE.LinearFilter;
    paletteTex.minFilter = THREE.LinearFilter;
    paletteTex.wrapS = THREE.ClampToEdgeWrapping;
    paletteTex.wrapT = THREE.ClampToEdgeWrapping;
    paletteTex.generateMipmaps = false;
    paletteTex.needsUpdate = true;

    // ---- targets -----------------------------------------------------------
    const rtOpts = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping
    } as const;

    const makeRT = (w: number, h: number) => new THREE.WebGLRenderTarget(w, h, rtOpts);

    let width = 1;
    let height = 1;
    let simW = 1;
    let simH = 1;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      simW = Math.max(1, Math.round(width * simResolution));
      simH = Math.max(1, Math.round(height * simResolution));
    };
    measure();

    let velA = makeRT(simW, simH);
    let velB = makeRT(simW, simH);
    let paintA = makeRT(simW, simH);
    let paintB = makeRT(simW, simH);

    // ---- passes ------------------------------------------------------------
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const geometry = new THREE.PlaneGeometry(2, 2);

    const aspect = new THREE.Vector2(1, 1);

    const velMat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: VELOCITY_FRAG,
      depthWrite: false,
      uniforms: {
        u_vel: { value: velA.texture },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_mouseVel: { value: new THREE.Vector2(0, 0) },
        u_pushStrength: { value: pushStrength },
        u_radius: { value: radius },
        u_velDissipation: { value: velocityDissipation },
        u_scrollDelta: { value: 0 },
        u_aspect: { value: aspect }
      }
    });

    const paintMat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: PAINT_FRAG,
      depthWrite: false,
      uniforms: {
        u_prevPaint: { value: paintA.texture },
        u_vel: { value: velA.texture },
        u_dissipations: { value: new THREE.Vector2(weight1Dissipation, weight2Dissipation) },
        u_curlScale: { value: curlScale },
        u_curlStrength: { value: curlStrength },
        u_dt: { value: 1 / 60 },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_radius: { value: radius },
        u_inject: { value: 0 },
        u_scrollDelta: { value: 0 },
        u_aspect: { value: aspect }
      }
    });

    const compMat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: COMPOSITE_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        u_paint: { value: paintA.texture },
        u_vel: { value: velA.texture },
        u_palette: { value: paletteTex },
        u_aberration: { value: aberration },
        u_refraction: { value: refraction },
        u_opacity: { value: opacity }
      }
    });

    const quad = new THREE.Mesh(geometry, velMat);
    scene.add(quad);

    const runPass = (mat: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      quad.material = mat;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
    };

    const applySize = () => {
      measure();
      renderer.setSize(width, height, false);
      aspect.set(width / height, 1);
      velA.setSize(simW, simH);
      velB.setSize(simW, simH);
      paintA.setSize(simW, simH);
      paintB.setSize(simW, simH);
    };
    applySize();

    // ---- input -------------------------------------------------------------
    const mouse = new THREE.Vector2(0.5, 0.5);
    const prevMouse = new THREE.Vector2(0.5, 0.5);
    let hasMoved = false;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      mouse.set((e.clientX - rect.left) / rect.width, 1 - (e.clientY - rect.top) / rect.height);
      if (!hasMoved) {
        prevMouse.copy(mouse);
        hasMoved = true;
      }
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const getScroll = () => {
      if (scrollElementId === null) return 0;
      const el = document.getElementById(scrollElementId);
      if (el) return el.scrollTop;
      return window.scrollY || 0;
    };
    let prevScroll = getScroll();

    // ---- loop --------------------------------------------------------------
    const clock = new THREE.Clock();
    let raf: number | null = null;
    let running = false;

    const frame = () => {
      if (!running) return;
      raf = requestAnimationFrame(frame);

      const dt = Math.min(clock.getDelta(), 1 / 30);
      // Dissipation constants in the plan are per-frame at 60fps; raising them
      // to dt*60 keeps the trail's lifetime identical off 60Hz displays.
      const frames = dt * 60;

      const scroll = getScroll();
      const scrollDelta = (scroll - prevScroll) / Math.max(height, 1);
      prevScroll = scroll;

      const mvx = mouse.x - prevMouse.x;
      const mvy = mouse.y - prevMouse.y;
      prevMouse.copy(mouse);
      const speed = Math.hypot(mvx, mvy);

      // Pass A — velocity
      velMat.uniforms.u_vel.value = velA.texture;
      velMat.uniforms.u_mouse.value.copy(mouse);
      velMat.uniforms.u_mouseVel.value.set(mvx, mvy);
      velMat.uniforms.u_velDissipation.value = Math.pow(velocityDissipation, frames);
      velMat.uniforms.u_scrollDelta.value = scrollDelta;
      runPass(velMat, velB);
      const velTmp = velA;
      velA = velB;
      velB = velTmp;

      // Pass B — paint
      paintMat.uniforms.u_prevPaint.value = paintA.texture;
      paintMat.uniforms.u_vel.value = velA.texture;
      paintMat.uniforms.u_dt.value = dt;
      paintMat.uniforms.u_mouse.value.copy(mouse);
      paintMat.uniforms.u_scrollDelta.value = scrollDelta;
      // Injection is gated on movement, so a parked cursor stops feeding the
      // field and the trail dissipates completely.
      paintMat.uniforms.u_inject.value = Math.min(1, speed * 26) * Math.min(1, frames);
      paintMat.uniforms.u_dissipations.value.set(
        Math.pow(weight1Dissipation, frames),
        Math.pow(weight2Dissipation, frames)
      );
      runPass(paintMat, paintB);
      const paintTmp = paintA;
      paintA = paintB;
      paintB = paintTmp;

      // Pass C — composite to screen
      compMat.uniforms.u_paint.value = paintA.texture;
      compMat.uniforms.u_vel.value = velA.texture;
      renderer.setRenderTarget(null);
      renderer.clear();
      runPass(compMat, null);
    };

    const start = () => {
      if (running) return;
      running = true;
      clock.getDelta();
      frame();
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    let resizeRaf: number | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(applySize);
    });
    ro.observe(container);

    start();

    return () => {
      stop();
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
      velA.dispose();
      velB.dispose();
      paintA.dispose();
      paintB.dispose();
      paletteTex.dispose();
      velMat.dispose();
      paintMat.dispose();
      compMat.dispose();
      geometry.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [
    pushStrength,
    curlScale,
    curlStrength,
    velocityDissipation,
    weight1Dissipation,
    weight2Dissipation,
    radius,
    aberration,
    refraction,
    simResolution,
    colors,
    opacity,
    maxPixelRatio,
    scrollElementId
  ]);

  return (
    <div
      ref={mountRef}
      className={`w-full h-full relative overflow-hidden pointer-events-none touch-none ${className}`}
      style={style}
    />
  );
}
