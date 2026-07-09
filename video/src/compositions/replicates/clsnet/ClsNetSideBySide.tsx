import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { DURATION, FPS } from "./data";
import { ClsNetComposition } from "./ClsNetComposition";

const Label: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      bottom: 24,
      left: 24,
      color: "white",
      fontSize: 28,
      fontWeight: 700,
      fontFamily: "Helvetica Neue, sans-serif",
      background: "rgba(0,0,0,0.6)",
      padding: "6px 14px",
      borderRadius: 6,
    }}
  >
    {text}
  </div>
);

export const ClsNetSideBySide: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }}>
      <OffthreadVideo
        src={staticFile("clsnet-original.mp4")}
        muted
        style={{ width: "100%", height: "100%" }}
      />
      <Label text="ORIGINAL" />
    </div>
    <div style={{ position: "absolute", left: 1920, top: 0, width: 1920, height: 1080 }}>
      <ClsNetComposition />
      <Label text="REPLICA" />
    </div>
  </AbsoluteFill>
);

export const clsNetSideBySideMetaInner = {
  id: "ClsNet-SideBySide",
  component: ClsNetSideBySide,
  durationInFrames: DURATION,
  fps: FPS,
  width: 3840,
  height: 1080,
};
