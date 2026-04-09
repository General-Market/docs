import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { FPS, BRAND_GREEN, PANEL } from "../theme";
import { PARIMUTUEL, COMPARISONS } from "../proofData";

// ---------------------------------------------------------------------------
// Timing — local seconds (component starts at 0 = video 131.5s)
// ---------------------------------------------------------------------------

const sec = (s: number) => Math.round(s * FPS);

// Diagram 1: Parimutuel Pool (131.5–142.4 = local 0–10.9)
const POOL_IN = sec(0);
const POOL_FILL = sec(1.5);
const POOL_ARROW = sec(3.5);
const POOL_CALC = sec(5.5);
const POOL_PROOF = sec(7.5);
const POOL_OUT = sec(10.9);

// Diagram 2: 30x Computation Grid (142.4–150.4 = local 10.9–18.9)
const GRID_IN = sec(10.9);
const GRID_FLASH_START = sec(12);
const GRID_FLASH_END = sec(14.5);
const WATERFALL_IN = sec(14.5);
const WATERFALL_END = sec(17.5);
const GRID_OUT = sec(18.9);

// Diagram 3: Risk Cap (150.4–159.7 = local 18.9–28.2)
const RISK_IN = sec(18.9);
const RISK_BARS = sec(20);
const RISK_MATCH = sec(22);
const RISK_RETURN = sec(24);
const RISK_OUT = sec(28.2);

// Diagram 4: Settlement Summary (159.7–161.4 = local 28.2–29.9)
const SUMMARY_IN = sec(28.2);
const SUMMARY_OUT = sec(29.9);

// Colors
const GREEN = BRAND_GREEN;
const RED = "#ef4444";
const DIM = "rgba(255,255,255,0.45)";
const BRIGHT = "#fafafa";
const GOLD = "#fbbf24";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fadeEnterExit(
  frame: number,
  enterStart: number,
  exitEnd: number,
  fadeFrames = 10,
) {
  const enterOp = interpolate(frame, [enterStart, enterStart + fadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOp = interpolate(frame, [exitEnd - fadeFrames, exitEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(enterOp, exitOp);
}

function slideInY(frame: number, start: number, fps: number, from = 30) {
  const s = spring({
    frame: Math.max(frame - start, 0),
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.7 },
  });
  return interpolate(s, [0, 1], [from, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ---------------------------------------------------------------------------
// Parasite Label — floating annotation with leader line
// ---------------------------------------------------------------------------

const ParasiteLabel: React.FC<{
  text: string;
  x: number;
  y: number;
  opacity: number;
  color?: string;
  anchor?: "left" | "right" | "center";
}> = ({ text, x, y, opacity, color = DIM, anchor = "center" }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.03 * Math.sin(frame * 0.12);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        transform: `scale(${pulse}) translateX(${anchor === "right" ? "-100%" : anchor === "center" ? "-50%" : "0"})`,
        fontFamily: monoFont,
        fontSize: 13,
        fontWeight: 500,
        color,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 1. Parimutuel Pool Diagram (0–10.9s local)
// ---------------------------------------------------------------------------

const STATIONS = [
  "Berlin Hbf", "München Hbf", "Hamburg Hbf", "Frankfurt Hbf", "Köln Hbf",
  "Stuttgart Hbf", "Hannover Hbf", "Nürnberg Hbf", "Dresden Hbf", "Leipzig Hbf",
  "Düsseldorf", "Dortmund", "Bremen", "Essen", "Mannheim",
  "Karlsruhe", "Augsburg", "Aachen", "Freiburg", "Mainz",
  "Würzburg", "Ulm", "Münster", "Bonn", "Wiesbaden",
  "Rostock", "Erfurt", "Potsdam", "Kassel", "Regensburg",
];

const RESULTS: boolean[] = [
  true, false, true, false, true, true, false, true, false, true,
  true, false, false, true, true, false, true, false, true, true,
  false, true, true, false, true, false, true, true, false, true,
];

const PNL_VALUES = [
  45, -12, 8, -22, 31, 18, -7, 25, -15, 33,
  14, -9, -19, 27, 11, -6, 22, -14, 16, 29,
  -8, 13, 21, -11, 17, -5, 19, 24, -10, 20,
];

const YES_POOL = 800;
const NO_POOL = 1200;
const YES_BETTORS = 8;

const ParimutuelPool: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, POOL_IN, POOL_OUT, 12);
  const containerY = slideInY(frame, POOL_IN, fps, 40);

  // Pool bar fill
  const yesFill = interpolate(frame, [POOL_FILL, POOL_FILL + sec(1.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  const noFill = interpolate(frame, [POOL_FILL + sec(0.3), POOL_FILL + sec(1.8)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Arrow from NO pool to YES pool
  const arrowProg = interpolate(frame, [POOL_ARROW, POOL_ARROW + sec(1.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Calculation reveal
  const calcOpacity = interpolate(frame, [POOL_CALC, POOL_CALC + sec(0.8)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Proof text
  const proofOpacity = interpolate(frame, [POOL_PROOF, POOL_PROOF + sec(0.6)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Parasite labels
  const parasiteDelay = sec(0.3);
  const parasiteOpacity = interpolate(frame, [POOL_CALC + parasiteDelay, POOL_CALC + parasiteDelay + sec(0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Money particle positions along arrow
  const particles = [0.15, 0.35, 0.55, 0.75, 0.92];
  const particleBaseY = 0;

  const barMaxW = 280;
  const barH = 48;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `translateY(${containerY}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "40px 56px 48px",
          width: 1100,
          position: "relative",
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 700,
            color: DIM,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          SUBMARKET: BERLIN HBF
        </div>

        {/* Pools row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 60,
            marginTop: 24,
            position: "relative",
          }}
        >
          {/* YES Pool */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 22,
                fontWeight: 700,
                color: GREEN,
              }}
            >
              YES POOL
            </div>
            <div style={{ position: "relative", width: barMaxW, height: barH }}>
              <div
                style={{
                  width: barMaxW,
                  height: barH,
                  borderRadius: 8,
                  background: "rgba(0,200,83,0.08)",
                  border: `2px solid rgba(0,200,83,0.3)`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${yesFill * (YES_POOL / NO_POOL) * 100}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${GREEN}, rgba(0,200,83,0.6))`,
                    borderRadius: 6,
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 20,
                  fontWeight: 700,
                  color: GREEN,
                  marginTop: 6,
                  opacity: yesFill,
                }}
              >
                ${Math.round(yesFill * YES_POOL)}
              </div>
            </div>
            {/* Result label */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: calcOpacity,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: GREEN,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0a0a0a",
                }}
              >
                {"\u2713"}
              </div>
              <span
                style={{
                  fontFamily: font,
                  fontSize: 18,
                  fontWeight: 600,
                  color: GREEN,
                }}
              >
                Result: YES
              </span>
            </div>
          </div>

          {/* Arrow zone — money flows from NO to YES */}
          <div
            style={{
              width: 180,
              height: 120,
              position: "relative",
              flexShrink: 0,
              alignSelf: "center",
            }}
          >
            {/* Arrow line */}
            <svg
              width={180}
              height={120}
              viewBox="0 0 180 120"
              style={{ position: "absolute", top: 0, left: 0 }}
            >
              {/* Curved arrow from right (NO) to left (YES) */}
              <path
                d="M 170 60 C 130 20, 50 20, 10 60"
                fill="none"
                stroke={RED}
                strokeWidth={3}
                strokeDasharray={200}
                strokeDashoffset={interpolate(arrowProg, [0, 1], [200, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}
                opacity={0.8}
              />
              {/* Arrow head */}
              {arrowProg > 0.85 && (
                <polygon
                  points="10,60 20,52 20,68"
                  fill={RED}
                  opacity={interpolate(arrowProg, [0.85, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}
                />
              )}
            </svg>

            {/* Money particles along the arrow */}
            {particles.map((t, i) => {
              const particleProgress = interpolate(
                arrowProg,
                [Math.max(0, t - 0.2), Math.min(1, t + 0.2)],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              // Position along the bezier curve (simplified)
              const px = 170 - t * 160;
              const py = 60 - Math.sin(t * Math.PI) * 40;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: px - 6,
                    top: py - 6 + particleBaseY,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: GOLD,
                    opacity: particleProgress * 0.9,
                    boxShadow: `0 0 8px ${GOLD}`,
                    transform: `scale(${0.6 + particleProgress * 0.4})`,
                  }}
                />
              );
            })}

            {/* Flow label */}
            <div
              style={{
                position: "absolute",
                bottom: 4,
                left: "50%",
                transform: "translateX(-50%)",
                fontFamily: monoFont,
                fontSize: 12,
                color: DIM,
                letterSpacing: 2,
                opacity: arrowProg > 0.5 ? 1 : 0,
                whiteSpace: "nowrap",
              }}
            >
              MONEY FLOWS
            </div>
          </div>

          {/* NO Pool */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 22,
                fontWeight: 700,
                color: RED,
              }}
            >
              NO POOL
            </div>
            <div style={{ position: "relative", width: barMaxW, height: barH }}>
              <div
                style={{
                  width: barMaxW,
                  height: barH,
                  borderRadius: 8,
                  background: "rgba(239,68,68,0.08)",
                  border: `2px solid rgba(239,68,68,0.3)`,
                  overflow: "hidden",
                  direction: "rtl",
                }}
              >
                <div
                  style={{
                    width: `${noFill * 100}%`,
                    height: "100%",
                    background: `linear-gradient(270deg, ${RED}, rgba(239,68,68,0.6))`,
                    borderRadius: 6,
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 20,
                  fontWeight: 700,
                  color: RED,
                  marginTop: 6,
                  textAlign: "right",
                  opacity: noFill,
                }}
              >
                ${Math.round(noFill * NO_POOL)}
              </div>
            </div>
          </div>
        </div>

        {/* Calculation line */}
        <div
          style={{
            marginTop: 28,
            padding: "16px 24px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            opacity: calcOpacity,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 24,
              fontWeight: 700,
              color: BRIGHT,
            }}
          >
            YES winners get:
          </span>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 24,
              fontWeight: 700,
              color: RED,
            }}
          >
            ${NO_POOL}
          </span>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 20,
              color: DIM,
            }}
          >
            /
          </span>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 24,
              fontWeight: 700,
              color: GREEN,
            }}
          >
            {YES_BETTORS}
          </span>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 20,
              color: DIM,
            }}
          >
            =
          </span>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 28,
              fontWeight: 700,
              color: GOLD,
            }}
          >
            ${NO_POOL / YES_BETTORS} each
          </span>
        </div>

        {/* Proof data */}
        <div
          style={{
            marginTop: 16,
            fontFamily: font,
            fontSize: 14,
            color: DIM,
            textAlign: "center",
            opacity: proofOpacity,
            fontStyle: "italic",
          }}
        >
          Parimutuel: {PARIMUTUEL.model}. {PARIMUTUEL.horseRacingMarket} horse racing market uses same math.
        </div>

        {/* Parasite labels */}
        <ParasiteLabel text="losers fund winners" x={100} y={36} opacity={parasiteOpacity} color={RED} />
        <ParasiteLabel text="proportional payout" x={550} y={36} opacity={parasiteOpacity} color={GOLD} />
        <ParasiteLabel text="zero-sum per submarket" x={950} y={36} opacity={parasiteOpacity} />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 2. 30x Computation Grid + PNL Waterfall (10.9–18.9s local)
// ---------------------------------------------------------------------------

const ComputationGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, GRID_IN, GRID_OUT, 12);
  const containerY = slideInY(frame, GRID_IN, fps, 30);

  // Grid flash stagger — each cell flashes its result over 2.5s
  const flashDuration = GRID_FLASH_END - GRID_FLASH_START;
  const totalCells = 30;
  const staggerPerCell = flashDuration / totalCells;

  // Waterfall bar animation
  const waterfallDuration = WATERFALL_END - WATERFALL_IN;

  // Running sum for waterfall
  const runningSum: number[] = [];
  let sum = 0;
  for (const v of PNL_VALUES) {
    sum += v;
    runningSum.push(sum);
  }
  const finalPNL = sum; // +127

  // PNL label at end
  const pnlLabelOpacity = interpolate(frame, [WATERFALL_END - sec(0.5), WATERFALL_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cols = 6;
  const rows = 5;
  const cellW = 155;
  const cellH = 44;
  const cellGap = 6;

  const barMaxH = 80;
  const barW = 26;
  const barGap = 4;
  const maxAbsPnl = Math.max(...PNL_VALUES.map(Math.abs));

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `translateY(${containerY}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "36px 48px 40px",
          width: 1100,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          alignItems: "center",
        }}
      >
        {/* Grid title */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 700,
            color: DIM,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          30 SUBMARKETS — SIMULTANEOUS SETTLEMENT
        </div>

        {/* 6x5 Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
            gridTemplateRows: `repeat(${rows}, ${cellH}px)`,
            gap: cellGap,
          }}
        >
          {STATIONS.map((name, i) => {
            const cellFlashStart = GRID_FLASH_START + i * staggerPerCell;
            const cellProg = interpolate(
              frame,
              [cellFlashStart, cellFlashStart + sec(0.3)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const won = RESULTS[i];
            const bgColor = cellProg > 0.5
              ? won
                ? "rgba(0,200,83,0.2)"
                : "rgba(239,68,68,0.15)"
              : "rgba(255,255,255,0.04)";
            const borderColor = cellProg > 0.5
              ? won
                ? "rgba(0,200,83,0.5)"
                : "rgba(239,68,68,0.4)"
              : "rgba(255,255,255,0.08)";

            return (
              <div
                key={i}
                style={{
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 10px",
                  transition: "background 0.1s",
                }}
              >
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 11,
                    color: cellProg > 0.5 ? BRIGHT : DIM,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: cellW - 50,
                  }}
                >
                  {name}
                </span>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 14,
                    fontWeight: 700,
                    color: cellProg > 0.5
                      ? won ? GREEN : RED
                      : "transparent",
                  }}
                >
                  {won ? "\u2713" : "\u2717"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: 1,
            background: "rgba(255,255,255,0.08)",
            marginTop: 4,
          }}
        />

        {/* PNL Waterfall */}
        <div style={{ position: "relative", width: totalCells * (barW + barGap), height: barMaxH * 2 + 30 }}>
          {/* Zero line */}
          <div
            style={{
              position: "absolute",
              top: barMaxH,
              left: 0,
              width: "100%",
              height: 1,
              background: "rgba(255,255,255,0.15)",
            }}
          />

          {PNL_VALUES.map((val, i) => {
            const barStart = WATERFALL_IN + (i / totalCells) * waterfallDuration;
            const barProg = interpolate(
              frame,
              [barStart, barStart + sec(0.2)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out },
            );

            const h = (Math.abs(val) / maxAbsPnl) * barMaxH * barProg;
            const isPositive = val >= 0;
            const x = i * (barW + barGap);
            const y = isPositive ? barMaxH - h : barMaxH;

            // Notable bars get parasite labels
            const isNotable = i === 0 || i === 1 || i === 2 || i === 29;

            return (
              <React.Fragment key={i}>
                <div
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: barW,
                    height: h,
                    borderRadius: 3,
                    background: isPositive
                      ? `linear-gradient(180deg, ${GREEN}, rgba(0,200,83,0.5))`
                      : `linear-gradient(0deg, ${RED}, rgba(239,68,68,0.5))`,
                  }}
                />
                {isNotable && barProg > 0.8 && (
                  <div
                    style={{
                      position: "absolute",
                      left: x + barW / 2,
                      top: isPositive ? y - 18 : y + h + 4,
                      transform: "translateX(-50%)",
                      fontFamily: monoFont,
                      fontSize: 11,
                      fontWeight: 700,
                      color: isPositive ? GREEN : RED,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isPositive ? "+" : ""}${val}
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* Running sum line */}
          <svg
            width={totalCells * (barW + barGap)}
            height={barMaxH * 2 + 30}
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
          >
            {runningSum.map((s, i) => {
              if (i === 0) return null;
              const barStart = WATERFALL_IN + (i / totalCells) * waterfallDuration;
              const visible = frame >= barStart;
              if (!visible) return null;

              const x1 = (i - 1) * (barW + barGap) + barW / 2;
              const x2 = i * (barW + barGap) + barW / 2;
              const maxSum = Math.max(...runningSum.map(Math.abs));
              const y1 = barMaxH - (runningSum[i - 1] / maxSum) * (barMaxH * 0.6);
              const y2 = barMaxH - (s / maxSum) * (barMaxH * 0.6);

              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={GOLD}
                  strokeWidth={2}
                  opacity={0.7}
                />
              );
            })}
          </svg>

          {/* Final PNL label */}
          <div
            style={{
              position: "absolute",
              right: 0,
              top: barMaxH - (finalPNL / Math.max(...runningSum.map(Math.abs))) * (barMaxH * 0.6) - 28,
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 700,
              color: GOLD,
              opacity: pnlLabelOpacity,
              textShadow: `0 0 12px ${GOLD}`,
            }}
          >
            FINAL PNL: +${finalPNL}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 3. Risk Cap / Proportional Matching (18.9–28.2s local)
// ---------------------------------------------------------------------------

const RiskCapDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, RISK_IN, RISK_OUT, 12);
  const containerY = slideInY(frame, RISK_IN, fps, 30);

  // Trader bars spring in
  const barSpring = spring({
    frame: Math.max(frame - RISK_BARS, 0),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });

  // Match zone reveal
  const matchOpacity = interpolate(frame, [RISK_MATCH, RISK_MATCH + sec(0.8)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const matchScale = spring({
    frame: Math.max(frame - RISK_MATCH, 0),
    fps,
    config: { damping: 12, stiffness: 140, mass: 0.6 },
  });

  // Return arrow
  const returnProg = interpolate(frame, [RISK_RETURN, RISK_RETURN + sec(1.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Parasite labels
  const parasiteOpacity = interpolate(frame, [RISK_RETURN + sec(0.5), RISK_RETURN + sec(1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const smallBarW = interpolate(barSpring, [0, 1], [0, 4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const largeBarW = interpolate(barSpring, [0, 1], [0, 500], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const barH = 48;
  const matchZoneW = 80;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "flex-start",
        paddingLeft: 40,
        paddingTop: 160,
        opacity,
        transform: `translateY(${containerY}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "40px 48px 48px",
          width: 660,
          position: "relative",
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 700,
            color: DIM,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          PROPORTIONAL MATCHING
        </div>

        {/* Trader A row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 130, textAlign: "right" }}>
            <div style={{ fontFamily: font, fontSize: 16, color: DIM }}>Trader A</div>
            <div style={{ fontFamily: monoFont, fontSize: 22, fontWeight: 700, color: GREEN }}>$1</div>
          </div>
          <div
            style={{
              width: Math.max(smallBarW, 4),
              height: barH,
              borderRadius: 6,
              background: GREEN,
            }}
          />
          {/* Connection line to match zone */}
          <svg width={60} height={barH} style={{ flexShrink: 0 }}>
            <line
              x1={0} y1={barH / 2}
              x2={60} y2={barH / 2}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={matchOpacity}
            />
          </svg>
        </div>

        {/* Match zone (center) */}
        <div
          style={{
            position: "absolute",
            right: 60,
            top: "50%",
            transform: `translateY(-50%) scale(${interpolate(matchScale, [0, 1], [0.85, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })})`,
            opacity: matchOpacity,
          }}
        >
          <div
            style={{
              width: matchZoneW,
              height: matchZoneW,
              borderRadius: 12,
              border: `2px solid ${GOLD}`,
              background: "rgba(251,191,36,0.08)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <div style={{ fontFamily: monoFont, fontSize: 13, color: GOLD, letterSpacing: 1 }}>MATCHED</div>
            <div style={{ fontFamily: monoFont, fontSize: 18, fontWeight: 700, color: BRIGHT }}>$1 vs $1</div>
          </div>
        </div>

        {/* Trader B row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 130, textAlign: "right" }}>
            <div style={{ fontFamily: font, fontSize: 16, color: DIM }}>Trader B</div>
            <div style={{ fontFamily: monoFont, fontSize: 22, fontWeight: 700, color: RED }}>$1,000,000</div>
          </div>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: largeBarW,
                height: barH,
                borderRadius: 6,
                background: `linear-gradient(90deg, ${RED}, rgba(239,68,68,0.4))`,
              }}
            />
            {/* Return arrow overlay */}
            {returnProg > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: -30,
                  left: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: returnProg,
                }}
              >
                <svg width={interpolate(returnProg, [0, 1], [0, 300], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })} height={24}>
                  <line
                    x1={300} y1={12}
                    x2={0} y2={12}
                    stroke={GOLD}
                    strokeWidth={2}
                    strokeDasharray="8 4"
                  />
                  <polygon
                    points="0,12 10,6 10,18"
                    fill={GOLD}
                  />
                </svg>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 14,
                    fontWeight: 700,
                    color: GOLD,
                    whiteSpace: "nowrap",
                  }}
                >
                  $999,999 RETURNED
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Parasite labels */}
        <ParasiteLabel
          text="max loss = your counterparty's bet"
          x={330}
          y={280}
          opacity={parasiteOpacity}
          color={GREEN}
          anchor="center"
        />
        <ParasiteLabel
          text="asymmetric protection"
          x={120}
          y={310}
          opacity={parasiteOpacity}
          color={GOLD}
          anchor="left"
        />
        <ParasiteLabel
          text="small traders safe"
          x={450}
          y={310}
          opacity={parasiteOpacity}
          anchor="left"
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 4. Settlement Summary Card (28.2–29.9s local)
// ---------------------------------------------------------------------------

const SUMMARY_ITEMS = [
  { text: "10 min settlement", icon: "\u2713" },
  { text: "$0 fees", icon: "\u2713" },
  { text: "$0 spread", icon: "\u2713" },
  { text: "Risk capped", icon: "\u2713" },
  { text: "Instant withdrawal", icon: "\u2713" },
  { text: "No disputes", icon: "\u2713" },
];

const SettlementSummary: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, SUMMARY_IN, SUMMARY_OUT, 8);
  const containerScale = spring({
    frame: Math.max(frame - SUMMARY_IN, 0),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });

  const staggerDelay = sec(0.12);

  // Proof comparison
  const proofOpacity = interpolate(
    frame,
    [SUMMARY_IN + SUMMARY_ITEMS.length * staggerDelay + sec(0.3), SUMMARY_IN + SUMMARY_ITEMS.length * staggerDelay + sec(0.6)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "flex-end",
        paddingRight: 40,
        paddingTop: 160,
        opacity,
      }}
    >
      <div
        style={{
          background: "rgba(250,250,250,0.95)",
          borderRadius: 14,
          padding: "32px 40px 36px",
          width: 340,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          transform: `scale(${interpolate(containerScale, [0, 1], [0.9, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })})`,
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 14,
            fontWeight: 700,
            color: "#18181b",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          SETTLEMENT COMPLETE
        </div>

        {/* Check rows */}
        {SUMMARY_ITEMS.map((item, i) => {
          const rowStart = SUMMARY_IN + i * staggerDelay;
          const rowSpring = spring({
            frame: Math.max(frame - rowStart, 0),
            fps,
            config: { damping: 12, stiffness: 160, mass: 0.5 },
          });
          const rowOpacity = interpolate(rowSpring, [0, 0.5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const rowX = interpolate(rowSpring, [0, 1], [20, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
                opacity: rowOpacity,
                transform: `translateX(${rowX}px)`,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: GREEN,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>
              <span
                style={{
                  fontFamily: font,
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#18181b",
                }}
              >
                {item.text}
              </span>
            </div>
          );
        })}

        {/* Proof comparison */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid rgba(0,0,0,0.08)",
            fontFamily: font,
            fontSize: 12,
            color: "#71717a",
            opacity: proofOpacity,
            lineHeight: 1.5,
          }}
        >
          vs Polymarket: {COMPARISONS.polymarketSettlement} to settle, {COMPARISONS.polymarketFees} fees
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main export — composed with Sequences
// ---------------------------------------------------------------------------

export const PariDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* SFX */}
      <Sequence from={POOL_ARROW} durationInFrames={sec(3)}>
        <Audio src={staticFile("sfx/money-count.mp3")} volume={0.35} />
      </Sequence>
      <Sequence from={WATERFALL_IN} durationInFrames={sec(3.5)}>
        <Audio src={staticFile("sfx/metric-count-up.mp3")} volume={0.3} />
      </Sequence>
      <Sequence from={RISK_MATCH} durationInFrames={sec(2)}>
        <Audio src={staticFile("sfx/drop-cinematic-hit.mp3")} volume={0.4} />
      </Sequence>
      <Sequence from={SUMMARY_IN} durationInFrames={sec(1.7)}>
        <Audio src={staticFile("sfx/cursor-click-soft.mp3")} volume={0.25} />
      </Sequence>

      {/* Diagram 1: Parimutuel Pool */}
      <Sequence from={POOL_IN} durationInFrames={POOL_OUT - POOL_IN + sec(0.5)}>
        <ParimutuelPool />
      </Sequence>

      {/* Diagram 2: 30x Computation Grid + Waterfall */}
      <Sequence from={GRID_IN} durationInFrames={GRID_OUT - GRID_IN + sec(0.5)}>
        <ComputationGrid />
      </Sequence>

      {/* Diagram 3: Risk Cap */}
      <Sequence from={RISK_IN} durationInFrames={RISK_OUT - RISK_IN + sec(0.5)}>
        <RiskCapDiagram />
      </Sequence>

      {/* Diagram 4: Settlement Summary */}
      <Sequence from={SUMMARY_IN} durationInFrames={SUMMARY_OUT - SUMMARY_IN + sec(0.5)}>
        <SettlementSummary />
      </Sequence>
    </AbsoluteFill>
  );
};
