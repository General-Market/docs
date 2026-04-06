// Source: https://github.com/oguzhantufenk/gooey-search
//
// Gooey/liquid search bar — SVG filter blur + color matrix merges pill and icon
// circle into one organic blob. Ported from Framer Motion to Remotion frame math.
// Every dimension, spring config, color, and timing matched to the original.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// ── Timing (frames at 60fps) ────────────────────────────────────────────────
// Original flow: click → expand → type → debounce 500ms → loading 500ms → results → collapse
const EXPAND_START = 30; // idle 0.5s then expand
const EXPAND_DUR = 45; // 0.75s spring duration
const EXPAND_END = EXPAND_START + EXPAND_DUR;
const TYPE_START = EXPAND_END + 6; // slight pause before typing
const TYPE_END = TYPE_START + 30; // type "React" over 0.5s
const DEBOUNCE_END = TYPE_END + 30; // 500ms debounce
const LOADING_END = DEBOUNCE_END + 30; // 500ms fake fetch
const RESULTS_START = LOADING_END;
const RESULTS_STAGGER = 7; // index * 0.12s = ~7 frames at 60fps
const HOLD_RESULTS = 90; // show results for 1.5s
const COLLAPSE_START = RESULTS_START + HOLD_RESULTS;
const COLLAPSE_DUR = 45; // 0.75s collapse
const COLLAPSE_END = COLLAPSE_START + COLLAPSE_DUR;

// ── Data ────────────────────────────────────────────────────────────────────
const SEARCH_TEXT = "React";
const RESULTS = ["React", "React Native", "React Router", "React Query"];

// ── Colors (exact from original SCSS) ───────────────────────────────────────
const BG = "#e5e7eb";
const PILL_BG = "#000000";
const TEXT_COLOR = "#dddddd";
const TEXT_DIM = "#ddddddaf";

// ── SVG Gooey Filter (identical to original) ────────────────────────────────
const GooeyFilter: React.FC = () => (
  <svg
    style={{ position: "absolute", width: 0, height: 0 }}
    aria-hidden="true"
  >
    <defs>
      <filter id="goo-effect">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -15"
          result="goo"
        />
        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
      </filter>
    </defs>
  </svg>
);

// ── Search Icon (Radix magnifying glass — exact SVG from original) ──────────
// Original: motion.svg with initial { opacity:0, scale:0.8, x:-4, blur:5px }
//           animate { opacity:1, scale:1, x:0, blur:0 }
//           transition { delay:0.1, duration:1, spring, bounce:0.15 }
const SearchIcon: React.FC<{
  frame: number;
  fps: number;
  appearFrame: number;
}> = ({ frame, fps, appearFrame }) => {
  const elapsed = frame - appearFrame;
  const s = spring({
    frame: Math.max(0, elapsed - 6), // 0.1s delay = 6 frames
    fps,
    config: { damping: 18, stiffness: 100, mass: 1 },
  });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const scale = interpolate(s, [0, 1], [0.8, 1]);
  const x = interpolate(s, [0, 1], [-4, 0]);
  const blur = interpolate(s, [0, 1], [5, 0]);

  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        opacity,
        transform: `scale(${scale}) translateX(${x}px)`,
        filter: `blur(${blur}px)`,
      }}
    >
      <path
        d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill={TEXT_COLOR}
      />
    </svg>
  );
};

// ── Info Icon (exact SVG path + viewBox from original) ──────────────────────
const InfoIcon: React.FC<{ opacity: number }> = ({ opacity }) => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20.2832 19.9316"
    style={{ width: 18, height: 18, opacity, flexShrink: 0, position: "relative", top: 2 }}
    fill="none"
  >
    <path
      d="M7.49991 0.876892C3.84222 0.876892 0.877075 3.84204 0.877075 7.49972C0.877075 11.1574 3.84222 14.1226 7.49991 14.1226C11.1576 14.1226 14.1227 11.1574 14.1227 7.49972C14.1227 3.84204 11.1576 0.876892 7.49991 0.876892ZM1.82707 7.49972C1.82707 4.36671 4.36689 1.82689 7.49991 1.82689C10.6329 1.82689 13.1727 4.36671 13.1727 7.49972C13.1727 10.6327 10.6329 13.1726 7.49991 13.1726C4.36689 13.1726 1.82707 10.6327 1.82707 7.49972ZM8.24992 4.49999C8.24992 4.9142 7.91413 5.24999 7.49992 5.24999C7.08571 5.24999 6.74992 4.9142 6.74992 4.49999C6.74992 4.08577 7.08571 3.74999 7.49992 3.74999C7.91413 3.74999 8.24992 4.08577 8.24992 4.49999ZM6.00003 5.99999H6.50003H7.50003C7.77618 5.99999 8.00003 6.22384 8.00003 6.49999V9.99999H8.50003H9.00003V11H8.50003H7.50003H6.50003H6.00003V9.99999H6.50003H7.00003V6.99999H6.50003H6.00003V5.99999Z"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
    />
  </svg>
);

// ── Loading Spinner (exact 8 spokes, CSS animation → frame rotation) ────────
// Original: CSS animation rotate 0.5s linear infinite → 180deg per 0.5s = 360deg/s
const LoadingSpinner: React.FC<{ frame: number; startFrame: number }> = ({
  frame,
  startFrame,
}) => {
  const elapsed = frame - startFrame;
  const rotation = (elapsed / 60) * 360; // 360deg per second, matching original
  const lines = [
    { x1: 128, y1: 32, x2: 128, y2: 64 },
    { x1: 195.88, y1: 60.12, x2: 173.25, y2: 82.75 },
    { x1: 224, y1: 128, x2: 192, y2: 128 },
    { x1: 195.88, y1: 195.88, x2: 173.25, y2: 173.25 },
    { x1: 128, y1: 224, x2: 128, y2: 192 },
    { x1: 60.12, y1: 195.88, x2: 82.75, y2: 173.25 },
    { x1: 32, y1: 128, x2: 64, y2: 128 },
    { x1: 60.12, y1: 60.12, x2: 82.75, y2: 82.75 },
  ];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      style={{
        width: 20,
        height: 20,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <rect width="256" height="256" fill="none" />
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          fill="none"
          stroke={TEXT_COLOR}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="16"
        />
      ))}
    </svg>
  );
};

// ── Main Composition ────────────────────────────────────────────────────────

export const GooeySearch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase detection
  const isExpanded = frame >= EXPAND_START && frame < COLLAPSE_START;
  const isLoading = frame >= DEBOUNCE_END && frame < LOADING_END;
  const showResults = frame >= RESULTS_START && frame < COLLAPSE_START;
  const isCollapsing = frame >= COLLAPSE_START;

  // ── Button width: 100 → 180 (original variants) ────────────────────────
  // Original: spring { duration: 0.75, type: spring, bounce: 0.15 }
  const expandSpring = spring({
    frame: frame - EXPAND_START,
    fps,
    config: { damping: 18, stiffness: 100, mass: 1 },
  });
  const collapseSpring = spring({
    frame: frame - COLLAPSE_START,
    fps,
    config: { damping: 18, stiffness: 100, mass: 1 },
  });

  let pillWidth: number;
  let pillX: number;
  if (isCollapsing) {
    // Collapsing: 180 → 100, x: -30 → 0
    pillWidth = interpolate(collapseSpring, [0, 1], [180, 100]);
    pillX = interpolate(collapseSpring, [0, 1], [-30, 0]);
  } else if (frame >= EXPAND_START) {
    // Expanding: 100 → 180, x: 0 → -30
    pillWidth = interpolate(expandSpring, [0, 1], [100, 180]);
    pillX = interpolate(expandSpring, [0, 1], [0, -30]);
  } else {
    pillWidth = 100;
    pillX = 0;
  }

  // ── Typing ──────────────────────────────────────────────────────────────
  const typeProgress = interpolate(frame, [TYPE_START, TYPE_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const visibleChars = Math.floor(typeProgress * SEARCH_TEXT.length);
  const typedText = SEARCH_TEXT.slice(0, visibleChars);
  const showCursor = isExpanded && !isCollapsing && frame % 30 < 20;

  // ── Icon circle (separate gooey element) ────────────────────────────────
  // Original: variants hidden { x: -50, opacity: 0 } → visible { x: 16, opacity: 1 }
  // Transition: delay 0.1, duration 0.85, spring, bounce 0.15
  const iconSpring = spring({
    frame: Math.max(0, frame - EXPAND_END - 6), // 0.1s delay
    fps,
    config: { damping: 18, stiffness: 100, mass: 1 },
  });
  const iconX = isExpanded ? interpolate(iconSpring, [0, 1], [-50, 16]) : -50;
  const iconOpacity = isExpanded ? interpolate(iconSpring, [0, 1], [0, 1]) : 0;

  // Icon exit on collapse: reverse spring
  const iconExitSpring = spring({
    frame: frame - COLLAPSE_START,
    fps,
    config: { damping: 18, stiffness: 100, mass: 1 },
  });
  const iconExitX = isCollapsing
    ? interpolate(iconExitSpring, [0, 1], [16, -50])
    : iconX;
  const iconExitOpacity = isCollapsing
    ? interpolate(iconExitSpring, [0, 1], [1, 0])
    : iconOpacity;

  // ── "Search" label ──────────────────────────────────────────────────────
  const searchLabelFadeOut = interpolate(
    frame,
    [EXPAND_START, EXPAND_START + 8],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const searchLabelFadeIn = interpolate(
    frame,
    [COLLAPSE_START + 15, COLLAPSE_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ── Results wrapper exit ────────────────────────────────────────────────
  // Original: exit { scale: 0, opacity: 0 } with delay: 1.25, duration: 0.5
  const resultsWrapperCollapse = isCollapsing
    ? interpolate(
        frame,
        [COLLAPSE_START, COLLAPSE_START + 30],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 1;
  const resultsWrapperScale = isCollapsing
    ? interpolate(
        frame,
        [COLLAPSE_START, COLLAPSE_START + 30],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <GooeyFilter />

      {/* Gooey-filtered container — the core trick */}
      <div
        style={{
          position: "relative",
          filter: "url(#goo-effect)",
          cursor: "pointer",
          maxWidth: "max-content",
        }}
      >
        {/* Search results — positioned behind the pill, goo merges them */}
        {showResults && (
          <div
            style={{
              position: "relative",
              zIndex: -1,
              opacity: resultsWrapperCollapse,
              transform: `scale(${resultsWrapperScale})`,
            }}
          >
            {RESULTS.map((item, index) => {
              const resultDelay = index * RESULTS_STAGGER;
              const resultFrame = frame - (RESULTS_START + resultDelay);

              // Original spring: duration 0.75, delay index*0.12, type spring, bounce 0.35
              const resultSpring = spring({
                frame: Math.max(0, resultFrame),
                fps,
                config: { damping: 10, stiffness: 100, mass: 0.6 },
              });
              const resultY = interpolate(
                resultSpring,
                [0, 1],
                [0, (index + 1) * 50],
              );
              const resultScale = interpolate(resultSpring, [0, 1], [0.3, 1]);
              const resultBlur = interpolate(resultSpring, [0, 1], [10, 0]);
              const resultVisible = resultFrame >= 0;

              // Result exit: y → -4, scale → 0.8, exit duration index * 0.1
              const exitProgress = isCollapsing
                ? interpolate(
                    frame,
                    [
                      COLLAPSE_START,
                      COLLAPSE_START + Math.max(6, index * 6),
                    ],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  )
                : 0;
              const exitY = interpolate(exitProgress, [0, 1], [0, -4]);
              const exitScale = interpolate(exitProgress, [0, 1], [1, 0.8]);
              const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0]);

              // Text + icon fade: delay index * 0.12 + 0.3 = resultDelay + 18 frames
              const textFadeFrame = resultFrame - 18;
              const textOpacity = interpolate(
                textFadeFrame,
                [0, 8],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

              if (!resultVisible && !isCollapsing) return null;

              return (
                <div
                  key={item}
                  style={{
                    position: "absolute",
                    left: pillX - 30 + "px", // original: left: -30px (relative to button)
                    top: 0,
                    backgroundColor: PILL_BG,
                    borderRadius: 40,
                    padding: "12.5px 20px",
                    width: pillWidth,
                    color: TEXT_COLOR,
                    fontSize: 14,
                    opacity: exitOpacity,
                    transform: `translateY(${resultY + exitY}px) scale(${resultScale * exitScale})`,
                    filter: `blur(${resultBlur}px)`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1, // original: gap: 1px
                    }}
                  >
                    <InfoIcon opacity={textOpacity} />
                    <span
                      style={{
                        opacity: textOpacity,
                        position: "relative",
                        top: -0.35,
                      }}
                    >
                      {item}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Main search pill */}
        <div
          style={{
            backgroundColor: PILL_BG,
            borderRadius: 9999,
            padding: "10px 20px",
            width: pillWidth,
            transform: `translateX(${pillX}px)`,
            color: TEXT_DIM,
            letterSpacing: -0.5,
            cursor: "pointer",
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* "Search" label (initial + return state) */}
          {(!isExpanded || isCollapsing) && (
            <span
              style={{
                textAlign: "center",
                width: "100%",
                opacity: isCollapsing ? searchLabelFadeIn : searchLabelFadeOut,
                color: TEXT_DIM,
                pointerEvents: "none",
                position: "relative",
                left: 4, // original: left: 4px
              }}
            >
              Search
            </span>
          )}

          {/* Typed text + cursor (expanded state) */}
          {isExpanded && !isCollapsing && (
            <span style={{ color: TEXT_COLOR }}>
              {typedText}
              <span
                style={{
                  opacity: showCursor ? 1 : 0,
                  color: TEXT_DIM,
                  marginLeft: 1,
                }}
              >
                |
              </span>
            </span>
          )}
        </div>

        {/* Separate gooey circle — search/loading icon */}
        <div
          style={{
            position: "absolute",
            right: -5,
            top: -1,
            width: 46,
            height: 46,
            backgroundColor: PILL_BG,
            borderRadius: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `translateX(${isCollapsing ? iconExitX : iconX}px)`,
            opacity: isCollapsing ? iconExitOpacity : iconOpacity,
          }}
        >
          {isLoading ? (
            <LoadingSpinner frame={frame} startFrame={DEBOUNCE_END} />
          ) : (
            <SearchIcon frame={frame} fps={fps} appearFrame={EXPAND_END} />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
