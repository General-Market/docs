/**
 * EndCardShader — B-roll rendered through a halftone dot-matrix shader.
 * Cascade text, rotating GM card, and bottom/banner labels are preserved;
 * the ASCII overlays from the original EndCard are removed.
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CascadeText } from "../../lib/components/Text";
import { FONT } from "../tutorial/designTokens";
import { FPS } from "./theme";
import {
  BOTTOM_LABEL_SPACE,
  CORNER_R,
  getAnimatedRect,
  type Scene,
} from "./layout";
import { HalftoneVideo } from "./HalftoneVideo";

const BROLL_VIDEO = "broll/mountains-aerial.mp4";

const SCENES: Scene[] = [
  { startSec: 0, endSec: 2.0, layout: "centered" },
  { startSec: 2.0, endSec: 4.0, layout: "left-medium" },
  { startSec: 4.0, endSec: 6.0, layout: "right-medium" },
  { startSec: 6.0, endSec: 8.0, layout: "left-small" },
  { startSec: 8.0, endSec: 10.0, layout: "right-small" },
  { startSec: 10.0, endSec: 13.0, layout: "centered-bottom" },
  { startSec: 13.0, endSec: 15.0, layout: "middle-banner" },
];

const ROT_START = Math.round(12.0 * FPS);
const ROT_FRAMES = Math.round(1.0 * FPS);

export const EndCardShader: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { rect, scene } = getAnimatedRect(SCENES, frame, fps);
  const layout = scene.layout;

  const rotation = interpolate(
    frame,
    [ROT_START, ROT_START + ROT_FRAMES],
    [0, 360],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const isRotating = frame >= ROT_START && frame <= ROT_START + ROT_FRAMES;

  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      {/* Halftone-shaded B-roll — uniform dots, color driven by luminance */}
      <HalftoneVideo
        src={staticFile(BROLL_VIDEO)}
        playbackRate={0.25}
        dotSize={10}
        dotFill={0.85}
        contrast={1.4}
        dotTint={[0.55, 0.85, 0.95]}
        bgColor={[0.012, 0.045, 0.075]}
      />

      {/* Color wash over the animated center rectangle */}
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
            riseDistance={70}
            blurPx={12}
          />
        </div>
      )}

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

    </AbsoluteFill>
  );
};
