// Short 04 — "Terrain Walker"
// Character walks forward on deforming snow terrain
// with floating rectangular props drifting through the air.
// Based on short-02 engine architecture.

import React, { Component, useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { Vignette } from "../../lib/components/Overlays/Vignette";
import { FilmGrain } from "../../lib/components/Overlays/FilmGrain";
import { ProgressBar } from "../../lib/components/Overlays/ProgressBar";
import { secondsToFrame } from "../../lib/utils/frameConvert";

import { ShortProvider } from "./ShortContext";
import { ShotRenderer } from "./components/ShotRenderer";
import { TerrainWalker3D } from "./components/TerrainWalker3D";
import { shots } from "./shots";
import { LAYOUT, COLORS } from "./types";

const ASSET_DIR = "shorts/short-04";

// Pre-compute frame offsets from cumulative seconds to avoid rounding drift.
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

// Pre-compute phase runs
const phaseRunStartFrame: number[] = new Array(shots.length);
const phaseRunTotalFrames: number[] = new Array(shots.length);
{
  let runStart = 0;
  let runPhase: string | null = shots[0].scenePhase || "walk";
  for (let i = 0; i <= shots.length; i++) {
    const curPhase =
      i < shots.length ? shots[i].scenePhase || "walk" : null;
    if (curPhase !== runPhase) {
      const totalFrames =
        shotFrameOffsets[i - 1] +
        shotFrameDurations[i - 1] -
        shotFrameOffsets[runStart];
      for (let j = runStart; j < i; j++) {
        phaseRunStartFrame[j] = shotFrameOffsets[runStart];
        phaseRunTotalFrames[j] = totalFrames;
      }
      runStart = i;
      runPhase = curPhase;
    }
  }
}

// Error boundary — isolates 3D crashes
class Scene3DErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("[Scene3D] Caught error:", error.message);
  }
  render() {
    if (this.state.hasError) {
      requestAnimationFrame(() => this.setState({ hasError: false }));
      return null;
    }
    return this.props.children;
  }
}

// Single persistent 3D scene
const PersistentScene3D: React.FC = () => {
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
  const shotDuration = shotFrameDurations[shotIdx];
  const phase = shot.scenePhase || "walk";

  const phaseFrame = globalFrame - phaseRunStartFrame[shotIdx];
  const phaseDuration = phaseRunTotalFrames[shotIdx];

  return (
    <TerrainWalker3D
      phase={phase}
      overrideFrame={localFrame}
      overrideDuration={shotDuration}
      phaseFrame={phaseFrame}
      phaseDurationFrames={phaseDuration}
    />
  );
};

// Walk cycle footstep timing: character starts at 1s delay, walk animation
// from mixamo has ~0.4s per step (left-right alternation).
// Each Sequence places a footstep crunch at the exact frame.
const WALK_START_SECONDS = 1.0;
const STEP_INTERVAL_SECONDS = 0.42; // ~0.84s full cycle, 2 steps per cycle

const SyncedFootsteps: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const stepFrames = useMemo(() => {
    const frames: number[] = [];
    const startFrame = Math.round(WALK_START_SECONDS * fps);
    const stepFrameInterval = Math.round(STEP_INTERVAL_SECONDS * fps);
    for (let f = startFrame; f < durationInFrames; f += stepFrameInterval) {
      frames.push(f);
    }
    return frames;
  }, [fps, durationInFrames]);

  // Duration of one crunch sound in frames (~0.35s)
  const crunchDuration = Math.round(0.35 * fps);

  return (
    <>
      {stepFrames.map((startFrame, i) => (
        <Sequence key={i} from={startFrame} durationInFrames={crunchDuration}>
          <Audio
            src={staticFile("shorts/short-04/sfx-snow-footsteps.mp3")}
            volume={0.85 + (i % 2) * 0.1}
            playbackRate={0.9 + (i % 3) * 0.1}
          />
        </Sequence>
      ))}
    </>
  );
};

// Small balloon pop SFX — triggered at pseudo-random intervals to match
// icons popping against the character's body. Seeded RNG for determinism.
const PopSfx: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const popFrames = useMemo(() => {
    const frames: number[] = [];
    // Seeded RNG so pops are deterministic across renders
    let seed = 42;
    const rng = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return seed / 2147483647;
    };
    // Character starts moving at 1s. Icons begin popping ~2s in.
    const startFrame = Math.round(2.0 * fps);
    // Average ~0.6s between pops, with ±0.3s jitter
    let f = startFrame;
    while (f < durationInFrames) {
      frames.push(f);
      f += Math.round((0.4 + rng() * 0.5) * fps);
    }
    return frames;
  }, [fps, durationInFrames]);

  const popDuration = Math.round(0.25 * fps);

  return (
    <>
      {popFrames.map((startFrame, i) => (
        <Sequence key={i} from={startFrame} durationInFrames={popDuration}>
          <Audio
            src={staticFile("sfx/balloon-pop.mp3")}
            volume={0.06 + (i % 3) * 0.02}
            playbackRate={0.9 + (i % 4) * 0.1}
          />
        </Sequence>
      ))}
    </>
  );
};

export const Short04Composition: React.FC = () => {
  return (
    <ShortProvider assetDir={ASSET_DIR}>
      <AbsoluteFill
        style={{
          backgroundColor: COLORS.BG_BASE,
          overflow: "hidden",
        }}
      >
        {/* Persistent 3D scene */}
        <Scene3DErrorBoundary>
          <PersistentScene3D />
        </Scene3DErrorBoundary>

        {/* Shot overlays */}
        <Series>
          {shots.map((shot, i) => (
            <Series.Sequence
              key={shot.id}
              durationInFrames={shotFrameDurations[i]}
            >
              <ShotRenderer
                shot={shot}
                globalFrameOffset={shotFrameOffsets[i]}
                shotDurationFrames={shotFrameDurations[i]}
              />
            </Series.Sequence>
          ))}
        </Series>

        {/* SFX — blizzard wind ambient (looping) */}
        <Audio
          src={staticFile("shorts/short-04/sfx-blizzard-wind.mp3")}
          volume={0.3}
          loop
        />
        {/* SFX — footsteps synced to walk cycle */}
        <SyncedFootsteps />
        {/* SFX — small balloon pops when icons hit character */}
        <PopSfx />

        {/* Post-processing overlays */}
        <Vignette opacity={0.35} spread={50} />
        <FilmGrain opacity={0.02} />
        <ProgressBar color={COLORS.ACCENT_2} height={3} />
      </AbsoluteFill>
    </ShortProvider>
  );
};

export const short04Meta = {
  id: "Short04-TerrainWalker",
  component: Short04Composition,
  durationInFrames: TOTAL_FRAMES,
  fps: LAYOUT.FPS as 30,
  width: LAYOUT.WIDTH as 1080,
  height: LAYOUT.HEIGHT as 1920,
};
