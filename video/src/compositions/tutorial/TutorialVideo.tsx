import React from "react";
import { AbsoluteFill, Sequence, Video, staticFile } from "remotion";
import { TOTAL_FRAMES, SECTIONS, toFrames } from "./theme";
import { HookOverlays, CountdownTimer } from "./scenes/HookOverlays";
import { ClaudeTerminal } from "./scenes/ClaudeTerminal";
import { LiquidityDiagram } from "./scenes/LiquidityDiagram";
import { SettlementTimeline } from "./scenes/SettlementTimeline";
import { PrivacySplit } from "./scenes/PrivacySplit";
import { MoatTimeline } from "./scenes/MoatTimeline";
import { SourcesClosing } from "./scenes/SourcesClosing";
import { PromiseChecklist } from "./scenes/PromiseChecklist";
import { SubtitleLayer } from "./SubtitleLayer";
import { VoiceSyncKeywords } from "./overlays/VoiceSyncKeywords";
import { StatsBarOverlays } from "./overlays/StatsBarOverlays";
import { OpeningSequenceText } from "./overlays/OpeningSequenceText";
import { SourceCardOverlays } from "./overlays/SourceCardOverlays";
import { LetterDecorationsTitle } from "./overlays/LetterDecorationsTitle";
import { EnhancedPrivacy } from "./overlays/EnhancedPrivacy";
import { EnhancedSettlement } from "./overlays/EnhancedSettlement";
import { TextHighlightSync } from "./overlays/TextHighlightSync";
import { EnhancedMoat } from "./overlays/EnhancedMoat";
import { WhiteModeOverlays } from "./overlays/WhiteModeOverlays";

const seq = (key: keyof typeof SECTIONS) => ({
  from: toFrames(SECTIONS[key].start),
  durationInFrames: toFrames(SECTIONS[key].end - SECTIONS[key].start),
});

export const TutorialVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Bottom layer: source talking-head video */}
      <AbsoluteFill>
        <Video
          src={staticFile("tutorial-raw.mp4")}
          style={{ width: "100%", height: "100%" }}
        />
      </AbsoluteFill>

      {/* Overlay sequences — each scene manages its own internal timing */}
      <Sequence {...seq("hookOverlays")}>
        <HookOverlays />
      </Sequence>

      <Sequence {...seq("claudeTerminal")}>
        <ClaudeTerminal />
      </Sequence>

      <Sequence {...seq("liquidityDiagram")}>
        <LiquidityDiagram />
      </Sequence>

      <Sequence {...seq("settlementTimeline")}>
        <SettlementTimeline />
      </Sequence>

      <Sequence {...seq("privacySplit")}>
        <PrivacySplit />
      </Sequence>

      <Sequence {...seq("moatTimeline")}>
        <MoatTimeline />
      </Sequence>

      <Sequence {...seq("sourcesClosing")}>
        <SourcesClosing />
      </Sequence>

      {/* Full-duration layers */}
      <Sequence from={toFrames(0.16)} durationInFrames={TOTAL_FRAMES - toFrames(0.16)}>
        <CountdownTimer totalDurationFrames={TOTAL_FRAMES} />
      </Sequence>

      <Sequence {...seq("promiseChecklist")}>
        <PromiseChecklist />
      </Sequence>

      <Sequence {...seq("subtitleLayer")}>
        <SubtitleLayer />
      </Sequence>

      {/* Voice-synced keyword pills — full duration */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <VoiceSyncKeywords />
      </Sequence>

      {/* Stats bar overlays — frontend-style lower-thirds */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <StatsBarOverlays />
      </Sequence>

      {/* Cinematic OpeningSequence text reveals — 3 key dramatic moments */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <OpeningSequenceText />
      </Sequence>

      {/* Source cards — frontend SourceCard replicas at 253.92s–264.88s */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <SourceCardOverlays />
      </Sequence>

      {/* LetterDecorations FAQ titles — decorated letters with geometric scatter */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <LetterDecorationsTitle />
      </Sequence>

      {/* Enhanced settlement overlays — clock, stamp, YES/NO, oracles, $0 slams, counter, payout flash */}
      <Sequence {...seq("settlementTimeline")}>
        <EnhancedSettlement />
      </Sequence>

      {/* Progressive text highlight — karaoke-style word sync for key sentences */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <TextHighlightSync />
      </Sequence>

      {/* Enhanced privacy overlays — lock, stamp, checkmark, countdown, labels, badge */}
      <Sequence {...seq("privacySplit")}>
        <EnhancedPrivacy />
      </Sequence>

      {/* White-mode frontend panels — contrast relief at transition points */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <WhiteModeOverlays />
      </Sequence>

      {/* Enhanced moat overlays — counters, explosion, era cards, banner, hedge numbers */}
      <Sequence {...seq("moatTimeline")}>
        <EnhancedMoat />
      </Sequence>
    </AbsoluteFill>
  );
};
