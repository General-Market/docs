/**
 * Sequence02 — talking-head layout (from Tutorial) wearing EndCard's finish.
 *
 * Animated rect (centered → left/right → small → banner) holds a clean play
 * of Sequence02.mp4. ASCII border traces the rect. Side-panel cascade text
 * lands on the beat. Green ASCII flash opens. 360° flip reveals GM at the end.
 *
 * Scene timing lives in `scenes.ts` and follows the parakeet transcript.
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AsciiOverlay } from "../endcard/AsciiOverlay";
import { GreenAsciiScreen } from "../endcard/GreenAsciiScreen";
import {
  BOTTOM_LABEL_SPACE,
  CORNER_R,
  findSceneIndex,
  getAnimatedRect,
} from "../endcard/layout";
import { CascadeText } from "../../lib/components/Text";
import { FONT } from "../tutorial/designTokens";
import { SRC, W, toFrames } from "./theme";
import {
  SCENES,
  SIDE_ACCENTS,
  CENTER_CALLOUTS,
  BOTTOM_LABEL_TEXT,
  getContentArea,
} from "./scenes";

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// Green ASCII opener (first ~1.7s)
const GREEN_CUT_IN = 0;
const GREEN_HOLD = 24;
const GREEN_SLIDE_START = GREEN_CUT_IN + GREEN_HOLD;
const GREEN_SLIDE_FRAMES = 28;
const GREEN_CUT_OUT = GREEN_SLIDE_START + GREEN_SLIDE_FRAMES;

// 360° diagonal flip at the centered-bottom → middle-banner handoff
const ROT_START = toFrames(62.0);
const ROT_FRAMES = Math.round(0.8 * 30);

export const Sequence02: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { rect, scene } = getAnimatedRect(SCENES, frame, fps, 20);
  const layout = scene.layout;

  const isGreenVisible = frame >= GREEN_CUT_IN && frame < GREEN_CUT_OUT;
  const greenSlideProgress = interpolate(
    frame,
    [GREEN_SLIDE_START, GREEN_CUT_OUT],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT,
    },
  );

  const rotation = interpolate(
    frame,
    [ROT_START, ROT_START + ROT_FRAMES],
    [0, 360],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const isRotating = frame >= ROT_START && frame <= ROT_START + ROT_FRAMES;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Ambient blurred backdrop — same source, crushed */}
      <AbsoluteFill>
        <Video
          src={staticFile(SRC)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scale(1.15)",
            filter: "blur(56px) brightness(0.32) saturate(1.05)",
          }}
          muted
        />
      </AbsoluteFill>

      {/* Cold-blue scrim over the backdrop */}
      <AbsoluteFill style={{ background: "rgba(0, 14, 30, 0.42)" }} />

      {/* Clean speaker video inside the animated rect */}
      <div
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          borderRadius: CORNER_R,
          overflow: "hidden",
          boxShadow: "0 40px 120px rgba(0, 0, 0, 0.55)",
        }}
      >
        <OffthreadVideo
          src={staticFile(SRC)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* 360° bias-axis flip — front face (video) → back face (GM logo) */}
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
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
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

      {/* ASCII border tracing the animated rect */}
      <AsciiOverlay rect={rect} />

      {/* Side-panel accents — Sequence-wrapped so CascadeText animates from its appearance frame */}
      {SIDE_ACCENTS.map((a, i) => {
        const appearF = toFrames(a.appearSec);
        const duration = toFrames(a.hideSec) - appearF;
        const sceneLayout = SCENES[findSceneIndex(SCENES, a.appearSec)].layout;
        const area = getContentArea(sceneLayout);
        if (!area) return null;

        const paddedW = Math.max(0, area.w - 48);
        const titleSize = a.titleSize ?? (a.title.length > 14 ? 88 : 120);

        return (
          <Sequence
            key={`sa-${i}`}
            from={appearF}
            durationInFrames={duration}
            layout="none"
          >
            <div
              style={{
                position: "absolute",
                left: area.x,
                top: area.y,
                width: area.w,
                height: area.h,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                padding: 24,
                textShadow: "0 2px 24px rgba(0,0,0,0.6)",
              }}
            >
              <CascadeText
                text={a.title}
                maxWidth={paddedW}
                fontFamily={FONT.display}
                fontSize={titleSize}
                fontWeight={800}
                color="#ffffff"
                letterSpacing="-0.02em"
                align="left"
                riseDistance={80}
                blurPx={14}
              />
              {a.sub && (
                <div style={{ marginTop: 28 }}>
                  <CascadeText
                    text={a.sub}
                    maxWidth={paddedW}
                    fontFamily={FONT.body}
                    fontSize={36}
                    fontWeight={800}
                    color="rgba(255,255,255,0.82)"
                    letterSpacing="-0.02em"
                    align="left"
                    riseDistance={80}
                    blurPx={14}
                    startDelay={16}
                  />
                </div>
              )}
            </div>
          </Sequence>
        );
      })}

      {/* Centered callouts — Sequence-wrapped top/bottom banners */}
      {CENTER_CALLOUTS.map((c, i) => {
        const appearF = toFrames(c.appearSec);
        const duration = toFrames(c.hideSec) - appearF;

        const bannerStyle: React.CSSProperties = {
          position: "absolute",
          left: 0,
          width: W,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        };
        if (c.position === "top") bannerStyle.top = 72;
        else bannerStyle.bottom = 72;

        return (
          <Sequence
            key={`cc-${i}`}
            from={appearF}
            durationInFrames={duration}
            layout="none"
          >
            <div style={bannerStyle}>
              <CascadeText
                text={c.text}
                maxWidth={1400}
                fontFamily={FONT.display}
                fontSize={c.size ?? 80}
                fontWeight={800}
                color="#ffffff"
                letterSpacing="-0.02em"
                align="center"
                riseDistance={80}
                blurPx={14}
              />
            </div>
          </Sequence>
        );
      })}

      {/* Centered-bottom label — Sequence-wrapped so CascadeText runs from scene start */}
      {layout === "centered-bottom" && (() => {
        const cbScene = SCENES.find((s) => s.layout === "centered-bottom");
        if (!cbScene) return null;
        const fromF = toFrames(cbScene.startSec);
        const durF = toFrames(cbScene.endSec) - fromF;
        return (
          <Sequence from={fromF} durationInFrames={durF} layout="none">
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
                padding: "0 48px",
                textShadow: "0 2px 16px rgba(0,0,0,0.55)",
              }}
            >
              <CascadeText
                text={BOTTOM_LABEL_TEXT}
                maxWidth={Math.max(600, rect.w - 96)}
                fontFamily={FONT.display}
                fontSize={52}
                fontWeight={800}
                color="#ffffff"
                letterSpacing="-0.02em"
                align="center"
                riseDistance={80}
                blurPx={14}
              />
            </div>
          </Sequence>
        );
      })()}

      {/* Middle-banner — blackout behind GM lockup */}
      {layout === "middle-banner" && (
        <>
          <div
            style={{
              position: "absolute",
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              background: "#0a1a0a",
              borderRadius: CORNER_R,
              boxShadow: "inset 0 0 80px rgba(159,232,112,0.22)",
            }}
          />
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
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <Img
                src={staticFile("gm-logo.svg")}
                style={{ width: 112, height: 112 }}
              />
              <span
                style={{
                  fontFamily: FONT.display,
                  fontSize: 88,
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
        </>
      )}

      {/* Green ASCII opener */}
      {isGreenVisible && <GreenAsciiScreen slideOut={greenSlideProgress} />}
    </AbsoluteFill>
  );
};
