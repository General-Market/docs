import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  interpolate,
  staticFile,
} from "remotion";
import { font } from "../../../common/fonts";

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();

  const taglineOpacity = interpolate(frame, [30, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
      <Img
        src={staticFile("gm-logo.svg")}
        style={{ width: 200, height: 200 }}
      />

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
        }}
      >
        Trade 10,000x more
      </div>
    </AbsoluteFill>
  );
};
