import React from "react";
import { AbsoluteFill } from "remotion";

// cls-day lane barrel — RootReplicas.tsx imports ONLY this file.
// Reorganize the lane freely behind these three exports; keep the export
// names and comp ids stable. Ref: public/cls-day-original.mp4
// (1920×1080, 25fps, 3750 frames, 150s).

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

export const clsDayReplicateMeta = {
  id: "ClsDay-Replicate",
  component: (() => <Stub label="ClsDay-Replicate" />) as React.FC,
  durationInFrames: 3750,
  fps: 25,
  width: 1920,
  height: 1080,
};

export const clsDaySideBySideMeta = {
  id: "ClsDay-SideBySide",
  component: (() => <Stub label="ClsDay-SideBySide" />) as React.FC,
  durationInFrames: 3750,
  fps: 25,
  width: 3840,
  height: 1080,
};

export const crxSettlementDayMeta = {
  id: "CrxSettlementDay",
  component: (() => <Stub label="CrxSettlementDay" />) as React.FC,
  durationInFrames: 3750,
  fps: 25,
  width: 1920,
  height: 1080,
};
