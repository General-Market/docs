import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLOR, SCENE_FRAMES, balanceAt, isFeeHit } from "./theme";

export const formatUSD = (n: number): string =>
  `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const useScene = () => {
  const frame = useCurrentFrame();
  const sceneFrame = frame % SCENE_FRAMES;
  const balance = balanceAt(sceneFrame);
  const hit = isFeeHit(sceneFrame);
  return { frame, sceneFrame, balance, hit };
};

// Subtle shake on fee hit — frames since last hit.
export const useHitShake = () => {
  const { sceneFrame } = useScene();
  // Find the nearest hit frame <= sceneFrame
  const hitFrames: number[] = [];
  for (let i = 0; i < SCENE_FRAMES; i++) {
    if (isFeeHit(i)) hitFrames.push(i);
  }
  let last = 0;
  for (const h of hitFrames) if (h <= sceneFrame) last = h;
  const since = sceneFrame - last;
  if (since > 6 || since < 0) return { x: 0, y: 0 };
  const d = 1 - since / 6;
  const x = (Math.random() - 0.5) * 6 * d;
  const y = (Math.random() - 0.5) * 6 * d;
  return { x, y };
};

// Determinstic shake — use frame as seed so renders reproduce.
const prand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

export const useFrameShake = (strength = 6) => {
  const { sceneFrame } = useScene();
  const hitFrames: number[] = [];
  for (let i = 0; i < SCENE_FRAMES; i++) {
    if (isFeeHit(i)) hitFrames.push(i);
  }
  let last = -999;
  for (const h of hitFrames) if (h <= sceneFrame) last = h;
  const since = sceneFrame - last;
  if (since > 6) return { x: 0, y: 0 };
  const d = 1 - since / 6;
  return {
    x: prand(last * 13 + since) * strength * d,
    y: prand(last * 17 + since + 5) * strength * d,
  };
};

// Small caption at bottom — consistent across scenes.
export const SceneLabel: React.FC<{ idx: number; title: string }> = ({
  idx,
  title,
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 56,
      textAlign: "center",
      color: COLOR.dim,
      fontFamily: "ui-monospace, 'SF Mono', monospace",
      fontSize: 28,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      pointerEvents: "none",
    }}
  >
    <span style={{ color: COLOR.ink }}>
      {String(idx).padStart(2, "0")}
    </span>
    <span style={{ margin: "0 20px" }}>—</span>
    <span>{title}</span>
  </div>
);

// Giant balance numeric — used by the screen proposition and as overlay option.
export const BalanceHUD: React.FC<{
  balance: number;
  hit: boolean;
  color?: string;
}> = ({ balance, hit, color }) => {
  const flash = hit ? 1 : 0;
  return (
    <div
      style={{
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        fontSize: 180,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        color: color ?? COLOR.ink,
        textShadow: `0 0 ${interpolate(flash, [0, 1], [0, 60])}px ${COLOR.loss}`,
      }}
    >
      {formatUSD(balance)}
    </div>
  );
};
