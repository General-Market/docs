/**
 * EndCard — B-roll with animated center rectangle (7 scene layouts).
 *
 * Scene flow with spring transitions between layouts:
 *   centered → left-medium → right-medium → left-small → right-small
 *   → centered-bottom (GM label below) → middle-banner (full-width horizontal strip)
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AsciiOverlay } from "./AsciiOverlay";
import { GreenAsciiScreen } from "./GreenAsciiScreen";
import { CascadeText } from "../../lib/components/Text";
import { FONT } from "../tutorial/designTokens";
import { FPS } from "./theme";
import {
  BOTTOM_LABEL_SPACE,
  CORNER_R,
  getAnimatedRect,
  type Scene,
} from "./layout";

const BROLL_VIDEO = "broll/mountains-aerial.mp4";
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** 7 scenes with spring transitions (a 360-rotation runs during 12–13s) */
const SCENES: Scene[] = [
  { startSec: 0, endSec: 2.0, layout: "centered" },
  { startSec: 2.0, endSec: 4.0, layout: "left-medium" },
  { startSec: 4.0, endSec: 6.0, layout: "right-medium" },
  { startSec: 6.0, endSec: 8.0, layout: "left-small" },
  { startSec: 8.0, endSec: 10.0, layout: "right-small" },
  { startSec: 10.0, endSec: 13.0, layout: "centered-bottom" },
  { startSec: 13.0, endSec: 15.0, layout: "middle-banner" },
];

/** 360-degree Y-axis rotation of the center content — 12s → 13s */
const ROT_START = Math.round(12.0 * FPS);
const ROT_FRAMES = Math.round(1.0 * FPS);

/** Green ASCII opener — holds briefly then slides up to reveal scene 1 */
const GREEN_CUT_IN = 0;
const GREEN_HOLD = 30;
const GREEN_SLIDE_START = GREEN_CUT_IN + GREEN_HOLD;
const GREEN_SLIDE_FRAMES = 30;
const GREEN_CUT_OUT = GREEN_SLIDE_START + GREEN_SLIDE_FRAMES;


export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { rect, scene } = getAnimatedRect(SCENES, frame, fps);
  const layout = scene.layout;

  // Green flash state
  const isGreenVisible = frame >= GREEN_CUT_IN && frame < GREEN_CUT_OUT;
  const greenSlideProgress = interpolate(
    frame,
    [GREEN_SLIDE_START, GREEN_CUT_OUT],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT },
  );

  // 360° rotation of the center screen content — diagonal (bias) axis
  // Linear easing so the full turn is visible end-to-end.
  const rotation = interpolate(
    frame,
    [ROT_START, ROT_START + ROT_FRAMES],
    [0, 360],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const isRotating = frame >= ROT_START && frame <= ROT_START + ROT_FRAMES;

  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      {/* Full-frame B-roll */}
      <AbsoluteFill>
        <Video
          src={staticFile(BROLL_VIDEO)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loop
          volume={0}
          playbackRate={0.25}
        />
      </AbsoluteFill>

      {/* Color layer over the animated center rectangle */}
      <div
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          borderRadius: CORNER_R,
          background: "rgba(0, 20, 40, 0.18)",
        }}
      />

      {/* 360° bias-axis rotation — front face (normal content) + back face (GM card)
          Axis (1, -1, 0) runs diagonally from bottom-left to top-right corner */}
      {isRotating && (
        <div
          style={{
            position: "absolute",
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            perspective: "2500px",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              transformStyle: "preserve-3d",
              transform: `rotate3d(1, -1, 0, ${rotation}deg)`,
            }}
          >
            {/* Back face — dark + GM logo (visible 90°–270°) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: CORNER_R,
                background: "#0a1a0a",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotate3d(1, -1, 0, 180deg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxShadow: "inset 0 0 80px rgba(159,232,112,0.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                }}
              >
                <Img
                  src={staticFile("gm-logo.svg")}
                  style={{ width: 96, height: 96 }}
                />
                <span
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 72,
                    fontWeight: 800,
                    color: "#ffffff",
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                  }}
                >
                  General Market
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASCII border — dynamically clipped to the animated rect */}
      <AsciiOverlay rect={rect} />

      {/* Centered cascade text — hidden on centered-bottom & middle-banner */}
      {layout !== "centered-bottom" && layout !== "middle-banner" && (
        <div
          style={{
            position: "absolute",
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textShadow: "0 2px 24px rgba(0,0,0,0.5)",
          }}
        >
          <CascadeText
            text="and launched to trade every market"
            maxWidth={540}
            fontFamily={FONT.display}
            fontSize={68}
            fontWeight={700}
            color="#ffffff"
            letterSpacing="-0.02em"
            align="center"
            delayPerWord={3}
            durationPerWord={22}
            fallDistance={70}
            driftDistance={26}
            tiltDeg={2}
          />
        </div>
      )}

      {/* centered-bottom: "General Market" label below the rect */}
      {layout === "centered-bottom" && (
        <div
          style={{
            position: "absolute",
            left: rect.x,
            top: rect.y + rect.h,
            width: rect.w,
            height: BOTTOM_LABEL_SPACE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 56,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              textShadow: "0 2px 16px rgba(0,0,0,0.5)",
            }}
          >
            General Market
          </span>
        </div>
      )}

      {/* middle-banner: GM logo + text inside the banner */}
      {layout === "middle-banner" && (
        <div
          style={{
            position: "absolute",
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Img
              src={staticFile("gm-logo.svg")}
              style={{ width: 96, height: 96 }}
            />
            <span
              style={{
                fontFamily: FONT.display,
                fontSize: 80,
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.02em",
                textShadow: "0 2px 16px rgba(0,0,0,0.5)",
                lineHeight: 1,
              }}
            >
              General Market
            </span>
          </div>
        </div>
      )}

      {/* Green ASCII flash */}
      {isGreenVisible && <GreenAsciiScreen slideOut={greenSlideProgress} />}
    </AbsoluteFill>
  );
};
