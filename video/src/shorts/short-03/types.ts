// Short-03 "Feb New Top 500" — shared types from slots engine

export type {
  ChibiEmotion,
  ChibiAnimation,
  BackgroundType,
  BackgroundDef,
  CaptionMode,
  WordHighlight,
  SFXCue,
  TransitionIn,
  DataCalloutDef,
  ChibiEntrance,
  ChibiEntranceVfx,
  ChibiExitStyle,
  ChibiZoomDrift,
  FullScreenZoom,
  CameraTilt,
  CameraDrift,
  CameraVerticalDrift,
  LetterboxDef,
  FocusPull,
  ColorShift,
  ChibiExpression,
  ChibiRainCloud,
  AnimatedBgVariant,
  ShotVfxVariant,
  ShotDef,
  SilenceWindow,
  VoiceSegment,
  ArchitectureDiagramConfig,
  ArchDiagramNode,
  ArchDiagramEdge,
  ArchDiagramTiming,
} from "../../slots/types";

export { LAYOUT, emotionToFile } from "../../slots/types";

// Short-03 color palette (from direction.json)
export const COLORS = {
  BG_BASE: "#0A0A0A",
  TEXT_PRIMARY: "#FFFFFF",
  MONEY_YELLOW: "#FFE500",
  PAIN_RED: "#FF3333",
  GROWTH_GREEN: "#00FF88",
  ACCENT_BLUE: "#00D4FF",
  WARN_ORANGE: "#FF8800",
  FAVORITE_GOLD: "#FFD700",
} as const;
