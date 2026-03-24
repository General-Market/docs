/**
 * BrollMosaic — zoom-out from full-screen video to 3x3 b-roll grid.
 *
 * Starts invisible. At triggerFrame, renders a 3x3 grid of video clips
 * that scales from 3x (center panel fills screen) down to 1x (all 9 visible).
 */

import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

const W = 1080;
const H = 1920;
const COLS = 3;
const ROWS = 3;
const CELL_W = W / COLS;
const CELL_H = H / ROWS;

interface Props {
  triggerFrame: number;
  videos: string[];
  assetDir: string;
}

export const BrollMosaic: React.FC<Props> = ({ triggerFrame, videos, assetDir }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < triggerFrame) return null;

  const localFrame = frame - triggerFrame;
  const bgDir = `${assetDir}/backgrounds`;

  // Zoom out: 3x (center fills screen) → 1x (all 9 visible)
  const zoomProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 100, mass: 1.2 },
    durationInFrames: 35,
  });

  const scale = interpolate(zoomProgress, [0, 1], [3, 1]);

  // Fade in
  const opacity = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Grid border visibility (only shows when zoomed out enough)
  const borderOpacity = interpolate(zoomProgress, [0.5, 1], [0, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          width: W,
          height: H,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {videos.slice(0, 9).map((vid, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: col * CELL_W,
                top: row * CELL_H,
                width: CELL_W,
                height: CELL_H,
                overflow: "hidden",
                boxSizing: "border-box",
                border: `1px solid rgba(255,255,255,${borderOpacity})`,
              }}
            >
              <OffthreadVideo
                src={staticFile(`${bgDir}/${vid}`)}
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "brightness(0.65)",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Subtle vignette over mosaic */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.5) 100%)",
          pointerEvents: "none",
          opacity: interpolate(zoomProgress, [0.3, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
