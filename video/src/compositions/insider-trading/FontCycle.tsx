import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  random,
} from "remotion";

const FONTS = [
  // CNN style
  { family: "Georgia, 'Times New Roman', serif", weight: 700, style: "italic", color: "#cc0000", tracking: "0.02em" },
  // Bloomberg style
  { family: "'Courier New', monospace", weight: 400, style: "normal", color: "#ff6600", tracking: "0.08em" },
  // Fox News style
  { family: "Impact, 'Arial Black', sans-serif", weight: 900, style: "normal", color: "#003580", tracking: "0.05em" },
  // CNBC style
  { family: "'Trebuchet MS', 'Helvetica Neue', sans-serif", weight: 700, style: "normal", color: "#009e73", tracking: "0.03em" },
  // BBC style
  { family: "Arial, Helvetica, sans-serif", weight: 700, style: "normal", color: "#bb1919", tracking: "0.04em" },
  // Reuters style
  { family: "'Times New Roman', Times, serif", weight: 400, style: "normal", color: "#ff8800", tracking: "0.06em" },
  // Breaking news chyron
  { family: "'Arial Black', Gadget, sans-serif", weight: 900, style: "normal", color: "#ff0000", tracking: "0.1em" },
  // Financial Times style
  { family: "Georgia, serif", weight: 400, style: "normal", color: "#fff1e5", tracking: "0.03em" },
  // Sky News style
  { family: "'Segoe UI', Tahoma, sans-serif", weight: 600, style: "normal", color: "#c8102e", tracking: "0.02em" },
  // Wire service / AP style
  { family: "'Lucida Console', Monaco, monospace", weight: 400, style: "normal", color: "#ffffff", tracking: "0.12em" },
  // Al Jazeera style
  { family: "'Palatino Linotype', 'Book Antiqua', serif", weight: 700, style: "normal", color: "#c8960c", tracking: "0.04em" },
  // MSNBC style
  { family: "Verdana, Geneva, sans-serif", weight: 800, style: "normal", color: "#0089d0", tracking: "0.03em" },
];

export const FontCycle: React.FC = () => {
  const frame = useCurrentFrame();
  // Cycle speed increases over time
  // Phase 1 (0-90): change every 15 frames (0.5s)
  // Phase 2 (90-210): change every 8 frames
  // Phase 3 (210-270): change every 3 frames
  let cycleSpeed: number;
  if (frame < 90) {
    cycleSpeed = 15;
  } else if (frame < 210) {
    cycleSpeed = 8;
  } else {
    cycleSpeed = 3;
  }

  const fontIndex = Math.floor(frame / cycleSpeed) % FONTS.length;
  const font = FONTS[fontIndex];

  // Font size pulses slightly on each change
  const cycleProgress = (frame % cycleSpeed) / cycleSpeed;
  const baseFontSize = interpolate(
    frame,
    [0, 90, 210, 270],
    [120, 140, 160, 180],
    { extrapolateRight: "clamp" }
  );
  const fontSizePulse = Math.sin(cycleProgress * Math.PI) * 8;
  const fontSize = baseFontSize + fontSizePulse;

  // Glitch offset in phase 2+
  const glitchActive = frame > 90 && random(`glitch-${frame}`) > 0.7;
  const glitchX = glitchActive ? (random(`gx-${frame}`) - 0.5) * 30 : 0;
  const glitchY = glitchActive ? (random(`gy-${frame}`) - 0.5) * 10 : 0;

  // RGB split in phase 3
  const rgbSplit = frame > 210 ? interpolate(frame, [210, 270], [0, 4], { extrapolateRight: "clamp" }) : 0;

  // Opacity flicker in phase 3
  const flicker = frame > 210 && random(`flk-${frame}`) > 0.85 ? 0.3 : 1;

  // Exit fade
  const exitOpacity = interpolate(frame, [255, 270], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity * flicker,
      }}
    >
      {/* RGB split layers */}
      {rgbSplit > 0 && (
        <>
          <div
            style={{
              position: "absolute",
              fontFamily: font.family,
              fontWeight: font.weight,
              fontStyle: font.style,
              fontSize,
              letterSpacing: font.tracking,
              color: "rgba(255, 0, 0, 0.5)",
              textTransform: "uppercase",
              transform: `translate(${glitchX - rgbSplit * 2}px, ${glitchY - rgbSplit}px)`,
              mixBlendMode: "screen",
            }}
          >
            INSIDER TRADING
          </div>
          <div
            style={{
              position: "absolute",
              fontFamily: font.family,
              fontWeight: font.weight,
              fontStyle: font.style,
              fontSize,
              letterSpacing: font.tracking,
              color: "rgba(0, 0, 255, 0.5)",
              textTransform: "uppercase",
              transform: `translate(${glitchX + rgbSplit * 2}px, ${glitchY + rgbSplit}px)`,
              mixBlendMode: "screen",
            }}
          >
            INSIDER TRADING
          </div>
        </>
      )}

      {/* Main text */}
      <div
        style={{
          fontFamily: font.family,
          fontWeight: font.weight,
          fontStyle: font.style,
          fontSize,
          letterSpacing: font.tracking,
          color: font.color,
          textTransform: "uppercase",
          transform: `translate(${glitchX}px, ${glitchY}px)`,
          textShadow: `0 0 40px ${font.color}40, 0 0 80px ${font.color}20`,
          transition: "none",
          whiteSpace: "nowrap",
        }}
      >
        INSIDER TRADING
      </div>

      {/* Chyron bar — appears in phase 2 */}
      {frame > 110 && frame < 260 && (
        <div
          style={{
            position: "absolute",
            bottom: 180,
            left: 0,
            right: 0,
            height: 60,
            backgroundColor: "rgba(200, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            paddingLeft: 40,
            opacity: interpolate(
              frame,
              [110, 120, 250, 260],
              [0, 0.9, 0.9, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            ),
          }}
        >
          <span
            style={{
              fontFamily: "Arial, sans-serif",
              fontWeight: 700,
              fontSize: 28,
              color: "#ffffff",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            BREAKING NEWS &mdash; FEDERAL INVESTIGATION UNDERWAY
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
