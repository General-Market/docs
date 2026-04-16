/**
 * BubbleSwarm — rising cloud of worlds, but frugal with GPU.
 *
 * Each bubble is two nested spheres: an emissive colored core and a thin
 * transparent shell. We keep geometry and sample counts low because the eye
 * averages 20 bubbles on screen — per-bubble fidelity matters less than
 * clean composition.
 */

import { MeshTransmissionMaterial } from "@react-three/drei";
import { ACTS } from "../theme";

type Bubble = {
  id: number;
  spawnFrame: number;
  xStart: number;
  xDriftAmp: number;
  xDriftFreq: number;
  yFinal: number;
  riseDuration: number;
  size: number;
  coreColor: string;
  coreEmissive: number;
  fadeOutDelay: number;
};

// Curated palette — warm/cool/jewel, avoiding murky or washed tones.
const COLORS = [
  "#FF6B35", "#F4A261", "#E76F51", "#E9C46A", "#FFB703",
  "#2A9D8F", "#4CC9F0", "#06AED5", "#3A86FF", "#1982C4",
  "#8338EC", "#9D4EDD", "#7209B7", "#6A4C93", "#F72585",
  "#FF006E", "#C9184A", "#E85D75", "#52B788", "#A7C957",
];

function seedRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Frame visible range at z=0: roughly y ∈ [-2.3, 2.3].
// Bubbles settle between y=1.4 and y=4.0 — clustering at and above the top.
const BUBBLES: Bubble[] = (() => {
  const rng = seedRandom(7);
  const list: Bubble[] = [];
  const count = 20;

  const emissionStart = ACTS.V.start;
  const emissionEnd = ACTS.VI.start + 20;

  for (let i = 0; i < count; i++) {
    const tNorm = i / (count - 1);
    const spawnFrame =
      Math.floor(emissionStart + tNorm * (emissionEnd - emissionStart)) +
      Math.floor(rng() * 6 - 3);

    const xBias = (rng() - 0.5) * 2.1;

    const size = 0.1 + rng() * 0.2; // 0.10–0.30
    const normalSize = (size - 0.1) / 0.2;
    // Small bubbles rise higher; larger ones settle below.
    const yFinal = 4.0 - normalSize * 2.5 + (rng() - 0.5) * 0.3;

    list.push({
      id: i,
      spawnFrame,
      xStart: xBias,
      xDriftAmp: 0.08 + rng() * 0.18,
      xDriftFreq: 0.012 + rng() * 0.018,
      yFinal,
      riseDuration: 85 + Math.floor(rng() * 35),
      size,
      coreColor: COLORS[i % COLORS.length],
      coreEmissive: 1.0 + rng() * 0.6,
      fadeOutDelay: Math.floor(rng() * 55),
    });
  }

  // Render largest first so smaller ones sit on top.
  return list.sort((a, b) => b.size - a.size);
})();

const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

const SingleBubble: React.FC<{ bubble: Bubble; frame: number }> = ({
  bubble,
  frame,
}) => {
  const age = frame - bubble.spawnFrame;
  if (age < 0) return null;

  const riseT = Math.min(1, age / bubble.riseDuration);
  const eased = easeOutQuint(riseT);
  const startY = 0.55;
  const y = startY + (bubble.yFinal - startY) * eased;

  const settleAge = Math.max(0, age - bubble.riseDuration);
  const bobY = Math.sin((frame + bubble.id * 11) * 0.025) * 0.04;
  const bobAmount = Math.min(1, settleAge / 20);

  const xDrift =
    Math.sin(frame * bubble.xDriftFreq + bubble.id * 1.7) * bubble.xDriftAmp;
  const x = bubble.xStart + xDrift;

  const fadeInOpacity = Math.min(1, age / 10);

  let fadeOutOpacity = 1;
  const act8Age = frame - (ACTS.VIII.start + bubble.fadeOutDelay);
  if (act8Age > 0) {
    fadeOutOpacity = Math.max(0, 1 - act8Age / 55);
  }

  const opacity = fadeInOpacity * fadeOutOpacity;
  if (opacity <= 0.01) return null;

  return (
    <group position={[x, y + bobY * bobAmount, 0]} scale={bubble.size}>
      {/* Emissive colored core — fills most of the bubble so color dominates. */}
      <mesh scale={0.9}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={bubble.coreColor}
          emissive={bubble.coreColor}
          emissiveIntensity={bubble.coreEmissive}
          roughness={0.4}
          metalness={0.1}
          transparent
          opacity={opacity}
          toneMapped={false}
        />
      </mesh>
      {/* Thin transparent shell — rim lighting + light chromatic aberration. */}
      <mesh>
        <sphereGeometry args={[1, 28, 28]} />
        <MeshTransmissionMaterial
          samples={3}
          thickness={0.12}
          roughness={0}
          transmission={0.88}
          ior={1.3}
          chromaticAberration={0.04}
          backside={false}
          anisotropy={0.08}
          distortion={0.04}
          distortionScale={0.1}
          color="#FFFFFF"
          attenuationColor="#FFFFFF"
          attenuationDistance={6}
          transparent
        />
      </mesh>
    </group>
  );
};

export const BubbleSwarm: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < ACTS.V.start - 5) return null;

  return (
    <group>
      {BUBBLES.map((b) => (
        <SingleBubble key={b.id} bubble={b} frame={frame} />
      ))}
    </group>
  );
};
