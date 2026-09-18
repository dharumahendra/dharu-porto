"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getScrollRoot } from "@/lib/scroll-root";

export type ChromaticImageProps = {
  src: string;
  alt: string;
  children?: React.ReactNode;
  className?: string;
  backgroundColor?: string;
  zoom?: number;
  displacement?: number;
  chromaticShift?: number;
  tilt?: number;
  /**
   * How the pointer drives the warp.
   *
   * - `track` (default): the effect follows the pointer for as long as it is
   *   over the image.
   * - `cross`: the effect fires only as the pointer crosses the boundary — one
   *   sweep on the way in, one on the way out, aimed from wherever it crossed.
   *   Moving around inside does nothing at all, which leaves the surface free
   *   for another effect to own.
   */
  pointerMode?: "track" | "cross";
};

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uImage;
uniform vec2 uPointer;
uniform float uImageAspect;
uniform float uCanvasAspect;
uniform float uProgress;
uniform float uZoom;
uniform float uWarp;
uniform float uChromatic;
varying vec2 vUv;

vec2 cover(vec2 uv) {
  if (uImageAspect > uCanvasAspect) {
    uv.x = (uv.x - 0.5) * uCanvasAspect / uImageAspect + 0.5;
  } else {
    uv.y = (uv.y - 0.5) * uImageAspect / uCanvasAspect + 0.5;
  }
  return uv;
}

void main() {
  float strength = uProgress;
  vec2 movement = (uPointer - vec2(0.5)) * vec2(uCanvasAspect, 1.0);
  vec2 direction = movement / max(length(movement), 0.2);

  vec2 baseUv = mix(vUv, vec2(0.5), uZoom * uProgress * 0.28);
  float band = sin(vUv.y * 24.0 + uPointer.x * 5.0);
  float fineBand = sin(vUv.y * 71.0 - uPointer.y * 4.0);
  baseUv.x += (band * 0.72 + fineBand * 0.28) * uWarp * strength * 0.16;
  baseUv.y += direction.y * uWarp * strength * 0.12;
  baseUv = cover(baseUv);

  vec2 split = direction * uChromatic * strength;
  split.x += band * uChromatic * strength * 0.35;
  float red = texture2D(uImage, clamp(baseUv + split, 0.0, 1.0)).r;
  float green = texture2D(uImage, clamp(baseUv, 0.0, 1.0)).g;
  float blue = texture2D(uImage, clamp(baseUv - split, 0.0, 1.0)).b;
  float alpha = texture2D(uImage, clamp(baseUv, 0.0, 1.0)).a;

  gl_FragColor = vec4(red, green, blue, alpha);
}
`;

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function approach(current: number, target: number, speed: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-speed * delta));
}

// How fast the warp swells in. Exponential, so most of the travel lands in the
// first tenth of a second — right for something that should arrive with the
// pointer.
const PROGRESS_RISE = 10;
// How fast it drains away in `cross` mode. Deliberately a third of the rise:
// at the same speed the tail stopped rather than faded, because an exponential
// leaving 1 starts at its steepest. Slower here buys a long, soft ramp-out
// without delaying the swell itself.
const PROGRESS_FALL = 3.2;

function parseColor(color: string): [number, number, number] {
  const value = color.startsWith("#") ? color.slice(1) : "111111";
  const hex = value.length === 3
    ? value
        .split("")
        .map((character) => character + character)
        .join("")
    : value;
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

export function ChromaticImage({
  src,
  alt,
  children,
  className,
  backgroundColor = "#111111",
  zoom = 0.2,
  displacement = 0.05,
  chromaticShift = 0.01,
  tilt = 0.3,
  pointerMode = "track",
}: ChromaticImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  // WebGL is only set up once the image nears the viewport. Every instance is
  // its own context, and compiling their shaders all at once on load was the
  // single longest main-thread stall on the page. Until then the plain <img>
  // below is what shows, which looks identical at rest.
  const [active, setActive] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || active) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { root: getScrollRoot(container), rootMargin: "200px 0px" },
    );
    io.observe(container);
    return () => io.disconnect();
  }, [active]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!active || !container || !canvas) return;

    setReady(false);
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const position = gl.getAttribLocation(program, "aPosition");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      image: gl.getUniformLocation(program, "uImage"),
      pointer: gl.getUniformLocation(program, "uPointer"),
      imageAspect: gl.getUniformLocation(program, "uImageAspect"),
      canvasAspect: gl.getUniformLocation(program, "uCanvasAspect"),
      progress: gl.getUniformLocation(program, "uProgress"),
      zoom: gl.getUniformLocation(program, "uZoom"),
      warp: gl.getUniformLocation(program, "uWarp"),
      chromatic: gl.getUniformLocation(program, "uChromatic"),
    };

    gl.uniform1i(uniforms.image, 0);
    gl.uniform1f(uniforms.zoom, zoom);
    gl.uniform1f(uniforms.warp, displacement);
    gl.uniform1f(uniforms.chromatic, chromaticShift);

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const [red, green, blue] = parseColor(backgroundColor);
    gl.clearColor(red, green, blue, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    const pointer = { x: 0.5, y: 0.5 };
    const pointerTarget = { x: 0.5, y: 0.5 };
    let progress = 0;
    let progressTarget = 0;
    let imageLoaded = false;
    let disposed = false;
    let frame = 0;
    let isRendering = false;
    let previousTime = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const renderWidth = Math.round(width * pixelRatio);
      const renderHeight = Math.round(height * pixelRatio);
      if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
        canvas.width = renderWidth;
        canvas.height = renderHeight;
        gl.viewport(0, 0, renderWidth, renderHeight);
      }
      gl.uniform1f(uniforms.canvasAspect, width / height);
    };

    const render = (time: number) => {
      if (disposed) return;
      const delta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      // Asymmetric only for the crossing sweep, where the fade-out is the whole
      // shape of the effect. `track` mode keeps its symmetric feel: there the
      // fall is a real pointer leaving, and a slow one lags behind the cursor.
      const fallSpeed = pointerMode === "cross" ? PROGRESS_FALL : PROGRESS_RISE;
      const progressSpeed = progressTarget > progress ? PROGRESS_RISE : fallSpeed;
      progress = approach(progress, progressTarget, progressSpeed, delta);
      pointer.x = approach(pointer.x, pointerTarget.x, 30, delta);
      pointer.y = approach(pointer.y, pointerTarget.y, 30, delta);

      gl.uniform1f(uniforms.progress, reduceMotion ? 0 : progress);
      gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (imageLoaded) gl.drawArrays(gl.TRIANGLES, 0, 3);

      const rotateX = reduceMotion ? 0 : (0.5 - pointer.y) * tilt * 18;
      const rotateY = reduceMotion ? 0 : (pointer.x - 0.5) * tilt * 18;
      canvas.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.025)`;

      const isSettled =
        Math.abs(progress - progressTarget) < 0.001 &&
        Math.abs(pointer.x - pointerTarget.x) < 0.001 &&
        Math.abs(pointer.y - pointerTarget.y) < 0.001;
      if (isSettled) {
        isRendering = false;
      } else {
        frame = requestAnimationFrame(render);
      }
    };

    const requestRender = () => {
      if (isRendering) return;
      isRendering = true;
      previousTime = performance.now();
      frame = requestAnimationFrame(render);
    };

    const updatePointer = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      pointerTarget.x = (event.clientX - bounds.left) / bounds.width;
      pointerTarget.y = 1 - (event.clientY - bounds.top) / bounds.height;
      progressTarget = 1;
      requestRender();
    };

    const resetPointer = () => {
      pointerTarget.x = 0.5;
      pointerTarget.y = 0.5;
      progressTarget = 0;
      requestRender();
    };

    // `cross` mode: one sweep per boundary crossing, then nothing.
    let pulseTimer = 0;

    const sweepFrom = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      // Snapped rather than eased, on both the live value and the target: the
      // warp is directional, and easing in from the previous crossing point
      // would aim the first frames of the sweep the wrong way.
      pointerTarget.x = pointer.x = (event.clientX - bounds.left) / bounds.width;
      pointerTarget.y = pointer.y = 1 - (event.clientY - bounds.top) / bounds.height;
      progressTarget = 1;
      requestRender();
      // Hand the target straight back to 0 so the effect falls away by itself.
      // The progress easing is slow enough that this reads as a swell, not a
      // flicker — and it means a pointer resting inside leaves no trace.
      window.clearTimeout(pulseTimer);
      pulseTimer = window.setTimeout(() => {
        progressTarget = 0;
        requestRender();
      }, 220);
    };

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
      gl.uniform1f(uniforms.imageAspect, image.naturalWidth / image.naturalHeight);
      imageLoaded = true;
      setReady(true);
      requestRender();
    };
    image.onerror = () => setReady(false);
    image.src = src;

    const resizeObserver = new ResizeObserver(() => {
      resize();
      requestRender();
    });
    resizeObserver.observe(container);
    if (pointerMode === "cross") {
      // No pointermove listener at all — that is the whole point of the mode.
      container.addEventListener("pointerenter", sweepFrom, { passive: true });
      container.addEventListener("pointerleave", sweepFrom, { passive: true });
    } else {
      container.addEventListener("pointermove", updatePointer, { passive: true });
      container.addEventListener("pointerleave", resetPointer, { passive: true });
    }
    resize();
    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(pulseTimer);
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", updatePointer);
      container.removeEventListener("pointerleave", resetPointer);
      container.removeEventListener("pointerenter", sweepFrom);
      container.removeEventListener("pointerleave", sweepFrom);
      canvas.style.transform = "";
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [active, backgroundColor, displacement, chromaticShift, pointerMode, src, tilt, zoom]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative isolate overflow-hidden bg-neutral-100 dark:bg-neutral-900",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-300",
          ready ? "opacity-0" : "opacity-100",
        )}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={cn(
          "absolute -inset-[2.5%] size-[105%] will-change-transform transition-opacity duration-300",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
      {children}
    </div>
  );
}
