import React from "react";
import { AbsoluteFill } from "remotion";

// fna-loop lane barrel — RootReplicas.tsx imports ONLY this file.
// Reorganize the lane freely behind these three exports; keep the export
// names and comp ids stable. Ref: public/fna-loop-original.mp4
// (1280×720, 25fps, 1125 frames, 45s).

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

export const fnaLoopReplicateMeta = {
  id: "FnaLoop-Replicate",
  component: (() => <Stub label="FnaLoop-Replicate" />) as React.FC,
  durationInFrames: 1125,
  fps: 25,
  width: 1280,
  height: 720,
};

export const fnaLoopSideBySideMeta = {
  id: "FnaLoop-SideBySide",
  component: (() => <Stub label="FnaLoop-SideBySide" />) as React.FC,
  durationInFrames: 1125,
  fps: 25,
  width: 2560,
  height: 720,
};

export const crxLiquidityLoopMeta = {
  id: "CrxLiquidityLoop",
  component: (() => <Stub label="CrxLiquidityLoop" />) as React.FC,
  durationInFrames: 1125,
  fps: 25,
  width: 1280,
  height: 720,
};
