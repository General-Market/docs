import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { Circle1Composition, FPS, DURATION } from "./Circle1Composition";

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

export const Circle1SideBySide: React.FC = () => {
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
          src={staticFile("circle1-original.mp4")}
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
          <Circle1Composition />
        </div>
        <Label text="REPLICA" />
      </div>
    </AbsoluteFill>
  );
};

export const circle1SideBySideMeta = {
  id: "Circle1-SideBySide",
  component: Circle1SideBySide,
  width: 1920,
  height: 540,
  fps: FPS,
  durationInFrames: DURATION,
};
