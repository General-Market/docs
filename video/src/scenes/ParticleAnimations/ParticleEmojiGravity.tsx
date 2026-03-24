/**
 * ParticleEmojiGravity — Physics-simulated emoji rise & fall
 *
 * Frame-based physics: emojis launch upward, decelerate, hang, then
 * heavier gravity pulls them down fast. Perlin noise for organic drift.
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, random } from "remotion";
import { noise2D } from "@remotion/noise";

const EMOJIS = ["🤔", "🧐", "🤨", "🤔", "🧐", "🤔", "🧐", "🤔", "🧐"];

// Frame-based physics (all units in px/frame)
const GRAVITY_UP = 0.35; // gentle deceleration going up
const GRAVITY_DOWN = 0.95; // heavier pull coming down
const SIM_FRAMES = 220;

interface EmojiDef {
  emoji: string;
  x: number;
  size: number;
  layer: number;
  spawnFrame: number;
  launchVy: number; // negative = upward
  rotSpeed: number;
  noiseId: number;
}

function simulate(d: EmojiDef, screenH: number) {
  const out: { y: number; rot: number; scaleY: number }[] = [];
  let y = screenH + d.size * 0.6;
  let vy = d.launchVy;
  let rot = (random(`ir-${d.noiseId}`) - 0.5) * 15;

  for (let f = 0; f < SIM_FRAMES; f++) {
    const g = vy < 0 ? GRAVITY_UP : GRAVITY_DOWN;
    vy += g;
    y += vy;
    rot += d.rotSpeed + vy * 0.008;

    const speed = Math.abs(vy);
    const scaleY = vy > 3 ? 1 + Math.min(speed * 0.008, 0.18) : 1;

    out.push({ y, rot, scaleY });
  }
  return out;
}

// Layer config: [blur, opacity, sizeScale]
const LAYERS: [number, number, number][] = [
  [3.5, 0.28, 0.55],
  [1, 0.55, 0.85],
  [0, 1.0, 1.35],
];

export const ParticleEmojiGravity = ({
  startDelay = 0,
  emojiCount = 80,
}: {
  startDelay?: number;
  emojiCount?: number;
}) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();

  const defs: EmojiDef[] = React.useMemo(() => {
    return Array.from({ length: emojiCount }, (_, i) => {
      const layer = i < emojiCount * 0.2 ? 0 : i < emojiCount * 0.5 ? 1 : 2;
      const [, , sizeScale] = LAYERS[layer];
      return {
        emoji: EMOJIS[Math.floor(random(`et-${i}`) * EMOJIS.length)],
        x: -8 + random(`ex-${i}`) * 116,
        size: (100 + random(`es-${i}`) * 200) * sizeScale,
        layer,
        spawnFrame: Math.floor(random(`ed-${i}`) * 15),
        launchVy: -(14 + random(`ev-${i}`) * 16),
        rotSpeed: (random(`er-${i}`) - 0.5) * 1.8,
        noiseId: i,
      };
    });
  }, [emojiCount]);

  const trajectories = React.useMemo(
    () => defs.map((d) => simulate(d, height)),
    [defs, height],
  );

  const order = React.useMemo(
    () => defs.map((_, i) => i).sort((a, b) => defs[a].layer - defs[b].layer),
    [defs],
  );

  return (
    <AbsoluteFill style={{ background: "#07070f", overflow: "hidden" }}>
      {/* Faint grid */}
      <svg width={width} height={height} style={{ position: "absolute", opacity: 0.035 }}>
        <defs>
          <pattern id="eg" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#fff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#eg)" />
      </svg>

      {order.map((idx) => {
        const d = defs[idx];
        const traj = trajectories[idx];
        const [blur, baseOpacity] = LAYERS[d.layer];

        const lf = frame - startDelay - d.spawnFrame;
        if (lf < 0 || lf >= SIM_FRAMES) return null;

        const p = traj[lf];
        if (p.y > height + d.size || p.y < -d.size) return null;

        const nx = noise2D(`x${d.noiseId}`, lf * 0.03, 0) * 20;
        const ny = noise2D(`y${d.noiseId}`, 0, lf * 0.03) * 6;
        const opacity = Math.min(lf / 5, 1) * baseOpacity;

        return (
          <div
            key={d.noiseId}
            style={{
              position: "absolute",
              left: `${d.x}%`,
              top: 0,
              fontSize: d.size,
              lineHeight: 1,
              transform: `translate(-50%, ${p.y + ny}px) translateX(${nx}px) rotate(${p.rot}deg) scaleY(${p.scaleY})`,
              opacity,
              filter: blur > 0 ? `blur(${blur}px)` : undefined,
              willChange: "transform",
            }}
          >
            {d.emoji}
          </div>
        );
      })}

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgba(7,7,15,0.9) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
