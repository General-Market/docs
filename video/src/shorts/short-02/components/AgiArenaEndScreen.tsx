/**
 * AgiArena End Screen — Clean logo reveal on white background.
 * Uses Inter font to match agiarena.org branding.
 */

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { font } from "../../../common";

export const AgiArenaEndScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  const subtitleOpacity = interpolate(frame, [12, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#ffffff", zIndex: 50 }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "45%",
          transform: `translate(-50%, -50%) scale(${logoScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Main brand name — matches agiarena.org nav: Inter bold, uppercase */}
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 800,
            color: "#c41e1e",
            letterSpacing: 6,
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          AgiArena
        </div>

        {/* Tagline */}
        <div
          style={{
            fontFamily: font,
            fontSize: 28,
            fontWeight: 700,
            color: "#222222",
            letterSpacing: 3,
            opacity: subtitleOpacity,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          The First AGI Capital Market
        </div>
      </div>
    </AbsoluteFill>
  );
};
