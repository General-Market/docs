import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

/**
 * Scene 03 — 153 frames at 29fps (~5.27s). Solid blue field.
 *
 * Three sentence phases land in turn, each with a dark underline drawn under
 * the load-bearing word, and a circle-wipe to white exits the scene.
 *   Phase 1: "Now: only you,"
 *   Phase 2: "with the market giving you the best odds of winning,"
 *   Phase 3: "and the assets / you always traded."
 */

const FPS = 29;

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["400"],
});

const BG = "#042FF4";
const TEXT_COLOR = "#FFFFFF";
const UNDERLINE_COLOR = "#061230";
const FONT = `${fontFamily}, 'Helvetica Neue', 'Arial', sans-serif`;
const FONT_SIZE = 62;
const FONT_WEIGHT = 400;
const LETTER_SPACING = "-0.02em";

/* Text sits above true center in reference (~48% from top for single-line phases).
 * Phase 1/2 (single line): center at 48.06% → need -14px from true center
 * Phase 3 (two lines): center at 48.70% → need -9px from true center
 * Using per-phase Y offset via transform, not global padding. */
const PHASE12_Y_OFFSET = -19; // px shift for single-line phases
const PHASE3_Y_OFFSET = -5; // px shift for two-line phase (original best-scoring position)

/* ── Phase boundaries (scene-local frames, recalibrated from reference) ── */
const PHASE1_START = 0;
const PHASE1_HOLD = 42; // reference holds full opacity through frame 42

const PHASE2_START = 46; // cross-fades in very fast, ~4 frame overlap with phase 1 exit
const PHASE2_HOLD = 83; // exits just before Phase 3 enters at 86

const PHASE3_START = 86; // line 1 appears ~frame 87 (1 frame earlier to match ref)
const PHASE3_LINE2_DELAY = 3; // line 2 follows very quickly (~3 frames — ref shows both at f91)

/* ── Utility: clamp-interpolate shorthand ── */
const clampInterp = (
  val: number,
  inRange: [number, number],
  outRange: [number, number],
  easing?: (t: number) => number
) =>
  interpolate(val, inRange, outRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/* ── Circle wipe exit transition ── */
const CIRCLE_WIPE_START = 139; // circle begins shrinking (visible at f140 in reference)
const EXIT_BG = "#EBEBEB"; // very light gray background behind circle

export const Scene03: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase 1: appears instantly at frame 0, fast fade out (~4 frames)
  const phase1Opacity = (() => {
    if (frame > PHASE1_HOLD + 5) return 0;
    const fadeOut = clampInterp(frame, [PHASE1_HOLD, PHASE1_HOLD + 4], [1, 0]);
    return fadeOut;
  })();

  // Phase 2: fast fade in (~3 frames), holds, fast fade out before Phase 3
  const phase2Opacity = (() => {
    if (frame < PHASE2_START || frame > PHASE2_HOLD + 5) return 0;
    const fadeIn = clampInterp(frame, [PHASE2_START, PHASE2_START + 3], [0, 1]);
    const fadeOut = clampInterp(frame, [PHASE2_HOLD, PHASE2_HOLD + 3], [1, 0]);
    return fadeIn * fadeOut;
  })();

  // Phase 3: very fast fade in (~2 frames — reference is nearly full by frame 89)
  const phase3Opacity = (() => {
    if (frame < PHASE3_START) return 0;
    return clampInterp(frame, [PHASE3_START, PHASE3_START + 2], [0, 1]);
  })();

  // Circle wipe: reference shows circle shrinking rapidly from ~f140.
  // Frame-by-frame analysis against Motionimo reference:
  //   f139=full, f140=corners clipped (~95%), f142=~65%, f144=~35%, f146=~12%, f148=tiny (~5%)
  const wipeFrame = frame - CIRCLE_WIPE_START;
  const showWipe = wipeFrame > 0;
  const maxRadius = Math.sqrt(1280 * 1280 + 720 * 720) / 2;
  const circleRadius = showWipe
    ? interpolate(
        wipeFrame,
        [0, 1,   3,   5,   7,    9,    11,   13,   14],
        [maxRadius, maxRadius * 0.95, maxRadius * 0.75, maxRadius * 0.50, maxRadius * 0.30, maxRadius * 0.12, maxRadius * 0.05, 0, 0],
        { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
      )
    : maxRadius;

  return (
    <AbsoluteFill style={{ backgroundColor: EXIT_BG }}>
      <AbsoluteFill
        style={{
          backgroundColor: BG,
          justifyContent: "center",
          alignItems: "center",
          ...(showWipe
            ? {
                clipPath: `circle(${circleRadius}px at 50% 50%)`,
                WebkitClipPath: `circle(${circleRadius}px at 50% 50%)`,
              }
            : {}),
        }}
      >
        {phase1Opacity > 0 && (
          <PhaseText
            frame={frame - PHASE1_START}
            opacity={phase1Opacity}
            before="Now: only "
            underlined="you"
            after=""
          />
        )}
        {phase2Opacity > 0 && (
          <Phase2Text
            frame={frame - PHASE2_START}
            opacity={phase2Opacity}
          />
        )}
        {phase3Opacity > 0 && (
          <Phase3Text frame={frame - PHASE3_START} opacity={phase3Opacity} />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ── Animated underline (dark navy, draws left to right) ── */
const AnimatedUnderline: React.FC<{ widthPercent: number }> = ({
  widthPercent,
}) => (
  <div
    style={{
      position: "absolute",
      bottom: -2,
      left: -3,
      width: `calc(${widthPercent}% + 6px)`,
      height: 2,
      backgroundColor: UNDERLINE_COLOR,
      opacity: 1,
    }}
  />
);

/* ── Shared text style ── */
const baseStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: FONT_SIZE,
  fontWeight: FONT_WEIGHT,
  color: TEXT_COLOR,
  letterSpacing: LETTER_SPACING,
  lineHeight: 1.3,
  whiteSpace: "pre",
  textRendering: "optimizeLegibility",
  WebkitFontSmoothing: "antialiased",
};

/* ── Spring slide-up with subtle overshoot ── */
const useSlideY = (frame: number, delay = 0): number => {
  const s = spring({
    frame: frame - delay,
    fps: FPS,
    config: {
      damping: 18,
      stiffness: 220,
      mass: 0.6,
      overshootClamping: false,
    },
  });
  return interpolate(s, [0, 1], [8, 0]);
};

/* ── Phases 1 & 2: single-line text with underline ── */
const PhaseText: React.FC<{
  frame: number;
  opacity: number;
  before: string;
  underlined: string;
  after: string;
}> = ({ frame, opacity, before, underlined, after }) => {
  const slideY = useSlideY(frame);

  const underlineW = clampInterp(
    frame,
    [1, 5],
    [0, 100],
    Easing.out(Easing.cubic)
  );

  // Subtle exit lift: text drifts up ~4px as it fades out (reference shows upward motion)
  // PhaseText receives frame relative to phase start, so we use the hold duration directly
  const exitLift = clampInterp(frame, [38, 42], [0, -4]);

  return (
    <div
      style={{
        ...baseStyle,
        opacity,
        transform: `translateY(${PHASE12_Y_OFFSET + slideY + exitLift}px)`,
      }}
    >
      {before}
      <span style={{ position: "relative", display: "inline-block" }}>
        {underlined}
        <AnimatedUnderline widthPercent={underlineW} />
      </span>
      {after}
    </div>
  );
};

/* ── Phase 2: "with the market giving you the best odds of winning" ── */
const Phase2Text: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  const slideY = useSlideY(frame);

  const underlineW = clampInterp(
    frame,
    [1, 5],
    [0, 100],
    Easing.out(Easing.cubic)
  );

  const exitLift = clampInterp(frame, [38, 42], [0, -4]);

  // The phrase is long — drop font size for fit at 1280 wide.
  const phaseStyle: React.CSSProperties = {
    ...baseStyle,
    fontSize: 44,
    opacity,
    transform: `translateY(${PHASE12_Y_OFFSET + slideY + exitLift}px)`,
  };

  return (
    <div style={phaseStyle}>
      {"with the market giving you the "}
      <span style={{ position: "relative", display: "inline-block" }}>
        <span style={{ display: "inline-flex" }}>
          {"best odds".split("").map((char, i) => {
            const charSpring = spring({
              frame: Math.max(0, frame - i * 2),
              fps: FPS,
              config: { damping: 12, stiffness: 180, mass: 0.7 },
            });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  transform: `translateY(${(1 - charSpring) * 20}px)`,
                  opacity: charSpring,
                  whiteSpace: "pre",
                }}
              >
                {char}
              </span>
            );
          })}
        </span>
        <AnimatedUnderline widthPercent={underlineW} />
      </span>
      {" of winning"}
    </div>
  );
};

/* ── Phase 3: two-line text with underline on "always" (line 2) ── */
const Phase3Text: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  const slideY = useSlideY(frame);

  // Underline draws on line 2, so reference frame from line 2's entrance.
  const line2Frame = frame - PHASE3_LINE2_DELAY;
  const underlineW = clampInterp(
    line2Frame,
    [1, 5],
    [0, 100],
    Easing.out(Easing.cubic)
  );

  const line2Opacity = clampInterp(line2Frame, [0, 2], [0, 1]);
  const line2SlideY = useSlideY(frame, PHASE3_LINE2_DELAY);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        transform: `translateY(${PHASE3_Y_OFFSET}px)`,
      }}
    >
      {/* Line 1: "and the assets" */}
      <div
        style={{
          ...baseStyle,
          opacity,
          transform: `translateY(${slideY}px)`,
          textAlign: "center",
        }}
      >
        {"and the assets"}
      </div>

      {/* Line 2: "you always traded." with per-letter spring on "always" + underline */}
      {line2Opacity > 0 && (
        <div
          style={{
            ...baseStyle,
            opacity: opacity * line2Opacity,
            transform: `translateY(${line2SlideY}px)`,
            textAlign: "center",
          }}
        >
          {"you "}
          <span style={{ position: "relative", display: "inline-block" }}>
            <span style={{ display: "inline-flex" }}>
              {"always".split("").map((char, i) => {
                const charSpring = spring({
                  frame: Math.max(0, line2Frame - i * 2),
                  fps: FPS,
                  config: { damping: 12, stiffness: 180, mass: 0.7 },
                });
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      transform: `translateY(${(1 - charSpring) * 20}px)`,
                      opacity: charSpring,
                      whiteSpace: "pre",
                    }}
                  >
                    {char}
                  </span>
                );
              })}
            </span>
            <AnimatedUnderline widthPercent={underlineW} />
          </span>
          {" traded."}
        </div>
      )}
    </div>
  );
};

export const scene03Meta = {
  id: "RainbowsPublicScene03",
  component: Scene03,
  width: 1280,
  height: 720,
  fps: 29,
  durationInFrames: 153,
};
