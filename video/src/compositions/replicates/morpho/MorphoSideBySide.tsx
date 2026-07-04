import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { MorphoComposition, FPS, DURATION } from "./MorphoComposition";

const Label: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      bottom: 16,
      left: 16,
      color: "white",
      fontSize: 16,
      fontWeight: 700,
      fontFamily: "Inter, system-ui, sans-serif",
      background: "rgba(0,0,0,0.6)",
      padding: "5px 12px",
      borderRadius: 6,
    }}
  >
    {text}
  </div>
);

export const MorphoSideBySide: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
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
          src={staticFile("morpho-replicate/original.mp4")}
          muted
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        <Label text="ORIGINAL" />
      </div>
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
        <div
          style={{
            width: 720,
            height: 720,
            transform: "scale(0.5)",
            transformOrigin: "top left",
            position: "relative",
          }}
        >
          <MorphoComposition />
        </div>
        <Label text="REPLICA" />
      </div>
    </AbsoluteFill>
  );
};

export const morphoSideBySideMeta = {
  id: "Morpho-SideBySide",
  component: MorphoSideBySide,
  width: 720,
  height: 360,
  fps: FPS,
  durationInFrames: DURATION,
};
