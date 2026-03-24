import type { Segment, MusicAnalysis } from "../types";
import { secondsToFrame, msToFrame } from "../utils/frameConvert";
import type { ShakeEvent } from "../components/Effects/ScreenShake";
import type { ZoomEvent } from "../components/Effects/ZoomPulse";
import type { FlashEvent } from "../components/Effects/FlashImpact";
import type { EmojiEvent } from "../components/Effects/EmojiRain";
import type { SpeedLineEvent } from "../components/Effects/SpeedLines";
import type { SFXEvent } from "../components/Audio/SFXTrigger";

export interface CompiledEffects {
  shakeEvents: ShakeEvent[];
  zoomEvents: ZoomEvent[];
  flashEvents: FlashEvent[];
  emojiEvents: EmojiEvent[];
  speedLineEvents: SpeedLineEvent[];
  sfxEvents: SFXEvent[];
}

/**
 * Cross-references segments + beats + energy + keywords to produce
 * a complete effect event list — the "brain" of the composition.
 */
export const compileEffectEvents = (
  segments: Segment[],
  analysis: MusicAnalysis | null,
  fps = 30,
): CompiledEffects => {
  const shakeEvents: ShakeEvent[] = [];
  const zoomEvents: ZoomEvent[] = [];
  const flashEvents: FlashEvent[] = [];
  const emojiEvents: EmojiEvent[] = [];
  const speedLineEvents: SpeedLineEvent[] = [];
  const sfxEvents: SFXEvent[] = [];

  const peakFrames = (analysis?.energy_peaks ?? []).map((t) =>
    secondsToFrame(t, fps),
  );
  // Segment transitions
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const frame = msToFrame(seg.startMs, fps);

    switch (seg.transition) {
      case "flash-cut":
        flashEvents.push({ frame, duration: 3, maxOpacity: 0.7 });
        shakeEvents.push({ frame, amplitude: 10, duration: 8 });
        sfxEvents.push({ frame, file: "impact.wav", volume: 0.7 });
        break;
      case "whoosh-slide":
        sfxEvents.push({ frame: frame - 2, file: "whoosh.wav", volume: 0.5 });
        break;
      case "zoom-out":
        zoomEvents.push({ frame, intensity: 0.12, duration: 12 });
        break;
      case "cross-fade":
        // Subtle, no extra effects
        break;
    }

    // Zoom pulse on segment entrances
    if (!seg.transition || seg.transition === "cross-fade") {
      zoomEvents.push({ frame, intensity: 0.06, duration: 12 });
    }
  }

  // Punchline effects
  for (const seg of segments) {
    if (seg.isPunchline) {
      const frame = msToFrame(seg.startMs, fps);
      shakeEvents.push({ frame, amplitude: 8, duration: 12 });
      sfxEvents.push({ frame, file: "impact.wav", volume: 0.5 });
    }
  }

  // Energy peak effects
  for (const peakFrame of peakFrames) {
    // Avoid doubling up with segment transitions (within 10 frames)
    const nearTransition = segments.some(
      (s) => Math.abs(msToFrame(s.startMs, fps) - peakFrame) < 10,
    );
    if (!nearTransition) {
      zoomEvents.push({ frame: peakFrame, intensity: 0.08, duration: 15 });
      shakeEvents.push({ frame: peakFrame, amplitude: 6, duration: 10 });
    }
  }

  // Excited/hyped segments get emoji rain
  for (const seg of segments) {
    if (
      seg.energyLevel > 0.7 &&
      (seg.emotion === "excited" || seg.emotion === "happy")
    ) {
      const mid = msToFrame((seg.startMs + seg.endMs) / 2, fps);
      emojiEvents.push({ frame: mid, count: 12, duration: 30 });
    }
  }

  // Speed lines on dramatic peaks
  for (const peakFrame of peakFrames) {
    // Only every other peak to avoid overuse
    if (peakFrame % 2 === 0) {
      speedLineEvents.push({ frame: peakFrame, duration: 20 });
    }
  }

  // Keyword pop SFX (sparkle on first keyword of each segment)
  for (const seg of segments) {
    if (seg.keywords.length > 0) {
      const frame = msToFrame(seg.startMs, fps) + 10;
      sfxEvents.push({ frame, file: "sparkle.wav", volume: 0.3 });
    }
  }

  return {
    shakeEvents,
    zoomEvents,
    flashEvents,
    emojiEvents,
    speedLineEvents,
    sfxEvents,
  };
};
