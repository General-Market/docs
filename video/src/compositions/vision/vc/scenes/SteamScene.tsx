import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

const BLUE = "#1a9fff";
const DOTA_GREEN = "#4ade80";
const GRID = "#ffffff0a";
const GRID_PATTERN = "#ffffff05";

// Generate a plausible player-count curve — gradual climb then steep spike
const DATA_POINTS = 60;
const generateCurve = (): number[] => {
  const pts: number[] = [];
  for (let i = 0; i < DATA_POINTS; i++) {
    const t = i / (DATA_POINTS - 1);
    // Gentle slope then exponential rise
    const base = 750000 + 150000 * t + 300000 * Math.pow(t, 3.5);
    // Add micro-noise
    const noise = Math.sin(i * 2.7) * 8000 + Math.cos(i * 4.1) * 5000;
    pts.push(base + noise);
  }
  return pts;
};

// Dota 2 curve — lower, flatter, mild hump
const generateDotaCurve = (): number[] => {
  const pts: number[] = [];
  for (let i = 0; i < DATA_POINTS; i++) {
    const t = i / (DATA_POINTS - 1);
    const base = 620000 + 40000 * Math.sin(t * Math.PI * 0.8) + 15000 * t;
    const noise = Math.sin(i * 3.3) * 5000 + Math.cos(i * 1.9) * 3000;
    pts.push(base + noise);
  }
  return pts;
};

const CURVE = generateCurve();
const DOTA_CURVE = generateDotaCurve();
const MIN_VAL = 550000;
const MAX_VAL = 1250000;

// Find the peak index and value in CS2 curve
const PEAK_INDEX = CURVE.reduce((maxI, v, i, arr) => (v > arr[maxI] ? i : maxI), 0);
const PEAK_VAL = CURVE[PEAK_INDEX];

const CHART_LEFT = 140;
const CHART_RIGHT = 1500;
const CHART_TOP = 200;
const CHART_BOTTOM = 780;

const valToY = (v: number) =>
  CHART_BOTTOM - ((v - MIN_VAL) / (MAX_VAL - MIN_VAL)) * (CHART_BOTTOM - CHART_TOP);

const idxToX = (i: number) =>
  CHART_LEFT + (i / (DATA_POINTS - 1)) * (CHART_RIGHT - CHART_LEFT);

// Seeded pseudo-random for deterministic particles
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Particle config — sparks that rise from the line as it climbs
const PARTICLE_COUNT = 7;
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  spawnIndex: Math.floor(25 + i * 4.5), // spawn from the climbing portion
  offsetX: seededRandom(i * 7 + 1) * 30 - 15,
  driftX: seededRandom(i * 7 + 2) * 20 - 10,
  riseSpeed: 40 + seededRandom(i * 7 + 3) * 60, // pixels of upward travel
  size: 2 + seededRandom(i * 7 + 4) * 3,
  lifetime: 25 + seededRandom(i * 7 + 5) * 25, // frames
  delay: i * 6, // stagger spawns
}));

// Time axis labels
const TIME_LABELS = [
  { label: "12:00", t: 0 },
  { label: "15:00", t: 0.33 },
  { label: "18:00", t: 0.66 },
  { label: "21:00", t: 1 },
];

export const SteamScene: React.FC = () => {
  const frame = useCurrentFrame();

  // How far along the chart we've drawn (0..DATA_POINTS-1)
  const drawProgress = interpolate(frame, [10, 110], [0, DATA_POINTS - 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const drawnCount = Math.floor(drawProgress) + 1;
  const visiblePoints = CURVE.slice(0, drawnCount);
  const visibleDotaPoints = DOTA_CURVE.slice(0, drawnCount);

  // Build SVG paths — CS2
  let linePath = "";
  let areaPath = "";
  visiblePoints.forEach((v, i) => {
    const x = idxToX(i);
    const y = valToY(v);
    linePath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  if (visiblePoints.length > 0) {
    const lastX = idxToX(visiblePoints.length - 1);
    const firstX = idxToX(0);
    areaPath =
      linePath + ` L ${lastX} ${CHART_BOTTOM} L ${firstX} ${CHART_BOTTOM} Z`;
  }

  // Build SVG path — Dota 2
  let dotaLinePath = "";
  visibleDotaPoints.forEach((v, i) => {
    const x = idxToX(i);
    const y = valToY(v);
    dotaLinePath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  // Current count for the big number
  const currentVal = visiblePoints[visiblePoints.length - 1] ?? 750000;
  const displayCount = Math.round(currentVal).toLocaleString("en-US");

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Glow intensity ramps up with the spike — now pulsing
  const baseGlow = interpolate(drawProgress, [30, 59], [4, 12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glowPulse = Math.sin(frame * 0.15) * 4; // oscillates ±4 → total range ~8-16
  const glowIntensity = Math.max(4, baseGlow + glowPulse);

  // Grid lines (horizontal)
  const gridValues = [600000, 700000, 800000, 900000, 1000000, 1100000, 1200000];

  // Vertical grid lines — evenly spaced
  const VERT_GRID_COUNT = 12;
  const vertGridLines = Array.from({ length: VERT_GRID_COUNT + 1 }, (_, i) => {
    const t = i / VERT_GRID_COUNT;
    return CHART_LEFT + t * (CHART_RIGHT - CHART_LEFT);
  });

  // Peak marker visibility — show after the peak index is drawn
  const peakVisible = drawnCount > PEAK_INDEX;
  const peakOpacity = peakVisible
    ? interpolate(
        drawProgress,
        [PEAK_INDEX, PEAK_INDEX + 8],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;
  const peakX = idxToX(PEAK_INDEX);
  const peakY = valToY(PEAK_VAL);

  // LIVE indicator pulse
  const liveDotOpacity = interpolate(
    Math.sin(frame * 0.2),
    [-1, 1],
    [0.3, 1]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity={0.25} />
            <stop offset="100%" stopColor={BLUE} stopOpacity={0.02} />
          </linearGradient>
          <filter id="lineGlow">
            <feGaussianBlur
              stdDeviation={glowIntensity}
              result="blur"
            />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="dotaGlow">
            <feGaussianBlur stdDeviation={3} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="peakGlow">
            <feGaussianBlur stdDeviation={6} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background grid pattern — vertical */}
        {vertGridLines.map((x, i) => (
          <line
            key={`vg-${i}`}
            x1={x}
            y1={CHART_TOP}
            x2={x}
            y2={CHART_BOTTOM}
            stroke={GRID_PATTERN}
            strokeWidth={1}
          />
        ))}

        {/* Horizontal grid lines */}
        {gridValues.map((v) => {
          const y = valToY(v);
          return (
            <g key={v}>
              <line
                x1={CHART_LEFT}
                y1={y}
                x2={CHART_RIGHT}
                y2={y}
                stroke={GRID}
                strokeWidth={1}
              />
              <text
                x={CHART_LEFT - 16}
                y={y + 5}
                textAnchor="end"
                fill="#ffffff22"
                fontSize={13}
                fontFamily="'Courier New', monospace"
              >
                {(v / 1000).toFixed(0)}k
              </text>
            </g>
          );
        })}

        {/* Y-axis */}
        <line
          x1={CHART_LEFT}
          y1={CHART_TOP}
          x2={CHART_LEFT}
          y2={CHART_BOTTOM}
          stroke="#ffffff15"
          strokeWidth={1}
        />

        {/* X-axis baseline */}
        <line
          x1={CHART_LEFT}
          y1={CHART_BOTTOM}
          x2={CHART_RIGHT}
          y2={CHART_BOTTOM}
          stroke="#ffffff15"
          strokeWidth={1}
        />

        {/* Time axis labels */}
        {TIME_LABELS.map(({ label, t }) => {
          const x = CHART_LEFT + t * (CHART_RIGHT - CHART_LEFT);
          return (
            <text
              key={label}
              x={x}
              y={CHART_BOTTOM + 28}
              textAnchor="middle"
              fill="#ffffff22"
              fontSize={13}
              fontFamily="'Courier New', monospace"
            >
              {label}
            </text>
          );
        })}

        {/* Area fill — CS2 */}
        {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

        {/* Dota 2 line — dimmer context */}
        {dotaLinePath && (
          <path
            d={dotaLinePath}
            fill="none"
            stroke={DOTA_GREEN}
            strokeWidth={2}
            opacity={0.4}
            filter="url(#dotaGlow)"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Dota 2 label — appears near the end of dota line */}
        {visibleDotaPoints.length > 20 && (
          <text
            x={idxToX(visibleDotaPoints.length - 1) + 12}
            y={valToY(visibleDotaPoints[visibleDotaPoints.length - 1]) + 5}
            fill={DOTA_GREEN}
            opacity={0.4}
            fontSize={12}
            fontFamily="'Inter', sans-serif"
            fontWeight={600}
          >
            Dota 2
          </text>
        )}

        {/* CS2 main line — pulsing glow */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={BLUE}
            strokeWidth={3}
            filter="url(#lineGlow)"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Floating spark particles rising from the climbing line */}
        {particles.map((p, i) => {
          const spawnFrame = 10 + (p.spawnIndex / (DATA_POINTS - 1)) * 100 + p.delay;
          const age = frame - spawnFrame;
          if (age < 0 || age > p.lifetime) return null;

          const progress = age / p.lifetime;
          const fadeIn = Math.min(progress * 5, 1);
          const fadeOut = 1 - Math.pow(progress, 2);
          const opacity = fadeIn * fadeOut * 0.8;

          const baseX = idxToX(p.spawnIndex) + p.offsetX;
          const baseY = valToY(CURVE[p.spawnIndex]);
          const x = baseX + p.driftX * progress;
          const y = baseY - p.riseSpeed * progress;

          return (
            <circle
              key={`spark-${i}`}
              cx={x}
              cy={y}
              r={p.size * (1 - progress * 0.5)}
              fill={BLUE}
              opacity={opacity}
            />
          );
        })}

        {/* Tip dot */}
        {visiblePoints.length > 1 && (
          <circle
            cx={idxToX(visiblePoints.length - 1)}
            cy={valToY(currentVal)}
            r={6}
            fill={BLUE}
            opacity={interpolate(
              Math.sin(frame * 0.3),
              [-1, 1],
              [0.7, 1]
            )}
          />
        )}

        {/* PEAK marker — triangle + label */}
        {peakOpacity > 0 && (
          <g opacity={peakOpacity}>
            {/* Small downward-pointing triangle above peak */}
            <polygon
              points={`${peakX},${peakY - 14} ${peakX - 6},${peakY - 26} ${peakX + 6},${peakY - 26}`}
              fill={BLUE}
              filter="url(#peakGlow)"
            />
            {/* Label */}
            <text
              x={peakX}
              y={peakY - 34}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={13}
              fontWeight={700}
              fontFamily="'Inter', sans-serif"
              letterSpacing={1.5}
            >
              PEAK {(PEAK_VAL / 1000000).toFixed(1)}M
            </text>
          </g>
        )}
      </svg>

      {/* HUD panel — bottom-left corner with key stats */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 40,
          width: 350,
          maxHeight: 250,
          background: "rgba(0,0,0,0.6)",
          borderRadius: 8,
          padding: "12px 16px",
          border: "1px solid rgba(255,255,255,0.08)",
          opacity: titleOpacity,
        }}
      >
        <div style={{ fontSize: 13, color: "#ffffff44", letterSpacing: 3, marginBottom: 6 }}>
          STEAM CHARTS — LIVE
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", letterSpacing: 1 }}>
          Counter-Strike 2
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            opacity: liveDotOpacity,
            boxShadow: "0 0 6px #22c55e",
          }} />
          <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", fontFamily: "'Courier New', monospace" }}>
            {displayCount}
          </span>
          <span style={{ fontSize: 12, color: "#ffffff44", letterSpacing: 2 }}>
            PLAYERS
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
