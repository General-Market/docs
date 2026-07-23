// BehindBeat — a reusable behind-subject headline beat.
//
// Generalises the IntroHero sandwich: a headline (and the light) sit BEHIND the
// speaker for a few seconds, the speaker re-revealed in front by a frame-exact
// cutout. Use it at any full-frame moment; matte the window first with
//   scripts/cutout_window.py <video> public/anticheat-edit/beats/<name> \
//     --start <sec> --duration <sec> --room
//
// Layers, back to front:
//   1. room plate  — our own frame-locked PNG/WebP of the room (covers the base
//                    OffthreadVideo's ~1-frame lag), graded to match the talk
//   2. headline    — the words, behind the person
//   3. light       — the same drifting god-rays, screen-blended
//   4. cutout      — the speaker, graded, re-revealed in front
//
// Rides idleCamera() so it sits identically on the base head. `startSec` MUST
// equal the cutout window's --start so the breath and frames line up.

import React from "react";
import {
  AbsoluteFill,
  Img,
  Loop,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { idleCamera } from "../AntiCheatLayout";

const HEAD_GRADE = "brightness(1.03) contrast(1.10) saturate(1.17)";
const pad = (n: number) => String(n).padStart(4, "0");

export interface BehindBeatProps {
  /** public/ dir the cutout_window.py frames live in, e.g. "anticheat-edit/beats/counterparty" */
  beatDir: string;
  /** number of frames matted (for clamping) */
  frames: number;
  /** final.mp4 second the window starts — MUST match cutout_window --start */
  startSec: number;
  side?: "left" | "right";
  /** headline lines — used when `back` is not provided */
  lines?: string[];
  sub?: string;
  /** headline size; defaults to 150 */
  fontSize?: number;
  /** custom behind-content (e.g. floating screenshots); overrides the headline */
  back?: React.ReactNode;
}

export const BehindBeat: React.FC<BehindBeatProps> = ({
  beatDir,
  frames,
  startSec,
  side = "left",
  lines,
  sub,
  fontSize = 150,
  back,
}) => {
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  const absSec = startSec + local / fps;

  const cam = idleCamera(absSec, fps);
  const headTransform = `scale(${cam.scale}) translate(${cam.px * 100}%, ${cam.py * 100}%)`;
  const idx = pad(Math.min(frames, Math.max(1, local + 1)));

  const headFill: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: headTransform,
    transformOrigin: "center center",
    filter: HEAD_GRADE,
  };

  const inA = interpolate(local, [4, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outA = interpolate(local, [frames - 14, frames - 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineOpacity = Math.min(inA, outA);

  return (
    <AbsoluteFill>
      {/* 1. room plate — frame-locked, graded */}
      <Img src={staticFile(`${beatDir}/room/f_${idx}.webp`)} style={headFill} />

      {/* 2. custom behind-content, when provided */}
      {back && <AbsoluteFill style={{ opacity: headlineOpacity }}>{back}</AbsoluteFill>}

      {/* 2b. headline behind the person (fallback when no custom back) */}
      {!back && lines && (
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: side === "left" ? "flex-start" : "flex-end",
          padding: "0 96px",
          opacity: headlineOpacity,
        }}
      >
        <div
          style={{
            textAlign: side === "left" ? "left" : "right",
            transform: `translateX(${(1 - inA) * (side === "left" ? -44 : 44)}px)`,
          }}
        >
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                fontFamily: '"Arial Black", "SF Pro Display", sans-serif',
                fontWeight: 900,
                fontSize,
                lineHeight: 0.96,
                letterSpacing: "-0.02em",
                color: "#0A1420",
              }}
            >
              {l}
            </div>
          ))}
          {sub && (
            <div
              style={{
                marginTop: 20,
                fontFamily: '"SF Pro Text", Arial, sans-serif',
                fontSize: Math.round(fontSize * 0.3),
                fontWeight: 600,
                color: "#2D5BFF",
              }}
            >
              {sub}
            </div>
          )}
        </div>
      </AbsoluteFill>
      )}

      {/* 3. light — same drifting god-rays, screen-blended */}
      <AbsoluteFill
        style={{ mixBlendMode: "screen", opacity: 0.4, filter: "saturate(1.5) brightness(1.08)" }}
      >
        <Loop durationInFrames={360}>
          <OffthreadVideo
            src={staticFile("anticheat-edit/light_shafts.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            muted
          />
        </Loop>
      </AbsoluteFill>

      {/* 4. cutout — the speaker in front */}
      <Img src={staticFile(`${beatDir}/f_${idx}.webp`)} style={headFill} />
    </AbsoluteFill>
  );
};
