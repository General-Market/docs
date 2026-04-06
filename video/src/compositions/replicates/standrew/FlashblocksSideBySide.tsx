import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { FlashblocksComposition } from "./FlashblocksComposition";

/**
 * Side-by-side: original video on left, replica on right.
 * Double width (3840x1080) for frame-by-frame comparison.
 */
export const FlashblocksSideBySide: React.FC = () => {
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
          src={staticFile("standrew-original.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        {/* Label */}
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
          <FlashblocksComposition />
        </div>
        {/* Label */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 24,
            color: "white",
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "Inter, system-ui, sans-serif",
            background: "rgba(0,64,255,0.6)",
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

export const flashblocksSideBySideMeta = {
  id: "Flashblocks-SideBySide",
  component: FlashblocksSideBySide,
  width: 3840,
  height: 1080,
  fps: 24,
  durationInFrames: 893,
};
