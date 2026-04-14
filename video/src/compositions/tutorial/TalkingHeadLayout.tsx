/**
 * TalkingHeadLayout — reusable animated split-screen webcam wrapper.
 *
 * Usage:
 *   <TalkingHeadLayout videoSrc="my-video.mp4" scenes={myScenes}>
 *     {overlays that need the side panel}
 *   </TalkingHeadLayout>
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  LAYOUT CONTRACT — READ THIS BEFORE ADDING OVERLAYS    │
 * │                                                         │
 * │  The screen is split: one side is the webcam, the       │
 * │  other side is the CONTENT AREA. All text, diagrams,    │
 * │  cards, and visuals go in the CONTENT AREA — never      │
 * │  on top of the webcam, never fullscreen.                │
 * │                                                         │
 * │  To get the content area bounds for the current frame:  │
 * │                                                         │
 * │    const { contentArea } = useTalkingHead();            │
 * │    // → { x, y, w, h } of the side panel               │
 * │                                                         │
 * │  Or outside the component tree:                         │
 * │                                                         │
 * │    const area = getContentArea(scenes, sec, W, H);      │
 * │                                                         │
 * │  Position your overlay within these bounds:             │
 * │    style={{ position: "absolute",                       │
 * │             left: contentArea.x, top: contentArea.y,    │
 * │             width: contentArea.w, height: contentArea.h │
 * │    }}                                                   │
 * │                                                         │
 * │  When the layout is "centered" or "centered-bottom",    │
 * │  contentArea is null — the webcam fills the frame.      │
 * │  Hide your overlay or render nothing in that case.      │
 * └─────────────────────────────────────────────────────────┘
 *
 * 6 layout types: centered, centered-bottom, left/right-medium, left/right-small.
 * Webcam rect spring-animates between layouts. No cuts.
 * Scenes can use structured content (title/pills/image) or custom React nodes.
 * Dimensions derived from useVideoConfig() — works at any resolution.
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, TYPE } from "./designTokens";

// ── Public types ────────────────────────────────────────────────────────────

export type WebcamLayout =
  | "centered"
  | "centered-bottom"
  | "left-medium"
  | "right-medium"
  | "left-small"
  | "right-small";

export interface TalkingHeadScene {
  startSec: number;
  endSec: number;
  layout: WebcamLayout;
  /** Custom React content for the side panel (overrides structured fields) */
  render?: React.ReactNode;
  /** Big title — supports \n for line breaks */
  title?: string;
  /** 0-indexed line to render in accent color */
  accentLine?: number;
  /** Smaller text below title */
  subtitle?: string;
  /** Pill badges */
  pills?: string[];
  /** staticFile() path for illustration */
  image?: string;
  /** Label below webcam (centered-bottom only) */
  bottomLabel?: string;
  /** Logo image path (centered-bottom only) */
  bottomImage?: string;
}

export interface TalkingHeadLayoutProps {
  /** Video file path (for staticFile) */
  videoSrc: string;
  /** Scene definitions covering the full video duration */
  scenes: TalkingHeadScene[];
  /** Edge margin in px (default: 48) */
  margin?: number;
  /** Gap between webcam and content in px (default: 32) */
  gap?: number;
  /** Transition duration in frames (default: 18) */
  transitionFrames?: number;
  /** Background color (default: COLOR.bg / white) */
  background?: string;
  /** Webcam border radius (default: 24) */
  borderRadius?: number;
  /** Children render on top of everything (overlay layer) */
  children?: React.ReactNode;
}

// ── Context — lets overlays read the current content area ───────────────────

export interface TalkingHeadState {
  /** Bounds of the side panel where content goes. null when centered (no side panel). */
  contentArea: ContentArea | null;
  /** Bounds of the webcam rectangle. */
  webcamRect: Rect;
  /** The active scene definition. */
  scene: TalkingHeadScene;
  /** Frames elapsed since this scene started. */
  framesIntoScene: number;
}

const TalkingHeadContext = React.createContext<TalkingHeadState | null>(null);

/**
 * Read the current content area from inside a TalkingHeadLayout child.
 *
 * Returns the side panel bounds ({ x, y, w, h }) where overlays should
 * position their content — NOT on top of the webcam, NOT fullscreen.
 *
 * Returns null when the layout is "centered" (no side panel available).
 *
 * Usage:
 *   const { contentArea } = useTalkingHead();
 *   if (!contentArea) return null; // centered — nothing to show
 *   return <div style={{ position: "absolute", left: contentArea.x, ... }}>
 */
export function useTalkingHead(): TalkingHeadState {
  const ctx = React.useContext(TalkingHeadContext);
  if (!ctx) {
    throw new Error("useTalkingHead() must be used inside <TalkingHeadLayout>");
  }
  return ctx;
}

// ── Standalone utility — works outside the component tree ───────────────────

/**
 * Get the content area for a given time, without needing React context.
 * Useful for overlays that are siblings of TalkingHeadLayout, not children.
 *
 * Returns { x, y, w, h, slideDir } or null if centered.
 */
export function getContentArea(
  scenes: TalkingHeadScene[],
  sec: number,
  canvasWidth: number,
  canvasHeight: number,
  margin = 48,
  gap = 32,
): ContentArea | null {
  const result = findScene(scenes, sec);
  if (!result) return null;
  const { content } = buildRects(canvasWidth, canvasHeight, margin, gap);
  return content[result.scene.layout] ?? null;
}

// ── Geometry ────────────────────────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ContentArea {
  x: number;
  y: number;
  w: number;
  h: number;
  slideDir: "left" | "right" | "up" | "none";
}

function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

function buildRects(W: number, Hfull: number, m: number, g: number) {
  const h = Hfull - 2 * m;
  const medW = Math.round(W * 0.417); // ~800 at 1920
  const smW = Math.round(W * 0.281);  // ~540 at 1920
  const cInset = Math.round(W * 0.052); // ~100 at 1920
  const cW = W - 2 * cInset;
  const bottomReserve = 160;

  const webcam: Record<WebcamLayout, Rect> = {
    "centered":        { x: cInset,          y: m, w: cW,            h },
    "centered-bottom": { x: cInset,          y: m, w: cW,            h: h - bottomReserve },
    "left-medium":     { x: m,               y: m, w: medW,          h },
    "right-medium":    { x: W - m - medW,    y: m, w: medW,          h },
    "left-small":      { x: m,               y: m, w: smW,           h },
    "right-small":     { x: W - m - smW,     y: m, w: smW,           h },
  };

  const content: Partial<Record<WebcamLayout, ContentArea>> = {
    "left-medium":     { x: m + medW + g, y: m, w: W - m - medW - g - m, h, slideDir: "left" },
    "right-medium":    { x: m,            y: m, w: W - m - medW - g - m, h, slideDir: "right" },
    "left-small":      { x: m + smW + g,  y: m, w: W - m - smW - g - m,  h, slideDir: "left" },
    "right-small":     { x: m,            y: m, w: W - m - smW - g - m,  h, slideDir: "right" },
    "centered-bottom": { x: cInset, y: m + h - bottomReserve + 16, w: cW, h: bottomReserve - 20, slideDir: "up" },
  };

  return { webcam, content };
}

// ── Scene lookup ────────────────────────────────────────────────────────────

function findScene(
  scenes: TalkingHeadScene[],
  sec: number,
): { scene: TalkingHeadScene; index: number } | null {
  for (let i = 0; i < scenes.length; i++) {
    if (sec >= scenes[i].startSec && sec < scenes[i].endSec) {
      return { scene: scenes[i], index: i };
    }
  }
  if (scenes.length > 0 && sec >= scenes[scenes.length - 1].endSec) {
    return { scene: scenes[scenes.length - 1], index: scenes.length - 1 };
  }
  return null;
}

// ── Built-in content renderer ───────────────────────────────────────────────

const DefaultContent: React.FC<{
  scene: TalkingHeadScene;
  area: ContentArea;
  opacity: number;
}> = ({ scene, area, opacity }) => {
  const isBig = scene.layout === "left-small" || scene.layout === "right-small";
  const isBottom = scene.layout === "centered-bottom";

  const slideAmount = 30;
  const translateX =
    area.slideDir === "left"
      ? interpolate(opacity, [0, 1], [slideAmount, 0])
      : area.slideDir === "right"
        ? interpolate(opacity, [0, 1], [-slideAmount, 0])
        : 0;
  const translateY = area.slideDir === "up" ? interpolate(opacity, [0, 1], [20, 0]) : 0;

  if (isBottom) {
    return (
      <div
        style={{
          position: "absolute",
          left: area.x,
          top: area.y,
          width: area.w,
          height: area.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {scene.bottomImage && (
          <Img
            src={staticFile(scene.bottomImage)}
            style={{ height: 40, objectFit: "contain" }}
          />
        )}
        {scene.bottomLabel && (
          <span style={{ ...TYPE.cardTitle, color: COLOR.gray }}>
            {scene.bottomLabel}
          </span>
        )}
      </div>
    );
  }

  // Custom render takes over
  if (scene.render) {
    return (
      <div
        style={{
          position: "absolute",
          left: area.x,
          top: area.y,
          width: area.w,
          height: area.h,
          opacity,
          transform: `translateX(${translateX}px)`,
        }}
      >
        {scene.render}
      </div>
    );
  }

  const titleLines = scene.title?.split("\n") || [];
  const hasContent = titleLines.length > 0 || scene.pills || scene.image;
  if (!hasContent) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: area.x,
        top: area.y,
        width: area.w,
        height: area.h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: isBig ? "0 72px" : "0 56px",
        opacity,
        transform: `translateX(${translateX}px)`,
      }}
    >
      {titleLines.map((line, i) => (
        <div
          key={i}
          style={{
            ...(isBig ? TYPE.displayMega : TYPE.sectionHeading),
            color:
              scene.accentLine === i ? COLOR.wiseGreen : COLOR.nearBlack,
            marginBottom: isBig ? 12 : 8,
          }}
        >
          {line}
        </div>
      ))}

      {scene.subtitle && (
        <div style={{ ...TYPE.body, color: COLOR.gray, marginTop: 16 }}>
          {scene.subtitle}
        </div>
      )}

      {scene.pills && (
        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          {scene.pills.map((pill) => (
            <div
              key={pill}
              style={{
                ...TYPE.bodySemibold,
                background: COLOR.lightMint,
                color: COLOR.darkGreen,
                borderRadius: 9999,
                padding: "12px 28px",
              }}
            >
              {pill}
            </div>
          ))}
        </div>
      )}

      {scene.image && (
        <Img
          src={staticFile(scene.image)}
          style={{
            maxWidth: "80%",
            maxHeight: 300,
            marginTop: 32,
            objectFit: "contain",
          }}
        />
      )}
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

export const TalkingHeadLayout: React.FC<TalkingHeadLayoutProps> = ({
  videoSrc,
  scenes,
  margin: m = 48,
  gap: g = 32,
  transitionFrames = 18,
  background = COLOR.bg,
  borderRadius: brProp = 24,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const currentSec = frame / fps;

  const { webcam: RECTS, content: AREAS } = React.useMemo(
    () => buildRects(W, H, m, g),
    [W, H, m, g],
  );

  const result = findScene(scenes, currentSec);
  if (!result) return null;

  const { scene, index } = result;
  const prevScene = index > 0 ? scenes[index - 1] : null;

  const sceneStartFrame = Math.round(scene.startSec * fps);
  const framesIntoScene = frame - sceneStartFrame;

  // Webcam rect — spring from previous position
  const targetRect = RECTS[scene.layout];
  let webcamRect = targetRect;

  if (prevScene && framesIntoScene < transitionFrames) {
    const prevRect = RECTS[prevScene.layout];
    const t = spring({
      frame: framesIntoScene,
      fps,
      config: { damping: 200 },
      durationInFrames: transitionFrames,
    });
    webcamRect = lerpRect(prevRect, targetRect, t);
  }

  // Content area for this layout (null for centered — no side panel)
  const contentArea = AREAS[scene.layout] ?? null;
  const hasContent =
    contentArea &&
    (scene.title || scene.pills || scene.bottomLabel || scene.image || scene.render);

  const contentOpacity = hasContent
    ? interpolate(
        framesIntoScene,
        [4, 16],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;

  // Border radius — slightly smaller when webcam is large
  const br = interpolate(
    webcamRect.w,
    [RECTS["left-small"].w, RECTS["centered"].w],
    [brProp, brProp - 4],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Context value for child overlays
  const ctxValue = React.useMemo<TalkingHeadState>(
    () => ({ contentArea, webcamRect, scene, framesIntoScene }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentArea?.x, contentArea?.w, webcamRect.x, webcamRect.w, scene.startSec, framesIntoScene],
  );

  return (
    <TalkingHeadContext.Provider value={ctxValue}>
      <AbsoluteFill style={{ background }}>
        <div
          style={{
            position: "absolute",
            left: webcamRect.x,
            top: webcamRect.y,
            width: webcamRect.w,
            height: webcamRect.h,
            borderRadius: br,
            overflow: "hidden",
            border: `1px solid ${COLOR.border}`,
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          }}
        >
          <OffthreadVideo
            src={staticFile(videoSrc)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        {hasContent && contentArea && (
          <DefaultContent
            scene={scene}
            area={contentArea}
            opacity={contentOpacity}
          />
        )}

        {children}
      </AbsoluteFill>
    </TalkingHeadContext.Provider>
  );
};
