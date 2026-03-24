/**
 * DuotoneOverlay — hue-shifting gradient background with grid overlay.
 * Adapted from scenes/EffectAnimations/EffectDuotone for shot-level use.
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";

interface Props {
  /** Base hue offset (default 0) */
  baseHue?: number;
  /** Hue shift speed in degrees per frame (default 2) */
  speed?: number;
}

export const DuotoneOverlay: React.FC<Props> = ({
  baseHue = 0,
  speed = 2,
}) => {
  const frame = useCurrentFrame();
  const hueShift = baseHue + frame * speed;

  return (
    <AbsoluteFill>
      {/* Shifting gradient */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg,
            hsl(${hueShift % 360}, 70%, 30%),
            hsl(${(hueShift + 60) % 360}, 70%, 50%)
          )`,
        }}
      />

      {/* Radial highlights */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1) 0%, transparent 30%),
            radial-gradient(circle at 80% 70%, rgba(255,255,255,0.1) 0%, transparent 40%)
          `,
        }}
      />

      {/* Grid overlay */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />
    </AbsoluteFill>
  );
};
