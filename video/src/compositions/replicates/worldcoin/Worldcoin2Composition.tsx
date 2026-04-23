// Worldcoin2 — MacBook companion to the iPhone scene.
//
// Same GLB, same material-fingerprint trick. The MacBook display mesh
// lives under the `Bevels_2` lid subtree and is the only mesh in that
// subtree whose material has a baseColorMap. Clone the material, swap
// both map and emissiveMap to a Remotion video texture, cover-fit the
// UVs for 16:9 source on a 16:10 screen.
//
// Camera matches the DeviceShowcase "macbook" view at the 1:15 pose
// (lid fully open). A gentle idle breath keeps the frame alive.

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
import { useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.glb");
useGLTF.preload(MODEL_URL);

const BROLL_SRC = staticFile("broll/mountains-aerial.mp4");
const BROLL_ASPECT = 1280 / 720;
// MacBook display aspect ≈ 16:10
const SCREEN_ASPECT = 16 / 10;

const FPS = 60;
const DURATION_SEC = 10;
const DURATION = FPS * DURATION_SEC;

// ── Camera — the "macbook" view from DeviceShowcase (1:15 pose) ──
const CAM_POS = new THREE.Vector3(3.031, 4.096, -6.179);
const CAM_TARGET = new THREE.Vector3(3.001, 2.780, 0.829);
const CAM_ZOOM = 1.2;

// Lid fully open — identical to DeviceShowcase LID_OPEN
const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

// ── Screen injection ──

function findMacbookScreenMesh(lidRoot: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  lidRoot.traverse((child) => {
    if (found) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) return;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    // The display mesh is the only one in the lid subtree with a baseColorMap.
    if (mat && mat.map) {
      mesh.material = mat.clone();
      found = mesh;
    }
  });
  return found;
}

function applyCoverFit(
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
    mat.emissiveIntensity = 0.85;
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

// ── Scene ──

const MacbookScene: React.FC<{
  frame: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}> = ({ frame, videoRef }) => {
  const { camera } = useThree();
  const gltf = useGLTF(MODEL_URL);
  const env = useRemotionEnvironment();

  const bevels = useMemo(
    () => gltf.scene.getObjectByName("Bevels_2") ?? null,
    [gltf],
  );

  const screenMesh = useMemo(
    () => (bevels ? findMacbookScreenMesh(bevels) : null),
    [bevels],
  );

  // Hide the iPhone — only the MacBook participates in this scene.
  useMemo(() => {
    const iphoneNode = gltf.scene.getObjectByName("iphone");
    if (iphoneNode) {
      iphoneNode.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.visible = false;
        }
      });
    }
  }, [gltf]);

  // Lid open, breathing slightly — life without distraction.
  if (bevels) {
    bevels.position.copy(BEVELS_POS);
    bevels.quaternion.copy(LID_OPEN);
    bevels.scale.copy(BEVELS_SCALE);
  }

  // Camera: macbook view with idle float
  const driftX = Math.sin(frame * 0.008) * 0.05;
  const driftY = Math.cos(frame * 0.011) * 0.03;
  const perspCam = camera as THREE.PerspectiveCamera;
  perspCam.position.set(CAM_POS.x + driftX, CAM_POS.y + driftY, CAM_POS.z);
  perspCam.lookAt(CAM_TARGET);
  perspCam.zoom = CAM_ZOOM;
  perspCam.fov = 50;
  perspCam.updateProjectionMatrix();

  return (
    <>
      <primitive object={gltf.scene} />
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
      <directionalLight position={[-4, 4, 3]} intensity={0.6} color="#c0d0e8" />
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={14}
        blur={1.5}
        far={5}
      />
    </>
  );
};

// ── Background ──

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

// ── Composition ──

const W = 1920;
const H = 1080;

export const Worldcoin2Composition: React.FC = () => {
  const frame = useCurrentFrame();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const env = useRemotionEnvironment();

  return (
    <AbsoluteFill style={{ width: W, height: H }}>
      <GradientBackground frame={frame} />
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
      <ThreeCanvas
        width={W}
        height={H}
        camera={{
          fov: 50,
          near: 0.5,
          far: 1000,
          position: [CAM_POS.x, CAM_POS.y, CAM_POS.z],
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
          <MacbookScene frame={frame} videoRef={videoRef} />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const worldcoin2Meta = {
  id: "Worldcoin2",
  component: Worldcoin2Composition,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: DURATION,
};
