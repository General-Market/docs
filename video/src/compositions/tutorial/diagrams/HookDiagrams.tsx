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
import { C } from "../../../common/colors";
import { FPS, BRAND_GREEN } from "../theme";
import { HEDGE_FUNDS } from "../proofData";

const sec = (s: number) => Math.round(s * FPS);
const W = 1920;
const H = 1080;

const GREEN = BRAND_GREEN;
const RED = C.red;
const DARK_PANEL = "rgba(10, 10, 10, 0.85)";

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ── DiagramBox ──────────────────────────────────────────────────────────────
interface DiagramBoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  progress: number; // 0→1 spring
  glow?: string;
  fontSize?: number;
}

const DiagramBox: React.FC<DiagramBoxProps> = ({
  x,
  y,
  w,
  h,
  label,
  progress,
  glow,
  fontSize = 14,
}) => {
  const scale = interpolate(progress, [0, 1], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <g
      transform={`translate(${x + w / 2}, ${y + h / 2}) scale(${scale}) translate(${-(w / 2)}, ${-(h / 2)})`}
      opacity={opacity}
    >
      {glow && (
        <rect
          x={-4}
          y={-4}
          width={w + 8}
          height={h + 8}
          rx={14}
          fill="none"
          stroke={glow}
          strokeWidth={2}
          opacity={0.5}
          filter="url(#glow)"
        />
      )}
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={10}
        fill="rgba(20, 20, 20, 0.9)"
        stroke="rgba(255, 255, 255, 0.3)"
        strokeWidth={1.5}
      />
      <text
        x={w / 2}
        y={h / 2 + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fafafa"
        fontFamily={font}
        fontWeight={700}
        fontSize={fontSize}
      >
        {label}
      </text>
    </g>
  );
};

// ── AnimatedArrow ───────────────────────────────────────────────────────────
interface AnimatedArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  progress: number; // 0→1
  color?: string;
  strokeW?: number;
}

const AnimatedArrow: React.FC<AnimatedArrowProps> = ({
  x1,
  y1,
  x2,
  y2,
  progress,
  color = "rgba(255, 255, 255, 0.6)",
  strokeW = 2,
}) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const dashOffset = interpolate(progress, [0, 1], [len, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowOpacity = interpolate(progress, [0.7, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Arrowhead points
  const angle = Math.atan2(dy, dx);
  const headLen = 10;
  const ax = x2 - headLen * Math.cos(angle - Math.PI / 6);
  const ay = y2 - headLen * Math.sin(angle - Math.PI / 6);
  const bx = x2 - headLen * Math.cos(angle + Math.PI / 6);
  const by = y2 - headLen * Math.sin(angle + Math.PI / 6);

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeW}
        strokeDasharray={len}
        strokeDashoffset={dashOffset}
      />
      <polygon
        points={`${x2},${y2} ${ax},${ay} ${bx},${by}`}
        fill={color}
        opacity={arrowOpacity}
      />
    </g>
  );
};

// ── LeaderLine + ParasiteLabel ──────────────────────────────────────────────
interface ParasiteLabelProps {
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
  text: string;
  progress: number;
  color?: string;
}

const ParasiteLabel: React.FC<ParasiteLabelProps> = ({
  anchorX,
  anchorY,
  labelX,
  labelY,
  text,
  progress,
  color = "rgba(255, 255, 255, 0.55)",
}) => {
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = 1 + 0.04 * Math.sin(progress * Math.PI * 2);

  return (
    <g opacity={opacity}>
      <line
        x1={anchorX}
        y1={anchorY}
        x2={labelX}
        y2={labelY}
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <circle cx={anchorX} cy={anchorY} r={2.5} fill={color} />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontFamily={monoFont}
        fontWeight={400}
        fontSize={10}
        letterSpacing={0.6}
        transform={`scale(${pulse})`}
      >
        {text.toUpperCase()}
      </text>
    </g>
  );
};

// SVG filter for glow effects
const GlowFilter: React.FC = () => (
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="glowStrong" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 1: Bot Pipeline (0.2s – 3.4s local)
// ═══════════════════════════════════════════════════════════════════════════

const PIPELINE_BOXES = [
  { label: "YOU", w: 90, h: 44 },
  { label: "CLAUDE CODE", w: 140, h: 44 },
  { label: "BOT", w: 80, h: 44 },
  { label: "GM PLATFORM", w: 140, h: 44 },
  { label: "500K MARKETS", w: 150, h: 44 },
];

const PIPELINE_LABELS = ["prompt", "strategy", "API", "execution"];

const BotPipeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Zone D: bottom 20% of screen
  const baseY = H * 0.82;
  const totalW = PIPELINE_BOXES.reduce((s, b) => s + b.w, 0) + 50 * 4;
  const startX = (W - totalW) / 2;

  let cx = startX;
  const positions: { x: number; y: number; w: number; h: number }[] = [];
  for (const box of PIPELINE_BOXES) {
    positions.push({ x: cx, y: baseY, w: box.w, h: box.h });
    cx += box.w + 50;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <GlowFilter />

      {/* Dark backdrop for Zone D */}
      <rect
        x={0}
        y={H * 0.75}
        width={W}
        height={H * 0.25}
        fill={DARK_PANEL}
        opacity={interpolate(frame, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
      />

      {/* Boxes spring in L→R with 0.3s stagger */}
      {PIPELINE_BOXES.map((box, i) => {
        const staggerFrame = i * sec(0.3);
        const s = spring({
          frame: Math.max(frame - staggerFrame, 0),
          fps,
          config: { damping: 14, stiffness: 120, mass: 0.7 },
        });
        const p = positions[i];
        const isLast = i === PIPELINE_BOXES.length - 1;
        return (
          <DiagramBox
            key={box.label}
            x={p.x}
            y={p.y}
            w={p.w}
            h={p.h}
            label={box.label}
            progress={s}
            glow={isLast ? GREEN : undefined}
            fontSize={i === 1 ? 12 : 14}
          />
        );
      })}

      {/* Animated arrows between boxes */}
      {positions.slice(0, -1).map((p, i) => {
        const next = positions[i + 1];
        const arrowDelay = (i + 1) * sec(0.3);
        const arrowProg = interpolate(
          frame - arrowDelay,
          [0, sec(0.4)],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <AnimatedArrow
            key={`arrow-${i}`}
            x1={p.x + p.w}
            y1={p.y + p.h / 2}
            x2={next.x}
            y2={next.y + next.h / 2}
            progress={arrowProg}
          />
        );
      })}

      {/* Parasite labels on arrows */}
      {PIPELINE_LABELS.map((label, i) => {
        const p = positions[i];
        const next = positions[i + 1];
        const midX = (p.x + p.w + next.x) / 2;
        const midY = p.y + p.h / 2;
        const labelDelay = (i + 1) * sec(0.3) + sec(0.3);
        const lProg = interpolate(
          frame - labelDelay,
          [0, sec(0.3)],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <ParasiteLabel
            key={label}
            anchorX={midX}
            anchorY={midY}
            labelX={midX}
            labelY={midY - 28}
            text={label}
            progress={lProg}
          />
        );
      })}
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 2: Problem Constellation (11.3s – 22.2s local)
// ═══════════════════════════════════════════════════════════════════════════

const PROBLEMS = [
  { label: "LIQUIDITY", parasite: "orderbook depth", hitSec: 0 },
  { label: "CAPITAL LOCK", parasite: "lock period", hitSec: 7.98 },
  { label: "RISK MGMT", parasite: "counterparty exposure", hitSec: 9.02 },
];

// Triangle positions — centered in frame (main visual, dominates the shot)
const TRIANGLE = [
  { x: 960, y: 280 },  // top center
  { x: 580, y: 680 },  // bottom-left
  { x: 1340, y: 680 }, // bottom-right
];

const ProblemConstellation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Solution box appears after all 3 are named (~10s into this sequence)
  const solutionDelay = sec(10);
  const solutionProg = spring({
    frame: Math.max(frame - solutionDelay, 0),
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.7 },
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <GlowFilter />

      {/* Dark backdrop behind constellation for readability */}
      <rect
        x={440}
        y={210}
        width={1040}
        height={680}
        rx={24}
        fill="rgba(10, 10, 10, 0.80)"
      />

      {/* Pulsing red connection lines between triangle points */}
      {TRIANGLE.map((p, i) => {
        const next = TRIANGLE[(i + 1) % 3];
        const lineOpacity = interpolate(frame, [sec(0.5), sec(1.5)], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const pulse = 0.3 + 0.15 * Math.sin(frame * 0.15 + i * 2);
        return (
          <line
            key={`conn-${i}`}
            x1={p.x}
            y1={p.y}
            x2={next.x}
            y2={next.y}
            stroke={RED}
            strokeWidth={2}
            opacity={lineOpacity * pulse}
            strokeDasharray="8 4"
          />
        );
      })}

      {/* Problem nodes */}
      {PROBLEMS.map((prob, i) => {
        const pos = TRIANGLE[i];
        const nodeDelay = sec(prob.hitSec);
        const baseProg = spring({
          frame: Math.max(frame - sec(0.3) - i * sec(0.5), 0),
          fps,
          config: { damping: 16, stiffness: 120, mass: 0.7 },
        });

        // Highlight zoom when speaker names it
        const isHighlighted = frame >= nodeDelay;
        const highlightProg = isHighlighted
          ? spring({
              frame: Math.max(frame - nodeDelay, 0),
              fps,
              config: { damping: 12, stiffness: 200, mass: 0.5 },
            })
          : 0;
        const highlightScale = 1 + highlightProg * 0.2;
        const nodeR = 48;
        const nodeOpacity = interpolate(baseProg, [0, 0.3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Parasite appears 0.3s after highlight
        const parasiteDelay = nodeDelay + sec(0.3);
        const parasiteProg = interpolate(
          frame - parasiteDelay,
          [0, sec(0.4)],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        return (
          <g key={prob.label} opacity={nodeOpacity}>
            {/* Circle node */}
            <g
              transform={`translate(${pos.x}, ${pos.y}) scale(${interpolate(baseProg, [0, 1], [0.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * highlightScale})`}
            >
              {isHighlighted && (
                <circle
                  cx={0}
                  cy={0}
                  r={nodeR + 8}
                  fill="none"
                  stroke={RED}
                  strokeWidth={3}
                  opacity={0.6 + 0.3 * Math.sin(frame * 0.2)}
                  filter="url(#glow)"
                />
              )}
              <circle
                cx={0}
                cy={0}
                r={nodeR}
                fill="rgba(20, 20, 20, 0.9)"
                stroke={isHighlighted ? RED : "rgba(255, 255, 255, 0.3)"}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
              />
              <text
                x={0}
                y={2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fafafa"
                fontFamily={font}
                fontWeight={700}
                fontSize={prob.label.length > 10 ? 10 : 12}
              >
                {prob.label}
              </text>
            </g>

            {/* Parasite label */}
            <ParasiteLabel
              anchorX={pos.x}
              anchorY={pos.y + nodeR + 6}
              labelX={pos.x}
              labelY={pos.y + nodeR + 32}
              text={prob.parasite}
              progress={parasiteProg}
              color={RED}
            />
          </g>
        );
      })}

      {/* Solution box — appears after all three named */}
      <g
        transform={`translate(960, 820)`}
        opacity={interpolate(solutionProg, [0, 0.3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
      >
        {/* Arrow down from constellation */}
        <AnimatedArrow
          x1={0}
          y1={-60}
          x2={0}
          y2={-20}
          progress={solutionProg}
          color={GREEN}
          strokeW={3}
        />
        <g transform={`scale(${interpolate(solutionProg, [0, 1], [0.7, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`}>
          <rect
            x={-120}
            y={-16}
            width={240}
            height={36}
            rx={8}
            fill="rgba(0, 200, 83, 0.15)"
            stroke={GREEN}
            strokeWidth={2}
          />
          <text
            x={0}
            y={2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={GREEN}
            fontFamily={font}
            fontWeight={800}
            fontSize={14}
            letterSpacing={2}
          >
            GENERAL MARKET
          </text>
        </g>
      </g>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 3: Trade Execution Flow (22.2s – 34.1s local)
// ═══════════════════════════════════════════════════════════════════════════

const EXEC_STEPS = [
  "STRATEGY",
  "SIGNAL",
  "ORDER",
  "EXECUTION",
  "SETTLEMENT",
  "PNL",
];

const RED_X_INDICES = [3, 4]; // EXECUTION and SETTLEMENT have pain points
const RED_X_LABELS: Record<number, string> = {
  3: "slippage",
  4: "front-running",
};
const GREEN_BYPASS_LABELS: Record<number, string> = {
  3: "parimutuel",
  4: "10 min",
};

const TradeExecutionFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const baseY = H * 0.82;
  const boxW = 130;
  const boxH = 42;
  const gap = 38;
  const totalW = EXEC_STEPS.length * boxW + (EXEC_STEPS.length - 1) * gap;
  const startX = (W - totalW) / 2;

  // Phase 1: steps appear (0 – 2s)
  // Phase 2: red X markers (2s – 4s)
  // Phase 3: green bypass (4s – end)
  const redXStart = sec(2);
  const bypassStart = sec(4.5);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <GlowFilter />

      {/* Dark backdrop Zone D */}
      <rect
        x={0}
        y={H * 0.73}
        width={W}
        height={H * 0.27}
        fill={DARK_PANEL}
        opacity={interpolate(frame, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
      />

      {/* Steps */}
      {EXEC_STEPS.map((step, i) => {
        const x = startX + i * (boxW + gap);
        const stagger = i * sec(0.2);
        const s = spring({
          frame: Math.max(frame - stagger, 0),
          fps,
          config: { damping: 14, stiffness: 140, mass: 0.6 },
        });

        const isRedX = RED_X_INDICES.includes(i);
        const redProg = isRedX
          ? interpolate(frame - redXStart - (i - 3) * sec(0.5), [0, sec(0.4)], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;

        const bypassProg = isRedX
          ? interpolate(
              frame - bypassStart - (i - 3) * sec(0.5),
              [0, sec(0.6)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          : 0;

        return (
          <g key={step}>
            <DiagramBox
              x={x}
              y={baseY}
              w={boxW}
              h={boxH}
              label={step}
              progress={s}
              fontSize={step.length > 8 ? 11 : 13}
            />

            {/* Arrow to next */}
            {i < EXEC_STEPS.length - 1 && (
              <AnimatedArrow
                x1={x + boxW}
                y1={baseY + boxH / 2}
                x2={x + boxW + gap}
                y2={baseY + boxH / 2}
                progress={interpolate(
                  frame - (i + 1) * sec(0.2),
                  [0, sec(0.3)],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                )}
              />
            )}

            {/* Red X marker */}
            {isRedX && redProg > 0 && (
              <g opacity={redProg}>
                <line
                  x1={x + boxW / 2 - 14}
                  y1={baseY - 18}
                  x2={x + boxW / 2 + 14}
                  y2={baseY - 46}
                  stroke={RED}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
                <line
                  x1={x + boxW / 2 + 14}
                  y1={baseY - 18}
                  x2={x + boxW / 2 - 14}
                  y2={baseY - 46}
                  stroke={RED}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
                {/* Red parasite label */}
                <ParasiteLabel
                  anchorX={x + boxW / 2}
                  anchorY={baseY - 48}
                  labelX={x + boxW / 2}
                  labelY={baseY - 68}
                  text={RED_X_LABELS[i] || ""}
                  progress={redProg}
                  color={RED}
                />
              </g>
            )}

            {/* Green bypass arrow */}
            {isRedX && bypassProg > 0 && (
              <g opacity={bypassProg}>
                {/* Curved bypass arrow above the box */}
                <path
                  d={`M ${x - gap / 2} ${baseY + boxH / 2} Q ${x + boxW / 2} ${baseY - 80} ${x + boxW + gap / 2} ${baseY + boxH / 2}`}
                  fill="none"
                  stroke={GREEN}
                  strokeWidth={2.5}
                  strokeDasharray={200}
                  strokeDashoffset={interpolate(bypassProg, [0, 1], [200, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}
                  filter="url(#glow)"
                />
                {/* Green parasite label */}
                <ParasiteLabel
                  anchorX={x + boxW / 2}
                  anchorY={baseY - 78}
                  labelX={x + boxW / 2}
                  labelY={baseY - 98}
                  text={GREEN_BYPASS_LABELS[i] || ""}
                  progress={bypassProg}
                  color={GREEN}
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 4: Audience Cards (34.1s – 42.8s local)
// ═══════════════════════════════════════════════════════════════════════════

interface AudienceCardData {
  title: string;
  subtitle: string;
  stat?: string;
  statLabel?: string;
}

const RETAIL_CARD: AudienceCardData = {
  title: "RETAIL TRADER",
  subtitle: "No minimum. $0 fees.",
};

const FUND_CARD: AudienceCardData = {
  title: "FUND MANAGER",
  subtitle: "Institutional grade.",
  stat: HEDGE_FUNDS.totalAUM,
  statLabel: "hedge fund AUM",
};

const AudienceCard: React.FC<{
  data: AudienceCardData;
  x: number;
  progress: number;
  checkProgress: number;
  frame: number;
}> = ({ data, x, progress, checkProgress, frame }) => {
  const cardW = 280;
  const cardH = 160;
  const y = H * 0.38;

  const scale = interpolate(progress, [0, 1], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Checkmark draw
  const checkLen = 30;
  const checkDashOffset = interpolate(checkProgress, [0, 1], [checkLen, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale})`}
      opacity={opacity}
    >
      <rect
        x={0}
        y={0}
        width={cardW}
        height={cardH}
        rx={12}
        fill="rgba(15, 15, 15, 0.92)"
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth={1.5}
      />

      {/* Title */}
      <text
        x={cardW / 2}
        y={36}
        textAnchor="middle"
        fill="#fafafa"
        fontFamily={font}
        fontWeight={800}
        fontSize={18}
        letterSpacing={2}
      >
        {data.title}
      </text>

      {/* Subtitle */}
      <text
        x={cardW / 2}
        y={60}
        textAnchor="middle"
        fill="rgba(255, 255, 255, 0.5)"
        fontFamily={font}
        fontWeight={400}
        fontSize={12}
      >
        {data.subtitle}
      </text>

      {/* Stat (for fund card) */}
      {data.stat && (
        <>
          <text
            x={cardW / 2}
            y={94}
            textAnchor="middle"
            fill={GREEN}
            fontFamily={monoFont}
            fontWeight={700}
            fontSize={24}
          >
            {data.stat}
          </text>
          <text
            x={cardW / 2}
            y={116}
            textAnchor="middle"
            fill="rgba(255, 255, 255, 0.4)"
            fontFamily={monoFont}
            fontWeight={400}
            fontSize={9}
            letterSpacing={0.6}
          >
            {(data.statLabel || "").toUpperCase()}
          </text>
        </>
      )}

      {/* Green checkmark */}
      {checkProgress > 0 && (
        <g transform={`translate(${cardW / 2 - 12}, ${data.stat ? 130 : 84})`}>
          <polyline
            points="0,12 8,22 24,2"
            fill="none"
            stroke={GREEN}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={checkLen}
            strokeDashoffset={checkDashOffset}
            filter="url(#glow)"
          />
        </g>
      )}
    </g>
  );
};

const AudienceCards: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Zone B: left side (5%-30%), Zone C: right side (70%-95%)
  const leftX = W * 0.07;
  const rightX = W * 0.66;

  const retailProg = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });

  const fundProg = spring({
    frame: Math.max(frame - sec(0.4), 0),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });

  const checkDelay = sec(1.5);
  const checkProg = interpolate(frame - checkDelay, [0, sec(0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Exit: shrink and fade
  const exitStart = sec(7);
  const exitProg = interpolate(frame, [exitStart, exitStart + sec(1)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      opacity={exitProg}
    >
      <GlowFilter />

      <AudienceCard
        data={RETAIL_CARD}
        x={leftX}
        progress={retailProg}
        checkProgress={checkProg}
        frame={frame}
      />

      <AudienceCard
        data={FUND_CARD}
        x={rightX}
        progress={fundProg}
        checkProgress={interpolate(
          frame - checkDelay - sec(0.3),
          [0, sec(0.5)],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )}
        frame={frame}
      />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — Assembled HookDiagrams
// ═══════════════════════════════════════════════════════════════════════════

// All times are LOCAL to hookOverlays (which starts at 0s in video time)
const PIPE_START = sec(0.2);
const PIPE_END = sec(3.4);

const CONSTELLATION_START = sec(11.3);
const CONSTELLATION_END = sec(22.2);

const EXEC_FLOW_START = sec(22.2);
const EXEC_FLOW_END = sec(34.1);

const AUDIENCE_START = sec(34.1);
const AUDIENCE_END = sec(42.8);

export const HookDiagrams: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* 1. Bot Pipeline */}
      <Sequence from={PIPE_START} durationInFrames={PIPE_END - PIPE_START}>
        <BotPipeline />
        <Audio src={staticFile("sfx/whoosh-scene-grid.mp3")} volume={0.45} />
      </Sequence>

      {/* 2. Problem Constellation */}
      <Sequence
        from={CONSTELLATION_START}
        durationInFrames={CONSTELLATION_END - CONSTELLATION_START}
      >
        <ProblemConstellation />
        {/* SFX: scroll-tick on each problem node highlight */}
        {PROBLEMS.map((prob, i) => (
          <Sequence key={prob.label} from={sec(prob.hitSec)}>
            <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
          </Sequence>
        ))}
      </Sequence>

      {/* 3. Trade Execution Flow */}
      <Sequence
        from={EXEC_FLOW_START}
        durationInFrames={EXEC_FLOW_END - EXEC_FLOW_START}
      >
        <TradeExecutionFlow />
      </Sequence>

      {/* 4. Audience Cards */}
      <Sequence
        from={AUDIENCE_START}
        durationInFrames={AUDIENCE_END - AUDIENCE_START}
      >
        <AudienceCards />
      </Sequence>
    </AbsoluteFill>
  );
};
