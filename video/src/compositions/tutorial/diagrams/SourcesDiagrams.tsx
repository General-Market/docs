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
import { Counter } from "../../general-market/components/Counter";
import {
  DEUTSCHE_BAHN,
  TWITCH,
  STEAM,
  PUMP_FUN,
  PREDICTION_MARKETS,
  COMPARISONS,
} from "../proofData";

const sec = (s: number) => Math.round(s * FPS);
const W = 1920;
const H = 1080;

const CLAMP = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 1: Source Selection Tree (0s–12.0s local = 247.4–259.4s video)
// ZONE B+C (wide, avoiding face center)
// ═══════════════════════════════════════════════════════════════════════════

interface SourceBranch {
  label: string;
  color: string;
  leafCount: string;
  leafLabel: string;
  stat: string;
  highlightAt: number; // local seconds when speaker names it
}

const BRANCHES: SourceBranch[] = [
  {
    label: "TRAIN",
    color: "#e53935",
    leafCount: "30",
    leafLabel: "stations",
    stat: DEUTSCHE_BAHN.onTimeRate2025 + " on time",
    highlightAt: 8.0, // ~255.4s
  },
  {
    label: "TWITCH",
    color: "#9146FF",
    leafCount: "5,000",
    leafLabel: "streamers",
    stat: TWITCH.avgConcurrent + " concurrent",
    highlightAt: 9.5, // ~256.9s
  },
  {
    label: "STEAM",
    color: "#1B9FFF",
    leafCount: "500",
    leafLabel: "games",
    stat: STEAM.peakConcurrent + " peak",
    highlightAt: 10.8, // ~258.2s
  },
  {
    label: "PUMP.FUN",
    color: "#FF8C00",
    leafCount: "3M",
    leafLabel: "tokens",
    stat: PUMP_FUN.totalTokens + " launched",
    highlightAt: 11.6,
  },
];

const TREE_DURATION = sec(12.0);

const SourceSelectionTree: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Exit fade
  const exitOp = interpolate(frame, [TREE_DURATION - sec(1), TREE_DURATION], [1, 0], CLAMP);

  // Root node springs in
  const rootSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.7 },
  });

  // SVG viewbox covers the full diagram area
  // Layout: root at top center, branches fan out below
  // Face safe zone = 35%-65% horizontal = 672-1248px. We place root above face.
  const rootX = W / 2;
  const rootY = 60;
  const branchY = 200;
  const leafY = 340;

  // Branch positions — spread across B and C zones
  const branchPositions = [
    { x: 200, side: "left" },   // Zone B
    { x: 520, side: "left" },   // Zone B edge
    { x: 1400, side: "right" }, // Zone C edge
    { x: 1720, side: "right" }, // Zone C
  ];

  return (
    <AbsoluteFill style={{ opacity: exitOp }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <filter id="tree-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Root node — GENERAL MARKET */}
        <g
          opacity={interpolate(rootSpring, [0, 1], [0, 1], CLAMP)}
          transform={`translate(${rootX}, ${rootY})`}
        >
          <rect
            x={-120}
            y={-22}
            width={240}
            height={44}
            rx={8}
            fill="rgba(0, 200, 83, 0.15)"
            stroke={BRAND_GREEN}
            strokeWidth={2}
          />
          <text
            x={0}
            y={2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={BRAND_GREEN}
            fontFamily={font}
            fontWeight={800}
            fontSize={16}
            letterSpacing={2}
          >
            GENERAL MARKET
          </text>
        </g>

        {/* Branches */}
        {BRANCHES.map((branch, i) => {
          const pos = branchPositions[i];
          const branchDelay = sec(1.5 + i * 0.6);

          const branchSpring = spring({
            frame: Math.max(frame - branchDelay, 0),
            fps,
            config: { damping: 14, stiffness: 160, mass: 0.5 },
          });

          // Highlight when speaker names the source
          const highlightFrame = sec(branch.highlightAt);
          const isHighlighted = frame >= highlightFrame;
          const highlightSpring = isHighlighted
            ? spring({
                frame: frame - highlightFrame,
                fps,
                config: { damping: 12, stiffness: 200, mass: 0.4 },
              })
            : 0;

          const branchOpacity = interpolate(branchSpring, [0, 1], [0, 1], CLAMP);

          // Connection line from root to branch
          const lineProgress = interpolate(
            frame - branchDelay,
            [0, sec(0.4)],
            [0, 1],
            { ...CLAMP, easing: EASE.out },
          );
          const lineEndY = rootY + 22 + (branchY - rootY - 22) * lineProgress;

          // Leaf counter animation
          const leafDelay = branchDelay + sec(0.8);
          const leafSpring = spring({
            frame: Math.max(frame - leafDelay, 0),
            fps,
            config: { damping: 16, stiffness: 120, mass: 0.6 },
          });

          const nodeStroke = isHighlighted ? BRAND_GREEN : branch.color;
          const nodeFill = isHighlighted
            ? `rgba(0, 200, 83, ${0.2 * highlightSpring})`
            : "rgba(20, 20, 20, 0.9)";
          return (
            <g key={branch.label}>
              {/* Connection line root → branch */}
              <line
                x1={rootX}
                y1={rootY + 22}
                x2={pos.x}
                y2={lineEndY}
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth={1.5}
                opacity={branchOpacity}
              />

              {/* Branch node */}
              <g
                opacity={branchOpacity}
                transform={`translate(${pos.x}, ${branchY})`}
              >
                {/* Highlight glow */}
                {isHighlighted && (
                  <rect
                    x={-74}
                    y={-24}
                    width={148}
                    height={48}
                    rx={12}
                    fill="none"
                    stroke={BRAND_GREEN}
                    strokeWidth={2}
                    opacity={0.4 * highlightSpring}
                    filter="url(#tree-glow)"
                  />
                )}
                <rect
                  x={-70}
                  y={-20}
                  width={140}
                  height={40}
                  rx={10}
                  fill={nodeFill}
                  stroke={nodeStroke}
                  strokeWidth={2}
                />
                <text
                  x={0}
                  y={2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isHighlighted ? BRAND_GREEN : "#fafafa"}
                  fontFamily={monoFont}
                  fontWeight={700}
                  fontSize={14}
                  letterSpacing={1}
                >
                  {branch.label}
                </text>
              </g>

              {/* Leaf: count + label */}
              <g
                opacity={interpolate(leafSpring, [0, 1], [0, 1], CLAMP)}
                transform={`translate(${pos.x}, ${leafY})`}
              >
                {/* Vertical line branch → leaf */}
                <line
                  x1={0}
                  y1={-leafY + branchY + 20}
                  x2={0}
                  y2={-12}
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />

                {/* Count */}
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isHighlighted ? BRAND_GREEN : "#fafafa"}
                  fontFamily={monoFont}
                  fontWeight={700}
                  fontSize={28}
                >
                  {branch.leafCount}
                </text>

                {/* Label */}
                <text
                  x={0}
                  y={26}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="rgba(255, 255, 255, 0.5)"
                  fontFamily={font}
                  fontWeight={400}
                  fontSize={12}
                  letterSpacing={1}
                >
                  {branch.leafLabel}
                </text>

                {/* Stat (real data) */}
                <text
                  x={0}
                  y={48}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isHighlighted ? "rgba(0, 200, 83, 0.7)" : "rgba(255, 255, 255, 0.35)"}
                  fontFamily={monoFont}
                  fontWeight={400}
                  fontSize={10}
                  letterSpacing={0.5}
                >
                  {branch.stat}
                </text>
              </g>
            </g>
          );
        })}

        {/* "..." ellipsis node for more sources */}
        {(() => {
          const ellipsisDelay = sec(4.5);
          const ellipsisOp = interpolate(frame - ellipsisDelay, [0, sec(0.4)], [0, 0.5], CLAMP);
          return (
            <text
              x={W / 2}
              y={branchY}
              textAnchor="middle"
              dominantBaseline="central"
              fill="rgba(255, 255, 255, 0.4)"
              fontFamily={monoFont}
              fontSize={32}
              fontWeight={700}
              opacity={ellipsisOp}
            >
              ...
            </text>
          );
        })()}
      </svg>

      {/* ZONE D: "YOU CHOOSE YOUR BRANCH" label */}
      {(() => {
        const labelDelay = sec(5.5);
        const labelOp = interpolate(frame - labelDelay, [0, sec(0.6)], [0, 1], CLAMP);
        const labelX = spring({
          frame: Math.max(frame - labelDelay, 0),
          fps,
          config: { damping: 16, stiffness: 140, mass: 0.6 },
        });
        const xShift = interpolate(labelX, [0, 1], [-40, 0], CLAMP);
        return (
          <div
            style={{
              position: "absolute",
              bottom: 120,
              left: 100,
              opacity: labelOp,
              transform: `translateX(${xShift}px)`,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontSize: 22,
                fontWeight: 700,
                color: BRAND_GREEN,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              You choose your branch
            </div>
            <svg width={40} height={20} viewBox="0 0 40 20">
              <path
                d="M0 10 L30 10 M24 4 L30 10 L24 16"
                stroke={BRAND_GREEN}
                strokeWidth={2}
                fill="none"
              />
            </svg>
          </div>
        );
      })()}

      {/* Parasite labels */}
      <ParasiteLabels
        labels={[
          { text: "ONE BATCH PER SOURCE", x: 80, y: 460, delay: sec(3.0) },
          { text: "TRADE ONLY WHAT YOU KNOW", x: W - 380, y: 460, delay: sec(3.8) },
          { text: "SPECIALIZATION = EDGE", x: W / 2 - 100, y: 520, delay: sec(4.5) },
        ]}
        exitFrame={TREE_DURATION - sec(1)}
      />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 2: Source Roadmap (12.0s–17.5s local = 259.4–264.9s video)
// ZONE D (lower third)
// ═══════════════════════════════════════════════════════════════════════════

interface RoadmapDot {
  label: string;
  launched: boolean;
}

const ROADMAP_ITEMS: RoadmapDot[] = [
  { label: "Train", launched: true },
  { label: "Twitch", launched: true },
  { label: "Steam", launched: true },
  { label: "Pump", launched: true },
  { label: "Weather", launched: true },
  { label: "Airlines", launched: false },
  { label: "Sports", launched: false },
  { label: "Elections", launched: false },
];

const ROADMAP_DURATION = sec(5.5);

const SourceRoadmap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const exitOp = interpolate(frame, [ROADMAP_DURATION - sec(0.8), ROADMAP_DURATION], [1, 0], CLAMP);

  // Timeline layout in lower third
  const yBase = H - 180;
  const xStart = 100;
  const xEnd = W - 300;
  const spacing = (xEnd - xStart) / (ROADMAP_ITEMS.length - 1);

  return (
    <AbsoluteFill style={{ opacity: exitOp }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      >
        {/* Horizontal track line */}
        {(() => {
          const lineProgress = interpolate(frame, [0, sec(1.2)], [0, 1], { ...CLAMP, easing: EASE.out });
          return (
            <line
              x1={xStart}
              y1={yBase}
              x2={xStart + (xEnd - xStart) * lineProgress}
              y2={yBase}
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth={2}
            />
          );
        })()}

        {/* Dots + labels */}
        {ROADMAP_ITEMS.map((item, i) => {
          const dotDelay = sec(0.4 + i * 0.25);
          const dotSpring = spring({
            frame: Math.max(frame - dotDelay, 0),
            fps,
            config: { damping: 14, stiffness: 200, mass: 0.4 },
          });
          const dotScale = interpolate(dotSpring, [0, 1], [0, 1], CLAMP);
          const x = xStart + i * spacing;
          const dotColor = item.launched ? BRAND_GREEN : "rgba(255, 255, 255, 0.4)";
          const dotR = item.launched ? 8 : 6;

          return (
            <g key={item.label}>
              {/* Dot */}
              <circle
                cx={x}
                cy={yBase}
                r={dotR * dotScale}
                fill={item.launched ? dotColor : "none"}
                stroke={dotColor}
                strokeWidth={item.launched ? 0 : 2}
                strokeDasharray={item.launched ? "none" : "4 3"}
              />
              {/* Label */}
              <text
                x={x}
                y={yBase + 28}
                textAnchor="middle"
                dominantBaseline="central"
                fill={item.launched ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.4)"}
                fontFamily={monoFont}
                fontWeight={item.launched ? 600 : 400}
                fontSize={11}
                letterSpacing={0.5}
                opacity={dotScale}
              >
                {item.label}
              </text>
            </g>
          );
        })}

        {/* Section labels: LAUNCHED / COMING */}
        <text
          x={xStart + spacing * 2}
          y={yBase - 32}
          textAnchor="middle"
          fill={BRAND_GREEN}
          fontFamily={font}
          fontWeight={700}
          fontSize={13}
          letterSpacing={3}
          opacity={interpolate(frame, [sec(1.0), sec(1.5)], [0, 1], CLAMP)}
        >
          LAUNCHED
        </text>
        <text
          x={xStart + spacing * 6}
          y={yBase - 32}
          textAnchor="middle"
          fill="rgba(255, 255, 255, 0.5)"
          fontFamily={font}
          fontWeight={700}
          fontSize={13}
          letterSpacing={3}
          opacity={interpolate(frame, [sec(2.0), sec(2.5)], [0, 1], CLAMP)}
        >
          COMING
        </text>

        {/* YOUR REQUEST box */}
        {(() => {
          const reqDelay = sec(3.0);
          const reqSpring = spring({
            frame: Math.max(frame - reqDelay, 0),
            fps,
            config: { damping: 14, stiffness: 160, mass: 0.5 },
          });
          const reqOp = interpolate(reqSpring, [0, 1], [0, 1], CLAMP);
          const reqX = xEnd + 30;
          return (
            <g opacity={reqOp}>
              <rect
                x={reqX}
                y={yBase - 18}
                width={160}
                height={36}
                rx={6}
                fill="none"
                stroke={BRAND_GREEN}
                strokeWidth={2}
                strokeDasharray="6 4"
              />
              <text
                x={reqX + 80}
                y={yBase}
                textAnchor="middle"
                dominantBaseline="central"
                fill={BRAND_GREEN}
                fontFamily={monoFont}
                fontWeight={600}
                fontSize={12}
                letterSpacing={1}
              >
                YOUR REQUEST
              </text>
              {/* Arrow */}
              <path
                d={`M${reqX + 165} ${yBase} L${reqX + 185} ${yBase} M${reqX + 179} ${yBase - 5} L${reqX + 185} ${yBase} L${reqX + 179} ${yBase + 5}`}
                stroke={BRAND_GREEN}
                strokeWidth={2}
                fill="none"
              />
              <text
                x={reqX + 200}
                y={yBase}
                dominantBaseline="central"
                fill={BRAND_GREEN}
                fontFamily={monoFont}
                fontWeight={700}
                fontSize={12}
              >
                Submit
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Parasite labels */}
      <ParasiteLabels
        labels={[
          { text: "47 SOURCES LIVE", x: 100, y: H - 260, delay: sec(1.5) },
          { text: "GROWING WEEKLY", x: 360, y: H - 260, delay: sec(2.2) },
          { text: "PERMISSIONLESS CREATION", x: 640, y: H - 260, delay: sec(2.8) },
        ]}
        exitFrame={ROADMAP_DURATION - sec(0.8)}
      />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 3: Exponential Growth Chart (17.5s–23.6s local = 264.9–271.0s)
// ZONE B+C (wide)
// ═══════════════════════════════════════════════════════════════════════════

const GROWTH_DURATION = sec(6.1);

// Log-scale Y positions for the chart
const Y_TICKS = [
  { value: "1K", log: 3 },
  { value: "10K", log: 4 },
  { value: "100K", log: 5 },
  { value: "1M", log: 6 },
  { value: "10M", log: 7 },
  { value: "100M", log: 8 },
  { value: "1B", log: 9 },
];

const ExponentialGrowthChart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const exitOp = interpolate(frame, [GROWTH_DURATION - sec(0.8), GROWTH_DURATION], [1, 0], CLAMP);

  // Chart bounds — avoid face center (35%-65%)
  // Left chart area: ZONE B (50px - 630px)
  // Right chart area: ZONE C (1290px - 1870px)
  // We'll draw a wide chart that has a gap in the middle
  const chartLeft = 120;
  const chartRight = W - 80;
  const chartTop = 80;
  const chartBottom = H - 250;
  const chartH = chartBottom - chartTop;
  const chartW = chartRight - chartLeft;

  // Map log value to Y
  const logToY = (log: number) => {
    const minLog = 3;
    const maxLog = 9;
    return chartBottom - ((log - minLog) / (maxLog - minLog)) * chartH;
  };

  // Curve path — exponential growth
  // X: 12 months, Jan 2026 → Dec 2026 → mid 2027
  const months = 18;
  const monthWidth = chartW / months;

  // Growth curve data: starts at ~10K, currently ~500K (month 4), targets 1B
  const growthPath = (() => {
    const points: string[] = [];
    for (let m = 0; m <= months; m++) {
      // Exponential: 10K * e^(0.7*m) roughly
      const val = 10000 * Math.exp(0.68 * m);
      const logVal = Math.log10(Math.min(val, 1e9));
      const x = chartLeft + m * monthWidth;
      const y = logToY(logVal);
      points.push(`${m === 0 ? "M" : "L"}${x},${y}`);
    }
    return points.join(" ");
  })();

  // Animate the curve drawing
  const curveProgress = interpolate(frame, [sec(0.8), sec(3.5)], [0, 1], {
    ...CLAMP,
    easing: EASE.out,
  });

  // Approximate path length for dashoffset
  const pathLen = 2200;
  const dashOffset = pathLen * (1 - curveProgress);

  // "NOW" marker at ~month 4 (500K)
  const nowX = chartLeft + 4 * monthWidth;
  const nowY = logToY(Math.log10(500000));
  const nowDelay = sec(2.0);
  const nowSpring = spring({
    frame: Math.max(frame - nowDelay, 0),
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.5 },
  });

  // "TARGET" marker at month 18 (1B)
  const targetX = chartLeft + 18 * monthWidth;
  const targetY = logToY(9);
  const targetDelay = sec(3.2);
  const targetSpring = spring({
    frame: Math.max(frame - targetDelay, 0),
    fps,
    config: { damping: 12, stiffness: 160, mass: 0.6 },
  });

  // Pulse for NOW marker
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.15);

  // Axes fade in
  const axesOp = interpolate(frame, [0, sec(0.6)], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={{ opacity: exitOp }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient id="growth-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={BRAND_GREEN} stopOpacity={0.6} />
            <stop offset="100%" stopColor={BRAND_GREEN} stopOpacity={1} />
          </linearGradient>
          <filter id="growth-glow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="target-glow">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Y-axis */}
        <g opacity={axesOp}>
          <line
            x1={chartLeft}
            y1={chartTop}
            x2={chartLeft}
            y2={chartBottom}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={1}
          />
          {Y_TICKS.map((tick) => {
            const y = logToY(tick.log);
            return (
              <g key={tick.value}>
                <line
                  x1={chartLeft - 8}
                  y1={y}
                  x2={chartRight}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeWidth={1}
                />
                <text
                  x={chartLeft - 14}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="central"
                  fill="rgba(255, 255, 255, 0.4)"
                  fontFamily={monoFont}
                  fontSize={11}
                  fontWeight={400}
                >
                  {tick.value}
                </text>
              </g>
            );
          })}

          {/* X-axis */}
          <line
            x1={chartLeft}
            y1={chartBottom}
            x2={chartRight}
            y2={chartBottom}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={1}
          />
          {/* Month labels */}
          {["Jan", "Apr", "Jul", "Oct", "Jan", "Apr"].map((label, i) => {
            const x = chartLeft + i * 3 * monthWidth;
            return (
              <text
                key={`${label}-${i}`}
                x={x}
                y={chartBottom + 20}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255, 255, 255, 0.35)"
                fontFamily={monoFont}
                fontSize={10}
              >
                {label} {i < 4 ? "26" : "27"}
              </text>
            );
          })}

          {/* Axis labels */}
          <text
            x={chartLeft - 50}
            y={(chartTop + chartBottom) / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="rgba(255, 255, 255, 0.3)"
            fontFamily={font}
            fontSize={12}
            fontWeight={600}
            letterSpacing={2}
            transform={`rotate(-90, ${chartLeft - 50}, ${(chartTop + chartBottom) / 2})`}
          >
            MARKETS
          </text>
        </g>

        {/* Growth curve — glowing trail */}
        <path
          d={growthPath}
          fill="none"
          stroke={BRAND_GREEN}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={pathLen}
          strokeDashoffset={dashOffset}
          filter="url(#growth-glow)"
          opacity={0.4}
        />
        {/* Growth curve — solid */}
        <path
          d={growthPath}
          fill="none"
          stroke="url(#growth-gradient)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={pathLen}
          strokeDashoffset={dashOffset}
        />

        {/* NOW marker */}
        <g
          opacity={interpolate(nowSpring, [0, 1], [0, 1], CLAMP)}
          transform={`translate(${nowX}, ${nowY})`}
        >
          {/* Pulse ring */}
          <circle
            cx={0}
            cy={0}
            r={14 + 4 * pulse}
            fill="none"
            stroke={BRAND_GREEN}
            strokeWidth={1.5}
            opacity={0.3 * pulse}
          />
          <circle cx={0} cy={0} r={6} fill={BRAND_GREEN} />
          <rect
            x={12}
            y={-14}
            width={100}
            height={28}
            rx={4}
            fill="rgba(10, 10, 10, 0.9)"
            stroke={BRAND_GREEN}
            strokeWidth={1}
          />
          <text
            x={62}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fill={BRAND_GREEN}
            fontFamily={monoFont}
            fontWeight={700}
            fontSize={13}
          >
            NOW: 500K
          </text>
        </g>

        {/* TARGET marker */}
        <g
          opacity={interpolate(targetSpring, [0, 1], [0, 1], CLAMP)}
          transform={`translate(${targetX}, ${targetY})`}
        >
          <circle
            cx={0}
            cy={0}
            r={10}
            fill="none"
            stroke="#fafafa"
            strokeWidth={2}
            filter="url(#target-glow)"
          />
          <circle cx={0} cy={0} r={4} fill="#fafafa" />
          <rect
            x={-140}
            y={-40}
            width={130}
            height={28}
            rx={4}
            fill="rgba(10, 10, 10, 0.9)"
            stroke="rgba(255, 255, 255, 0.5)"
            strokeWidth={1}
          />
          <text
            x={-75}
            y={-26}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fafafa"
            fontFamily={monoFont}
            fontWeight={700}
            fontSize={12}
          >
            TARGET: 1B
          </text>
        </g>
      </svg>

      {/* Counter spinning up — lower right, ZONE C */}
      {frame >= sec(3.5) && (
        <div
          style={{
            position: "absolute",
            right: 100,
            bottom: 180,
            opacity: interpolate(frame - sec(3.5), [0, sec(0.5)], [0, 1], CLAMP),
          }}
        >
          <div style={{ ...PANEL, padding: "24px 40px" }}>
            <Counter
              target={1_000_000_000}
              durationFrames={sec(2.5)}
              startFrame={0}
              label="target markets"
              fontSize={48}
              color={BRAND_GREEN}
            />
          </div>
        </div>
      )}

      {/* Proof context at bottom */}
      {(() => {
        const proofDelay = sec(4.0);
        const proofOp = interpolate(frame - proofDelay, [0, sec(0.6)], [0, 1], CLAMP);
        return (
          <div
            style={{
              position: "absolute",
              bottom: 40,
              left: 0,
              right: 0,
              textAlign: "center",
              opacity: proofOp,
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 14,
                fontWeight: 400,
                color: "rgba(255, 255, 255, 0.45)",
                letterSpacing: 0.5,
              }}
            >
              Polymarket: {PREDICTION_MARKETS.totalVolume2025} volume in 2025 with{" "}
              {COMPARISONS.polymarketMarkets} markets. What happens with 1,000,000,000?
            </span>
          </div>
        );
      })()}

      {/* Parasite labels */}
      <ParasiteLabels
        labels={[
          { text: "NEW SOURCES WEEKLY", x: 140, y: 140, delay: sec(1.5) },
          { text: "AUTOMATIC SCALING", x: 140, y: 170, delay: sec(2.0) },
          { text: "PERMISSIONLESS CREATION", x: 140, y: 200, delay: sec(2.5) },
        ]}
        exitFrame={GROWTH_DURATION - sec(0.8)}
      />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SHARED: Parasite Labels
// ═══════════════════════════════════════════════════════════════════════════

interface ParasiteLabel {
  text: string;
  x: number;
  y: number;
  delay: number; // frames
}

const ParasiteLabels: React.FC<{
  labels: ParasiteLabel[];
  exitFrame: number;
}> = ({ labels, exitFrame }) => {
  const frame = useCurrentFrame();

  return (
    <>
      {labels.map((label) => {
        const localFrame = frame - label.delay;
        const enterOp = interpolate(localFrame, [0, sec(0.4)], [0, 1], CLAMP);
        const exitOp = interpolate(frame, [exitFrame, exitFrame + sec(0.5)], [1, 0], CLAMP);

        // Subtle pulse on first appearance
        const pulseScale =
          localFrame > 0 && localFrame < sec(0.8)
            ? 1 + 0.05 * Math.sin(localFrame * 0.5)
            : 1;

        return (
          <div
            key={label.text}
            style={{
              position: "absolute",
              left: label.x,
              top: label.y,
              opacity: Math.min(enterOp, exitOp),
              transform: `scale(${pulseScale})`,
              transformOrigin: "left center",
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 10,
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.5)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {label.text}
            </span>
          </div>
        );
      })}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const SourcesDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Diagram 1: Source Selection Tree — 0s–12.0s local */}
      <Sequence from={0} durationInFrames={sec(12.0)}>
        <SourceSelectionTree />
        <Audio src={staticFile("sfx/whoosh-scene-grid.mp3")} volume={0.55} />
      </Sequence>

      {/* Diagram 2: Source Roadmap — 12.0s–17.5s local */}
      <Sequence from={sec(12.0)} durationInFrames={sec(5.5)}>
        <SourceRoadmap />
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.45} />
      </Sequence>

      {/* Diagram 3: Exponential Growth Chart — 17.5s–23.6s local */}
      <Sequence from={sec(17.5)} durationInFrames={sec(6.1)}>
        <ExponentialGrowthChart />
        <Audio src={staticFile("sfx/metric-count-up.mp3")} volume={0.55} />
      </Sequence>
    </AbsoluteFill>
  );
};
