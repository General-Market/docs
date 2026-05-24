/**
 * AntiCheatLayoutReel — proof that the picture can change every few seconds.
 *
 * The same 12s segment, worn four different ways back to back:
 *   0-3s  headline left,  you right   (EVERY MARKET IS RIGGED)
 *   3-6s  schematic cutaway           (your face gone, your voice continues)
 *   6-9s  slow punch-in close-up      (no graphics, just you)
 *   9-12s headline right, you left    (NO FRONT-RUNNING)
 *
 * Footage stays aligned via each section's frame offset, so it plays through
 * continuously while the composition around it keeps changing. Audio muted —
 * this is about the eye, not the ear.
 */

import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  LayoutHeadline,
  LayoutPunchIn,
  LayoutSchematic,
} from "./layouts/SectionLayouts";
import { ILLUSTRATIONS } from "./illustrations/registry";

const FPS = 30;
const W = 1920;
const H = 1080;
const SEC = 3 * FPS; // 90 frames per section

const Schematic = ILLUSTRATIONS[0].component;

export const AntiCheatLayoutReel: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence from={0} durationInFrames={SEC}>
        <LayoutHeadline
          offset={0}
          side="left"
          lines={["EVERY", "MARKET", "IS", "RIGGED."]}
          sub="— and here is the proof."
        />
      </Sequence>

      <Sequence from={SEC} durationInFrames={SEC}>
        <LayoutSchematic Comp={Schematic} />
      </Sequence>

      <Sequence from={SEC * 2} durationInFrames={SEC}>
        <LayoutPunchIn offset={SEC * 2} />
      </Sequence>

      <Sequence from={SEC * 3} durationInFrames={SEC}>
        <LayoutHeadline
          offset={SEC * 3}
          side="right"
          lines={["NO", "FRONT-", "RUNNING."]}
          sub="orders sealed until they clear."
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export const antiCheatLayoutReelMeta = {
  id: "AntiCheatLayoutReel",
  component: AntiCheatLayoutReel,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: SEC * 4,
};
