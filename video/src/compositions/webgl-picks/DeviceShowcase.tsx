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
  RoundedBox,
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
  screenInset: 0.08,
  keyRows: 6,
  keyCols: 14,
  trackpadW: 1.1,
  trackpadD: 0.7,
  cornerRadius: 0.06,
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

// ── Rounded rectangle shape helper ──

function makeRoundedRectShape(
  width: number,
  height: number,
  radius: number,
): THREE.Shape {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
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
}

// ── Keycap geometry: each key is a small rounded box ──

const KeyCap: React.FC<{
  x: number;
  z: number;
  width?: number;
  depth?: number;
  y: number;
}> = ({ x, z, width = 0.155, depth = 0.155, y }) => (
  <RoundedBox
    args={[width, 0.018, depth]}
    radius={0.02}
    smoothness={2}
    position={[x, y, z]}
    castShadow
  >
    <meshStandardMaterial color="#1e1e24" metalness={0.12} roughness={0.88} />
  </RoundedBox>
);

// ── MacBook Base ──

const MacBookBase: React.FC = () => {
  const trackpadShape = useMemo(
    () => makeRoundedRectShape(MAC.trackpadW, MAC.trackpadD, 0.06),
    [],
  );
  const trackpadGeo = useMemo(
    () => new THREE.ShapeGeometry(trackpadShape, 8),
    [trackpadShape],
  );

  const keys = useMemo(() => {
    const result: { x: number; z: number; w: number }[] = [];
    const keyW = 0.155;
    const gap = 0.02;
    const stride = keyW + gap;
    const totalW = MAC.keyCols * stride - gap;
    const startX = -totalW / 2 + keyW / 2;
    const totalRows = MAC.keyRows;
    const startZ = -MAC.baseD * 0.18;

    for (let row = 0; row < totalRows; row++) {
      const cols = row === totalRows - 1 ? 12 : MAC.keyCols;
      for (let col = 0; col < cols; col++) {
        const w =
          row === totalRows - 1 && col === 5 ? keyW * 3.5 + gap * 2.5 : keyW;
        result.push({
          x: startX + col * stride + (w - keyW) / 2,
          z: startZ - row * stride,
          w,
        });
      }
      // Skip duplicates for spacebar row
      if (row === totalRows - 1) break;
    }
    return result;
  }, []);

  const topY = MAC.baseH;

  return (
    <group>
      {/* Main body — rounded edges */}
      <RoundedBox
        args={[MAC.baseW, MAC.baseH, MAC.baseD]}
        radius={MAC.cornerRadius}
        smoothness={4}
        position={[0, MAC.baseH / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#c0c0c8"
          metalness={0.95}
          roughness={0.07}
          clearcoat={0.35}
          clearcoatRoughness={0.08}
          envMapIntensity={1.6}
        />
      </RoundedBox>

      {/* Top deck surface — slightly darker, inset for palm rest feel */}
      <mesh
        position={[0, topY + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[MAC.baseW - 0.06, MAC.baseD - 0.06]} />
        <meshPhysicalMaterial
          color="#b0b0b8"
          metalness={0.88}
          roughness={0.1}
          clearcoat={0.25}
          envMapIntensity={1.3}
        />
      </mesh>

      {/* Keyboard well — recessed area */}
      <mesh position={[0, topY - 0.002, -MAC.baseD * 0.12]} castShadow>
        <boxGeometry
          args={[
            MAC.keyCols * 0.175 + 0.08,
            0.004,
            MAC.keyRows * 0.175 + 0.06,
          ]}
        />
        <meshStandardMaterial
          color="#1a1a20"
          metalness={0.15}
          roughness={0.9}
        />
      </mesh>

      {/* Individual keycaps with rounded geometry */}
      {keys.map((k, i) => (
        <KeyCap
          key={i}
          x={k.x}
          z={k.z}
          y={topY + 0.007}
          width={k.w}
        />
      ))}

      {/* Trackpad — recessed into surface */}
      <mesh
        position={[0, topY - 0.001, MAC.baseD * 0.3]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <boxGeometry
          args={[MAC.trackpadW + 0.02, MAC.trackpadD + 0.02, 0.003]}
        />
        <meshStandardMaterial
          color="#888890"
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>

      {/* Trackpad glass surface */}
      <mesh
        geometry={trackpadGeo}
        position={[0, topY + 0.0005, MAC.baseD * 0.3]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshPhysicalMaterial
          color="#a8a8b0"
          metalness={0.6}
          roughness={0.03}
          clearcoat={0.9}
          clearcoatRoughness={0.03}
          envMapIntensity={2.0}
        />
      </mesh>

      {/* Hinge cylinder */}
      <mesh
        position={[0, MAC.baseH * 0.55, -MAC.baseD / 2 + 0.02]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.032, 0.032, MAC.baseW * 0.92, 24]} />
        <meshPhysicalMaterial
          color="#909098"
          metalness={0.95}
          roughness={0.06}
          clearcoat={0.4}
          envMapIntensity={1.8}
        />
      </mesh>

      {/* Front edge chamfer accent */}
      <mesh position={[0, MAC.baseH * 0.35, MAC.baseD / 2 - 0.015]}>
        <boxGeometry args={[MAC.baseW * 0.97, MAC.baseH * 0.15, 0.008]} />
        <meshPhysicalMaterial
          color="#a0a0a8"
          metalness={0.92}
          roughness={0.04}
          envMapIntensity={1.8}
        />
      </mesh>
    </group>
  );
};

// ── MacBook Lid ──

const MacBookLid: React.FC<{ openAngle: number }> = ({ openAngle }) => {
  const screenW = MAC.lidW - MAC.screenInset * 2;
  const screenH = MAC.lidH - MAC.screenInset * 2;
  const screenGeo = useMemo(
    () => new THREE.PlaneGeometry(screenW, screenH),
    [],
  );

  const bezelShape = useMemo(
    () => makeRoundedRectShape(MAC.lidW - 0.02, MAC.lidH - 0.02, 0.04),
    [],
  );
  const bezelGeo = useMemo(
    () =>
      new THREE.ExtrudeGeometry(bezelShape, {
        depth: MAC.lidThick + 0.003,
        bevelEnabled: false,
      }),
    [bezelShape],
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

    const iconColors = [
      "#3478f6",
      "#34c759",
      "#ff9500",
      "#ff3b30",
      "#af52de",
      "#5ac8fa",
    ];
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
    <group position={[0, MAC.baseH, -MAC.baseD / 2 + 0.02]}>
      <group rotation={[angleRad, 0, 0]}>
        {/* Lid back panel — rounded */}
        <RoundedBox
          args={[MAC.lidW, MAC.lidH, MAC.lidThick]}
          radius={0.03}
          smoothness={4}
          position={[0, MAC.lidH / 2, 0]}
          castShadow
        >
          <meshPhysicalMaterial
            color="#c4c4cc"
            metalness={0.95}
            roughness={0.05}
            clearcoat={0.45}
            clearcoatRoughness={0.06}
            envMapIntensity={1.6}
          />
        </RoundedBox>

        {/* Bezel — thin dark frame around screen */}
        <mesh
          geometry={bezelGeo}
          position={[0, MAC.lidH / 2, -0.001]}
        >
          <meshStandardMaterial
            color="#0c0c10"
            metalness={0.08}
            roughness={0.95}
          />
        </mesh>

        {/* Screen */}
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

        {/* Webcam */}
        <mesh
          position={[0, MAC.lidH - MAC.screenInset * 0.5, MAC.lidThick / 2 + 0.003]}
        >
          <circleGeometry args={[0.02, 16]} />
          <meshStandardMaterial
            color="#0a0a0e"
            metalness={0.3}
            roughness={0.6}
          />
        </mesh>

        {/* Apple logo (back of lid) */}
        <mesh
          position={[0, MAC.lidH / 2, -MAC.lidThick / 2 - 0.001]}
        >
          <circleGeometry args={[0.14, 24]} />
          <meshPhysicalMaterial
            color="#d4d4dc"
            metalness={0.98}
            roughness={0.02}
            clearcoat={1}
            envMapIntensity={2.5}
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

// ── iPhone (procedural rounded body) ──

const IPhoneBody: React.FC<{ screenEmissive: number }> = ({
  screenEmissive,
}) => {
  const bodyShape = useMemo(
    () => makeRoundedRectShape(PHONE.w, PHONE.h, PHONE.cornerRadius),
    [],
  );

  const bodyGeo = useMemo(() => {
    const settings: THREE.ExtrudeGeometryOptions = {
      depth: PHONE.d,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 4,
    };
    return new THREE.ExtrudeGeometry(bodyShape, settings);
  }, [bodyShape]);

  const screenShape = useMemo(() => {
    const inset = PHONE.screenInset;
    return makeRoundedRectShape(
      PHONE.w - inset * 2,
      PHONE.h - inset * 2,
      PHONE.cornerRadius - inset * 0.5,
    );
  }, []);

  const screenGeo = useMemo(
    () => new THREE.ShapeGeometry(screenShape),
    [screenShape],
  );

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

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("9:41", 30, 55);
    ctx.fillText("100%", 320, 55);

    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.roundRect(130, 18, 130, 32, 16);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 72px sans-serif";
    ctx.fillText("9:41", 60, 250);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "16px sans-serif";
    ctx.fillText("Wednesday, April 2", 60, 280);

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
      ctx.fillText(
        i === 0 ? "2 new messages" : "Meeting in 30 min",
        72,
        y + 50,
      );
    });

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.roundRect(100, 790, 190, 5, 3);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const cameraRingGeo = useMemo(
    () => new THREE.RingGeometry(0.04, 0.055, 24),
    [],
  );
  const lensGeo = useMemo(() => new THREE.CircleGeometry(0.038, 24), []);

  const cameraBumpShape = useMemo(
    () => makeRoundedRectShape(PHONE.cameraSize + 0.06, PHONE.cameraSize + 0.06, 0.06),
    [],
  );
  const cameraBumpGeo = useMemo(
    () =>
      new THREE.ExtrudeGeometry(cameraBumpShape, {
        depth: 0.02,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.005,
        bevelSegments: 3,
      }),
    [cameraBumpShape],
  );

  return (
    <group>
      {/* Body */}
      <mesh
        geometry={bodyGeo}
        position={[0, 0, -PHONE.d / 2]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#2a2a30"
          metalness={0.85}
          roughness={0.1}
          clearcoat={0.3}
          clearcoatRoughness={0.12}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* Titanium frame band — slightly different tone */}
      <mesh geometry={bodyGeo} position={[0, 0, -PHONE.d / 2]}>
        <meshPhysicalMaterial
          color="#8a8a94"
          metalness={0.96}
          roughness={0.06}
          clearcoat={0.5}
          envMapIntensity={1.9}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Screen face */}
      <mesh
        geometry={screenGeo}
        position={[0, 0, PHONE.d / 2 + 0.002]}
      >
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
      <mesh
        geometry={screenGeo}
        position={[0, 0, PHONE.d / 2 + 0.003]}
      >
        <meshPhysicalMaterial
          color="#000000"
          transparent
          opacity={0.04}
          metalness={0.0}
          roughness={0.04}
          clearcoat={1}
          clearcoatRoughness={0.02}
          envMapIntensity={2.8}
        />
      </mesh>

      {/* Camera bump — rounded rectangle, back face */}
      <mesh
        geometry={cameraBumpGeo}
        position={[-0.14, 0.42, -PHONE.d / 2 - 0.025]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#2a2a30"
          metalness={0.88}
          roughness={0.1}
          clearcoat={0.35}
          envMapIntensity={1.3}
        />
      </mesh>

      {/* Camera lenses (3 in triangle) */}
      {(
        [
          [-0.19, 0.47],
          [-0.09, 0.47],
          [-0.14, 0.37],
        ] as [number, number][]
      ).map(([x, y], i) => (
        <group key={i} position={[x, y, -PHONE.d / 2 - 0.028]}>
          <mesh geometry={cameraRingGeo}>
            <meshPhysicalMaterial
              color="#555"
              metalness={0.95}
              roughness={0.04}
              envMapIntensity={2.2}
            />
          </mesh>
          <mesh geometry={lensGeo}>
            <meshPhysicalMaterial
              color="#080818"
              metalness={0.3}
              roughness={0.02}
              clearcoat={1}
              clearcoatRoughness={0.01}
              envMapIntensity={3}
            />
          </mesh>
        </group>
      ))}

      {/* Power button */}
      <RoundedBox
        args={[0.015, 0.15, 0.025]}
        radius={0.005}
        smoothness={2}
        position={[PHONE.w / 2 + 0.006, 0.2, 0]}
      >
        <meshPhysicalMaterial
          color="#777"
          metalness={0.95}
          roughness={0.06}
          envMapIntensity={1.6}
        />
      </RoundedBox>

      {/* Volume buttons */}
      {[0.25, 0.1].map((y, i) => (
        <RoundedBox
          key={i}
          args={[0.015, 0.1, 0.025]}
          radius={0.005}
          smoothness={2}
          position={[-PHONE.w / 2 - 0.006, y, 0]}
        >
          <meshPhysicalMaterial
            color="#777"
            metalness={0.95}
            roughness={0.06}
            envMapIntensity={1.6}
          />
        </RoundedBox>
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
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.02, 0]}
      receiveShadow
    >
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
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.019, 0]}
    >
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

const CameraUpdater: React.FC<{
  position: Vec3;
  target: Vec3;
  fov: number;
}> = ({ position, target, fov }) => {
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
  // Phone starts visible next to the MacBook, face-up, screen off
  const restPos: Vec3 = [2.2, 0.06, 0.5];
  const restRot: Vec3 = [-Math.PI / 2, 0, 0.08];

  // Lifted position: face toward camera
  const liftedPos: Vec3 = [2.2, 1.3, 0.3];
  const liftedRot: Vec3 = [-0.15, -0.2, 0.05];

  // Settle position
  const settlePos: Vec3 = [2.2, 0.8, 0.4];
  const settleRot: Vec3 = [-0.1, -0.15, 0.03];

  if (frame < PHASE.phoneLift[0]) {
    // Before lift: phone lies face-up, screen dim glow
    const earlyGlow =
      frame > PHASE.macGlow[0]
        ? interpolate(
            frame,
            [PHASE.macGlow[0], PHASE.macGlow[1]],
            [0, 0.4],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        : 0;
    return {
      position: restPos,
      rotation: restRot,
      screenEmissive: earlyGlow,
    };
  }

  if (frame < PHASE.phoneLift[1]) {
    const p = phaseProgress(frame, PHASE.phoneLift[0], PHASE.phoneLift[1]);
    return {
      position: lerpVec3(restPos, liftedPos, p),
      rotation: lerpVec3(restRot, liftedRot, p),
      screenEmissive: interpolate(p, [0, 1], [0.4, 2.8]),
    };
  }

  if (frame < PHASE.settle[0]) {
    return {
      position: liftedPos,
      rotation: liftedRot,
      screenEmissive: 2.8,
    };
  }

  if (frame < PHASE.settle[1]) {
    const p = phaseProgress(frame, PHASE.settle[0], PHASE.settle[1]);
    return {
      position: lerpVec3(liftedPos, settlePos, p),
      rotation: lerpVec3(liftedRot, settleRot, p),
      screenEmissive: interpolate(p, [0, 1], [2.8, 2.0]),
    };
  }

  // Outro: gentle drift back but stay visible — do NOT go face-down
  const p = phaseProgress(frame, PHASE.outro[0], PHASE.outro[1]);
  const outroPos: Vec3 = [2.2, 0.5, 0.5];
  const outroRot: Vec3 = [-0.3, -0.1, 0.03];
  return {
    position: lerpVec3(settlePos, outroPos, p),
    rotation: lerpVec3(settleRot, outroRot, p),
    screenEmissive: interpolate(p, [0, 1], [2.0, 0.8]),
  };
}

function useCameraAnimation(frame: number): {
  position: Vec3;
  target: Vec3;
  fov: number;
} {
  // Establishing: high 3/4 view, both devices clearly visible
  const overheadPos: Vec3 = [1.0, 8, 7];
  const overheadTarget: Vec3 = [0.8, 0, 0.1];

  // Descended: comfortable eye-level, both in frame
  const frontPos: Vec3 = [0.8, 5, 6];
  const frontTarget: Vec3 = [0.5, 0.2, -0.1];

  // MacBook close-up
  const macPos: Vec3 = [-0.2, 2.8, 3.2];
  const macTarget: Vec3 = [-0.5, 0.7, -0.4];

  // Phone close-up — offset to where the phone actually is
  const phonePos: Vec3 = [3.0, 2.2, 2.5];
  const phoneTarget: Vec3 = [2.2, 0.9, 0.3];

  // Final pullback — wide hero shot, both devices
  const finalPos: Vec3 = [0.8, 6, 7.5];
  const finalTarget: Vec3 = [0.8, 0.3, 0.0];

  if (frame <= PHASE.establish[1]) {
    const t = phaseProgress(
      frame,
      PHASE.establish[0],
      PHASE.establish[1],
    );
    return {
      position: lerpVec3(overheadPos, frontPos, t),
      target: lerpVec3(overheadTarget, frontTarget, t),
      fov: interpolate(t, [0, 1], [30, 33]),
    };
  }

  if (frame <= PHASE.descend[1]) {
    const t = phaseProgress(
      frame,
      PHASE.descend[0],
      PHASE.descend[1],
    );
    return {
      position: lerpVec3(frontPos, macPos, t * 0.5),
      target: lerpVec3(frontTarget, macTarget, t * 0.3),
      fov: interpolate(t, [0, 1], [33, 34]),
    };
  }

  if (frame <= PHASE.macGlow[1]) {
    const enterT = phaseProgress(
      frame,
      PHASE.macOpen[0],
      PHASE.macOpen[0] + 40,
    );
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
      fov: interpolate(enterT, [0, 1], [34, 30]),
    };
  }

  if (frame <= PHASE.panToPhone[1]) {
    const t = phaseProgress(
      frame,
      PHASE.panToPhone[0],
      PHASE.panToPhone[1],
    );
    return {
      position: lerpVec3(macPos, frontPos, t),
      target: lerpVec3(macTarget, frontTarget, t),
      fov: interpolate(t, [0, 1], [30, 33]),
    };
  }

  if (frame <= PHASE.phoneShow[1]) {
    const t = phaseProgress(
      frame,
      PHASE.phoneLift[0],
      PHASE.phoneShow[0],
    );
    return {
      position: lerpVec3(frontPos, phonePos, t),
      target: lerpVec3(frontTarget, phoneTarget, t),
      fov: interpolate(t, [0, 1], [33, 28]),
    };
  }

  if (frame <= PHASE.settle[1]) {
    const t = phaseProgress(
      frame,
      PHASE.settle[0],
      PHASE.settle[1],
    );
    return {
      position: lerpVec3(phonePos, finalPos, t * 0.6),
      target: lerpVec3(phoneTarget, finalTarget, t * 0.6),
      fov: interpolate(t, [0, 1], [28, 30]),
    };
  }

  // Outro — smooth pullback to wide hero
  const t = phaseProgress(frame, PHASE.outro[0], PHASE.outro[1]);
  const midPos = lerpVec3(phonePos, finalPos, 0.6);
  const midTarget = lerpVec3(phoneTarget, finalTarget, 0.6);
  return {
    position: lerpVec3(midPos, finalPos, t),
    target: lerpVec3(midTarget, finalTarget, t),
    fov: interpolate(t, [0, 1], [30, 28]),
  };
}

// ── Studio lighting environment ──

const StudioLighting: React.FC = () => (
  <>
    {/* Key light — warm, high, casting shadows */}
    <directionalLight
      position={[5, 8, 4]}
      intensity={2.2}
      color="#fff5e6"
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-far={20}
      shadow-camera-near={0.1}
      shadow-camera-left={-6}
      shadow-camera-right={6}
      shadow-camera-top={6}
      shadow-camera-bottom={-6}
      shadow-bias={-0.0004}
    />

    {/* Fill light — cool, softer, from left */}
    <directionalLight
      position={[-4, 5, 2]}
      intensity={0.9}
      color="#c8d8f0"
    />

    {/* Rim/back light — defines edges */}
    <directionalLight
      position={[0, 3, -5]}
      intensity={0.7}
      color="#e0e0ff"
    />

    {/* Low fill to lift shadows under devices */}
    <pointLight
      position={[0, 0.5, 3]}
      intensity={0.4}
      color="#ffffff"
      distance={10}
    />

    <ambientLight intensity={0.12} color="#b0b8c8" />

    <Environment resolution={256}>
      {/* Top softbox — main reflection source */}
      <Lightformer
        form="rect"
        intensity={3.5}
        position={[0, 5, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[10, 4, 1]}
        color="#ffffff"
      />
      {/* Right panel — subtle warm */}
      <Lightformer
        form="rect"
        intensity={1.8}
        position={[5, 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[6, 3, 1]}
        color="#ece0ff"
      />
      {/* Left panel — subtle cool */}
      <Lightformer
        form="rect"
        intensity={1.2}
        position={[-5, 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[6, 3, 1]}
        color="#ffe8d0"
      />
      {/* Back panel */}
      <Lightformer
        form="rect"
        intensity={1.0}
        position={[0, 3, -5]}
        rotation={[0, 0, 0]}
        scale={[8, 2, 1]}
        color="#d0d8ff"
      />
      {/* Floor bounce */}
      <Lightformer
        form="rect"
        intensity={0.35}
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
      <CameraUpdater
        position={cam.position}
        target={cam.target}
        fov={cam.fov}
      />
      <StudioLighting />
      <Tabletop />

      <ContactShadows
        position={[0, -0.015, 0]}
        opacity={0.55}
        scale={12}
        blur={2.5}
        far={4}
        resolution={512}
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
          intensity={0.45}
          luminanceThreshold={0.75}
          luminanceSmoothing={0.25}
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
        camera={{
          fov: 30,
          near: 0.1,
          far: 100,
          position: [1.0, 8, 7],
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
