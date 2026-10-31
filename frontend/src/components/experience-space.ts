import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/*
 * The space behind the experience fly-through: a starfield, a few nebula
 * clouds and a spaceship looping around the view.
 *
 * Drawn in the same world as the CSS cards (1 unit = 1 CSS px, y flipped) and
 * through a camera matched to the CSS one (perspective 1000px), so the stars
 * and the ship sit at real depths among the cards and move with every flight.
 *
 * Loaded on demand from ExperienceDepth, so Three.js stays in its own chunk.
 */

/** Drop a GLB here to replace the built-in placeholder ship. */
const SHIP = {
  url: '/models/spaceship.glb',
  /** Length of the ship's longest side, in world px. */
  length: 150,
  /** Extra rotation applied to the model so its nose points down -Z. */
  rotation: new THREE.Euler(0, Math.PI, 0)
};

const STAR_COUNT = 2600;
const NEBULAE = 7;
const TRAIL_POINTS = 70;

export interface SpaceCamera {
  x: number;
  y: number;
  z: number;
  ry: number;
}

export interface SpaceScene {
  /** Where the CSS camera is; read every frame. */
  setCamera(cam: SpaceCamera): void;
  /** Lays the world out along the cards' z range. */
  setBounds(zNear: number, zFar: number): void;
  setAccent(hex: string): void;
  setRunning(running: boolean): void;
  /** Resolves once shaders are compiled and the model (if any) is in. */
  ready: Promise<void>;
  dispose(): void;
}

const DEG = Math.PI / 180;
const rand = (i: number) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Soft round sprite, used for stars and nebulae alike. */
function makeGlowTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A low-poly ship built from primitives, for until a real model is dropped in. */
function makePlaceholderShip(accent: THREE.Color) {
  const ship = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xdfe8ef, metalness: 0.6, roughness: 0.35, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2229, metalness: 0.4, roughness: 0.5, flatShading: true });

  const body = new THREE.Mesh(new THREE.ConeGeometry(14, 110, 6), hull);
  body.rotation.x = -Math.PI / 2; // nose down -Z
  ship.add(body);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(9, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), dark);
  cockpit.scale.set(1, 0.7, 2.2);
  cockpit.position.set(0, 7, -8);
  ship.add(cockpit);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(62, 26);
  wingShape.lineTo(62, 38);
  wingShape.lineTo(0, 30);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 3, bevelEnabled: false });
  [-1, 1].forEach(side => {
    const wing = new THREE.Mesh(wingGeo, hull);
    wing.rotation.x = Math.PI / 2;
    wing.scale.x = side;
    wing.position.set(0, 0, -2);
    ship.add(wing);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(2, 18, 22), dark);
    fin.position.set(side * 60, 6, 32);
    ship.add(fin);
  });

  const engine = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 10, 8), dark);
  engine.rotation.x = Math.PI / 2;
  engine.position.z = 56;
  ship.add(engine);

  const glow = new THREE.PointLight(accent, 2.5, 600, 1.6);
  glow.position.z = 70;
  ship.add(glow);
  return ship;
}

/** Scales and orients a loaded model so it matches SHIP. */
function fitModel(model: THREE.Object3D) {
  const wrap = new THREE.Group();
  model.rotation.copy(SHIP.rotation);
  wrap.add(model);
  const box = new THREE.Box3().setFromObject(wrap);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  wrap.scale.setScalar(SHIP.length / Math.max(size.x, size.y, size.z, 1e-3));
  return wrap;
}

/**
 * @param initialAccent the light colour: nebulae, rim light, trail, engine glow
 * @param ink the void, which the fog also fades into
 */
export function createSpaceScene(canvas: HTMLCanvasElement, initialAccent: string, ink = '#000000'): SpaceScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(ink, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(ink, 2500, 9000);
  const camera = new THREE.PerspectiveCamera(50, 1, 10, 20000);

  const accent = new THREE.Color(initialAccent);
  const accentTarget = accent.clone();
  const glowTex = makeGlowTexture();

  /* ---------- lights ---------- */
  scene.add(new THREE.AmbientLight(0x8899aa, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1, 1.2, 0.8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(accent, 1.6);
  rim.position.set(-1, -0.4, -1);
  scene.add(rim);

  /* ---------- stars: a tube around the flight path ---------- */
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(STAR_COUNT * 3);
  const starCol = new Float32Array(STAR_COUNT * 3);
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const starMat = new THREE.PointsMaterial({
    size: 7,
    map: glowTex,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  /* ---------- nebulae: big additive sprites tinted by the accent ---------- */
  const nebulae: THREE.Sprite[] = [];
  for (let i = 0; i < NEBULAE; i++) {
    const mat = new THREE.SpriteMaterial({
      map: glowTex,
      color: accent.clone(),
      transparent: true,
      // Faint: a haze in the ink, not a colourful cloud.
      opacity: 0.07 + rand(i + 300) * 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    });
    const sprite = new THREE.Sprite(mat);
    nebulae.push(sprite);
    scene.add(sprite);
  }

  function setBounds(zNear: number, zFar: number) {
    const span = zNear - zFar;
    for (let i = 0; i < STAR_COUNT; i++) {
      // Kept off the flight line, so stars stream past rather than through
      // the cards being read.
      const a = rand(i) * Math.PI * 2;
      const r = 700 + rand(i + 1e4) * 3200;
      starPos[i * 3] = Math.cos(a) * r;
      starPos[i * 3 + 1] = Math.sin(a) * r * 0.7;
      starPos[i * 3 + 2] = zNear + 1500 - rand(i + 2e4) * (span + 6000);
      // Monochrome: brightness varies, hue doesn't — a cool grey-blue, the
      // site's #9aa6ad brightened towards its #F5FAFF paper.
      const b = 0.45 + rand(i + 4e4) * 0.55;
      starCol[i * 3] = b * 0.86;
      starCol[i * 3 + 1] = b * 0.92;
      starCol[i * 3 + 2] = b;
    }
    starGeo.attributes.position.needsUpdate = true;
    starGeo.attributes.color.needsUpdate = true;

    nebulae.forEach((s, i) => {
      const a = rand(i + 100) * Math.PI * 2;
      const r = 1800 + rand(i + 110) * 1800;
      s.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.6, zNear - (span + 3000) * ((i + 0.5) / NEBULAE));
      s.scale.setScalar(2600 + rand(i + 120) * 2600);
    });
  }
  setBounds(2000, -6000);

  /* ---------- ship + engine trail ---------- */
  const shipRoot = new THREE.Group();
  scene.add(shipRoot);
  let ship: THREE.Object3D = makePlaceholderShip(accent);
  shipRoot.add(ship);

  const flame = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, color: accent.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  flame.scale.setScalar(70);
  flame.position.z = SHIP.length * 0.45;
  shipRoot.add(flame);

  const trailPos = new Float32Array(TRAIL_POINTS * 3);
  const trailCol = new Float32Array(TRAIL_POINTS * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Line(
    trailGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  trail.frustumCulled = false;
  scene.add(trail);
  let trailPrimed = false;

  const modelLoaded = new GLTFLoader()
    .loadAsync(SHIP.url)
    .then(gltf => {
      shipRoot.remove(ship);
      ship = fitModel(gltf.scene);
      shipRoot.add(ship);
    })
    // No model yet: the placeholder stays.
    .catch(() => {});

  /* ---------- camera sync ---------- */
  const cssCam: SpaceCamera = { x: 0, y: 0, z: 0, ry: 0 };
  let width = 1;
  let height = 1;

  function resize() {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // CSS perspective: 1000px of focal length, so the vertical field of view
    // is whatever spans the viewport's height at that distance.
    camera.fov = (2 * Math.atan(height / 2 / 1000)) / DEG;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  function placeCamera() {
    camera.position.set(cssCam.x, -cssCam.y, cssCam.z);
    camera.rotation.set(0, cssCam.ry * DEG, 0);
    camera.updateMatrixWorld();
  }

  /* ---------- the ship's loop ---------- */
  const local = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const prevPos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const prevVel = new THREE.Vector3();
  const up = new THREE.Vector3();
  const look = new THREE.Matrix4();
  let bank = 0;

  // A figure-of-eight around the view, ahead of the camera, sized from what is
  // visible at that depth so the loop stays on screen at any aspect ratio.
  function loopPoint(t: number, out: THREE.Vector3) {
    const depth = 950 + Math.sin(t * 0.5) * 350;
    const halfW = (width / 2) * (depth / 1000);
    const halfH = (height / 2) * (depth / 1000);
    out.set(Math.sin(t) * halfW * 0.78, Math.sin(t * 2) * halfH * 0.42 + halfH * 0.08, -depth);
    return out.applyMatrix4(camera.matrixWorld);
  }

  function updateShip(time: number, dt: number) {
    const t = time * 0.32;
    loopPoint(t, local);
    loopPoint(t + 0.05, ahead);
    shipRoot.position.copy(local);

    vel.subVectors(local, prevPos).divideScalar(Math.max(dt, 1e-3));
    // Bank into the turn: how hard the heading swings sideways.
    const turn = prevVel.lengthSq() > 0 ? prevVel.clone().normalize().cross(vel.clone().normalize()).y : 0;
    bank += (THREE.MathUtils.clamp(-turn * 40, -1.1, 1.1) - bank) * Math.min(1, dt * 3);
    prevVel.copy(vel);
    prevPos.copy(local);

    up.set(0, 1, 0);
    look.lookAt(local, ahead, up);
    shipRoot.quaternion.setFromRotationMatrix(look);
    shipRoot.rotateZ(bank);

    flame.material.opacity = 0.65 + Math.sin(time * 30) * 0.15;

    // The trail: the last positions, fading out towards the tail.
    if (!trailPrimed) {
      for (let i = 0; i < TRAIL_POINTS; i++) local.toArray(trailPos, i * 3);
      trailPrimed = true;
    }
    trailPos.copyWithin(3, 0, (TRAIL_POINTS - 1) * 3);
    const tail = new THREE.Vector3(0, 0, SHIP.length * 0.45).applyQuaternion(shipRoot.quaternion).add(local);
    tail.toArray(trailPos, 0);
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const f = (1 - i / TRAIL_POINTS) ** 2;
      trailCol[i * 3] = accent.r * f;
      trailCol[i * 3 + 1] = accent.g * f;
      trailCol[i * 3 + 2] = accent.b * f;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
  }

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  let raf = 0;
  let running = false;

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    accent.lerp(accentTarget, Math.min(1, dt * 2.5));
    rim.color.copy(accent);
    nebulae.forEach(s => s.material.color.copy(accent));
    flame.material.color.copy(accent);
    placeCamera();
    updateShip(time, dt);
    renderer.render(scene, camera);
  }

  function setRunning(next: boolean) {
    if (next === running) return;
    running = next;
    if (running) {
      clock.getDelta();
      frame();
    } else cancelAnimationFrame(raf);
  }

  // Compile everything up front, so the first frame on screen doesn't hitch.
  const ready = modelLoaded.then(() => {
    placeCamera();
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
  });

  return {
    setCamera(cam) {
      Object.assign(cssCam, cam);
    },
    setBounds,
    setAccent(hex) {
      accentTarget.set(hex);
    },
    setRunning,
    ready,
    dispose() {
      setRunning(false);
      ro.disconnect();
      scene.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach(m => m.dispose());
      });
      glowTex.dispose();
      renderer.dispose();
    }
  };
}
