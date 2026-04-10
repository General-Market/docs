/**
 * TalkingHeadLayout — animated split-screen webcam wrapper.
 *
 * 6 layout types: centered, centered-bottom, left/right-medium, left/right-small.
 * Webcam rect spring-animates between layouts. No cuts.
 * Content (titles, pills, images) fades in with a slide.
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, TYPE } from "./designTokens";
import { SCENES, TalkingHeadScene, WebcamLayout } from "./talkingHeadScenes";

const MAIN_VIDEO = "tutorial-raw.mp4";
const TRANSITION_FRAMES = 18;
const CONTENT_DELAY = 4;
const CONTENT_FADE_FRAMES = 12;

// ── Geometry ────────────────────────────────────────────────────────────────

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const M = 48;

const H = 1080 - 2 * M; // consistent height across all layouts

const WEBCAM_RECTS: Record<WebcamLayout, Rect> = {
  "centered":        { x: 100,              y: M, w: 1720,        h: H },
  "centered-bottom": { x: 100,              y: M, w: 1720,        h: H - 160 },
  "left-medium":     { x: M,                y: M, w: 800,         h: H },
  "right-medium":    { x: 1920 - M - 800,   y: M, w: 800,         h: H },
  "left-small":      { x: M,                y: M, w: 540,         h: H },
  "right-small":     { x: 1920 - M - 540,   y: M, w: 540,         h: H },
};

interface ContentArea {
  x: number;
  y: number;
  w: number;
  h: number;
  slideDir: "left" | "right" | "up" | "none";
}

const G = 32; // gap between webcam and content

const CONTENT_AREAS: Partial<Record<WebcamLayout, ContentArea>> = {
  "left-medium":     { x: M + 800 + G,   y: M,              w: 1920 - M - 800 - G - M, h: H,   slideDir: "left" },
  "right-medium":    { x: M,              y: M,              w: 1920 - M - 800 - G - M, h: H,   slideDir: "right" },
  "left-small":      { x: M + 540 + G,   y: M,              w: 1920 - M - 540 - G - M, h: H,   slideDir: "left" },
  "right-small":     { x: M,              y: M,              w: 1920 - M - 540 - G - M, h: H,   slideDir: "right" },
  "centered-bottom": { x: 100,            y: M + H - 160 + 16, w: 1720,                h: 140, slideDir: "up" },
};

function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

// ── Scene lookup ────────────────────────────────────────────────────────────

function findScene(sec: number): { scene: TalkingHeadScene; index: number } | null {
  for (let i = 0; i < SCENES.length; i++) {
    if (sec >= SCENES[i].startSec && sec < SCENES[i].endSec) {
      return { scene: SCENES[i], index: i };
    }
  }
  // Clamp to last scene if past end
  if (SCENES.length > 0 && sec >= SCENES[SCENES.length - 1].endSec) {
    return { scene: SCENES[SCENES.length - 1], index: SCENES.length - 1 };
  }
  return null;
}

// ── Content panel ───────────────────────────────────────────────────────────

const SceneContent: React.FC<{
  scene: TalkingHeadScene;
  area: ContentArea;
  opacity: number;
}> = ({ scene, area, opacity }) => {
  const isBig = scene.layout === "left-small" || scene.layout === "right-small";
  const isBottom = scene.layout === "centered-bottom";

  // Slide offset
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

// ── Main layout ─────────────────────────────────────────────────────────────

export const TalkingHeadLayout: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSec = frame / fps;

  const result = findScene(currentSec);
  if (!result) return null;

  const { scene, index } = result;
  const prevScene = index > 0 ? SCENES[index - 1] : null;

  const sceneStartFrame = Math.round(scene.startSec * fps);
  const framesIntoScene = frame - sceneStartFrame;

  // ── Webcam rect: spring from previous position ──

  const targetRect = WEBCAM_RECTS[scene.layout];
  let webcamRect = targetRect;

  if (prevScene && framesIntoScene < TRANSITION_FRAMES) {
    const prevRect = WEBCAM_RECTS[prevScene.layout];
    const t = spring({
      frame: framesIntoScene,
      fps,
      config: { damping: 200 },
      durationInFrames: TRANSITION_FRAMES,
    });
    webcamRect = lerpRect(prevRect, targetRect, t);
  }

  // ── Content opacity ──

  const contentArea = CONTENT_AREAS[scene.layout];
  const hasContent =
    contentArea &&
    (scene.title || scene.pills || scene.bottomLabel || scene.image);

  const contentOpacity = hasContent
    ? interpolate(
        framesIntoScene,
        [CONTENT_DELAY, CONTENT_DELAY + CONTENT_FADE_FRAMES],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;

  // ── Border radius scales with webcam size ──

  const borderRadius = interpolate(
    webcamRect.w,
    [540, 1720],
    [24, 20],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      {/* Webcam */}
      <div
        style={{
          position: "absolute",
          left: webcamRect.x,
          top: webcamRect.y,
          width: webcamRect.w,
          height: webcamRect.h,
          borderRadius,
          overflow: "hidden",
          border: `1px solid ${COLOR.border}`,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <Video
          src={staticFile(MAIN_VIDEO)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Content */}
      {hasContent && contentArea && (
        <SceneContent
          scene={scene}
          area={contentArea}
          opacity={contentOpacity}
        />
      )}
    </AbsoluteFill>
  );
};
