import React from "react";
import { AbsoluteFill } from "remotion";

// clsnet lane barrel — RootReplicas.tsx imports ONLY this file.
// Reorganize the lane freely behind these three exports; keep the export
// names and comp ids stable. Ref: public/clsnet-original.mp4
// (1920×1080, 25fps, 4168 frames, 166.72s).

const Stub: React.FC<{ label: string }> = ({ label }) => (
  <AbsoluteFill
    style={{
      background: "#000",
      color: "#fff",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 64,
      fontFamily: "monospace",
    }}
  >
    {label}
  </AbsoluteFill>
);

export const clsNetReplicateMeta = {
  id: "ClsNet-Replicate",
  component: (() => <Stub label="ClsNet-Replicate" />) as React.FC,
  durationInFrames: 4168,
  fps: 25,
  width: 1920,
  height: 1080,
};

export const clsNetSideBySideMeta = {
  id: "ClsNet-SideBySide",
  component: (() => <Stub label="ClsNet-SideBySide" />) as React.FC,
  durationInFrames: 4168,
  fps: 25,
  width: 3840,
  height: 1080,
};

export const crxNettingMeta = {
  id: "CrxNetting",
  component: (() => <Stub label="CrxNetting" />) as React.FC,
  durationInFrames: 4168,
  fps: 25,
  width: 1920,
  height: 1080,
};
