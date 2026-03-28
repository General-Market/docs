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
 * Scene 03 — 22.42s to 27.56s (5.14s, ~149 frames @ 29fps)
 *
 * Three text phases on solid blue (#042EF4):
 *   Phase 1 (f0–31):   "All of your investing."  — dark underline under "your"
 *   Phase 2 (f38–70):  "All in one place."       — dark underline under "one place"
 *   Phase 3 (f78–end): "Get up to $10,000 when you / transfer an account."
 *                        — dark underline under "$10,000"
 *
 * Timing from deep analysis text_elements:
 *   "All" first_seen=22.422, last_seen=23.357 → Phase 1: 0–27 frames, fade by 35
 *   "Allin" first_seen=23.824, last_seen=24.758 → Phase 2: 41–68 frames, fade by 75
 *   "Get" first_seen=25.225 → Phase 3 starts frame 81
 *   "transfer" first_seen=25.692 → Line 2 starts frame 95
 *
 * Underlines: dark navy ~2px, draw left-to-right, ease-out-cubic.
 * Entry: spring slide-up with subtle overshoot + 2-frame opacity snap.
 * Exit: 4-frame opacity fade. Phase 1 starts at full opacity (no fade-in).
 */

const FPS = 29;

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["400"],
});

const BG = "#042EF4";
const TEXT_COLOR = "#FFFFFF";
const UNDERLINE_COLOR = "#081440";
const FONT = `${fontFamily}, 'Helvetica Neue', 'Arial', sans-serif`;
const FONT_SIZE = 58;
const FONT_WEIGHT = 400;
const LETTER_SPACING = "-0.02em";

/* ── Phase boundaries (scene-local frames at 29fps) ── */
const PHASE1_START = 0;
const PHASE1_HOLD = 27;

const PHASE2_START = 38;
const PHASE2_HOLD = 66;

const PHASE3_START = 78;
const PHASE3_LINE2_DELAY = 13; // line 2 enters 13 frames after line 1

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

export const Scene03: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase 1: appears instantly at frame 0, fades out quickly before Phase 2
  const phase1Opacity = (() => {
    if (frame > PHASE1_HOLD + 5) return 0;
    const fadeOut = clampInterp(frame, [PHASE1_HOLD, PHASE1_HOLD + 4], [1, 0]);
    return fadeOut;
  })();

  // Phase 2: snaps in with 2-frame fade, fades out before Phase 3
  const phase2Opacity = (() => {
    if (frame < PHASE2_START || frame > PHASE2_HOLD + 5) return 0;
    const fadeIn = clampInterp(frame, [PHASE2_START, PHASE2_START + 2], [0, 1]);
    const fadeOut = clampInterp(frame, [PHASE2_HOLD, PHASE2_HOLD + 4], [1, 0]);
    return fadeIn * fadeOut;
  })();

  // Phase 3: snaps in with 2-frame fade, holds until end
  const phase3Opacity = (() => {
    if (frame < PHASE3_START) return 0;
    return clampInterp(frame, [PHASE3_START, PHASE3_START + 2], [0, 1]);
  })();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {phase1Opacity > 0 && (
        <PhaseText
          frame={frame - PHASE1_START}
          opacity={phase1Opacity}
          before="All of "
          underlined="your"
          after=" investing."
        />
      )}
      {phase2Opacity > 0 && (
        <PhaseText
          frame={frame - PHASE2_START}
          opacity={phase2Opacity}
          before="All in "
          underlined="one place"
          after="."
        />
      )}
      {phase3Opacity > 0 && (
        <Phase3Text frame={frame - PHASE3_START} opacity={phase3Opacity} />
      )}
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
      bottom: -1,
      left: 0,
      width: `${widthPercent}%`,
      height: 2,
      backgroundColor: UNDERLINE_COLOR,
      opacity: 0.9,
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
};

/* ── Spring slide-up with subtle overshoot ── */
const useSlideY = (frame: number, delay = 0): number => {
  const s = spring({
    frame: frame - delay,
    fps: FPS,
    config: {
      damping: 16,
      stiffness: 200,
      mass: 0.7,
      overshootClamping: false,
    },
  });
  return interpolate(s, [0, 1], [10, 0]);
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
    [1, 8],
    [0, 100],
    Easing.out(Easing.cubic)
  );

  return (
    <div
      style={{
        ...baseStyle,
        opacity,
        transform: `translateY(${slideY}px)`,
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

/* ── Phase 3: two-line text with underline on $10,000 ── */
const Phase3Text: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  const slideY = useSlideY(frame);

  const underlineW = clampInterp(
    frame,
    [1, 8],
    [0, 100],
    Easing.out(Easing.cubic)
  );

  // Line 2 fades in with its own spring slide
  const line2Frame = frame - PHASE3_LINE2_DELAY;
  const line2Opacity = clampInterp(line2Frame, [0, 2], [0, 1]);
  const line2SlideY = useSlideY(frame, PHASE3_LINE2_DELAY);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      {/* Line 1: "Get up to $10,000 when you" */}
      <div
        style={{
          ...baseStyle,
          opacity,
          transform: `translateY(${slideY}px)`,
        }}
      >
        {"Get up to "}
        <span style={{ position: "relative", display: "inline-block" }}>
          {"$10,000"}
          <AnimatedUnderline widthPercent={underlineW} />
        </span>
        {" when you"}
      </div>

      {/* Line 2: "transfer an account." — always rendered for layout stability */}
      <div
        style={{
          ...baseStyle,
          opacity: opacity * line2Opacity,
          transform: `translateY(${line2SlideY}px)`,
          textAlign: "center",
        }}
      >
        {"transfer an account."}
      </div>
    </div>
  );
};

export const scene03Meta = {
  id: "ReplicateScene03",
  component: Scene03,
  width: 1280,
  height: 720,
  fps: 29,
  durationInFrames: 153,
};
