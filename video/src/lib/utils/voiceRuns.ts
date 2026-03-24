/**
 * voiceRuns — Shared continuous-run voice engine.
 *
 * Auto-detects seamless vs gapped shot boundaries and computes
 * continuous voice runs that eliminate audio decoder boundary clicks.
 *
 * Usage in any composition:
 *
 *   import { buildVoiceTimeline } from "../../lib/utils/voiceRuns";
 *
 *   const timeline = buildVoiceTimeline(shots, FPS);
 *   // timeline.voiceRuns      — render one <Audio> per run
 *   // timeline.shotFrameOffsets, shotFrameDurations, shotBuffers
 *   // timeline.totalFrames    — composition duration
 *   // timeline.isSeamless     — per-boundary classification
 *   // timeline.shotBufferMs   — for remapCaptions
 *   // timeline.getRunVolume   — auto-smooth volume function per run
 */

import { secondsToFrame } from "./frameConvert";
import { segmentsToFrames } from "./voiceMapping";

interface VoiceSegment {
  startMs: number;
  endMs: number;
}

interface ShotWithVoice {
  voiceSegments?: VoiceSegment[];
  durationSeconds: number;
}

export interface VoiceRun {
  shotStart: number;
  shotEnd: number;
  compFrom: number;
  compDuration: number;
  voiceStartMs: number;
  voiceEndMs: number;
  hasBuffer: boolean;
  audioFrames: number;
}

export interface VoiceTimeline {
  voiceRuns: VoiceRun[];
  shotFrameOffsets: number[];
  shotFrameDurations: number[];
  shotBuffers: number[];
  shotBufferMs: number[];
  isSeamless: boolean[];
  totalFrames: number;
  /**
   * Auto-smooth volume function for a voice run.
   * - Seamless runs: constant 1 (no fade needed).
   * - Gapped runs: full volume through audio + buffer,
   *   with a 2-frame anti-click at the very end to prevent pops.
   *
   * This preserves natural audio decay (like trailing words)
   * while preventing hard clip pops.
   */
  getRunVolume: (run: VoiceRun) => number | ((f: number) => number);
}

/** Frames of trailing buffer for gapped boundaries (~333ms at 30fps). */
const DEFAULT_SCENE_BUFFER_FRAMES = 10;
/** Anti-click fade at the very end of a buffered run (frames). */
const ANTI_CLICK_FRAMES = 2;

/**
 * Build a complete voice timeline from shot definitions.
 *
 * Auto-detects seamless boundaries (shot N endMs === shot N+1 startMs),
 * computes continuous runs, and provides volume functions that auto-smooth
 * every cut point.
 */
export function buildVoiceTimeline(
  shots: ShotWithVoice[],
  fps: number,
  sceneBufferFrames = DEFAULT_SCENE_BUFFER_FRAMES,
): VoiceTimeline {
  // ── Seamless boundary detection ───────────────────────────────────
  const isSeamless: boolean[] = shots.map((shot, i) => {
    if (i >= shots.length - 1) return false;
    const segs = shot.voiceSegments;
    const lastSeg = segs ? segs[segs.length - 1] : undefined;
    const nextFirstSeg = shots[i + 1].voiceSegments?.[0];
    return !!(lastSeg && nextFirstSeg && lastSeg.endMs === nextFirstSeg.startMs);
  });

  // ── Per-shot frame offsets and durations ───────────────────────────
  const shotFrameOffsets: number[] = [];
  const shotFrameDurations: number[] = [];
  const shotBuffers: number[] = [];
  let cumulativeFrames = 0;

  for (let i = 0; i < shots.length; i++) {
    shotFrameOffsets.push(cumulativeFrames);
    const audioFrames = shots[i].voiceSegments
      ? segmentsToFrames(shots[i].voiceSegments!, fps)
      : secondsToFrame(shots[i].durationSeconds, fps);
    const buffer = isSeamless[i]
      ? 0
      : i < shots.length - 1
        ? sceneBufferFrames
        : 0;
    shotBuffers.push(buffer);
    shotFrameDurations.push(audioFrames + buffer);
    cumulativeFrames += audioFrames + buffer;
  }

  const totalFrames = cumulativeFrames;
  const shotBufferMs = shotBuffers.map((b) => (b / fps) * 1000);

  // ── Continuous voice runs ──────────────────────────────────────────
  const voiceRuns: VoiceRun[] = [];
  let runStart = 0;

  for (let i = 0; i < shots.length; i++) {
    if (!isSeamless[i]) {
      const firstSeg = shots[runStart].voiceSegments![0];
      const lastShot = shots[i];
      const lastSeg = lastShot.voiceSegments![lastShot.voiceSegments!.length - 1];

      const compFrom = shotFrameOffsets[runStart];
      let compDuration = 0;
      let audioFrames = 0;
      for (let j = runStart; j <= i; j++) {
        compDuration += shotFrameDurations[j];
        audioFrames += segmentsToFrames(shots[j].voiceSegments!, fps);
      }

      voiceRuns.push({
        shotStart: runStart,
        shotEnd: i,
        compFrom,
        compDuration,
        voiceStartMs: firstSeg.startMs,
        voiceEndMs: lastSeg.endMs,
        hasBuffer: shotBuffers[i] > 0,
        audioFrames,
      });
      runStart = i + 1;
    }
  }

  // ── Auto-smooth volume function ────────────────────────────────────
  const getRunVolume = (run: VoiceRun): number | ((f: number) => number) => {
    if (!run.hasBuffer) return 1;

    // Gapped run: full volume through audio + buffer.
    // Only a tiny anti-click fade at the very end to prevent
    // the pop when the Sequence element clips the audio stream.
    // The natural decay in the voice.mp3 is preserved at full volume.
    return (f: number) => {
      if (f >= run.compDuration - ANTI_CLICK_FRAMES) {
        return Math.max(0, (run.compDuration - f) / ANTI_CLICK_FRAMES);
      }
      return 1;
    };
  };

  return {
    voiceRuns,
    shotFrameOffsets,
    shotFrameDurations,
    shotBuffers,
    shotBufferMs,
    isSeamless,
    totalFrames,
    getRunVolume,
  };
}
