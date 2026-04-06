import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

interface Props {
  width: number;
  height: number;
}

type ChibiEmotion =
  | "confident"
  | "teaching"
  | "thumbsup"
  | "thinking"
  | "proud"
  | "shrug"
  | "idea"
  | "panic"
  | "confused"
  | "scared"
  | "tired";

const emotionToFile: Record<ChibiEmotion, string> = {
  confident: "confident.png",
  teaching: "teaching.png",
  thumbsup: "thumbsup.png",
  thinking: "thinking.png",
  proud: "proud.png",
  shrug: "shrug.png",
  idea: "idea.png",
  panic: "panic.png",
  confused: "confused.png",
  scared: "scared.png",
  tired: "tired.png",
};

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

const EMOTION_SEQUENCE: { emotion: ChibiEmotion; durationFrames: number }[] = [
  { emotion: "confident",  durationFrames: 150 },
  { emotion: "teaching",   durationFrames: 120 },
  { emotion: "thumbsup",   durationFrames: 100 },
  { emotion: "thinking",   durationFrames: 130 },
  { emotion: "proud",      durationFrames: 100 },
];

const CHIBI_DIR = "shorts/short-01/chibis";

export const PenthouseChibi: React.FC<Props> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entranceDelay = 30;
  const entranceProgress = spring({
    frame: frame - entranceDelay,
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.8 },
  });

  const chibiScale = interpolate(entranceProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const chibiY = interpolate(entranceProgress, [0, 1], [150, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const entranceBounce = spring({
    frame: frame - entranceDelay,
    fps,
    config: { damping: 6, stiffness: 250, mass: 0.5 },
    durationInFrames: 25,
  });
  const squashX = interpolate(entranceBounce, [0, 0.7, 0.85, 1], [0.85, 1.15, 0.95, 1]);
  const squashY = interpolate(entranceBounce, [0, 0.7, 0.85, 1], [1.1, 0.88, 1.04, 1]);

  // Emotion cycling
  const totalCycleDuration = EMOTION_SEQUENCE.reduce((s, e) => s + e.durationFrames, 0);
  const cycleFrame = frame % totalCycleDuration;

  let currentEmotionIdx = 0;
  let accumulated = 0;
  let emotionLocalFrame = 0;
  for (let i = 0; i < EMOTION_SEQUENCE.length; i++) {
    if (cycleFrame < accumulated + EMOTION_SEQUENCE[i].durationFrames) {
      currentEmotionIdx = i;
      emotionLocalFrame = cycleFrame - accumulated;
      break;
    }
    accumulated += EMOTION_SEQUENCE[i].durationFrames;
  }

  const currentEntry = EMOTION_SEQUENCE[currentEmotionIdx];
  const currentEmotion = currentEntry.emotion;
  const metrics = CHIBI_METRICS[currentEmotion];
  const file = emotionToFile[currentEmotion];
  const src = staticFile(`${CHIBI_DIR}/${file}`);

  const emotionProgress = emotionLocalFrame / currentEntry.durationFrames;
  const transitionOpacity = emotionProgress > 0.85
    ? interpolate(emotionProgress, [0.85, 1], [1, 0.7], { extrapolateRight: "clamp" })
    : 1;

  // Idle breathing
  const breathePhase = (frame / 80) * Math.PI * 2;
  const breatheY = Math.sin(breathePhase) * -2;
  const breatheScale = 1 + Math.sin(breathePhase) * 0.005;
  const bob = Math.sin(frame * 0.04) * 1.5;

  // Landscape: smaller chibi, positioned bottom-right
  const chibiSize = Math.round(height * 0.45);

  if (frame < entranceDelay) return null;

  const finalY = chibiY + breatheY + bob + metrics.bottomPad * (chibiSize / metrics.size) * 0.3;

  return (
    <div
      style={{
        position: "absolute",
        bottom: -10,
        right: width * 0.02,
        width: chibiSize,
        height: chibiSize,
        transform: [
          `translateY(${finalY}px)`,
          `scale(${chibiScale * breatheScale})`,
          `scaleX(${squashX})`,
          `scaleY(${squashY})`,
        ].join(" "),
        transformOrigin: "bottom center",
        opacity: transitionOpacity,
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      {/* Blue glow under chibi */}
      <div
        style={{
          position: "absolute",
          bottom: -10,
          left: "15%",
          width: "70%",
          height: 40,
          background: "radial-gradient(ellipse, rgba(59,130,246,0.15) 0%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(10px)",
        }}
      />

      {/* Shadow */}
      <div
        style={{
          position: "absolute",
          bottom: -5,
          left: "25%",
          width: "50%",
          height: 10,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.3)",
          filter: "blur(6px)",
        }}
      />

      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.6))",
        }}
      />
    </div>
  );
};
