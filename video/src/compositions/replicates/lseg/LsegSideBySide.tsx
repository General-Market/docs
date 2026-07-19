import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { LsegComposition, FPS, DURATION } from "./LsegComposition";

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

export const LsegSideBySide: React.FC = () => {
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
          src={staticFile("lseg-replicate/original.mp4")}
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
            width: 1920,
            height: 1080,
            transform: "scale(0.5)",
            transformOrigin: "top left",
            position: "relative",
          }}
        >
          <LsegComposition />
        </div>
        <Label text="REPLICA" />
      </div>
    </AbsoluteFill>
  );
};

export const lsegSideBySideMeta = {
  id: "Lseg-SideBySide",
  component: LsegSideBySide,
  width: 1920,
  height: 540,
  fps: FPS,
  durationInFrames: DURATION,
};
