import React from "react";
import { AbsoluteFill, Sequence, Video, staticFile } from "remotion";
import { TOTAL_FRAMES, SECTIONS, toFrames } from "./theme";
// HookDiagrams removed — not approved
import { SettlementDiagrams } from "./diagrams/SettlementDiagrams";
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
      <AbsoluteFill>
        <Video
          src={staticFile("tutorial-raw.mp4")}
          style={{ width: "100%", height: "100%" }}
        />
      </AbsoluteFill>

      {/* 10-min cycle timeline (100.4–113.8s) */}
      <Sequence {...seq("settlementTimeline")}>
        <SettlementDiagrams />
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
