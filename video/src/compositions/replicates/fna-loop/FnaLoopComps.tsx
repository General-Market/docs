import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { CYCLE, DURATION, FNA_COPY, FNA_THEME, FPS, H, W } from "./data";
import { FnaLoopChart } from "./FnaLoopChart";
import { CRX_COPY, CRX_LOCKUP, CRX_THEME } from "./crx-data";

// fna-loop lane barrel — RootReplicas.tsx imports ONLY this file.
// Ref: public/fna-loop-original.mp4 (1280×720, 25fps, 1125 frames, 45s):
// one 375-frame chart-build cycle played three times; the wrap 1124→0 is the
// same hard cut the internal cycle boundaries use, so the loop is seamless.

// ─── 1:1 replica (the scored comp) ───
const FnaLoopReplicate: React.FC = () => {
  const frame = useCurrentFrame();
  return <FnaLoopChart cf={frame % CYCLE} theme={FNA_THEME} copy={FNA_COPY} />;
};

export const fnaLoopReplicateMeta = {
  id: "FnaLoop-Replicate",
  component: FnaLoopReplicate,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};

// ─── ref | replica, for eyeball gates ───
const FnaLoopSideBySide: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}>
        <OffthreadVideo
          src={staticFile("fna-loop-original.mp4")}
          muted
          style={{ width: W, height: H }}
        />
      </div>
      <div style={{ position: "absolute", left: W, top: 0, width: W, height: H }}>
        <FnaLoopChart cf={frame % CYCLE} theme={FNA_THEME} copy={FNA_COPY} />
      </div>
    </AbsoluteFill>
  );
};

export const fnaLoopSideBySideMeta = {
  id: "FnaLoop-SideBySide",
  component: FnaLoopSideBySide,
  durationInFrames: DURATION,
  fps: FPS,
  width: W * 2,
  height: H,
};

// ─── CRX cut — the publishable deliverable ───
const CrxLiquidityLoop: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <FnaLoopChart
      cf={frame % CYCLE}
      theme={CRX_THEME}
      copy={CRX_COPY}
      lockupSrc={staticFile(CRX_LOCKUP)}
    />
  );
};

export const crxLiquidityLoopMeta = {
  id: "CrxLiquidityLoop",
  component: CrxLiquidityLoop,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
