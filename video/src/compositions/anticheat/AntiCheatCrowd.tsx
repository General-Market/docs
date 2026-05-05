import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";

// One figure fills the frame. Camera pulls back. A thousand others appear.
// The red one — still red — keeps 67% of the profits.

const SCENE_SECONDS = 5;
const COLS = 31;
const ROWS = 31;
const SPACING = 30;
const CENTER_COL = (COLS - 1) / 2;
const CENTER_ROW = (ROWS - 1) / 2;

const START_SCALE = 110;
const END_SCALE = 1;
const ZOOM_DURATION = toFrames(3);

export const AntiCheatCrowd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tRaw = Math.min(1, Math.max(0, frame / ZOOM_DURATION));
  const tEase = 0.5 - 0.5 * Math.cos(tRaw * Math.PI);
  const scale = START_SCALE * Math.pow(END_SCALE / START_SCALE, tEase);

  const vbW = W / scale;
  const vbH = H / scale;
  const vbX = -vbW / 2;
  const vbY = -vbH / 2;

  const labelEnter = spring({
    frame: frame - toFrames(3.1),
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const labelY = interpolate(labelEnter, [0, 1], [22, 0]);

  const pulse = (Math.sin(frame * 0.14) + 1) / 2;

  // Soft scene-out as we approach the next cut.
  const sceneOut = interpolate(
    frame,
    [toFrames(SCENE_SECONDS - 0.4), toFrames(SCENE_SECONDS)],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: font,
        overflow: "hidden",
        opacity: sceneOut,
      }}
    >
      <svg
        width={W}
        height={H}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <symbol id="person-silhouette" overflow="visible">
            <circle cx="0" cy="-8" r="4" />
            <path d="M -6,12 Q -7,2 -4,-2 L 4,-2 Q 7,2 6,12 Z" />
          </symbol>
        </defs>

        {/* The crowd — anonymous figures */}
        {Array.from({ length: ROWS }).map((_, r) =>
          Array.from({ length: COLS }).map((_, c) => {
            if (r === CENTER_ROW && c === CENTER_COL) return null;
            const x = (c - CENTER_COL) * SPACING;
            const y = (r - CENTER_ROW) * SPACING;
            const seed = ((c * 97 + r * 31) % 100) / 100;
            const op = 0.5 + seed * 0.32;
            return (
              <use
                key={`${r}-${c}`}
                href="#person-silhouette"
                x={x}
                y={y}
                fill={colors.dim}
                opacity={op}
              />
            );
          }),
        )}

        {/* The one — red, pulsing */}
        <g>
          <circle
            cx={0}
            cy={2}
            r={14 + pulse * 5}
            fill={colors.accent}
            opacity={0.2}
          />
          <use href="#person-silhouette" fill={colors.accent} />
        </g>
      </svg>

      {/* Vignette to push focus inward */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 50%, transparent 48%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Eyebrow */}
      <div
        style={{
          position: "absolute",
          top: "16%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 38,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
          opacity: labelEnter,
          transform: `translateY(${labelY}px)`,
        }}
      >
        1 in 1,000
      </div>

      {/* Kicker */}
      <div
        style={{
          position: "absolute",
          bottom: "16%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 92,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: colors.fg,
          opacity: labelEnter,
          transform: `translateY(${labelY}px)`,
        }}
      >
        keeps <span style={{ color: colors.accent }}>67%</span> of the profits.
      </div>
    </AbsoluteFill>
  );
};

export const antiCheatCrowdMeta = {
  id: "AntiCheatCrowd",
  component: AntiCheatCrowd,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
