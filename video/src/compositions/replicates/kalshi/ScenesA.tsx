import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";
import {
  fontFamily,
  baseText,
  greenText,
  GREEN,
  LightBg,
  Center,
  easeOutExpo,
  easeOutQuart,
  easeInOutCubic,
  progress,
  wordReveal,
  sceneFade,
  srand,
} from "./shared";

/* ------------------------------------------------------------------ */
/*  Scene 01 — Calendar "Every Spring"  (120 frames / 4s)             */
/*                                                                     */
/*  Original frames:                                                   */
/*    001: "Every" [calendar icon] "Spring" — centered horizontally    */
/*    002: Calendar page-curl/peel transition                          */
/*    003: People icons scattered across screen                        */
/* ------------------------------------------------------------------ */

const PersonIcon: React.FC<{
  x: number;
  y: number;
  scale: number;
  opacity: number;
}> = ({ x, y, scale, opacity }) => (
  <svg
    width={28}
    height={44}
    viewBox="0 0 28 44"
    style={{
      position: "absolute",
      left: x - 14,
      top: y - 22,
      transform: `scale(${scale})`,
      opacity,
    }}
  >
    <circle cx={14} cy={8} r={7} fill="#000" />
    <path
      d="M14 18 C6 18 2 24 2 30 L2 44 L12 44 L12 30 L16 30 L16 44 L26 44 L26 30 C26 24 22 18 14 18Z"
      fill="#000"
    />
  </svg>
);

const PEOPLE_COUNT = 55;

export const Scene01_Calendar: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, 120);

  // Calendar + text phase (frames 0–70)
  const calScale = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 12, stiffness: 120 },
  });
  const everyX = interpolate(frame, [20, 44], [-120, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const everyOp = interpolate(frame, [20, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const springX = interpolate(frame, [28, 52], [120, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const springOp = interpolate(frame, [28, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Page curl: calendar exits (frames 55–75)
  const curlP = progress(frame, 55, 20);
  const curlEased = easeOutQuart(curlP);
  const calendarOp = interpolate(frame, [55, 75], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const calRotate = curlEased * 30;
  const calSkew = curlEased * -15;

  // People icons phase (frames 65–120)
  const peoplePhase = progress(frame, 65, 10);

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />

      {/* Calendar + text */}
      <Center
        style={{
          opacity: calendarOp,
          transform: `perspective(800px) rotateY(${calRotate}deg) skewY(${calSkew}deg)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
          <div
            style={{
              ...baseText,
              fontSize: 96,
              transform: `translateX(${everyX}px)`,
              opacity: everyOp,
            }}
          >
            Every
          </div>

          <div
            style={{
              transform: `scale(${calScale})`,
              width: 180,
              height: 200,
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              backgroundColor: "#fff",
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, #2CE89A, ${GREEN})`,
                height: 60,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily,
                  fontWeight: 700,
                  fontSize: 24,
                  color: "#fff",
                  letterSpacing: 1,
                }}
              >
                Sun
              </span>
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily,
                  fontWeight: 800,
                  fontSize: 80,
                  color: "#000",
                  lineHeight: 1,
                }}
              >
                15
              </span>
            </div>
          </div>

          <div
            style={{
              ...baseText,
              fontSize: 96,
              transform: `translateX(${springX}px)`,
              opacity: springOp,
            }}
          >
            Spring
          </div>
        </div>
      </Center>

      {/* People icons */}
      {peoplePhase > 0 &&
        Array.from({ length: PEOPLE_COUNT }, (_, i) => {
          const seed = i + 1;
          const tx = srand(seed * 3) * 1800 + 60;
          const ty = srand(seed * 7) * 960 + 60;
          const enterDelay = srand(seed * 13) * 20;
          const p = progress(frame, 65 + enterDelay, 12);
          const eased = easeOutQuart(p);
          const fromY = ty + 80;
          const currentY = interpolate(eased, [0, 1], [fromY, ty]);

          return (
            <PersonIcon
              key={i}
              x={tx}
              y={currentY}
              scale={0.9 + srand(seed * 17) * 0.4}
              opacity={eased}
            />
          );
        })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  Scene 02 — Predicting all 63 games  (120 frames / 4s)             */
/*                                                                     */
/*  Original frames:                                                   */
/*    004: "Attempt the impossible" — centered, bold                   */
/*    005: "Predicting" over scrolling green-stroked bars              */
/*    006: "Predicting all 60" — bars continue scrolling               */
/*    007: "Predicting all 63 games" — bars fill screen                */
/* ------------------------------------------------------------------ */

const BAR_ROWS = 7;
const BARS_PER_ROW = 10;
const BAR_W = 480;
const BAR_H = 72;
const BAR_GAP = 28;
const BAR_RY = 8;

export const Scene02_Predicting: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = sceneFade(frame, 120);

  // Phase 1: "Attempt the impossible" (frames 0–35)
  const attemptOp = interpolate(frame, [5, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const attemptExit = interpolate(frame, [28, 38], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2: Bars + "Predicting all 63 games" (frames 30–120)
  const barsEnter = progress(frame, 30, 15);
  const barsOpacity = easeOutQuart(barsEnter);

  const rows = Array.from({ length: BAR_ROWS }, (_, r) => {
    const direction = r % 2 === 0 ? 1 : -1;
    const speed = 1.0 + srand(r * 7) * 1.2;
    const offset = direction * (frame - 30) * speed;
    const yBase =
      540 -
      ((BAR_ROWS - 1) * (BAR_H + BAR_GAP)) / 2 +
      r * (BAR_H + BAR_GAP);

    return (
      <div
        key={r}
        style={{
          position: "absolute",
          top: yBase - BAR_H / 2,
          left: -BAR_W * 2,
          width: 1920 + BAR_W * 6,
          height: BAR_H,
          display: "flex",
          gap: BAR_GAP,
          transform: `translateX(${offset % (BAR_W + BAR_GAP)}px)`,
          opacity: barsOpacity,
        }}
      >
        {Array.from({ length: BARS_PER_ROW + 6 }, (__, i) => (
          <div
            key={i}
            style={{
              width: BAR_W,
              height: BAR_H,
              border: `3px solid ${GREEN}`,
              borderRadius: BAR_RY,
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    );
  });

  // Text reveal: word by word "Predicting all 63 games"
  const words = ["Predicting", "all", "63", "games"];
  const wordStarts = [38, 52, 62, 72];

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />

      {/* Phase 1: "Attempt the impossible" */}
      {frame < 40 && (
        <Center>
          <div
            style={{
              ...baseText,
              fontSize: 72,
              opacity: attemptOp * attemptExit,
              fontWeight: 700,
            }}
          >
            Attempt the impossible
          </div>
        </Center>
      )}

      {/* Phase 2: Bars */}
      {frame >= 30 && rows}

      {/* Phase 2: Text overlay */}
      {frame >= 35 && (
        <Center>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 18,
              textShadow:
                "0 0 40px rgba(240,240,240,0.95), 0 0 80px rgba(240,240,240,0.8)",
            }}
          >
            {words.map((word, i) => {
              const reveal = wordReveal(frame, wordStarts[i], 10);
              return (
                <span
                  key={i}
                  style={{
                    ...baseText,
                    fontSize: i === 0 ? 88 : 88,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.y}px)`,
                    display: "inline-block",
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        </Center>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  Scene 03 — Tournament Bracket  (120 frames / 4s)                  */
/*                                                                     */
/*  Original frames:                                                   */
/*    008: Bracket with small matchup boxes, sparkle, "17/63"          */
/*    009: Bracket complete, "63/63"                                   */
/*    010: Bracket still visible, "63/63"                              */
/*    011: Transition — "The format is" with sparkle                   */
/* ------------------------------------------------------------------ */

const LINE_COLOR = GREEN;

function bracketLines(
  side: "left" | "right",
  frame: number,
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const centerX = 960;
  const centerY = 540;
  const totalHeight = 900;
  const roundWidth = 120;
  const ROUNDS = 6;

  for (let round = 0; round < ROUNDS; round++) {
    const matchesInRound = Math.pow(2, ROUNDS - 1 - round);
    const spacing = totalHeight / matchesInRound;
    const drawProgress = progress(frame, round * 10, 16);
    const eased = easeOutExpo(drawProgress);

    const xStart =
      side === "left"
        ? centerX - (ROUNDS - round) * roundWidth
        : centerX + (ROUNDS - round) * roundWidth;
    const xEnd =
      side === "left"
        ? centerX - (ROUNDS - round - 1) * roundWidth
        : centerX + (ROUNDS - round - 1) * roundWidth;

    for (let m = 0; m < matchesInRound; m++) {
      const y1 =
        centerY - totalHeight / 2 + spacing * m + spacing * 0.25;
      const y2 =
        centerY - totalHeight / 2 + spacing * m + spacing * 0.75;
      const yMid = (y1 + y2) / 2;

      const clipX = interpolate(eased, [0, 1], [xStart, xEnd]);
      const clipLeft =
        side === "left"
          ? Math.min(xStart, clipX)
          : Math.min(xEnd, xStart);
      const clipRight =
        side === "left"
          ? Math.max(xStart, clipX)
          : Math.max(xStart, clipX);

      // Small matchup rectangles at the leaf nodes
      if (round === 0) {
        const boxW = 60;
        const boxH = 16;
        const bx = side === "left" ? xStart - boxW : xStart;
        const boxOp = eased;
        elements.push(
          <rect
            key={`box-${side}-${m}-1`}
            x={bx}
            y={y1 - boxH / 2}
            width={boxW}
            height={boxH}
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={1.5}
            opacity={boxOp}
            rx={2}
          />,
          <rect
            key={`box-${side}-${m}-2`}
            x={bx}
            y={y2 - boxH / 2}
            width={boxW}
            height={boxH}
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={1.5}
            opacity={boxOp}
            rx={2}
          />,
        );
      }

      elements.push(
        <g
          key={`${side}-${round}-${m}`}
          style={{
            clipPath: `inset(0 ${1920 - clipRight}px 0 ${clipLeft}px)`,
          }}
        >
          <line
            x1={xStart}
            y1={y1}
            x2={xEnd}
            y2={y1}
            stroke={LINE_COLOR}
            strokeWidth={2}
          />
          <line
            x1={xStart}
            y1={y2}
            x2={xEnd}
            y2={y2}
            stroke={LINE_COLOR}
            strokeWidth={2}
          />
          <line
            x1={xEnd}
            y1={y1}
            x2={xEnd}
            y2={y2}
            stroke={LINE_COLOR}
            strokeWidth={2}
          />
          {round < ROUNDS - 1 && (
            <line
              x1={xEnd}
              y1={yMid}
              x2={
                side === "left"
                  ? xEnd + roundWidth * 0.3
                  : xEnd - roundWidth * 0.3
              }
              y2={yMid}
              stroke={LINE_COLOR}
              strokeWidth={2}
            />
          )}
        </g>,
      );
    }
  }
  return elements;
}

// 6-pointed sparkle SVG matching original
const Sparkle: React.FC<{
  size: number;
  color: string;
  style?: React.CSSProperties;
}> = ({ size, color, style }) => {
  const half = size / 2;
  const armLen = half * 0.9;
  const lines: Array<[number, number, number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * i) / 6;
    lines.push([
      half - armLen * Math.cos(angle),
      half - armLen * Math.sin(angle),
      half + armLen * Math.cos(angle),
      half + armLen * Math.sin(angle),
    ]);
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={style}>
      {lines.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
};

export const Scene03_Bracket: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, 120);

  // Counter: counts up to 63
  const counterTarget = 63;
  const counterVal = Math.min(
    counterTarget,
    Math.floor(progress(frame, 8, 70) * (counterTarget + 1)),
  );

  // Sparkle
  const sparkleScale = spring({
    frame: Math.max(0, frame - 5),
    fps,
    from: 0,
    to: 1,
    config: { damping: 10, stiffness: 100 },
  });
  const sparkleRotation = interpolate(frame, [5, 120], [0, 90], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Transition to "The format is" text (frames 90–120)
  const bracketExit = interpolate(frame, [85, 100], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const formatReveal = wordReveal(frame, 92, 12);
  const formatReveal2 = wordReveal(frame, 100, 12);

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />

      {/* Bracket */}
      <div style={{ opacity: bracketExit }}>
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {bracketLines("left", frame)}
          {bracketLines("right", frame)}
        </svg>
        <Center>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                transform: `scale(${sparkleScale}) rotate(${sparkleRotation}deg)`,
              }}
            >
              <Sparkle size={60} color={GREEN} />
            </div>
            <div
              style={{
                ...baseText,
                fontSize: 42,
                fontVariantNumeric: "tabular-nums",
                color: "#000",
              }}
            >
              {counterVal}/{counterTarget}
            </div>
          </div>
        </Center>
      </div>

      {/* "The format is" transition */}
      {frame >= 90 && (
        <Center>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                transform: `scale(${sparkleScale}) rotate(${sparkleRotation}deg)`,
                opacity: formatReveal.opacity,
              }}
            >
              <Sparkle size={60} color={GREEN} />
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              {["The", "format", "is"].map((word, i) => {
                const wr = wordReveal(frame, 92 + i * 5, 10);
                return (
                  <span
                    key={i}
                    style={{
                      ...baseText,
                      fontSize: 72,
                      opacity: wr.opacity,
                      transform: `translateY(${wr.y}px)`,
                      display: "inline-block",
                    }}
                  >
                    {word}
                  </span>
                );
              })}
              <span
                style={{
                  ...baseText,
                  fontSize: 72,
                  opacity: formatReveal2.opacity,
                  transform: `translateY(${formatReveal2.y}px)`,
                  display: "inline-block",
                }}
              >
                simple
              </span>
            </div>
          </div>
        </Center>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  Scene 04 — Six Rounds  (120 frames / 4s)                          */
/*                                                                     */
/*  Original frames:                                                   */
/*    012: "The format is simple" (sparkle + text, end of transition)  */
/*    013: "The format is simple" still                                */
/*    014: "64" huge number, green horizontal bars in 8 columns        */
/*    015: "6 Rounds" list (Round of 64/32/16, 6 Rounds, QF/SF/C)     */
/* ------------------------------------------------------------------ */

const ROUND_LINES = [
  { text: "Round of 64", style: "green" as const },
  { text: "Round of 32", style: "green" as const },
  { text: "Round of 16", style: "green" as const },
  { text: "6 Rounds", style: "hero" as const },
  { text: "Quarterfinals", style: "green" as const },
  { text: "Semifinals", style: "green" as const },
  { text: "Championship", style: "green" as const },
];

// Green bar groups matching frame_014: 8 columns of stacked bars
function TeamBarGroups({
  opacity,
}: {
  opacity: number;
}): React.ReactElement {
  const barW = 140;
  const barH = 20;
  const barGap = 8;
  const barsPerCol = 8;
  const colGap = 30;
  const cols = 8;

  const totalW = cols * barW + (cols - 1) * colGap;
  const totalH = barsPerCol * (barH + barGap) - barGap;
  const startX = (1920 - totalW) / 2;
  const startY = (1080 - totalH) / 2;

  const bars: React.ReactNode[] = [];
  for (let c = 0; c < cols; c++) {
    // Leave center gap for the number
    if (c === 3 || c === 4) continue;
    for (let r = 0; r < barsPerCol; r++) {
      const x = startX + c * (barW + colGap);
      const y = startY + r * (barH + barGap);
      bars.push(
        <rect
          key={`${c}-${r}`}
          x={x}
          y={y}
          width={barW}
          height={barH}
          fill={GREEN}
          rx={3}
        />,
      );
    }
  }

  return (
    <svg
      width={1920}
      height={1080}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        opacity,
      }}
    >
      {bars}
    </svg>
  );
}

export const Scene04_SixRounds: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, 120);

  // Phase 1: "The format is simple" (frames 0–25)
  const formatOp = interpolate(frame, [0, 5], [1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const formatExit = interpolate(frame, [20, 30], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2: "64" with bars (frames 25–55)
  const barsEnter = interpolate(frame, [25, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const barsExit = interpolate(frame, [50, 60], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const barsOp = Math.min(barsEnter, barsExit);
  const numScale = spring({
    frame: Math.max(0, frame - 28),
    fps,
    from: 0.4,
    to: 1,
    config: { damping: 12, stiffness: 100 },
  });

  // Phase 3: 6 Rounds list (frames 55–120)
  const listPhase = frame >= 55;

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />

      {/* Phase 1: "The format is simple" */}
      {frame < 35 && (
        <Center>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Sparkle size={60} color={GREEN} />
            <div
              style={{
                ...baseText,
                fontSize: 72,
                opacity: formatOp * formatExit,
              }}
            >
              The format is simple
            </div>
          </div>
        </Center>
      )}

      {/* Phase 2: "64" with team bar groups */}
      {frame >= 25 && frame < 62 && (
        <>
          <TeamBarGroups opacity={barsOp} />
          <Center>
            <div
              style={{
                ...baseText,
                fontSize: 200,
                fontStyle: "italic",
                opacity: barsOp,
                transform: `scale(${numScale})`,
              }}
            >
              64
            </div>
          </Center>
        </>
      )}

      {/* Phase 3: 6 Rounds list */}
      {listPhase && (
        <Center>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            {ROUND_LINES.map((line, i) => {
              const enterFrame = 58 + i * 6;
              const reveal = wordReveal(frame, enterFrame, 8);

              if (line.style === "hero") {
                const heroScale = spring({
                  frame: Math.max(0, frame - enterFrame),
                  fps,
                  from: 0.5,
                  to: 1,
                  config: { damping: 10, stiffness: 100 },
                });
                return (
                  <div
                    key={i}
                    style={{
                      ...baseText,
                      fontSize: 120,
                      opacity: reveal.opacity,
                      transform: `scale(${heroScale})`,
                      margin: "12px 0",
                    }}
                  >
                    {line.text}
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  style={{
                    ...greenText,
                    fontSize: 40,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.y}px)`,
                    fontWeight: 500,
                  }}
                >
                  {line.text}
                </div>
              );
            })}
          </div>
        </Center>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  Scene 05 — Statistician's Dream  (150 frames / 5s)                */
/*                                                                     */
/*  Original frames:                                                   */
/*    016: "Single elimination" — large green bracket/tree shapes      */
/*    017: Random chars/numbers in green, "But the math"               */
/*    018: More random chars, "But the math behind it?"                */
/*    019: Dense overlapping green rectangles, "A statistician's dream"*/
/*    020: Same, subtle drift                                          */
/* ------------------------------------------------------------------ */

// Bracket tree shapes for "Single elimination"
function BracketTree({
  opacity,
}: {
  opacity: number;
}): React.ReactElement {
  const cx = 960;
  const boxW = 320;
  const boxH = 200;

  return (
    <svg
      width={1920}
      height={1080}
      style={{ position: "absolute", top: 0, left: 0, opacity }}
    >
      {/* Top two boxes */}
      <rect
        x={cx - boxW - 20}
        y={-40}
        width={boxW}
        height={boxH}
        fill="none"
        stroke={GREEN}
        strokeWidth={2.5}
        rx={4}
      />
      <rect
        x={cx + 20}
        y={-40}
        width={boxW}
        height={boxH}
        fill="none"
        stroke={GREEN}
        strokeWidth={2.5}
        rx={4}
      />
      {/* Vertical connector from top two */}
      <line
        x1={cx}
        y1={boxH - 40}
        x2={cx}
        y2={boxH + 40}
        stroke={GREEN}
        strokeWidth={2.5}
      />
      {/* Middle large box */}
      <rect
        x={cx - boxW / 2 - 60}
        y={boxH + 40}
        width={boxW + 120}
        height={boxH + 60}
        fill="none"
        stroke={GREEN}
        strokeWidth={2.5}
        rx={4}
      />
      {/* Vertical connector down */}
      <line
        x1={cx}
        y1={boxH + 40 + boxH + 60}
        x2={cx}
        y2={boxH + 40 + boxH + 120}
        stroke={GREEN}
        strokeWidth={2.5}
      />
      {/* Bottom connector box */}
      <rect
        x={cx - boxW / 2 - 30}
        y={boxH + 40 + boxH + 120}
        width={boxW + 60}
        height={boxH}
        fill="none"
        stroke={GREEN}
        strokeWidth={2.5}
        rx={4}
      />
      {/* Bottom two leaf boxes */}
      <rect
        x={cx - boxW * 1.4}
        y={880}
        width={boxW}
        height={boxH}
        fill="none"
        stroke={GREEN}
        strokeWidth={2.5}
        rx={4}
      />
      <rect
        x={cx + boxW * 0.4}
        y={880}
        width={boxW}
        height={boxH}
        fill="none"
        stroke={GREEN}
        strokeWidth={2.5}
        rx={4}
      />
      {/* Connectors to bottom leaves */}
      <line
        x1={cx - boxW * 0.9}
        y1={boxH + 40 + boxH + 120 + boxH}
        x2={cx - boxW * 0.9}
        y2={880}
        stroke={GREEN}
        strokeWidth={2.5}
      />
      <line
        x1={cx + boxW * 0.9}
        y1={boxH + 40 + boxH + 120 + boxH}
        x2={cx + boxW * 0.9}
        y2={880}
        stroke={GREEN}
        strokeWidth={2.5}
      />
    </svg>
  );
}

// Random green characters grid
const CHAR_GRID_COLS = 8;
const CHAR_GRID_ROWS = 7;
const CHAR_POOL =
  "9545883-'$1A,924545883&:459a%994545883-2'$1A,GBCBCFFBFBCACEFBFBCACEfB3HBBGn3H:@51?N:@:@51?N:@";

function CharGrid({
  frame,
  startFrame,
}: {
  frame: number;
  startFrame: number;
}): React.ReactElement {
  const cellW = 1920 / (CHAR_GRID_COLS + 1);
  const cellH = 1080 / (CHAR_GRID_ROWS + 1);

  const chars: React.ReactNode[] = [];
  for (let r = 0; r < CHAR_GRID_ROWS; r++) {
    for (let c = 0; c < CHAR_GRID_COLS; c++) {
      const idx = r * CHAR_GRID_COLS + c;
      const ch = CHAR_POOL[idx % CHAR_POOL.length];
      const x = cellW * (c + 0.8);
      const y = cellH * (r + 0.7);
      const enterDelay = srand(idx * 17) * 15;
      const p = progress(frame, startFrame + enterDelay, 10);
      const eased = easeOutQuart(p);
      const fromY = y + 40;
      const currentY = interpolate(eased, [0, 1], [fromY, y]);

      chars.push(
        <div
          key={idx}
          style={{
            position: "absolute",
            left: x,
            top: currentY,
            fontFamily,
            fontWeight: 700,
            fontSize: 48 + srand(idx * 3) * 24,
            color: GREEN,
            opacity: eased * 0.7,
          }}
        >
          {ch}
        </div>,
      );
    }
  }

  return <>{chars}</>;
}

const SCATTER_COUNT = 80;

function denseRects(frame: number, startFrame: number): React.ReactNode[] {
  return Array.from({ length: SCATTER_COUNT }, (_, i) => {
    const seed = i + 1;
    const x = srand(seed * 3) * 1920 - 100;
    const y = srand(seed * 7) * 1080 - 50;
    const w = 100 + srand(seed * 11) * 400;
    const h = 40 + srand(seed * 13) * 120;
    const enterFrame = startFrame + srand(seed * 23) * 30;
    const p = progress(frame, enterFrame, 20);
    const eased = easeOutQuart(p);

    // Subtle drift
    const drift = (frame - startFrame) * 0.2 * (srand(seed * 29) - 0.5);

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: x + drift,
          top: y,
          width: w,
          height: h,
          border: `2px solid ${GREEN}`,
          borderRadius: 4,
          opacity: eased * 0.5,
        }}
      />
    );
  });
}

export const Scene05_StatDream: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = sceneFade(frame, 150);

  // Phase 1: "Single elimination" with bracket tree (frames 0–35)
  const elimOp = interpolate(frame, [5, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const elimExit = interpolate(frame, [28, 38], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2: Random chars + "But the math behind it?" (frames 30–65)
  const charsPhase = frame >= 30 && frame < 70;
  const mathReveal = wordReveal(frame, 38, 10);
  const behindReveal = wordReveal(frame, 50, 10);

  // Phase 3: Dense rectangles + "A statistician's dream" (frames 60–150)
  const rectsPhase = frame >= 60;
  const dreamP = progress(frame, 75, 15);
  const dreamEased = easeOutExpo(dreamP);

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />

      {/* Phase 1: "Single elimination" */}
      {frame < 40 && (
        <>
          <BracketTree opacity={elimOp * elimExit} />
          <Center>
            <div
              style={{
                ...baseText,
                fontSize: 72,
                opacity: elimOp * elimExit,
                textShadow:
                  "0 0 40px rgba(240,240,240,0.95), 0 0 80px rgba(240,240,240,0.8)",
              }}
            >
              Single elimination
            </div>
          </Center>
        </>
      )}

      {/* Phase 2: Character grid + "But the math behind it?" */}
      {charsPhase && <CharGrid frame={frame} startFrame={30} />}
      {charsPhase && (
        <Center>
          <div
            style={{
              display: "flex",
              gap: 14,
              textShadow:
                "0 0 40px rgba(240,240,240,0.95), 0 0 80px rgba(240,240,240,0.8)",
            }}
          >
            {["But", "the", "math"].map((w, i) => {
              const wr = wordReveal(frame, 38 + i * 4, 8);
              return (
                <span
                  key={i}
                  style={{
                    ...baseText,
                    fontSize: 72,
                    opacity: wr.opacity * mathReveal.opacity,
                    transform: `translateY(${wr.y}px)`,
                    display: "inline-block",
                  }}
                >
                  {w}
                </span>
              );
            })}
            {["behind", "it?"].map((w, i) => {
              const wr = wordReveal(frame, 50 + i * 4, 8);
              return (
                <span
                  key={`b${i}`}
                  style={{
                    ...baseText,
                    fontSize: 72,
                    opacity: wr.opacity * behindReveal.opacity,
                    transform: `translateY(${wr.y}px)`,
                    display: "inline-block",
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        </Center>
      )}

      {/* Phase 3: Dense rectangles + "A statistician's dream" */}
      {rectsPhase && denseRects(frame, 60)}
      {rectsPhase && (
        <Center>
          <div
            style={{
              ...baseText,
              fontSize: 80,
              opacity: dreamEased,
              transform: `translateY(${(1 - dreamEased) * 30}px)`,
              textShadow:
                "0 0 60px rgba(240,240,240,1), 0 0 120px rgba(240,240,240,0.9)",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            A statistician{"\u2019"}s
            <br />
            dream
          </div>
        </Center>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  Scene 06 — Coin  (150 frames / 5s)                                */
/*                                                                     */
/*  Original frames:                                                   */
/*    021: Large penny (Lincoln head), line art, green + signs         */
/*    022: Same penny, slightly zoomed                                 */
/*    023: Penny shrinks left + green check, second coin enters right  */
/*    024: Grid of penny coins with green checkmarks                   */
/*    025: Grid of penny coins, all with checkmarks, more zoomed out   */
/* ------------------------------------------------------------------ */

// Simplified penny coin as SVG line art
const PennyCoin: React.FC<{
  size: number;
  style?: React.CSSProperties;
  showCheck?: boolean;
  checkScale?: number;
}> = ({ size, style, showCheck, checkScale = 1 }) => (
  <div style={{ position: "relative", width: size, height: size, ...style }}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      stroke="#333"
      strokeWidth={2}
    >
      <circle cx={100} cy={100} r={94} />
      <circle cx={100} cy={100} r={84} strokeWidth={1} strokeDasharray="2 4" />
      {/* Simplified head silhouette */}
      <ellipse cx={95} cy={85} rx={28} ry={38} strokeWidth={1.5} />
      {/* Neck/shoulders */}
      <path
        d="M70 120 Q80 145 100 150 Q120 145 130 120"
        strokeWidth={1.5}
        fill="none"
      />
      {/* "IN GOD WE TRUST" arc */}
      <text
        x={100}
        y={36}
        textAnchor="middle"
        fill="#333"
        stroke="none"
        fontSize={11}
        fontFamily={fontFamily}
        fontWeight={600}
        letterSpacing={1}
      >
        IN GOD WE TRUST
      </text>
      {/* LIBERTY */}
      <text
        x={42}
        y={145}
        fill="#333"
        stroke="none"
        fontSize={10}
        fontFamily={fontFamily}
        fontWeight={600}
      >
        LIBERTY
      </text>
      {/* 2026 */}
      <text
        x={140}
        y={148}
        fill="#333"
        stroke="none"
        fontSize={11}
        fontFamily={fontFamily}
        fontWeight={600}
      >
        2026
      </text>
    </svg>
    {showCheck && (
      <svg
        width={size * 0.3}
        height={size * 0.3}
        viewBox="0 0 30 30"
        style={{
          position: "absolute",
          bottom: -size * 0.05,
          right: -size * 0.05,
          transform: `scale(${checkScale})`,
        }}
      >
        <polyline
          points="6,16 12,22 24,8"
          fill="none"
          stroke={GREEN}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )}
  </div>
);

// Green + sign
const PlusSign: React.FC<{
  x: number;
  y: number;
  size: number;
  opacity: number;
}> = ({ x, y, size, opacity }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    style={{ position: "absolute", left: x, top: y, opacity }}
  >
    <line
      x1={20}
      y1={4}
      x2={20}
      y2={36}
      stroke={GREEN}
      strokeWidth={5}
      strokeLinecap="round"
    />
    <line
      x1={4}
      y1={20}
      x2={36}
      y2={20}
      stroke={GREEN}
      strokeWidth={5}
      strokeLinecap="round"
    />
  </svg>
);

const GRID_COLS = 9;
const GRID_ROWS = 7;
const COIN_SIZE = 80;
const COIN_GAP = 24;

export const Scene06_CoinGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, 150);

  // Phase 1: Large single coin (frames 0–55)
  const coinPhase1 = frame < 60;
  const coinScale = spring({
    frame,
    fps,
    from: 0.3,
    to: 1,
    config: { damping: 14, stiffness: 80 },
  });
  const coinShrink = interpolate(frame, [50, 65], [1, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Plus signs
  const plusOp = interpolate(frame, [10, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const plusExit = interpolate(frame, [50, 60], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2: Grid of coins (frames 55–150)
  const gridPhase = frame >= 55;
  const gridOp = interpolate(frame, [55, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const gridW = GRID_COLS * (COIN_SIZE + COIN_GAP) - COIN_GAP;
  const gridH = GRID_ROWS * (COIN_SIZE + COIN_GAP) - COIN_GAP;
  const gridLeft = (1920 - gridW) / 2;
  const gridTop = (1080 - gridH) / 2;

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />

      {/* Phase 1: Large penny */}
      {coinPhase1 && (
        <>
          <Center>
            <PennyCoin
              size={400}
              style={{
                transform: `scale(${coinScale * coinShrink})`,
              }}
            />
          </Center>
          <PlusSign
            x={1300}
            y={200}
            size={50}
            opacity={plusOp * plusExit}
          />
          <PlusSign
            x={350}
            y={700}
            size={50}
            opacity={plusOp * plusExit}
          />
        </>
      )}

      {/* Phase 2: Coin grid */}
      {gridPhase && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: gridOp,
          }}
        >
          {Array.from({ length: GRID_ROWS }, (_, r) =>
            Array.from({ length: GRID_COLS }, (__, c) => {
              const x = gridLeft + c * (COIN_SIZE + COIN_GAP);
              const y = gridTop + r * (COIN_SIZE + COIN_GAP);
              const diag = r + c;
              const checkEnter = 65 + diag * 3;
              const checkSc = spring({
                frame: Math.max(0, frame - checkEnter),
                fps,
                from: 0,
                to: 1,
                config: { damping: 12, stiffness: 180 },
              });

              return (
                <div
                  key={`${r}-${c}`}
                  style={{ position: "absolute", left: x, top: y }}
                >
                  <PennyCoin
                    size={COIN_SIZE}
                    showCheck={frame > checkEnter}
                    checkScale={checkSc}
                  />
                </div>
              );
            }),
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  Scene 07 — 1 in 9.2 Quintillion  (150 frames / 5s)                */
/*                                                                     */
/*  Original frames:                                                   */
/*    026: Coin grid still visible (all with checks)                   */
/*    027: "1 in 9." with large scrolling number, small coin below     */
/*    028: "1 in 9.2" — number still rolling                           */
/*    029: "1 in 9.2 Quintillion" green italic with underline + coin   */
/*    030: "To put that" with nested large shapes                      */
/* ------------------------------------------------------------------ */

export const Scene07_Shapes: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = sceneFade(frame, 150);

  // Phase 1: Coin grid still visible (frames 0–20)
  const gridExit = interpolate(frame, [10, 25], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2: "1 in 9.2 Quintillion" (frames 15–90)
  const numEnter = progress(frame, 15, 15);
  const numEased = easeOutExpo(numEnter);

  // Scrolling large number at top
  const bigNumber = "9,223,372,036,854,775,808";
  const numScrollX = interpolate(frame, [15, 85], [200, -100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "1 in 9.2" text reveal
  const oneInReveal = wordReveal(frame, 20, 10);
  const nineReveal = wordReveal(frame, 28, 10);

  // "Quintillion" in green
  const quintReveal = wordReveal(frame, 50, 12);

  // Small coin below
  const coinOp = interpolate(frame, [25, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2 exit
  const phase2Exit = interpolate(frame, [85, 100], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 3: "To put that" + nested shapes (frames 90–150)
  const shapesPhase = frame >= 85;

  const cx = 960;
  const cy = 540;

  // Nested shapes — very large, filling most of the screen
  const circleR = 480;
  const circleCirc = 2 * Math.PI * circleR;
  const circleP = progress(frame, 88, 30);

  const pentR = 400;
  const pentPoints = Array.from({ length: 5 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return `${cx + pentR * Math.cos(angle)},${cy + pentR * Math.sin(angle)}`;
  }).join(" ");
  const pentCirc = 5 * 2 * pentR * Math.sin(Math.PI / 5);
  const pentP = progress(frame, 92, 30);

  const sqSize = 440;
  const sqHalf = sqSize / 2;
  const sqCirc = sqSize * 4;
  const sqP = progress(frame, 96, 30);

  function strokeDash(p: number, circumference: number) {
    const drawn = easeInOutCubic(p) * circumference;
    return {
      strokeDasharray: `${circumference}`,
      strokeDashoffset: `${circumference - drawn}`,
    };
  }

  const textP = progress(frame, 100, 15);
  const textEased = easeOutExpo(textP);

  // "number into perspective" extend
  const extendP = progress(frame, 110, 15);
  const extendEased = easeOutExpo(extendP);

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />

      {/* Phase 1: Fading coin grid remnant */}
      {frame < 30 && (
        <div style={{ opacity: gridExit }}>
          {Array.from({ length: GRID_ROWS }, (_, r) =>
            Array.from({ length: GRID_COLS }, (__, c) => {
              const gridW2 =
                GRID_COLS * (COIN_SIZE + COIN_GAP) - COIN_GAP;
              const gridH2 =
                GRID_ROWS * (COIN_SIZE + COIN_GAP) - COIN_GAP;
              const x = (1920 - gridW2) / 2 + c * (COIN_SIZE + COIN_GAP);
              const y =
                (1080 - gridH2) / 2 + r * (COIN_SIZE + COIN_GAP);
              return (
                <div
                  key={`${r}-${c}`}
                  style={{ position: "absolute", left: x, top: y }}
                >
                  <PennyCoin size={COIN_SIZE} showCheck checkScale={1} />
                </div>
              );
            }),
          )}
        </div>
      )}

      {/* Phase 2: Number + "1 in 9.2 Quintillion" */}
      {frame >= 15 && frame < 100 && (
        <div style={{ opacity: phase2Exit }}>
          {/* Scrolling big number in grey pill at top */}
          <div
            style={{
              position: "absolute",
              top: 340,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(220,220,220,0.5)",
                borderRadius: 24,
                padding: "8px 28px",
                overflow: "hidden",
                maxWidth: 500,
              }}
            >
              <div
                style={{
                  fontFamily,
                  fontWeight: 500,
                  fontSize: 32,
                  color: "#888",
                  whiteSpace: "nowrap",
                  transform: `translateX(${numScrollX}px)`,
                  fontVariantNumeric: "tabular-nums",
                  opacity: numEased,
                }}
              >
                {bigNumber}
              </div>
            </div>
          </div>

          {/* "1 in 9.2" */}
          <Center>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                marginTop: 20,
              }}
            >
              <span
                style={{
                  ...baseText,
                  fontSize: 100,
                  opacity: oneInReveal.opacity,
                  transform: `translateY(${oneInReveal.y}px)`,
                  display: "inline-block",
                }}
              >
                1 in
              </span>
              <span
                style={{
                  ...baseText,
                  fontSize: 100,
                  opacity: nineReveal.opacity,
                  transform: `translateY(${nineReveal.y}px)`,
                  display: "inline-block",
                }}
              >
                9.2
              </span>
              {/* "Quintillion" in green italic with underline */}
              <span
                style={{
                  fontFamily,
                  fontWeight: 800,
                  fontSize: 80,
                  fontStyle: "italic",
                  color: GREEN,
                  opacity: quintReveal.opacity,
                  transform: `translateY(${quintReveal.y}px)`,
                  display: "inline-block",
                  textDecoration: "none",
                  position: "relative",
                }}
              >
                Quintillion
                {/* Green underline */}
                <div
                  style={{
                    position: "absolute",
                    bottom: -4,
                    left: 0,
                    right: 0,
                    height: 4,
                    backgroundColor: GREEN,
                    borderRadius: 2,
                    transform: `scaleX(${quintReveal.opacity})`,
                    transformOrigin: "left",
                  }}
                />
              </span>
            </div>
          </Center>

          {/* Small coin below */}
          <div
            style={{
              position: "absolute",
              top: 600,
              left: "50%",
              transform: "translateX(-50%)",
              opacity: coinOp,
            }}
          >
            <PennyCoin size={80} />
          </div>
        </div>
      )}

      {/* Phase 3: Nested shapes + "To put that number into perspective" */}
      {shapesPhase && (
        <>
          <svg
            width={1920}
            height={1080}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={circleR}
              fill="none"
              stroke={GREEN}
              strokeWidth={2.5}
              {...strokeDash(circleP, circleCirc)}
            />
            <polygon
              points={pentPoints}
              fill="none"
              stroke={GREEN}
              strokeWidth={2.5}
              strokeLinejoin="round"
              {...strokeDash(pentP, pentCirc)}
            />
            <rect
              x={cx - sqHalf}
              y={cy - sqHalf}
              width={sqSize}
              height={sqSize}
              fill="none"
              stroke={GREEN}
              strokeWidth={2.5}
              {...strokeDash(sqP, sqCirc)}
            />
          </svg>
          <Center>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 14,
                maxWidth: 900,
                textShadow:
                  "0 0 40px rgba(240,240,240,0.95), 0 0 80px rgba(240,240,240,0.8)",
              }}
            >
              {["To", "put", "that"].map((w, i) => {
                const wr = wordReveal(frame, 100 + i * 4, 10);
                return (
                  <span
                    key={i}
                    style={{
                      ...baseText,
                      fontSize: 72,
                      opacity: wr.opacity * textEased,
                      transform: `translateY(${wr.y}px)`,
                      display: "inline-block",
                    }}
                  >
                    {w}
                  </span>
                );
              })}
              {["number", "into", "perspective"].map((w, i) => {
                const wr = wordReveal(frame, 110 + i * 4, 10);
                return (
                  <span
                    key={`e${i}`}
                    style={{
                      ...baseText,
                      fontSize: 72,
                      opacity: wr.opacity * extendEased,
                      transform: `translateY(${wr.y}px)`,
                      display: "inline-block",
                    }}
                  >
                    {w}
                  </span>
                );
              })}
            </div>
          </Center>
        </>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  Scene 08 — about 7.5 Quintillion  (150 frames / 5s)               */
/*                                                                     */
/*  Original frames:                                                   */
/*    031: "To put that number into perspective" + nested shapes       */
/*    032: Dot grid background, small globe, "about"                   */
/*    033: Dot grid, globe, "about 7."                                 */
/*    034: Dot grid, globe, "about 7.5 Quintillio" (green, writing in)*/
/*    035: Dot grid, globe, "about 7.5 Quintillion"                   */
/* ------------------------------------------------------------------ */

const DOT_SPACING = 48;

function DotGrid({
  opacity,
}: {
  opacity: number;
}): React.ReactElement {
  const dots: React.ReactNode[] = [];

  for (let x = DOT_SPACING; x < 1920; x += DOT_SPACING) {
    for (let y = DOT_SPACING; y < 1080; y += DOT_SPACING) {
      dots.push(
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} fill="#C8C8C8" />,
      );
    }
  }

  return (
    <svg
      width={1920}
      height={1080}
      style={{ position: "absolute", top: 0, left: 0, opacity }}
    >
      {dots}
    </svg>
  );
}

// Globe icon matching original — small circle with meridian/equator lines
const GlobeIcon: React.FC<{
  size: number;
  style?: React.CSSProperties;
}> = ({ size, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 60 60"
    fill="none"
    style={style}
  >
    <circle cx={30} cy={30} r={24} stroke={GREEN} strokeWidth={2.5} />
    <ellipse cx={30} cy={30} rx={10} ry={24} stroke={GREEN} strokeWidth={1.5} />
    <ellipse cx={30} cy={30} rx={24} ry={9} stroke={GREEN} strokeWidth={1.5} />
  </svg>
);

export const Scene08_Quintillion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, 150);

  // Phase 1: Shapes still visible from previous scene (frames 0–20)
  const shapesExit = interpolate(frame, [5, 20], [0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2: Dot grid + globe + "about 7.5 Quintillion" (frames 15–150)
  const dotsEnter = interpolate(frame, [15, 30], [0, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const globeScale = spring({
    frame: Math.max(0, frame - 20),
    fps,
    from: 0,
    to: 1,
    config: { damping: 12, stiffness: 100 },
  });

  // Text: word by word "about 7.5 Quintillion"
  const aboutReveal = wordReveal(frame, 30, 10);
  const numReveal = wordReveal(frame, 42, 10);
  const quintReveal = wordReveal(frame, 55, 12);

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />

      {/* Fading shapes from Scene 07 */}
      {frame < 25 && (
        <svg
          width={1920}
          height={1080}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            opacity: shapesExit,
          }}
        >
          <circle
            cx={960}
            cy={540}
            r={480}
            fill="none"
            stroke={GREEN}
            strokeWidth={2.5}
          />
          <rect
            x={960 - 220}
            y={540 - 220}
            width={440}
            height={440}
            fill="none"
            stroke={GREEN}
            strokeWidth={2.5}
          />
        </svg>
      )}

      {/* Dot grid background */}
      <DotGrid opacity={dotsEnter} />

      {/* Globe + text */}
      <Center>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <GlobeIcon
            size={60}
            style={{
              transform: `scale(${globeScale})`,
              opacity: globeScale,
            }}
          />

          {/* Text line: "about 7.5 Quintillion" */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            <span
              style={{
                ...baseText,
                fontSize: 48,
                opacity: aboutReveal.opacity,
                transform: `translateY(${aboutReveal.y}px)`,
                display: "inline-block",
              }}
            >
              about
            </span>
            <span
              style={{
                ...baseText,
                fontSize: 48,
                opacity: numReveal.opacity,
                transform: `translateY(${numReveal.y}px)`,
                display: "inline-block",
              }}
            >
              7.5
            </span>
            <span
              style={{
                fontFamily,
                fontWeight: 800,
                fontSize: 44,
                fontStyle: "italic",
                color: GREEN,
                opacity: quintReveal.opacity,
                transform: `translateY(${quintReveal.y}px)`,
                display: "inline-block",
              }}
            >
              Quintillion
            </span>
          </div>
        </div>
      </Center>
    </AbsoluteFill>
  );
};
