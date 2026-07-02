import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  Easing,
} from "remotion";
import { measureText } from "@remotion/layout-utils";
import { CHUNKS, type Chunk } from "./data";

export const FPS = 30;
export const DURATION = 1252; // 41.73s — matches reference circle1-original.mp4

// ── Measured constants (frame-accurate, from circle1-original.mp4) ──
// Quote typography: cap height 84px, cap tops at y=322 (line 1) / y=454 (line 2),
// baselines 406 / 538 → 132px line advance. Left margin x≈170.
const QUOTE_FONT_SIZE = 118; // cap height 84 / 0.712 (SF Pro cap ratio)
const LINE1_CAP_TOP = 322;
const LINE2_CAP_TOP = 454;
const GREY = "#7a7a7a"; // measured core of unhighlighted words
const BLACK = "#0a0a0a"; // measured core of highlighted words
const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

// Hard cut to white at frame 1189 (measured), endcard logo animates ~1192-1218.
const ENDCARD_START = 1189;

// A single caption chunk: every word absolutely positioned at its measured x,
// coloured black only inside its measured highlight window [b0, b1].
// The reference switches colour in a single frame — no fade (measured:
// trace jumps 129→21 between consecutive frames on every group boundary).
const QuoteChunk: React.FC<{ chunk: Chunk }> = ({ chunk }) => {
  const frame = useCurrentFrame(); // local to the chunk's Sequence
  const absFrame = frame + chunk.start;
  return (
    <>
      {chunk.words.map((w, i) => {
        // Scale each word horizontally so its ink ends exactly where the
        // reference word's measured box ends (per-word width match).
        const natural = measureText({
          text: w.t,
          fontFamily: FONT_STACK,
          fontSize: QUOTE_FONT_SIZE,
          fontWeight: 600,
          letterSpacing: "-0.015em",
        }).width;
        const scaleX = natural > 0 ? w.w / natural : 1;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: w.x,
              // +8 / +9: measured ink-top alignment against the reference
              top: w.line === 0 ? LINE1_CAP_TOP - 18 : LINE2_CAP_TOP - 17,
              fontFamily: FONT_STACK,
              fontSize: QUOTE_FONT_SIZE,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              lineHeight: 1,
              whiteSpace: "pre",
              transform: `scaleX(${scaleX})`,
              transformOrigin: "left top",
              color: absFrame >= w.b0 && absFrame <= w.b1 ? BLACK : GREY,
              textRendering: "geometricPrecision" as const,
            }}
          >
            {w.t}
          </span>
        );
      })}
    </>
  );
};

// Endcard: white background, gradient mark sweeps in with rotation,
// wordmark wipes out to the right while the lockup recenters.
// Final lockup (measured, frame 1250): mark 214px at x=556,y=433;
// wordmark 560px at x=805,y=433.
const Endcard: React.FC = () => {
  const frame = useCurrentFrame(); // local to Sequence start (1189)

  // Mark: fades + rotates in, ~1192-1210 abs (3-21 local)
  const markOpacity = interpolate(frame, [3, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const markRotation = interpolate(frame, [3, 21], [-160, 0], {
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const markScale = interpolate(frame, [3, 21], [0.55, 1], {
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Wordmark wipe: ~1206-1220 abs (17-31 local); lockup recenters in the same window.
  const wipe = interpolate(frame, [17, 31], [0, 1], {
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // While the wordmark is hidden the mark sits at screen centre (960);
  // it slides to its final x (556 + 107 = 663 centre) as the wordmark reveals.
  const markCenterX = interpolate(wipe, [0, 1], [960, 663]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#fdfdfd" }}>
      <Img
        src={staticFile("circle1-assets/endcard-mark.png")}
        style={{
          position: "absolute",
          width: 214,
          height: 214,
          left: markCenterX - 107,
          top: 433,
          opacity: markOpacity,
          transform: `rotate(${markRotation}deg) scale(${markScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: markCenterX + 142, // final: 663+142=805 (measured wordmark x)
          top: 433,
          width: 560,
          height: 214,
          overflow: "hidden",
          opacity: wipe > 0.01 ? 1 : 0,
        }}
      >
        <Img
          src={staticFile("circle1-assets/endcard-wordmark.png")}
          style={{
            width: 560,
            height: 214,
            clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const Circle1Composition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#f2f2f3" }}>
      {/* Static plate: background shapes, header, speaker card (all measured static;
          drift over 41s ≈ film grain only). Built as per-pixel percentile across 59 frames. */}
      <Sequence from={0} durationInFrames={ENDCARD_START}>
        <Img
          src={staticFile("circle1-assets/plate.png")}
          style={{ position: "absolute", width: 1920, height: 1080 }}
        />
      </Sequence>

      {/* Karaoke quote chunks — hard cuts between chunks (measured) */}
      {CHUNKS.map((chunk, i) => (
        <Sequence
          key={i}
          from={chunk.start}
          durationInFrames={chunk.end - chunk.start}
        >
          <QuoteChunk chunk={chunk} />
        </Sequence>
      ))}

      {/* Endcard: hard cut to white at 1189, logo assembles */}
      <Sequence from={ENDCARD_START} durationInFrames={DURATION - ENDCARD_START}>
        <Endcard />
      </Sequence>
    </AbsoluteFill>
  );
};

export const circle1ReplicateMeta = {
  id: "Circle1-Replicate",
  component: Circle1Composition,
  width: 1920,
  height: 1080,
  fps: FPS,
  durationInFrames: DURATION,
};
