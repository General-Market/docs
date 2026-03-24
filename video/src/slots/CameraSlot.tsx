import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import type { ShotDef } from "./types";
import { secondsToFrame } from "../lib/utils/frameConvert";

export interface CameraSlotProps {
  shot: ShotDef;
  bgColor?: string;
  children: React.ReactNode;
}

export const CameraSlot: React.FC<CameraSlotProps> = ({
  shot,
  bgColor = "#0A0A0A",
  children,
}) => {
  const frame = useCurrentFrame();
  const durationFrames = secondsToFrame(shot.durationSeconds);
  const clamp = {
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
  };

  // 1. Zoom drift (1.0 ↔ 1.05)
  const fsScale = shot.fullScreenZoom
    ? interpolate(
        frame,
        [0, durationFrames],
        shot.fullScreenZoom === "in" ? [1, 1.05] : [1.05, 1],
        clamp,
      )
    : 1;

  // 2. Breathing pulse — sinusoidal micro-scale (~2s period)
  const breathScale = shot.breathingPulse
    ? 1 + 0.015 * Math.sin((frame / 30) * Math.PI * 2 * 0.5)
    : 1;

  // 3. Camera tilt (0 → ±0.5°)
  const tiltDeg = shot.cameraTilt
    ? interpolate(
        frame,
        [0, durationFrames],
        shot.cameraTilt === "cw" ? [0, 0.5] : [0, -0.5],
        clamp,
      )
    : 0;

  // 4. Camera drift (±10px)
  const driftPx = shot.cameraDrift
    ? interpolate(
        frame,
        [0, durationFrames],
        shot.cameraDrift === "right" ? [-10, 10] : [10, -10],
        clamp,
      )
    : 0;

  // 4b. Camera vertical drift (±80px)
  const vertDriftPx = shot.cameraVerticalDrift
    ? interpolate(
        frame,
        [0, durationFrames],
        shot.cameraVerticalDrift === "down" ? [-80, 0] : [0, -80],
        clamp,
      )
    : 0;

  // 5. Focus pull (blur 2px ↔ 0px over first 40% of shot)
  const focusBlur = shot.focusPull
    ? interpolate(
        frame,
        [0, durationFrames * 0.4],
        shot.focusPull === "sharpen" ? [2, 0] : [0, 2],
        clamp,
      )
    : 0;

  // 6. Color temperature shift (sepia + hue-rotate blend)
  const colorProgress = shot.colorShift
    ? interpolate(frame, [0, durationFrames], [0, 1], clamp)
    : 0;
  const warmAmount = shot.colorShift
    ? shot.colorShift === "cool-to-warm"
      ? colorProgress
      : 1 - colorProgress
    : 0;

  // Build combined transform string
  const transforms: string[] = [];
  const combinedScale = fsScale * breathScale;
  if (combinedScale !== 1) transforms.push(`scale(${combinedScale})`);
  if (tiltDeg !== 0) transforms.push(`rotate(${tiltDeg}deg)`);
  if (driftPx !== 0) transforms.push(`translateX(${driftPx}px)`);
  if (vertDriftPx !== 0) transforms.push(`translateY(${vertDriftPx}px)`);

  // Build combined filter string
  const filters: string[] = [];
  if (focusBlur > 0.01) filters.push(`blur(${focusBlur}px)`);
  if (warmAmount > 0.01) {
    filters.push(`sepia(${warmAmount * 0.15})`);
    filters.push(`hue-rotate(${warmAmount * -10}deg)`);
  }

  const style: React.CSSProperties = {
    backgroundColor: bgColor,
    transform: transforms.length > 0 ? transforms.join(" ") : undefined,
    filter: filters.length > 0 ? filters.join(" ") : undefined,
  };

  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};
