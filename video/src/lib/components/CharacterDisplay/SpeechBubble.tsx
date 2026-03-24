import React from "react";
import { spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  text: string;
  /** Absolute frame when bubble starts appearing */
  startFrame: number;
  maxWidth?: number;
  fontSize?: number;
  accentColor?: string;
  /** Enable typewriter character reveal */
  typewriter?: boolean;
  /** Whether the tail points to the right (character on the right) */
  tailRight?: boolean;
}

const FONT_FAMILY = "'Switzer', 'Inter', 'Helvetica Neue', sans-serif";

/**
 * Rounded rectangle speech bubble with CSS triangle tail and
 * optional typewriter text reveal. Pattern adapted from MiniPersona.
 */
export const SpeechBubble: React.FC<Props> = ({
  text,
  startFrame,
  maxWidth = 500,
  fontSize = 38,
  accentColor = "#00D4FF",
  typewriter = true,
  tailRight = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame) return null;

  const elapsed = frame - startFrame;

  // ── Bubble spring entrance ──────────────────────────────────────
  const popIn = spring({
    frame: elapsed,
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.5 },
    durationInFrames: 15,
  });

  const scale = interpolate(popIn, [0, 1], [0, 1]);
  const opacity = interpolate(popIn, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // ── Typewriter ──────────────────────────────────────────────────
  const charsPerFrame = 0.8;
  const visibleChars = typewriter
    ? Math.floor(elapsed * charsPerFrame)
    : text.length;
  const displayedText = text.slice(0, Math.min(visibleChars, text.length));
  const isTyping = visibleChars < text.length;

  // ── Idle float ──────────────────────────────────────────────────
  const floatY = Math.sin((frame / 50) * Math.PI * 2) * 3;

  // ── Tail styles ─────────────────────────────────────────────────
  const tailBorder: React.CSSProperties = tailRight
    ? {
        position: "absolute",
        right: -15,
        bottom: 14,
        width: 0,
        height: 0,
        borderTop: "17px solid transparent",
        borderBottom: "17px solid transparent",
        borderLeft: "19px solid black",
      }
    : {
        position: "absolute",
        left: -15,
        bottom: 14,
        width: 0,
        height: 0,
        borderTop: "17px solid transparent",
        borderBottom: "17px solid transparent",
        borderRight: "19px solid black",
      };

  const tailFill: React.CSSProperties = tailRight
    ? {
        position: "absolute",
        right: -10,
        bottom: 17,
        width: 0,
        height: 0,
        borderTop: "14px solid transparent",
        borderBottom: "14px solid transparent",
        borderLeft: "16px solid white",
      }
    : {
        position: "absolute",
        left: -10,
        bottom: 17,
        width: 0,
        height: 0,
        borderTop: "14px solid transparent",
        borderBottom: "14px solid transparent",
        borderRight: "16px solid white",
      };

  const transformOrigin = tailRight ? "bottom right" : "bottom left";

  if (displayedText.length === 0) return null;

  return (
    <div
      style={{
        transform: `scale(${scale}) translateY(${floatY}px)`,
        transformOrigin,
        opacity,
        maxWidth,
      }}
    >
      {/* Border tail (behind) */}
      <div style={tailBorder} />
      {/* Bubble body */}
      <div
        style={{
          background: "white",
          borderRadius: 18,
          padding: "14px 24px",
          position: "relative",
          border: "4px solid black",
          boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
        }}
      >
        <span
          style={{
            fontFamily: FONT_FAMILY,
            fontSize,
            fontWeight: 800,
            color: "#1a1a1a",
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
            wordBreak: "break-word",
          }}
        >
          {displayedText}
          {/* Blinking cursor while typing */}
          {isTyping && (
            <span
              style={{
                opacity: Math.sin(elapsed * 0.4) > 0 ? 1 : 0,
                color: accentColor,
                fontWeight: 900,
              }}
            >
              |
            </span>
          )}
        </span>
        {/* White tail (on top of border tail) */}
        <div style={tailFill} />
      </div>
    </div>
  );
};
