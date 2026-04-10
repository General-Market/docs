import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { TOTAL_FRAMES, SECTIONS, toFrames } from "./theme";
import { TalkingHeadLayout } from "./TalkingHeadLayout";
import { LiquidityDiagrams } from "./diagrams/LiquidityDiagrams";
import { SettlementDiagrams } from "./diagrams/SettlementDiagrams";
import { ParimutuelDiagrams } from "./diagrams/ParimutuelDiagrams";
import { PrivacyDiagrams } from "./diagrams/PrivacyDiagrams";
import { EraDiagrams } from "./diagrams/EraDiagrams";
import { ClosingDiagrams } from "./diagrams/ClosingDiagrams";
import { SourceCardOverlays } from "./overlays/SourceCardOverlays";
import { FaqQuestionOverlay } from "./overlays/FaqQuestionOverlay";
import { PromiseTicker } from "./overlays/PromiseTicker";

const seq = (key: keyof typeof SECTIONS) => ({
  from: toFrames(SECTIONS[key].start),
  durationInFrames: toFrames(SECTIONS[key].end - SECTIONS[key].start),
});

export const TutorialVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Base layer: animated split-screen webcam */}
      <TalkingHeadLayout />

      {/* Liquidity diagrams (48.64–89.84s) */}
      <Sequence {...seq("liquidityDiagram")}>
        <LiquidityDiagrams />
      </Sequence>

      {/* 10-min cycle timeline (100.4–113.8s) */}
      <Sequence {...seq("settlementTimeline")}>
        <SettlementDiagrams />
      </Sequence>

      {/* Parimutuel explanation (2:11-2:39) — overlaps settlementTimeline section */}
      <Sequence {...seq("settlementTimeline")}>
        <ParimutuelDiagrams />
      </Sequence>

      {/* Dispute timeline (181.2–194.0s) */}
      <Sequence {...seq("privacySplit")}>
        <PrivacyDiagrams />
      </Sequence>

      {/* Era timeline + competitive landscape (216.8–247.4s) */}
      <Sequence {...seq("moatTimeline")}>
        <EraDiagrams />
      </Sequence>

      {/* Bot dashboard + end card (271.0–282.9s) */}
      <Sequence {...seq("closingDiagrams")}>
        <ClosingDiagrams />
      </Sequence>

      {/* Source cards (253.9–264.9s) */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <SourceCardOverlays />
      </Sequence>

      {/* Promise ticker — Liquidity / Capital Lock / Risk Management (11.28–22.2s) */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <PromiseTicker />
      </Sequence>

      {/* FAQ question screens */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <FaqQuestionOverlay />
      </Sequence>
    </AbsoluteFill>
  );
};
