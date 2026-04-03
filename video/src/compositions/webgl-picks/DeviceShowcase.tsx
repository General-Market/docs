// Source: https://tympanus.net/Tutorials/DeviceShowcase/
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  ContactShadows,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

type Vec3 = [number, number, number];

// ── Animation timeline (600 frames @ 60fps = 10s) ──

const PHASE = {
  establish: [0, 90] as const,
  descend: [90, 150] as const,
  macOpen: [150, 240] as const,
  macGlow: [240, 300] as const,
  panToPhone: [300, 360] as const,
  phoneLift: [360, 440] as const,
  phoneShow: [440, 500] as const,
  settle: [500, 540] as const,
  outro: [540, 600] as const,
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
  keyRows: 5,
  keyCols: 13,
  trackpadW: 1.1,
  trackpadD: 0.7,
};

// ── iPhone dimensions ──

const PHONE = {
  w: 0.72,
  h: 1.48,
  d: 0.08,
  cornerRadius: 0.12,
  screenInset: 0.04,
  cameraSize: 0.22,
  dynamicIslandW: 0.22,
  dynamicIslandH: 0.06,
};

// ── MacBook Base ──

const MacBookBase: React.FC = () => {
  const bodyGeo = useMemo(
    () => new THREE.BoxGeometry(MAC.baseW, MAC.baseH, MAC.baseD, 2, 1, 2),
    [],
  );
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

      {keys.map((k, i) => (
        <mesh key={i} geometry={keyGeo} position={[k.x, MAC.baseH + 0.008, k.z]} castShadow>
          <meshStandardMaterial color="#2a2a30" metalness={0.15} roughness={0.85} />
        </mesh>
      ))}

      <mesh geometry={trackpadGeo} position={[0, MAC.baseH + 0.003, MAC.baseD * 0.28]} castShadow>
        <meshPhysicalMaterial
          color="#a0a0a8"
          metalness={0.7}
          roughness={0.05}
          clearcoat={0.8}
          clearcoatRoughness={0.05}
          envMapIntensity={1.8}
        />
      </mesh>

      <mesh position={[0, MAC.baseH * 0.4, MAC.baseD / 2 - 0.01]}>
        <boxGeometry args={[MAC.baseW * 0.95, MAC.baseH * 0.3, 0.01]} />
        <meshStandardMaterial color="#999" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
};

// ── MacBook Lid ──

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

  const screenTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext("2d")!;

    const grad = ctx.createLinearGradient(0, 0, 512, 320);
    grad.addColorStop(0, "#0a1628");
    grad.addColorStop(0.5, "#142040");
    grad.addColorStop(1, "#0a1628");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 320);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(130, 285, 252, 28, 8);
    ctx.fill();

    const iconColors = ["#3478f6", "#34c759", "#ff9500", "#ff3b30", "#af52de", "#5ac8fa"];
    iconColors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(148 + i * 38, 290, 18, 18, 4);
      ctx.fill();
    });

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, 0, 512, 18);

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath();
    ctx.roundRect(80, 40, 352, 230, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(80, 40, 352, 24);

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

        <mesh geometry={bezelGeo} position={[0, MAC.lidH / 2, MAC.lidThick / 2 + 0.001]}>
          <meshStandardMaterial color="#111115" metalness={0.1} roughness={0.95} />
        </mesh>

        <mesh geometry={screenGeo} position={[0, MAC.lidH / 2, MAC.lidThick / 2 + 0.004]}>
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

        <mesh position={[0, MAC.lidH - 0.04, MAC.lidThick / 2 + 0.003]}>
          <circleGeometry args={[0.025, 16]} />
          <meshStandardMaterial color="#0a0a0e" metalness={0.3} roughness={0.6} />
        </mesh>

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

// ── iPhone (procedural geometry) ──

const IPhoneBody: React.FC<{ screenEmissive: number }> = ({ screenEmissive }) => {
  const bodyShape = useMemo(() => {
    const shape = new THREE.Shape();
    const w = PHONE.w / 2;
    const h = PHONE.h / 2;
    const r = PHONE.cornerRadius;
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);
    return shape;
  }, []);

  const bodyGeo = useMemo(() => {
    const settings: THREE.ExtrudeGeometryOptions = {
      depth: PHONE.d,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 3,
    };
    return new THREE.ExtrudeGeometry(bodyShape, settings);
  }, [bodyShape]);

  const screenShape = useMemo(() => {
    const inset = PHONE.screenInset;
    const w = PHONE.w / 2 - inset;
    const h = PHONE.h / 2 - inset;
    const r = PHONE.cornerRadius - inset * 0.5;
    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);
    return shape;
  }, []);

  const screenGeo = useMemo(() => new THREE.ShapeGeometry(screenShape), [screenShape]);

  const screenTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 390;
    canvas.height = 844;
    const ctx = canvas.getContext("2d")!;

    const grad = ctx.createLinearGradient(0, 0, 0, 844);
    grad.addColorStop(0, "#1a0a30");
    grad.addColorStop(0.4, "#0a1a38");
    grad.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 390, 844);

    // Status bar
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("9:41", 30, 55);
    ctx.fillText("100%", 320, 55);

    // Dynamic island
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.roundRect(130, 18, 130, 32, 16);
    ctx.fill();

    // Large time
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 72px sans-serif";
    ctx.fillText("9:41", 60, 250);

    // Date
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "16px sans-serif";
    ctx.fillText("Wednesday, April 2", 60, 280);

    // Notification cards
    const cardColors = [
      { bg: "rgba(40,60,120,0.6)", accent: "#5ac8fa" },
      { bg: "rgba(60,30,80,0.5)", accent: "#bf5af2" },
    ];
    cardColors.forEach((card, i) => {
      const y = 340 + i * 90;
      ctx.fillStyle = card.bg;
      ctx.beginPath();
      ctx.roundRect(20, y, 350, 72, 16);
      ctx.fill();
      ctx.fillStyle = card.accent;
      ctx.beginPath();
      ctx.arc(48, y + 36, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(i === 0 ? "Messages" : "Calendar", 72, y + 30);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "12px sans-serif";
      ctx.fillText(i === 0 ? "2 new messages" : "Meeting in 30 min", 72, y + 50);
    });

    // Bottom dock
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.roundRect(100, 790, 190, 5, 3);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Camera module — back side
  const cameraRingGeo = useMemo(() => new THREE.RingGeometry(0.04, 0.055, 24), []);
  const lensGeo = useMemo(() => new THREE.CircleGeometry(0.038, 24), []);

  return (
    <group rotation={[0, 0, 0]}>
      {/* Body — centered so extrude goes from 0 to depth along Z */}
      <mesh geometry={bodyGeo} position={[0, 0, -PHONE.d / 2]} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#2a2a30"
          metalness={0.85}
          roughness={0.1}
          clearcoat={0.3}
          clearcoatRoughness={0.12}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* Side band — titanium frame */}
      <mesh geometry={bodyGeo} position={[0, 0, -PHONE.d / 2]} castShadow>
        <meshPhysicalMaterial
          color="#8a8a90"
          metalness={0.95}
          roughness={0.08}
          clearcoat={0.5}
          envMapIntensity={1.8}
          wireframe={false}
        />
      </mesh>

      {/* Screen — front face */}
      <mesh geometry={screenGeo} position={[0, 0, PHONE.d / 2 + 0.002]}>
        <meshStandardMaterial
          map={screenTexture}
          emissiveMap={screenTexture}
          emissive="#ffffff"
          emissiveIntensity={screenEmissive}
          metalness={0.0}
          roughness={0.12}
          toneMapped={false}
        />
      </mesh>

      {/* Screen glass overlay */}
      <mesh geometry={screenGeo} position={[0, 0, PHONE.d / 2 + 0.003]}>
        <meshPhysicalMaterial
          color="#000000"
          transparent
          opacity={0.04}
          metalness={0.0}
          roughness={0.05}
          clearcoat={1}
          clearcoatRoughness={0.02}
          envMapIntensity={2.5}
        />
      </mesh>

      {/* Camera module bump — back */}
      <mesh position={[-0.14, 0.42, -PHONE.d / 2 - 0.012]} castShadow>
        <boxGeometry args={[PHONE.cameraSize + 0.06, PHONE.cameraSize + 0.06, 0.02]} />
        <meshPhysicalMaterial
          color="#2a2a30"
          metalness={0.85}
          roughness={0.12}
          clearcoat={0.3}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* Camera lenses (3 in triangle) */}
      {[
        [-0.19, 0.47],
        [-0.09, 0.47],
        [-0.14, 0.37],
      ].map(([x, y], i) => (
        <group key={i} position={[x, y, -PHONE.d / 2 - 0.023]}>
          <mesh geometry={cameraRingGeo}>
            <meshPhysicalMaterial color="#555" metalness={0.95} roughness={0.05} envMapIntensity={2} />
          </mesh>
          <mesh geometry={lensGeo}>
            <meshPhysicalMaterial
              color="#0a0a1a"
              metalness={0.3}
              roughness={0.02}
              clearcoat={1}
              clearcoatRoughness={0.01}
              envMapIntensity={3}
            />
          </mesh>
        </group>
      ))}

      {/* Power button — right side */}
      <mesh position={[PHONE.w / 2 + 0.005, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.15, 0.015, 0.025]} />
        <meshPhysicalMaterial color="#666" metalness={0.95} roughness={0.08} envMapIntensity={1.5} />
      </mesh>

      {/* Volume buttons — left side */}
      {[0.25, 0.1].map((y, i) => (
        <mesh key={i} position={[-PHONE.w / 2 - 0.005, y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.1, 0.015, 0.025]} />
          <meshPhysicalMaterial color="#666" metalness={0.95} roughness={0.08} envMapIntensity={1.5} />
        </mesh>
      ))}
    </group>
  );
};

const IPhone: React.FC<{
  position: Vec3;
  rotation: Vec3;
  screenEmissive: number;
}> = ({ position, rotation, screenEmissive }) => (
  <group position={position} rotation={rotation}>
    <IPhoneBody screenEmissive={screenEmissive} />
  </group>
);

// ── Tabletop ──

const Tabletop: React.FC = () => (
  <group>
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
  if (frame < PHASE.macOpen[0]) return 0;
  if (frame < PHASE.macOpen[0] + 10) {
    const p = phaseProgress(frame, PHASE.macOpen[0], PHASE.macOpen[0] + 10);
    return interpolate(p, [0, 1], [0, 8]);
  }
  if (frame < PHASE.macOpen[1]) {
    const p = phaseProgress(frame, PHASE.macOpen[0] + 10, PHASE.macOpen[1]);
    return interpolate(p, [0, 1], [8, 115]);
  }
  if (frame < PHASE.settle[0]) return 115;
  if (frame < PHASE.settle[1]) {
    const p = phaseProgress(frame, PHASE.settle[0], PHASE.settle[1]);
    return interpolate(p, [0, 1], [115, 105]);
  }
  return 105;
}

function usePhoneTransform(frame: number): {
  position: Vec3;
  rotation: Vec3;
  screenEmissive: number;
} {
  // Phone lies face-down to the right of the MacBook
  const restPos: Vec3 = [2.4, 0.05, 0.3];
  const restRot: Vec3 = [Math.PI / 2, 0, 0.1]; // face-down, lying flat
  const liftedPos: Vec3 = [2.4, 1.2, 0.1];
  const liftedRot: Vec3 = [-0.15, -0.2, 0.05]; // face toward camera, slight tilt

  if (frame < PHASE.phoneLift[0]) {
    return { position: restPos, rotation: restRot, screenEmissive: 0 };
  }

  if (frame < PHASE.phoneLift[1]) {
    const p = phaseProgress(frame, PHASE.phoneLift[0], PHASE.phoneLift[1]);
    return {
      position: lerpVec3(restPos, liftedPos, p),
      rotation: lerpVec3(restRot, liftedRot, p),
      screenEmissive: interpolate(p, [0, 1], [0, 2.8]),
    };
  }

  if (frame < PHASE.settle[0]) {
    return { position: liftedPos, rotation: liftedRot, screenEmissive: 2.8 };
  }

  if (frame < PHASE.settle[1]) {
    const p = phaseProgress(frame, PHASE.settle[0], PHASE.settle[1]);
    const settlePos: Vec3 = [2.4, 0.7, 0.2];
    const settleRot: Vec3 = [-0.1, -0.15, 0.03];
    return {
      position: lerpVec3(liftedPos, settlePos, p),
      rotation: lerpVec3(liftedRot, settleRot, p),
      screenEmissive: interpolate(p, [0, 1], [2.8, 2.0]),
    };
  }

  // Outro — phone settles back to rest
  const p = phaseProgress(frame, PHASE.outro[0], PHASE.outro[1]);
  const settlePos: Vec3 = [2.4, 0.7, 0.2];
  const settleRot: Vec3 = [-0.1, -0.15, 0.03];
  return {
    position: lerpVec3(settlePos, restPos, p),
    rotation: lerpVec3(settleRot, restRot, p),
    screenEmissive: interpolate(p, [0, 1], [2.0, 0]),
  };
}

function useCameraAnimation(frame: number): {
  position: Vec3;
  target: Vec3;
  fov: number;
} {
  // Establishing: high overhead, wide FOV, both devices visible
  const overheadPos: Vec3 = [0.5, 10, 8];
  const overheadTarget: Vec3 = [0.5, 0, -0.2];

  // Descended: comfortable 3/4 view, both devices in frame
  const frontPos: Vec3 = [0.5, 5.5, 6.5];
  const frontTarget: Vec3 = [0.5, 0.2, -0.3];

  // MacBook close-up
  const macPos: Vec3 = [-0.3, 3.0, 3.5];
  const macTarget: Vec3 = [-0.5, 0.8, -0.5];

  // Phone close-up
  const phonePos: Vec3 = [3.2, 2.5, 2.8];
  const phoneTarget: Vec3 = [2.4, 0.8, 0.2];

  // Final pullback — wider than start
  const finalPos: Vec3 = [0.5, 7, 8.5];
  const finalTarget: Vec3 = [0.5, 0.3, -0.2];

  if (frame <= PHASE.establish[1]) {
    const t = phaseProgress(frame, PHASE.establish[0], PHASE.establish[1]);
    return {
      position: lerpVec3(overheadPos, frontPos, t),
      target: lerpVec3(overheadTarget, frontTarget, t),
      fov: interpolate(t, [0, 1], [28, 32]),
    };
  }

  if (frame <= PHASE.descend[1]) {
    const t = phaseProgress(frame, PHASE.descend[0], PHASE.descend[1]);
    return {
      position: lerpVec3(frontPos, macPos, t * 0.5),
      target: lerpVec3(frontTarget, macTarget, t * 0.3),
      fov: interpolate(t, [0, 1], [32, 33]),
    };
  }

  if (frame <= PHASE.macGlow[1]) {
    const enterT = phaseProgress(frame, PHASE.macOpen[0], PHASE.macOpen[0] + 40);
    return {
      position: lerpVec3(
        lerpVec3(frontPos, macPos, 0.5),
        macPos,
        enterT,
      ),
      target: lerpVec3(
        lerpVec3(frontTarget, macTarget, 0.3),
        macTarget,
        enterT,
      ),
      fov: interpolate(enterT, [0, 1], [33, 30]),
    };
  }

  if (frame <= PHASE.panToPhone[1]) {
    const t = phaseProgress(frame, PHASE.panToPhone[0], PHASE.panToPhone[1]);
    return {
      position: lerpVec3(macPos, frontPos, t),
      target: lerpVec3(macTarget, frontTarget, t),
      fov: interpolate(t, [0, 1], [30, 33]),
    };
  }

  if (frame <= PHASE.phoneShow[1]) {
    const t = phaseProgress(frame, PHASE.phoneLift[0], PHASE.phoneShow[0]);
    return {
      position: lerpVec3(frontPos, phonePos, t),
      target: lerpVec3(frontTarget, phoneTarget, t),
      fov: interpolate(t, [0, 1], [33, 28]),
    };
  }

  if (frame <= PHASE.settle[1]) {
    const t = phaseProgress(frame, PHASE.settle[0], PHASE.settle[1]);
    return {
      position: lerpVec3(phonePos, finalPos, t * 0.5),
      target: lerpVec3(phoneTarget, finalTarget, t * 0.5),
      fov: interpolate(t, [0, 1], [28, 30]),
    };
  }

  // Outro — smooth pullback to establishing
  const t = phaseProgress(frame, PHASE.outro[0], PHASE.outro[1]);
  const midPos = lerpVec3(phonePos, finalPos, 0.5);
  const midTarget = lerpVec3(phoneTarget, finalTarget, 0.5);
  return {
    position: lerpVec3(midPos, finalPos, t),
    target: lerpVec3(midTarget, finalTarget, t),
    fov: interpolate(t, [0, 1], [30, 28]),
  };
}

// ── Studio lighting environment ──

const StudioLighting: React.FC = () => (
  <>
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
    <directionalLight position={[-4, 5, 2]} intensity={0.8} color="#c8d8f0" />
    <directionalLight position={[0, 3, -5]} intensity={0.6} color="#e0e0ff" />
    <pointLight position={[0, 0.5, 2]} intensity={0.3} color="#ffffff" distance={8} />
    <ambientLight intensity={0.15} color="#b0b8c8" />

    <Environment resolution={256}>
      <Lightformer
        form="rect"
        intensity={3}
        position={[0, 5, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[10, 4, 1]}
        color="#ffffff"
      />
      <Lightformer
        form="rect"
        intensity={1.5}
        position={[5, 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[6, 3, 1]}
        color="#e8e0ff"
      />
      <Lightformer
        form="rect"
        intensity={1.0}
        position={[-5, 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[6, 3, 1]}
        color="#ffe8d0"
      />
      <Lightformer
        form="rect"
        intensity={0.8}
        position={[0, 3, -5]}
        rotation={[0, 0, 0]}
        scale={[8, 2, 1]}
        color="#d0d8ff"
      />
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
        camera={{ fov: 28, near: 0.1, far: 100, position: [0.5, 10, 8] }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
