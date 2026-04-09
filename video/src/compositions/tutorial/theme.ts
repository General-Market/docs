import { C } from "../../common/colors";

export const FPS = 30;
export const TOTAL_FRAMES = 8487; // 282.88s * 30

/** Brand green used across GM-specific overlay elements */
export const BRAND_GREEN = "#00C853";
/** Frontend CSS brand */
export const BRAND = "#00A36C";

/** All section timings in seconds. Convert with Math.round(s * FPS). */
export const SECTIONS = {
  hookOverlays: { start: 0, end: 42.8 },
  claudeTerminal: { start: 42.8, end: 57.76 },
  botArchDiagram: { start: 42.8, end: 57.8 },
  liquidityDiagram: { start: 48.64, end: 89.84 },
  settlementTimeline: { start: 89.84, end: 161.4 },
  privacySplit: { start: 161.4, end: 194.04 },
  moatTimeline: { start: 194.04, end: 247.44 },
  sourcesClosing: { start: 247.44, end: 282.88 },
  sourcesDiagrams: { start: 247.44, end: 271.0 },
  closingDiagrams: { start: 271.0, end: 282.88 },
  promiseChecklist: { start: 0, end: 282.88 },
  subtitleLayer: { start: 0, end: 282.88 },
} as const;

export type SectionKey = keyof typeof SECTIONS;

/** Seconds to Remotion frames */
export const toFrames = (seconds: number): number => Math.round(seconds * FPS);

/** Duration in frames for a given section */
export const sectionFrames = (key: SectionKey) => {
  const s = SECTIONS[key];
  return toFrames(s.end - s.start);
};

/** Start frame for a given section */
export const sectionStart = (key: SectionKey) => toFrames(SECTIONS[key].start);

/** Re-exported color tokens */
export const COLORS = {
  ...C,
  brandGreen: BRAND_GREEN,
  brand: BRAND,
} as const;

/** Standard dark overlay panel styles */
export const PANEL = {
  background: "rgba(10, 10, 10, 0.85)",
  borderRadius: 12,
} as const;
