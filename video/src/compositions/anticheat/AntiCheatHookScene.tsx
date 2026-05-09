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

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.opt.glb");
useGLTF.preload(MODEL_URL);

// ── Laptop / phone constants pulled from DeviceBroll so this component
//    is self-contained.
// Phone scaled to read almost full canvas-height while keeping a clean
// right-edge clip rather than overflowing the top + bottom too. A
// little smaller than before so the phone feels less "in front" of
// the laptop.
const PHONE_BASE_SCALE = 34;
const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const LID_CLOSED = new THREE.Quaternion(0, 0, 0, 1);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

const PHONE_SCREEN_ASPECT = 9 / 19.5;
const LAPTOP_SCREEN_ASPECT = 16 / 10;

// World layout. Laptop sits at GLB origin (its native pose). Phone
// floats at world x=-5.6, y matched to camera target so its center
// projects to canvas vertical center. Negative-x maps to canvas-right
// (lookAt's right-hand convention with the camera at z=-7), so this
// keeps about three-quarters of the phone on canvas with the rest
// bleeding off the right.
const PHONE_POS = new THREE.Vector3(-5.6, 2.2, 0);

// Camera between the two devices, looking forward into +z. Slightly
// above the device plane so we read the laptop's lid face and the
// phone's screen face without lying flat on the deck.
const CAMERA_POS: [number, number, number] = [-1.5, 3.2, -7];
const CAMERA_TARGET: [number, number, number] = [-1.5, 2.2, 0];

// Subtle yaw drift over the first 7 seconds — the phone slowly turns
// further toward canvas-center while the hook plays, just enough that
// the brain registers movement without reading as overt animation.
const PHONE_YAW_DRIFT_END = 210; // 7s at 30fps
const PHONE_YAW_DRIFT_AMOUNT = -0.09; // ≈ -5°, more negative = toward center

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

// ── Main scene ───────────────────────────────────────────────────────────────

export type BrollSegment = {
  url: string;
  from: number;
  durationInFrames: number;
  startFrom: number;
};

const Scene: React.FC<{
  laptopSegments: BrollSegment[];
  phoneSegments: BrollSegment[];
  laptopBrollAspect: number;
  phoneBrollAspect: number;
  laptopVideoRef: React.RefObject<HTMLVideoElement | null>;
  phoneVideoRef: React.RefObject<HTMLVideoElement | null>;
  emissiveIntensity: number;
  lightingIntensity: number;
  phoneZoomCorrection: number;
  frame: number;
}> = ({
  laptopSegments,
  phoneSegments,
  laptopBrollAspect,
  phoneBrollAspect,
  laptopVideoRef,
  phoneVideoRef,
  emissiveIntensity,
  lightingIntensity,
  phoneZoomCorrection,
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
  const yawDrift = PHONE_YAW_DRIFT_AMOUNT * driftEased;

  const iphone = sceneClone.getObjectByName("iphone");
  if (iphone) {
    iphone.position.copy(PHONE_POS);
    iphone.position.x += phoneSlideX;
    // Counter-scale the phone against the CSS-level zoom so the phone
    // ends up running its own (gentler) zoom curve while the rest of
    // the scene rides the laptop curve.
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

  // Camera
  const perspCam = threeCam as THREE.PerspectiveCamera;
  perspCam.position.set(...CAMERA_POS);
  perspCam.lookAt(...CAMERA_TARGET);
  perspCam.fov = 50;
  perspCam.zoom = 1;
  perspCam.updateProjectionMatrix();

  return (
    <>
      <primitive object={sceneClone} />
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
        {env.isRendering
          ? phoneSegments.map((seg, i) => (
              <Sequence
                key={`p-${i}`}
                from={seg.from - seg.startFrom}
                durationInFrames={seg.durationInFrames + seg.startFrom}
                layout="none"
              >
                <RenderedScreen
                  mesh={phoneScreen}
                  broll={seg.url}
                  brollAspect={phoneBrollAspect}
                  screenAspect={PHONE_SCREEN_ASPECT}
                  emissiveIntensity={emissiveIntensity}
                  brightness={phoneBrightness}
                />
              </Sequence>
            ))
          : (
            <PreviewScreen
              mesh={phoneScreen}
              videoRef={phoneVideoRef}
              canvasW={720}
              canvasH={1560}
              emissiveIntensity={emissiveIntensity}
              brightness={phoneBrightness}
              frame={frame}
            />
          )}
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
  phoneSegments: BrollSegment[];
  laptopBrollAspect?: number;
  phoneBrollAspect?: number;
  width?: number;
  height?: number;
  emissiveIntensity?: number;
  lightingIntensity?: number;
  phoneZoomCorrection?: number;
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
  phoneSegments,
  laptopBrollAspect = 16 / 9,
  phoneBrollAspect = 720 / 1560,
  width = 1920,
  height = 1080,
  emissiveIntensity = 1.6,
  lightingIntensity = 0.85,
  phoneZoomCorrection = 1,
}) => {
  const frame = useCurrentFrame();
  const laptopVideoRef = useRef<HTMLVideoElement | null>(null);
  const phoneVideoRef = useRef<HTMLVideoElement | null>(null);
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
          {phoneSegments.map((seg, i) => (
            <PreviewVideo
              key={`p-${i}`}
              segment={seg}
              videoRef={phoneVideoRef}
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
            phoneSegments={phoneSegments}
            laptopBrollAspect={laptopBrollAspect}
            phoneBrollAspect={phoneBrollAspect}
            laptopVideoRef={laptopVideoRef}
            phoneVideoRef={phoneVideoRef}
            emissiveIntensity={emissiveIntensity}
            lightingIntensity={lightingIntensity}
            phoneZoomCorrection={phoneZoomCorrection}
            frame={frame}
          />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
