import React from "react";
import { AbsoluteFill } from "remotion";
import {
  FloatingChip,
  PixelReveal,
  SceneFrame,
  scene,
} from "./props";

// Bench for the illustration prop kit. One continuous shot:
//
//   a warm "camera" placeholder sits below; at frame 12 the blue SceneFrame
//   dissolves in over it through the chunky pixel front; two logo chips pop
//   onto the grid and hover. This is the standard opening every mechanism
//   illustration uses — swap the chips and title for the real content.

const FPS = 30;
const W = 1920;
const H = 1080;
const DURATION = 7 * FPS;

// Stand-in for the talking head underneath the reveal.
const CameraPlaceholder: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(120% 120% at 50% 40%, #2A2620 0%, #14110D 70%, #0A0907 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "rgba(255,255,255,0.18)",
      fontSize: 34,
      letterSpacing: "0.3em",
      fontFamily: "monospace",
    }}
  >
    CAMERA
  </AbsoluteFill>
);

export const AntiCheatEditPropsDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: scene.blueAbyss }}>
      <CameraPlaceholder />

      <PixelReveal
        mode="in"
        from="down-left"
        startFrame={12}
        durationInFrames={40}
        cellSize={56}
      >
        <SceneFrame
          kicker="STANDARD PROP · BLUE FIELD"
          title="Geography is not an input"
          durationInFrames={DURATION}
        >
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 120,
            }}
          >
            <FloatingChip delay={52} phase={0} period={4.2} size={172}>
              <span style={{ fontSize: 96, lineHeight: 1 }}>🏛️</span>
            </FloatingChip>
            <FloatingChip delay={60} phase={0.5} period={3.6} size={172}>
              <span style={{ fontSize: 96, lineHeight: 1 }}>🇺🇸</span>
            </FloatingChip>
          </AbsoluteFill>
        </SceneFrame>
      </PixelReveal>
    </AbsoluteFill>
  );
};

export const anticheatEditPropsMeta = {
  id: "AntiCheatEditProps",
  component: AntiCheatEditPropsDemo,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
