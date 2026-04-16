/**
 * LiquidGlassOrb — the hero.
 *
 * A single sphere whose material morphs through the acts:
 *   I–III:  full Liquid Glass (high IOR, chromatic aberration, distortion)
 *   IV:     settled puck (low transmission, matte, a thin rainbow torus inside)
 *   V–VI:   puck, same as IV, with a rotating inner avatar
 *   VII:    re-glassifies (back to Liquid Glass)
 *   VIII:   exits below, shrinking
 */

import { useMemo } from "react";
import { interpolate } from "remotion";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { ACTS } from "../theme";

type OrbState = {
  // Spatial
  y: number;        // vertical position (world units)
  scale: number;    // radius multiplier
  visible: boolean;

  // Material
  transmission: number;
  ior: number;
  chromaticAberration: number;
  distortion: number;
  distortionScale: number;
  thickness: number;
  roughness: number;
  color: string;

  // Inner content
  innerGlow: number;   // emissive torus intensity (the blue ring)
  avatarVisible: boolean;
  avatarHue: number;   // cycles through identities
};

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

function orbStateForFrame(frame: number): OrbState {
  // Defaults: full glass, offscreen below.
  const state: OrbState = {
    y: -3.2,
    scale: 0,
    visible: true,
    transmission: 1,
    ior: 1.45,
    chromaticAberration: 0.02,
    distortion: 0.08,
    distortionScale: 0.2,
    thickness: 0.6,
    roughness: 0,
    color: "#F5F7FF",
    innerGlow: 1.0,
    avatarVisible: false,
    avatarHue: 0,
  };

  // === Act I — Arrival (0–27): rises from below to anchor near bottom. ===
  if (frame < ACTS.I.end) {
    const t = easeOutExpo(frame / (ACTS.I.end - ACTS.I.start));
    state.y = interpolate(t, [0, 1], [-3.2, -1.2]);
    state.scale = interpolate(t, [0, 1], [0.75, 0.85]);
    state.innerGlow = 1.4;
    return state;
  }

  // === Act II — Ascent (27–69): climbs toward center, grows. ===
  if (frame < ACTS.II.end) {
    const t = easeOutExpo(
      (frame - ACTS.II.start) / (ACTS.II.end - ACTS.II.start)
    );
    state.y = interpolate(t, [0, 1], [-1.2, 0.15]);
    state.scale = interpolate(t, [0, 1], [0.85, 1.35]);
    state.ior = interpolate(t, [0, 1], [1.45, 1.8]);
    state.chromaticAberration = interpolate(t, [0, 1], [0.02, 0.06]);
    state.distortion = interpolate(t, [0, 1], [0.08, 0.18]);
    state.innerGlow = interpolate(t, [0, 1], [1.4, 1.8]);
    // Sinusoidal drift
    state.y += Math.sin(frame * 0.22) * 0.02;
    return state;
  }

  // === Act III — The Lens (69–87): peak refraction over the text. ===
  if (frame < ACTS.III.end) {
    const t = (frame - ACTS.III.start) / (ACTS.III.end - ACTS.III.start);
    // Parabolic peak at t=0.5
    const peak = 1 - Math.pow(2 * t - 1, 2);
    state.y = 0.2;
    state.scale = interpolate(t, [0, 1], [1.35, 1.55]);
    state.ior = interpolate(peak, [0, 1], [1.8, 1.95]);
    state.chromaticAberration = interpolate(peak, [0, 1], [0.06, 0.12]);
    state.distortion = interpolate(peak, [0, 1], [0.18, 0.35]);
    state.distortionScale = interpolate(peak, [0, 1], [0.2, 0.55]);
    state.innerGlow = 1.8;
    return state;
  }

  // === Act IV — Settle (87–123): orb shrinks to matte puck, inner glow fades, avatar appears. ===
  if (frame < ACTS.IV.end) {
    const t = (frame - ACTS.IV.start) / (ACTS.IV.end - ACTS.IV.start);
    const te = easeOutExpo(t);
    state.y = interpolate(te, [0, 1], [0.2, 0.55]);
    state.scale = interpolate(te, [0, 1], [1.55, 0.55]);
    state.transmission = interpolate(te, [0, 1], [1, 0.18]);
    state.ior = interpolate(te, [0, 1], [1.95, 1.25]);
    state.chromaticAberration = interpolate(te, [0, 1], [0.12, 0.015]);
    state.distortion = interpolate(te, [0, 1], [0.35, 0.03]);
    state.roughness = interpolate(te, [0, 1], [0, 0.35]);
    state.thickness = interpolate(te, [0, 1], [0.6, 0.25]);
    state.innerGlow = interpolate(te, [0, 1], [1.8, 0.25]);
    state.avatarVisible = t > 0.55;
    return state;
  }

  // === Act V — Generation (123–195): puck holds, avatar cycles. ===
  if (frame < ACTS.V.end) {
    state.y = 0.55;
    state.scale = 0.55;
    state.transmission = 0.18;
    state.ior = 1.25;
    state.chromaticAberration = 0.015;
    state.distortion = 0.03;
    state.roughness = 0.35;
    state.thickness = 0.25;
    state.innerGlow = 0.25;
    state.avatarVisible = true;
    state.avatarHue =
      ((frame - ACTS.V.start) / (ACTS.V.end - ACTS.V.start)) * 360;
    return state;
  }

  // === Act VI — Swarm (195–270): puck begins to re-glassify at the end. ===
  if (frame < ACTS.VI.end) {
    const t = (frame - ACTS.VI.start) / (ACTS.VI.end - ACTS.VI.start);
    const ramp = Math.pow(t, 2.5); // accelerate glass return at end
    state.y = 0.55 - ramp * 0.15;
    state.scale = interpolate(ramp, [0, 1], [0.55, 0.9]);
    state.transmission = interpolate(ramp, [0, 1], [0.18, 0.85]);
    state.ior = interpolate(ramp, [0, 1], [1.25, 1.7]);
    state.chromaticAberration = interpolate(ramp, [0, 1], [0.015, 0.05]);
    state.distortion = interpolate(ramp, [0, 1], [0.03, 0.15]);
    state.roughness = interpolate(ramp, [0, 1], [0.35, 0.05]);
    state.thickness = interpolate(ramp, [0, 1], [0.25, 0.5]);
    state.innerGlow = interpolate(ramp, [0, 1], [0.25, 1.2]);
    state.avatarVisible = t < 0.7;
    state.avatarHue = (frame * 4) % 360;
    return state;
  }

  // === Act VII — Refraction (270–315): full glass again, big lens over text. ===
  if (frame < ACTS.VII.end) {
    const t = (frame - ACTS.VII.start) / (ACTS.VII.end - ACTS.VII.start);
    const peak = 1 - Math.pow(2 * t - 1, 2);
    state.y = 0.4;
    state.scale = interpolate(t, [0, 1], [0.9, 1.1]);
    state.transmission = 0.95;
    state.ior = interpolate(peak, [0, 1], [1.7, 1.9]);
    state.chromaticAberration = interpolate(peak, [0, 1], [0.05, 0.1]);
    state.distortion = interpolate(peak, [0, 1], [0.15, 0.3]);
    state.distortionScale = interpolate(peak, [0, 1], [0.3, 0.5]);
    state.roughness = 0.02;
    state.thickness = 0.55;
    state.innerGlow = 1.5;
    return state;
  }

  // === Act VIII — Return (315–390): orb exits below frame. ===
  if (frame < ACTS.VIII.end) {
    const t = (frame - ACTS.VIII.start) / (ACTS.VIII.end - ACTS.VIII.start);
    const te = easeOutExpo(t);
    state.y = interpolate(te, [0, 1], [0.4, -3.2]);
    state.scale = interpolate(te, [0, 1], [1.1, 0.7]);
    state.transmission = 0.95;
    state.ior = interpolate(te, [0, 1], [1.9, 1.45]);
    state.chromaticAberration = interpolate(te, [0, 1], [0.1, 0.02]);
    state.distortion = interpolate(te, [0, 1], [0.3, 0.08]);
    state.thickness = 0.55;
    state.innerGlow = 1.2;
    return state;
  }

  return state;
}

// A small emissive torus that sits inside the orb as the "blue core ring".
const CoreRing: React.FC<{ intensity: number; frame: number }> = ({
  intensity,
  frame,
}) => {
  if (intensity <= 0) return null;
  return (
    <mesh rotation={[Math.PI / 2 + frame * 0.004, frame * 0.006, 0]}>
      <torusGeometry args={[0.55, 0.11, 32, 96]} />
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

// A tiny "avatar" object inside the puck — cycles color/shape via hue.
const Avatar: React.FC<{ visible: boolean; hue: number; frame: number }> = ({
  visible,
  hue,
  frame,
}) => {
  const color = useMemo(() => {
    const c = new THREE.Color();
    c.setHSL(((hue % 360) / 360 + 1) % 1, 0.7, 0.55);
    return c;
  }, [hue]);

  if (!visible) return null;

  return (
    <group rotation={[0, frame * 0.02, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.3}
          metalness={0.2}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.018, 16, 48]} />
        <meshStandardMaterial
          color="#FFCC66"
          emissive="#FF8844"
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

export const LiquidGlassOrb: React.FC<{ frame: number }> = ({ frame }) => {
  const s = orbStateForFrame(frame);

  // Subtle horizontal drift
  const drift = Math.sin(frame * 0.04) * 0.03;

  return (
    <group position={[drift, s.y, 0]} scale={s.scale}>
      {/* Inner ring (visible through glass) */}
      <CoreRing intensity={s.innerGlow} frame={frame} />
      {/* Inner avatar (visible through puck during Act V–VI) */}
      <Avatar visible={s.avatarVisible} hue={s.avatarHue} frame={frame} />

      {/* The Liquid Glass shell */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshTransmissionMaterial
          samples={6}
          thickness={s.thickness}
          roughness={s.roughness}
          transmission={s.transmission}
          ior={s.ior}
          chromaticAberration={s.chromaticAberration}
          backside
          backsideThickness={s.thickness * 0.4}
          anisotropy={0.15}
          distortion={s.distortion}
          distortionScale={s.distortionScale}
          temporalDistortion={0.015}
          color={s.color}
          attenuationColor="#FFFFFF"
          attenuationDistance={8}
        />
      </mesh>
    </group>
  );
};
