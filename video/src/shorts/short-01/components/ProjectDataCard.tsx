/**
 * ProjectDataCard — premium CoinGecko-style data card.
 *
 * 10x visual upgrade: 5-layer glass shell, 4-layer chart rendering,
 * crosshair cursor, 4-layer price dot, 3-phase entrance choreography,
 * 4 ambient post-entrance systems, logo glow ring.
 *
 * All existing props and isContinuation logic preserved.
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { noise2D } from "@remotion/noise";

const CARD_W = 744;
const CARD_H = 384;
const CHART_W = 648;
const CHART_H = 144;

// ─── Helpers ────────────────────────────────────────────────────────

function hexRgb(c: string): [number, number, number] {
  const h = c.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// ─── Premium Mini Chart ─────────────────────────────────────────────

const MiniChart: React.FC<{
  path: number[];
  color: string;
  progress: number;
  uniqueId: string;
  frame: number;
  settled: boolean;
}> = ({ path, color, progress, uniqueId, frame, settled }) => {
  const visiblePoints = Math.ceil(path.length * Math.min(progress, 1));
  if (visiblePoints < 2) return null;

  const visibleSlice = path.slice(0, visiblePoints);
  const minP = Math.min(...path) * 0.998;
  const maxP = Math.max(...path) * 1.002;
  const range = maxP - minP || 1;

  const points = visibleSlice.map((v, i) => {
    const x = (i / (path.length - 1)) * CHART_W;
    const y = CHART_H - ((v - minP) / range) * CHART_H * 0.8 - CHART_H * 0.1;
    return [x, y] as [number, number];
  });

  const pointsStr = points.map(([x, y]) => `${x},${y}`);
  const linePath = `M${pointsStr.join(" L")}`;
  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  const areaPath = `${linePath} L${lastPt[0]},${CHART_H} L${firstPt[0]},${CHART_H} Z`;

  // Ghost trail — last 5 visible points, fading
  const ghostStart = Math.max(0, points.length - 6);
  const ghostPoints = points.slice(ghostStart, points.length - 1);
  const ghostPath = ghostPoints.length >= 2
    ? `M${ghostPoints.map(([x, y]) => `${x},${y}`).join(" L")}`
    : null;

  const [cr, cg, cb] = hexRgb(color);

  // Area fill breathing
  const areaBreath = settled ? 0.9 + Math.sin(frame * 0.03) * 0.1 : 1;

  // Chart line shimmer
  const lineWidth = settled ? 3 + Math.sin(frame * 0.05) * 0.3 : 3;

  // Price dot pulse
  const dotPulseR = 12 + Math.sin(frame * 0.08) * 4;
  const dotPulseOp = 0.08 + Math.sin(frame * 0.08) * 0.04;

  // Crosshair (only after chart is fully drawn)
  const showCrosshair = progress >= 0.98 && settled;

  // Scan cursor during draw-in
  const scanX = progress < 1 ? lastPt[0] : -10;
  const scanOp = progress < 1 ? 0.4 : 0;

  // Y-axis labels (3 grid lines)
  const gridValues = [0.25, 0.5, 0.75].map((v) => {
    const price = minP + range * v;
    return { y: CHART_H * (1 - v), label: price.toFixed(4) };
  });

  return (
    <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      <defs>
        <linearGradient id={`proj-grad-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25 * areaBreath} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
        <filter id={`proj-glow-${uniqueId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
        </filter>
      </defs>

      {/* Grid lines + Y-axis labels */}
      {gridValues.map((g, i) => (
        <React.Fragment key={i}>
          <line
            x1={0} y1={g.y} x2={CHART_W} y2={g.y}
            stroke="rgba(255,255,255,0.04)" strokeWidth={1}
          />
          <text
            x={2} y={g.y - 3}
            fill="rgba(255,255,255,0.15)" fontSize={7}
            fontFamily="monospace"
          >
            {g.label}
          </text>
        </React.Fragment>
      ))}

      {/* Scanline texture in area (every 4px) */}
      {Array.from({ length: Math.floor(CHART_H / 4) }, (_, i) => (
        <line
          key={`sl-${i}`}
          x1={0} y1={i * 4} x2={CHART_W} y2={i * 4}
          stroke="rgba(255,255,255,0.015)" strokeWidth={0.5}
        />
      ))}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#proj-grad-${uniqueId})`} />

      {/* Layer 1: Glow stroke (fiber optic glow) */}
      <path
        d={linePath} fill="none"
        stroke={`rgba(${cr},${cg},${cb},0.15)`}
        strokeWidth={8} strokeLinejoin="round"
        filter={`url(#proj-glow-${uniqueId})`}
      />

      {/* Ghost trail (fading motion blur) */}
      {ghostPath && (
        <path
          d={ghostPath} fill="none"
          stroke={`rgba(${cr},${cg},${cb},0.2)`}
          strokeWidth={5} strokeLinejoin="round"
          opacity={0.3}
        />
      )}

      {/* Layer 2: Main line */}
      <path
        d={linePath} fill="none" stroke={color}
        strokeWidth={lineWidth} strokeLinejoin="round"
      />

      {/* Layer 3: Core highlight (glass fiber core) */}
      <path
        d={linePath} fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={0.5} strokeLinejoin="round"
      />

      {/* Scan cursor during draw-in */}
      {scanOp > 0 && (
        <line
          x1={scanX} y1={0} x2={scanX} y2={CHART_H}
          stroke={`rgba(${cr},${cg},${cb},${scanOp})`}
          strokeWidth={1.5}
        />
      )}

      {/* Crosshair cursor (post-draw) */}
      {showCrosshair && (
        <>
          {/* Vertical line */}
          <line
            x1={lastPt[0]} y1={0} x2={lastPt[0]} y2={CHART_H}
            stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} strokeDasharray="3 3"
          />
          {/* Horizontal line */}
          <line
            x1={0} y1={lastPt[1]} x2={CHART_W} y2={lastPt[1]}
            stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} strokeDasharray="3 3"
          />
          {/* Price label tag at intersection */}
          <rect
            x={lastPt[0] + 6} y={lastPt[1] - 10}
            width={56} height={16} rx={3}
            fill={`rgba(${cr},${cg},${cb},0.25)`}
          />
          <text
            x={lastPt[0] + 10} y={lastPt[1] + 1}
            fill="rgba(255,255,255,0.7)" fontSize={9} fontFamily="monospace"
          >
            {visibleSlice[visibleSlice.length - 1].toFixed(4)}
          </text>
        </>
      )}

      {/* 4-layer price dot */}
      {visiblePoints > 1 && (
        <>
          {/* Pulse ring (heartbeat) */}
          <circle
            cx={lastPt[0]} cy={lastPt[1]} r={dotPulseR}
            fill="none" stroke={`rgba(${cr},${cg},${cb},${dotPulseOp})`}
            strokeWidth={0.8}
          />
          {/* Outer halo */}
          <circle
            cx={lastPt[0]} cy={lastPt[1]} r={8}
            fill={`rgba(${cr},${cg},${cb},0.2)`}
            filter={`url(#proj-glow-${uniqueId})`}
          />
          {/* Mid ring */}
          <circle
            cx={lastPt[0]} cy={lastPt[1]} r={5}
            fill={`rgba(${cr},${cg},${cb},0.5)`}
          />
          {/* Core */}
          <circle cx={lastPt[0]} cy={lastPt[1]} r={2.5} fill="white" />
        </>
      )}
    </svg>
  );
};

// ─── Main component ─────────────────────────────────────────────────

interface Props {
  name: string;
  ticker: string;
  logo: string;
  color: string;
  category: string;
  pricePath: number[];
  pricePrefix?: string;
  priceDecimals?: number;
  assetDir: string;
  badgeLogo?: string;
  isContinuation?: boolean;
}

export const ProjectDataCard: React.FC<Props> = ({
  name,
  ticker,
  logo,
  color,
  category,
  pricePath,
  pricePrefix = "$",
  priceDecimals = 4,
  assetDir,
  badgeLogo,
  isContinuation = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();

  const [cr, cg, cb] = hexRgb(color);

  // Spring entrance (skip if continuation)
  const enterProgress = isContinuation
    ? 1
    : spring({
        frame,
        fps,
        config: { damping: 12, stiffness: 160, mass: 0.8 },
        durationInFrames: 20,
      });

  // Chart draw-in (skip if continuation)
  const chartProgress = isContinuation
    ? 1
    : interpolate(frame, [5, 30], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const settled = isContinuation || frame > 34;

  // Current price
  const currentIdx = Math.min(
    Math.floor(chartProgress * (pricePath.length - 1)),
    pricePath.length - 1,
  );
  const currentPrice = pricePath[currentIdx];

  // Ambient price tick — last decimal oscillates via noise
  const priceTick = settled ? noise2D("ptick" + ticker, frame * 0.02, 0) * 0.5 : 0;
  const displayPrice = currentPrice + priceTick * Math.pow(10, -priceDecimals);
  const priceText = `${pricePrefix}${displayPrice.toFixed(priceDecimals)}`;

  const startPrice = pricePath[0];
  const changePercent = (((currentPrice - startPrice) / startPrice) * 100).toFixed(2);
  const isNegative = currentPrice < startPrice;

  // Position
  const cardX = (W - CARD_W) / 2;
  const cardY = H - CARD_H - 420;

  // Ambient card drift
  const driftX = settled ? noise2D("cdx" + ticker, frame * 0.008, 0) * 1 : 0;
  const driftY = settled ? noise2D("cdy" + ticker, 0, frame * 0.008) * 0.8 : 0;

  // Logo ring pulse
  const logoGlow = settled ? 12 + Math.sin(frame * 0.06) * 3 : 12;

  // Phase 3: flash burst when chart completes drawing
  const flashFrame = 30;
  const flashLife = frame - flashFrame;
  const showFlash = !isContinuation && flashLife >= 0 && flashLife <= 4;
  const flashR = showFlash ? interpolate(flashLife, [0, 4], [8, 35]) : 0;
  const flashOp = showFlash ? interpolate(flashLife, [0, 4], [0.5, 0]) : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Layer 1: Ambient color bleed behind card */}
      <div
        style={{
          position: "absolute",
          left: cardX + CARD_W / 2 - 200 + driftX,
          top: cardY + CARD_H / 2 - 100 + driftY,
          width: 400,
          height: 200,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(${cr},${cg},${cb},0.06) 0%, transparent 70%)`,
          filter: "blur(60px)",
          opacity: enterProgress,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: cardX + driftX,
          top: cardY + driftY,
          width: CARD_W,
          height: CARD_H,
          opacity: enterProgress,
          transform: `scale(${0.7 + enterProgress * 0.3}) translateY(${(1 - enterProgress) * 40}px)`,
          // Layer 3: Glass gradient fill
          background: "linear-gradient(135deg, rgba(18,22,38,0.95) 0%, rgba(10,13,22,0.95) 100%)",
          // Layer 4: Gradient border via box-shadow trick
          border: "none",
          borderRadius: 18,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          backdropFilter: "blur(12px)",
          // Layer 2: Deep shadow + ambient glow
          boxShadow: `
            0 4px 20px rgba(0,0,0,0.5),
            0 16px 60px rgba(0,0,0,0.4),
            0 0 30px rgba(${cr},${cg},${cb},0.04),
            inset 0 1px 0 rgba(255,255,255,0.06),
            inset 1px 0 0 rgba(255,255,255,0.03)
          `,
        }}
      >
        {/* Gradient border overlay (glassmorphism bright→dim) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 18,
            border: "1px solid transparent",
            background: `linear-gradient(135deg, rgba(${cr},${cg},${cb},0.3), rgba(${cr},${cg},${cb},0.05)) border-box`,
            WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            pointerEvents: "none",
          }}
        />

        {/* Header: logo + name + price */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
            {/* Logo with glow ring */}
            <div style={{
              width: 88, height: 88, borderRadius: "50%", overflow: "hidden",
              border: "none",
              boxShadow: `
                0 0 ${logoGlow}px rgba(${cr},${cg},${cb},0.2),
                inset 0 0 0 2.5px rgba(${cr},${cg},${cb},0.3)
              `,
            }}>
              <Img
                src={staticFile(`${assetDir}/logos/${logo}`)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            {/* Gradient ring around logo */}
            <div style={{
              position: "absolute", inset: -1,
              borderRadius: "50%",
              background: `conic-gradient(from 0deg, rgba(${cr},${cg},${cb},0.4), rgba(${cr},${cg},${cb},0.08), rgba(${cr},${cg},${cb},0.4))`,
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #fff calc(100% - 2px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #fff calc(100% - 2px))",
              pointerEvents: "none",
            }} />
            {badgeLogo && (
              <div style={{
                position: "absolute", bottom: -4, right: -4,
                width: 34, height: 34, borderRadius: "50%", overflow: "hidden",
                background: "rgba(255,255,255,0.95)",
                border: "2px solid rgba(255,255,255,0.3)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transform: !isContinuation && frame >= 5 && frame <= 8
                  ? `scale(${1 + Math.max(0, 1 - (frame - 5) / 3) * 0.15})`
                  : "scale(1)",
              }}>
                <Img
                  src={staticFile(`${assetDir}/logos/${badgeLogo}`)}
                  style={{ width: "80%", height: "80%", objectFit: "contain" }}
                />
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              color: "white", fontSize: 28, fontWeight: 800,
              fontFamily: "Inter, sans-serif", letterSpacing: 1.5,
            }}>
              {ticker}
            </div>
            <div style={{
              color: `rgba(${cr},${cg},${cb},0.6)`, fontSize: 15,
              fontFamily: "Inter, sans-serif", fontWeight: 500,
            }}>
              {category}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              color: "white", fontSize: 26, fontWeight: 700, fontFamily: "monospace",
              textShadow: `0 0 8px rgba(${cr},${cg},${cb},0.15)`,
            }}>
              {priceText}
            </div>
            <div style={{
              color: isNegative ? "#ff4444" : "#22c55e",
              fontSize: 17, fontWeight: 600, fontFamily: "monospace",
            }}>
              {isNegative ? "" : "+"}{changePercent}%
            </div>
          </div>
        </div>

        {/* Mini chart */}
        <div style={{ marginTop: 4 }}>
          <MiniChart
            path={pricePath}
            color={color}
            progress={chartProgress}
            uniqueId={ticker}
            frame={frame}
            settled={settled}
          />
        </div>

        {/* Flash burst at chart completion */}
        {showFlash && (
          <div style={{
            position: "absolute",
            left: CARD_W / 2 + 24, // approximate last chart point X
            bottom: 50,
            width: flashR * 2,
            height: flashR * 2,
            marginLeft: -flashR,
            marginTop: -flashR,
            borderRadius: "50%",
            border: `1.5px solid rgba(${cr},${cg},${cb},${flashOp})`,
            pointerEvents: "none",
          }} />
        )}

        {/* Bottom accent gradient line (upgraded) */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            borderRadius: "0 0 18px 18px",
            background: `linear-gradient(90deg, rgba(${cr},${cg},${cb},0.6), rgba(${cr},${cg},${cb},0.15), transparent)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
