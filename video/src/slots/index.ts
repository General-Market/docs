// Slot barrel export — 12 slots + CameraSlot + ShotFrame + types + hooks

export { BackgroundSlot } from "./BackgroundSlot";
export { ChibiSlot } from "./ChibiSlot";
export { CalloutSlot } from "./CalloutSlot";
export { DiagramSlot } from "./DiagramSlot";
export { DataCardSlot } from "./DataCardSlot";
export { BrollSlot } from "./BrollSlot";
export { StablecoinSlot } from "./StablecoinSlot";
export { ShowcaseSlot } from "./ShowcaseSlot";
export { LogosSlot } from "./LogosSlot";
export { LetterboxSlot } from "./LetterboxSlot";
export { TransitionSlot } from "./TransitionSlot";
export { SFXSlot } from "./SFXSlot";
export { CameraSlot } from "./CameraSlot";
export type { CameraSlotProps } from "./CameraSlot";
export { ShotFrame } from "./ShotFrame";
export type { ShotFrameProps } from "./ShotFrame";

// Types
export type {
  ShotDef,
  SlotProps,
  BackgroundDef,
  BackgroundType,
  ChibiEmotion,
  ChibiAnimation,
  ChibiEntrance,
  ChibiEntranceVfx,
  ChibiExitStyle,
  ChibiZoomDrift,
  ChibiExpression,
  ChibiRainCloud,
  CaptionMode,
  WordHighlight,
  SFXCue,
  TransitionIn,
  DataCalloutDef,
  FullScreenZoom,
  CameraTilt,
  CameraDrift,
  CameraVerticalDrift,
  LetterboxDef,
  FocusPull,
  ColorShift,
  AnimatedBgVariant,
  ShotVfxVariant,
  SilenceWindow,
  VoiceSegment,
  ArchitectureDiagramConfig,
  ArchDiagramNode,
  ArchDiagramEdge,
  ArchDiagramTiming,
} from "./types";

export { emotionToFile, COLORS, LAYOUT } from "./types";

// Context
export { SlotProvider, useSlotContext } from "./SlotContext";

// Hooks
export { useSafeCaptions } from "./hooks/useSafeCaptions";
