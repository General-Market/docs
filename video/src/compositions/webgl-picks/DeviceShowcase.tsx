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

// ── Timeline ──────────────────────────────────────────────
// 600 frames at 60fps. Ten seconds. An eternity for metal and glass.

const PHASE = {
  birdseye: [0, 90] as const, // Establishing shot, god's-eye view
  descend: [90, 200] as const, // Smooth descent, MacBook lid opens
  macOrbit: [200, 350] as const, // Orbit to MacBook, screen ignites
  panPhone: [350, 450] as const, // Pan to iPhone, phone tilts toward camera
  heroEnd: [450, 600] as const, // Slow pullback, both devices in final hero
};

function ease(
  frame: number,
  start: number,
  end: number,
  fn: (t: number) => number = Easing.inOut(Easing.cubic),
): number {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: fn,
  });
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// ── Rounded rectangle ─────────────────────────────────────

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const cr = Math.min(r, hw, hh);
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hh);
  s.lineTo(hw - cr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  s.lineTo(hw, hh - cr);
  s.quadraticCurveTo(hw, hh, hw - cr, hh);
  s.lineTo(-hw + cr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  s.lineTo(-hw, -hh + cr);
  s.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
  return s;
}

// ── MacBook constants ─────────────────────────────────────

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
  radius: 0.06,
};

// ── iPhone constants ──────────────────────────────────────

const PHONE = {
  w: 0.72,
  h: 1.48,
  d: 0.08,
  radius: 0.12,
  screenInset: 0.04,
  cameraSquare: 0.22,
  dynamicIslandW: 0.22,
  dynamicIslandH: 0.06,
};

// ── Shared PBR: the aluminum that makes Apple wealthy ─────

const ALUMINUM = {
  color: "#c0c0c8",
  metalness: 0.95,
  roughness: 0.06,
  clearcoat: 0.8,
  clearcoatRoughness: 0.06,
  envMapIntensity: 1.6,
};

const TITANIUM = {
  color: "#8a8a94",
  metalness: 0.96,
  roughness: 0.08,
  clearcoat: 0.5,
  clearcoatRoughness: 0.1,
  envMapIntensity: 1.8,
};

// ── Keycap ────────────────────────────────────────────────

const KeyCap: React.FC<{
  x: number;
  z: number;
  y: number;
  width?: number;
  depth?: number;
}> = ({ x, z, y, width = 0.155, depth = 0.155 }) => (
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

// ── MacBook Base ──────────────────────────────────────────

const MacBookBase: React.FC = () => {
  const trackpadShape = useMemo(
    () => roundedRect(MAC.trackpadW, MAC.trackpadD, 0.06),
    [],
  );
  const trackpadGeo = useMemo(
    () => new THREE.ShapeGeometry(trackpadShape, 8),
    [trackpadShape],
  );

  const keys = useMemo(() => {
    const out: { x: number; z: number; w: number }[] = [];
    const keyW = 0.155;
    const gap = 0.02;
    const stride = keyW + gap;
    const totalW = MAC.keyCols * stride - gap;
    const startX = -totalW / 2 + keyW / 2;
    const startZ = -MAC.baseD * 0.18;

    for (let row = 0; row < MAC.keyRows; row++) {
      const cols = row === MAC.keyRows - 1 ? 12 : MAC.keyCols;
      for (let col = 0; col < cols; col++) {
        const isSpacebar = row === MAC.keyRows - 1 && col === 5;
        const w = isSpacebar ? keyW * 3.5 + gap * 2.5 : keyW;
        out.push({
          x: startX + col * stride + (w - keyW) / 2,
          z: startZ - row * stride,
          w,
        });
      }
      if (row === MAC.keyRows - 1) break;
    }
    return out;
  }, []);

  const topY = MAC.baseH;

  return (
    <group>
      <RoundedBox
        args={[MAC.baseW, MAC.baseH, MAC.baseD]}
        radius={MAC.radius}
        smoothness={4}
        position={[0, MAC.baseH / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial {...ALUMINUM} />
      </RoundedBox>

      {/* Deck surface */}
      <mesh position={[0, topY + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[MAC.baseW - 0.06, MAC.baseD - 0.06]} />
        <meshPhysicalMaterial
          color="#b0b0b8"
          metalness={0.88}
          roughness={0.1}
          clearcoat={0.25}
          envMapIntensity={1.3}
        />
      </mesh>

      {/* Keyboard well */}
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

      {keys.map((k, i) => (
        <KeyCap key={i} x={k.x} z={k.z} y={topY + 0.007} width={k.w} />
      ))}

      {/* Trackpad surround */}
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

      {/* Trackpad glass */}
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

      {/* Hinge */}
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

      {/* Front chamfer */}
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

// ── MacBook Lid ───────────────────────────────────────────

const MacBookLid: React.FC<{ openAngle: number }> = ({ openAngle }) => {
  const screenW = MAC.lidW - MAC.screenInset * 2;
  const screenH = MAC.lidH - MAC.screenInset * 2;
  const screenGeo = useMemo(
    () => new THREE.PlaneGeometry(screenW, screenH),
    [],
  );

  const bezelShape = useMemo(
    () => roundedRect(MAC.lidW - 0.02, MAC.lidH - 0.02, 0.04),
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

    // macOS dark desktop
    const grad = ctx.createLinearGradient(0, 0, 512, 320);
    grad.addColorStop(0, "#0a1628");
    grad.addColorStop(0.5, "#142040");
    grad.addColorStop(1, "#0a1628");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 320);

    // Dock
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(130, 285, 252, 28, 8);
    ctx.fill();

    // Dock icons
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

    // Menu bar
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, 0, 512, 18);

    // Window
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
    <group position={[0, MAC.baseH, -MAC.baseD / 2 + 0.02]}>
      <group rotation={[angleRad, 0, 0]}>
        {/* Back panel */}
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

        {/* Bezel */}
        <mesh geometry={bezelGeo} position={[0, MAC.lidH / 2, -0.001]}>
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
          position={[
            0,
            MAC.lidH - MAC.screenInset * 0.5,
            MAC.lidThick / 2 + 0.003,
          ]}
        >
          <circleGeometry args={[0.02, 16]} />
          <meshStandardMaterial
            color="#0a0a0e"
            metalness={0.3}
            roughness={0.6}
          />
        </mesh>

        {/* Apple logo on back */}
        <mesh position={[0, MAC.lidH / 2, -MAC.lidThick / 2 - 0.001]}>
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

// ── MacBook Assembly ──────────────────────────────────────

const MacBook: React.FC<{ lidAngle: number; position: Vec3 }> = ({
  lidAngle,
  position,
}) => (
  <group position={position}>
    <MacBookBase />
    <MacBookLid openAngle={lidAngle} />
  </group>
);

// ── iPhone Body ───────────────────────────────────────────

const IPhoneBody: React.FC<{ screenEmissive: number }> = ({
  screenEmissive,
}) => {
  const bodyShape = useMemo(
    () => roundedRect(PHONE.w, PHONE.h, PHONE.radius),
    [],
  );

  const bodyGeo = useMemo(
    () =>
      new THREE.ExtrudeGeometry(bodyShape, {
        depth: PHONE.d,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 4,
      }),
    [bodyShape],
  );

  const screenShape = useMemo(() => {
    const ins = PHONE.screenInset;
    return roundedRect(
      PHONE.w - ins * 2,
      PHONE.h - ins * 2,
      PHONE.radius - ins * 0.5,
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

    // iOS lock screen gradient
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

    // Dynamic Island
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.roundRect(130, 18, 130, 32, 16);
    ctx.fill();

    // Clock
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 72px sans-serif";
    ctx.fillText("9:41", 60, 250);

    // Date
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "16px sans-serif";
    ctx.fillText("Wednesday, April 2", 60, 280);

    // Notification cards
    const cards = [
      { bg: "rgba(40,60,120,0.6)", accent: "#5ac8fa", title: "Messages", sub: "2 new messages" },
      { bg: "rgba(60,30,80,0.5)", accent: "#bf5af2", title: "Calendar", sub: "Meeting in 30 min" },
    ];
    cards.forEach((card, i) => {
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
      ctx.fillText(card.title, 72, y + 30);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "12px sans-serif";
      ctx.fillText(card.sub, 72, y + 50);
    });

    // Home indicator
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
    () =>
      roundedRect(
        PHONE.cameraSquare + 0.06,
        PHONE.cameraSquare + 0.06,
        0.06,
      ),
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
      {/* Body — dark titanium */}
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

      {/* Titanium frame — ghosted over the body */}
      <mesh geometry={bodyGeo} position={[0, 0, -PHONE.d / 2]}>
        <meshPhysicalMaterial
          {...TITANIUM}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Screen face */}
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

      {/* Screen glass */}
      <mesh geometry={screenGeo} position={[0, 0, PHONE.d / 2 + 0.003]}>
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

      {/* Camera bump */}
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

      {/* Three camera lenses in triangle */}
      {(
        [
          [-0.19, 0.47],
          [-0.09, 0.47],
          [-0.14, 0.37],
        ] as [number, number][]
      ).map(([lx, ly], i) => (
        <group key={i} position={[lx, ly, -PHONE.d / 2 - 0.028]}>
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

// ── Tabletop ──────────────────────────────────────────────

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
    {/* Subtle reflective layer */}
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

// ── Camera updater ────────────────────────────────────────

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

// ── Animation: MacBook lid ────────────────────────────────

function useMacLidAngle(frame: number): number {
  const [dStart, dEnd] = PHASE.descend;

  // Lid stays shut until descent begins
  if (frame < dStart) return 0;

  // Initial crack — mechanical tension before the full swing
  if (frame < dStart + 10) {
    return interpolate(
      ease(frame, dStart, dStart + 10),
      [0, 1],
      [0, 8],
    );
  }

  // Main opening arc
  if (frame <= dEnd) {
    return interpolate(
      ease(frame, dStart + 10, dEnd),
      [0, 1],
      [8, 115],
    );
  }

  // Settle back to ergonomic angle during hero pullback
  if (frame >= PHASE.heroEnd[0]) {
    const t = ease(frame, PHASE.heroEnd[0], PHASE.heroEnd[0] + 60);
    return interpolate(t, [0, 1], [115, 105]);
  }

  return 115;
}

// ── Animation: iPhone transform ───────────────────────────

function usePhoneTransform(frame: number): {
  position: Vec3;
  rotation: Vec3;
  screenEmissive: number;
} {
  const restPos: Vec3 = [2.2, 0.06, 0.5];
  const restRot: Vec3 = [-Math.PI / 2, 0, 0.08];

  const liftedPos: Vec3 = [2.2, 1.3, 0.3];
  const liftedRot: Vec3 = [-0.15, -0.2, 0.05];

  const settlePos: Vec3 = [2.2, 0.8, 0.4];
  const settleRot: Vec3 = [-0.1, -0.15, 0.03];

  const heroPos: Vec3 = [2.2, 0.5, 0.5];
  const heroRot: Vec3 = [-0.3, -0.1, 0.03];

  // Before pan: phone lies face-up, screen off (or dimly awakening)
  if (frame < PHASE.panPhone[0]) {
    const earlyGlow =
      frame > PHASE.macOrbit[0]
        ? interpolate(
            frame,
            [PHASE.macOrbit[0], PHASE.macOrbit[1]],
            [0, 0.4],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        : 0;
    return { position: restPos, rotation: restRot, screenEmissive: earlyGlow };
  }

  // Lift: phone rises and faces the camera
  if (frame < PHASE.panPhone[1]) {
    const t = ease(frame, PHASE.panPhone[0], PHASE.panPhone[1]);
    return {
      position: lerpVec3(restPos, liftedPos, t),
      rotation: lerpVec3(restRot, liftedRot, t),
      screenEmissive: interpolate(t, [0, 1], [0.4, 2.8]),
    };
  }

  // Hero: settle into final composition
  if (frame < PHASE.heroEnd[0] + 60) {
    const t = ease(frame, PHASE.panPhone[1], PHASE.heroEnd[0] + 60);
    return {
      position: lerpVec3(liftedPos, settlePos, t),
      rotation: lerpVec3(liftedRot, settleRot, t),
      screenEmissive: interpolate(t, [0, 1], [2.8, 2.0]),
    };
  }

  // Outro drift
  const t = ease(frame, PHASE.heroEnd[0] + 60, PHASE.heroEnd[1]);
  return {
    position: lerpVec3(settlePos, heroPos, t),
    rotation: lerpVec3(settleRot, heroRot, t),
    screenEmissive: interpolate(t, [0, 1], [2.0, 0.8]),
  };
}

// ── Animation: Camera choreography ────────────────────────

function useCameraAnimation(frame: number): {
  position: Vec3;
  target: Vec3;
  fov: number;
} {
  const birdPos: Vec3 = [1.0, 8, 7];
  const birdTarget: Vec3 = [0.8, 0, 0.1];

  const frontPos: Vec3 = [0.8, 5, 6];
  const frontTarget: Vec3 = [0.5, 0.2, -0.1];

  const macPos: Vec3 = [-0.2, 2.8, 3.2];
  const macTarget: Vec3 = [-0.5, 0.7, -0.4];

  const phonePos: Vec3 = [3.0, 2.2, 2.5];
  const phoneTarget: Vec3 = [2.2, 0.9, 0.3];

  const heroPos: Vec3 = [0.8, 6, 7.5];
  const heroTarget: Vec3 = [0.8, 0.3, 0.0];

  // 0-90: Bird's eye establishing shot
  if (frame <= PHASE.birdseye[1]) {
    const t = ease(frame, ...PHASE.birdseye);
    return {
      position: lerpVec3(birdPos, frontPos, t),
      target: lerpVec3(birdTarget, frontTarget, t),
      fov: interpolate(t, [0, 1], [30, 33]),
    };
  }

  // 90-200: Smooth descent, approach the MacBook
  if (frame <= PHASE.descend[1]) {
    const t = ease(frame, ...PHASE.descend);
    return {
      position: lerpVec3(frontPos, macPos, t),
      target: lerpVec3(frontTarget, macTarget, t),
      fov: interpolate(t, [0, 1], [33, 30]),
    };
  }

  // 200-350: Orbit around MacBook, screen glows
  if (frame <= PHASE.macOrbit[1]) {
    const t = ease(frame, ...PHASE.macOrbit);
    // Slight orbit — the camera breathes around the MacBook
    const orbitAngle = t * 0.3;
    const orbitPos: Vec3 = [
      macPos[0] + Math.sin(orbitAngle) * 0.8,
      macPos[1] - t * 0.4,
      macPos[2] + Math.cos(orbitAngle) * 0.3 - 0.3,
    ];
    return {
      position: orbitPos,
      target: macTarget,
      fov: interpolate(t, [0, 1], [30, 32]),
    };
  }

  // 350-450: Pan to iPhone
  if (frame <= PHASE.panPhone[1]) {
    const t = ease(frame, ...PHASE.panPhone);
    const orbitEnd: Vec3 = [
      macPos[0] + Math.sin(0.3) * 0.8,
      macPos[1] - 0.4,
      macPos[2] + Math.cos(0.3) * 0.3 - 0.3,
    ];
    return {
      position: lerpVec3(orbitEnd, phonePos, t),
      target: lerpVec3(macTarget, phoneTarget, t),
      fov: interpolate(t, [0, 1], [32, 28]),
    };
  }

  // 450-600: Slow pullback to hero composition
  const t = ease(frame, ...PHASE.heroEnd);
  return {
    position: lerpVec3(phonePos, heroPos, t),
    target: lerpVec3(phoneTarget, heroTarget, t),
    fov: interpolate(t, [0, 1], [28, 28]),
  };
}

// ── Studio Lighting ───────────────────────────────────────
// Three-point setup plus environment lightformers.
// Metal without good light is just grey rectangles.

const StudioLighting: React.FC = () => (
  <>
    {/* Key — warm, high, shadow-casting */}
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

    {/* Fill — cool, softer, opposite side */}
    <directionalLight
      position={[-4, 5, 2]}
      intensity={0.9}
      color="#c8d8f0"
    />

    {/* Rim — back light, defines edges against dark */}
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
      {/* Right panel */}
      <Lightformer
        form="rect"
        intensity={1.8}
        position={[5, 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[6, 3, 1]}
        color="#ece0ff"
      />
      {/* Left panel */}
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

// ── Scene ─────────────────────────────────────────────────

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

// ── Export ─────────────────────────────────────────────────

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
