import React from "react";
import { AbsoluteFill, Sequence, Video, staticFile } from "remotion";
import { TOTAL_FRAMES, SECTIONS, toFrames } from "./theme";
import { ClaudeTerminal } from "./scenes/ClaudeTerminal";
import { FaqQuestionOverlay } from "./overlays/FaqQuestionOverlay";
import { HookDiagrams } from "./diagrams/HookDiagrams";
import { BotArchDiagram } from "./diagrams/BotArchDiagram";
import { LiquidityDiagrams } from "./diagrams/LiquidityDiagrams";
import { SettlementDiagrams } from "./diagrams/SettlementDiagrams";
import { PariDiagrams } from "./diagrams/PariDiagrams";
import { PrivacyDiagrams } from "./diagrams/PrivacyDiagrams";
import { ClosingDiagrams } from "./diagrams/ClosingDiagrams";
import { EraDiagrams } from "./diagrams/EraDiagrams";
import { MoatDiagrams } from "./diagrams/MoatDiagrams";
import { SourcesDiagrams } from "./diagrams/SourcesDiagrams";
import { OpeningSequenceText } from "./overlays/OpeningSequenceText";
import { SourceCardOverlays } from "./overlays/SourceCardOverlays";

const seq = (key: keyof typeof SECTIONS) => ({
  from: toFrames(SECTIONS[key].start),
  durationInFrames: toFrames(SECTIONS[key].end - SECTIONS[key].start),
});

export const TutorialVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Layer 0: Source talking-head video */}
      <AbsoluteFill>
        <Video
          src={staticFile("tutorial-raw.mp4")}
          style={{ width: "100%", height: "100%" }}
        />
      </AbsoluteFill>

      {/* ═══ DIAGRAMS — the primary visual layer ═══ */}

      {/* Hook: bot pipeline, problem constellation, execution flow, audience cards */}
      <Sequence {...seq("hookOverlays")}>
        <HookDiagrams />
      </Sequence>

      {/* Bot trigger: terminal + 5-tier system architecture */}
      <Sequence {...seq("claudeTerminal")}>
        <ClaudeTerminal />
      </Sequence>
      <Sequence {...seq("botArchDiagram")}>
        <BotArchDiagram />
      </Sequence>

      {/* FAQ 1: batch anatomy, mandatory fill network, coverage heatmap, bell curve */}
      <Sequence {...seq("liquidityDiagram")}>
        <LiquidityDiagrams />
      </Sequence>

      {/* FAQ 2: Germany rail map, 10-min cycle, oracle architecture, price comparison */}
      <Sequence {...seq("settlementTimeline")}>
        <SettlementDiagrams />
      </Sequence>

      {/* FAQ 2 cont: parimutuel pool, 30x computation grid, PNL waterfall, risk cap */}
      <Sequence from={toFrames(131.5)} durationInFrames={toFrames(161.4 - 131.5)}>
        <PariDiagrams />
      </Sequence>

      {/* FAQ 3: order book anatomy, sealed architecture, dispute timeline */}
      <Sequence {...seq("privacySplit")}>
        <PrivacyDiagrams />
      </Sequence>

      {/* FAQ 4: market overwhelm, single-vs-all paradigm, scatter plot */}
      <Sequence {...seq("moatTimeline")}>
        <MoatDiagrams />
      </Sequence>

      {/* FAQ 4 cont: era timeline with mini-charts, competitive landscape, fortress */}
      <Sequence {...seq("moatTimeline")}>
        <EraDiagrams />
      </Sequence>

      {/* FAQ 5: source selection tree, roadmap, exponential growth chart */}
      <Sequence {...seq("sourcesDiagrams")}>
        <SourcesDiagrams />
      </Sequence>

      {/* Closing: bot dashboard + full architecture recap + end card */}
      <Sequence {...seq("closingDiagrams")}>
        <ClosingDiagrams />
      </Sequence>

      {/* ═══ ACCENT LAYERS — minimal, non-competing ═══ */}

      {/* Cinematic text reveals — 3 dramatic moments only */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <OpeningSequenceText />
      </Sequence>

      {/* Source cards — frontend replicas when sources are mentioned */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <SourceCardOverlays />
      </Sequence>

      {/* FAQ question cards — full-screen overlays at each FAQ transition */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <FaqQuestionOverlay />
      </Sequence>
    </AbsoluteFill>
  );
};
