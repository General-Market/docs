import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { DURATION, FPS } from "./AnomaComposition";
import { CrxAnomaComposition } from "./CrxAnomaComposition";

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

export const CrxAnomaSideBySide: React.FC = () => {
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
        <Label text="ANOMA ORIGINAL" />
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
          <CrxAnomaComposition />
        </div>
        <Label text="CRX" />
      </div>
    </AbsoluteFill>
  );
};

export const crxAnomaSideBySideMeta = {
  id: "CRX-SideBySide",
  component: CrxAnomaSideBySide,
  width: 1280,
  height: 360,
  fps: FPS,
  durationInFrames: DURATION,
};
