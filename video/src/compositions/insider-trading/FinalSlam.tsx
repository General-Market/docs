import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

export const FinalSlam: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hard cut to black, then text slams in
  const textScale = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 200,
      mass: 0.8,
    },
  });

  const textOpacity = interpolate(
    frame,
    [0, 2, 20, 30],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" }
  );

  // White flash on impact
  const flashOpacity = interpolate(
    frame,
    [0, 1, 4],
    [0.8, 0.8, 0],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Impact flash */}
      <AbsoluteFill
        style={{
          backgroundColor: "#ffffff",
          opacity: flashOpacity,
        }}
      />

      {/* Final text */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: textOpacity,
        }}
      >
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
            fontSize: 200,
            color: "#ffffff",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            transform: `scale(${textScale})`,
            textShadow: "0 0 60px rgba(255, 255, 255, 0.4)",
          }}
        >
          INSIDER
        </div>
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
            fontSize: 200,
            color: "#cc0000",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            transform: `scale(${textScale})`,
            marginTop: -30,
            textShadow: "0 0 60px rgba(200, 0, 0, 0.4)",
          }}
        >
          TRADING
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
