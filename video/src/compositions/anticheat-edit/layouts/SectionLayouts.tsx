/**
 * SectionLayouts — the pictures a section can wear.
 *
 * Monotony is the enemy of a long talking-head; the cure is a different
 * PICTURE per section, not different words. These layouts share one Stage
 * (room → behind-content → light → your cutout in front) and vary what sits
 * around you: a headline on one side, a slow punch-in, or a full-screen
 * schematic cutaway that leaves your face entirely.
 *
 * `offset` is the frame into the 12s test segment, so room / light / cutout
 * stay aligned and the footage continues seamlessly across a layout change.
 */

import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";

const FPS = 30;
const SEG_START = Math.round(84 * FPS);

const cover: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

const Room: React.FC<{ offset: number }> = ({ offset }) => (
  <AbsoluteFill style={{ filter: "brightness(1.02) contrast(1.11) saturate(1.20)" }}>
    <OffthreadVideo
      src={staticFile("anticheat-edit/final.ungraded.mp4")}
      startFrom={SEG_START + offset}
      style={cover}
      muted
    />
  </AbsoluteFill>
);

const Light: React.FC<{ offset: number; opacity?: number }> = ({ offset, opacity = 0.5 }) => (
  <AbsoluteFill
    style={{ mixBlendMode: "screen", opacity, filter: "saturate(1.5) brightness(1.08)" }}
  >
    <OffthreadVideo
      src={staticFile("anticheat-edit/light_shafts.mp4")}
      startFrom={offset}
      style={cover}
      muted
    />
  </AbsoluteFill>
);

const Cutout: React.FC<{ offset: number }> = ({ offset }) => (
  <AbsoluteFill style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.13)" }}>
    <OffthreadVideo
      src={staticFile("anticheat-edit/cutout-test.mov")}
      startFrom={offset}
      style={cover}
      transparent
      muted
    />
  </AbsoluteFill>
);

const Stage: React.FC<{ offset: number; scale?: number; behind?: React.ReactNode }> = ({
  offset,
  scale = 1,
  behind,
}) => (
  <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "50% 44%" }}>
    <Room offset={offset} />
    {behind}
    <Light offset={offset} />
    <Cutout offset={offset} />
  </AbsoluteFill>
);

const Headline: React.FC<{ side: "left" | "right"; lines: string[]; sub?: string }> = ({
  side,
  lines,
  sub,
}) => {
  const frame = useCurrentFrame();
  const inA = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: side === "left" ? "flex-start" : "flex-end",
        padding: "0 96px",
      }}
    >
      <div
        style={{
          opacity: inA,
          transform: `translateX(${(1 - inA) * (side === "left" ? -44 : 44)}px)`,
          textAlign: side === "left" ? "left" : "right",
        }}
      >
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: '"Arial Black", "SF Pro Display", sans-serif',
              fontWeight: 900,
              fontSize: 150,
              lineHeight: 0.96,
              letterSpacing: "-0.02em",
              color: "#0A1420",
            }}
          >
            {l}
          </div>
        ))}
        {sub && (
          <div
            style={{
              marginTop: 20,
              fontFamily: '"SF Pro Text", Arial, sans-serif',
              fontSize: 46,
              fontWeight: 600,
              color: "#0052FF",
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const LayoutCentered: React.FC<{ offset: number }> = ({ offset }) => (
  <Stage offset={offset} />
);

export const LayoutHeadline: React.FC<{
  offset: number;
  side: "left" | "right";
  lines: string[];
  sub?: string;
}> = ({ offset, side, lines, sub }) => (
  <Stage offset={offset} behind={<Headline side={side} lines={lines} sub={sub} />} />
);

export const LayoutPunchIn: React.FC<{ offset: number }> = ({ offset }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 90], [1.26, 1.44], { extrapolateRight: "clamp" });
  return <Stage offset={offset} scale={scale} />;
};

export const LayoutSchematic: React.FC<{ Comp: React.ComponentType }> = ({ Comp }) => (
  <AbsoluteFill style={{ backgroundColor: "#F0F2F4" }}>
    <Comp />
  </AbsoluteFill>
);
