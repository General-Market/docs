// Worldcoin World App — iPhone motion replication
// Reference: https://x.com/tiagosada/status/1655569631543975937
//
// iPhone 3D model extracted from the DeviceShowcase GLB.
// The screen mesh is identified by material fingerprint (emissiveMap,
// no baseColorMap — unique to the iPhone display in this GLB) and its
// textures are swapped with a Remotion video texture.
import React, { useMemo, useRef } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  staticFile,
  Video,
  useRemotionEnvironment,
} from "remotion";

import {
  ThreeCanvas,
  useOffthreadVideoTexture,
  useVideoTexture,
} from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.glb");
useGLTF.preload(MODEL_URL);

// Broll — any landscape clip in public/broll works; swap the filename to taste.
const BROLL_SRC = staticFile("broll/glacier-drone.mp4");
const BROLL_ASPECT = 1920 / 1080;
// iPhone display aspect (portrait). Used for cover-fit UV cropping so a
// 16:9 source fills the tall screen without squish.
const SCREEN_ASPECT = 9 / 19.5;

const FPS = 60;
const DURATION_SEC = 48;
const DURATION = FPS * DURATION_SEC;

// ── Easing ──

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ── Helpers ──

const fr = (sec: number) => Math.round(sec * FPS);

function prog(frame: number, start: number, end: number): number {
  return Math.max(0, Math.min(1, (frame - start) / (end - start)));
}

function ep(frame: number, start: number, end: number): number {
  return easeInOutCubic(prog(frame, start, end));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Phone state ──

interface PhoneState {
  x: number;
  y: number;
  rotY: number;
  rotZ: number;
  scale: number;
  opacity: number;
  flanking?: {
    left: PhoneState;
    right: PhoneState;
  };
}

function getPhoneState(frame: number): PhoneState {
  // Persistent idle oscillation
  const idleY = Math.sin(frame * 0.018) * 0.04;
  const idleRotZ = Math.sin(frame * 0.012 + 0.5) * 0.012;
  const idleRotY = Math.sin(frame * 0.009) * 0.015;

  // ── Phase 1: Not visible (0–4s) ──
  if (frame < fr(4)) {
    return { x: 0, y: 0, rotY: 0, rotZ: 0, scale: 0.3, opacity: 0 };
  }

  // ── Phase 2: Enter — dezoom from center (4–5.5s) ──
  if (frame < fr(5.5)) {
    const t = easeOutCubic(prog(frame, fr(4), fr(5.5)));
    return {
      x: 0,
      y: 0,
      rotY: lerp(0, 0.08, t),
      rotZ: 0,
      scale: lerp(0.3, 1, t),
      opacity: Math.min(t * 3, 1),
    };
  }

  // ── Phase 3: Centered idle float (5.5–9s) ──
  if (frame < fr(9)) {
    return {
      x: 0,
      y: idleY,
      rotY: 0.08 + idleRotY,
      rotZ: idleRotZ,
      scale: 1,
      opacity: 1,
    };
  }

  // ── Phase 4: Shift right (9–12s) ──
  if (frame < fr(12)) {
    const t = ep(frame, fr(9), fr(12));
    return {
      x: lerp(0, 1.8, t),
      y: idleY,
      rotY: lerp(0.08, 0.14, t) + idleRotY,
      rotZ: lerp(0, 0.04, t) + idleRotZ,
      scale: 1,
      opacity: 1,
    };
  }

  // ── Phase 5: Hold right (12–15s) ──
  if (frame < fr(15)) {
    return {
      x: 1.8,
      y: idleY,
      rotY: 0.14 + idleRotY,
      rotZ: 0.04 + idleRotZ,
      scale: 1,
      opacity: 1,
    };
  }

  // ── Phase 6: Back to center (15–16.5s) ──
  if (frame < fr(16.5)) {
    const t = ep(frame, fr(15), fr(16.5));
    return {
      x: lerp(1.8, 0, t),
      y: idleY,
      rotY: lerp(0.14, 0, t) + idleRotY,
      rotZ: lerp(0.04, 0, t) + idleRotZ,
      scale: 1,
      opacity: 1,
    };
  }

  // ── Phase 6b: Quick Y-axis flip/turn (16.5–18s) ──
  if (frame < fr(18)) {
    const t = easeInOutSine(prog(frame, fr(16.5), fr(18)));
    return {
      x: 0,
      y: idleY,
      rotY: t * Math.PI * 2,
      rotZ: 0,
      scale: 1,
      opacity: 1,
    };
  }

  // ── Phase 7: Zoom in + shift left (18–20.5s) — top portion visible ──
  if (frame < fr(20.5)) {
    const t = ep(frame, fr(18), fr(20.5));
    return {
      x: lerp(0, -1.2, t),
      y: lerp(0, 1.6, t),
      rotY: lerp(0, -0.03, t),
      rotZ: 0,
      scale: lerp(1, 1.7, t),
      opacity: 1,
    };
  }

  // ── Phase 8: Hold zoomed, slight drift (20.5–22s) ──
  if (frame < fr(22)) {
    const t = ep(frame, fr(20.5), fr(22));
    return {
      x: lerp(-1.2, -0.9, t),
      y: lerp(1.6, 1.2, t),
      rotY: -0.03,
      rotZ: 0,
      scale: lerp(1.7, 1.6, t),
      opacity: 1,
    };
  }

  // ── Phase 9: Return to center (22–24s) ──
  if (frame < fr(24)) {
    const t = ep(frame, fr(22), fr(24));
    return {
      x: lerp(-0.9, 0, t),
      y: lerp(1.2, 0, t),
      rotY: lerp(-0.03, 0, t),
      rotZ: 0,
      scale: lerp(1.6, 1, t),
      opacity: 1,
    };
  }

  // ── Phase 10: Zoom bottom + shift left (24–27s) — crypto portfolio ──
  if (frame < fr(27)) {
    const t = ep(frame, fr(24), fr(27));
    return {
      x: lerp(0, -1.4, t),
      y: lerp(0, -1.4, t),
      rotY: lerp(0, -0.05, t),
      rotZ: 0,
      scale: lerp(1, 1.6, t),
      opacity: 1,
    };
  }

  // ── Phase 11: Y-axis spin + return to center (27–30s) ──
  if (frame < fr(30)) {
    const spinT = easeInOutSine(prog(frame, fr(27), fr(30)));
    const returnT = easeOutCubic(prog(frame, fr(27), fr(29)));
    return {
      x: lerp(-1.4, 0, returnT),
      y: lerp(-1.4, 0, returnT),
      rotY: spinT * Math.PI * 2,
      rotZ: 0,
      scale: lerp(1.6, 1, returnT),
      opacity: 1,
    };
  }

  // ── Phase 12: Zoom left, grants content (30–34s) ──
  if (frame < fr(34)) {
    const t = ep(frame, fr(30), fr(31.5));
    return {
      x: lerp(0, -1.3, t),
      y: lerp(0, 0.6, t),
      rotY: 0,
      rotZ: 0,
      scale: lerp(1, 1.5, t),
      opacity: 1,
    };
  }

  // ── Phase 13: Three phones (34–37.5s) ──
  if (frame < fr(37.5)) {
    const enterT = easeOutCubic(prog(frame, fr(34), fr(35.5)));
    const mainT = ep(frame, fr(34), fr(35));
    return {
      x: lerp(-1.3, 0, mainT),
      y: lerp(0.6, 0, mainT),
      rotY: 0,
      rotZ: 0,
      scale: lerp(1.5, 1, mainT),
      opacity: 1,
      flanking: {
        left: {
          x: lerp(0, -3.2, enterT),
          y: 0,
          rotY: lerp(0, 0.25, enterT),
          rotZ: 0,
          scale: lerp(0, 0.82, enterT),
          opacity: enterT,
        },
        right: {
          x: lerp(0, 3.2, enterT),
          y: 0,
          rotY: lerp(0, -0.25, enterT),
          rotZ: 0,
          scale: lerp(0, 0.82, enterT),
          opacity: enterT,
        },
      },
    };
  }

  // ── Phase 14: Flanking phones exit + single centered (37.5–40s) ──
  if (frame < fr(40)) {
    const exitT = easeInOutCubic(prog(frame, fr(37.5), fr(38.5)));
    return {
      x: 0,
      y: idleY,
      rotY: 0.05 + idleRotY,
      rotZ: idleRotZ,
      scale: 1,
      opacity: 1,
      flanking: {
        left: {
          x: -3.2,
          y: 0,
          rotY: 0.25,
          rotZ: 0,
          scale: lerp(0.82, 0, exitT),
          opacity: 1 - exitT,
        },
        right: {
          x: 3.2,
          y: 0,
          rotY: -0.25,
          rotZ: 0,
          scale: lerp(0.82, 0, exitT),
          opacity: 1 - exitT,
        },
      },
    };
  }

  // ── Phase 15: Zoom to bottom (40–42.5s) — quote text ──
  if (frame < fr(42.5)) {
    const t = ep(frame, fr(40), fr(42.5));
    return {
      x: 0,
      y: lerp(0, -2, t),
      rotY: 0,
      rotZ: 0,
      scale: lerp(1, 1.8, t),
      opacity: 1,
    };
  }

  // ── Phase 16: Fade out (42.5–46s) ──
  if (frame < fr(46)) {
    const t = easeInOutCubic(prog(frame, fr(42.5), fr(46)));
    return {
      x: 0,
      y: lerp(-2, -1.5, t),
      rotY: 0,
      rotZ: 0,
      scale: lerp(1.8, 1.4, t),
      opacity: lerp(1, 0, t),
    };
  }

  // ── Phase 17: Gone (46–48s) ──
  return { x: 0, y: 0, rotY: 0, rotZ: 0, scale: 1, opacity: 0 };
}

// ── 3D Scene ──
// Uses DeviceShowcase's proven camera + phone setup.
// Phone stays at FLOATING pos (-3, 2.5, 0) with known-working iphone camera.
// Animation = camera offset + phone quaternion/scale relative to FLOATING.

const IPHONE_FLOATING_QUAT = new THREE.Quaternion(0, 0, 0, 1);
const IPHONE_SCALE_BASE = 22.486;

// DeviceShowcase "iphone" camera — the ONLY view proven to show the screen
const BASE_CAM_POS = new THREE.Vector3(-2.800, 2.375, -4.440);
const BASE_CAM_TARGET = new THREE.Vector3(-2.921, 2.475, -1.564);

// Locate the iPhone screen mesh inside the iphone subtree.
// Fingerprint: the only material with an emissiveMap and no baseColorMap —
// this is the display, not the body, not the camera bumps, not the bezels.
// Also clones the material so our mutations don't leak into other scenes
// that share the same cached GLB.
function findScreenMesh(root: THREE.Object3D): THREE.Mesh | null {
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

// Apply cover-fit UV transform so a landscape video fills the portrait
// screen without stretching. The iPhone screen UV is assumed to run 0→1
// across width (U) and 0→1 down height (V) — true for this Sketchfab GLB.
function applyCoverFit(
  texture: THREE.Texture,
  videoAspect: number,
  screenAspect: number,
) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (videoAspect > screenAspect) {
    // Wider than container — crop horizontally, keep full height
    const r = screenAspect / videoAspect;
    texture.repeat.set(r, 1);
    texture.offset.set((1 - r) / 2, 0);
  } else {
    // Taller than container — crop vertically, keep full width
    const r = videoAspect / screenAspect;
    texture.repeat.set(1, r);
    texture.offset.set(0, (1 - r) / 2);
  }
  texture.needsUpdate = true;
}

function injectScreenTexture(
  screenMesh: THREE.Mesh | null,
  texture: THREE.Texture | null,
) {
  if (!screenMesh || !texture) return;
  applyCoverFit(texture, BROLL_ASPECT, SCREEN_ASPECT);
  const mat = screenMesh.material as THREE.MeshStandardMaterial;
  if (mat.map !== texture || mat.emissiveMap !== texture) {
    mat.map = texture;
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveMap = texture;
    mat.emissiveIntensity = 1.0;
    mat.needsUpdate = true;
  }
}

const RenderedScreen: React.FC<{ mesh: THREE.Mesh | null }> = ({ mesh }) => {
  const texture = useOffthreadVideoTexture({ src: BROLL_SRC });
  injectScreenTexture(mesh, texture ?? null);
  return null;
};

const PreviewScreen: React.FC<{
  mesh: THREE.Mesh | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}> = ({ mesh, videoRef }) => {
  const texture = useVideoTexture(videoRef);
  injectScreenTexture(mesh, texture ?? null);
  return null;
};

const IPhoneScene: React.FC<{
  frame: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}> = ({ frame, videoRef }) => {
  const { camera } = useThree();
  const gltf = useGLTF(MODEL_URL);
  const env = useRemotionEnvironment();
  const state = useMemo(() => getPhoneState(frame), [frame]);

  const iphone = useMemo(
    () => gltf.scene.getObjectByName("iphone") ?? null,
    [gltf],
  );

  const screenMesh = useMemo(
    () => (iphone ? findScreenMesh(iphone) : null),
    [iphone],
  );

  // Hide macbook meshes, keep only iPhone
  useMemo(() => {
    const iphoneNode = gltf.scene.getObjectByName("iphone");
    const iphoneSet = new Set<THREE.Object3D>();
    if (iphoneNode) {
      iphoneNode.traverse((c) => iphoneSet.add(c));
    }
    gltf.scene.traverse((child) => {
      if (!iphoneSet.has(child) && child !== gltf.scene) {
        if ((child as THREE.Mesh).isMesh) {
          child.visible = false;
        }
      }
    });
  }, [gltf]);

  if (iphone) {
    // FLOATING position from DeviceShowcase, offset by animation state
    iphone.position.set(-3 + state.x, 2.5 + state.y, 0);
    // FLOATING quaternion (identity) + animation rotation
    const animQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, state.rotY, state.rotZ, "YXZ"),
    );
    iphone.quaternion.copy(IPHONE_FLOATING_QUAT).multiply(animQuat);
    iphone.scale.setScalar(IPHONE_SCALE_BASE * state.scale);
  }

  // Camera: DeviceShowcase iphone view as base, follow phone movement
  const perspCam = camera as THREE.PerspectiveCamera;
  perspCam.position.set(
    BASE_CAM_POS.x + state.x * 0.3,
    BASE_CAM_POS.y + state.y * 0.3,
    BASE_CAM_POS.z,
  );
  perspCam.lookAt(
    BASE_CAM_TARGET.x + state.x * 0.3,
    BASE_CAM_TARGET.y + state.y * 0.3,
    BASE_CAM_TARGET.z,
  );
  perspCam.fov = 50;
  perspCam.updateProjectionMatrix();

  return (
    <>
      <primitive object={gltf.scene} />
      {/* Isolated boundary — a suspending video texture must never swallow the phone. */}
      <React.Suspense fallback={null}>
        {env.isRendering ? (
          <RenderedScreen mesh={screenMesh} />
        ) : (
          <PreviewScreen mesh={screenMesh} videoRef={videoRef} />
        )}
      </React.Suspense>
      <Environment preset="studio" environmentIntensity={1.8} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, -5]} intensity={2.5} castShadow />
      <directionalLight position={[-4, 4, 3]} intensity={0.6} color="#c0d8e8" />
    </>
  );
};

// ── Background gradient — matches reference soft pastel ──

const GradientBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const drift = frame * 0.003;
  const cx1 = 30 + Math.sin(drift) * 15;
  const cy1 = 40 + Math.cos(drift * 0.7) * 10;
  const cx2 = 70 + Math.cos(drift * 1.2) * 12;
  const cy2 = 60 + Math.sin(drift * 0.9) * 8;

  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(ellipse 80% 70% at ${cx1}% ${cy1}%, rgba(200,225,240,0.5) 0%, transparent 70%)`,
          `radial-gradient(ellipse 60% 80% at ${cx2}% ${cy2}%, rgba(200,240,215,0.4) 0%, transparent 65%)`,
          `linear-gradient(135deg, #f0f4f8 0%, #fafbfd 40%, #f2f8f4 70%, #edf2f8 100%)`,
        ].join(", "),
      }}
    />
  );
};

// ── Main composition ──

const W = 1920;
const H = 1080;

export const WorldcoinComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const state = useMemo(() => getPhoneState(frame), [frame]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const env = useRemotionEnvironment();

  return (
    <AbsoluteFill style={{ width: W, height: H }}>
      <GradientBackground frame={frame} />
      {/* Hidden <Video> feeds useVideoTexture during Studio preview. */}
      {!env.isRendering && (
        <Video
          ref={videoRef}
          src={BROLL_SRC}
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: state.opacity,
        }}
      >
        <ThreeCanvas
          width={W}
          height={H}
          camera={{
            fov: 50,
            near: 0.5,
            far: 1000,
            position: [-2.8, 2.375, -4.44],
          }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
          }}
          style={{ background: "transparent" }}
        >
          <React.Suspense fallback={null}>
            <IPhoneScene frame={frame} videoRef={videoRef} />
          </React.Suspense>
        </ThreeCanvas>
      </div>
    </AbsoluteFill>
  );
};

export const worldcoinMeta = {
  id: "Worldcoin",
  component: WorldcoinComposition,
  width: 1920,
  height: 1080,
  fps: FPS,
  durationInFrames: DURATION,
};
