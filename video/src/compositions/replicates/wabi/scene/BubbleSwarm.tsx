/**
 * BubbleSwarm — rising cloud of marble-like worlds.
 *
 * Each bubble is a single solid color. No transmission (no see-through color
 * mixing between bubbles). Glass appearance comes from clearcoat + iridescence
 * on a meshPhysicalMaterial — uniform surface, distinct rim sheen, specular
 * highlight, but opaque.
 *
 * Positions are grid-staggered at spawn so bubbles don't pile on each other.
 * Motion uses smoothstep (ease-in-out) — acceleration then deceleration.
 */

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
  color: string;
  iridescence: number;
  fadeOutDelay: number;
};

// Curated palette — bright, saturated, distinguishable at small size.
const COLORS = [
  "#FF6B35", "#F4A261", "#E9C46A", "#FFB703", "#E76F51",
  "#2A9D8F", "#06AED5", "#3A86FF", "#1982C4", "#4CC9F0",
  "#8338EC", "#9D4EDD", "#7209B7", "#6A4C93", "#F72585",
  "#FF006E", "#C9184A", "#E85D75", "#52B788", "#A7C957",
];

function seedRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Grid-based placement so bubbles don't overlap.
// Visible canvas at z=0 is roughly x ∈ [-1.3, 1.3], y ∈ [-2.3, 2.3].
// Target zone for settled bubbles: x ∈ [-1.1, 1.1], y ∈ [1.4, 4.0].
const BUBBLES: Bubble[] = (() => {
  const rng = seedRandom(11);
  const list: Bubble[] = [];
  const count = 20;

  const emissionStart = ACTS.V.start;
  const emissionEnd = ACTS.VI.start + 30;

  // Lay out a 4-column × 5-row grid in the target cluster zone; jitter each.
  const cols = 4;
  const rows = Math.ceil(count / cols);
  const xMin = -1.1;
  const xMax = 1.1;
  const yMin = 1.3;
  const yMax = 4.0;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const xCell = xMin + ((col + 0.5) / cols) * (xMax - xMin);
    const yCell = yMin + ((row + 0.5) / rows) * (yMax - yMin);

    // Small jitter so the grid doesn't read as a grid.
    const xJitter = (rng() - 0.5) * 0.35;
    const yJitter = (rng() - 0.5) * 0.3;

    const tNorm = i / (count - 1);
    const spawnFrame =
      Math.floor(emissionStart + tNorm * (emissionEnd - emissionStart)) +
      Math.floor(rng() * 8 - 4);

    const size = 0.13 + rng() * 0.14; // 0.13–0.27

    list.push({
      id: i,
      spawnFrame,
      xStart: xCell + xJitter,
      xDriftAmp: 0.05 + rng() * 0.1, // small, so bubbles don't drift into each other
      xDriftFreq: 0.012 + rng() * 0.018,
      yFinal: yCell + yJitter,
      riseDuration: 110 + Math.floor(rng() * 30), // 110–140 frames for a smooth long rise
      size,
      color: COLORS[i % COLORS.length],
      iridescence: 0.4 + rng() * 0.5,
      fadeOutDelay: Math.floor(rng() * 55),
    });
  }

  // Render larger bubbles first (z-order).
  return list.sort((a, b) => b.size - a.size);
})();

// Smoothstep: 3t² - 2t³. Ease-in-out — accelerates smoothly, decelerates smoothly.
const smoothstep = (t: number) => t * t * (3 - 2 * t);

const SingleBubble: React.FC<{ bubble: Bubble; frame: number }> = ({
  bubble,
  frame,
}) => {
  const age = frame - bubble.spawnFrame;
  if (age < 0) return null;

  const riseT = Math.min(1, age / bubble.riseDuration);
  const eased = smoothstep(riseT);
  const startY = 0.55;
  const y = startY + (bubble.yFinal - startY) * eased;

  // Gentle bob once settled.
  const settleAge = Math.max(0, age - bubble.riseDuration);
  const bobY = Math.sin((frame + bubble.id * 11) * 0.025) * 0.03;
  const bobAmount = Math.min(1, settleAge / 20);

  // Low-amplitude horizontal drift (never enough to collide with neighbor).
  const xDrift =
    Math.sin(frame * bubble.xDriftFreq + bubble.id * 1.7) * bubble.xDriftAmp;
  const x = bubble.xStart + xDrift;

  const fadeInOpacity = Math.min(1, age / 12);

  let fadeOutOpacity = 1;
  const act8Age = frame - (ACTS.VIII.start + bubble.fadeOutDelay);
  if (act8Age > 0) {
    fadeOutOpacity = Math.max(0, 1 - act8Age / 55);
  }

  const opacity = fadeInOpacity * fadeOutOpacity;
  if (opacity <= 0.01) return null;

  return (
    <group position={[x, y + bobY * bobAmount, 0]} scale={bubble.size}>
      <mesh>
        <sphereGeometry args={[1, 24, 24]} />
        <meshPhysicalMaterial
          color={bubble.color}
          roughness={0.25}
          metalness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.05}
          iridescence={bubble.iridescence}
          iridescenceIOR={1.3}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Specular highlight — a tiny white sphere at top-left. */}
      <mesh position={[-0.28, 0.38, 0.85]} scale={0.18}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={opacity * 0.8}
          toneMapped={false}
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
