/**
 * ParticleField — dust motes caught in a projector beam.
 *
 * Not confetti. Not snow. The kind of particles you only notice
 * when someone removes them and the scene feels suddenly dead.
 * Barely visible. That's the point.
 *
 * Each particle drifts upward (or downward) with a gentle sine-wave
 * lateral wobble. Smaller particles are dimmer — a cheap depth-of-field
 * trick that works because no one inspects dust at 4K.
 *
 * One in ten particles is a "bright" mote — 2x opacity, 1.5x size —
 * as though it drifted into a shaft of light. The rest stay humble.
 *
 * When sceneColor is provided, 30% of particles adopt that hue,
 * tying the dust to whatever world it floats through.
 *
 * Wind physics (optional): spring-driven horizontal gusts at configurable
 * intervals push all particles sideways. The springs overdamp so the
 * displacement accumulates like real wind — a shove, then slow drift back.
 * Technique borrowed from Remotion's Snow component.
 *
 * Deterministic: uses remotion's `random()` for seeded positions.
 * Every render produces the same frame. The universe may be chaos,
 * but this component is not.
 */
import React from "react";
import {
  AbsoluteFill,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface ParticleFieldProps {
  /** Number of particles (default 20) */
  count?: number;
  /** Base speed multiplier (default 1.0) */
  speed?: number;
  /** Particle color (default "rgba(255,255,255,0.05)") */
  color?: string;
  /** Drift direction: 'up' | 'down' (default 'up') */
  direction?: "up" | "down";
  /** Scene accent color — 30% of particles adopt this hue (e.g. "#f59e0b" for amber) */
  sceneColor?: string;
  /** Frame numbers when wind gusts occur. Set to [] to disable wind entirely. */
  windPushes?: number[];
  /** Multiplier for wind displacement (default 1.0). Higher = more dramatic gusts. */
  windStrength?: number;
}

/** Default wind gust schedule — one push roughly every 100 frames. */
const DEFAULT_WIND_PUSHES = [100, 200, 300, 400, 500, 600];

/**
 * Parse a hex color (#rgb or #rrggbb) into [r, g, b].
 * Returns null on anything it can't parse — graceful degradation
 * is the only kind of grace software deserves.
 */
const parseHex = (hex: string): [number, number, number] | null => {
  const m = hex.match(/^#?([0-9a-fA-F]{3,8})$/);
  if (!m) return null;
  const h = m[1];
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  if (h.length >= 6) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return null;
};

interface Particle {
  /** Initial X position, 0-1 fraction of viewport width */
  x0: number;
  /** Initial Y position, 0-1 fraction of viewport height */
  y0: number;
  /** Radius in px (1-4, or 1.5-6 for bright motes) */
  radius: number;
  /** Vertical drift speed, px per frame */
  vy: number;
  /** Horizontal sine amplitude, px */
  sineAmp: number;
  /** Sine phase offset, radians */
  phase: number;
  /** Sine frequency multiplier */
  freq: number;
  /** Per-particle wind susceptibility, 0-1. Smaller particles blow more. */
  windFactor: number;
  /** Opacity — smaller particles are dimmer (fake depth-of-field) */
  opacity: number;
  /** Whether this particle is a "bright" dust mote catching light */
  bright: boolean;
  /** Whether this particle should use the scene accent color */
  useSceneColor: boolean;
}

/**
 * Seed string for remotion's `random()`. Deterministic, stable across renders.
 */
const rkey = (i: number, property: string): string => `pf-${i}-${property}`;

const buildParticles = (count: number, speed: number): Particle[] => {
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const baseRadius = 1 + random(rkey(i, "radius")) * 3; // 1-4px
    const normalizedSize = (baseRadius - 1) / 3; // 0-1, where 0 = smallest

    // 1 in 10 is a bright mote
    const bright = random(rkey(i, "bright")) < 0.1;

    // 30% of particles use sceneColor
    const useSceneColor = random(rkey(i, "sceneColor")) < 0.3;

    // Base opacity: 0.03-0.06 — nearly invisible on bright b-roll
    const baseOpacity = 0.03 + normalizedSize * 0.03;

    // Bright motes: 2x opacity, 1.5x size
    const opacity = bright ? Math.min(baseOpacity * 2, 0.24) : baseOpacity;
    const radius = bright ? baseRadius * 1.5 : baseRadius;

    // Wind susceptibility: smaller/lighter particles blow more
    // Range 0.6-1.0, inverse of normalized size
    const windFactor = 1.0 - normalizedSize * 0.4;

    particles.push({
      x0: random(rkey(i, "x")),
      y0: random(rkey(i, "y")),
      radius,
      vy: (0.15 + random(rkey(i, "speed")) * 0.35) * speed,
      sineAmp: 8 + random(rkey(i, "amp")) * 24,
      phase: random(rkey(i, "phase")) * Math.PI * 2,
      freq: 0.005 + random(rkey(i, "freq")) * 0.01,
      windFactor,
      opacity,
      bright,
      useSceneColor,
    });
  }

  return particles;
};

/**
 * Compute accumulated wind displacement at a given frame.
 *
 * Each wind push is a spring that fires at its scheduled frame, overdamped
 * so it ramps up and decays slowly. The displacement of all active springs
 * is summed — exactly the technique from Snow.tsx. The result is a horizontal
 * pixel offset applied to every particle (modulated by per-particle windFactor).
 */
const computeWind = (
  frame: number,
  fps: number,
  windPushes: number[],
  width: number,
  windStrength: number,
): number => {
  if (windPushes.length === 0) return 0;

  return (
    windPushes
      .map((delay) =>
        spring({
          fps,
          frame: frame - delay,
          config: { damping: 200 },
          durationInFrames: 30,
        }) * width,
      )
      .reduce((a, b) => a + b, 0) * windStrength
  );
};

export const ParticleField: React.FC<ParticleFieldProps> = ({
  count = 20,
  speed = 1.0,
  color,
  direction = "up",
  sceneColor,
  windPushes = DEFAULT_WIND_PUSHES,
  windStrength = 1.0,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const particles = React.useMemo(
    () => buildParticles(count, speed),
    [count, speed],
  );

  // Parse scene color once, not per particle per frame
  const sceneRgb = React.useMemo(
    () => (sceneColor ? parseHex(sceneColor) : null),
    [sceneColor],
  );

  const W = 1920;
  const H = 1080;

  const dirMul = direction === "up" ? -1 : 1;

  // Accumulated wind displacement — spring-driven gusts from Snow.tsx
  const wind = computeWind(frame, fps, windPushes, width, windStrength);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {particles.map((p, i) => {
        // Vertical position: drift over time, wrap at edges
        const totalDrift = p.vy * frame * dirMul;
        const y = (((p.y0 * H + totalDrift) % H) + H) % H;

        // Horizontal position: base + sine wobble + wind displacement
        const wobble = Math.sin(frame * p.freq + p.phase) * p.sineAmp;
        const windOffset = -wind * p.windFactor;
        const rawX = p.x0 * W + wobble + windOffset;
        const x = (((rawX) % W) + W) % W;

        // Resolve particle color
        let bg: string;
        if (color) {
          // Explicit color prop takes precedence (legacy behavior)
          bg = color;
        } else if (p.useSceneColor && sceneRgb) {
          // 30% of particles adopt the scene accent
          bg = `rgba(${sceneRgb[0]},${sceneRgb[1]},${sceneRgb[2]},${p.opacity})`;
        } else {
          bg = `rgba(255,255,255,${p.opacity})`;
        }

        const style: React.CSSProperties = {
          position: "absolute",
          left: x,
          top: y,
          width: p.radius * 2,
          height: p.radius * 2,
          borderRadius: "50%",
          backgroundColor: bg,
          opacity: color ? p.opacity : undefined,
          filter: "blur(0.5px)",
          willChange: "transform",
        };

        return <div key={i} style={style} />;
      })}
    </AbsoluteFill>
  );
};
