import React, { createContext, useContext, useMemo } from "react";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import {
  localFrameToVoiceFrame,
  segmentsToFrames,
} from "../../utils/voiceMapping";

// ── Types ────────────────────────────────────────────────────────────

type AudioRole = "sfx" | "music";

interface VoiceSegment {
  startMs: number;
  endMs: number;
}

interface AudioEngineContextValue {
  /** Raw voice loudness at a composition frame (0-1). */
  getVoiceLoudness: (compositionFrame: number) => number;
  /** Auto-level a base volume by role at a given composition frame. */
  autoLevel: (
    role: AudioRole,
    baseVol: number,
    compositionFrame: number,
  ) => number;
}

// ── Context ──────────────────────────────────────────────────────────

const AudioEngineContext = createContext<AudioEngineContextValue | null>(null);

/**
 * Consumer hook. Returns null when no AudioEngineProvider is in the tree,
 * allowing backward-compatible fallback in SFXTrigger / MoodMusic.
 */
export const useAudioEngine = (): AudioEngineContextValue | null =>
  useContext(AudioEngineContext);

// ── Provider ─────────────────────────────────────────────────────────

interface AudioEngineProviderProps {
  voiceSrc: string;
  totalFrames: number;
  fps: number;
  shots: { voiceSegments?: VoiceSegment[] }[];
  shotFrameOffsets: number[];
  children: React.ReactNode;
}

export const AudioEngineProvider: React.FC<AudioEngineProviderProps> = ({
  voiceSrc,
  totalFrames,
  fps,
  shots,
  shotFrameOffsets,
  children,
}) => {
  const audioData = useAudioData(voiceSrc);

  // Pre-compute loudness curve: one RMS value per composition frame.
  const loudnessCurve = useMemo(() => {
    if (!audioData) return null;

    const curve = new Float32Array(totalFrames);

    // Per-shot audio frame counts (voice portion only, excludes buffer)
    const shotAudioFrames = shots.map((s) =>
      s.voiceSegments ? segmentsToFrames(s.voiceSegments, fps) : 0,
    );

    for (let compFrame = 0; compFrame < totalFrames; compFrame++) {
      // Find which shot this composition frame belongs to
      let shotIdx = 0;
      for (let i = shotFrameOffsets.length - 1; i >= 0; i--) {
        if (compFrame >= shotFrameOffsets[i]) {
          shotIdx = i;
          break;
        }
      }

      const localFrame = compFrame - shotFrameOffsets[shotIdx];
      const segments = shots[shotIdx].voiceSegments;

      // In buffer zone between shots or no voice segments → silence
      if (!segments || localFrame >= shotAudioFrames[shotIdx]) {
        curve[compFrame] = 0;
        continue;
      }

      // Map shot-local frame to voice.mp3 absolute frame
      const voiceFrame = localFrameToVoiceFrame(localFrame, segments, fps);

      const visualization = visualizeAudio({
        fps,
        frame: voiceFrame,
        audioData,
        numberOfSamples: 64,
      });

      // RMS across frequency bins
      const raw = Math.sqrt(
        visualization.reduce((sum, v) => sum + v * v, 0) /
          visualization.length,
      );

      // Gate silence, compress — same formula proven in VoiceSyncChibi
      const gated = raw < 0.01 ? 0 : raw;
      curve[compFrame] = Math.min(1, Math.pow(gated * 3.5, 0.85));
    }

    // ── Sidechain envelopes ──────────────────────────────────────────
    // SFX curve: attack/release only (no lookahead — SFX are point events synced to visuals).
    // Music curve: lookahead + attack/release (pre-duck before voice arrives).
    const LOOKAHEAD = 5; // frames (~167ms) — music pre-duck
    const ATTACK = 0.35; // per frame — fast duck
    const RELEASE = 0.06; // per frame — slow release (~1.3s full recovery)

    // SFX envelope: smooth the raw curve (no lookahead)
    const sfxEnv = new Float32Array(totalFrames);
    let env = 0;
    for (let i = 0; i < totalFrames; i++) {
      const target = curve[i];
      if (target > env) {
        env += (target - env) * ATTACK;
      } else {
        env += (target - env) * RELEASE;
      }
      sfxEnv[i] = env;
    }

    // Music envelope: apply lookahead first, then smooth
    const musicEnv = new Float32Array(totalFrames);
    // Pass 1: Lookahead — at each frame, take max of current and next LOOKAHEAD frames
    for (let i = totalFrames - 1; i >= 0; i--) {
      let peak = curve[i];
      for (let j = 1; j <= LOOKAHEAD && i + j < totalFrames; j++) {
        peak = Math.max(peak, curve[i + j]);
      }
      musicEnv[i] = peak;
    }
    // Pass 2: Attack/Release smoothing
    env = 0;
    for (let i = 0; i < totalFrames; i++) {
      const target = musicEnv[i];
      if (target > env) {
        env += (target - env) * ATTACK;
      } else {
        env += (target - env) * RELEASE;
      }
      musicEnv[i] = env;
    }

    return { sfxEnv, musicEnv };
  }, [audioData, totalFrames, fps, shots, shotFrameOffsets]);

  // ── Context value ────────────────────────────────────────────────

  const value = useMemo<AudioEngineContextValue>(
    () => ({
      getVoiceLoudness: (compositionFrame: number) => {
        if (!loudnessCurve) return 0;
        const idx = Math.round(
          Math.max(0, Math.min(compositionFrame, loudnessCurve.sfxEnv.length - 1)),
        );
        return loudnessCurve.sfxEnv[idx];
      },

      autoLevel: (
        role: AudioRole,
        baseVol: number,
        compositionFrame: number,
      ) => {
        if (!loudnessCurve) return baseVol;

        if (role === "sfx") {
          const idx = Math.round(
            Math.max(0, Math.min(compositionFrame, loudnessCurve.sfxEnv.length - 1)),
          );
          const loudness = loudnessCurve.sfxEnv[idx];
          // Voice silent → 100% baseVol; voice loud → 8% baseVol
          return baseVol * (1 - loudness * 0.92);
        }

        // Music uses lookahead envelope (pre-ducks before voice arrives)
        const idx = Math.round(
          Math.max(0, Math.min(compositionFrame, loudnessCurve.musicEnv.length - 1)),
        );
        const loudness = loudnessCurve.musicEnv[idx];
        // Voice silent → 1.0x baseVol; voice loud → 5% baseVol
        const musicMult = 1.0 + (0.05 - 1.0) * loudness;
        return Math.min(baseVol * 1.5, Math.max(0, baseVol * musicMult));
      },
    }),
    [loudnessCurve],
  );

  return (
    <AudioEngineContext.Provider value={value}>
      {children}
    </AudioEngineContext.Provider>
  );
};
