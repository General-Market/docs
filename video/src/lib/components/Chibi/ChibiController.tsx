import React from "react";
import { Img, useCurrentFrame, staticFile } from "remotion";
import type { Emotion, Segment } from "../../types";
import { msToFrame } from "../../utils/frameConvert";
import { ChibiIdle } from "./ChibiIdle";
import { ChibiEntrance } from "./ChibiEntrance";
import { ChibiBeatPulse } from "./ChibiBeatPulse";
import { ChibiShadow } from "./ChibiShadow";

interface Props {
  chibiDir: string;
  segments: Segment[];
  beatFrames: number[];
  fps?: number;
  size?: number;
  bottomY?: number;
}

const emotionToFile: Record<Emotion, string> = {
  neutral: "neutral.png",
  excited: "excited.png",
  confused: "confused.png",
  panicking: "panicking.png",
  happy: "happy.png",
  sad: "sad.png",
  angry: "angry.png",
};

const getEmotionAtFrame = (
  frame: number,
  segments: Segment[],
  fps: number,
): Emotion => {
  for (const seg of segments) {
    if (frame >= msToFrame(seg.startMs, fps) && frame < msToFrame(seg.endMs, fps)) {
      return seg.emotion;
    }
  }
  return "neutral";
};

export const ChibiController: React.FC<Props> = ({
  chibiDir,
  segments,
  beatFrames,
  fps = 30,
  size = 500,
  bottomY = 1000,
}) => {
  const frame = useCurrentFrame();
  const emotion = getEmotionAtFrame(frame, segments, fps);
  const file = emotionToFile[emotion] ?? "neutral.png";
  const src = staticFile(`${chibiDir}/${file}`);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: bottomY,
        transform: "translateX(-50%)",
        width: size,
        height: size,
      }}
    >
      <ChibiShadow width={size * 0.6} />
      <ChibiEntrance startFrame={6} durationFrames={12}>
        <ChibiBeatPulse beatFrames={beatFrames}>
          <ChibiIdle>
            <Img
              src={src}
              style={{ width: size, height: "auto", objectFit: "contain" }}
            />
          </ChibiIdle>
        </ChibiBeatPulse>
      </ChibiEntrance>
    </div>
  );
};
