// Demo compositions for the procedural bridge-wave background.
// BridgeWave-Procedural: the field alone, source-matched defaults.
// BridgeWave-SideBySide: original mp4 (left) vs procedural (right).
import React from "react";
import { AbsoluteFill, Loop, OffthreadVideo, staticFile } from "remotion";
import { BridgeWaveField, type BridgeWaveProps } from "./BridgeWaveField";

export const FPS = 50;
export const DURATION = 900; // one full 18 s loop

export const BridgeWaveComposition: React.FC<BridgeWaveProps> = (props) => (
  <AbsoluteFill style={{ backgroundColor: "#fff" }}>
    <BridgeWaveField {...props} />
  </AbsoluteFill>
);

export const bridgeWaveMeta = {
  id: "BridgeWave-Procedural",
  component: BridgeWaveComposition,
  durationInFrames: DURATION,
  fps: FPS,
  width: 1920,
  height: 1080,
};

// ── Side-by-side — Label pattern from replicates/plume ──────────────────

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

export const BridgeWaveSideBySide: React.FC = () => (
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
      <Loop durationInFrames={DURATION}>
        <OffthreadVideo
          src={staticFile("crx-assets/bridge-wave-4k.mp4")}
          muted
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </Loop>
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
        <BridgeWaveField width={1920} height={1080} />
      </div>
      <Label text="PROCEDURAL" />
    </div>
  </AbsoluteFill>
);

export const bridgeWaveSideBySideMeta = {
  id: "BridgeWave-SideBySide",
  component: BridgeWaveSideBySide,
  durationInFrames: DURATION,
  fps: FPS,
  width: 1920,
  height: 540,
};
