import React from "react";
import { AbsoluteFill } from "remotion";

// netgrowth lane barrel — RootReplicas.tsx imports ONLY this file.
// Reorganize the lane freely behind these three exports; keep the export
// names and comp ids stable. Ref: public/netgrowth-original.mp4
// (1080×1080, 25fps, 709 frames, 28.36s).

const Stub: React.FC<{ label: string }> = ({ label }) => (
  <AbsoluteFill
    style={{
      background: "#000",
      color: "#fff",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 48,
      fontFamily: "monospace",
    }}
  >
    {label}
  </AbsoluteFill>
);

export const netGrowthReplicateMeta = {
  id: "NetGrowth-Replicate",
  component: (() => <Stub label="NetGrowth-Replicate" />) as React.FC,
  durationInFrames: 709,
  fps: 25,
  width: 1080,
  height: 1080,
};

export const netGrowthSideBySideMeta = {
  id: "NetGrowth-SideBySide",
  component: (() => <Stub label="NetGrowth-SideBySide" />) as React.FC,
  durationInFrames: 709,
  fps: 25,
  width: 2160,
  height: 1080,
};

export const crxGrowthLoopMeta = {
  id: "CrxGrowthLoop",
  component: (() => <Stub label="CrxGrowthLoop" />) as React.FC,
  durationInFrames: 709,
  fps: 25,
  width: 1080,
  height: 1080,
};
