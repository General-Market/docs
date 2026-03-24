/**
 * DuotoneOverlay — cinematic duotone color-grading overlay.
 * Renders ON TOP of the background (not as a replacement).
 * Maps dark tones → colors[0], light tones → colors[1].
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";

interface Props {
  /** Duotone color pair: [dark, light]. Defaults to dark blue / steel. */
  colors?: [string, string];
  /** Overall opacity of the effect (default 0.85) */
  opacity?: number;
}

export const DuotoneOverlay: React.FC<Props> = ({
  colors = ["#031528", "#a0bcd0"],
  opacity = 0.85,
}) => {
  const frame = useCurrentFrame();

  // Subtle pulse on the overlay opacity for organic feel
  const breathe = 1 + Math.sin(frame * 0.04) * 0.03;
  const finalOpacity = opacity * breathe;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Desaturation layer — strips color from content beneath */}
      <AbsoluteFill
        style={{
          backgroundColor: "gray",
          mixBlendMode: "saturation",
          opacity: 0.95,
        }}
      />

      {/* Duotone gradient: dark→light mapped diagonally */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
          mixBlendMode: "color",
          opacity: finalOpacity,
        }}
      />

      {/* Subtle vignette tinted to dark color for depth */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, transparent 40%, ${colors[0]}90 100%)`,
          opacity: 0.4,
        }}
      />
    </AbsoluteFill>
  );
};
