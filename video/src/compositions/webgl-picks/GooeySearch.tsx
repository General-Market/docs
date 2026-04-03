// Source: https://github.com/oguzhantufenk/gooey-search
//
// Gooey/liquid search bar animation — SVG filter blur + color matrix trick
// creates the organic blob merging effect between button and icon circle.
// Timeline: idle → expand → type → results cascade → collapse.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

// ── Timing (frames at 60fps) ────────────────────────────────────────────────

const EXPAND_START = 30; // 0.5s idle, then button expands
const EXPAND_END = 60;
const TYPE_START = 70;
const TYPE_END = 120;
const RESULTS_START = 130;
const RESULTS_STAGGER = 12; // 0.2s per result
const COLLAPSE_START = 230;
const COLLAPSE_END = 270;

// ── Data ────────────────────────────────────────────────────────────────────

const SEARCH_TEXT = "React";
const RESULTS = ["React", "React Native", "React Router", "React Query"];

// ── Colors (from original) ──────────────────────────────────────────────────

const BG = "#e5e7eb";
const PILL_BG = "#000000";
const TEXT_COLOR = "#dddddd";
const TEXT_DIM = "#ddddddaf";

// ── SVG Filter ──────────────────────────────────────────────────────────────

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

// ── Search Icon (from original — Radix magnifying glass) ────────────────────

const SearchIcon: React.FC<{ opacity: number; scale: number; blur: number }> = ({
  opacity,
  scale,
  blur,
}) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{
      opacity,
      transform: `scale(${scale})`,
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

// ── Info Icon (from original — Radix info circle) ───────────────────────────

const InfoIcon: React.FC<{ opacity: number }> = ({ opacity }) => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 15 15"
    style={{ width: 18, height: 18, opacity, flexShrink: 0 }}
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

// ── Loading Spinner (from original — 8-spoke pattern) ───────────────────────

const LoadingSpinner: React.FC<{ rotation: number }> = ({ rotation }) => {
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
  const isLoading = frame >= TYPE_END && frame < RESULTS_START;
  const showResults = frame >= RESULTS_START && frame < COLLAPSE_START;
  const isCollapsing = frame >= COLLAPSE_START;

  // Button width: 200 → 380 (expanded), matching original's 100 → 180 scaled 2x
  const pillWidth = interpolate(
    frame,
    [EXPAND_START, EXPAND_END, COLLAPSE_START, COLLAPSE_END],
    [200, 380, 380, 200],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Button horizontal shift on expand (original shifts x: -30)
  const pillShift = interpolate(
    frame,
    [EXPAND_START, EXPAND_END, COLLAPSE_START, COLLAPSE_END],
    [0, -60, -60, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Typing progress
  const typeProgress = interpolate(frame, [TYPE_START, TYPE_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const visibleChars = Math.floor(typeProgress * SEARCH_TEXT.length);
  const typedText = SEARCH_TEXT.slice(0, visibleChars);
  const showCursor = isExpanded && !isCollapsing && frame % 30 < 20;

  // Icon circle — springs in from left after expansion
  const iconSpring = spring({
    frame: frame - EXPAND_END,
    fps,
    config: { damping: 15, stiffness: 120, mass: 0.8 },
  });
  const iconX = isExpanded
    ? interpolate(iconSpring, [0, 1], [-50, 16])
    : -50;
  const iconOpacity = isExpanded
    ? interpolate(iconSpring, [0, 1], [0, 1])
    : 0;
  const iconBlur = isExpanded
    ? interpolate(iconSpring, [0, 1], [5, 0])
    : 5;

  // Collapse icon
  const collapseIconProgress = isCollapsing
    ? interpolate(frame, [COLLAPSE_START, COLLAPSE_START + 15], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  // Loading spinner rotation
  const spinnerRotation = interpolate(
    frame,
    [TYPE_END, RESULTS_START],
    [0, 360 * 2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // "Search" text fade for initial state
  const searchLabelOpacity = interpolate(
    frame,
    [EXPAND_START, EXPAND_START + 10],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Collapse text/results
  const collapseProgress = interpolate(
    frame,
    [COLLAPSE_START, COLLAPSE_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // "Search" label reappears on collapse
  const searchLabelReturn = interpolate(
    frame,
    [COLLAPSE_START + 15, COLLAPSE_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

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
        }}
      >
        {/* Search results — positioned behind the pill, goo merges them */}
        {showResults &&
          RESULTS.map((item, index) => {
            const resultFrame = frame - (RESULTS_START + index * RESULTS_STAGGER);
            const resultSpring = spring({
              frame: resultFrame,
              fps,
              config: { damping: 12, stiffness: 100, mass: 0.6 },
            });
            const resultY = interpolate(resultSpring, [0, 1], [0, (index + 1) * 50]);
            const resultScale = interpolate(resultSpring, [0, 1], [0.3, 1]);
            const resultBlur = interpolate(resultSpring, [0, 1], [10, 0]);
            const resultOpacity = resultFrame < 0 ? 0 : 1;

            // Collapse: shrink back
            const collapseScale = interpolate(
              collapseProgress,
              [0, 1],
              [1, 0.8],
            );
            const collapseY = interpolate(collapseProgress, [0, 1], [0, -4]);
            const collapseOp = interpolate(collapseProgress, [0, 1], [1, 0]);

            return (
              <div
                key={item}
                style={{
                  position: "absolute",
                  left: -60 + pillShift,
                  top: 0,
                  backgroundColor: PILL_BG,
                  borderRadius: 40,
                  padding: "12.5px 20px",
                  width: pillWidth,
                  color: TEXT_COLOR,
                  fontSize: 14,
                  letterSpacing: -0.5,
                  zIndex: -1,
                  opacity: resultOpacity * collapseOp,
                  transform: `translateY(${resultY + collapseY}px) scale(${resultScale * collapseScale})`,
                  filter: `blur(${resultBlur}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <InfoIcon
                  opacity={interpolate(
                    resultFrame,
                    [0, 8],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  )}
                />
                <span
                  style={{
                    opacity: interpolate(
                      resultFrame,
                      [0, 8],
                      [0, 1],
                      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                    ),
                  }}
                >
                  {item}
                </span>
              </div>
            );
          })}

        {/* Main search pill */}
        <div
          style={{
            backgroundColor: PILL_BG,
            borderRadius: 9999,
            padding: "10px 20px",
            width: pillWidth,
            transform: `translateX(${pillShift}px)`,
            color: TEXT_DIM,
            letterSpacing: -0.5,
            fontSize: 16,
            cursor: "pointer",
            position: "relative",
            height: 46,
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
                opacity: isCollapsing ? searchLabelReturn : searchLabelOpacity,
                color: TEXT_DIM,
                pointerEvents: "none",
              }}
            >
              Search
            </span>
          )}

          {/* Typed text (expanded state) */}
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
            right: -5 + (-pillShift),
            top: -1,
            width: 46,
            height: 46,
            backgroundColor: PILL_BG,
            borderRadius: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `translateX(${iconX}px)`,
            opacity: iconOpacity * collapseIconProgress,
          }}
        >
          {isLoading ? (
            <LoadingSpinner rotation={spinnerRotation} />
          ) : (
            <SearchIcon
              opacity={1}
              scale={1}
              blur={iconBlur}
            />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
