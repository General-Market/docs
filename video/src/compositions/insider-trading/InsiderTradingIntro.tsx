import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  OffthreadVideo,
  staticFile,
} from "remotion";
import type { ClipManifest } from "./types";

export type InsiderTradingProps = {
  manifest: ClipManifest;
};

const FPS = 30;
const COLS = 7;
const ROWS = 7;
const CELL_W = 1920 / COLS;
const CELL_H = 1080 / ROWS;

// Tilt angle in degrees (slight backward lean on X axis)
const TILT_X = 12;
// Scale > 1 so edges bleed off screen — enables scroll
const SCALE = 1.15;
// Scroll speed in pixels per frame
const SCROLL_SPEED = 2.0;

export const InsiderTradingIntro: React.FC<InsiderTradingProps> = ({
  manifest,
}) => {
  const frame = useCurrentFrame();
  const clips = manifest?.clips ?? [];

  if (clips.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ color: "#666", fontFamily: "monospace", fontSize: 24 }}>
          No clips loaded
        </div>
      </AbsoluteFill>
    );
  }

  // Fill the grid by repeating clips if fewer than cells
  const totalCells = COLS * ROWS;
  const gridClips: typeof clips = [];
  for (let i = 0; i < totalCells; i++) {
    gridClips.push(clips[i % clips.length]);
  }

  // Continuous vertical scroll
  const scrollY = frame * SCROLL_SPEED;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* 3D perspective container */}
      <div
        style={{
          width: "100%",
          height: "100%",
          perspective: 1800,
          perspectiveOrigin: "50% 45%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Tilted + scaled grid */}
        <div
          style={{
            width: 1920,
            height: 1080,
            transform: `rotateX(${TILT_X}deg) scale(${SCALE}) translateY(${-scrollY}px)`,
            transformStyle: "preserve-3d",
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            gap: 3,
          }}
        >
          {gridClips.map((clip, i) => {
            // Stagger start frames so clips don't all sync
            const staggerFrames = Math.floor((i * 7) % 30);

            return (
              <div
                key={i}
                style={{
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                  borderRadius: 2,
                  position: "relative",
                }}
              >
                <OffthreadVideo
                  src={staticFile(
                    `insider-trading/clips/${clip.clip_file}`
                  )}
                  startFrom={staggerFrames}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                {/* Subtle darkening at edges for depth */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.1) 100%)",
                    pointerEvents: "none",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Top/bottom gradient fade to hide scroll edges */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 120,
          background:
            "linear-gradient(180deg, #0a0a0a 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          background:
            "linear-gradient(0deg, #0a0a0a 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const insiderTradingMeta = {
  id: "InsiderTradingIntro",
  component: InsiderTradingIntro,
  durationInFrames: 300,
  fps: FPS,
  width: 1920,
  height: 1080,
};
