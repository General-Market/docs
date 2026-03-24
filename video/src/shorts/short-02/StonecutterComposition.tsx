// Stonecutter Short — Main Composition
// Based on _template/TemplateComposition.tsx

import React, { Component, useState, useEffect, useCallback } from "react";
import {
  AbsoluteFill,
  Series,
  Sequence,
  Audio,
  staticFile,
  continueRender,
  delayRender,
  useCurrentFrame,
} from "remotion";
import type { Caption } from "../../lib/types";

import { Vignette } from "../../lib/components/Overlays/Vignette";
import { FilmGrain } from "../../lib/components/Overlays/FilmGrain";
import { ProgressBar } from "../../lib/components/Overlays/ProgressBar";
import { secondsToFrame } from "../../lib/utils/frameConvert";

import { ShortProvider } from "./ShortContext";
import { ShotRenderer } from "./components/ShotRenderer";
import { TradingJourney3D } from "./components/TradingJourney3D";
import { MiamiIntro } from "./components/MiamiIntro";
import { PersistentCaptions } from "./components/PersistentCaptions";
import { PhaseLabel } from "./components/PhaseLabel";
import { MoodMusic } from "./audio/MoodMusic";
import { Ambient } from "./audio/Ambient";
import { shots } from "./shots";
import { LAYOUT, COLORS } from "./types";
import { QualityProvider } from "../../engine/quality";
import type { QualityMode } from "../../engine/types/quality";

const ASSET_DIR = "shorts/short-02";
const FONT_FAMILY = "'Montserrat', 'Inter', 'Helvetica Neue', sans-serif";

// Pre-compute frame offsets from cumulative seconds to avoid rounding drift.
// (Summing individually-rounded frame counts drifts up to ±2 frames over 22 shots,
//  causing caption words at shot boundaries to land in the wrong shot.)
const shotFrameOffsets: number[] = [];
const shotFrameDurations: number[] = [];
let cumulativeSeconds = 0;
for (const shot of shots) {
  const startFrame = secondsToFrame(cumulativeSeconds);
  cumulativeSeconds += shot.durationSeconds;
  const endFrame = secondsToFrame(cumulativeSeconds);
  shotFrameOffsets.push(startFrame);
  shotFrameDurations.push(endFrame - startFrame);
}
const TOTAL_FRAMES = secondsToFrame(cumulativeSeconds);

// Pre-compute phase runs: consecutive shots sharing the same scenePhase
// get a single continuous frame range for smooth camera movement.
const phaseRunStartFrame: number[] = new Array(shots.length);
const phaseRunTotalFrames: number[] = new Array(shots.length);
{
  let runStart = 0;
  let runPhase: string | null = shots[0].scenePhase || "car-lot";
  for (let i = 0; i <= shots.length; i++) {
    const curPhase = i < shots.length ? (shots[i].scenePhase || "car-lot") : null;
    if (curPhase !== runPhase) {
      // End of run [runStart..i-1] — fill in values
      const totalFrames =
        shotFrameOffsets[i - 1] + shotFrameDurations[i - 1] - shotFrameOffsets[runStart];
      for (let j = runStart; j < i; j++) {
        phaseRunStartFrame[j] = shotFrameOffsets[runStart];
        phaseRunTotalFrames[j] = totalFrames;
      }
      runStart = i;
      runPhase = curPhase;
    }
  }
}

const useSafeCaptions = (path: string): Caption[] => {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [handle] = useState(() => delayRender("Loading captions"));

  useEffect(() => {
    fetch(staticFile(path))
      .then((r) => r.json())
      .then((data: Caption[]) => {
        if (Array.isArray(data)) setCaptions(data);
        continueRender(handle);
      })
      .catch(() => {
        continueRender(handle);
      });
  }, [path, handle]);

  return captions;
};

// Error boundary — isolates 3D crashes so voice audio keeps playing
class Scene3DErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; errorFrame: number }
> {
  state = { hasError: false, errorFrame: -1 };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("[Scene3D] Caught error:", error.message);
  }
  render() {
    if (this.state.hasError) {
      // Reset on next render cycle so 3D recovers after one dropped frame
      requestAnimationFrame(() => this.setState({ hasError: false }));
      return null;
    }
    return this.props.children;
  }
}

// Single persistent 3D scene — avoids 22 WebGL context create/destroy cycles
const PersistentScene3D: React.FC = () => {
  const globalFrame = useCurrentFrame();

  // Find which shot is active at the current global frame
  let shotIdx = shots.length - 1;
  for (let i = 0; i < shots.length - 1; i++) {
    if (globalFrame < shotFrameOffsets[i + 1]) {
      shotIdx = i;
      break;
    }
  }

  const shot = shots[shotIdx];
  const localFrame = globalFrame - shotFrameOffsets[shotIdx];
  const shotDuration = shotFrameDurations[shotIdx];
  const phase = shot.scenePhase || "car-lot";

  // Continuous phase timing — camera uses these instead of per-shot timing
  const phaseFrame = globalFrame - phaseRunStartFrame[shotIdx];
  const phaseDuration = phaseRunTotalFrames[shotIdx];

  return (
    <TradingJourney3D
      phase={phase}
      overrideFrame={localFrame}
      overrideDuration={shotDuration}
      phaseFrame={phaseFrame}
      phaseDurationFrames={phaseDuration}
    />
  );
};

// Persistent phase label — scramble text overlay in top-left for company names
const PersistentPhaseLabel: React.FC = () => {
  const globalFrame = useCurrentFrame();

  let shotIdx = shots.length - 1;
  for (let i = 0; i < shots.length - 1; i++) {
    if (globalFrame < shotFrameOffsets[i + 1]) {
      shotIdx = i;
      break;
    }
  }

  const shot = shots[shotIdx];
  const localFrame = globalFrame - shotFrameOffsets[shotIdx];
  const phase = shot.scenePhase || "car-lot";

  return (
    <PhaseLabel
      phase={phase}
      localFrame={localFrame}
      shotDurationFrames={shotFrameDurations[shotIdx]}
    />
  );
};

// Voice volume compensation — recording gets quieter toward the end.
// Ramp up progressively to keep perceived loudness constant.
//
// Breakpoints (in seconds → volume multiplier):
//   0-35s:  1.0  (opening through bitcoin — voice is strong)
//   35-55s: 1.0 → 1.4  (Goldman through memecoins — starts dropping)
//   55-75s: 1.4 → 1.9  (polymarket through defeat — noticeably quieter)
//   75-90s: 1.9 → 2.5  (return + ending — quietest, needs biggest boost)
const VOICE_RAMP: [number, number][] = [
  [0, 1.0],
  [35, 1.0],
  [55, 1.4],
  [75, 1.9],
  [90, 2.5],
];

// Quantize to 0.05 steps so FFmpeg gets ~30 unique volume values
// instead of 2700 (one per frame), avoiding nested-if overflow.
function voiceVolumeAtFrame(f: number): number {
  const sec = f / 30;
  let raw = VOICE_RAMP[VOICE_RAMP.length - 1][1];
  for (let i = 0; i < VOICE_RAMP.length - 1; i++) {
    const [s0, v0] = VOICE_RAMP[i];
    const [s1, v1] = VOICE_RAMP[i + 1];
    if (sec >= s0 && sec <= s1) {
      const t = (sec - s0) / (s1 - s0);
      raw = v0 + (v1 - v0) * t;
      break;
    }
  }
  return Math.round(raw * 20) / 20; // snap to 0.05 increments
}

export const StonecutterComposition: React.FC<{
  quality?: QualityMode;
}> = ({ quality = "final" }) => {
  const captions = useSafeCaptions(`${ASSET_DIR}/captions.json`);
  const voiceVolume = useCallback((f: number) => voiceVolumeAtFrame(f), []);

  return (
    <QualityProvider mode={quality}>
    <ShortProvider assetDir={ASSET_DIR}>
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.BG_BASE,
        fontFamily: FONT_FAMILY,
        overflow: "hidden",
      }}
    >
      {/* Persistent 3D scene — single ThreeCanvas for entire video */}
      <Scene3DErrorBoundary>
        <PersistentScene3D />
      </Scene3DErrorBoundary>

      <Series>
        {shots.map((shot, i) => {
          const prevEmotion = i > 0 ? shots[i - 1].chibiEmotion : undefined;
          const nextEmotion = i < shots.length - 1 ? shots[i + 1].chibiEmotion : undefined;
          const prevContinuity = prevEmotion && !shot.chibiEntrance ? prevEmotion : undefined;
          const nextContinuity = nextEmotion && !shots[i + 1]?.chibiEntrance ? nextEmotion : undefined;
          return (
            <Series.Sequence
              key={shot.id}
              durationInFrames={shotFrameDurations[i]}
            >
              <ShotRenderer
                shot={shot}
                captions={captions}
                globalFrameOffset={shotFrameOffsets[i]}
                shotDurationFrames={shotFrameDurations[i]}
                prevShotEmotion={prevContinuity}
                nextShotEmotion={nextContinuity}
              />
            </Series.Sequence>
          );
        })}
      </Series>

      {/* Persistent captions — global overlay for frame-perfect voice sync */}
      <PersistentCaptions
        captions={captions}
        shots={shots}
        shotFrameOffsets={shotFrameOffsets}
        shotFrameDurations={shotFrameDurations}
      />

      {/* Miami scramble text intro — Shot 1 only (frames 0-90) */}
      <Sequence from={0} durationInFrames={90}>
        <MiamiIntro />
      </Sequence>

      {/* Company name scramble text — top-left overlay for robot phases */}
      <PersistentPhaseLabel />

      <Audio src={staticFile(`${ASSET_DIR}/voice.mp3`)} volume={voiceVolume} />
      <MoodMusic baseVolume={0.10} />
      <Ambient
        ambientPath={`${ASSET_DIR}/sfx/city-hum.mp3`}
        muteRanges={[]}
        baseVolume={0.02}
      />

      <Vignette opacity={0.3} spread={50} />
      <FilmGrain opacity={0.02} />
      <ProgressBar color={COLORS.ACCENT_1} height={3} />
    </AbsoluteFill>
    </ShortProvider>
    </QualityProvider>
  );
};

export const short02Meta = {
  id: "Short02-Stonecutter",
  component: StonecutterComposition,
  durationInFrames: TOTAL_FRAMES,
  fps: LAYOUT.FPS as 30,
  width: LAYOUT.WIDTH as 1080,
  height: LAYOUT.HEIGHT as 1920,
};
