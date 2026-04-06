import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { KalshiComposition } from "./KalshiComposition";

export const KalshiSideBySide: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Left: original video */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <OffthreadVideo
          src={staticFile("kalshi-original.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 24,
            color: "white",
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "Inter, system-ui, sans-serif",
            background: "rgba(0,0,0,0.6)",
            padding: "6px 14px",
            borderRadius: 6,
          }}
        >
          ORIGINAL
        </div>
      </div>

      {/* Right: replica */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: "50%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <KalshiComposition />
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 24,
            color: "white",
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "Inter, system-ui, sans-serif",
            background: "rgba(0,210,106,0.6)",
            padding: "6px 14px",
            borderRadius: 6,
          }}
        >
          REPLICA
        </div>
      </div>

      {/* Center divider */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 2,
          height: "100%",
          backgroundColor: "rgba(255,255,255,0.3)",
          transform: "translateX(-1px)",
        }}
      />
    </AbsoluteFill>
  );
};

export const kalshiSideBySideMeta = {
  id: "Kalshi-SideBySide",
  component: KalshiSideBySide,
  width: 3840,
  height: 1080,
  fps: 30,
  durationInFrames: 3810,
};
