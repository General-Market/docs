import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

interface PersonGridProps {
  count?: number;
  columns?: number;
  collapseToOne?: boolean;
  collapseFrame?: number;
  iconColor?: string;
  highlightColor?: string;
}

const PersonIcon: React.FC<{
  size: number;
  color: string;
  opacity?: number;
  scale?: number;
}> = ({ size, color, opacity = 1, scale = 1 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 50"
    style={{ opacity, transform: `scale(${scale})` }}
  >
    <circle cx="20" cy="12" r="10" fill={color} />
    <path d="M4 50 L10 28 Q20 22 30 28 L36 50 Z" fill={color} />
  </svg>
);

export const PersonGrid: React.FC<PersonGridProps> = ({
  count = 100,
  columns = 15,
  collapseToOne = false,
  collapseFrame = 60,
  iconColor = "#c8e8db",
  highlightColor = "#3ECDA0",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rows = Math.ceil(count / columns);
  const iconSize = 32;
  const gap = 6;
  const gridWidth = columns * (iconSize + gap);
  const gridHeight = rows * (iconSize + gap + 8);
  const centerIdx = Math.floor(count / 2);

  const collapseProgress = collapseToOne
    ? spring({
        frame: Math.max(0, frame - collapseFrame),
        fps,
        config: { damping: 16, stiffness: 60, mass: 1 },
        durationInFrames: 30,
      })
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: gridWidth,
          height: gridHeight,
          display: "flex",
          flexWrap: "wrap",
          gap: `${gap}px`,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const isCenter = i === centerIdx;
          const fadeOut = isCenter ? 1 : 1 - collapseProgress;
          const growScale = isCenter ? 1 + collapseProgress * 2.5 : 1;

          return (
            <PersonIcon
              key={i}
              size={iconSize}
              color={isCenter && collapseToOne ? highlightColor : iconColor}
              opacity={fadeOut}
              scale={growScale}
            />
          );
        })}
      </div>

      {collapseToOne && collapseProgress > 0.5 && (
        <>
          {[
            { x: -40, delay: 0 },
            { x: 20, delay: 4 },
            { x: -10, delay: 8 },
          ].map((d, i) => {
            const floatY = interpolate(
              frame - collapseFrame - d.delay,
              [0, 30, 60],
              [0, -20, -40],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const floatOp = interpolate(
              frame - collapseFrame - d.delay,
              [10, 20, 50, 60],
              [0, 1, 1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${d.x}px)`,
                  top: `calc(50% + ${floatY}px - 60px)`,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 28,
                  fontWeight: 700,
                  color: highlightColor,
                  opacity: floatOp,
                }}
              >
                $
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};
