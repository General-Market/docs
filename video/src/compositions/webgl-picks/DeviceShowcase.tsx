// Source: https://tympanus.net/Tutorials/DeviceShowcase/
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  ContactShadows,
  useGLTF,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

type Vec3 = [number, number, number];

// ── Animation timeline ──

const PHASE = {
  intro: [0, 45] as const,
  hoverMac: [45, 70] as const,
  focusMac: [70, 135] as const,
  unfocusMac: [135, 160] as const,
  focusPhone: [160, 235] as const,
  outro: [235, 300] as const,
};

function phaseProgress(
  frame: number,
  start: number,
  end: number,
  easing: (t: number) => number = Easing.inOut(Easing.cubic),
): number {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// ── MacBook dimensions ──

const MAC = {
  baseW: 3.0,
  baseD: 2.1,
  baseH: 0.06,
  lidW: 3.0,
  lidH: 2.0,
  lidThick: 0.04,
  screenInset: 0.1,
  bezelW: 0.04,
  keyRows: 5,
  keyCols: 13,
  trackpadW: 1.1,
  trackpadD: 0.7,
};

// ── MacBook Base ──

const MacBookBase: React.FC = () => {
  const bodyGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(MAC.baseW, MAC.baseH, MAC.baseD, 2, 1, 2);
    return geo;
  }, []);

  const keyGeo = useMemo(() => new THREE.BoxGeometry(0.17, 0.015, 0.17), []);
  const trackpadGeo = useMemo(
    () => new THREE.BoxGeometry(MAC.trackpadW, 0.005, MAC.trackpadD),
    [],
  );

  const keys = useMemo(() => {
    const result: { x: number; z: number }[] = [];
    const startX = -MAC.baseW * 0.37;
    const startZ = -MAC.baseD * 0.12;
    for (let row = 0; row < MAC.keyRows; row++) {
      for (let col = 0; col < MAC.keyCols; col++) {
        result.push({ x: startX + col * 0.21, z: startZ - row * 0.21 });
      }
    }
    return result;
  }, []);

  return (
    <group>
      {/* Main body — aluminum */}
      <mesh geometry={bodyGeo} position={[0, MAC.baseH / 2, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#b8b8c0"
          metalness={0.95}
          roughness={0.08}
          clearcoat={0.3}
          clearcoatRoughness={0.1}
          envMapIntensity={1.5}
        />
      </mesh>

      {/* Top surface — slightly darker for depth */}
      <mesh position={[0, MAC.baseH + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[MAC.baseW - 0.04, MAC.baseD - 0.04]} />
        <meshPhysicalMaterial
          color="#a8a8b0"
          metalness={0.9}
          roughness={0.12}
          clearcoat={0.2}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* Keys */}
      {keys.map((k, i) => (
        <mesh key={i} geometry={keyGeo} position={[k.x, MAC.baseH + 0.008, k.z]} castShadow>
          <meshStandardMaterial color="#2a2a30" metalness={0.15} roughness={0.85} />
        </mesh>
      ))}

      {/* Trackpad — glass-like inset */}
      <mesh
        geometry={trackpadGeo}
        position={[0, MAC.baseH + 0.003, MAC.baseD * 0.28]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#a0a0a8"
          metalness={0.7}
          roughness={0.05}
          clearcoat={0.8}
          clearcoatRoughness={0.05}
          envMapIntensity={1.8}
        />
      </mesh>

      {/* Front edge — thin chamfer line */}
      <mesh position={[0, MAC.baseH * 0.4, MAC.baseD / 2 - 0.01]}>
        <boxGeometry args={[MAC.baseW * 0.95, MAC.baseH * 0.3, 0.01]} />
        <meshStandardMaterial color="#999" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
};

// ── MacBook Lid — pivots at hinge (back edge) ──

const MacBookLid: React.FC<{ openAngle: number }> = ({ openAngle }) => {
  const lidGeo = useMemo(
    () => new THREE.BoxGeometry(MAC.lidW, MAC.lidH, MAC.lidThick),
    [],
  );

  const screenW = MAC.lidW - MAC.screenInset * 2;
  const screenH = MAC.lidH - MAC.screenInset * 2;
  const screenGeo = useMemo(() => new THREE.PlaneGeometry(screenW, screenH), []);
  const bezelGeo = useMemo(
    () => new THREE.BoxGeometry(MAC.lidW - 0.01, MAC.lidH - 0.01, MAC.lidThick + 0.002),
    [],
  );

  const angleRad = (openAngle * Math.PI) / 180;
  const emissiveIntensity =
    openAngle > 5
      ? interpolate(openAngle, [5, 110], [0, 2.5], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
        })
      : 0;

  // Screen content — gradient texture
  const screenTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext("2d")!;

    // Dark gradient background
    const grad = ctx.createLinearGradient(0, 0, 512, 320);
    grad.addColorStop(0, "#0a1628");
    grad.addColorStop(0.5, "#142040");
    grad.addColorStop(1, "#0a1628");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 320);

    // Fake dock bar at bottom
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(130, 285, 252, 28, 8);
    ctx.fill();

    // Fake app icons in dock
    const iconColors = ["#3478f6", "#34c759", "#ff9500", "#ff3b30", "#af52de", "#5ac8fa"];
    iconColors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(148 + i * 38, 290, 18, 18, 4);
      ctx.fill();
    });

    // Menu bar at top
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, 0, 512, 18);

    // Fake window
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath();
    ctx.roundRect(80, 40, 352, 230, 8);
    ctx.fill();

    // Window title bar
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(80, 40, 352, 24);

    // Traffic lights
    const lights = ["#ff5f57", "#febc2e", "#28c840"];
    lights.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(96 + i * 16, 52, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  return (
    <group position={[0, MAC.baseH, -MAC.baseD / 2]}>
      <group rotation={[angleRad, 0, 0]}>
        {/* Lid back — aluminum */}
        <mesh geometry={lidGeo} position={[0, MAC.lidH / 2, 0]} castShadow>
          <meshPhysicalMaterial
            color="#c0c0c8"
            metalness={0.95}
            roughness={0.06}
            clearcoat={0.4}
            clearcoatRoughness={0.08}
            envMapIntensity={1.5}
          />
        </mesh>

        {/* Bezel — dark frame around screen */}
        <mesh geometry={bezelGeo} position={[0, MAC.lidH / 2, MAC.lidThick / 2 + 0.001]}>
          <meshStandardMaterial color="#111115" metalness={0.1} roughness={0.95} />
        </mesh>

        {/* Screen — emissive display */}
        <mesh
          geometry={screenGeo}
          position={[0, MAC.lidH / 2, MAC.lidThick / 2 + 0.004]}
        >
          <meshStandardMaterial
            map={screenTexture}
            emissiveMap={screenTexture}
            emissive="#ffffff"
            emissiveIntensity={emissiveIntensity}
            metalness={0.0}
            roughness={0.15}
            toneMapped={false}
          />
        </mesh>

        {/* Webcam notch area */}
        <mesh position={[0, MAC.lidH - 0.04, MAC.lidThick / 2 + 0.003]}>
          <circleGeometry args={[0.025, 16]} />
          <meshStandardMaterial color="#0a0a0e" metalness={0.3} roughness={0.6} />
        </mesh>

        {/* Apple logo on back */}
        <mesh position={[0, MAC.lidH / 2, -MAC.lidThick / 2 - 0.001]}>
          <circleGeometry args={[0.15, 24]} />
          <meshPhysicalMaterial
            color="#d0d0d8"
            metalness={0.98}
            roughness={0.03}
            clearcoat={1}
            envMapIntensity={2}
          />
        </mesh>
      </group>
    </group>
  );
};

// ── MacBook Assembly ──

const MacBook: React.FC<{ lidAngle: number; position: Vec3 }> = ({
  lidAngle,
  position,
}) => (
  <group position={position}>
    <MacBookBase />
    <MacBookLid openAngle={lidAngle} />
  </group>
);

// ── iPhone — loaded from GLB ──

const IPHONE_URL = staticFile("models/iphone.glb");
useGLTF.preload(IPHONE_URL);

const IPhone: React.FC<{
  position: Vec3;
  rotation: Vec3;
  screenEmissive: number;
}> = ({ position, rotation, screenEmissive }) => {
  const gltf = useGLTF(IPHONE_URL);
  const cloned = useMemo(() => {
    const scene = gltf.scene.clone(true);
    // Set screen emission on the emissive material (mat index 10 in the GLB)
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive && mat.emissiveIntensity > 0) {
          // This is the screen material — boost its emission
          mat.emissiveIntensity = screenEmissive;
          mat.emissive.set(0.4, 0.6, 1.0);
          mat.toneMapped = false;
        }
        if (mat) {
          mat.envMapIntensity = 1.5;
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return scene;
  }, [gltf.scene, screenEmissive]);

  return (
    <group position={position} rotation={rotation} scale={[0.6, 0.6, 0.6]}>
      <primitive object={cloned} />
    </group>
  );
};

// ── Tabletop — large reflective dark surface ──

const Tabletop: React.FC = () => {
  return (
    <group>
      {/* Main surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[25, 25]} />
        <meshPhysicalMaterial
          color="#1a1a20"
          metalness={0.05}
          roughness={0.35}
          clearcoat={0.6}
          clearcoatRoughness={0.15}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Subtle reflection plane — slightly above to catch reflections */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.019, 0]}>
        <planeGeometry args={[25, 25]} />
        <meshPhysicalMaterial
          color="#000000"
          metalness={0.0}
          roughness={0.2}
          transparent
          opacity={0.15}
          envMapIntensity={1.2}
        />
      </mesh>
    </group>
  );
};

// ── Camera updater ──

const CameraUpdater: React.FC<{ position: Vec3; target: Vec3; fov: number }> = ({
  position,
  target,
  fov,
}) => {
  const { camera } = useThree();
  if (camera) {
    camera.position.set(...position);
    (camera as THREE.PerspectiveCamera).fov = fov;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    camera.lookAt(new THREE.Vector3(...target));
  }
  return null;
};

// ── Animation hooks ──

function useMacLidAngle(frame: number): number {
  if (frame >= PHASE.focusPhone[0]) return 0;
  if (frame >= PHASE.unfocusMac[0]) {
    const p = phaseProgress(frame, PHASE.unfocusMac[0], PHASE.unfocusMac[1]);
    return interpolate(p, [0, 1], [110, 0]);
  }
  if (frame >= PHASE.focusMac[0]) {
    const p = phaseProgress(frame, PHASE.focusMac[0], PHASE.focusMac[0] + 25);
    return interpolate(p, [0, 1], [15, 110]);
  }
  if (frame >= PHASE.hoverMac[0]) {
    const p = phaseProgress(frame, PHASE.hoverMac[0], PHASE.hoverMac[0] + 15);
    return interpolate(p, [0, 1], [0, 15]);
  }
  return 0;
}

function usePhoneTransform(frame: number): {
  position: Vec3;
  rotation: Vec3;
  screenEmissive: number;
} {
  // Phone rests face-down to the right of the MacBook
  const basePos: Vec3 = [2.2, 0.05, 0.4];
  const baseFacedown: Vec3 = [Math.PI, 0, 0.15];

  let position: Vec3;
  let rotation: Vec3;
  let screenEmissive = 0;

  if (frame >= PHASE.focusPhone[1] - 10) {
    // Settling back down
    const p = phaseProgress(frame, PHASE.focusPhone[1] - 10, PHASE.outro[0] + 15);
    position = [basePos[0], interpolate(p, [0, 1], [basePos[1] + 0.9, basePos[1]]), basePos[2]];
    rotation = [
      interpolate(p, [0, 1], [-0.3, Math.PI]),
      interpolate(p, [0, 1], [-0.15, 0]),
      interpolate(p, [0, 1], [0.05, 0.15]),
    ];
    screenEmissive = interpolate(p, [0, 1], [2.5, 0]);
  } else if (frame >= PHASE.focusPhone[0]) {
    // Lifting and flipping to show screen
    const p = phaseProgress(frame, PHASE.focusPhone[0], PHASE.focusPhone[0] + 35);
    position = [basePos[0], basePos[1] + p * 0.9, basePos[2] - p * 0.15];
    rotation = [
      interpolate(p, [0, 1], [Math.PI, -0.3]),
      interpolate(p, [0, 1], [0, -0.15]),
      interpolate(p, [0, 1], [0.15, 0.05]),
    ];
    screenEmissive = interpolate(p, [0, 1], [0, 2.5]);
  } else {
    position = basePos;
    rotation = baseFacedown;
  }

  return { position, rotation, screenEmissive };
}

function useCameraAnimation(frame: number): {
  position: Vec3;
  target: Vec3;
  fov: number;
} {
  // Wider establishing shot → intimate device close-ups
  const startPos: Vec3 = [0, 6.0, 7.0];
  const frontPos: Vec3 = [0.3, 3.8, 5.8];
  const macPos: Vec3 = [-0.5, 2.5, 3.2];
  const phoneCamPos: Vec3 = [3.0, 2.2, 2.8];

  const tableCenter: Vec3 = [0.5, 0.1, 0];
  const macTarget: Vec3 = [-0.3, 0.8, -0.5];
  const phoneTarget: Vec3 = [2.2, 0.5, 0.4];

  let position: Vec3;
  let target: Vec3;
  let fov = 35;

  if (frame <= PHASE.intro[1]) {
    const t = phaseProgress(frame, PHASE.intro[0], PHASE.intro[1]);
    position = lerpVec3(startPos, frontPos, t);
    target = tableCenter;
    fov = interpolate(t, [0, 1], [30, 35]);
  } else if (frame <= PHASE.hoverMac[1]) {
    const hoverEnd: Vec3 = [frontPos[0] - 0.2, frontPos[1] - 0.15, frontPos[2] - 0.3];
    const t = phaseProgress(frame, PHASE.hoverMac[0], PHASE.hoverMac[1]);
    position = lerpVec3(frontPos, hoverEnd, t);
    target = tableCenter;
  } else if (frame <= PHASE.unfocusMac[0]) {
    const from: Vec3 = [frontPos[0] - 0.2, frontPos[1] - 0.15, frontPos[2] - 0.3];
    const t = phaseProgress(frame, PHASE.focusMac[0], PHASE.focusMac[0] + 30);
    position = lerpVec3(from, macPos, t);
    target = lerpVec3(tableCenter, macTarget, t);
    fov = interpolate(t, [0, 1], [35, 32]);
  } else if (frame <= PHASE.focusPhone[0]) {
    const t = phaseProgress(frame, PHASE.unfocusMac[0], PHASE.unfocusMac[1]);
    position = lerpVec3(macPos, frontPos, t);
    target = lerpVec3(macTarget, tableCenter, t);
    fov = interpolate(t, [0, 1], [32, 35]);
  } else if (frame <= PHASE.outro[0]) {
    const t = phaseProgress(frame, PHASE.focusPhone[0], PHASE.focusPhone[0] + 30);
    position = lerpVec3(frontPos, phoneCamPos, t);
    target = lerpVec3(tableCenter, phoneTarget, t);
    fov = interpolate(t, [0, 1], [35, 30]);
  } else {
    const t = phaseProgress(frame, PHASE.outro[0], PHASE.outro[1]);
    position = lerpVec3(phoneCamPos, startPos, t);
    target = lerpVec3(phoneTarget, tableCenter, t);
    fov = interpolate(t, [0, 1], [30, 35]);
  }

  return { position, target, fov };
}

// ── Studio lighting environment ──

const StudioLighting: React.FC = () => (
  <>
    {/* Key light — warm, upper-right */}
    <directionalLight
      position={[5, 8, 4]}
      intensity={2.0}
      color="#fff5e6"
      castShadow
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
      shadow-camera-far={20}
      shadow-camera-near={0.1}
      shadow-camera-left={-6}
      shadow-camera-right={6}
      shadow-camera-top={6}
      shadow-camera-bottom={-6}
      shadow-bias={-0.0005}
    />

    {/* Fill light — cool blue, left side */}
    <directionalLight position={[-4, 5, 2]} intensity={0.8} color="#c8d8f0" />

    {/* Rim light — from behind, creates edge definition */}
    <directionalLight position={[0, 3, -5]} intensity={0.6} color="#e0e0ff" />

    {/* Under-fill — bounced light from table */}
    <pointLight position={[0, 0.5, 2]} intensity={0.3} color="#ffffff" distance={8} />

    {/* Ambient fill — very low, keeps shadows from going pure black */}
    <ambientLight intensity={0.15} color="#b0b8c8" />

    {/* HDR Environment for reflections */}
    <Environment resolution={256}>
      {/* Main area light from above */}
      <Lightformer
        form="rect"
        intensity={3}
        position={[0, 5, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[10, 4, 1]}
        color="#ffffff"
      />
      {/* Right accent */}
      <Lightformer
        form="rect"
        intensity={1.5}
        position={[5, 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[6, 3, 1]}
        color="#e8e0ff"
      />
      {/* Left fill */}
      <Lightformer
        form="rect"
        intensity={1.0}
        position={[-5, 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[6, 3, 1]}
        color="#ffe8d0"
      />
      {/* Back rim */}
      <Lightformer
        form="rect"
        intensity={0.8}
        position={[0, 3, -5]}
        rotation={[0, 0, 0]}
        scale={[8, 2, 1]}
        color="#d0d8ff"
      />
      {/* Ground bounce */}
      <Lightformer
        form="rect"
        intensity={0.3}
        position={[0, -1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[10, 10, 1]}
        color="#2a2a30"
      />
    </Environment>
  </>
);

// ── Scene ──

const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const macLidAngle = useMacLidAngle(frame);
  const phone = usePhoneTransform(frame);
  const cam = useCameraAnimation(frame);

  return (
    <>
      <CameraUpdater position={cam.position} target={cam.target} fov={cam.fov} />
      <StudioLighting />

      <Tabletop />

      {/* Contact shadows on ground plane */}
      <ContactShadows
        position={[0, -0.015, 0]}
        opacity={0.5}
        scale={12}
        blur={2.5}
        far={4}
        resolution={256}
        color="#000000"
      />

      <MacBook lidAngle={macLidAngle} position={[-0.5, 0, -0.2]} />

      <IPhone
        position={phone.position}
        rotation={phone.rotation}
        screenEmissive={phone.screenEmissive}
      />

      {/* Post-processing: bloom for screen glow */}
      <EffectComposer>
        <Bloom
          intensity={0.4}
          luminanceThreshold={0.8}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
};

// ── Main export ──

export const DeviceShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#111116" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 30, near: 0.1, far: 100, position: [0, 6.0, 7.0] }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
