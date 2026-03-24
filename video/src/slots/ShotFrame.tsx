import React from "react";
import type { Caption } from "../lib/types";
import type { ShotDef, SlotProps, VoiceSegment } from "./types";
import { CameraSlot } from "./CameraSlot";

export interface ShotFrameProps {
  shot: ShotDef;
  slots: React.FC<SlotProps>[];
  globalFrameOffset: number;
  captions?: Caption[];
  prevShotEmotion?: string;
  nextShotEmotion?: string;
  prevProjectTicker?: string;
  voiceSegments?: VoiceSegment[];
  bgColor?: string;
}

export const ShotFrame: React.FC<ShotFrameProps> = ({
  shot,
  slots,
  globalFrameOffset,
  captions,
  prevShotEmotion,
  nextShotEmotion,
  prevProjectTicker,
  voiceSegments,
  bgColor,
}) => {
  const slotProps: SlotProps = {
    shot,
    globalFrameOffset,
    captions,
    prevShotEmotion,
    nextShotEmotion,
    prevProjectTicker,
    voiceSegments,
  };

  return (
    <CameraSlot shot={shot} bgColor={bgColor}>
      {slots.map((Slot, i) => (
        <Slot key={i} {...slotProps} />
      ))}
    </CameraSlot>
  );
};
