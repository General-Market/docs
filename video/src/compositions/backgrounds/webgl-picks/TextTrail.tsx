// Source: https://tympanus.net/Development/TextTrailEffect/
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

/**
 * 1:1 reproduction of Codrops "Text Trail Effect" (Demo 1).
 *
 * Original: 3 slides, each with 11 stacked text copies in a flex column.
 * Font: Kanit 900, uppercase, 17vh, line-height 0.75.
 * Colors: #1c1423 bg, #fff slide text, #ff00c4 accent.
 *
 * Default state: only the 6th child (index 5, center) has opacity 1. All
 * others start at opacity 0.
 *
 * show() animation (reveals incoming slide text):
 *   Phase 1 — loopShow: show copies from outside inward (pos 5→0), 80ms stagger.
 *   Phase 2 — loopHide: hide copies from outside inward (pos 5→1), 80ms stagger.
 *   Result: a wave converges to center, leaves only center copy visible.
 *
 * hide() animation (hides current slide text):
 *   Phase 1 — loopShow: show copies from center outward (pos 1→5), 80ms stagger.
 *   Phase 2 — loopHide: hide copies from center outward (pos 0→5), 80ms stagger.
 *   Halfway callback (between phases): triggers image swap.
 *   Result: a wave expands from center, then everything disappears.
 *
 * Image parallax: wrap and inner slide in opposite directions.
 *   Hide: 0.3s Quint.easeOut, wrap → ±110%, inner → ∓100%.
 *   Show: 0.7s Quint.easeOut, wrap from ±110% → 0, inner from ∓100% → 0.
 */

// ── Types ──────────────────────────────────────────────────────────────────

type TextStyle = "filled" | "stroke" | "stroke-bottom" | "filled-bottom";

interface TextCopy {
  style: TextStyle;
  isFull: boolean; // true = flex: none (content-sized), false = flex: 1
}

interface SlideData {
  word: string;
  imageGradient: string;
  copies: TextCopy[];
}

// ── Slide configuration ────────────────────────────────────────────────────
// Exact 11-copy structure from the HTML. Each slide is identical in layout.

const SLIDES: SlideData[] = [
  {
    word: "Kobun",
    imageGradient:
      "linear-gradient(135deg, #2d1b4e 0%, #1a0a2e 40%, #0d0618 100%)",
    copies: [
      { style: "stroke", isFull: false },
      { style: "filled", isFull: false },
      { style: "stroke", isFull: true },
      { style: "stroke", isFull: false },
      { style: "filled", isFull: false },
      { style: "filled", isFull: true }, // center (index 5)
      { style: "filled-bottom", isFull: false },
      { style: "filled", isFull: false },
      { style: "stroke", isFull: true },
      { style: "stroke-bottom", isFull: false },
      { style: "filled", isFull: false },
    ],
  },
  {
    word: "De-Rezz",
    imageGradient:
      "linear-gradient(135deg, #0a2a3a 0%, #001820 40%, #000d14 100%)",
    copies: [
      { style: "stroke", isFull: false },
      { style: "filled", isFull: false },
      { style: "stroke", isFull: true },
      { style: "stroke", isFull: false },
      { style: "filled", isFull: false },
      { style: "filled", isFull: true },
      { style: "filled-bottom", isFull: false },
      { style: "filled", isFull: false },
      { style: "stroke", isFull: true },
      { style: "stroke-bottom", isFull: false },
      { style: "filled", isFull: false },
    ],
  },
  {
    word: "X-Heads",
    imageGradient:
      "linear-gradient(135deg, #1e0a2e 0%, #120520 40%, #080210 100%)",
    copies: [
      { style: "stroke", isFull: false },
      { style: "filled", isFull: false },
      { style: "stroke", isFull: true },
      { style: "stroke", isFull: false },
      { style: "filled", isFull: false },
      { style: "filled", isFull: true },
      { style: "filled-bottom", isFull: false },
      { style: "filled", isFull: false },
      { style: "stroke", isFull: true },
      { style: "stroke-bottom", isFull: false },
      { style: "filled", isFull: false },
    ],
  },
];

// ── Constants ──────────────────────────────────────────────────────────────

const TOTAL_COPIES = 11;
const MIDDLE_IDX = Math.floor(TOTAL_COPIES / 2); // 5

const BG_COLOR = "#1c1423";
const TEXT_COLOR = "#ffffff";
const STROKE_WIDTH = 2;

// Timing in frames (at 30fps, 80ms ≈ 2.4 frames)
const STAGGER_FRAMES = 2.4;

// Original idle time after trail completes: loopEndIddleTime = 80ms = 1 stagger
const IDLE_FRAMES = STAGGER_FRAMES;

// show() has 6 show steps + 5 hide steps + idle
// hide() has 5 show steps + 6 hide steps + idle
const SHOW_STEPS = MIDDLE_IDX + 1; // 6 (pos 5→0)
const HIDE_SHOW_STEPS = MIDDLE_IDX; // 5 (pos 1→5)
const SHOW_HIDE_STEPS = MIDDLE_IDX; // 5 (pos 5→1, center excluded)
const HIDE_HIDE_STEPS = MIDDLE_IDX + 1; // 6 (pos 0→5)

const SHOW_DURATION = (SHOW_STEPS + SHOW_HIDE_STEPS) * STAGGER_FRAMES + IDLE_FRAMES;
const HIDE_DURATION = (HIDE_SHOW_STEPS + HIDE_HIDE_STEPS) * STAGGER_FRAMES + IDLE_FRAMES;

// Image animation durations (original: hide 0.3s, show 0.7s at 30fps)
const IMAGE_HIDE_FRAMES = 9; // 0.3s
const IMAGE_SHOW_FRAMES = 21; // 0.7s

const SLIDE_HOLD_FRAMES = 60;

// Quint.easeOut equivalent
const quintOut = Easing.out(Easing.poly(5));

// ── Trail opacity computation ──────────────────────────────────────────────

/**
 * Replicates the original show() two-phase trail:
 *   Phase 1: loopShow — show copies from outside in (pos middleIdx→0).
 *   Phase 2: loopHide — hide copies from outside in (pos middleIdx→1). Center stays.
 *
 * @param frameInPhase frames elapsed since show() started
 * @returns opacity array for all 11 copies
 */
function computeShowTrail(frameInPhase: number): number[] {
  const opacities = new Array(TOTAL_COPIES).fill(0);

  // Phase 1: show from outside in — pos goes 5, 4, 3, 2, 1, 0
  for (let step = 0; step < SHOW_STEPS; step++) {
    const pos = MIDDLE_IDX - step; // 5, 4, 3, 2, 1, 0
    const stepFrame = step * STAGGER_FRAMES;
    if (frameInPhase >= stepFrame) {
      const upIdx = MIDDLE_IDX - pos;
      const downIdx = MIDDLE_IDX + pos;
      if (upIdx >= 0 && upIdx < TOTAL_COPIES) opacities[upIdx] = 1;
      if (downIdx >= 0 && downIdx < TOTAL_COPIES) opacities[downIdx] = 1;
    }
  }

  // Phase 2: hide from outside in — pos goes 5, 4, 3, 2, 1 (center excluded)
  const phase2Start = SHOW_STEPS * STAGGER_FRAMES;
  for (let step = 0; step < SHOW_HIDE_STEPS; step++) {
    const pos = MIDDLE_IDX - step; // 5, 4, 3, 2, 1
    const stepFrame = phase2Start + step * STAGGER_FRAMES;
    if (frameInPhase >= stepFrame) {
      const upIdx = MIDDLE_IDX - pos;
      const downIdx = MIDDLE_IDX + pos;
      if (upIdx >= 0 && upIdx < TOTAL_COPIES) opacities[upIdx] = 0;
      if (downIdx >= 0 && downIdx < TOTAL_COPIES) opacities[downIdx] = 0;
    }
  }

  // Center always stays visible once shown (step=5 in phase 1, pos=0)
  const centerShownAt = (SHOW_STEPS - 1) * STAGGER_FRAMES;
  if (frameInPhase >= centerShownAt) {
    opacities[MIDDLE_IDX] = 1;
  }

  return opacities;
}

/**
 * Replicates the original hide() two-phase trail:
 *   Phase 1: loopShow — show copies from center outward (pos 1→5).
 *   Phase 2: loopHide — hide ALL from center outward (pos 0→5).
 *
 * @param frameInPhase frames elapsed since hide() started
 * @returns opacity array for all 11 copies
 */
function computeHideTrail(frameInPhase: number): number[] {
  // Start: only center visible (default resting state)
  const opacities = new Array(TOTAL_COPIES).fill(0);
  opacities[MIDDLE_IDX] = 1;

  // Phase 1: show from center outward — pos goes 1, 2, 3, 4, 5
  for (let step = 0; step < HIDE_SHOW_STEPS; step++) {
    const pos = step + 1; // 1, 2, 3, 4, 5
    const stepFrame = step * STAGGER_FRAMES;
    if (frameInPhase >= stepFrame) {
      const upIdx = MIDDLE_IDX - pos;
      const downIdx = MIDDLE_IDX + pos;
      if (upIdx >= 0 && upIdx < TOTAL_COPIES) opacities[upIdx] = 1;
      if (downIdx >= 0 && downIdx < TOTAL_COPIES) opacities[downIdx] = 1;
    }
  }

  // Phase 2: hide ALL from center outward — pos goes 0, 1, 2, 3, 4, 5
  const phase2Start = HIDE_SHOW_STEPS * STAGGER_FRAMES;
  for (let step = 0; step < HIDE_HIDE_STEPS; step++) {
    const pos = step; // 0, 1, 2, 3, 4, 5
    const stepFrame = phase2Start + step * STAGGER_FRAMES;
    if (frameInPhase >= stepFrame) {
      const upIdx = MIDDLE_IDX - pos;
      const downIdx = MIDDLE_IDX + pos;
      if (upIdx >= 0 && upIdx < TOTAL_COPIES) opacities[upIdx] = 0;
      if (downIdx >= 0 && downIdx < TOTAL_COPIES) opacities[downIdx] = 0;
    }
  }

  return opacities;
}

/**
 * Returns the fractional progress through the hide() animation at which
 * the halfwayCallback fires. In the original, this happens when phase 1
 * (loopShow) completes — after HIDE_SHOW_STEPS * stagger time.
 */
function hideHalfwayProgress(): number {
  return (HIDE_SHOW_STEPS * STAGGER_FRAMES) / HIDE_DURATION;
}

// ── Sub-components ─────────────────────────────────────────────────────────

const TextCopyElement: React.FC<{
  copy: TextCopy;
  word: string;
  opacity: number;
  fontSize: number;
}> = ({ copy, word, opacity, fontSize }) => {
  const isStroke = copy.style === "stroke" || copy.style === "stroke-bottom";
  const isBottom =
    copy.style === "filled-bottom" || copy.style === "stroke-bottom";

  const baseStyle: React.CSSProperties = {
    display: "block",
    color: isStroke ? "transparent" : TEXT_COLOR,
    textTransform: "uppercase",
    fontSize,
    fontWeight: 900,
    lineHeight: 0.75,
    fontFamily: "Kanit, sans-serif",
    whiteSpace: "nowrap",
    textAlign: "center",
    ...(isStroke
      ? {
          WebkitTextStroke: `${STROKE_WIDTH}px ${TEXT_COLOR}`,
          WebkitTextFillColor: "transparent",
        }
      : {}),
    ...(isBottom ? { transform: "translate3d(0, -40%, 0)" } : {}),
  };

  const wrapStyle: React.CSSProperties = {
    overflow: "hidden",
    flex: copy.isFull ? "none" : 1,
    opacity,
    pointerEvents: "none",
  };

  return (
    <span style={wrapStyle}>
      <span style={baseStyle}>{word}</span>
    </span>
  );
};

// ── Image with parallax ────────────────────────────────────────────────────

const SlideImage: React.FC<{
  gradient: string;
  progress: number; // 0..1 through the image animation
  action: "idle" | "hiding" | "showing";
  width: number;
  height: number;
}> = ({ gradient, progress, action, width, height }) => {
  // Original: width calc(90% - 11rem), max-width calc(1000px - 11rem), max-height 600px, height 60vh
  const imgWidth = Math.min(width * 0.9 - 176, 1000 - 176);
  const imgHeight = Math.min(height * 0.6, 600);

  let wrapX = 0;
  let innerX = 0;

  if (action === "hiding") {
    // Wrap slides out to -110%, inner slides opposite to 100%
    wrapX = interpolate(progress, [0, 1], [0, -width * 1.1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: quintOut,
    });
    innerX = interpolate(progress, [0, 1], [0, width], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: quintOut,
    });
  } else if (action === "showing") {
    // Wrap slides in from 110%, inner from -100%
    wrapX = interpolate(progress, [0, 1], [width * 1.1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: quintOut,
    });
    innerX = interpolate(progress, [0, 1], [-width, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: quintOut,
    });
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: imgWidth,
        height: imgHeight,
        marginLeft: -imgWidth / 2,
        marginTop: -imgHeight / 2,
        overflow: "hidden",
        zIndex: -1,
        transform: `translateX(${wrapX}px)`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: gradient,
          backgroundSize: "cover",
          backgroundPosition: "center",
          transform: `translateX(${innerX}px)`,
        }}
      />
    </div>
  );
};

// ── Transition state machine ───────────────────────────────────────────────
//
// The full transition from slide A → B:
//   1. hide() on A's text trail (HIDE_DURATION frames)
//      - At halfwayCallback: A's image hides, B's image shows, B's center text set to 0
//   2. show() on B's text trail (SHOW_DURATION frames)
//
// Image swap happens mid-hide. The image hide (0.3s) and show (0.7s) overlap
// with the text trail — they start at the halfway point of the hide animation.

interface FrameState {
  /** Which slide's text to render */
  textSlide: number;
  /** Opacity array for the 11 text copies */
  textOpacities: number[];
  /** Current image slide index */
  currentImageSlide: number;
  /** Image animation state for current image */
  currentImageAction: "idle" | "hiding" | "showing";
  currentImageProgress: number;
  /** Incoming image slide index (only during swap) */
  incomingImageSlide: number | null;
  incomingImageAction: "idle" | "hiding" | "showing";
  incomingImageProgress: number;
  /** Which slide index is "current" for the dot indicator */
  dotSlide: number;
}

function computeFrameState(frame: number): FrameState {
  const numSlides = SLIDES.length;
  const transitionDuration = HIDE_DURATION + SHOW_DURATION;
  const cycleDuration = SLIDE_HOLD_FRAMES + transitionDuration;

  const cyclePos = frame % cycleDuration;
  const slideIdx = Math.floor(frame / cycleDuration) % numSlides;
  const nextIdx = (slideIdx + 1) % numSlides;

  // Halfway point in the hide animation (in frames from transition start)
  const halfwayFrame = hideHalfwayProgress() * HIDE_DURATION;

  if (cyclePos < SLIDE_HOLD_FRAMES) {
    // Holding — only center copy visible
    const ops = new Array(TOTAL_COPIES).fill(0);
    ops[MIDDLE_IDX] = 1;
    return {
      textSlide: slideIdx,
      textOpacities: ops,
      currentImageSlide: slideIdx,
      currentImageAction: "idle",
      currentImageProgress: 0,
      incomingImageSlide: null,
      incomingImageAction: "idle",
      incomingImageProgress: 0,
      dotSlide: slideIdx,
    };
  }

  const transFrame = cyclePos - SLIDE_HOLD_FRAMES;

  if (transFrame < HIDE_DURATION) {
    // In the hide() phase of current slide
    const textOpacities = computeHideTrail(transFrame);

    // Image swap starts at halfway callback
    let curImgAction: "idle" | "hiding" = "idle";
    let curImgProgress = 0;
    let incImgSlide: number | null = null;
    let incImgAction: "idle" | "showing" = "idle";
    let incImgProgress = 0;

    if (transFrame >= halfwayFrame) {
      const imgElapsed = transFrame - halfwayFrame;

      // Current image hides (0.3s = IMAGE_HIDE_FRAMES)
      curImgAction = "hiding";
      curImgProgress = Math.min(imgElapsed / IMAGE_HIDE_FRAMES, 1);

      // Incoming image shows (0.7s = IMAGE_SHOW_FRAMES), starts simultaneously
      incImgSlide = nextIdx;
      incImgAction = "showing";
      incImgProgress = Math.min(imgElapsed / IMAGE_SHOW_FRAMES, 1);
    }

    return {
      textSlide: slideIdx,
      textOpacities,
      currentImageSlide: slideIdx,
      currentImageAction: curImgAction,
      currentImageProgress: curImgProgress,
      incomingImageSlide: incImgSlide,
      incomingImageAction: incImgAction,
      incomingImageProgress: incImgProgress,
      dotSlide: transFrame >= halfwayFrame ? nextIdx : slideIdx,
    };
  }

  // In the show() phase of the incoming slide
  const showFrame = transFrame - HIDE_DURATION;
  const textOpacities = computeShowTrail(showFrame);

  // By now the image swap is complete — incoming image is in place
  // Continue the incoming image show if it hasn't finished
  const imgElapsedSinceHalfway =
    (HIDE_DURATION - halfwayFrame) + showFrame;

  return {
    textSlide: nextIdx,
    textOpacities,
    currentImageSlide: slideIdx,
    currentImageAction: "hiding",
    currentImageProgress: 1, // fully hidden
    incomingImageSlide: nextIdx,
    incomingImageAction: "showing",
    incomingImageProgress: Math.min(
      imgElapsedSinceHalfway / IMAGE_SHOW_FRAMES,
      1,
    ),
    dotSlide: nextIdx,
  };
}

// ── Main component ─────────────────────────────────────────────────────────

export const TextTrail: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const fontSize = height * 0.17; // 17vh

  const state = useMemo(() => computeFrameState(frame), [frame]);

  const slideData = SLIDES[state.textSlide];

  // Entrance/exit fades for the composition
  const masterOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.ease,
  });
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.ease },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG_COLOR,
        overflow: "hidden",
        opacity: masterOpacity * exitOpacity,
        fontFamily: "Kanit, sans-serif",
      }}
    >
      {/* Current image layer */}
      <SlideImage
        gradient={SLIDES[state.currentImageSlide].imageGradient}
        progress={state.currentImageProgress}
        action={state.currentImageAction}
        width={width}
        height={height}
      />

      {/* Incoming image layer (only during swap) */}
      {state.incomingImageSlide !== null && (
        <SlideImage
          gradient={SLIDES[state.incomingImageSlide].imageGradient}
          progress={state.incomingImageProgress}
          action={state.incomingImageAction}
          width={width}
          height={height}
        />
      )}

      {/* Text copies layer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {slideData.copies.map((copy, i) => (
          <TextCopyElement
            key={`${state.textSlide}-${i}`}
            copy={copy}
            word={slideData.word}
            opacity={state.textOpacities[i]}
            fontSize={fontSize}
          />
        ))}
      </div>

      {/* Navigation dot indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 24,
          zIndex: 10,
        }}
      >
        {SLIDES.map((_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor:
                i === state.dotSlide
                  ? "#ff00c4"
                  : "rgba(255, 255, 255, 0.2)",
            }}
          />
        ))}
      </div>

      {/* Frame title — top left, matching original */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 48,
          color: "rgba(255, 255, 255, 0.4)",
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: "0.02em",
          zIndex: 10,
        }}
      >
        Text Trail Effect
      </div>
    </AbsoluteFill>
  );
};
