import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CrxAppScenes } from "./CrxAppCards";
import "./diatype";

// ─── QA / contact-sheet harness for the CRX-Anoma mock cards ───
// The six cards are authored in a 1280×720 space and each guards its own frame
// window, so `CrxAppScenes frame={f}` shows whichever card is live at f — with
// NO video background. That lets a single still render in seconds against the
// slim crx-assets pubdir, instead of copying the 5.6GB public/ tree and decoding
// the wave b-roll. It is NOT shipped (registered only on the slim replicas entry,
// src/index-replicas.ts); the real cut is `CRX-Anoma` in Root.tsx.
//
// Scrub / --frame to inspect a card at a settled beat:
//   S3 portfolio 270 · S4 hedge-corridor 460 · S4 calendar 512 · S4 typed+CTA 578
//   S8 onboarding 1000 · S9 dealers 1180 · S10 compliance 1300 · S12 dashboard 1560
const QA_BG = "#f7f8fa"; // --bg, the app canvas

export const CrxAnomaQA: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: QA_BG }}>
      <CrxAppScenes frame={frame} />
    </AbsoluteFill>
  );
};

export const crxAnomaQAMeta = {
  id: "CRX-Anoma-QA",
  component: CrxAnomaQA,
  durationInFrames: 1760,
  fps: 30,
  width: 1280,
  height: 720,
};
