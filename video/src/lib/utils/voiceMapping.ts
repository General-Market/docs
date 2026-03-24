import type { Caption } from "../types/caption";
import { msToFrame } from "./frameConvert";

interface VoiceSegment {
  startMs: number;
  endMs: number;
}

/**
 * Total duration of voice segments in seconds.
 */
export const segmentsDurationSec = (segments: VoiceSegment[]): number =>
  segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0) / 1000;

/**
 * Total duration of voice segments in frames using endpoint subtraction.
 * Computes msToFrame(endMs) - msToFrame(startMs) per segment so that
 * adjacent shots share exact frame boundaries (no 1-frame gaps/overlaps).
 */
export const segmentsToFrames = (segments: VoiceSegment[], fps: number): number =>
  segments.reduce((sum, seg) => {
    const s = msToFrame(seg.startMs, fps);
    const e = msToFrame(seg.endMs, fps);
    return sum + (e - s);
  }, 0);

/**
 * Map a local frame (within a shot) to the corresponding voice.mp3 frame,
 * accounting for gaps between segments (cuts).
 *
 * Uses endpoint subtraction for segment frame counts to stay consistent
 * with segmentsToFrames and ShotVoice rendering.
 */
export const localFrameToVoiceFrame = (
  localFrame: number,
  segments: VoiceSegment[],
  fps: number,
): number => {
  let framesCounted = 0;
  for (const seg of segments) {
    const segFrames = msToFrame(seg.endMs, fps) - msToFrame(seg.startMs, fps);
    if (localFrame < framesCounted + segFrames) {
      const frameInSeg = localFrame - framesCounted;
      const msInSeg = (frameInSeg / fps) * 1000;
      return Math.round(((seg.startMs + msInSeg) / 1000) * fps);
    }
    framesCounted += segFrames;
  }
  // Past all segments — clamp to end of last segment
  const last = segments[segments.length - 1];
  return msToFrame(last.endMs, fps);
};

/**
 * Remap captions from voice-absolute timestamps to composition-absolute timestamps.
 *
 * Each shot defines which slices of voice.mp3 it uses (voiceSegments).
 * Captions that fall inside a segment get remapped to the composition timeline;
 * captions in gaps between segments (cut regions) are excluded.
 *
 * @param shotBufferMs - Per-shot buffer durations in ms (added after each shot's segments).
 *   Seamless shots have 0ms buffer; gapped shots have SCENE_BUFFER converted to ms.
 */
export const remapCaptions = (
  captions: Caption[],
  allShotSegments: VoiceSegment[][],
  shotBufferMs?: number[],
  fps = 30,
): Caption[] => {
  const remapped: Caption[] = [];
  let offsetFrames = 0; // accumulate in frames, not ms

  for (let shotIdx = 0; shotIdx < allShotSegments.length; shotIdx++) {
    for (const seg of allShotSegments[shotIdx]) {
      // Use exact same math as segmentsToFrames / shotFrameOffsets
      const segStartF = msToFrame(seg.startMs, fps);
      const segEndF = msToFrame(seg.endMs, fps);
      const segFrames = segEndF - segStartF;

      for (const cap of captions) {
        if (cap.startMs >= seg.startMs && cap.startMs < seg.endMs) {
          // Convert caption position to frames relative to segment start
          const capRelF = msToFrame(cap.startMs, fps) - segStartF;
          const capEndRelF = Math.min(msToFrame(cap.endMs, fps) - segStartF, segFrames);

          // Convert back to ms from frame-aligned position
          const newStartMs = ((offsetFrames + capRelF) / fps) * 1000;
          const newEndMs = ((offsetFrames + capEndRelF) / fps) * 1000;

          remapped.push({ ...cap, startMs: newStartMs, endMs: newEndMs, timestampMs: newStartMs });
        }
      }
      offsetFrames += segFrames;
    }

    // Buffer: convert ms→frames→ms (same rounding as composition)
    if (shotBufferMs?.[shotIdx]) {
      offsetFrames += msToFrame(shotBufferMs[shotIdx], fps);
    }
  }

  return remapped;
};
