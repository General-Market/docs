import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import type { DataCalloutDef } from "../types";

const { fontFamily } = loadInter("normal", { subsets: ["latin"], weights: ["400", "700", "900"] });

// 1080px short width minus safe padding
const MAX_WIDTH = 900;
const CHAR_RATIO = 0.70; // Inter Black uppercase — conservative
const LETTER_SPACING = 4;

/**
 * Compute font size + container width so text never overflows,
 * accounting for CSS scale transform AND letterSpacing.
 */
const fitText = (text: string, maxFontSize: number, maxScale: number) => {
  const words = text.split(/\s+/);
  const longestWord = words.reduce((a, b) => (a.length > b.length ? a : b), "");

  // Width of longest word at a given fontSize:
  // charCount * fontSize * CHAR_RATIO + (charCount - 1) * LETTER_SPACING
  // This must be <= MAX_WIDTH / maxScale (container width)
  const containerWidth = Math.floor(MAX_WIDTH / maxScale);
  const n = longestWord.length;
  const spacingTotal = Math.max(0, n - 1) * LETTER_SPACING;

  // fontSize * n * CHAR_RATIO + spacingTotal <= containerWidth
  const maxForWord = (containerWidth - spacingTotal) / (n * CHAR_RATIO);
  const fontSize = Math.max(28, Math.min(maxFontSize, Math.floor(maxForWord)));

  return { fontSize, containerWidth };
};

interface Props {
  callout: DataCalloutDef;
}

export const DataCallout: React.FC<Props> = ({ callout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delay = callout.delayFrames ?? 0;
  if (frame < delay) return null;

  const localFrame = frame - delay;

  // Hide after specified duration (with 8-frame fade-out)
  const FADE_OUT_FRAMES = 8;
  if (callout.hideAfterFrames != null) {
    if (localFrame > callout.hideAfterFrames + FADE_OUT_FRAMES) return null;
  }

  const startScale = callout.scale ?? 1.6;
  const endScale = callout.targetScale ?? 1.0;

  // Spring slam
  const slamProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 10, stiffness: 250, mass: 0.7 },
    durationInFrames: 12,
  });

  const scale = startScale + (endScale - startScale) * slamProgress;
  let opacity = Math.min(1, slamProgress * 2);

  // Fade-out when hideAfterFrames is set
  if (callout.hideAfterFrames != null && localFrame >= callout.hideAfterFrames) {
    const fadeProgress = (localFrame - callout.hideAfterFrames) / FADE_OUT_FRAMES;
    opacity *= Math.max(0, 1 - fadeProgress);
  }

  // Glow pulse
  const glowIntensity = callout.glow
    ? 12 + Math.sin(localFrame * 0.15) * 4
    : 0;
  const glowColor = callout.glowColor ?? callout.color;

  // Smart sizing: accounts for scale + letterSpacing
  const maxScale = Math.max(startScale, endScale);
  const { fontSize, containerWidth } = fitText(callout.text, 110, maxScale);

  return (
    <div
      style={{
        position: "absolute",
        top: 380 + (callout.yOffset ?? 0),
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9,
        padding: "0 70px",
      }}
    >
      <div
        style={{
          color: callout.color,
          fontFamily,
          fontSize,
          fontWeight: 900,
          transform: `scale(${scale})`,
          opacity,
          textShadow: callout.glow
            ? `0 0 ${glowIntensity * 2}px ${glowColor}80, 0 0 ${glowIntensity * 4}px ${glowColor}40, 0 4px 12px rgba(0,0,0,0.8)`
            : "0 4px 12px rgba(0,0,0,0.85), 0 0 20px rgba(0,0,0,0.5)",
          letterSpacing: LETTER_SPACING,
          textAlign: "center",
          lineHeight: 1.15,
          maxWidth: containerWidth,
          wordWrap: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {callout.text}
      </div>
    </div>
  );
};
