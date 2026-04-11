import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  spring,
  interpolate,
  useVideoConfig,
  staticFile,
} from "remotion";
import { font } from "../../../common/fonts";

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100, mass: 0.8 },
    durationInFrames: 30,
  });

  const taglineOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineY = spring({
    frame: frame - 30,
    fps,
    config: { damping: 14, stiffness: 120 },
    durationInFrames: 20,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 40,
      }}
    >
      {/* GM Logo */}
      <Img
        src={staticFile("gm-logo.svg")}
        style={{
          width: 200,
          height: 200,
          transform: `scale(${logoScale})`,
        }}
      />

      {/* Tagline */}
      <div
        style={{
          fontFamily: font,
          fontSize: 48,
          fontWeight: 700,
          color: "#ffffff",
          textAlign: "center",
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          opacity: taglineOpacity,
          transform: `translateY(${interpolate(taglineY, [0, 1], [20, 0])}px)`,
        }}
      >
        Trade 10,000x more
      </div>
    </AbsoluteFill>
  );
};
