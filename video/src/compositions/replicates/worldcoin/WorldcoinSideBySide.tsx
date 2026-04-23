import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { WorldcoinComposition, worldcoinMeta } from "./WorldcoinComposition";

export const WorldcoinSideBySide: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
    {/* Left: original video */}
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }}>
      <OffthreadVideo
        src={staticFile("worldcoin-reference.mp4")}
        style={{ width: 1920, height: 1080, objectFit: "contain" }}
      />
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          color: "#8ab4f8",
          fontFamily: "'Inter', sans-serif",
          fontSize: 18,
          fontWeight: 700,
          padding: "6px 14px",
          background: "rgba(0,0,0,0.6)",
          borderRadius: 6,
        }}
      >
        ORIGINAL
      </div>
    </div>

    {/* Center divider */}
    <div
      style={{
        position: "absolute",
        left: 1919,
        top: 0,
        width: 2,
        height: 1080,
        background: "#8ab4f8",
        zIndex: 10,
      }}
    />

    {/* Right: replica */}
    <div style={{ position: "absolute", left: 1920, top: 0, width: 1920, height: 1080 }}>
      <WorldcoinComposition />
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          color: "#8ab4f8",
          fontFamily: "'Inter', sans-serif",
          fontSize: 18,
          fontWeight: 700,
          padding: "6px 14px",
          background: "rgba(0,0,0,0.6)",
          borderRadius: 6,
        }}
      >
        REMOTION
      </div>
    </div>
  </AbsoluteFill>
);

export const worldcoinSideBySideMeta = {
  id: "Worldcoin-SideBySide",
  component: WorldcoinSideBySide,
  durationInFrames: worldcoinMeta.durationInFrames,
  fps: worldcoinMeta.fps,
  width: 3840,
  height: 1080,
};
