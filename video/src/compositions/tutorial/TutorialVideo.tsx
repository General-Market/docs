import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { TOTAL_FRAMES, SECTIONS, toFrames } from "./theme";
import { COLOR, FONT } from "./designTokens";
import { TalkingHeadLayout } from "./TalkingHeadLayout";
import { SCENES } from "./talkingHeadScenes";
import { LiquidityDiagrams } from "./diagrams/LiquidityDiagrams";
import { SettlementDiagrams } from "./diagrams/SettlementDiagrams";
import { ParimutuelDiagrams } from "./diagrams/ParimutuelDiagrams";
import { EraDiagrams } from "./diagrams/EraDiagrams";
import { ClosingDiagrams } from "./diagrams/ClosingDiagrams";
import { SourceCardOverlays } from "./overlays/SourceCardOverlays";
import { FaqQuestionOverlay } from "./overlays/FaqQuestionOverlay";
import { PromiseTicker } from "./overlays/PromiseTicker";
import { IntroTextOverlay } from "./overlays/IntroTextOverlay";
import { WordParticleTransition } from "../../lib/components/Effects";

const seq = (key: keyof typeof SECTIONS) => ({
  from: toFrames(SECTIONS[key].start),
  durationInFrames: toFrames(SECTIONS[key].end - SECTIONS[key].start),
});

export const TutorialVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      {/*
        All overlays are children of TalkingHeadLayout so they can call
        useTalkingHead() to get the content area bounds for the current frame.

        Position overlay content inside contentArea — NOT fullscreen,
        NOT on top of the webcam. See TalkingHeadLayout.tsx header.
      */}
      <TalkingHeadLayout videoSrc="tutorial-raw.mp4" scenes={SCENES}>
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

        {/* "And On and On" → "The Escape" particle transition (19.5–22.2s) */}
        <Sequence from={toFrames(19.5)} durationInFrames={toFrames(22.2 - 19.5)}>
          <div
            style={{
              position: "absolute",
              left: 48,
              top: 48,
              width: 992,
              height: 984,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <WordParticleTransition
              fromText={"And On\nand On..."}
              toText="The Escape"
              durationInFrames={toFrames(22.2 - 19.5)}
              fontFamily={FONT.display}
              fontSize={72}
              fontWeight={900}
              textColor={COLOR.nearBlack}
              particleColors={[
                COLOR.wiseGreen,
                COLOR.pastelGreen,
                COLOR.darkGreen,
                "#10B981",
                "#34D399",
              ]}
              seed={42}
            />
          </div>
        </Sequence>

        {/* Promise ticker — Liquidity / Capital Lock / Risk Management (11.28–22.2s) */}
        <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
          <PromiseTicker />
        </Sequence>

        {/* Intro typewriter — "How to launch your first general market bot..." (0–3.5s) */}
        <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
          <IntroTextOverlay />
        </Sequence>

        {/* FAQ question screens */}
        <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
          <FaqQuestionOverlay />
        </Sequence>
      </TalkingHeadLayout>
    </AbsoluteFill>
  );
};
