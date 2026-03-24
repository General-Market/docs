import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Series,
  Sequence,
  Audio,
  staticFile,
} from "remotion";
import { msToFrame } from "../../lib/utils/frameConvert";
import { remapCaptions } from "../../lib/utils/voiceMapping";
import { buildVoiceTimeline } from "../../lib/utils/voiceRuns";

// Lib reuse
import { Vignette } from "../../lib/components/Overlays/Vignette";
import { FilmGrain } from "../../lib/components/Overlays/FilmGrain";
import { ProgressBar } from "../../lib/components/Overlays/ProgressBar";
import { AudioEngineProvider } from "../../lib/components/Audio/AudioEngine";

// Slots engine
import {
  ShotFrame,
  BackgroundSlot,
  DiagramSlot,
  BrollSlot,
  StablecoinSlot,
  ShowcaseSlot,
  LogosSlot,
  DataCardSlot,
  ChibiSlot,
  CalloutSlot,
  LetterboxSlot,
  SFXSlot,
  TransitionSlot,
} from "../../slots";
import { SlotProvider } from "../../slots/SlotContext";
import { useSafeCaptions } from "../../slots/hooks/useSafeCaptions";

// Short-03 specific
import { MoodMusic } from "./audio/MoodMusic";
import { shots } from "./shots";
import { LAYOUT, COLORS } from "./types";
import { ViralCaptions } from "./components/ViralCaptions";
import { RejectedStamp } from "./components/RejectedStamp";

const ASSET_DIR = "shorts/short-03";
const FPS = LAYOUT.FPS;

const FONT_FAMILY = "'Switzer', 'Inter', 'Helvetica Neue', sans-serif";

// ── Slot render order (z-back → z-front, matches ShotRenderer layers) ─
const SLOTS = [
  BackgroundSlot,    // Layer 0: background
  DiagramSlot,       // Layer 0.1: architecture diagram
  BrollSlot,         // Layer 0.7: B-roll mosaic
  StablecoinSlot,    // Layer 1.8: stablecoin cards
  ShowcaseSlot,      // Layer 1.9: project showcase
  LogosSlot,         // Layer 1.7: floating logos
  DataCardSlot,      // Layer 1.95: project data card
  ChibiSlot,         // Layer 4: chibi character
  CalloutSlot,       // Layer 5: data callout
  LetterboxSlot,     // Layer 9.5: letterbox bars
  SFXSlot,           // Layer 9: SFX
  TransitionSlot,    // Layer 10: transition overlay
];

// ── Rejected stamp config (shots 6, 11) ─────────────────────────────
// Stamp slams ~30 frames before scene end for a punchy "verdict" feel.
// One stamp per project only — top-left, smaller
const STAMP_CONFIG: Record<number, { delayFrames: number }> = {
  6: { delayFrames: 93 },    // Bitlayer verdict
  11: { delayFrames: 119 },  // GMRT verdict
};

// ── Voice timeline (auto-smooth engine) ──────────────────────────────
// buildVoiceTimeline auto-detects seamless vs gapped boundaries,
// computes continuous voice runs (1 Audio per run = no decoder clicks),
// and provides auto-smooth volume functions for natural decay at cuts.
const allShotSegments = shots.map((s) => s.voiceSegments!);

const {
  voiceRuns,
  shotFrameOffsets,
  shotFrameDurations,
  shotBufferMs,
  totalFrames: TOTAL_FRAMES,
  getRunVolume,
} = buildVoiceTimeline(shots, FPS, 20); // 20 frames (~667ms) buffer after "February" for natural silence

// ── Mood music boundaries (derived from shot positions) ──────────────
const MOOD_SHOT_MAP: { shotRange: [number, number]; track: string | null }[] = [
  { shotRange: [0, 10], track: "music/corporate/cloud-dancer.mp3" },
  { shotRange: [11, 11], track: null },
];

const moodSegments = MOOD_SHOT_MAP.map(({ shotRange, track }) => ({
  track,
  startSec: shotFrameOffsets[shotRange[0]] / FPS,
  endSec:
    (shotFrameOffsets[shotRange[1]] + shotFrameDurations[shotRange[1]]) / FPS,
}));

export const FebNewTop500Composition: React.FC = () => {
  const rawCaptions = useSafeCaptions(`${ASSET_DIR}/captions.json`);

  // Remap caption timestamps from voice-absolute to composition-absolute.
  const captions = useMemo(
    () =>
      rawCaptions.length > 0
        ? remapCaptions(rawCaptions, allShotSegments, shotBufferMs, FPS)
        : [],
    [rawCaptions],
  );

  return (
    <SlotProvider assetDir={ASSET_DIR}>
      <AudioEngineProvider
        voiceSrc={staticFile(`${ASSET_DIR}/voice.mp3`)}
        totalFrames={TOTAL_FRAMES}
        fps={FPS}
        shots={shots}
        shotFrameOffsets={shotFrameOffsets}
      >
      <AbsoluteFill
        style={{
          backgroundColor: COLORS.BG_BASE,
          fontFamily: FONT_FAMILY,
          overflow: "hidden",
        }}
      >
        {/* ── Continuous voice audio (composition-level) ──────────────
            One <Audio> per seamless run. Eliminates decoder boundary
            clicks/pops between shots. */}
        {voiceRuns.map((run, ri) => (
          <Sequence
            key={`voice-run-${ri}`}
            from={run.compFrom}
            durationInFrames={run.compDuration}
          >
            <Audio
              src={staticFile(`${ASSET_DIR}/voice.mp3`)}
              startFrom={msToFrame(run.voiceStartMs, FPS)}
              volume={getRunVolume(run)}
            />
          </Sequence>
        ))}

        {/* Shot sequence — visuals only, no per-shot audio */}
        <Series>
          {shots.map((shot, i) => {
            const prevEmotion = i > 0 ? shots[i - 1].chibiEmotion : undefined;
            const nextEmotion =
              i < shots.length - 1 ? shots[i + 1].chibiEmotion : undefined;
            const prevContinuity =
              prevEmotion && !shot.chibiEntrance ? prevEmotion : undefined;
            const nextContinuity =
              nextEmotion && !shots[i + 1]?.chibiEntrance
                ? nextEmotion
                : undefined;
            const prevProjectTicker =
              i > 0 ? shots[i - 1].projectDataCard?.ticker : undefined;
            return (
              <Series.Sequence
                key={shot.id}
                durationInFrames={shotFrameDurations[i]}
              >
                <ShotFrame
                  shot={{ ...shot, hideCaptions: true }}
                  slots={SLOTS}
                  globalFrameOffset={shotFrameOffsets[i]}
                  captions={captions}
                  prevShotEmotion={prevContinuity}
                  nextShotEmotion={nextContinuity}
                  prevProjectTicker={prevProjectTicker}
                  voiceSegments={shot.voiceSegments}
                  bgColor={COLORS.BG_BASE}
                />
                {/* Rejected stamp overlay */}
                {STAMP_CONFIG[shot.id] && (
                  <RejectedStamp
                    delayFrames={STAMP_CONFIG[shot.id].delayFrames}
                  />
                )}
              </Series.Sequence>
            );
          })}
        </Series>

        {/* Viral-style captions (composition-level, uses remapped timestamps) */}
        <ViralCaptions
          captions={captions}
          shots={shots}
          shotFrameOffsets={shotFrameOffsets}
          shotFrameDurations={shotFrameDurations}
          captionLeadFrames={-10}
        />

        {/* Mood-based multi-track music (boundaries derived from shot positions) */}
        <MoodMusic baseVolume={0.03} segments={moodSegments} />

        {/* Global overlays */}
        <Vignette opacity={0.3} spread={50} />
        <FilmGrain opacity={0.02} />
        <ProgressBar color={COLORS.ACCENT_BLUE} height={3} />
      </AbsoluteFill>
      </AudioEngineProvider>
    </SlotProvider>
  );
};

// Composition metadata for Root.tsx
export const short03Meta = {
  id: "Short03",
  component: FebNewTop500Composition,
  durationInFrames: TOTAL_FRAMES,
  fps: LAYOUT.FPS as 30,
  width: LAYOUT.WIDTH as 1080,
  height: LAYOUT.HEIGHT as 1920,
};
