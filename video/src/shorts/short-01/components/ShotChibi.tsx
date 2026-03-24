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
import type { ChibiEmotion, ChibiAnimation, ChibiEntrance } from "../types";
import { emotionToFile, LAYOUT } from "../types";
import { useShortContext } from "../ShortContext";

interface Props {
  emotion: ChibiEmotion;
  animation: ChibiAnimation;
  entrance?: ChibiEntrance;
  delay?: number;
  isFirstShot?: boolean;
}

export const ShotChibi: React.FC<Props> = ({
  emotion,
  animation,
  entrance = "bottom",
  delay = 0,
  isFirstShot = false,
}) => {
  const { assetDir } = useShortContext();
  const chibiDir = `${assetDir}/chibis`;
  const rawFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const file = emotionToFile[emotion];
  const src = staticFile(`${chibiDir}/${file}`);

  if (entrance === "none") return null;

  const frame = Math.max(0, rawFrame - delay);
  if (rawFrame < delay) return null;

  // ── Entrance animation (complex, direction-dependent) ──────────────
  // Main progress spring — overshoots slightly for bounce feel
  const entProg = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 170, mass: 0.8 },
    durationInFrames: 22,
  });

  // Secondary bounce spring — more bouncy for squash/stretch
  const entBounce = spring({
    frame,
    fps,
    config: { damping: 6, stiffness: 250, mass: 0.5 },
    durationInFrames: 25,
  });

  // Entrance position
  let entX = 0;
  let entY = 0;
  let entRotation = 0;
  let entSquashX = 1;
  let entSquashY = 1;

  switch (entrance) {
    case "bottom":
      entY = interpolate(entProg, [0, 1], [400, 0]);
      // Squash on landing
      entSquashX = interpolate(entBounce, [0, 0.7, 0.85, 1], [0.85, 1.15, 0.95, 1]);
      entSquashY = interpolate(entBounce, [0, 0.7, 0.85, 1], [1.1, 0.88, 1.04, 1]);
      entRotation = interpolate(entProg, [0, 0.5, 1], [3, -2, 0]);
      break;
    case "left":
      entX = interpolate(entProg, [0, 1], [-600, 0]);
      entRotation = interpolate(entProg, [0, 0.4, 0.7, 1], [-15, 5, -2, 0]);
      entSquashX = interpolate(entBounce, [0, 0.6, 1], [0.8, 1.1, 1]);
      entSquashY = interpolate(entBounce, [0, 0.6, 1], [1.1, 0.92, 1]);
      break;
    case "right":
      entX = interpolate(entProg, [0, 1], [600, 0]);
      entRotation = interpolate(entProg, [0, 0.4, 0.7, 1], [15, -5, 2, 0]);
      entSquashX = interpolate(entBounce, [0, 0.6, 1], [0.8, 1.1, 1]);
      entSquashY = interpolate(entBounce, [0, 0.6, 1], [1.1, 0.92, 1]);
      break;
    case "top":
      entY = interpolate(entProg, [0, 1], [-500, 0]);
      entRotation = interpolate(entProg, [0, 0.6, 1], [-5, 3, 0]);
      // Stretch on drop then squash on land
      entSquashX = interpolate(entBounce, [0, 0.5, 0.75, 1], [0.9, 0.85, 1.12, 1]);
      entSquashY = interpolate(entBounce, [0, 0.5, 0.75, 1], [1.15, 1.1, 0.9, 1]);
      break;
  }

  const entOpacity = interpolate(entProg, [0, 0.15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // ── Idle breathing (always on, very subtle) ────────────────────────
  const breathePhase = (frame / 80) * Math.PI * 2;
  const breatheY = Math.sin(breathePhase) * -2;
  const breatheScale = 1 + Math.sin(breathePhase) * 0.006;

  // ── Looping animation (starts after entrance) ──────────────────────
  const loopFrame = Math.max(0, frame - 22);
  let animScaleX = 1;
  let animScaleY = 1;
  let animTranslateX = 0;
  let animTranslateY = 0;
  let animRotation = 0;
  let animOpacity = 1;

  switch (animation) {
    case "bounce": {
      // Gentle rhythmic bounce using sine
      const t = (loopFrame / 20) * Math.PI * 2;
      const b = Math.abs(Math.sin(t)) * 0.06;
      animScaleY = 1 + b;
      animScaleX = 1 - b * 0.3;
      animTranslateY = -b * 40;
      break;
    }
    case "snap": {
      // Quick anticipation dip then pop — using spring
      const cycle = loopFrame % 40;
      if (cycle < 20) {
        const s = spring({
          frame: cycle,
          fps,
          config: { damping: 8, stiffness: 300, mass: 0.5 },
          durationInFrames: 15,
        });
        animScaleX = interpolate(s, [0, 0.3, 1], [0.95, 1.08, 1]);
        animScaleY = interpolate(s, [0, 0.3, 1], [1.04, 0.93, 1]);
      }
      break;
    }
    case "punch": {
      // Squash-stretch with forward lean
      const cycle = loopFrame % 30;
      if (cycle < 15) {
        const t = cycle / 15;
        const impact = Math.sin(t * Math.PI);
        animScaleX = 1 - impact * 0.08;
        animScaleY = 1 + impact * 0.1;
        animTranslateY = -impact * 12;
        animRotation = impact * 3;
      }
      break;
    }
    case "zoom": {
      // Breathe zoom with shadow
      const t = (loopFrame / 25) * Math.PI * 2;
      const z = Math.sin(t) * 0.05;
      animScaleX = 1 + z;
      animScaleY = 1 + z;
      break;
    }
    case "tilt": {
      // Smooth head tilt left-right
      const t = (loopFrame / 35) * Math.PI * 2;
      animRotation = Math.sin(t) * 5;
      animTranslateX = Math.sin(t) * 6;
      break;
    }
    case "shake": {
      // Noise-based vibration burst
      const cycle = loopFrame % 35;
      if (cycle < 12) {
        const intensity = interpolate(cycle, [0, 3, 12], [0, 1, 0]);
        animTranslateX = noise2D("sx", loopFrame * 0.5, 0) * 10 * intensity;
        animTranslateY = noise2D("sy", 0, loopFrame * 0.5) * 6 * intensity;
      }
      break;
    }
    case "dim": {
      // Gentle nod with fade
      const t = (loopFrame / 30) * Math.PI * 2;
      animTranslateY = Math.sin(t) * 6;
      animRotation = Math.sin(t * 0.7) * 1.5;
      animOpacity = interpolate(frame, [0, 25], [1, 0.65], {
        extrapolateRight: "clamp",
      });
      break;
    }
    case "idle": {
      // Gentle float hover with subtle sway
      const t = (loopFrame / 32) * Math.PI * 2;
      animTranslateY = Math.sin(t) * -5;
      animRotation = Math.sin(t * 0.6) * 1.8;
      animTranslateX = Math.cos(t * 0.4) * 4;
      break;
    }
    case "wobble": {
      // Jelly wobble
      const t = (loopFrame / 10) * Math.PI * 2;
      const w = Math.sin(t);
      animScaleX = 1 + w * 0.04;
      animScaleY = 1 - w * 0.03;
      animRotation = w * 2;
      break;
    }
    case "heartbeat": {
      // Double-pulse rhythm
      const cycle = loopFrame % 35;
      const p1 = cycle < 8 ? Math.sin((cycle / 8) * Math.PI) : 0;
      const p2 = cycle >= 10 && cycle < 17 ? Math.sin(((cycle - 10) / 7) * Math.PI) * 0.6 : 0;
      const s = 1 + p1 * 0.07 + p2 * 0.05;
      animScaleX = s;
      animScaleY = s;
      break;
    }
    case "drift": {
      // Slow lateral sway
      const t = (loopFrame / 40) * Math.PI * 2;
      animTranslateX = Math.sin(t) * 18;
      animRotation = Math.sin(t) * -2;
      break;
    }
    case "blink": {
      // Quick double-blink opacity
      const cycle = loopFrame % 30;
      if ((cycle >= 6 && cycle < 9) || (cycle >= 11 && cycle < 14)) {
        const bt = cycle >= 11 ? (cycle - 11) / 3 : (cycle - 6) / 3;
        animOpacity = 1 - 0.3 * Math.sin(bt * Math.PI);
      }
      break;
    }
  }

  // ── First shot special entrance ────────────────────────────────────
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

  // ── Compose final transform ────────────────────────────────────────
  const finalX = entX + animTranslateX;
  const finalY = entY + breatheY + animTranslateY + firstShotY;
  const finalScaleX = breatheScale * entSquashX * animScaleX * firstShotScale;
  const finalScaleY = breatheScale * entSquashY * animScaleY * firstShotScale;
  const finalRotation = entRotation + animRotation;
  const finalOpacity = entOpacity * animOpacity * firstShotOpacity;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 0,
        transform: [
          `translateX(calc(-50% + ${finalX}px))`,
          `translateY(${finalY}px)`,
          `scaleX(${finalScaleX})`,
          `scaleY(${finalScaleY})`,
          `rotate(${finalRotation}deg)`,
        ].join(" "),
        transformOrigin: "center bottom",
        opacity: finalOpacity,
        width: LAYOUT.CHIBI_SIZE,
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
          width: LAYOUT.CHIBI_SIZE * 0.35,
          height: 16,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.2)",
          transform: `translateX(-50%) scaleX(${1 + (finalScaleX - 1) * 0.5})`,
          filter: "blur(8px)",
        }}
      />
      <Img
        src={src}
        style={{
          width: "100%",
          height: "auto",
          objectFit: "contain",
        }}
      />
    </div>
  );
};
