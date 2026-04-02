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
 * Original: A slideshow of 3 slides. Each slide has a centered image and ~11
 * copies of a word stacked vertically in a flex column. Text copies are styled
 * as either filled (white), stroked (transparent fill + white stroke), or
 * bottom-offset. On slide transition, text copies hide sequentially from center
 * outward (80ms stagger), then the image parallax-slides out/in, then the new
 * slide's text copies reveal from outer edges inward to center (80ms stagger).
 *
 * Font: Kanit 900, uppercase, ~17vh, line-height 0.75.
 * Colors: #1c1423 background, #fff text, #ff00c4 accent.
 *
 * Here: slide transitions driven by frame count. 3 slides cycle through the
 * 300-frame duration. Each transition occupies ~90 frames. Mouse interaction
 * doesn't exist in the original (it's prev/next buttons) — we auto-advance.
 */

// ── Types ──────────────────────────────────────────────────────────────────

type TextStyle = "filled" | "stroke" | "stroke-bottom" | "filled-bottom";

interface TextCopy {
  style: TextStyle;
  isFull: boolean; // flex: none (takes natural height) vs flex: 1
}

interface SlideData {
  word: string;
  imageGradient: string; // CSS gradient standing in for the photo
  copies: TextCopy[];
}

// ── Slide configuration ────────────────────────────────────────────────────
// Replicates the exact 11-copy structure from the HTML for each slide.

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
      { style: "filled", isFull: true }, // middle (index 5)
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

// ── Animation timing ───────────────────────────────────────────────────────

const TOTAL_COPIES = 11;
const MIDDLE_IDX = Math.floor(TOTAL_COPIES / 2); // 5
const STAGGER_FRAMES = 2.4; // ~80ms at 30fps
const SLIDE_HOLD_FRAMES = 60; // frames a slide is fully visible before transitioning

// Image parallax slide duration in frames
const IMAGE_SLIDE_FRAMES = 21; // 0.7s show, 9 frames (0.3s) hide — we use 21 for show

// ── Color constants ────────────────────────────────────────────────────────

const BG_COLOR = "#1c1423";
const TEXT_COLOR = "#ffffff";
const STROKE_WIDTH = 2;

// ── Helper: compute per-copy opacity during a trail animation ──────────────

/**
 * Computes the opacity of each text copy during the show/hide trail animation.
 *
 * Show: copies appear from outer edges toward center.
 *   - Position 5 (furthest from center, both up and down) appears first,
 *     then 4, 3, 2, 1, 0 (center). Each separated by STAGGER_FRAMES.
 *
 * Hide: copies disappear from center outward.
 *   - Position 1 (nearest to center on each side) hides first,
 *     then 2, 3, 4, 5. Center (0) stays visible until the end.
 *
 * @param progress 0..1 through the trail phase
 * @param phase "show" or "hide"
 * @returns opacity for each of the 11 copies
 */
function computeTrailOpacities(
  progress: number,
  phase: "show" | "hide",
): number[] {
  const opacities = new Array(TOTAL_COPIES).fill(0);
  const totalSteps = MIDDLE_IDX + 1; // 6 steps (positions 0..5)

  if (phase === "show") {
    // Show from outside in: position MIDDLE_IDX first, then MIDDLE_IDX-1, ..., 0
    for (let pos = MIDDLE_IDX; pos >= 0; pos--) {
      const stepIndex = MIDDLE_IDX - pos; // 0, 1, 2, 3, 4, 5
      const stepStart = stepIndex / totalSteps;
      const stepEnd = (stepIndex + 1) / totalSteps;
      const vis = interpolate(progress, [stepStart, stepEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      // "up" side
      const upIdx = MIDDLE_IDX - pos;
      if (upIdx >= 0 && upIdx < TOTAL_COPIES) {
        opacities[upIdx] = Math.max(opacities[upIdx], vis);
      }
      // "down" side
      const downIdx = MIDDLE_IDX + pos;
      if (downIdx >= 0 && downIdx < TOTAL_COPIES) {
        opacities[downIdx] = Math.max(opacities[downIdx], vis);
      }
    }
  } else {
    // Hide from center outward: position MIDDLE_IDX (center) hides last.
    // First: show all copies (they start visible), then hide them one by one.
    // The sequence: pos 1 hides first, then 2, 3, 4, 5.
    // Then after all outer copies hidden, center (pos 0) hides.

    // First half of hide: show copies from pos=1 outward (this is the "show" part
    // of the hide animation in the original — it shows copies before hiding them)
    // Actually in the original hide():
    //   loopShow starts at pos=1, increments to MIDDLE_IDX (shows outer copies)
    //   Then loopHide from pos=0 to MIDDLE_IDX (hides from center outward)

    const showPhaseEnd = 0.45;
    const hidePhaseStart = 0.45;

    // Show phase of hide: pos=1..5 appear sequentially
    for (let pos = 1; pos <= MIDDLE_IDX; pos++) {
      const stepIndex = pos - 1;
      const steps = MIDDLE_IDX;
      const stepStart = (stepIndex / steps) * showPhaseEnd;
      const stepEnd = ((stepIndex + 1) / steps) * showPhaseEnd;
      const vis = interpolate(progress, [stepStart, stepEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      const upIdx = MIDDLE_IDX - pos;
      if (upIdx >= 0) opacities[upIdx] = vis;
      const downIdx = MIDDLE_IDX + pos;
      if (downIdx < TOTAL_COPIES) opacities[downIdx] = vis;
    }

    // Center always visible during show phase
    if (progress < hidePhaseStart + 0.1) {
      opacities[MIDDLE_IDX] = 1;
    }

    // Hide phase: pos=0 (center) first, then 1, 2, 3, 4, 5
    for (let pos = 0; pos <= MIDDLE_IDX; pos++) {
      const steps = MIDDLE_IDX + 1;
      const stepStart = hidePhaseStart + (pos / steps) * (1 - hidePhaseStart);
      const stepEnd =
        hidePhaseStart + ((pos + 1) / steps) * (1 - hidePhaseStart);
      const fadeOut = interpolate(progress, [stepStart, stepEnd], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      const upIdx = MIDDLE_IDX - pos;
      if (upIdx >= 0) opacities[upIdx] = Math.min(opacities[upIdx], fadeOut);
      const downIdx = MIDDLE_IDX + pos;
      if (downIdx < TOTAL_COPIES)
        opacities[downIdx] = Math.min(opacities[downIdx], fadeOut);
    }
  }

  return opacities;
}

// ── Sub-components ─────────────────────────────────────────────────────────

const TextCopyElement: React.FC<{
  copy: TextCopy;
  word: string;
  opacity: number;
  fontSize: number;
}> = ({ copy, word, opacity, fontSize }) => {
  const isStroke =
    copy.style === "stroke" || copy.style === "stroke-bottom";
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

// ── Image component with parallax ──────────────────────────────────────────

const SlideImage: React.FC<{
  gradient: string;
  slideProgress: number; // -1 (entering from left) to 0 (centered) to 1 (exiting right)
  entering: boolean;
  exiting: boolean;
  width: number;
  height: number;
}> = ({ gradient, slideProgress, entering, exiting, width, height }) => {
  const imgWidth = Math.min(width * 0.7, 1000 - 176); // ~(90% - 11rem) capped
  const imgHeight = Math.min(height * 0.6, 600);

  // Parallax: wrap moves in direction, inner moves opposite for reveal effect
  let wrapX = 0;
  let innerX = 0;
  let opacity = 1;

  if (entering) {
    // Slide in from offscreen
    wrapX = interpolate(slideProgress, [-1, 0], [width * 1.1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.poly(5)),
    });
    innerX = interpolate(slideProgress, [-1, 0], [-width, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.poly(5)),
    });
  } else if (exiting) {
    wrapX = interpolate(slideProgress, [0, 1], [0, -width * 1.1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.poly(5)),
    });
    innerX = interpolate(slideProgress, [0, 1], [0, width], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.poly(5)),
    });
  }

  if (!entering && !exiting) {
    opacity = 1;
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
        opacity,
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

interface TransitionState {
  currentSlide: number;
  phase: "hold" | "hiding" | "image-swap" | "showing";
  phaseProgress: number; // 0..1 within the current phase
  imageEntering: boolean;
  imageExiting: boolean;
  imageSlideProgress: number;
  nextSlide: number;
}

function computeTransitionState(
  frame: number,
  totalFrames: number,
): TransitionState {
  const numSlides = SLIDES.length;
  const trailDuration = (MIDDLE_IDX + 1) * STAGGER_FRAMES * 2; // frames for full trail show/hide
  const hideFrames = trailDuration + 4;
  const showFrames = trailDuration + 4;
  const imageSwapFrames = IMAGE_SLIDE_FRAMES;
  const transitionFrames = hideFrames + imageSwapFrames + showFrames;
  const cycleFrames = SLIDE_HOLD_FRAMES + transitionFrames;

  // Where are we in the overall cycle?
  const cyclePos = frame % cycleFrames;
  const slideIndex =
    Math.floor(frame / cycleFrames) % numSlides;
  const nextSlideIndex = (slideIndex + 1) % numSlides;

  if (cyclePos < SLIDE_HOLD_FRAMES) {
    // Holding — slide is fully visible
    return {
      currentSlide: slideIndex,
      phase: "hold",
      phaseProgress: cyclePos / SLIDE_HOLD_FRAMES,
      imageEntering: false,
      imageExiting: false,
      imageSlideProgress: 0,
      nextSlide: nextSlideIndex,
    };
  }

  const transPos = cyclePos - SLIDE_HOLD_FRAMES;

  if (transPos < hideFrames) {
    // Hiding current slide's text trail
    const prog = transPos / hideFrames;
    // Image starts exiting at the halfway point of the hide
    const imageExiting = prog > 0.4;
    const imgProg = imageExiting
      ? interpolate(prog, [0.4, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

    return {
      currentSlide: slideIndex,
      phase: "hiding",
      phaseProgress: prog,
      imageEntering: false,
      imageExiting,
      imageSlideProgress: imgProg,
      nextSlide: nextSlideIndex,
    };
  }

  if (transPos < hideFrames + imageSwapFrames) {
    // Image is swapping — old exits, new enters
    const imgPos = transPos - hideFrames;
    const imgProg = imgPos / imageSwapFrames;

    return {
      currentSlide: slideIndex,
      phase: "image-swap",
      phaseProgress: imgProg,
      imageEntering: true,
      imageExiting: false,
      imageSlideProgress: interpolate(imgProg, [0, 1], [-1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
      nextSlide: nextSlideIndex,
    };
  }

  // Showing next slide's text trail
  const showPos = transPos - hideFrames - imageSwapFrames;
  const showProg = showPos / showFrames;

  return {
    currentSlide: nextSlideIndex,
    phase: "showing",
    phaseProgress: showProg,
    imageEntering: false,
    imageExiting: false,
    imageSlideProgress: 0,
    nextSlide: (nextSlideIndex + 1) % numSlides,
  };
}

// ── Main component ─────────────────────────────────────────────────────────

export const TextTrail: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Font size: ~17vh equivalent
  const fontSize = height * 0.17;

  const state = useMemo(
    () => computeTransitionState(frame, durationInFrames),
    [frame, durationInFrames],
  );

  // Compute text copy opacities
  const opacities = useMemo(() => {
    if (state.phase === "hold") {
      // All visible: center copy at full, others hidden except the
      // standard visible state. In the original, only the 6th child
      // (index 5, the middle) has opacity: 1 by default.
      // After a show() animation, all copies are visible.
      // We'll show all copies during hold for visual richness.
      return new Array(TOTAL_COPIES).fill(1);
    }
    if (state.phase === "hiding") {
      return computeTrailOpacities(state.phaseProgress, "hide");
    }
    if (state.phase === "showing") {
      return computeTrailOpacities(state.phaseProgress, "show");
    }
    // image-swap: text is hidden
    return new Array(TOTAL_COPIES).fill(0);
  }, [state.phase, state.phaseProgress]);

  // Determine which slide's text + image to show
  const slideData = SLIDES[state.currentSlide];

  // During image-swap, show the incoming slide's image
  const imageSlide =
    state.phase === "image-swap"
      ? SLIDES[state.nextSlide]
      : slideData;

  // Entrance fade for the whole composition
  const masterOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.ease,
  });

  // Exit fade
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.ease,
    },
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
      {/* Image layer */}
      <SlideImage
        gradient={imageSlide.imageGradient}
        slideProgress={
          state.phase === "hiding" && state.imageExiting
            ? state.imageSlideProgress
            : state.phase === "image-swap"
              ? state.imageSlideProgress
              : 0
        }
        entering={state.phase === "image-swap"}
        exiting={state.phase === "hiding" && state.imageExiting}
        width={width}
        height={height}
      />

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
            key={`${state.currentSlide}-${i}`}
            copy={copy}
            word={slideData.word}
            opacity={opacities[i]}
            fontSize={fontSize}
          />
        ))}
      </div>

      {/* Frame overlay — subtle nav hint at bottom */}
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
                i === state.currentSlide
                  ? "#ff00c4"
                  : "rgba(255, 255, 255, 0.2)",
              transition: "none",
            }}
          />
        ))}
      </div>

      {/* Title overlay — top left, matching original frame */}
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
