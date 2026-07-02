import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { AnomaComposition, FPS, DURATION } from "./AnomaComposition";

const Label: React.FC<{ text: string }> = ({ text }) => (
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
    {text}
  </div>
);

export const AnomaSideBySide: React.FC = () => {
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
          src={staticFile("anoma-original.mp4")}
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
            width: 1280,
            height: 720,
            transform: "scale(0.5)",
            transformOrigin: "top left",
            position: "relative",
          }}
        >
          <AnomaComposition />
        </div>
        <Label text="REPLICA" />
      </div>
    </AbsoluteFill>
  );
};

export const anomaSideBySideMeta = {
  id: "Anoma-SideBySide",
  component: AnomaSideBySide,
  width: 1280,
  height: 360,
  fps: FPS,
  durationInFrames: DURATION,
};
