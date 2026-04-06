import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  AbsoluteFill,
} from "remotion";
import {
  baseText,
  GREEN,
  LightBg,
  Center,
  easeOutExpo,
  progress,
  sceneFade,
} from "../shared";

// ── Layout constants ──

const W = 1920;
const H = 1080;
const CENTER_X = W / 2;
const CENTER_Y = H / 2;

// The bracket spans most of the frame, leaving padding at edges
const BRACKET_HEIGHT = 920;
const BRACKET_TOP = (H - BRACKET_HEIGHT) / 2;

// Rounds: 32 → 16 → 8 → 4 → 2 → 1 (5 merge rounds per side, 6 columns of slots)
const ROUNDS = 6; // columns of "slots" per side (round 0 = 32 teams, round 5 = 1 finalist)
const MERGE_ROUNDS = 5; // connector groups per side

// Horizontal spacing
const SIDE_WIDTH = 680; // total horizontal span per side
const ROUND_DX = SIDE_WIDTH / MERGE_ROUNDS;

// Slot dimensions (the small rectangles representing teams)
const SLOT_W = 56;
const SLOT_H = 18;

// ── Helpers ──

/** Compute Y positions for slots in a given round */
function slotYs(round: number): number[] {
  const count = Math.pow(2, MERGE_ROUNDS - round); // 32, 16, 8, 4, 2, 1
  const ys: number[] = [];
  if (count === 1) {
    ys.push(CENTER_Y);
  } else {
    const totalSpan = BRACKET_HEIGHT;
    const gap = totalSpan / count;
    for (let i = 0; i < count; i++) {
      ys.push(BRACKET_TOP + gap * (i + 0.5));
    }
  }
  return ys;
}

/** X position of slots for a given round and side */
function slotX(round: number, side: "left" | "right"): number {
  if (side === "left") {
    // Round 0 (32 teams) is at far left, increasing rounds move right toward center
    return CENTER_X - SIDE_WIDTH + round * ROUND_DX - SLOT_W / 2;
  }
  // Right side: round 0 at far right, increasing rounds move left toward center
  return CENTER_X + SIDE_WIDTH - round * ROUND_DX - SLOT_W / 2;
}

// ── Sparkle SVG (6-pointed asterisk like in the reference) ──

const Sparkle: React.FC<{ scale: number; rotation: number }> = ({
  scale,
  rotation,
}) => {
  const size = 52;
  const cx = size / 2;
  const cy = size / 2;
  const spokes = 6;
  const outerR = 22;
  const innerR = 6;

  const paths: string[] = [];
  for (let i = 0; i < spokes; i++) {
    const angle = (Math.PI * 2 * i) / spokes - Math.PI / 2;
    const ox = cx + Math.cos(angle) * outerR;
    const oy = cy + Math.sin(angle) * outerR;
    // Tapered spoke via quadratic control at inner radius perpendicular
    const perpL = angle - Math.PI / 2;
    const perpR = angle + Math.PI / 2;
    const cxL = cx + Math.cos(perpL) * innerR * 0.35;
    const cyL = cy + Math.sin(perpL) * innerR * 0.35;
    const cxR = cx + Math.cos(perpR) * innerR * 0.35;
    const cyR = cy + Math.sin(perpR) * innerR * 0.35;
    paths.push(`M${cx},${cy} L${cxL},${cyL} L${ox},${oy} L${cxR},${cyR} Z`);
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        transformOrigin: "center center",
      }}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} fill={GREEN} />
      ))}
    </svg>
  );
};

// ── Bracket line generation ──

interface BracketElement {
  /** Which merge round this connector belongs to (0 = outermost, 4 = innermost) */
  mergeRound: number;
  d: string;
}

function generateBracketPaths(side: "left" | "right"): BracketElement[] {
  const elements: BracketElement[] = [];

  for (let mr = 0; mr < MERGE_ROUNDS; mr++) {
    const fromYs = slotYs(mr);
    const toYs = slotYs(mr + 1);

    for (let pair = 0; pair < toYs.length; pair++) {
      const y1 = fromYs[pair * 2]; // top slot of the pair
      const y2 = fromYs[pair * 2 + 1]; // bottom slot of the pair
      const yMid = toYs[pair]; // destination slot

      if (side === "left") {
        // From right edge of "from" slots → vertical bar → horizontal to "to" slot
        const x0 = slotX(mr, "left") + SLOT_W; // right edge of source slot
        const x1 = slotX(mr, "left") + SLOT_W + (ROUND_DX - SLOT_W) * 0.5; // vertical bar x
        const x2 = slotX(mr + 1, "left"); // left edge of destination slot

        // Top horizontal
        // Vertical connector
        // Bottom horizontal
        // Horizontal to next slot
        const d = [
          `M${x0},${y1} L${x1},${y1}`, // top arm
          `M${x0},${y2} L${x1},${y2}`, // bottom arm
          `M${x1},${y1} L${x1},${y2}`, // vertical
          `M${x1},${yMid} L${x2},${yMid}`, // outgoing
        ].join(" ");

        elements.push({ mergeRound: mr, d });
      } else {
        // Right side: mirror
        const x0 = slotX(mr, "right"); // left edge of source slot
        const x1 = slotX(mr, "right") - (ROUND_DX - SLOT_W) * 0.5; // vertical bar x
        const x2 = slotX(mr + 1, "right") + SLOT_W; // right edge of destination slot

        const d = [
          `M${x0},${y1} L${x1},${y1}`,
          `M${x0},${y2} L${x1},${y2}`,
          `M${x1},${y1} L${x1},${y2}`,
          `M${x1},${yMid} L${x2},${yMid}`,
        ].join(" ");

        elements.push({ mergeRound: mr, d });
      }
    }
  }

  return elements;
}

// Pre-compute paths (they don't change per frame)
const leftPaths = generateBracketPaths("left");
const rightPaths = generateBracketPaths("right");

// Total connector count for the counter: 32+16+8+4+2 = 62 connectors, plus 1 final = 63
// Actually: 63 total games in a 64-team bracket

// ── Component ──

export const Scene03_Bracket: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TOTAL = 120;
  const fade = sceneFade(frame, TOTAL);

  // Draw timing: outer rounds first, inner rounds last
  // Spread across frames 0–90, leaving 30 frames of full bracket + hold
  const DRAW_START = 2;
  const DRAW_DUR_PER_ROUND = 14;

  // Counter: counts 0→63 over frames 10–95
  const counterTarget = 63;
  const counterRaw = progress(frame, 10, 85) * counterTarget;
  const counterVal = Math.min(counterTarget, Math.floor(counterRaw));

  // Sparkle
  const sparkleScale = spring({
    frame: Math.max(0, frame - 8),
    fps,
    from: 0,
    to: 1,
    config: { damping: 12, stiffness: 80 },
  });
  const sparkleRotation = interpolate(frame, [8, TOTAL], [0, 60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Counter box opacity
  const counterOpacity = interpolate(frame, [12, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />

      {/* SVG bracket */}
      <svg
        width={W}
        height={H}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {/* Team slot rectangles for both sides */}
        {(["left", "right"] as const).map((side) =>
          Array.from({ length: ROUNDS }, (_, round) => {
            const ys = slotYs(round);
            const x = slotX(round, side);
            // Slot appear timing: outer rounds first
            const slotEnter = DRAW_START + round * DRAW_DUR_PER_ROUND;
            const slotP = progress(frame, slotEnter, 10);
            const slotOpacity = easeOutExpo(slotP);

            return ys.map((y, i) => (
              <rect
                key={`slot-${side}-${round}-${i}`}
                x={x}
                y={y - SLOT_H / 2}
                width={SLOT_W}
                height={SLOT_H}
                rx={3}
                ry={3}
                fill="none"
                stroke={GREEN}
                strokeWidth={1.5}
                opacity={slotOpacity}
              />
            ));
          }),
        )}

        {/* Connector lines — left */}
        {leftPaths.map((el, i) => {
          const lineEnter =
            DRAW_START + el.mergeRound * DRAW_DUR_PER_ROUND + 5;
          const lineP = progress(frame, lineEnter, DRAW_DUR_PER_ROUND);
          const lineEased = easeOutExpo(lineP);

          // Animate via stroke-dashoffset
          // Approximate total path length for this connector group
          const approxLen = ROUND_DX * 3 + BRACKET_HEIGHT / Math.pow(2, el.mergeRound + 1);

          return (
            <path
              key={`left-${i}`}
              d={el.d}
              fill="none"
              stroke={GREEN}
              strokeWidth={2}
              strokeDasharray={approxLen}
              strokeDashoffset={approxLen * (1 - lineEased)}
            />
          );
        })}

        {/* Connector lines — right */}
        {rightPaths.map((el, i) => {
          const lineEnter =
            DRAW_START + el.mergeRound * DRAW_DUR_PER_ROUND + 5;
          const lineP = progress(frame, lineEnter, DRAW_DUR_PER_ROUND);
          const lineEased = easeOutExpo(lineP);

          const approxLen = ROUND_DX * 3 + BRACKET_HEIGHT / Math.pow(2, el.mergeRound + 1);

          return (
            <path
              key={`right-${i}`}
              d={el.d}
              fill="none"
              stroke={GREEN}
              strokeWidth={2}
              strokeDasharray={approxLen}
              strokeDashoffset={approxLen * (1 - lineEased)}
            />
          );
        })}
      </svg>

      {/* Center sparkle + counter */}
      <Center>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Sparkle scale={sparkleScale} rotation={sparkleRotation} />
          <div
            style={{
              opacity: counterOpacity,
              border: `1.5px solid ${GREEN}`,
              borderRadius: 4,
              padding: "4px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                ...baseText,
                fontSize: 32,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: "#000",
              }}
            >
              {counterVal}/{counterTarget}
            </span>
          </div>
        </div>
      </Center>
    </AbsoluteFill>
  );
};
