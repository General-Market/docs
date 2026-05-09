// Single ThreeCanvas that holds BOTH the laptop and the phone — used by
// AntiCheatHook so the split-screen layout doesn't have to host two
// canvases. Two clones of the cached GLB scene, one with phone hidden
// (laptop instance) and one with laptop hidden (phone instance), plus
// per-mesh broll textures. The screen mesh fingerprint trick is shared
// with DeviceBroll.

import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  Sequence,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useRemotionEnvironment,
} from "remotion";
import {
  ThreeCanvas,
  useOffthreadVideoTexture,
} from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { beatPulseScene } from "./beats";

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.opt.glb");
useGLTF.preload(MODEL_URL);

// ── Laptop / phone constants pulled from DeviceBroll so this component
//    is self-contained.
// Phone base scale dialed back ≈20% (was 34) so it reads less "in
// front of" the laptop and gives the trading chart room to breathe.
const PHONE_BASE_SCALE = 27;
const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const LID_CLOSED = new THREE.Quaternion(0, 0, 0, 1);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

const LAPTOP_SCREEN_ASPECT = 16 / 10;

// World layout. Laptop sits at GLB origin natively; we wrap the whole
// GLB clone in a Three group translated by LAPTOP_GROUP_OFFSET so the
// laptop slides ~40% of canvas-width canvas-right while the camera
// frame stays put (which keeps lighting and shadows undisturbed).
// PHONE_POS is the phone's intended *world* position; iphone.position
// is set to PHONE_POS minus the group offset so the phone ends up at
// the same world spot regardless of the laptop shift.
//
// −0.71 nudge on PHONE_POS.x bumps the phone ≈8% canvas-left from the
// previous pass.
const LAPTOP_GROUP_OFFSET: [number, number, number] = [-3.56, 0, 0];
const PHONE_POS = new THREE.Vector3(-4.79, 2.9, 0);

// Camera between the two devices, looking forward into +z. Lower y
// than the previous pass so the laptop body climbs back up the frame.
const CAMERA_POS: [number, number, number] = [-1.5, 3.9, -7];
const CAMERA_TARGET: [number, number, number] = [-1.5, 2.9, 0];

// Subtle yaw drift over the first 7 seconds — the phone slowly turns
// further toward canvas-center while the hook plays, just enough that
// the brain registers movement without reading as overt animation.
const PHONE_YAW_DRIFT_END = 210; // 7s at 30fps
const PHONE_YAW_DRIFT_AMOUNT = -0.09; // ≈ -5°, more negative = toward center

// Camera zoom — applied via three.js camera.zoom, so only the 3D
// devices scale; text overlays stay put. Hard zoom-in to a 1.30
// framing by frame 60, then a slow drift to ~1.39 by scene end. The
// phone has its own gentler curve and is counter-scaled on the mesh.
const ZOOM_IN_END = 60;
const SETTLED_ZOOM = 1.3;
const LAPTOP_INITIAL_ZOOM = 1.45;
const LAPTOP_END_ZOOM = SETTLED_ZOOM * 1.07; // ≈ 1.39
const PHONE_INITIAL_ZOOM = 1.2;
const PHONE_END_ZOOM = SETTLED_ZOOM * 1.02; // ≈ 1.33
const HOOK_DURATION_FRAMES = 254;

// Phone faces the *view plane*, not the camera position. Pointing the
// phone at the camera position made it tilt up to meet the camera's
// y-offset, which read as a backward lean. Aligning its screen normal
// with -camera_forward instead makes the phone parallel to the view
// plane — perfectly rectangular under projection regardless of
// horizontal offset.
const CAMERA_FORWARD = new THREE.Vector3(...CAMERA_TARGET)
  .sub(new THREE.Vector3(...CAMERA_POS))
  .normalize();
const PHONE_LOOK_TARGET = new THREE.Vector3()
  .copy(PHONE_POS)
  .addScaledVector(CAMERA_FORWARD, 50);

// Closing-act animation — the lid slams shut while the phone whirls
// off-frame to the right. 7.28s = frame 218 at 30fps.
const LID_CLOSE_START = 218;
const LID_CLOSE_END = 232;
const PHONE_SPIN_START = 218;
const PHONE_SPIN_END = 234;
const PHONE_SPIN_REVOLUTIONS = 2.25;
const PHONE_SLIDE_OFFSET = -4.5; // extra world-x push during the spin

// Both screens are lit from frame 0 — the trading chart and the
// cheat broll read from the very first frame, no wake-up animation.

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

// ── Mesh identification (lifted from DeviceBroll). ───────────────────────────

function findPhoneScreenMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((child) => {
    if (found) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) return;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (mat && mat.emissiveMap && !mat.map) {
      mesh.material = mat.clone();
      found = mesh;
    }
  });
  return found;
}

function findLaptopScreenMesh(lidRoot: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  lidRoot.traverse((child) => {
    if (found) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) return;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (mat && mat.map) {
      mesh.material = mat.clone();
      found = mesh;
    }
  });
  return found;
}

// ── Texture binding helpers. ─────────────────────────────────────────────────

function applyCoverFitUV(
  texture: THREE.Texture,
  videoAspect: number,
  screenAspect: number,
) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (videoAspect > screenAspect) {
    const r = screenAspect / videoAspect;
    texture.repeat.set(r, 1);
    texture.offset.set((1 - r) / 2, 0);
  } else {
    const r = videoAspect / screenAspect;
    texture.repeat.set(1, r);
    texture.offset.set(0, (1 - r) / 2);
  }
}

function bindTexture(
  mesh: THREE.Mesh,
  texture: THREE.Texture,
  emissiveIntensity: number,
  brightness: number,
) {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  const alreadyBound = mat.map === texture && mat.emissiveMap === texture;
  if (!alreadyBound) {
    mat.map = texture;
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveMap = texture;
    mat.needsUpdate = true;
  }
  // Brightness multiplier runs every frame so the screens can fade up
  // from black at the start of the scene.
  mat.color = new THREE.Color(brightness, brightness, brightness);
  mat.emissiveIntensity = emissiveIntensity * brightness;
}

function coverDrawToCanvas(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
) {
  const srcA = srcW / srcH;
  const dstA = dstW / dstH;
  let sx = 0,
    sy = 0,
    sw = srcW,
    sh = srcH;
  if (srcA > dstA) {
    const cropW = srcH * dstA;
    sx = (srcW - cropW) / 2;
    sw = cropW;
  } else {
    const cropH = srcW / dstA;
    sy = (srcH - cropH) / 2;
    sh = cropH;
  }
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dstW, dstH);
}

// ── Screen binding components. ───────────────────────────────────────────────

const RenderedScreen: React.FC<{
  mesh: THREE.Mesh | null;
  broll: string;
  brollAspect: number;
  screenAspect: number;
  emissiveIntensity: number;
  brightness: number;
}> = ({ mesh, broll, brollAspect, screenAspect, emissiveIntensity, brightness }) => {
  const texture = useOffthreadVideoTexture({ src: broll });
  if (mesh && texture) {
    applyCoverFitUV(texture, brollAspect, screenAspect);
    bindTexture(mesh, texture, emissiveIntensity, brightness);
  }
  return null;
};

const PreviewScreen: React.FC<{
  mesh: THREE.Mesh | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasW: number;
  canvasH: number;
  emissiveIntensity: number;
  brightness: number;
  frame: number;
}> = ({ mesh, videoRef, canvasW, canvasH, emissiveIntensity, brightness, frame }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  if (!canvasRef.current) {
    const c = document.createElement("canvas");
    c.width = canvasW;
    c.height = canvasH;
    const ctx0 = c.getContext("2d");
    if (ctx0) {
      ctx0.fillStyle = "#000";
      ctx0.fillRect(0, 0, canvasW, canvasH);
    }
    canvasRef.current = c;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;
  }

  useEffect(() => {
    if (!mesh || !textureRef.current) return;
    bindTexture(mesh, textureRef.current, emissiveIntensity, brightness);
  }, [mesh, emissiveIntensity, brightness]);

  const ctx = canvasRef.current.getContext("2d");
  const video = videoRef.current;
  if (ctx && video && video.readyState >= 2 && video.videoWidth > 0) {
    coverDrawToCanvas(
      ctx,
      video,
      video.videoWidth,
      video.videoHeight,
      canvasW,
      canvasH,
    );
    if (textureRef.current) textureRef.current.needsUpdate = true;
  }
  void frame;
  return null;
};

// ── Phone chart — hand-drawn candlesticks. ─────────────────────────────────
// Replaces the old phone broll video, which jittered frame-to-frame in a
// way no real chart does. Light bg + Base-blue dot grid match the visual
// language of the rest of the film. Pre-baked OHLC sequence with a deep
// dump at index 11; the y-axis auto-fits the visible window and lerps
// between candle-aligned states so the rescale never twitches. Each new
// candle slides in from the right edge over CANDLE_PERIOD frames.

type Candle = { o: number; h: number; l: number; c: number };

const CHART_CANDLES: Candle[] = [
  { o: 100.0, h: 101.5, l: 99.4, c: 101.0 },
  { o: 101.0, h: 102.1, l: 100.2, c: 100.7 },
  { o: 100.7, h: 101.8, l: 100.1, c: 101.6 },
  { o: 101.6, h: 102.8, l: 101.2, c: 102.4 },
  { o: 102.4, h: 102.7, l: 100.9, c: 101.1 },
  { o: 101.1, h: 102.0, l: 100.4, c: 101.8 },
  { o: 101.8, h: 102.5, l: 101.4, c: 101.6 },
  { o: 101.6, h: 102.2, l: 100.5, c: 100.8 },
  { o: 100.8, h: 101.4, l: 100.1, c: 101.0 },
  { o: 101.0, h: 101.6, l: 100.2, c: 100.4 },
  { o: 100.4, h: 100.6, l: 97.8, c: 98.2 }, // first crack
  { o: 98.2, h: 98.8, l: 90.6, c: 91.2 }, // BIG DUMP
  { o: 91.2, h: 93.4, l: 90.1, c: 92.9 },
  { o: 92.9, h: 95.0, l: 92.4, c: 94.6 },
  { o: 94.6, h: 95.4, l: 93.6, c: 93.9 },
  { o: 93.9, h: 95.0, l: 93.2, c: 94.8 },
  { o: 94.8, h: 96.4, l: 94.5, c: 96.1 },
];

const CHART_VISIBLE = 9;
const CANDLE_PERIOD = 16; // frames per new candle — ~0.53s
const CHART_W = 720;
const CHART_H = 1560;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function chartRange(start: number, end: number) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = start; i < end; i++) {
    if (i < 0 || i >= CHART_CANDLES.length) continue;
    const c = CHART_CANDLES[i];
    if (c.l < lo) lo = c.l;
    if (c.h > hi) hi = c.h;
  }
  if (!isFinite(lo)) {
    lo = CHART_CANDLES[0].l;
    hi = CHART_CANDLES[0].h;
  }
  return { lo, hi };
}

function drawDotGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const spacing = 24;
  ctx.fillStyle = "rgba(0, 82, 255, 0.18)";
  for (let y = spacing / 2; y < h; y += spacing) {
    for (let x = spacing / 2; x < w; x += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPhoneChart(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
) {
  // Background — light field that matches the rest of the film.
  ctx.fillStyle = "#F0F2F4";
  ctx.fillRect(0, 0, w, h);
  drawDotGrid(ctx, w, h);

  const t = frame / CANDLE_PERIOD;
  const newest = Math.min(Math.floor(t), CHART_CANDLES.length - 1);
  const slide = Math.min(1, Math.max(0, t - newest));

  // Y-range auto-fit, smoothed by lerping between window-N and
  // window-(N+1) so the rescale during the dump animates rather than
  // snaps. With slide running 0→1 over CANDLE_PERIOD, the chart
  // squeezes vertically *as* the new candle slides in.
  const a = chartRange(newest - CHART_VISIBLE + 1, newest + 1);
  const b = chartRange(newest - CHART_VISIBLE + 2, newest + 2);
  const lo = lerp(a.lo, b.lo, slide);
  const hi = lerp(a.hi, b.hi, slide);
  const pad = (hi - lo) * 0.12;
  const yMin = lo - pad;
  const yMax = hi + pad;

  // Header
  ctx.fillStyle = "#0A0A0A";
  ctx.font = "600 56px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("BTC", 40, 110);
  const last =
    CHART_CANDLES[Math.min(newest, CHART_CANDLES.length - 1)].c;
  const prev =
    newest > 0
      ? CHART_CANDLES[newest - 1].c
      : CHART_CANDLES[0].o;
  const isUp = last >= prev;
  ctx.fillStyle = isUp ? "#0052FF" : "#E03B4A";
  ctx.font = "700 64px ui-monospace, SFMono-Regular, monospace";
  ctx.textAlign = "right";
  ctx.fillText(last.toFixed(2), w - 40, 110);

  // Chart area
  const chartTop = 200;
  const chartBottom = h - 220;
  const chartLeft = 40;
  const chartRight = w - 40;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;
  const slotW = chartW / CHART_VISIBLE;
  const candleW = slotW * 0.62;
  const priceToY = (p: number) =>
    chartTop + (1 - (p - yMin) / (yMax - yMin)) * chartH;

  // Faint baseline at the first visible candle's open — gives the eye
  // an anchor without clutter.
  const baselineIdx = Math.max(0, newest - CHART_VISIBLE + 1);
  const baselineY = priceToY(CHART_CANDLES[baselineIdx].o);
  ctx.strokeStyle = "rgba(10, 10, 12, 0.10)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(chartLeft, baselineY);
  ctx.lineTo(chartRight, baselineY);
  ctx.stroke();

  // Candles. Each slot 0..VISIBLE-1 holds candle (newest - VISIBLE + 1 + slot).
  // The whole row shifts left by `slide * slotW` so the newest candle
  // enters from the right and the oldest exits left in lockstep.
  for (let s = 0; s < CHART_VISIBLE + 1; s++) {
    const idx = newest - CHART_VISIBLE + 1 + s;
    if (idx < 0 || idx >= CHART_CANDLES.length) continue;
    const c = CHART_CANDLES[idx];
    const x = chartLeft + (s - slide + 0.5) * slotW;
    if (x < chartLeft - candleW || x > chartRight + candleW) continue;

    const yO = priceToY(c.o);
    const yC = priceToY(c.c);
    const yH = priceToY(c.h);
    const yL = priceToY(c.l);
    const isGreen = c.c >= c.o;
    const color = isGreen ? "#0052FF" : "#E03B4A";

    // Wick
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, yH);
    ctx.lineTo(x, yL);
    ctx.stroke();

    // Body
    const bodyTop = Math.min(yO, yC);
    const bodyH = Math.max(2, Math.abs(yC - yO));
    ctx.fillStyle = color;
    ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
  }

  // Footer ticker — current change %
  const changePct = ((last - CHART_CANDLES[0].o) / CHART_CANDLES[0].o) * 100;
  ctx.fillStyle = changePct >= 0 ? "#0052FF" : "#E03B4A";
  ctx.font = "600 40px ui-monospace, SFMono-Regular, monospace";
  ctx.textAlign = "left";
  ctx.fillText(
    `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`,
    40,
    h - 80,
  );
}

const PhoneChart: React.FC<{
  mesh: THREE.Mesh | null;
  emissiveIntensity: number;
  brightness: number;
  frame: number;
}> = ({ mesh, emissiveIntensity, brightness, frame }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  if (!canvasRef.current) {
    const c = document.createElement("canvas");
    c.width = CHART_W;
    c.height = CHART_H;
    canvasRef.current = c;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;
  }

  useEffect(() => {
    if (!mesh || !textureRef.current) return;
    bindTexture(mesh, textureRef.current, emissiveIntensity, brightness);
  }, [mesh, emissiveIntensity, brightness]);

  const ctx = canvasRef.current.getContext("2d");
  if (ctx) {
    drawPhoneChart(ctx, CHART_W, CHART_H, frame);
    if (textureRef.current) textureRef.current.needsUpdate = true;
  }

  return null;
};

// ── Main scene ───────────────────────────────────────────────────────────────

export type BrollSegment = {
  url: string;
  from: number;
  durationInFrames: number;
  startFrom: number;
};

const Scene: React.FC<{
  laptopSegments: BrollSegment[];
  laptopBrollAspect: number;
  laptopVideoRef: React.RefObject<HTMLVideoElement | null>;
  emissiveIntensity: number;
  lightingIntensity: number;
  frame: number;
}> = ({
  laptopSegments,
  laptopBrollAspect,
  laptopVideoRef,
  emissiveIntensity,
  lightingIntensity,
  frame,
}) => {
  const { camera: threeCam } = useThree();
  const gltf = useGLTF(MODEL_URL);
  const env = useRemotionEnvironment();

  // One clone for the whole scene — the GLB already contains both the
  // laptop and the iphone. We don't hide either; we just position them
  // and bind separate broll textures to each screen.
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf]);

  const laptopScreen = useMemo(() => {
    const bevels = sceneClone.getObjectByName("Bevels_2");
    return bevels ? findLaptopScreenMesh(bevels) : null;
  }, [sceneClone]);

  const phoneScreen = useMemo(() => {
    const iphone = sceneClone.getObjectByName("iphone");
    return iphone ? findPhoneScreenMesh(iphone) : null;
  }, [sceneClone]);

  // Pose. Lid opens by default; closes hard at LID_CLOSE_START. Phone
  // sits in its hero pose; at PHONE_SPIN_START it whirls to the right
  // and translates further off-frame so it leaves the canvas as the
  // scene exits.
  const lidT = clamp01(
    (frame - LID_CLOSE_START) / (LID_CLOSE_END - LID_CLOSE_START),
  );
  // Ease-in cubic — the lid loiters open then snaps shut.
  const lidEased = lidT * lidT * lidT;
  const lidQuat = new THREE.Quaternion().slerpQuaternions(
    LID_OPEN,
    LID_CLOSED,
    lidEased,
  );

  const bevels = sceneClone.getObjectByName("Bevels_2");
  if (bevels) {
    bevels.position.copy(BEVELS_POS);
    bevels.quaternion.copy(lidQuat);
    bevels.scale.copy(BEVELS_SCALE);
  }

  const spinT = clamp01(
    (frame - PHONE_SPIN_START) / (PHONE_SPIN_END - PHONE_SPIN_START),
  );
  // Ease-in cubic on the spin too — it snaps loose like a hand flick.
  const spinEased = spinT * spinT;
  const phoneRotY = spinEased * Math.PI * 2 * PHONE_SPIN_REVOLUTIONS;
  const phoneSlideX = spinEased * PHONE_SLIDE_OFFSET;
  // Pre-spin yaw drift — sine ease so the motion is invisibly continuous,
  // not linearly mechanical. Caps at PHONE_YAW_DRIFT_END (7s).
  const driftT = clamp01(frame / PHONE_YAW_DRIFT_END);
  const driftEased = (1 - Math.cos(driftT * Math.PI)) * 0.5;

  // Per-device zoom curves. camera.zoom drives the laptop curve so
  // the entire 3D scene grows proportionally; the phone gets a
  // counter-scale so its effective zoom follows its own (gentler)
  // curve regardless of the camera.
  const laptopZoomBase =
    frame < ZOOM_IN_END
      ? interpolate(frame, [0, ZOOM_IN_END], [LAPTOP_INITIAL_ZOOM, SETTLED_ZOOM], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(
          frame,
          [ZOOM_IN_END, HOOK_DURATION_FRAMES],
          [SETTLED_ZOOM, LAPTOP_END_ZOOM],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
  const phoneZoomBase =
    frame < ZOOM_IN_END
      ? interpolate(frame, [0, ZOOM_IN_END], [PHONE_INITIAL_ZOOM, SETTLED_ZOOM], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(
          frame,
          [ZOOM_IN_END, HOOK_DURATION_FRAMES],
          [SETTLED_ZOOM, PHONE_END_ZOOM],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

  // Beat-driven warping. Base curves above set the macro framing;
  // every Hook kick adds a *whisper* of forward push and a hairline
  // yaw nudge — enough that the cameras feel alive on the rhythm,
  // not enough that anyone notices the rhythm. Linear attack/decay,
  // wider window so the breath overlaps between beats. Damped after
  // the closing spin so the lid-slam isn't competing with kicks.
  const exitDamp = 1 - clamp01((frame - PHONE_SPIN_START + 8) / 12);
  const beatKick = beatPulseScene(frame, "Hook", 4, 26) * exitDamp;

  const laptopZoom = laptopZoomBase + beatKick * 0.010;
  const phoneZoom = phoneZoomBase + beatKick * 0.007;
  const phoneZoomCorrection = phoneZoom / laptopZoom;

  // Phone yaw: existing slow drift + per-beat micro-turn toward
  // canvas-center (≈ -0.3°). Just enough to register as movement.
  const yawKick = beatKick * -0.005;
  const yawDrift = PHONE_YAW_DRIFT_AMOUNT * driftEased + yawKick;

  const iphone = sceneClone.getObjectByName("iphone");
  if (iphone) {
    // Counter-translate against LAPTOP_GROUP_OFFSET so the phone ends
    // up at world PHONE_POS regardless of the laptop's group shift.
    iphone.position.set(
      PHONE_POS.x - LAPTOP_GROUP_OFFSET[0],
      PHONE_POS.y - LAPTOP_GROUP_OFFSET[1],
      PHONE_POS.z - LAPTOP_GROUP_OFFSET[2],
    );
    iphone.position.x += phoneSlideX;
    iphone.scale.setScalar(PHONE_BASE_SCALE * phoneZoomCorrection);
    // lookAt aligns the object's local -Z with the camera. This GLB
    // has the screen on local +Z (the back is on -Z), so naive lookAt
    // shows the apple logo. Add π to the local-Y rotation to flip the
    // phone front-to-back so the screen faces the camera, then layer
    // the drift and the exit spin on top.
    // After lookAt(PHONE_LOOK_TARGET), local -Z aligns with camera-
    // forward, which means local +Z (the GLB's screen face) already
    // points back at the viewer — no π flip needed here. Drift + spin
    // compose around the phone's own Y axis.
    iphone.lookAt(PHONE_LOOK_TARGET);
    iphone.rotateY(yawDrift + phoneRotY);
  }

  // Screen brightness. Both screens lit from frame 0 — the trading
  // chart and the cheat broll read immediately.
  const phoneBrightness = 1;
  const laptopBrightness = 1;

  // Camera. zoom carries the laptop zoom curve — only the 3D devices
  // grow with it, the text overlays in the parent stay put.
  const perspCam = threeCam as THREE.PerspectiveCamera;
  perspCam.position.set(...CAMERA_POS);
  perspCam.lookAt(...CAMERA_TARGET);
  perspCam.fov = 50;
  perspCam.zoom = laptopZoom;
  perspCam.updateProjectionMatrix();

  return (
    <>
      <group position={LAPTOP_GROUP_OFFSET}>
        <primitive object={sceneClone} />
      </group>
      <React.Suspense fallback={null}>
        {env.isRendering
          ? laptopSegments.map((seg, i) => (
              <Sequence
                key={`l-${i}`}
                from={seg.from - seg.startFrom}
                durationInFrames={seg.durationInFrames + seg.startFrom}
                layout="none"
              >
                <RenderedScreen
                  mesh={laptopScreen}
                  broll={seg.url}
                  brollAspect={laptopBrollAspect}
                  screenAspect={LAPTOP_SCREEN_ASPECT}
                  emissiveIntensity={emissiveIntensity}
                  brightness={laptopBrightness}
                />
              </Sequence>
            ))
          : (
            <PreviewScreen
              mesh={laptopScreen}
              videoRef={laptopVideoRef}
              canvasW={1280}
              canvasH={800}
              emissiveIntensity={emissiveIntensity}
              brightness={laptopBrightness}
              frame={frame}
            />
          )}
        {/* Phone screen draws a hand-rendered candle chart instead of a
         * broll video — fixes the per-frame jitter the source had. */}
        <PhoneChart
          mesh={phoneScreen}
          emissiveIntensity={emissiveIntensity}
          brightness={phoneBrightness}
          frame={frame}
        />
      </React.Suspense>
      {/* Apartment preset is warmer + softer than studio. Combined with
          a gentler key light and a lower exposure pass, the screens
          stop reading as a CRT glare. */}
      <Environment preset="apartment" environmentIntensity={1.4 * lightingIntensity} />
      <ambientLight intensity={0.45 * lightingIntensity} />
      <directionalLight
        position={[5, 8, -5]}
        intensity={1.6 * lightingIntensity}
        castShadow
      />
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.45}
        scale={14}
        blur={1.8}
        far={5}
      />
    </>
  );
};

// ── Wrapper ──────────────────────────────────────────────────────────────────

export type AntiCheatSceneProps = {
  laptopSegments: BrollSegment[];
  laptopBrollAspect?: number;
  width?: number;
  height?: number;
  emissiveIntensity?: number;
  lightingIntensity?: number;
};

const PreviewVideo: React.FC<{
  segment: BrollSegment;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}> = ({ segment, videoRef }) => (
  <Sequence
    from={segment.from - segment.startFrom}
    durationInFrames={segment.durationInFrames + segment.startFrom}
    layout="none"
  >
    <Video
      ref={videoRef}
      src={segment.url}
      muted
      loop
      playsInline
      preload="auto"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
      }}
    />
  </Sequence>
);

export const AntiCheatHookScene: React.FC<AntiCheatSceneProps> = ({
  laptopSegments,
  laptopBrollAspect = 16 / 9,
  width = 1920,
  height = 1080,
  emissiveIntensity = 1.6,
  lightingIntensity = 0.85,
}) => {
  const frame = useCurrentFrame();
  const laptopVideoRef = useRef<HTMLVideoElement | null>(null);
  const env = useRemotionEnvironment();

  return (
    <AbsoluteFill style={{ width, height, background: "#0a0a0a" }}>
      {!env.isRendering && (
        <>
          {laptopSegments.map((seg, i) => (
            <PreviewVideo
              key={`l-${i}`}
              segment={seg}
              videoRef={laptopVideoRef}
            />
          ))}
        </>
      )}
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 50,
          near: 0.5,
          far: 1000,
          position: CAMERA_POS,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
        }}
        style={{ background: "transparent" }}
      >
        <React.Suspense fallback={null}>
          <Scene
            laptopSegments={laptopSegments}
            laptopBrollAspect={laptopBrollAspect}
            laptopVideoRef={laptopVideoRef}
            emissiveIntensity={emissiveIntensity}
            lightingIntensity={lightingIntensity}
            frame={frame}
          />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
