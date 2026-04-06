import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

interface PersonGridProps {
  count?: number;
  columns?: number;
  collapseToOne?: boolean;
  collapseFrame?: number;
  iconColor?: string;
  highlightColor?: string;
  /** Show stat overlay — red/green mode like the original */
  showStatOverlay?: boolean;
  /** Target percentage value (0-100) — animates from 0 to this */
  statValue?: number;
  /** How many frames to count from 0 to statValue */
  statDuration?: number;
  /** How many icons at the end should stay green (survivors) */
  survivorCount?: number;
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
  showStatOverlay = false,
  statValue = 97,
  statDuration = 60,
  survivorCount = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rows = Math.ceil(count / columns);
  const iconSize = showStatOverlay ? 42 : 32;
  const gap = showStatOverlay ? 4 : 6;
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

  // In stat overlay mode: icons are red/pink except the last `survivorCount` which are green
  const failColor = "#e8837c"; // soft red/pink
  const successColor = "#3ECDA0"; // teal
  const survivorStartIdx = count - survivorCount;

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
          let color: string;
          let iconOpacity = 1;
          let growScale = 1;

          if (showStatOverlay) {
            // Red for failed traders, green for survivors at the end
            color = i >= survivorStartIdx ? successColor : failColor;
            // Stagger entrance
            const staggerDelay = i * 0.3;
            iconOpacity = interpolate(frame - staggerDelay, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
          } else if (collapseToOne) {
            const isCenter = i === centerIdx;
            color = isCenter ? highlightColor : iconColor;
            iconOpacity = isCenter ? 1 : 1 - collapseProgress;
            growScale = isCenter ? 1 + collapseProgress * 2.5 : 1;
          } else {
            color = iconColor;
            // Stagger entrance from top-left
            const staggerDelay = i * 0.4;
            iconOpacity = interpolate(frame - staggerDelay, [0, 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
          }

          return (
            <PersonIcon
              key={i}
              size={iconSize}
              color={color}
              opacity={iconOpacity}
              scale={growScale}
            />
          );
        })}
      </div>

      {/* Semi-transparent stat overlay — animates from 0 to statValue */}
      {showStatOverlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
            fontSize: 380,
            fontWeight: 700,
            color: failColor,
            opacity: 0.25,
            letterSpacing: -8,
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          {Math.round(interpolate(frame, [10, statDuration], [0, statValue], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }))}%
        </div>
      )}

      {/* Floating dollar signs for collapse mode */}
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
