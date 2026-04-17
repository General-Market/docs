/**
 * Sequence02Compare — side-by-side A/B for the CinematicWebcam grade.
 *
 * Left half: the source video, untouched (OffthreadVideo during render,
 * Video during preview). Right half: the same source run through the
 * CinematicWebcam grade — ACES + bloom + mild saturation/contrast +
 * grain.
 *
 * Same audio track plays once (on the right column — anywhere is fine).
 * A thin divider marks the split. Labels sit in the lower third of each
 * column so they don't cover the face.
 */

import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Video,
  staticFile,
  useRemotionEnvironment,
} from "remotion";
import { SRC, W, H } from "./theme";
import { CinematicWebcam } from "./CinematicWebcam";
import { FONT } from "../tutorial/designTokens";

const COL_W = W / 2;
const COL_H = H;

const RawVideo: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const env = useRemotionEnvironment();
  const resolved = staticFile(SRC);
  const style: React.CSSProperties = {
    width,
    height,
    objectFit: "cover",
  };
  return env.isRendering ? (
    <OffthreadVideo src={resolved} style={style} muted />
  ) : (
    <Video src={resolved} style={style} muted />
  );
};

const Label: React.FC<{ text: string; accent?: string }> = ({
  text,
  accent = "rgba(255,255,255,0.9)",
}) => (
  <div
    style={{
      position: "absolute",
      left: 32,
      bottom: 32,
      padding: "10px 18px",
      borderRadius: 12,
      background: "rgba(10, 10, 10, 0.72)",
      border: `1px solid ${accent}`,
      fontFamily: FONT.display,
      fontWeight: 800,
      fontSize: 26,
      letterSpacing: "0.24em",
      textTransform: "uppercase",
      color: accent,
      textShadow: "0 2px 8px rgba(0,0,0,0.5)",
    }}
  >
    {text}
  </div>
);

export const Sequence02Compare: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Shared voice track */}
      <Video
        src={staticFile(SRC)}
        style={{
          position: "absolute",
          opacity: 0,
          width: 1,
          height: 1,
          pointerEvents: "none",
        }}
      />

      {/* Left — raw */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: COL_W,
          height: COL_H,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <RawVideo width={COL_W} height={COL_H} />
        <Label text="Raw" accent="rgba(255,255,255,0.85)" />
      </div>

      {/* Right — cinematic */}
      <div
        style={{
          position: "absolute",
          left: COL_W,
          top: 0,
          width: COL_W,
          height: COL_H,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <CinematicWebcam
          src={SRC}
          width={COL_W}
          height={COL_H}
          zoom={1.0}
        />
        <Label text="Cinematic" accent="#9fe870" />
      </div>

      {/* Centre divider */}
      <div
        style={{
          position: "absolute",
          left: COL_W - 1,
          top: 0,
          width: 2,
          height: COL_H,
          background: "rgba(255,255,255,0.25)",
          boxShadow: "0 0 24px rgba(0,0,0,0.6)",
        }}
      />
    </AbsoluteFill>
  );
};
