// Worldcoin2 macbook on top of the LofiDots broll backdrop.
// LofiDots no longer greys the field — both layers print in full colour.
// The macbook scene runs with its gradient suppressed so its three.js
// canvas is the only thing covering the broll.

import React from "react";
import { AbsoluteFill } from "remotion";
import { LofiDots } from "../../endcard/LofiDots";
import { Worldcoin2Composition } from "./Worldcoin2Composition";

const W = 1920;
const H = 1080;
const FPS = 30;
const DURATION_SEC = 10;
const DURATION = FPS * DURATION_SEC;

export const Worldcoin2OverLofi: React.FC = () => {
  return (
    <AbsoluteFill style={{ width: W, height: H }}>
      <LofiDots skipFadeIn />
      <Worldcoin2Composition transparent />
    </AbsoluteFill>
  );
};

export const worldcoin2OverLofiMeta = {
  id: "Worldcoin2OverLofi",
  component: Worldcoin2OverLofi,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: DURATION,
};
