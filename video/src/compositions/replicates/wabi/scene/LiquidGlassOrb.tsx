/**
 * LiquidGlassOrb — the hero.
 *
 * Motion is defined as a keyframe table with smoothstep interpolation between
 * each key — G1-continuous, no velocity discontinuities at act boundaries.
 * Every morphable value (position, scale, ior, transmission, etc.) has its own
 * keyframe list and is sampled independently.
 */

import { useMemo } from "react";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

type Key = readonly [frame: number, value: number];

// Smoothstep: 3t² - 2t³. Zero slope at t=0 and t=1 → velocity-continuous hand-offs.
const smoothstep = (t: number) => t * t * (3 - 2 * t);

function sample(keys: readonly Key[], frame: number): number {
  if (frame <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (frame >= last[0]) return last[1];

  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, v0] = keys[i];
    const [f1, v1] = keys[i + 1];
    if (frame >= f0 && frame <= f1) {
      const t = (frame - f0) / (f1 - f0);
      return v0 + (v1 - v0) * smoothstep(t);
    }
  }
  return last[1];
}

// Act timeline reference: I[0-27] II[27-69] III[69-87] IV[87-123] V[123-195]
//                        VI[195-270] VII[270-315] VIII[315-390]

const KEY = {
  // Vertical position (world units). Negative = below center.
  y: [
    [0, -3.2],     // offscreen below
    [27, -1.2],    // end of Act I (anchor near bottom)
    [69, 0.15],    // end of Act II (center)
    [78, 0.2],     // mid Act III — hover
    [87, 0.25],    // end of Act III
    [123, 0.55],   // settled puck (Act IV end)
    [270, 0.45],   // slight re-drift into Act VII
    [290, 0.4],    // VII peak
    [315, 0.4],    // VII end
    [390, -3.2],   // exit offscreen
  ],
  // Scale multiplier.
  scale: [
    [0, 0.75],
    [27, 0.85],
    [69, 1.35],
    [78, 1.5],
    [87, 1.55],
    [100, 1.1],
    [123, 0.55],
    [260, 0.6],
    [290, 1.05],
    [315, 1.1],
    [390, 0.7],
  ],
  transmission: [
    [0, 1.0],
    [87, 1.0],     // full glass through Act III
    [110, 0.5],    // dropping during settle
    [123, 0.18],   // puck
    [240, 0.18],
    [290, 0.95],   // re-glassified in Act VII
    [390, 0.95],
  ],
  ior: [
    [0, 1.45],
    [27, 1.55],
    [50, 1.7],
    [69, 1.8],
    [78, 1.95],    // lens peak
    [87, 1.85],
    [110, 1.4],
    [123, 1.25],   // puck
    [260, 1.35],
    [290, 1.9],
    [315, 1.9],
    [390, 1.45],
  ],
  chromaticAberration: [
    [0, 0.02],
    [27, 0.03],
    [69, 0.06],
    [78, 0.12],    // peak
    [87, 0.08],
    [110, 0.04],
    [123, 0.015],
    [260, 0.025],
    [290, 0.1],
    [315, 0.1],
    [390, 0.02],
  ],
  distortion: [
    [0, 0.08],
    [27, 0.12],
    [69, 0.18],
    [78, 0.35],    // peak
    [87, 0.22],
    [123, 0.03],
    [260, 0.05],
    [290, 0.3],
    [315, 0.3],
    [390, 0.08],
  ],
  distortionScale: [
    [0, 0.2],
    [78, 0.55],
    [123, 0.15],
    [290, 0.5],
    [390, 0.2],
  ],
  thickness: [
    [0, 0.5],
    [78, 0.65],
    [123, 0.25],
    [290, 0.55],
    [390, 0.5],
  ],
  roughness: [
    [0, 0],
    [100, 0.05],
    [123, 0.3],     // slightly matte puck
    [260, 0.15],
    [290, 0.02],
    [390, 0.0],
  ],
  // Emissive intensity of the inner blue ring.
  innerGlow: [
    [0, 1.4],
    [27, 1.6],
    [69, 1.8],
    [78, 1.9],
    [87, 1.8],
    [110, 0.8],
    [123, 0.25],
    [240, 0.3],
    [290, 1.4],
    [315, 1.5],
    [390, 1.2],
  ],
  // 1 = visible, 0 = hidden. Used for the inner avatar during V–VI.
  avatarOpacity: [
    [0, 0],
    [108, 0],
    [123, 1],
    [240, 1],
    [270, 0],
    [390, 0],
  ],
} as const;

const CoreRing: React.FC<{ intensity: number; frame: number }> = ({
  intensity,
  frame,
}) => {
  if (intensity <= 0.01) return null;
  return (
    <mesh rotation={[Math.PI / 2 + frame * 0.004, frame * 0.006, 0]}>
      <torusGeometry args={[0.55, 0.11, 24, 64]} />
      <meshStandardMaterial
        color="#4A9BFF"
        emissive="#6BB6FF"
        emissiveIntensity={intensity}
        transparent
        opacity={Math.min(1, intensity)}
        toneMapped={false}
      />
    </mesh>
  );
};

const Avatar: React.FC<{ opacity: number; frame: number }> = ({
  opacity,
  frame,
}) => {
  const color = useMemo(() => {
    const c = new THREE.Color();
    c.setHSL(((frame * 0.008) % 1 + 1) % 1, 0.7, 0.55);
    return c;
  }, [frame]);

  if (opacity <= 0.01) return null;

  return (
    <group rotation={[0, frame * 0.02, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35 * opacity}
          roughness={0.3}
          metalness={0.2}
          transparent
          opacity={opacity}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.018, 12, 32]} />
        <meshStandardMaterial
          color="#FFCC66"
          emissive="#FF8844"
          emissiveIntensity={0.5 * opacity}
          transparent
          opacity={opacity}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

export const LiquidGlassOrb: React.FC<{ frame: number }> = ({ frame }) => {
  const y = sample(KEY.y, frame);
  const scale = sample(KEY.scale, frame);
  const transmission = sample(KEY.transmission, frame);
  const ior = sample(KEY.ior, frame);
  const chromaticAberration = sample(KEY.chromaticAberration, frame);
  const distortion = sample(KEY.distortion, frame);
  const distortionScale = sample(KEY.distortionScale, frame);
  const thickness = sample(KEY.thickness, frame);
  const roughness = sample(KEY.roughness, frame);
  const innerGlow = sample(KEY.innerGlow, frame);
  const avatarOpacity = sample(KEY.avatarOpacity, frame);

  // Organic low-frequency drift — Perlin would be ideal; sum-of-sines is close enough.
  const driftX =
    Math.sin(frame * 0.031) * 0.015 + Math.sin(frame * 0.073) * 0.008;
  const driftY = Math.sin(frame * 0.027) * 0.012;

  return (
    <group position={[driftX, y + driftY, 0]} scale={scale}>
      <CoreRing intensity={innerGlow} frame={frame} />
      <Avatar opacity={avatarOpacity} frame={frame} />

      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshTransmissionMaterial
          samples={6}
          thickness={thickness}
          roughness={roughness}
          transmission={transmission}
          ior={ior}
          chromaticAberration={chromaticAberration}
          backside
          backsideThickness={thickness * 0.4}
          anisotropy={0.15}
          distortion={distortion}
          distortionScale={distortionScale}
          temporalDistortion={0.015}
          color="#F5F7FF"
          attenuationColor="#FFFFFF"
          attenuationDistance={8}
        />
      </mesh>
    </group>
  );
};
