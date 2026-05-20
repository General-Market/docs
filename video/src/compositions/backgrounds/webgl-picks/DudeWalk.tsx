// A man walks because the page demands it. Scroll becomes time; time becomes
// gait. Four panels slide left, four limbs swing on borrowed ease curves, and
// the body bobs because it has nowhere else to go. The original was a
// ScrollTrigger toy — three timelines (body, back half, front half) tied to a
// 400vh scrollbar. Here the scrollbar is the frame counter and the limbs
// don't get the choice of standing still.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ── Constants ───────────────────────────────────────────────────────────────

const VIEW_W = 1920;
const VIEW_H = 1080;
const SECTION_W = VIEW_W;
const NUM_SECTIONS = 4;
const TOTAL_W = SECTION_W * NUM_SECTIONS;
const TRAVEL = SECTION_W * (NUM_SECTIONS - 1); // = 5760

const NUMBER_OF_CYCLES = 6;

// ── Easing primitives that mirror GSAP's sine.* curves ─────────────────────

const sineInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const sineIn = (t: number) => 1 - Math.cos((t * Math.PI) / 2);
const sineOut = (t: number) => Math.sin((t * Math.PI) / 2);

// Generic eased lerp between two values across the [t0, t1] window.
function ease(
  t: number,
  t0: number,
  t1: number,
  from: number,
  to: number,
  fn: (x: number) => number,
): number {
  if (t <= t0) return from;
  if (t >= t1) return to;
  const local = (t - t0) / (t1 - t0);
  return from + (to - from) * fn(local);
}

// ── Half-body cycle ─────────────────────────────────────────────────────────
// Returns rotations for one half-cycle given a local time t ∈ [0, 1).
// Lifted directly from the GSAP timeline in the source.

type HalfBody = {
  legRot: number;
  legBottomRot: number;
  armRot: number;
  armBottomRot: number;
};

function evalHalfBody(t: number): HalfBody {
  // Leg: -25 → 15 over 0..0.5 (sine.inOut), then 15 → -25 over 0.5..0.75 (sine.in)
  let legRot: number;
  if (t < 0.5) {
    legRot = ease(t, 0, 0.5, -25, 15, sineInOut);
  } else if (t < 0.75) {
    legRot = ease(t, 0.5, 0.75, 15, -25, sineIn);
  } else {
    legRot = -25;
  }

  // Leg-bottom: 0 → 15 over 0.25..0.5 (sine.inOut), 15 → 80 over 0.5..0.75
  // (sine.in), 80 → 0 over 0.75..1.0 (sine.out)
  let legBottomRot: number;
  if (t < 0.25) {
    legBottomRot = 0;
  } else if (t < 0.5) {
    legBottomRot = ease(t, 0.25, 0.5, 0, 15, sineInOut);
  } else if (t < 0.75) {
    legBottomRot = ease(t, 0.5, 0.75, 15, 80, sineIn);
  } else {
    legBottomRot = ease(t, 0.75, 1.0, 80, 0, sineOut);
  }

  // Arm: -12 → 12 over 0..0.5 (sine.inOut), 12 → -12 over 0.5..1.0
  let armRot: number;
  if (t < 0.5) {
    armRot = ease(t, 0, 0.5, -12, 12, sineInOut);
  } else {
    armRot = ease(t, 0.5, 1.0, 12, -12, sineInOut);
  }

  // Arm-bottom: -15 → 10 over 0..0.5, 10 → -15 over 0.5..1.0
  let armBottomRot: number;
  if (t < 0.5) {
    armBottomRot = ease(t, 0, 0.5, -15, 10, sineInOut);
  } else {
    armBottomRot = ease(t, 0.5, 1.0, 10, -15, sineInOut);
  }

  return { legRot, legBottomRot, armRot, armBottomRot };
}

// ── Body bob + head wobble ──────────────────────────────────────────────────
// Body bob: 0 → -20 → 0 → -20 yoyo with sine.inOut, duration 0.25s each leg.
// Equivalent to a continuous sinusoid clamped against itself. We feed the
// global cycle time in.

function bodyBob(time: number): number {
  // Period 0.5s, sine ease-in-out between 0 and -20. Using -|sin|·20 gives the
  // yoyo character without a discontinuity.
  const phase = (time / 0.5) * Math.PI * 2;
  // half-period sine that lives in [-20, 0]
  return -10 + 10 * Math.cos(phase);
}

function headWobble(time: number): number {
  // -25 → 1 → -25 yoyo, period 0.5s. Same pattern as bodyBob.
  const mid = (-25 + 1) / 2;
  const amp = (1 - -25) / 2;
  const phase = (time / 0.5) * Math.PI * 2;
  return mid - amp * Math.cos(phase);
}

// ── Composition ─────────────────────────────────────────────────────────────

export const DudeWalk: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const p = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slide the four-section container from x=0 (section 1) to x=-TRAVEL
  // (section 4 fully in view).
  const contentTx = -TRAVEL * p;

  // Cycle times mirror the original scrub-tied timelines.
  const backCycleTime = interpolate(p, [0, 1], [0.7, 0.75 + NUMBER_OF_CYCLES]);
  const frontCycleTime = interpolate(p, [0, 1], [0.2, 0.25 + NUMBER_OF_CYCLES]);
  const bodyTime = backCycleTime; // body shares the back-cycle clock

  // Modulo each cycle time into [0, 1) for the half-body eval.
  const backLocal = ((backCycleTime % 1) + 1) % 1;
  const frontLocal = ((frontCycleTime % 1) + 1) % 1;

  const back = evalHalfBody(backLocal);
  const front = evalHalfBody(frontLocal);

  const bobY = bodyBob(bodyTime);
  const headRot = headWobble(bodyTime);

  // Arrow fades from 1 → 0 between p=0 and p=0.05. Plus a gentle continuous
  // up-down bob driven by the raw frame clock.
  const arrowOpacity = interpolate(p, [0, 0.05], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowBob = Math.sin((frame / 30) * Math.PI) * 8;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#E2D03E" }}>
      {/* Scrolling content row */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: TOTAL_W,
          height: VIEW_H,
          display: "flex",
          flexDirection: "row",
          transform: `translateX(${contentTx}px)`,
        }}
      >
        <Section bg="#E2D03E" textColor="#1a1a1a">
          <h1 style={h1Style}>Dude and Scroll</h1>
          <p
            style={{
              ...arrowStyle,
              opacity: arrowOpacity,
              transform: `translateY(${arrowBob}px)`,
            }}
          >
            ↓
          </p>
        </Section>

        <Section bg="#4DAE85" textColor="#ffffff">
          <h1 style={h1Style}>What&apos;s this?</h1>
          <p style={pStyle}>
            That&apos;s me learning the basic walk cycle animation and playing
            with the GSAP implementation of it.
          </p>
        </Section>

        <Section bg="#ED5D53" textColor="#ffffff">
          <h1 style={h1Style}>So what?</h1>
          <p style={pStyle}>
            You can use this code and design concept for your project.
          </p>
          <p style={pStyle}>
            The animation parameters are easy to tweak, graphic elements can be
            replaced.
          </p>
        </Section>

        <Section bg="#f5f5f5" textColor="#1a1a1a">
          <h1 style={{ ...h1Style, opacity: 0.3 }}>End of road.</h1>
        </Section>
      </div>

      {/* Fixed dude in the bottom-left corner */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "30%",
            height: "40%",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <svg
            viewBox="0 -10 315 350"
            style={{ width: "auto", height: "100%" }}
            preserveAspectRatio="xMidYMax meet"
          >
            <g
              transform={`translate(0, ${bobY})`}
              stroke="black"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            >
              {/* Back leg + leg-bottom (legs[0]) — uses back cycle */}
              <g transform={`rotate(${back.legRot} 177 145)`}>
                <path d="M171,220l6-60" />
                <g transform={`rotate(${back.legBottomRot} 171 220)`}>
                  <path d="M182,317l-10.4-2.8c-2.7-0.7-4.5-3.2-4.4-6c1.7-13,3-27,3.7-42.1c0.8-16.5,0.7-32,0.1-46.1" />
                </g>
              </g>

              {/* Front leg + leg-bottom (legs[1]) — uses front cycle */}
              <g transform={`rotate(${front.legRot} 177 145)`}>
                <path d="M171,222c0.3-10,4.3-42,5.3-48" />
                <g transform={`rotate(${front.legBottomRot} 171 220)`}>
                  <path d="M182,317l-10.2-2.7c-2.8-0.8-4.7-3.4-4.6-6.3c-0.8-13.9-1-29.2-0.2-45.8c0.7-15.2,2.1-29.4,4-42.2" />
                </g>
              </g>

              {/* Front arm (arms[0]) — uses front cycle */}
              <g transform={`rotate(${front.armRot} 180 58)`}>
                <path d="M175,75c-0.6,8.7-0.6,18.9,0.8,30.1c0.6,4.6,1.3,8.9,2.2,12.9" />
                <g transform={`rotate(${front.armBottomRot} 178 118)`}>
                  <path d="M186,175c-0.2-3.1-0.4-6.2-0.7-9.3c-1.5-16.9-4.1-32.9-7.3-47.7" />
                </g>
              </g>

              {/* Back arm (arms[1]) — uses back cycle */}
              <g transform={`rotate(${back.armRot} 180 58)`}>
                <path d="M178.8,82.2c-1.9,13.1-1.8,25.2-0.8,35.8" />
                <g transform={`rotate(${back.armBottomRot} 178 118)`}>
                  <path d="M186,175c-2.4-7.6-4.7-16.8-6.3-27.2c-1.6-11.3-2-21.3-1.7-29.8" />
                </g>
              </g>

              {/* Head */}
              <g transform={`rotate(${headRot} 180 45)`}>
                <path d="M195,14.8c-10.8-5.7-23.9,1.3-28.2,12.4c-4.9,13,6.3,28.4,17.8,29.1c13.2,0.8,22.2-16.1,19.5-26.7c-1.6-6.5-5.2-7.1-5.2-7.1" />
              </g>
            </g>
          </svg>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Section wrapper ────────────────────────────────────────────────────────

const Section: React.FC<{
  bg: string;
  textColor: string;
  children: React.ReactNode;
}> = ({ bg, textColor, children }) => (
  <div
    style={{
      width: SECTION_W,
      height: VIEW_H,
      backgroundColor: bg,
      color: textColor,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: "0 200px",
      boxSizing: "border-box",
      flexShrink: 0,
      fontFamily:
        "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}
  >
    <div style={{ maxWidth: 900, textAlign: "left", width: "100%" }}>
      {children}
    </div>
  </div>
);

const h1Style: React.CSSProperties = {
  fontSize: 96,
  fontWeight: 800,
  margin: 0,
  marginBottom: 24,
  letterSpacing: "-0.03em",
  lineHeight: 1.05,
};

const pStyle: React.CSSProperties = {
  fontSize: 28,
  lineHeight: 1.6,
  margin: 0,
  marginBottom: 16,
  maxWidth: 720,
  fontWeight: 500,
};

const arrowStyle: React.CSSProperties = {
  fontSize: 72,
  fontWeight: 400,
  margin: 0,
  marginTop: 24,
};

// Keep Easing import live so tsc doesn't strip the type cache. Unused at
// runtime — the local sine helpers cover everything.
void Easing;
