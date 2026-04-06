import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { VirtualsReplicateV2 } from "./VirtualsReplicateV2";

export const SideBySideV2: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
      }}
    >
      <OffthreadVideo
        src={staticFile("virtuals-2-original.mp4")}
        style={{ width: 1920, height: 1080, objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          color: "#3ECDA0",
          fontFamily: "'IBM Plex Mono', monospace",
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
    <div
      style={{
        position: "absolute",
        left: 1919,
        top: 0,
        width: 2,
        height: 1080,
        background: "#3ECDA0",
        zIndex: 10,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 1920,
        top: 0,
        width: 1920,
        height: 1080,
      }}
    >
      <VirtualsReplicateV2 />
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          color: "#3ECDA0",
          fontFamily: "'IBM Plex Mono', monospace",
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

export const sideBySideV2Meta = {
  id: "Virtuals2-SideBySide",
  component: SideBySideV2,
  durationInFrames: 3303,
  fps: 30,
  width: 3840,
  height: 1080,
};
