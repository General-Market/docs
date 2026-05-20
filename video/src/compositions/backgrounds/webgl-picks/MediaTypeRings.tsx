// A media-type donut diagram dragged from a jQuery slider into the frame
// clock. The source TweenMax timeline cued drawSVG strokes and staggered
// rotations as the user scrubbed; here the scrub is replaced by a single
// monotone progress value that runs out, holds, and yoyos back — the chart
// builds itself, exhales, then unbuilds itself, indefinitely.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// Geometry of the inner donut path — a circle, r=170, centered at (389, 294).
const RING_LENGTH = 2 * Math.PI * 170; // ≈ 1068.1415
const LINE_LENGTH = 200; // mt-line vertical drop
const MARKER_LENGTH = 90; // mt-marker tick height

// Per ring [Radio, TV, Print, Online]
const PERCS = [22, 17, 57, 4];
const RING_COLORS = ["#00a2d1", "#0ad100", "#f67521", "#f60d1a"];

// Pre-compute the geometry derived in the original JS.
const RING_RANGES: Array<[number, number]> = [];
const PERCS_END: number[] = [];
const MARKERS_ANGLES: number[] = [];
{
  let add = 0;
  for (let i = 0; i < PERCS.length; i++) {
    PERCS_END.push(add);
    const start = add;
    add += PERCS[i];
    RING_RANGES.push([start, add]);
    MARKERS_ANGLES.push(((start + (add - start) / 2) / 100) * 360);
  }
  // Source reverses these arrays so the longest rotation fires first.
  PERCS_END.reverse();
  MARKERS_ANGLES.reverse();
}

// Cubic-bezier eases approximated from GSAP's named curves.
const EASE_POWER3_IN = Easing.bezier(0.4, 0, 1, 1);
const EASE_POWER3_OUT = Easing.bezier(0, 0, 0.2, 1);
const EASE_POWER4_INOUT = Easing.bezier(0.7, 0, 0.3, 1);
const EASE_ELASTIC_OUT = Easing.elastic(1);

// Run a sub-clip of the master 0..1 progress through an ease.
function clip(
  t: number,
  start: number,
  end: number,
  ease: (x: number) => number,
): number {
  if (t <= start) return 0;
  if (t >= end) return 1;
  return ease((t - start) / (end - start));
}

export const MediaTypeRings: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const raw = frame / Math.max(1, durationInFrames - 1);

  // 0..0.55 forward, 0.55..0.70 hold, 0.70..1 reverse — yoyo across the scene.
  let t: number;
  if (raw < 0.55) {
    t = raw / 0.55;
  } else if (raw < 0.7) {
    t = 1;
  } else {
    t = 1 - (raw - 0.7) / 0.3;
  }

  // ── Sub-timings inside t∈[0,1] ──
  // mt-line draws 0→200px (0.4s with delay 0.3), then collapses to "200px 150px"
  // (visible window from 150→200). Original total intro ≈ 4s ⇒ scale by 1/4.
  const lineDraw = clip(t, 0.075, 0.175, EASE_POWER3_IN); // line drops
  const lineShrink = clip(t, 0.175, 0.25, EASE_POWER3_OUT); // top half retracts

  // After the line collapses, perc-lines take over (opacity swap).
  const lineOpacity = t > 0.26 ? 0 : 1;
  const percLineOpacity = t > 0.26 ? 1 : 0;

  // Thick white base ring draws from 0..100% over a long ease.
  const base2Draw = clip(t, 0.25, 0.6, EASE_POWER4_INOUT);
  // Light grey track behind the colored rings.
  const trackDraw = clip(t, 0.22, 0.475, EASE_POWER4_INOUT);

  // Stagger the four divider rotations: 0.1s offsets in original, scaled.
  const percLineProgress = (i: number) =>
    clip(t, 0.32 + i * 0.025, 0.67 + i * 0.025, EASE_POWER4_INOUT);

  // Marker lines: rotate + draw at the same pace, staggered.
  const markerProgress = (i: number) =>
    clip(t, 0.4 + i * 0.025, 0.6 + i * 0.025, EASE_POWER4_INOUT);

  // Colored rings: draw out their dash window after markers settle.
  const ringProgress = (i: number) =>
    clip(t, 0.45 + i * 0.025, 0.8 + i * 0.025, EASE_POWER4_INOUT);

  // Center MEDIA TYPE label — bouncy entrance from below.
  const textProgress = clip(t, 0.3, 0.55, EASE_ELASTIC_OUT);
  const textY = interpolate(textProgress, [0, 1], [50, 0]);
  const textOpacity = interpolate(textProgress, [0, 0.3, 1], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Figures fade in at the tail.
  const figuresOpacity = clip(t, 0.7, 0.92, EASE_POWER3_OUT);

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(to right, #ed30a0 0%, #0b86a6 100%)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg
        viewBox="0 0 778 590"
        style={{
          width: 1100,
          height: "auto",
          overflow: "visible",
        }}
      >
        {/* Outer faint guide ring */}
        <circle
          cx="389"
          cy="294"
          r="209"
          fill="none"
          stroke="#fff"
          strokeMiterlimit={10}
          strokeWidth={1.01}
          opacity={0.3}
        />

        {/* Thick white base ring, drawn 0→100%. Rotated -90 so drawing starts
            at the top, matching the source. */}
        <g transform="rotate(-90 389 294)">
          <path
            d="M559,294A170,170,0,1,1,389,124,170,170,0,0,1,559,294Z"
            fill="none"
            stroke="#fff"
            strokeMiterlimit={10}
            strokeWidth={40}
            strokeDasharray={`${base2Draw * RING_LENGTH} ${RING_LENGTH}`}
          />
        </g>

        {/* Light grey track behind the colored rings */}
        <g transform="rotate(-90 389 294)">
          <path
            d="M389,124A170,170,0,1,1,219,294,170,170,0,0,1,389,124Z"
            fill="none"
            stroke="#eeeeee"
            strokeMiterlimit={10}
            strokeWidth={10}
            strokeDasharray={`${trackDraw * RING_LENGTH} ${RING_LENGTH}`}
          />
        </g>

        {/* Four colored ring segments */}
        {RING_RANGES.map(([a, b], i) => {
          const segLen = ((b - a) / 100) * RING_LENGTH;
          const drawn = ringProgress(i) * segLen;
          // The donut path starts at (389,124) — the top — and runs clockwise.
          // To position a segment whose first edge sits at `a%`, rotate the
          // whole ring by a% of 360 around the center.
          const rot = (a / 100) * 360;
          return (
            <g
              key={i}
              transform={`rotate(${rot} 389 294)`}
            >
              <path
                d="M389,124A170,170,0,1,1,219,294,170,170,0,0,1,389,124Z"
                fill="none"
                stroke={RING_COLORS[i]}
                strokeMiterlimit={10}
                strokeWidth={10}
                strokeDasharray={`${drawn} ${RING_LENGTH}`}
              />
            </g>
          );
        })}

        {/* MEDIA TYPE label, elastic-in from below */}
        <g
          transform={`translate(0 ${textY})`}
          opacity={textOpacity}
        >
          <text
            x="308"
            y="303"
            fontSize="30"
            fill="#fff"
            fontFamily="'Poppins', 'Inter', sans-serif"
            fontWeight={300}
          >
            MEDIA TYPE
          </text>
        </g>

        {/* mt-line: the descending tick that lands on the donut. Drawn from
            (389, 94) down to (389, 294). drawSVG '0px 200px' = full draw;
            then drawSVG '200px 150px' shrinks the visible window from the
            top, so the bottom 50px remains, anchored at the donut. */}
        {(() => {
          const drawn = lineDraw * LINE_LENGTH; // 0..200
          const shrunk = lineShrink * 50; // 0..50 hides the top portion
          const visibleLen = Math.max(0, drawn - shrunk);
          return (
            <line
              x1="389"
              y1="294"
              x2="389"
              y2="94"
              stroke="#fff"
              strokeMiterlimit={10}
              strokeWidth={2}
              strokeDasharray={`${visibleLen} ${LINE_LENGTH}`}
              strokeDashoffset={-shrunk}
              opacity={lineOpacity}
            />
          );
        })()}

        {/* Four divider lines that rotate to the cumulative segment edges */}
        <g opacity={percLineOpacity}>
          {PERCS_END.map((end, i) => {
            const p = percLineProgress(i);
            const rot = (end / 100) * 360 * p;
            return (
              <rect
                key={i}
                x="388"
                y="94"
                width="2"
                height="49"
                fill="#fff"
                transform={`rotate(${rot} 389 294)`}
                style={{ transformBox: "fill-box" }}
              />
            );
          })}
        </g>

        {/* Four marker ticks that grow outward then rotate to mid-arc angles */}
        <g fill="none" stroke="#fff" strokeMiterlimit={10}>
          {MARKERS_ANGLES.map((target, i) => {
            const p = markerProgress(i);
            const rot = target * p;
            const drawn = p * MARKER_LENGTH;
            return (
              <line
                key={i}
                x1="389.5"
                y1="107"
                x2="389.5"
                y2="17"
                strokeDasharray={`${drawn} ${MARKER_LENGTH}`}
                strokeDashoffset={MARKER_LENGTH - drawn}
                transform={`rotate(${rot} 389 294)`}
              />
            );
          })}
        </g>

        {/* Legend labels — fade in once everything else has settled. */}
        <g opacity={figuresOpacity} fontFamily="'Poppins', 'Inter', sans-serif">
          <text x="260" y="20" fontSize="14" fill="#fff" fontWeight={300}>
            ONLINE - <tspan fontWeight={600}>4%</tspan>
          </text>
          <text x="578" y="78" fontSize="14" fill="#fff" fontWeight={300}>
            RADIO - <tspan fontWeight={600}>22%</tspan>
          </text>
          <text x="664" y="398" fontSize="14" fill="#fff" fontWeight={300}>
            TV - <tspan fontWeight={600}>17%</tspan>
          </text>
          <text x="56" y="432" fontSize="14" fill="#fff" fontWeight={300}>
            PRINT - <tspan fontWeight={600}>57%</tspan>
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
