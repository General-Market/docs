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
import * as THREE from "three";

type Vec3 = [number, number, number];

// ── Animation timeline (frame ranges) ──
// The original demo is interactive: hover, focus, escape.
// We choreograph the same sequence as a scripted camera pass.

const PHASE = {
  intro: [0, 40] as const,
  hoverMac: [40, 70] as const,
  focusMac: [70, 130] as const,
  unfocusMac: [130, 155] as const,
  focusPhone: [155, 230] as const,
  outro: [230, 300] as const,
};

function phaseProgress(
  frame: number,
  start: number,
  end: number,
  easing: (t: number) => number = Easing.inOut(Easing.cubic)
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

const COLORS = {
  background: "#1a1a1e",
  tabletop: "#2a2a30",
  macBody: "#c0c0c8",
  macScreen: "#0a0a0a",
  macScreenGlow: "#1a3a5a",
  macKeyboard: "#333338",
  macBezel: "#222228",
  iphoneBody: "#2a2a30",
  iphoneScreen: "#0d0d10",
  iphoneScreenGlow: "#1a2a4a",
};

const MAC = {
  baseW: 3.2,
  baseD: 2.2,
  baseH: 0.08,
  lidW: 3.2,
  lidH: 2.1,
  lidThick: 0.06,
  screenInset: 0.12,
  keyRows: 5,
  keyCols: 13,
};

const PHONE = {
  w: 0.75,
  h: 1.55,
  d: 0.08,
  screenInset: 0.05,
  cornerRadius: 0.12,
  cameraSize: 0.22,
};

// ── MacBook Base ──

const MacBookBase: React.FC = () => {
  const bodyGeo = useMemo(
    () => new THREE.BoxGeometry(MAC.baseW, MAC.baseH, MAC.baseD),
    []
  );
  const keyGeo = useMemo(() => new THREE.BoxGeometry(0.18, 0.02, 0.18), []);
  const trackpadGeo = useMemo(() => new THREE.BoxGeometry(1.2, 0.01, 0.8), []);

  const keys = useMemo(() => {
    const result: { x: number; z: number }[] = [];
    const startX = -MAC.baseW * 0.38;
    const startZ = -MAC.baseD * 0.08;
    for (let row = 0; row < MAC.keyRows; row++) {
      for (let col = 0; col < MAC.keyCols; col++) {
        result.push({ x: startX + col * 0.22, z: startZ - row * 0.22 });
      }
    }
    return result;
  }, []);

  return (
    <group>
      <mesh geometry={bodyGeo} position={[0, MAC.baseH / 2, 0]}>
        <meshStandardMaterial color={COLORS.macBody} metalness={0.85} roughness={0.15} />
      </mesh>
      {keys.map((k, i) => (
        <mesh key={i} geometry={keyGeo} position={[k.x, MAC.baseH + 0.01, k.z]}>
          <meshStandardMaterial color={COLORS.macKeyboard} metalness={0.3} roughness={0.8} />
        </mesh>
      ))}
      <mesh geometry={trackpadGeo} position={[0, MAC.baseH + 0.005, MAC.baseD * 0.28]}>
        <meshStandardMaterial color={COLORS.macBody} metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
};

// ── MacBook Lid — pivots at hinge (back edge) ──

const MacBookLid: React.FC<{ openAngle: number }> = ({ openAngle }) => {
  const lidGeo = useMemo(
    () => new THREE.BoxGeometry(MAC.lidW, MAC.lidH, MAC.lidThick),
    []
  );
  const screenGeo = useMemo(
    () =>
      new THREE.BoxGeometry(
        MAC.lidW - MAC.screenInset * 2,
        MAC.lidH - MAC.screenInset * 2,
        0.002
      ),
    []
  );
  const bezelGeo = useMemo(
    () => new THREE.BoxGeometry(MAC.lidW - 0.02, MAC.lidH - 0.02, 0.003),
    []
  );

  const angleRad = (openAngle * Math.PI) / 180;
  const emissiveIntensity =
    openAngle > 5
      ? interpolate(openAngle, [5, 90], [0, 1.5], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
        })
      : 0;

  return (
    <group position={[0, MAC.baseH, -MAC.baseD / 2]}>
      <group rotation={[angleRad, 0, 0]}>
        <mesh geometry={lidGeo} position={[0, MAC.lidH / 2, 0]}>
          <meshStandardMaterial color={COLORS.macBody} metalness={0.85} roughness={0.15} />
        </mesh>
        <mesh geometry={bezelGeo} position={[0, MAC.lidH / 2, MAC.lidThick / 2 + 0.001]}>
          <meshStandardMaterial color={COLORS.macBezel} metalness={0.2} roughness={0.9} />
        </mesh>
        <mesh geometry={screenGeo} position={[0, MAC.lidH / 2, MAC.lidThick / 2 + 0.003]}>
          <meshStandardMaterial
            color={COLORS.macScreen}
            emissive={COLORS.macScreenGlow}
            emissiveIntensity={emissiveIntensity}
            metalness={0.1}
            roughness={0.3}
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

// ── iPhone ──

function makeRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

const IPhone: React.FC<{ position: Vec3; rotation: Vec3 }> = ({
  position,
  rotation,
}) => {
  const bodyGeo = useMemo(() => {
    const shape = makeRoundedRectShape(PHONE.w, PHONE.h, PHONE.cornerRadius);
    return new THREE.ExtrudeGeometry(shape, {
      depth: PHONE.d,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 3,
    });
  }, []);

  const screenGeo = useMemo(() => {
    const shape = makeRoundedRectShape(
      PHONE.w - PHONE.screenInset * 2,
      PHONE.h - PHONE.screenInset * 2,
      PHONE.cornerRadius - PHONE.screenInset
    );
    return new THREE.ShapeGeometry(shape);
  }, []);

  const cameraBumpGeo = useMemo(
    () => new THREE.BoxGeometry(PHONE.cameraSize * 1.3, PHONE.cameraSize * 1.3, 0.025),
    []
  );
  const lensGeo = useMemo(
    () => new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16),
    []
  );

  const screenIntensity = interpolate(Math.abs(rotation[0]), [0, Math.PI], [0.8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lensPositions: Vec3[] = [
    [PHONE.w * 0.13, PHONE.h * 0.35, -0.02],
    [PHONE.w * 0.27, PHONE.h * 0.35, -0.02],
    [PHONE.w * 0.13, PHONE.h * 0.21, -0.02],
  ];

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={bodyGeo}>
        <meshStandardMaterial color={COLORS.iphoneBody} metalness={0.9} roughness={0.12} />
      </mesh>
      <mesh geometry={screenGeo} position={[0, 0, PHONE.d + 0.016]}>
        <meshStandardMaterial
          color={COLORS.iphoneScreen}
          emissive={COLORS.iphoneScreenGlow}
          emissiveIntensity={screenIntensity}
          metalness={0.05}
          roughness={0.2}
        />
      </mesh>
      <mesh geometry={cameraBumpGeo} position={[PHONE.w * 0.2, PHONE.h * 0.28, -0.013]}>
        <meshStandardMaterial color="#1a1a20" metalness={0.8} roughness={0.3} />
      </mesh>
      {lensPositions.map((pos, i) => (
        <mesh key={i} geometry={lensGeo} position={pos} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#050510" metalness={0.95} roughness={0.05} />
        </mesh>
      ))}
    </group>
  );
};

// ── Tabletop ──

const Tabletop: React.FC = () => {
  const geo = useMemo(() => new THREE.PlaneGeometry(20, 20), []);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <meshStandardMaterial color={COLORS.tabletop} metalness={0.1} roughness={0.85} />
    </mesh>
  );
};

// ── Contact shadow ──

const ContactShadow: React.FC<{
  position: Vec3;
  scale: [number, number];
  opacity: number;
}> = ({ position, scale, opacity }) => {
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const mat = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(0,0,0,0.6)");
    gradient.addColorStop(0.5, "rgba(0,0,0,0.2)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity,
      depthWrite: false,
    });
  }, [opacity]);

  return (
    <mesh
      geometry={geo}
      material={mat}
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      scale={[scale[0], scale[1], 1]}
    />
  );
};

// ── Camera updater — uses R3F's useThree ──

const CameraUpdater: React.FC<{ position: Vec3; target: Vec3 }> = ({
  position,
  target,
}) => {
  const { camera } = useThree();

  if (camera) {
    camera.position.set(...position);
    camera.lookAt(new THREE.Vector3(...target));
  }

  return null;
};

// ── Animation logic ──

function useMacLidAngle(frame: number): number {
  return useMemo(() => {
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
  }, [frame]);
}

function usePhoneTransform(frame: number): { position: Vec3; rotation: Vec3 } {
  const basePos: Vec3 = [2.0, 0.04, 0.3];
  const baseFacedown: Vec3 = [Math.PI, 0, 0.1];

  const position = useMemo((): Vec3 => {
    if (frame >= PHASE.focusPhone[1] - 10) {
      const p = phaseProgress(frame, PHASE.focusPhone[1] - 10, PHASE.outro[0] + 15);
      return [basePos[0], interpolate(p, [0, 1], [basePos[1] + 0.8, basePos[1]]), basePos[2]];
    }
    if (frame >= PHASE.focusPhone[0]) {
      const p = phaseProgress(frame, PHASE.focusPhone[0], PHASE.focusPhone[0] + 30);
      return [basePos[0], basePos[1] + p * 0.8, basePos[2] - p * 0.2];
    }
    return basePos;
  }, [frame]);

  const rotation = useMemo((): Vec3 => {
    if (frame >= PHASE.focusPhone[1] - 10) {
      const p = phaseProgress(frame, PHASE.focusPhone[1] - 10, PHASE.outro[0] + 15);
      return [
        interpolate(p, [0, 1], [-0.3, Math.PI]),
        interpolate(p, [0, 1], [-0.2, 0]),
        interpolate(p, [0, 1], [0.05, 0.1]),
      ];
    }
    if (frame >= PHASE.focusPhone[0]) {
      const p = phaseProgress(frame, PHASE.focusPhone[0], PHASE.focusPhone[0] + 30);
      return [
        interpolate(p, [0, 1], [Math.PI, -0.3]),
        interpolate(p, [0, 1], [0, -0.2]),
        interpolate(p, [0, 1], [0.1, 0.05]),
      ];
    }
    return baseFacedown;
  }, [frame]);

  return { position, rotation };
}

function useCameraAnimation(frame: number): { position: Vec3; target: Vec3 } {
  const startPos: Vec3 = [0, 5.5, 6.0];
  const frontPos: Vec3 = [0.5, 3.5, 5.5];
  const macPos: Vec3 = [-0.8, 2.8, 3.5];
  const phoneCamPos: Vec3 = [3.2, 2.5, 3.0];

  const tableCenter: Vec3 = [0.6, 0.2, 0];
  const macTarget: Vec3 = [-0.2, 0.8, -0.5];
  const phoneTarget: Vec3 = [2.0, 0.5, 0.3];

  const position = useMemo((): Vec3 => {
    if (frame <= PHASE.intro[1]) {
      return lerpVec3(startPos, frontPos, phaseProgress(frame, PHASE.intro[0], PHASE.intro[1]));
    }
    if (frame <= PHASE.hoverMac[1]) {
      const hoverEnd: Vec3 = [frontPos[0] - 0.3, frontPos[1] - 0.2, frontPos[2] - 0.3];
      return lerpVec3(frontPos, hoverEnd, phaseProgress(frame, PHASE.hoverMac[0], PHASE.hoverMac[1]));
    }
    if (frame <= PHASE.unfocusMac[0]) {
      const from: Vec3 = [frontPos[0] - 0.3, frontPos[1] - 0.2, frontPos[2] - 0.3];
      return lerpVec3(from, macPos, phaseProgress(frame, PHASE.focusMac[0], PHASE.focusMac[0] + 30));
    }
    if (frame <= PHASE.focusPhone[0]) {
      return lerpVec3(macPos, frontPos, phaseProgress(frame, PHASE.unfocusMac[0], PHASE.unfocusMac[1]));
    }
    if (frame <= PHASE.outro[0]) {
      return lerpVec3(frontPos, phoneCamPos, phaseProgress(frame, PHASE.focusPhone[0], PHASE.focusPhone[0] + 30));
    }
    return lerpVec3(phoneCamPos, startPos, phaseProgress(frame, PHASE.outro[0], PHASE.outro[1]));
  }, [frame]);

  const target = useMemo((): Vec3 => {
    if (frame <= PHASE.hoverMac[1]) return tableCenter;
    if (frame <= PHASE.unfocusMac[0]) {
      return lerpVec3(tableCenter, macTarget, phaseProgress(frame, PHASE.focusMac[0], PHASE.focusMac[0] + 30));
    }
    if (frame <= PHASE.focusPhone[0]) {
      return lerpVec3(macTarget, tableCenter, phaseProgress(frame, PHASE.unfocusMac[0], PHASE.unfocusMac[1]));
    }
    if (frame <= PHASE.outro[0]) {
      return lerpVec3(tableCenter, phoneTarget, phaseProgress(frame, PHASE.focusPhone[0], PHASE.focusPhone[0] + 30));
    }
    return lerpVec3(phoneTarget, tableCenter, phaseProgress(frame, PHASE.outro[0], PHASE.outro[1]));
  }, [frame]);

  return { position, target };
}

// ── Scene ──

const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const macLidAngle = useMacLidAngle(frame);
  const phone = usePhoneTransform(frame);
  const cam = useCameraAnimation(frame);

  const phoneShadowOpacity = useMemo(() => {
    if (frame >= PHASE.focusPhone[0] && frame < PHASE.outro[0]) {
      return interpolate(
        phaseProgress(frame, PHASE.focusPhone[0], PHASE.focusPhone[0] + 30),
        [0, 1],
        [0.4, 0.15]
      );
    }
    return 0.4;
  }, [frame]);

  return (
    <>
      <CameraUpdater position={cam.position} target={cam.target} />

      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-3, 4, -2]} intensity={0.4} color="#8888cc" />
      <pointLight position={[0, 3, 3]} intensity={0.6} color="#ffffff" />
      <pointLight position={[-4, 2, -3]} intensity={0.3} color="#aabbff" />

      <Tabletop />
      <ContactShadow position={[0, 0.001, 0]} scale={[4.5, 3.5]} opacity={0.35} />
      <ContactShadow position={[2.0, 0.001, 0.3]} scale={[1.5, 2.0]} opacity={phoneShadowOpacity} />

      <MacBook lidAngle={macLidAngle} position={[-0.5, 0, -0.3]} />
      <IPhone position={phone.position} rotation={phone.rotation} />
    </>
  );
};

// ── Main export ──

export const DeviceShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 35, near: 0.1, far: 100, position: [0, 5.5, 6.0] }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
