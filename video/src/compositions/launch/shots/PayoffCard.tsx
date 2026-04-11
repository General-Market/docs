import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";
import { font } from "../../../common/fonts";

interface PayoffCardProps {
  statement: string;
}

export const PayoffCard: React.FC<PayoffCardProps> = ({ statement }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.6 },
    durationInFrames: 18,
  });

  const opacity = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 200 },
    durationInFrames: 10,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 72,
          fontWeight: 900,
          color: "#ffffff",
          textAlign: "center",
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          transform: `scale(${textScale})`,
          opacity,
          whiteSpace: "pre-line",
          maxWidth: 1400,
        }}
      >
        {statement}
      </div>
    </AbsoluteFill>
  );
};
