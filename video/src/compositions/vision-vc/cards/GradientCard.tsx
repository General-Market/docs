/**
 * GradientCard — the darkness that knows it's expensive.
 *
 * Replaces flat #000000 with layered CSS gradients that give
 * the "Exclusive Trade" cards a material quality. Radial base,
 * noise grain, isometric grid ghost, vignette, optional accent glow.
 *
 * No canvas. No images. Pure CSS gradients stacked like geology.
 * The card should feel like it costs money without ever saying so.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface GradientCardProps {
  children: React.ReactNode;
  /** Optional accent color for subtle center glow (default none) */
  accentGlow?: string;
  /** Glow intensity 0-1 (default 0.05) */
  glowIntensity?: number;
}

export const GradientCard: React.FC<GradientCardProps> = ({
  children,
  accentGlow,
  glowIntensity = 0.05,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 3D rotation on entrance — card tilts forward into place
  const entrance3d = spring({ frame, fps, config: { damping: 14 } });
  const rotateX = interpolate(entrance3d, [0, 1], [3, 0]);

  // Noise grain shifts every 2 frames for a subtle film-stock flicker
  const grainPhase = Math.floor(frame / 2) * 37;

  // --- Layer 1: Radial base gradient (center warmth, edge void) ---
  const baseGradient =
    "radial-gradient(ellipse 70% 60% at 50% 48%, #0a0a0c 0%, #050507 55%, #000000 100%)";

  // --- Layer 2: Noise / grain via repeating-conic-gradient ---
  // The phase offset creates temporal flicker without animation APIs
  const noiseGradient =
    `repeating-conic-gradient(` +
    `from ${grainPhase}deg at 50% 50%, ` +
    `rgba(255,255,255,0.012) 0deg, ` +
    `transparent 0.8deg, ` +
    `transparent 1.2deg, ` +
    `rgba(255,255,255,0.008) 2deg` +
    `)`;

  // --- Layer 3: Isometric grid ghost ---
  // Two linear gradients at 30deg and 150deg simulate iso lines
  const gridColor = "rgba(255,255,255,0.012)";
  const gridSpacing = 60; // px
  const isoGrid =
    `repeating-linear-gradient(` +
    `30deg, ${gridColor} 0px, ${gridColor} 1px, transparent 1px, transparent ${gridSpacing}px` +
    `), ` +
    `repeating-linear-gradient(` +
    `150deg, ${gridColor} 0px, ${gridColor} 1px, transparent 1px, transparent ${gridSpacing}px` +
    `)`;

  // --- Layer 4: Vignette (darker edges, lighter center) ---
  const vignette =
    "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.4) 100%)";

  // --- Layer 5 (optional): Accent glow bloom ---
  const accentLayer = accentGlow
    ? `radial-gradient(ellipse 40% 35% at 50% 50%, ${hexToRgba(accentGlow, glowIntensity)} 0%, transparent 70%)`
    : undefined;

  // Stack all layers: last in list renders at back
  const backgroundLayers = [
    accentLayer,
    vignette,
    noiseGradient,
    isoGrid,
    baseGradient,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <AbsoluteFill
      style={{
        perspective: '1200px',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: backgroundLayers,
          backgroundColor: "#000000", // fallback beneath all layers
          transform: `rotateX(${rotateX}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Convert hex color + alpha to rgba string.
 * Accepts 3, 4, 6, or 8-char hex (with or without #).
 */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  let r: number, g: number, b: number;

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }

  return `rgba(${r},${g},${b},${alpha})`;
}
