/**
 * MacbookWithScreen — 3D MacBook with screen texture replaced.
 *
 * Finds the textured screen mesh in the lid, replaces its material.map
 * with a CanvasTexture drawn by a user-provided render function.
 * No CSS overlay. The UV mapping handles positioning perfectly.
 *
 * Usage:
 *   <MacbookWithScreen
 *     camera="zoom-in"
 *     renderScreen={(ctx, frame, w, h) => {
 *       ctx.fillStyle = "#000";
 *       ctx.fillRect(0, 0, w, h);
 *       ctx.fillStyle = "#0f0";
 *       ctx.font = "24px monospace";
 *       ctx.fillText("Hello", 20, 40);
 *     }}
 *   />
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  interpolate,
  delayRender,
  continueRender,
  getRemotionEnvironment,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import {
  useGLTF,
  ContactShadows,
  Environment,
  useEnvironment,
} from "@react-three/drei";
import * as THREE from "three";
import { preloadOnce } from "../../../lib/preloadOnce";

// The GLB is KHR_draco_mesh_compression. drei's useGLTF defaults to a gstatic
// CDN decoder that the headless render can't reach (silent blank frame), so we
// serve the decoder locally from public/draco. Must run before any preload.
useGLTF.setDecoderPath(staticFile("draco/"));

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.glb");
preloadOnce(useGLTF.preload, MODEL_URL);

// ── Modern M-series MacBook specs ──
// Every candidate model gets a spec: where it lives, how to find its lid and
// screen, where its hinge sits (in the lid node's LOCAL space), and how to
// normalize it into the comp world (laptop ~7.1 units wide, feet on y=0,
// centered x=3 / z=0.7, screen facing -z). Numbers are measured from each
// GLB's node/mesh/accessor dump. NOT preloaded at module scope — only comps
// that opt into model="modern" pay for the fetch (preloadOnce fires in the
// wrapper below). License files sit next to each GLB in public/models/.
interface ModernModelSpec {
  url: string;
  /** Node whose subtree is the lid (display assembly). */
  lidNodeName: string;
  /** Material name of the screen panel — replaced with the UI canvas. */
  screenMaterialName: string;
  /**
   * Material of the display cover glass (bezel + notch surround + chin).
   * Recolored at load to near-black glass so the lid's inner face reads as
   * ONE black panel — every M-series Mac since 2021. Optional: models whose
   * glass already reads right can omit it.
   */
  bezelMaterialName?: string;
  /** Hinge barrel center in the lid node's LOCAL coordinates. */
  hingeLocal: THREE.Vector3;
  /** Hinge axis in the lid node's LOCAL coordinates. */
  hingeAxis: THREE.Vector3;
  /** Rotation (rad) about hingeAxis that closes the lid from authored-open. */
  closedRad: number;
  /** Screen canvas height for a 2560-wide canvas (panel's measured aspect). */
  screenH: number;
  /** Group normalization into the comp world. */
  scale: number;
  pos: THREE.Vector3;
  rotY: number;
}

const MODERN_SPECS = {
  // "2021 Macbook Pro 14" (M1 Pro / M1 Max)" by akshatmittal — CC-BY-4.0,
  // commercial allowed, author must be credited:
  // https://sketchfab.com/3d-models/2021-macbook-pro-14-m1-pro-m1-max-f6b0b940fb6a4286b18a674ef32af2d3
  // Authored at real-world scale (0.315 m wide — the real machine is
  // 31.26 cm); the lid node's local axes are world-aligned (ancestors
  // contribute only a uniform 0.01 scale). The screen material ships as a
  // bare white emissive, made to be swapped for real content.
  mbp14: {
    url: staticFile("models/macbook-modern.glb"),
    lidNodeName: "BLWpxSqmmLNyfOl",
    screenMaterialName: "UpOvKwLUUXPmnPU",
    bezelMaterialName: "SELuppcPLrlTpBi",
    hingeLocal: new THREE.Vector3(0, 0.05, -11.75),
    hingeAxis: new THREE.Vector3(1, 0, 0),
    closedRad: 1.93,
    screenH: 1654, // panel 30.35 × 19.61 local units ≈ 1.548
    scale: 22.53, // 0.315 m → 7.097 world units
    pos: new THREE.Vector3(3, 0.293, 0.7),
    rotY: Math.PI,
  },
  // "macbook pro M3 16 inch 2024" by jackbaeten — CC-BY-4.0, commercial
  // allowed, author must be credited:
  // https://sketchfab.com/3d-models/macbook-pro-m3-16-inch-2024-8e34fc2b303144f78490007d91ff57c4
  // Raw model ~35.5 units wide; the lid's local space carries the Sketchfab
  // Z-up→Y-up wrapper (local = (x, z_world, -y_world)).
  m3_16: {
    url: staticFile("models/macbook-m3-16.glb"),
    lidNodeName: "VCQqxpxkUlzqcJI_62",
    screenMaterialName: "sfCQkHOWyrsLmor",
    hingeLocal: new THREE.Vector3(0, -12.43, 0),
    hingeAxis: new THREE.Vector3(1, 0, 0),
    closedRad: 1.953,
    screenH: 1656, // panel 34.385 × 22.25 ≈ 1.545
    scale: 0.2,
    pos: new THREE.Vector3(3, 0.213, 0.7),
    rotY: Math.PI,
  },
} satisfies Record<string, ModernModelSpec>;

// The model the "modern" variant renders.
const MODERN_SPEC: ModernModelSpec = MODERN_SPECS.mbp14;

// Outdoor daylight sky HDRI (Poly Haven "kloofendal 48d partly cloudy puresky",
// CC0). Replaced the old studio_small_03 softbox HDRI — its big white softbox
// streak across the bezel/lid read as an indoor photo studio. MUST stay a local
// file — presets fetch from a CDN and hang headless renders forever. The envmap
// is what makes the PBR aluminum read as metal; without it the body renders as
// flat dark plastic.
const HDRI_URL = staticFile("textures/hdri/daylight_sky_1k.hdr");
// Preload like the GLB above. Without this the HDR resolves LAST, after every
// other delayRender handle has cleared, and the headless screenshot races the
// first GL draw of the re-committed scene — captured blank (laptop missing).
preloadOnce((url: string) => useEnvironment.preload({ files: url }), HDRI_URL);


// ── Camera views ──

export interface CameraView {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  zoom: number;
}

export const CAM = {
  wide: {
    pos: new THREE.Vector3(7.859, 2.544, -9.431),
    target: new THREE.Vector3(2.056, 1.385, 0.641),
    zoom: 1.0,
  },
  macbook: {
    pos: new THREE.Vector3(3.031, 4.096, -6.179),
    target: new THREE.Vector3(3.001, 2.780, 0.829),
    zoom: 1.2,
  },
  screen: {
    pos: new THREE.Vector3(3.02, 3.6, -4.0),
    target: new THREE.Vector3(3.0, 3.0, 0.8),
    zoom: 1.6,
  },
} as const;

// ── Model constants ──

const LID_CLOSED = new THREE.Quaternion(0, 0, 0, 1);
const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);
const IPHONE_POS = new THREE.Vector3(-3, 0, 0);
const IPHONE_QUAT = new THREE.Quaternion(0.00056, 0.70739, 0.70682, 0.00056);
const IPHONE_SCALE = new THREE.Vector3(22.486, 22.486, 22.486);

// Screen canvas resolution — 16:10, high-res for crisp UI.
const SCREEN_W = 2560;
const SCREEN_H = 1600;

// Supersample the WebGL layer: render the 3D at SSAA× the composition size and
// let the browser composite it down. The Remotion --scale flag supersamples the
// DOM (the headline); this supersamples the canvas by the same factor so the 3D
// MacBook edges antialias too, instead of a 1080² buffer being stretched to
// 2160². Forwarded to R3F's <Canvas dpr> below. 3× (with MSAA on top — swANGLE
// supports it) is what finally smoothed the lid/body silhouette.
const SSAA = 3;

// ── Helpers ──

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _q = new THREE.Quaternion();

// ── Camera presets ──

export type CameraPreset =
  | "static-wide"
  | "static-macbook"
  | "static-screen"
  | "zoom-in"
  | "zoom-to-screen";

function getCameraView(
  preset: CameraPreset,
  frame: number,
  total: number,
): CameraView {
  switch (preset) {
    case "static-wide":
      return CAM.wide;
    case "static-macbook":
      return CAM.macbook;
    case "static-screen":
      return CAM.screen;
    case "zoom-in": {
      const t1 = easeInOutSine(
        interpolate(frame, [0, total * 0.35], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
      const t2 = easeInOutSine(
        interpolate(frame, [total * 0.35, total * 0.85], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
      const midPos = _p.copy(CAM.wide.pos).lerp(CAM.macbook.pos, t1);
      const pos = midPos.clone().lerp(CAM.screen.pos, t2);
      const midTarget = _t
        .copy(CAM.wide.target)
        .lerp(CAM.macbook.target, t1);
      const target = midTarget.clone().lerp(CAM.screen.target, t2);
      const zoom =
        CAM.wide.zoom +
        (CAM.macbook.zoom - CAM.wide.zoom) * t1 +
        (CAM.screen.zoom - CAM.macbook.zoom) * t2;
      return { pos, target, zoom };
    }
    case "zoom-to-screen": {
      const t = easeInOutSine(
        interpolate(frame, [0, total * 0.6], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
      const pos = _p.copy(CAM.macbook.pos).lerp(CAM.screen.pos, t).clone();
      const target = _t
        .copy(CAM.macbook.target)
        .lerp(CAM.screen.target, t)
        .clone();
      const zoom =
        CAM.macbook.zoom + (CAM.screen.zoom - CAM.macbook.zoom) * t;
      return { pos, target, zoom };
    }
  }
}

// ── 3D Scene ──

export type ScreenRenderer = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
) => void;

/** Which physical MacBook to render. "touchbar" is the original tabletop GLB. */
export type MacbookModelVariant = "touchbar" | "modern";

// Shared light rig — identical JSX for both model variants.
const MacbookLights: React.FC<{
  daylight: boolean;
  envMap: THREE.Texture;
}> = ({ daylight, envMap }) =>
  daylight ? (
    // Daylight rig, envmap-first: the outdoor sky HDRI carries the base
    // illumination AND gives the aluminum its reflections — cool-white top
    // light from the sky, soft ground bounce, no indoor softbox streaks.
    // On top: a hemisphere for the sky/ground gradient and one gentle warm
    // key for directional shading across the lid/deck.
    <>
      <Environment map={envMap} environmentIntensity={1.15} />
      <hemisphereLight args={["#bcd6f0", "#dfe6ea", 0.45]} />
      <directionalLight position={[-5, 6, -6]} intensity={1.1} color="#fff6ea" />
    </>
  ) : (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight position={[5, 8, -5]} intensity={2.6} castShadow />
      <directionalLight position={[-4, 4, 3]} intensity={0.7} color="#c0d0e8" />
    </>
  );

const MacbookModel: React.FC<{
  view: CameraView;
  lidT: number;
  renderScreen: ScreenRenderer;
  frame: number;
  showContactShadow?: boolean;
  readyHandle?: number;
  daylight?: boolean;
}> = ({
  view,
  lidT,
  renderScreen,
  frame,
  showContactShadow = true,
  readyHandle,
  daylight = false,
}) => {
  const { camera, gl, advance } = useThree();
  const gltf = useGLTF(MODEL_URL);

  // During headless renders @remotion/three runs R3F with frameloop='never':
  // the GL canvas draws ONLY on advance() calls, and the library advances only
  // at canvas creation and on frame CHANGES. Commits that happen without a
  // frame change — this subtree resolving from Suspense, a screen image
  // landing in state upstream — were never drawn, so whether a still showed
  // the laptop depended on whether every asset happened to resolve before the
  // first commit (blank captures ~50% of runs). Advance after EVERY commit.
  useEffect(() => {
    if (getRemotionEnvironment().isRendering) {
      advance(performance.now());
    }
  });
  // Suspend HERE on the env map too (not just inside <Environment>). If only
  // <Environment files> suspends, this subtree mounts once the GLB resolves,
  // the readyHandle clears, the tree falls BACK to the Suspense fallback while
  // the HDR decodes — and the headless screenshot can land in that gap
  // (captured blank, laptop missing). Loading it in the same suspense pass
  // means the handle below clears only when model AND envmap are both ready.
  const envMap = useEnvironment({ files: HDRI_URL });

  // This subtree mounts only once useGLTF + useEnvironment have resolved
  // (Suspense), so clearing the handle here is what makes the headless render
  // wait for the model and the envmap. Clear it two RAFs AFTER mount-commit:
  // the R3F draw of the freshly mounted scene lands a beat after the commit,
  // and if this handle is the last one standing, the headless screenshot
  // fires the moment it clears — racing (and sometimes beating) that first
  // GL draw. Blank captures (laptop missing) reproduced ~50% until this.
  useEffect(() => {
    if (readyHandle === undefined) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => continueRender(readyHandle));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [readyHandle]);

  const { iphone, bevels } = useMemo(
    () => ({
      iphone: gltf.scene.getObjectByName("iphone") ?? null,
      bevels: gltf.scene.getObjectByName("Bevels_2") ?? null,
    }),
    [gltf],
  );

  // All mutable state in refs — no re-render triggers
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const didInit = useRef(false);

  // Create canvas once
  if (!canvasRef.current) {
    const c = document.createElement("canvas");
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    canvasRef.current = c;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // Keep the foreshortened far side of the screen sharp — the single biggest
    // win for angled-UI legibility. Anisotropic sampling fights the grazing-
    // angle blur; trilinear mipmaps stop the minified UI shimmering/aliasing.
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    textureRef.current = tex;
  }

  // Replace screen texture once (after model loads)
  if (!didInit.current && gltf.scene) {
    didInit.current = true;
    // The display's black cover glass is a perfect mirror (roughness 0). At
    // this camera's grazing angle it reflects the HDRI's overhead softbox as
    // a blown-white bloom across the top bezel. Damp (don't kill) it: a hint
    // of gloss stays, the blowout goes.
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m?.name?.includes("Black_Glass")) {
          m.envMapIntensity = 0.35;
          m.roughness = Math.max(m.roughness ?? 0, 0.12);
        }
      }
    });
    const lidNode = gltf.scene.getObjectByName("Bevels_2");
    if (lidNode) {
      lidNode.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat?.map && textureRef.current) {
            // Unlit screen: with the studio envmap in the scene, the original
            // PBR screen material (roughness 0) catches the HDRI softbox as a
            // full-screen white veil that no envMapIntensity value tames.
            // A basic (unlit) material shows the UI verbatim — clean at any
            // rig — while the aluminum around it keeps the full reflections.
            mesh.material = new THREE.MeshBasicMaterial({
              map: textureRef.current,
              toneMapped: false,
            });
          }
        }
      });
    }
  }

  // Draw screen content every frame
  const ctx = canvasRef.current?.getContext("2d");
  if (ctx && textureRef.current) {
    renderScreen(ctx, frame, SCREEN_W, SCREEN_H);
    textureRef.current.needsUpdate = true;
  }

  // Camera
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.copy(view.pos);
  cam.lookAt(view.target);
  cam.zoom = view.zoom;
  cam.updateProjectionMatrix();

  // Lid
  if (bevels) {
    bevels.position.copy(BEVELS_POS);
    bevels.quaternion.copy(_q.copy(LID_CLOSED).slerp(LID_OPEN, lidT));
    bevels.scale.copy(BEVELS_SCALE);
  }

  // iPhone hidden — visible=false, not just moved aside: the -3 x-offset kept
  // it off-frame only for the tight face-on cameras; pulled-back views see it.
  if (iphone) {
    iphone.position.copy(IPHONE_POS);
    iphone.quaternion.copy(IPHONE_QUAT);
    iphone.scale.copy(IPHONE_SCALE);
    iphone.visible = false;
  }

  return (
    <>
      <primitive object={gltf.scene} />
      <MacbookLights daylight={daylight} envMap={envMap} />
      {showContactShadow ? (
        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.4}
          scale={14}
          blur={1.5}
          far={5}
        />
      ) : null}
    </>
  );
};

// ── Modern MacBook Pro (M3 16", 2024) ──
//
// Model geometry facts live in MODERN_SPECS (top of file): each spec names
// the lid node (authored FULLY OPEN, ~110-112° from closed), the screen
// panel's material, the hinge barrel in lid-local space, and the closing
// rotation. Bezel glass (with the notch cutout) and the webcam cluster stay
// untouched. Both models close by a POSITIVE rotation about local X
// (verified against the geometry: the open lid direction maps onto the deck
// plane under Rx(+closedRad)). lidT: 0 = closed, 1 = authored open,
// >1 = tilted a touch past open. Screen canvas width is fixed; height comes
// from the spec so the UV mapping introduces no stretch — callers cover-fit
// their 16:10 content into it.
const MODERN_SCREEN_W = 2560;

const _lidQ = new THREE.Quaternion();
const _lidP = new THREE.Vector3();

const ModernMacbookModel: React.FC<{
  view: CameraView;
  lidT: number;
  renderScreen: ScreenRenderer;
  frame: number;
  showContactShadow?: boolean;
  readyHandle?: number;
  daylight?: boolean;
}> = ({
  view,
  lidT,
  renderScreen,
  frame,
  showContactShadow = true,
  readyHandle,
  daylight = false,
}) => {
  const { camera, gl, advance } = useThree();
  const spec = MODERN_SPEC;
  const gltf = useGLTF(spec.url);

  // Same headless-render discipline as MacbookModel: R3F runs with
  // frameloop='never' during renders and only draws on advance(); commits
  // without a frame change (this subtree resolving from Suspense) would
  // otherwise never hit the GL canvas. Advance after EVERY commit.
  useEffect(() => {
    if (getRemotionEnvironment().isRendering) {
      advance(performance.now());
    }
  });
  // Suspend on the env map in the same pass as the GLB (see MacbookModel).
  const envMap = useEnvironment({ files: HDRI_URL });

  // Clear the ready handle two RAFs after mount-commit — the headless
  // screenshot must not beat the first GL draw of the mounted scene.
  useEffect(() => {
    if (readyHandle === undefined) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => continueRender(readyHandle));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [readyHandle]);

  const lid = useMemo(
    () => gltf.scene.getObjectByName(spec.lidNodeName) ?? null,
    [gltf, spec],
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const didInit = useRef(false);

  if (!canvasRef.current) {
    const c = document.createElement("canvas");
    c.width = MODERN_SCREEN_W;
    c.height = spec.screenH;
    canvasRef.current = c;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // UV orientation, verified on stills: this model's panel UVs want the
    // browser texture convention — CanvasTexture's DEFAULT flipY=true renders
    // the UI right-way-up and unmirrored, filling the panel. (flipY=false —
    // the raw glTF convention — showed it vertically flipped; flipY=false
    // plus a π rotation showed it mirrored.) Leave flipY alone.
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    textureRef.current = tex;
  }

  if (!didInit.current && gltf.scene) {
    didInit.current = true;
    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // The screen panel: unlit, verbatim UI — same recipe as the old model.
      if (mat?.name === spec.screenMaterialName && textureRef.current) {
        mesh.material = new THREE.MeshBasicMaterial({
          map: textureRef.current,
          toneMapped: false,
        });
      }
      // The display cover glass (bezel + notch surround + chin): the authored
      // black metal (metalness 0.8, roughness 0.1) rendered as a dead flat
      // black. Recolor to near-black dielectric glass — a hint of lift and a
      // soft envmap sheen, matching the M-series face on Apple's own press
      // photos (chin probes read 7–24/255, not 0).
      if (mat?.name === spec.bezelMaterialName) {
        mat.color.setHex(0x0a0a0c);
        mat.metalness = 0;
        mat.roughness = 0.3;
        mat.envMapIntensity = 0.3;
      }
    });
  }

  const ctx = canvasRef.current?.getContext("2d");
  if (ctx && textureRef.current) {
    renderScreen(ctx, frame, MODERN_SCREEN_W, spec.screenH);
    textureRef.current.needsUpdate = true;
  }

  // Camera
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.copy(view.pos);
  cam.lookAt(view.target);
  cam.zoom = view.zoom;
  cam.updateProjectionMatrix();

  // Lid — rotate the (identity-transform) lid node about the hinge barrel:
  // M = T(hinge) · Rx(θ) · T(−hinge), θ = (1 − lidT) · closed-angle.
  // NOTE on readability: under the plongeant hero camera the 0.75→1.05 open
  // gesture moves the lid-top only a few px vertically (the swing travels
  // mostly along the view axis) — the motion reads through the screen
  // trapezoid's changing foreshortening, verified by projecting the measured
  // lid-top through the camera (y 287→296 predicted, 292→297 rendered).
  if (lid) {
    const theta = (1 - lidT) * spec.closedRad;
    _lidQ.setFromAxisAngle(spec.hingeAxis, theta);
    lid.quaternion.copy(_lidQ);
    _lidP.copy(spec.hingeLocal).applyQuaternion(_lidQ);
    lid.position.copy(spec.hingeLocal).sub(_lidP);
  }

  return (
    <>
      <group
        position={spec.pos}
        rotation={[0, spec.rotY, 0]}
        scale={spec.scale}
      >
        <primitive object={gltf.scene} />
      </group>
      <MacbookLights daylight={daylight} envMap={envMap} />
      {showContactShadow ? (
        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.4}
          scale={14}
          blur={1.5}
          far={5}
        />
      ) : null}
    </>
  );
};

// ── Wrapper ──

export interface MacbookWithScreenProps {
  /** Draw function called every frame to render screen content */
  renderScreen: ScreenRenderer;
  camera?: CameraPreset;
  /** Explicit camera view — overrides `camera` preset when provided. */
  customView?: CameraView;
  lidOpen?: boolean;
  lidDur?: number;
  /** Skip the open animation — lid is fully open from frame 0 (for stills). */
  lidOpenAtStart?: boolean;
  /**
   * Direct lid control, 0 (closed) → 1 (fully open). When provided it wins
   * over lidOpen/lidOpenAtStart/lidDur — the caller owns the animation curve.
   */
  lidT?: number;
  bg?: string;
  /** Transparent background + alpha WebGL buffer (for compositing over film). */
  transparent?: boolean;
  /** Ground contact shadow. Default true; set false for a floating cutout. */
  showContactShadow?: boolean;
  /** Bright even outdoor light rig + higher exposure (matches a daylight bg). */
  daylight?: boolean;
  /**
   * Which MacBook to render. Default "touchbar" — the original tabletop GLB —
   * so every existing caller keeps its exact look. "modern" mounts the model
   * MODERN_SPEC points at: an M-series MacBook with thin bezels, a notch,
   * and no Touch Bar.
   */
  model?: MacbookModelVariant;
  /**
   * Legacy screen glow control — inert since the screen became an unlit
   * material (see MacbookModel). Kept so existing callers keep compiling.
   */
  screenEmissiveIntensity?: number;
}

export const MacbookWithScreen: React.FC<MacbookWithScreenProps> = ({
  renderScreen,
  camera = "zoom-in",
  customView,
  lidOpen = true,
  lidDur = 30,
  lidOpenAtStart = false,
  lidT: lidTOverride,
  bg = "#f5f5f5",
  transparent = false,
  showContactShadow = true,
  daylight = false,
  model = "touchbar",
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // The modern GLB is fetched only by comps that opt in (11.7 MB).
  if (model === "modern") {
    preloadOnce(useGLTF.preload, MODERN_SPEC.url);
  }

  // Hold the render until the model has actually loaded and mounted.
  const [readyHandle] = useState(() => delayRender("macbook model load"));

  const view = customView ?? getCameraView(camera, frame, durationInFrames);

  const lidT =
    lidTOverride ??
    (lidOpenAtStart
      ? 1
      : easeInOutSine(
          interpolate(frame, [3, lidDur], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        ));

  return (
    <AbsoluteFill
      style={{ backgroundColor: transparent ? "transparent" : bg }}
    >
      <ThreeCanvas
        width={width}
        height={height}
        dpr={SSAA}
        camera={{
          fov: 50,
          near: 0.5,
          far: 1000,
          position: [CAM.wide.pos.x, CAM.wide.pos.y, CAM.wide.pos.z],
        }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: daylight ? 1.15 : 1.0,
          ...(transparent ? { alpha: true, premultipliedAlpha: false } : {}),
        }}
        style={transparent ? { backgroundColor: "transparent" } : undefined}
      >
        <React.Suspense fallback={null}>
          {model === "modern" ? (
            <ModernMacbookModel
              view={view}
              lidT={lidTOverride !== undefined || lidOpen ? lidT : 0}
              renderScreen={renderScreen}
              frame={frame}
              showContactShadow={showContactShadow}
              readyHandle={readyHandle}
              daylight={daylight}
            />
          ) : (
            <MacbookModel
              view={view}
              lidT={lidTOverride !== undefined || lidOpen ? lidT : 0}
              renderScreen={renderScreen}
              frame={frame}
              showContactShadow={showContactShadow}
              readyHandle={readyHandle}
              daylight={daylight}
            />
          )}
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
