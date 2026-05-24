/**
 * AntiCheatBehindTest — 12s proof of the "behind the subject" method.
 *
 * Three layers, back to front:
 *   1. the bright room (the video itself, keynote-graded)
 *   2. pre-rendered animated god-ray light (light_shafts.mp4), screen-blended
 *      at a third strength so the blue is faint ambient light, behind you
 *   3. your cutout (alpha .mov), graded bright + natural, always in front
 *
 * The light is pre-rendered on black (screen blend drops the black, adds the
 * light) and drifts/breathes frame to frame. Bright room kept — the blue is
 * deliberately faint ambiance, not a grade.
 *
 * Frame-aligned: both the room (startFrom 84s) and cutout-test.mov are the
 * same 12s segment; light_shafts.mp4 is its own 12s clip from frame 0.
 *
 * Knob: LIGHT_OPACITY (faintness of the blue light).
 */

import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

const FPS = 30;
const W = 1920;
const H = 1080;
const SEG_START = Math.round(84 * FPS);
const SEG_FRAMES = Math.round(12 * FPS);

// strength of the blue light (screen-blended)
const LIGHT_OPACITY = 0.5;

const cover: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

export const AntiCheatBehindTest: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* 1. room — bright but rich, not washed out */}
      <AbsoluteFill style={{ filter: "brightness(1.02) contrast(1.11) saturate(1.20)" }}>
        <OffthreadVideo
          src={staticFile("anticheat-edit/final.ungraded.mp4")}
          startFrom={SEG_START}
          style={cover}
        />
      </AbsoluteFill>

      {/* 2. animated god-ray light, screen-blended, saturated — behind the subject */}
      <AbsoluteFill
        style={{ mixBlendMode: "screen", opacity: LIGHT_OPACITY, filter: "saturate(1.5) brightness(1.08)" }}
      >
        <OffthreadVideo src={staticFile("anticheat-edit/light_shafts.mp4")} style={cover} muted />
      </AbsoluteFill>

      {/* 3. your cutout in front — graded crisp + natural */}
      <AbsoluteFill style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.13)" }}>
        <OffthreadVideo src={staticFile("anticheat-edit/cutout-test.mov")} style={cover} muted />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const antiCheatBehindTestMeta = {
  id: "AntiCheatBehindTest",
  component: AntiCheatBehindTest,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: SEG_FRAMES,
};
