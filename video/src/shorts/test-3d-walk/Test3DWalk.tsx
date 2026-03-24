import React, { Suspense, useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Text3D } from "@react-three/drei";
import * as THREE from "three";
import {
  WalkingCharacter, NPCWalker, Bystander,
  IMPACT_EVENTS, getImpactFlinch,
} from "./PersonCharacter";

// ── Meta ────────────────────────────────────────────────────────────────────
export const test3DWalkMeta = {
  id: "Test3DWalk",
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 300,
};

// ── Palette ─────────────────────────────────────────────────────────────────
const COL = {
  bg: "#D8EBF5",
  fog: "#D0E4F0",
  white: "#F0F4F8",
  ice: "#C5DCE8",
  iceLight: "#E0EFF8",
  iceDark: "#A0C0D8",
  trunk: "#E8EEF2",
  trunkAccent: "#D0DCE4",
  leafDark: "#1E3A5F",
  leafMid: "#2A5080",
  leafLight: "#3A6898",
  circuit: "#8BB8D4",
  circuitDark: "#5A90B4",
  circuitAccent: "#3A6890",
  platform: "#B0D0E4",
  platformEdge: "#90B8D0",
  character: "#6366F1",
  textGlow: "#8AB8E0",
  textBody: "#E8F0F8",
  clockFace: "#E0E8F0",
  clockRim: "#C8D4E0",
  clockHand: "#8B3040",
  screenFrame: "#D4DCE4",
  screenGlow: "#A0C8E0",
  cloud: "#E8F0F8",
  dust: "#D0DCE8",
  dustDark: "#A8BCC8",
};

// NPC outfit combos: [hoodie color, pants color]
const NPC_OUTFITS: [string, string][] = [
  ["#4A90D9", "#3B3F54"],
  ["#7C3AED", "#2D3748"],
  ["#10B981", "#374151"],
  ["#F59E0B", "#1F2937"],
  ["#EF4444", "#334155"],
  ["#8B5CF6", "#2D3748"],
  ["#06B6D4", "#1E293B"],
  ["#EC4899", "#374151"],
  ["#84CC16", "#1F2937"],
  ["#F97316", "#334155"],
];

const FONT_URL = staticFile("fonts/helvetiker_bold.typeface.json");

// ── Screen shake helper ─────────────────────────────────────────────────────
function getScreenShake(frame: number): { x: number; y: number; z: number } {
  let shakeX = 0, shakeY = 0, shakeZ = 0;
  for (const evt of IMPACT_EVENTS) {
    const elapsed = frame - evt.landFrame;
    if (elapsed < 0 || elapsed > 12) continue;
    const intensity = Math.max(0, 1 - elapsed / 12) * 0.15;
    // High-frequency rattle
    shakeX += Math.sin(elapsed * 8.5) * intensity;
    shakeY += Math.cos(elapsed * 11.3) * intensity * 0.7;
    shakeZ += Math.sin(elapsed * 6.7 + 2) * intensity * 0.4;
  }
  return { x: shakeX, y: shakeY, z: shakeZ };
}

// ── Dust / debris VFX on number crash ───────────────────────────────────────
const ImpactDust: React.FC<{ frame: number }> = ({ frame }) => {
  // Pre-generate dust particles per impact
  const dustSets = useMemo(() => {
    return IMPACT_EVENTS.map((evt) => {
      const particles: {
        angle: number; speed: number; size: number; ySpeed: number;
        spin: number; color: string;
      }[] = [];
      // Ring of expanding dust chunks
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
        particles.push({
          angle,
          speed: 0.15 + Math.random() * 0.2,
          size: 0.06 + Math.random() * 0.1,
          ySpeed: 0.03 + Math.random() * 0.06,
          spin: Math.random() * 0.3,
          color: Math.random() > 0.5 ? COL.dust : COL.dustDark,
        });
      }
      // Larger debris chunks
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          angle,
          speed: 0.1 + Math.random() * 0.15,
          size: 0.1 + Math.random() * 0.15,
          ySpeed: 0.06 + Math.random() * 0.08,
          spin: Math.random() * 0.2,
          color: COL.iceLight,
        });
      }
      return { ...evt, particles };
    });
  }, []);

  return (
    <>
      {dustSets.map((evt, ei) => {
        const elapsed = frame - evt.landFrame;
        if (elapsed < 0 || elapsed > 25) return null;

        const t = elapsed / 25;
        const fadeOut = Math.max(0, 1 - t * 1.2);

        return (
          <group key={ei} position={[-0.5, 0, evt.landZ]}>
            {/* Expanding dust ring on ground */}
            {elapsed < 15 && (
              <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[elapsed * 0.25, elapsed * 0.25 + 0.4, 24]} />
                <meshBasicMaterial
                  color={COL.dust}
                  transparent
                  opacity={fadeOut * 0.35}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Dust cloud — expanding sphere */}
            {elapsed < 18 && (
              <mesh position={[0, 0.3 + elapsed * 0.05, 0]}>
                <sphereGeometry args={[0.3 + elapsed * 0.12, 8, 6]} />
                <meshStandardMaterial
                  color={COL.dust}
                  transparent
                  opacity={fadeOut * 0.25}
                  roughness={1}
                />
              </mesh>
            )}

            {/* Individual debris particles */}
            {evt.particles.map((p, pi) => {
              const px = Math.cos(p.angle) * elapsed * p.speed;
              const pz = Math.sin(p.angle) * elapsed * p.speed;
              const py = elapsed * p.ySpeed - elapsed * elapsed * 0.003; // gravity
              const pScale = p.size * fadeOut;
              if (pScale < 0.01) return null;
              return (
                <mesh
                  key={pi}
                  position={[px, Math.max(0.05, py), pz]}
                  rotation={[elapsed * p.spin, elapsed * p.spin * 1.3, 0]}
                >
                  <boxGeometry args={[pScale, pScale * 0.7, pScale * 0.5]} />
                  <meshStandardMaterial
                    color={p.color}
                    transparent
                    opacity={fadeOut * 0.8}
                    roughness={0.6}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </>
  );
};

// ── Pixel-particle Tree ─────────────────────────────────────────────────────
const PixelTree: React.FC<{
  position: [number, number, number];
  height?: number;
  spread?: number;
  leafCount?: number;
}> = ({ position, height = 6, spread = 3, leafCount = 80 }) => {
  const leaves = useMemo(() => {
    const arr: { x: number; y: number; z: number; size: number; color: string; rotY: number }[] = [];
    for (let i = 0; i < leafCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const elevation = Math.random() * Math.PI * 0.6 + 0.2;
      const dist = (Math.random() * 0.7 + 0.3) * spread;
      arr.push({
        x: Math.cos(angle) * Math.sin(elevation) * dist,
        y: height * 0.55 + Math.cos(elevation) * dist * 0.6 + Math.random() * spread * 0.3,
        z: Math.sin(angle) * Math.sin(elevation) * dist,
        size: 0.08 + Math.random() * 0.18,
        color: [COL.leafDark, COL.leafMid, COL.leafLight, COL.leafDark, COL.leafMid][
          Math.floor(Math.random() * 5)
        ],
        rotY: Math.random() * Math.PI,
      });
    }
    return arr;
  }, [height, spread, leafCount]);

  return (
    <group position={position}>
      <mesh position={[0, height * 0.3, 0]}>
        <cylinderGeometry args={[height * 0.03, height * 0.06, height * 0.6, 8]} />
        <meshStandardMaterial color={COL.trunk} roughness={0.6} metalness={0.05} />
      </mesh>
      {[0, 1.5, 3.2, 4.8].map((rot, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(rot) * height * 0.12,
            height * (0.45 + i * 0.06),
            Math.sin(rot) * height * 0.12,
          ]}
          rotation={[0.3 * Math.sin(rot), rot, 0.6 + i * 0.15]}
        >
          <cylinderGeometry args={[height * 0.015, height * 0.025, height * 0.2, 4]} />
          <meshStandardMaterial color={COL.trunk} roughness={0.6} />
        </mesh>
      ))}
      {leaves.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, l.z]} rotation={[0, l.rotY, Math.random() * 0.5]}>
          <boxGeometry args={[l.size, l.size * 0.6, l.size * 0.15]} />
          <meshStandardMaterial color={l.color} roughness={0.5} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
};

// ── Giant Central Tree ──────────────────────────────────────────────────────
const GiantTree: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const leaves = useMemo(() => {
    const arr: { x: number; y: number; z: number; size: number; color: string; rotY: number }[] = [];
    const h = 25, sp = 12;
    for (let i = 0; i < 400; i++) {
      const angle = Math.random() * Math.PI * 2;
      const elevation = Math.random() * Math.PI * 0.55 + 0.25;
      const dist = (Math.random() * 0.7 + 0.3) * sp;
      arr.push({
        x: Math.cos(angle) * Math.sin(elevation) * dist,
        y: h * 0.45 + Math.cos(elevation) * dist * 0.5 + Math.random() * sp * 0.4,
        z: Math.sin(angle) * Math.sin(elevation) * dist,
        size: 0.15 + Math.random() * 0.4,
        color: [COL.leafDark, COL.leafMid, COL.leafLight, COL.leafDark, COL.leafMid, COL.circuitAccent][
          Math.floor(Math.random() * 6)
        ],
        rotY: Math.random() * Math.PI,
      });
    }
    return arr;
  }, []);

  return (
    <group position={position}>
      <mesh position={[0, 8, 0]}>
        <cylinderGeometry args={[0.8, 1.8, 16, 12]} />
        <meshStandardMaterial color={COL.trunk} roughness={0.5} metalness={0.05} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={`ring${i}`} position={[0, 1 + i * 1.3, 0]}>
          <torusGeometry args={[1.6 - i * 0.06, 0.04, 6, 16]} />
          <meshStandardMaterial color={COL.trunkAccent} roughness={0.4} transparent opacity={0.5} />
        </mesh>
      ))}
      {[0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].map((rot, i) => (
        <mesh key={`branch${i}`} position={[Math.cos(rot) * 2, 12 + i * 1.5, Math.sin(rot) * 2]} rotation={[0.4 * Math.sin(rot), rot, 0.8 + i * 0.1]}>
          <cylinderGeometry args={[0.08, 0.2, 4, 6]} />
          <meshStandardMaterial color={COL.trunk} roughness={0.5} />
        </mesh>
      ))}
      {[0.8, 2.3, 3.8, 5.2].map((rot, i) => (
        <mesh key={`sb${i}`} position={[Math.cos(rot) * 1.5, 10 + i * 2, Math.sin(rot) * 1.5]} rotation={[0.3, rot, 0.5]}>
          <cylinderGeometry args={[0.05, 0.12, 3, 4]} />
          <meshStandardMaterial color={COL.trunk} roughness={0.6} />
        </mesh>
      ))}
      {leaves.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, l.z]} rotation={[0, l.rotY, Math.random() * 0.5]}>
          <boxGeometry args={[l.size, l.size * 0.6, l.size * 0.15]} />
          <meshStandardMaterial color={l.color} roughness={0.5} metalness={0.1} />
        </mesh>
      ))}
      {[0, 1.2, 2.5, 3.7, 5.0].map((rot, i) => (
        <mesh key={`root${i}`} position={[Math.cos(rot) * 2.5, 0.3, Math.sin(rot) * 2.5]} rotation={[0.1, rot, 0.3]}>
          <cylinderGeometry args={[0.15, 0.05, 3, 6]} />
          <meshStandardMaterial color={COL.trunk} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
};

// ── Circuit-board Platform ──────────────────────────────────────────────────
const CircuitPlatform: React.FC<{
  position: [number, number, number];
  size?: [number, number, number];
  transparent?: boolean;
}> = ({ position, size = [3, 0.15, 3], transparent = false }) => (
  <group position={position}>
    <mesh>
      <boxGeometry args={size} />
      <meshStandardMaterial color={COL.circuit} roughness={0.3} metalness={0.2} transparent={transparent} opacity={transparent ? 0.6 : 0.9} />
    </mesh>
    {[-0.3, 0, 0.3].map((offset, i) => (
      <mesh key={i} position={[offset * size[0], size[1] / 2 + 0.005, 0]}>
        <boxGeometry args={[0.03, 0.01, size[2] * 0.8]} />
        <meshStandardMaterial color={COL.circuitDark} />
      </mesh>
    ))}
    {[-0.2, 0.2].map((offset, i) => (
      <mesh key={`h${i}`} position={[0, size[1] / 2 + 0.005, offset * size[2]]}>
        <boxGeometry args={[size[0] * 0.8, 0.01, 0.03]} />
        <meshStandardMaterial color={COL.circuitDark} />
      </mesh>
    ))}
    {[[-0.3, 0.2], [0.2, -0.3], [-0.15, -0.15], [0.35, 0.1]].map(([cx, cz], i) => (
      <mesh key={`c${i}`} position={[cx * size[0], size[1] / 2 + 0.02, cz * size[2]]}>
        <boxGeometry args={[0.12, 0.04, 0.08]} />
        <meshStandardMaterial color={COL.circuitAccent} metalness={0.3} roughness={0.4} />
      </mesh>
    ))}
  </group>
);

// ── Giant Alarm Clock ───────────────────────────────────────────────────────
const GiantClock: React.FC<{ position: [number, number, number]; scale?: number; frame: number }> = ({ position, scale = 1, frame }) => {
  const hourAngle = -Math.PI * 0.3;
  const minuteAngle = -frame * 0.005;
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh rotation={[0.1, 0.2, 0]}><cylinderGeometry args={[1.8, 1.8, 0.5, 24]} /><meshStandardMaterial color={COL.clockFace} roughness={0.3} metalness={0.15} transparent opacity={0.85} /></mesh>
      <mesh rotation={[0.1, 0.2, 0]}><torusGeometry args={[1.8, 0.08, 8, 32]} /><meshStandardMaterial color={COL.clockRim} metalness={0.4} roughness={0.3} /></mesh>
      <mesh position={[Math.sin(hourAngle) * 0.5, Math.cos(hourAngle) * 0.5, 0.3]} rotation={[0.1, 0.2, hourAngle]}><boxGeometry args={[0.06, 0.9, 0.02]} /><meshStandardMaterial color={COL.clockHand} /></mesh>
      <mesh position={[Math.sin(minuteAngle) * 0.6, Math.cos(minuteAngle) * 0.6, 0.32]} rotation={[0.1, 0.2, minuteAngle]}><boxGeometry args={[0.04, 1.2, 0.02]} /><meshStandardMaterial color={COL.clockHand} /></mesh>
      <mesh position={[-0.7, 2.1, 0]}><sphereGeometry args={[0.4, 12, 8]} /><meshStandardMaterial color={COL.clockRim} metalness={0.5} roughness={0.2} /></mesh>
      <mesh position={[0.7, 2.1, 0]}><sphereGeometry args={[0.4, 12, 8]} /><meshStandardMaterial color={COL.clockRim} metalness={0.5} roughness={0.2} /></mesh>
      <mesh position={[0, 2.4, 0]}><torusGeometry args={[0.35, 0.05, 8, 16, Math.PI]} /><meshStandardMaterial color={COL.clockRim} metalness={0.4} roughness={0.3} /></mesh>
      <mesh position={[-0.6, -1.4, 0]} rotation={[0, 0, 0.2]}><cylinderGeometry args={[0.06, 0.04, 0.8, 6]} /><meshStandardMaterial color={COL.clockRim} /></mesh>
      <mesh position={[0.6, -1.4, 0]} rotation={[0, 0, -0.2]}><cylinderGeometry args={[0.06, 0.04, 0.8, 6]} /><meshStandardMaterial color={COL.clockRim} /></mesh>
    </group>
  );
};

// ── CRT Monitor ─────────────────────────────────────────────────────────────
const CRTMonitor: React.FC<{ position: [number, number, number]; scale?: number; rotationY?: number }> = ({ position, scale = 1, rotationY = 0 }) => (
  <group position={position} scale={[scale, scale, scale]} rotation={[0, rotationY, 0]}>
    <mesh><boxGeometry args={[1.4, 1.1, 1.0]} /><meshStandardMaterial color={COL.screenFrame} roughness={0.5} metalness={0.1} /></mesh>
    <mesh position={[0, 0.05, 0.51]}><boxGeometry args={[1.1, 0.85, 0.02]} /><meshStandardMaterial color={COL.screenGlow} emissive={COL.screenGlow} emissiveIntensity={0.2} roughness={0.2} /></mesh>
    <mesh position={[0, -0.75, 0]}><boxGeometry args={[0.8, 0.15, 0.6]} /><meshStandardMaterial color={COL.screenFrame} roughness={0.5} /></mesh>
    <mesh position={[0.5, -0.35, 0.51]}><sphereGeometry args={[0.03, 6, 4]} /><meshStandardMaterial color="#E74C3C" emissive="#E74C3C" emissiveIntensity={0.8} /></mesh>
  </group>
);

// ── Floating Island ─────────────────────────────────────────────────────────
const FloatingIsland: React.FC<{
  position: [number, number, number]; size?: [number, number, number];
  frame: number; bobSpeed?: number;
}> = ({ position, size = [2, 0.8, 2], frame, bobSpeed = 0.02 }) => {
  const bob = Math.sin(frame * bobSpeed) * 0.2;
  const stalactites = useMemo(() => {
    const arr: { x: number; z: number; h: number; w: number; rot: number }[] = [];
    const count = 12 + Math.floor(size[0] * 3);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * size[0] * 0.7;
      const z = (Math.random() - 0.5) * size[2] * 0.7;
      const distFromCenter = Math.sqrt(x * x + z * z) / (Math.max(size[0], size[2]) * 0.5);
      arr.push({ x, z, h: size[1] * (0.5 + Math.random() * 1.2) * (1 - distFromCenter * 0.5), w: 0.1 + Math.random() * 0.25, rot: Math.random() * 0.3 - 0.15 });
    }
    return arr;
  }, [size]);

  return (
    <group position={[position[0], position[1] + bob, position[2]]}>
      <CircuitPlatform position={[0, size[1] / 2, 0]} size={[size[0], 0.12, size[2]]} />
      <mesh position={[0, size[1] * 0.15, 0]}><boxGeometry args={[size[0] * 0.85, size[1] * 0.4, size[2] * 0.85]} /><meshStandardMaterial color={COL.circuit} roughness={0.3} metalness={0.15} transparent opacity={0.75} /></mesh>
      {stalactites.map((s, i) => (
        <mesh key={i} position={[s.x, -s.h * 0.4, s.z]} rotation={[s.rot, 0, s.rot * 0.5]}>
          <cylinderGeometry args={[0.02, s.w, s.h, 5]} />
          <meshStandardMaterial color={i % 3 === 0 ? COL.iceDark : i % 3 === 1 ? COL.ice : COL.iceLight} roughness={0.5} metalness={0.1} transparent opacity={0.7} />
        </mesh>
      ))}
      <mesh position={[size[0] * 0.15, -size[1] * 0.4, size[2] * 0.1]}><boxGeometry args={[size[0] * 0.35, size[1] * 0.6, size[2] * 0.3]} /><meshStandardMaterial color={COL.circuitDark} roughness={0.4} metalness={0.15} transparent opacity={0.6} /></mesh>
      <mesh position={[-size[0] * 0.1, -size[1] * 0.55, -size[2] * 0.05]}><boxGeometry args={[size[0] * 0.25, size[1] * 0.8, size[2] * 0.25]} /><meshStandardMaterial color={COL.ice} roughness={0.4} metalness={0.1} transparent opacity={0.55} /></mesh>
      <mesh position={[0, -size[1] * 0.9, 0]}><coneGeometry args={[size[0] * 0.15, size[1] * 0.5, 6]} /><meshStandardMaterial color={COL.ice} roughness={0.5} transparent opacity={0.45} /></mesh>
    </group>
  );
};

// ── Cloud Puff ──────────────────────────────────────────────────────────────
const CloudPuff: React.FC<{ position: [number, number, number]; scale?: number }> = ({ position, scale = 1 }) => (
  <group position={position} scale={[scale, scale * 0.5, scale]}>
    <mesh><sphereGeometry args={[1.2, 8, 6]} /><meshStandardMaterial color={COL.cloud} transparent opacity={0.5} roughness={0.9} /></mesh>
    <mesh position={[0.8, 0.1, 0.3]}><sphereGeometry args={[0.9, 8, 6]} /><meshStandardMaterial color={COL.cloud} transparent opacity={0.4} roughness={0.9} /></mesh>
    <mesh position={[-0.7, -0.1, -0.2]}><sphereGeometry args={[1.0, 8, 6]} /><meshStandardMaterial color={COL.cloud} transparent opacity={0.45} roughness={0.9} /></mesh>
  </group>
);

// ── Impact Number (with flash) ──────────────────────────────────────────────
const ImpactNumber: React.FC<{
  text: string; landZ: number; frame: number; triggerFrame: number; xOffset?: number;
}> = ({ text, landZ, frame, triggerFrame, xOffset = 0 }) => {
  const elapsed = frame - triggerFrame;
  if (elapsed < 0) return null;
  const dropDuration = 12;
  const bounceDuration = 6;
  const totalAnim = dropDuration + bounceDuration;
  let y: number, scaleY: number, impactRing = 0;

  if (elapsed < dropDuration) {
    const t = elapsed / dropDuration;
    y = 14 * (1 - t * t); scaleY = 1;
  } else if (elapsed < totalAnim) {
    const t = (elapsed - dropDuration) / bounceDuration;
    y = 0.8 * Math.sin(t * Math.PI) * (1 - t);
    scaleY = 1 + 0.2 * Math.sin(t * Math.PI);
    impactRing = Math.max(0, 1 - (elapsed - dropDuration) / 10);
  } else {
    y = 0; scaleY = 1;
    impactRing = Math.max(0, 1 - (elapsed - totalAnim) / 8);
  }
  const ringScale = impactRing > 0 ? 1 + (1 - impactRing) * 3 : 0;

  // Flash intensity on landing
  const flashElapsed = elapsed - dropDuration;
  const flash = flashElapsed >= 0 && flashElapsed < 6 ? Math.max(0, 1 - flashElapsed / 6) : 0;

  return (
    <group position={[xOffset, 0, landZ]}>
      {impactRing > 0 && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringScale * 0.3, ringScale * 0.6, 24]} />
          <meshBasicMaterial color={COL.textGlow} transparent opacity={impactRing * 0.4} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Ground flash */}
      {flash > 0 && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2 + (1 - flash) * 3, 24]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={flash * 0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
      <group position={[0, y + 0.7, 0]} scale={[1, scaleY, 1]}>
        <Text3D font={FONT_URL} size={1.6} height={0.25} bevelEnabled bevelSize={0.04} bevelThickness={0.02}>
          {text}
          <meshStandardMaterial color={COL.textBody} emissive={COL.textGlow} emissiveIntensity={0.3 + flash * 0.5} metalness={0.3} roughness={0.2} />
        </Text3D>
      </group>
      {/* Impact point light — brighter flash */}
      {elapsed >= dropDuration && (
        <pointLight position={[0.5, 0.5, 0]} color="#FFFFFF" intensity={flash * 8 + Math.max(0, 2 - (elapsed - dropDuration) * 0.15)} distance={flash > 0 ? 12 : 4} />
      )}
    </group>
  );
};

// ── Ambient pulsing colored lights (from FrontWalk style) ───────────────────
const AmbientColorLights: React.FC<{ frame: number; walkZ: number }> = ({ frame, walkZ }) => {
  const time = frame * 0.06;
  const p1 = 0.5 + Math.sin(time) * 0.5;
  const p2 = 0.5 + Math.sin(time * 1.3 + 1) * 0.5;
  const p3 = 0.5 + Math.sin(time * 0.7 + 2) * 0.5;

  return (
    <>
      {/* Subtle colored lights that paint the ground and characters */}
      <pointLight position={[Math.sin(time * 0.4) * 4, 1, walkZ + 3]} color="#6366F1" intensity={p1 * 1.5} distance={10} />
      <pointLight position={[Math.cos(time * 0.3) * 5, 0.5, walkZ - 4]} color="#22D3EE" intensity={p2 * 1.0} distance={10} />
      <pointLight position={[Math.sin(time * 0.5 + 3) * 3, 1.5, walkZ + 6]} color="#A855F7" intensity={p3 * 0.8} distance={8} />
      {/* Warm backlight */}
      <pointLight position={[0, 3, walkZ + 8]} color="#F59E0B" intensity={0.4} distance={12} />
    </>
  );
};

// ── Vertical light beams in background ──────────────────────────────────────
const LightBeams: React.FC<{ frame: number; walkZ: number }> = ({ frame, walkZ }) => {
  const time = frame * 0.025;
  const beams = useMemo(() => [
    { x: -6, z: 10, color: "#6366F1", phase: 0 },
    { x: 4, z: 16, color: "#22D3EE", phase: 1.5 },
    { x: -3, z: 22, color: "#A855F7", phase: 3 },
    { x: 7, z: 8, color: "#8AB8E0", phase: 4.5 },
  ], []);

  return (
    <>
      {beams.map((beam, i) => {
        const opacity = 0.06 + Math.sin(time * 2 + beam.phase) * 0.04;
        return (
          <mesh key={i} position={[beam.x, 5, walkZ + beam.z]}>
            <cylinderGeometry args={[0.04, 0.2, 10, 6]} />
            <meshBasicMaterial color={beam.color} transparent opacity={opacity} />
          </mesh>
        );
      })}
    </>
  );
};

// ── Camera with screen shake ────────────────────────────────────────────────
const CameraController: React.FC<{ walkZ: number; frame: number; totalFrames: number }> = ({ walkZ, frame, totalFrames }) => {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const t = frame / totalFrames;

  const orbitAngle = interpolate(frame, [0, totalFrames], [-0.3, 1.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cameraDistance = interpolate(t, [0, 0.3, 0.6, 1], [4, 4.5, 5, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cameraHeight = interpolate(t, [0, 0.3, 0.6, 1], [1.4, 1.6, 2.2, 3.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cameraX = Math.sin(orbitAngle) * cameraDistance * 0.5;
  const cameraZ = walkZ + cameraDistance;
  const cameraY = cameraHeight + Math.sin(frame * 0.05) * 0.08;

  // Apply screen shake
  const shake = getScreenShake(frame);

  camera.position.set(cameraX + shake.x, cameraY + shake.y, cameraZ + shake.z);
  target.set(shake.x * 0.3, 1.0 + shake.y * 0.3, walkZ);
  camera.lookAt(target);

  return null;
};

// ── NPC Paths ───────────────────────────────────────────────────────────────
const NPC_PATHS: { path: [number, number, number][]; speed: number; outfit: number; delay: number; scale: number }[] = [
  { path: [[-3, 0.1, -3], [-3.5, 0.1, 5], [-2.5, 0.1, 12], [-3, 0.1, 20], [-3.5, 0.1, 28], [-3, 0.1, -3]], speed: 0.004, outfit: 0, delay: 0, scale: 0.85 },
  { path: [[3, 0.1, 25], [3.5, 0.1, 18], [2.5, 0.1, 10], [3, 0.1, 3], [3.5, 0.1, -2], [3, 0.1, 25]], speed: 0.005, outfit: 1, delay: 20, scale: 0.8 },
  { path: [[-5, 0.1, 8], [-2, 0.1, 9], [2, 0.1, 10], [5, 0.1, 11], [2, 0.1, 12], [-2, 0.1, 11], [-5, 0.1, 8]], speed: 0.006, outfit: 2, delay: 40, scale: 0.9 },
  { path: [[-7, 0.1, 2], [-6, 0.1, 8], [-7, 0.1, 14], [-6, 0.1, 20], [-7, 0.1, 2]], speed: 0.003, outfit: 3, delay: 10, scale: 0.75 },
  { path: [[2, 0.1, 0], [1.5, 0.1, 6], [2, 0.1, 12], [1.5, 0.1, 18], [2, 0.1, 0]], speed: 0.0045, outfit: 4, delay: 30, scale: 0.85 },
  { path: [[-1, 0.1, -1], [1, 0.1, 4], [-1, 0.1, 8], [1, 0.1, 14], [-1, 0.1, 20], [-1, 0.1, -1]], speed: 0.005, outfit: 5, delay: 60, scale: 0.8 },
];

// ── Main Scene ──────────────────────────────────────────────────────────────
const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const walkZ = interpolate(frame, [20, 270], [-2, 30], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Excited state after 2nd drop
  const DROP2_LAND = 122;
  const RAMP = 15, DUR = 50;
  const excEl = frame - DROP2_LAND;
  let excInt = 0;
  const isExcited = excEl > 0 && excEl < DUR + RAMP;
  if (isExcited) {
    if (excEl < RAMP) excInt = excEl / RAMP;
    else if (excEl < DUR) excInt = 1;
    else excInt = Math.max(0, 1 - (excEl - DUR) / RAMP);
  }

  // Main character flinch
  const mainFlinch = getImpactFlinch(frame, walkZ);

  return (
    <>
      <CameraController walkZ={walkZ} frame={frame} totalFrames={300} />

      {/* ── Lighting — base ── */}
      <ambientLight color="#E8F0F8" intensity={0.7} />
      <directionalLight position={[5, 12, 5]} intensity={0.6} color="#F0F8FF" />
      <directionalLight position={[-3, 8, -2]} intensity={0.25} color="#D0E8FF" />
      <hemisphereLight args={["#E8F4FF", "#C0D8E8", 0.35]} />

      {/* ── Dynamic colored lights (FrontWalk style) ── */}
      <AmbientColorLights frame={frame} walkZ={walkZ} />
      <LightBeams frame={frame} walkZ={walkZ} />

      <fog attach="fog" args={[COL.fog, 8, 40]} />

      {/* ── Ground ── */}
      <mesh position={[0, -0.1, 15]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 50]} />
        <meshStandardMaterial color={COL.ice} roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Circuit platforms */}
      <CircuitPlatform position={[0, 0, -2]} size={[4, 0.15, 5]} />
      <CircuitPlatform position={[-1, 0, 5]} size={[5, 0.15, 4]} />
      <CircuitPlatform position={[0.5, 0, 11]} size={[4.5, 0.15, 5]} />
      <CircuitPlatform position={[-0.5, 0, 18]} size={[5, 0.15, 4]} />
      <CircuitPlatform position={[0, 0, 25]} size={[4, 0.15, 5]} />
      <CircuitPlatform position={[-5, 0.3, 3]} size={[3, 0.2, 2.5]} transparent />
      <CircuitPlatform position={[5.5, 0.15, 9]} size={[2.5, 0.15, 3]} transparent />
      <CircuitPlatform position={[-4.5, 0.5, 16]} size={[3, 0.18, 2]} transparent />
      <CircuitPlatform position={[6, 0.2, 22]} size={[2.5, 0.15, 2.5]} transparent />

      {/* ── Trees ── */}
      <PixelTree position={[-4, 0, -1]} height={8} spread={3.5} leafCount={100} />
      <PixelTree position={[-5.5, 0, 6]} height={10} spread={4} leafCount={120} />
      <PixelTree position={[-3.5, 0, 13]} height={7} spread={3} leafCount={90} />
      <PixelTree position={[-6, 0, 20]} height={9} spread={3.5} leafCount={110} />
      <PixelTree position={[-4, 0, 28]} height={8} spread={3.2} leafCount={95} />
      <PixelTree position={[4.5, 0, 2]} height={9} spread={3.8} leafCount={110} />
      <PixelTree position={[5, 0, 10]} height={7.5} spread={3} leafCount={85} />
      <PixelTree position={[3.5, 0, 17]} height={10} spread={4.2} leafCount={130} />
      <PixelTree position={[5.5, 0, 24]} height={8} spread={3.5} leafCount={100} />
      <PixelTree position={[-9, 0, 4]} height={12} spread={5} leafCount={90} />
      <PixelTree position={[9, 0, 14]} height={11} spread={4.5} leafCount={85} />
      <PixelTree position={[-8, 0, 22]} height={13} spread={5.5} leafCount={95} />

      {/* ── Giant tree ── */}
      <GiantTree position={[0, 0, 32]} />
      <mesh position={[0, 0.05, 32]}><cylinderGeometry args={[4, 5, 0.2, 8]} /><meshStandardMaterial color={COL.platform} roughness={0.3} metalness={0.15} /></mesh>

      {/* ── Props ── */}
      <GiantClock position={[-6, 2.5, 4]} scale={1.8} frame={frame} />
      <CRTMonitor position={[6, 1.5, 8]} scale={2} rotationY={-0.6} />
      <CRTMonitor position={[-5, 3, 18]} scale={1.5} rotationY={0.4} />
      <GiantClock position={[7, 4, 22]} scale={1.2} frame={frame} />

      {/* ── Floating islands ── */}
      <FloatingIsland position={[-7, 3, 8]} size={[2.5, 1.2, 2]} frame={frame} bobSpeed={0.02} />
      <FloatingIsland position={[8, 5, 15]} size={[2, 1.0, 1.8]} frame={frame} bobSpeed={0.025} />
      <FloatingIsland position={[-6, 6, 24]} size={[1.8, 1.1, 2.2]} frame={frame} bobSpeed={0.018} />
      <FloatingIsland position={[7, 4, 28]} size={[2.2, 1.3, 2]} frame={frame} bobSpeed={0.022} />

      {/* ── Clouds ── */}
      <CloudPuff position={[-8, -1, 6]} scale={2} />
      <CloudPuff position={[10, -0.5, 12]} scale={2.5} />
      <CloudPuff position={[-6, -1.5, 20]} scale={3} />
      <CloudPuff position={[8, -1, 26]} scale={2} />
      <CloudPuff position={[0, -2, 35]} scale={4} />
      <CloudPuff position={[-4, 10, 10]} scale={3} />
      <CloudPuff position={[5, 12, 20]} scale={2.5} />

      {/* ── Falling numbers + dust VFX ── */}
      <ImpactNumber text="1" landZ={-1} frame={frame} triggerFrame={50} xOffset={-0.5} />
      <ImpactNumber text="2" landZ={7} frame={frame} triggerFrame={110} xOffset={-0.5} />
      <ImpactNumber text="3" landZ={14} frame={frame} triggerFrame={170} xOffset={-0.5} />
      <ImpactDust frame={frame} />

      {/* ── Main character ── */}
      <WalkingCharacter
        frame={frame}
        walkPos={[0, 0.1, walkZ]}
        color={COL.character}
        rotationY={0}
        excited={isExcited}
        excitedIntensity={excInt}
        flinchAmount={isExcited ? 0 : mainFlinch}
      />
      <mesh position={[0, 0.03, walkZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.15} />
      </mesh>

      {/* ── NPC Walkers ── */}
      {NPC_PATHS.map((npc, i) => (
        <NPCWalker
          key={i}
          frame={frame}
          path={npc.path}
          speed={npc.speed}
          color={NPC_OUTFITS[npc.outfit][0]}
          secondaryColor={NPC_OUTFITS[npc.outfit][1]}
          startDelay={npc.delay}
          scale={npc.scale}
        />
      ))}

      {/* ── Bystanders ── */}
      <Bystander position={[-4.5, 0.1, 5]} color={NPC_OUTFITS[6][0]} secondaryColor={NPC_OUTFITS[6][1]} frame={frame} rotationY={0.8} scale={0.85} />
      <Bystander position={[5.2, 0.1, 11]} color={NPC_OUTFITS[7][0]} secondaryColor={NPC_OUTFITS[7][1]} frame={frame} rotationY={-1.2} scale={0.9} />
      <Bystander position={[-3, 0.1, 18]} color={NPC_OUTFITS[8][0]} secondaryColor={NPC_OUTFITS[8][1]} frame={frame} rotationY={0.3} scale={0.8} />
      <Bystander position={[4, 0.1, 24]} color={NPC_OUTFITS[9][0]} secondaryColor={NPC_OUTFITS[9][1]} frame={frame} rotationY={-0.6} scale={0.85} />
    </>
  );
};

// ── Composition ─────────────────────────────────────────────────────────────
export const Test3DWalk: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: COL.bg }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 55, near: 0.1, far: 100, position: [0, 1.6, 4] }}
        gl={{
          antialias: true, alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.4,
        }}
        style={{ background: COL.bg }}
      >
        <Suspense fallback={null}>
          <Scene frame={frame} />
        </Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
