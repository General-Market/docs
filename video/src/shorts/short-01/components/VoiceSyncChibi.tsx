import React from "react";
import {
  Img,
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import type {
  ChibiEmotion,
  ChibiAnimation,
  ChibiEntrance,
  ChibiEntranceVfx,
  ChibiExitStyle,
  ChibiZoomDrift,
  ChibiRainCloud,
  ChibiExpression,
  VoiceSegment,
} from "../types";
import { emotionToFile } from "../types";
import { localFrameToVoiceFrame } from "../../../lib/utils/voiceMapping";
import { useShortContext } from "../ShortContext";
import { EntranceVfx, RainCloud, ExitPoof } from "./ChibiVfx";
import { useLayout } from "../../../engine/FormatContext";

interface Props {
  emotion: ChibiEmotion;
  animation: ChibiAnimation;
  entrance?: ChibiEntrance;
  delay?: number;
  isFirstShot?: boolean;
  globalFrameOffset: number;
  // New: chibi VFX system
  shotDurationFrames: number;
  entranceVfx?: ChibiEntranceVfx;
  exitStyle?: ChibiExitStyle;
  zoomDrift?: ChibiZoomDrift;
  rainCloud?: ChibiRainCloud;
  /** Multi-expression sequence (overrides emotion) */
  expressions?: ChibiExpression[];
  /** Mirror chibi horizontally */
  flipY?: boolean;
  /** Previous shot emotion — skip entrance if same (continuity) */
  prevShotEmotion?: string;
  /** Next shot emotion — skip exit if same (continuity) */
  nextShotEmotion?: string;
  /** Per-shot voice segments for correct audio position mapping through cuts */
  voiceSegments?: VoiceSegment[];
}

const ENTRANCE_FRAMES = 22;
const EXIT_FRAMES = 10;

// Per-emotion sizing derived from actual PNG content bounds (ImageMagick trim).
const CHIBI_METRICS: Record<ChibiEmotion, { size: number; bottomPad: number }> = {
  confident:  { size: 1055, bottomPad: 89 },
  confused:   { size: 1060, bottomPad: 91 },
  idea:       { size: 890,  bottomPad: 0 },
  panic:      { size: 866,  bottomPad: 0 },
  proud:      { size: 1060, bottomPad: 103 },
  scared:     { size: 887,  bottomPad: 0 },
  shrug:      { size: 1050, bottomPad: 143 },
  teaching:   { size: 1047, bottomPad: 90 },
  thinking:   { size: 915,  bottomPad: 0 },
  thumbsup:   { size: 875,  bottomPad: 0 },
  tired:      { size: 1050, bottomPad: 120 },
};

/** Resolve "auto" exit to a concrete style */
const resolveExit = (style: ChibiExitStyle | undefined): Exclude<ChibiExitStyle, "auto"> => {
  const s = style ?? "auto";
  return s === "auto" ? "fade" : s;
};

export const VoiceSyncChibi: React.FC<Props> = ({
  emotion,
  animation,
  entrance = "bottom",
  delay = 0,
  isFirstShot = false,
  globalFrameOffset,
  shotDurationFrames,
  entranceVfx,
  exitStyle,
  zoomDrift,
  rainCloud,
  expressions,
  flipY,
  prevShotEmotion,
  nextShotEmotion,
  voiceSegments,
}) => {
  const { assetDir } = useShortContext();
  const chibiDir = `${assetDir}/chibis`;
  const rawFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = useLayout();
  const sizeRatio = layout.chibiSize / 1600;
  const audioData = useAudioData(staticFile(`${assetDir}/voice.mp3`));

  // ── Multi-expression: resolve current emotion from expressions array ──
  let currentEmotion = emotion;
  if (expressions && expressions.length > 0) {
    // Find the last expression whose atFrame <= current frame
    for (let i = expressions.length - 1; i >= 0; i--) {
      if (rawFrame >= expressions[i].atFrame) {
        currentEmotion = expressions[i].emotion;
        break;
      }
    }
  }

  const file = emotionToFile[currentEmotion];
  const src = staticFile(`${chibiDir}/${file}`);

  // ── Continuity: skip entrance if same character continues from prev shot ──
  const isContinuation = prevShotEmotion === emotion && !isFirstShot;
  // ── Continuity: skip exit if same character continues into next shot ──
  const continuesNext = nextShotEmotion === emotion;

  if (entrance === "none") return null;

  const frame = Math.max(0, rawFrame - delay);
  if (rawFrame < delay) return null;

  // Global frame for matching against caption timestamps
  const globalFrame = rawFrame + globalFrameOffset;

  // Voice frame: maps local frame to correct position in voice.mp3 through segment cuts.
  const voiceFrame = voiceSegments
    ? localFrameToVoiceFrame(rawFrame, voiceSegments, fps)
    : globalFrame;

  // Per-emotion sizing (uses currentEmotion for multi-expression support)
  const metrics = CHIBI_METRICS[currentEmotion];
  const chibiSize = Math.round(metrics.size * sizeRatio);
  const bottomPadY = Math.round(metrics.bottomPad * sizeRatio);

  // Resolved VFX types
  const effectiveExit = resolveExit(exitStyle);

  // ── Entrance animation ───────────────────────────────────────────
  let entX = 0;
  let entY = 0;
  let entRotation = 0;
  let entSquashX = 1;
  let entSquashY = 1;
  let entOpacity = 1;

  if (isContinuation) {
    // Same character continues — no entrance animation, instantly visible
    entOpacity = 1;
  } else {
    const entProg = spring({
      frame,
      fps,
      config: { damping: 12, stiffness: 170, mass: 0.8 },
      durationInFrames: ENTRANCE_FRAMES,
    });

    const entBounce = spring({
      frame,
      fps,
      config: { damping: 6, stiffness: 250, mass: 0.5 },
      durationInFrames: 25,
    });

    switch (entrance) {
      case "bottom":
        entY = interpolate(entProg, [0, 1], [layout.entranceBottom, 0]);
        entSquashX = interpolate(entBounce, [0, 0.7, 0.85, 1], [0.85, 1.15, 0.95, 1]);
        entSquashY = interpolate(entBounce, [0, 0.7, 0.85, 1], [1.1, 0.88, 1.04, 1]);
        entRotation = interpolate(entProg, [0, 0.5, 1], [3, -2, 0]);
        break;
      case "left":
        entX = interpolate(entProg, [0, 1], [-layout.entranceLeftRight, 0]);
        entRotation = interpolate(entProg, [0, 0.4, 0.7, 1], [-15, 5, -2, 0]);
        entSquashX = interpolate(entBounce, [0, 0.6, 1], [0.8, 1.1, 1]);
        entSquashY = interpolate(entBounce, [0, 0.6, 1], [1.1, 0.92, 1]);
        break;
      case "right":
        entX = interpolate(entProg, [0, 1], [layout.entranceLeftRight, 0]);
        entRotation = interpolate(entProg, [0, 0.4, 0.7, 1], [15, -5, 2, 0]);
        entSquashX = interpolate(entBounce, [0, 0.6, 1], [0.8, 1.1, 1]);
        entSquashY = interpolate(entBounce, [0, 0.6, 1], [1.1, 0.92, 1]);
        break;
      case "top":
        entY = interpolate(entProg, [0, 1], [-layout.entranceBottom, 0]);
        entRotation = interpolate(entProg, [0, 0.6, 1], [-5, 3, 0]);
        entSquashX = interpolate(entBounce, [0, 0.5, 0.75, 1], [0.9, 0.85, 1.12, 1]);
        entSquashY = interpolate(entBounce, [0, 0.5, 0.75, 1], [1.15, 1.1, 0.9, 1]);
        break;
    }

    entOpacity = interpolate(entProg, [0, 0.15], [0, 1], {
      extrapolateRight: "clamp",
    });
  }

  // ── Exit animation ───────────────────────────────────────────────
  // Frames relative to shot start (not delayed frame)
  const exitStart = shotDurationFrames - EXIT_FRAMES - delay;
  // Skip exit if same character continues into next shot
  const isExiting = !continuesNext && effectiveExit !== "none" && frame >= exitStart && exitStart > ENTRANCE_FRAMES;
  let exitScaleX = 1;
  let exitScaleY = 1;
  let exitOpacity = 1;
  let exitX = 0;
  let exitY = 0;
  let exitRotation = 0;

  if (isExiting) {
    const exitProgress = interpolate(frame, [exitStart, exitStart + EXIT_FRAMES], [0, 1], {
      extrapolateRight: "clamp",
    });

    switch (effectiveExit) {
      case "fade":
        exitScaleX = interpolate(exitProgress, [0, 1], [1, 0.88]);
        exitScaleY = interpolate(exitProgress, [0, 1], [1, 0.88]);
        exitOpacity = interpolate(exitProgress, [0, 1], [1, 0]);
        break;

      case "snap-vanish": {
        // Quick squash Y to 0 with slight horizontal stretch
        exitScaleY = interpolate(exitProgress, [0, 0.25, 1], [1, 1.08, 0]);
        exitScaleX = interpolate(exitProgress, [0, 0.25, 1], [1, 1.15, 1.3]);
        exitOpacity = interpolate(exitProgress, [0, 0.7, 1], [1, 1, 0]);
        break;
      }

      case "poof":
        exitScaleX = interpolate(exitProgress, [0, 0.4, 1], [1, 1.12, 0.3]);
        exitScaleY = interpolate(exitProgress, [0, 0.4, 1], [1, 1.12, 0.3]);
        exitOpacity = interpolate(exitProgress, [0, 0.5, 1], [1, 0.7, 0]);
        break;

      case "slide-out": {
        const slideOutDist = entrance === "left" || entrance === "right" ? 600 : 400;
        const dir =
          entrance === "left" ? -1 :
          entrance === "right" ? 1 :
          entrance === "top" ? -1 : 1; // bottom → slide down

        if (entrance === "left" || entrance === "right") {
          exitX = interpolate(exitProgress, [0, 1], [0, dir * slideOutDist]);
        } else {
          exitY = interpolate(exitProgress, [0, 1], [0, dir * slideOutDist]);
        }
        exitRotation = interpolate(exitProgress, [0, 1], [0, dir * 8]);
        exitOpacity = interpolate(exitProgress, [0.6, 1], [1, 0], {
          extrapolateLeft: "clamp",
        });
        break;
      }
    }
  }

  // ── Idle breathing (always on, very subtle) ────────────────────────
  const breathePhase = (frame / 80) * Math.PI * 2;
  const breatheY = Math.sin(breathePhase) * -2;
  const breatheScale = 1 + Math.sin(breathePhase) * 0.006;

  // ── Zoom drift (persistent slow zoom/dezoom) ─────────────────────
  let zoomDriftScale = 1;
  const drift = zoomDrift ?? "none";
  if (drift !== "none" && frame > ENTRANCE_FRAMES) {
    const driftFrame = frame - ENTRANCE_FRAMES;
    // Ease in over 40 frames, then hold
    const target = drift === "zoom-in" ? 1.08 : 0.93;
    zoomDriftScale = interpolate(driftFrame, [0, 40], [1, target], {
      extrapolateRight: "clamp",
    });
  }

  // ── Audio-amplitude-synced animation ──────────────────────────────
  const postEntrance = isContinuation || frame > ENTRANCE_FRAMES;
  let animScaleX = 1;
  let animScaleY = 1;
  let animTranslateX = 0;
  let animTranslateY = 0;
  let animRotation = 0;
  let animOpacity = 1;

  if (postEntrance && !isExiting && audioData) {
    const visualization = visualizeAudio({
      fps,
      frame: voiceFrame,
      audioData,
      numberOfSamples: 64,
    });

    // RMS amplitude across frequency bins
    const raw = Math.sqrt(
      visualization.reduce((sum, v) => sum + v * v, 0) / visualization.length,
    );

    // Noise gate: suppress silence / mic hiss
    const gated = raw < 0.01 ? 0 : raw;

    // Normalize to 0-1 with slight compression for natural response
    const amplitude = Math.min(1, Math.pow(gated * 3.5, 0.85));

    if (amplitude > 0.01) {
      const pulse = amplitude;
      const intensity = 0.5 + amplitude;
      // Smooth directional sway via noise (for tilt/drift/idle)
      const sway = noise2D("sway", voiceFrame * 0.015, 0);

      switch (animation) {
        case "bounce": {
          const b = pulse * 0.06 * intensity;
          animScaleY = 1 + b;
          animScaleX = 1 - b * 0.3;
          animTranslateY = -b * 40;
          break;
        }
        case "snap": {
          animScaleX = 1 + pulse * 0.08 * intensity;
          animScaleY = 1 - pulse * 0.05 * intensity;
          break;
        }
        case "punch": {
          const impact = pulse * intensity;
          animScaleX = 1 - impact * 0.08;
          animScaleY = 1 + impact * 0.1;
          animTranslateY = -impact * 12;
          animRotation = impact * 3;
          break;
        }
        case "zoom": {
          const z = pulse * 0.05 * intensity;
          animScaleX = 1 + z;
          animScaleY = 1 + z;
          break;
        }
        case "tilt": {
          animRotation = pulse * 5 * intensity * sway;
          animTranslateX = pulse * 6 * intensity * sway;
          break;
        }
        case "shake": {
          const si = pulse * intensity;
          animTranslateX = noise2D("sx", voiceFrame * 0.5, 0) * 10 * si;
          animTranslateY = noise2D("sy", 0, voiceFrame * 0.5) * 6 * si;
          break;
        }
        case "dim": {
          animTranslateY = pulse * 6 * intensity;
          animRotation = pulse * 1.5 * intensity;
          animOpacity = 1 - pulse * 0.35;
          break;
        }
        case "idle": {
          animTranslateY = -pulse * 5 * intensity;
          animRotation = pulse * 1.8 * intensity * sway;
          animTranslateX = pulse * 4 * intensity * sway;
          break;
        }
        case "wobble": {
          const w = pulse * intensity;
          animScaleX = 1 + w * 0.04;
          animScaleY = 1 - w * 0.03;
          animRotation = w * 2;
          break;
        }
        case "heartbeat": {
          const s = 1 + pulse * 0.07 * intensity;
          animScaleX = s;
          animScaleY = s;
          break;
        }
        case "drift": {
          animTranslateX = pulse * 18 * intensity * sway;
          animRotation = pulse * -2 * intensity * sway;
          break;
        }
        case "blink": {
          if (pulse > 0.3) {
            animOpacity = 1 - 0.3 * pulse;
          }
          break;
        }
      }
    }
  }

  // ── First shot special entrance ──────────────────────────────────
  let firstShotScale = 1;
  let firstShotY = 0;
  let firstShotOpacity = 1;
  if (isFirstShot) {
    const ent = spring({
      frame,
      fps,
      config: { damping: 9, stiffness: 200, mass: 0.7 },
      durationInFrames: 25,
    });
    firstShotScale = interpolate(ent, [0, 0.5, 0.8, 1], [0.3, 1.1, 0.95, 1]);
    firstShotY = interpolate(ent, [0, 1], [350, 0]);
    firstShotOpacity = interpolate(ent, [0, 0.2], [0, 1], {
      extrapolateRight: "clamp",
    });
  }

  // ── Compose final transform ──────────────────────────────────────
  const flipMultiplier = flipY ? -1 : 1;
  const finalX = entX + animTranslateX + exitX;
  const finalY = entY + breatheY + animTranslateY + firstShotY + bottomPadY + exitY;
  const finalScaleX = breatheScale * entSquashX * animScaleX * firstShotScale * exitScaleX * zoomDriftScale * flipMultiplier;
  const finalScaleY = breatheScale * entSquashY * animScaleY * firstShotScale * exitScaleY * zoomDriftScale;
  const finalRotation = entRotation + animRotation + exitRotation;
  const finalOpacity = entOpacity * animOpacity * firstShotOpacity * exitOpacity;

  return (
    <div
      style={{
        position: "absolute",
        ...(layout.chibiAnchor === "center"
          ? { left: "50%", bottom: 0 }
          : { right: "5%", bottom: 0 }),
        transform: [
          layout.chibiAnchor === "center"
            ? `translateX(calc(-50% + ${finalX}px))`
            : `translateX(${finalX}px)`,
          `translateY(${finalY}px)`,
          `scaleX(${finalScaleX})`,
          `scaleY(${finalScaleY})`,
          `rotate(${finalRotation}deg)`,
        ].join(" "),
        transformOrigin: "center bottom",
        opacity: finalOpacity,
        width: chibiSize,
        zIndex: 10,
        willChange: "transform, opacity",
      }}
    >
      {/* Shadow */}
      <div
        style={{
          position: "absolute",
          bottom: 5,
          left: "50%",
          width: chibiSize * 0.35,
          height: 16,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.2)",
          transform: `translateX(-50%) scaleX(${1 + (finalScaleX - 1) * 0.5})`,
          filter: "blur(8px)",
        }}
      />

      {/* Chibi image */}
      <Img
        src={src}
        style={{
          width: "100%",
          height: "auto",
          objectFit: "contain",
        }}
      />

      {/* Entrance VFX (dust, speed-lines, glow-ring, ghost-trail) */}
      <EntranceVfx
        type={entranceVfx ?? "auto"}
        entrance={entrance}
        landingFrame={ENTRANCE_FRAMES}
        chibiWidth={chibiSize}
      />

      {/* Exit poof particles (only for "poof" exit style) */}
      {effectiveExit === "poof" && isExiting && (
        <ExitPoof triggerFrame={exitStart} chibiWidth={chibiSize} />
      )}

      {/* Rain cloud */}
      {rainCloud && <RainCloud config={rainCloud} chibiWidth={chibiSize} />}
    </div>
  );
};
