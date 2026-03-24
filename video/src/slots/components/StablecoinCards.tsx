/**
 * StablecoinCards — premium CoinGecko-style stablecoin comparison.
 *
 * 10x visual upgrade: 5-layer glass shell, 4-layer chart rendering,
 * glow peg line + deviation band + peg distance indicator,
 * crosshair cursor, 4-layer price dot with phase-staggered pulses,
 * 3-phase entrance, 4 ambient systems per card.
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

const W = 1080;

// ─── Helpers ────────────────────────────────────────────────────────

function hexRgb(c: string): [number, number, number] {
  const h = c.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// ─── Stablecoin data ────────────────────────────────────────────────

interface StablecoinDef {
  name: string;
  ticker: string;
  logo: string;
  color: string;
  pricePath: number[];
  delayFrames: number;
}

const STABLECOINS: StablecoinDef[] = [
  {
    name: "JUSD",
    ticker: "JUSD",
    logo: "jusd.png",
    color: "#6366f1",
    pricePath: [0.9995, 0.9994, 0.9988, 0.9989, 0.9989, 0.9988, 0.9985, 0.9984, 0.9988, 0.9989, 0.9986, 0.9985, 0.9983, 0.9983, 0.9985, 0.999, 0.9993, 0.9991, 0.9981, 0.9988, 0.9995, 0.9993, 0.9993, 0.9994, 0.9993, 0.9993, 0.9992, 0.9995, 0.9994, 0.9994],
    delayFrames: 10,
  },
  {
    name: "USDu",
    ticker: "USDu",
    logo: "usdu.png",
    color: "#f59e0b",
    pricePath: [0.9987, 0.9987, 0.999, 0.9987, 0.9989, 0.9988, 0.9983, 0.998, 0.9981, 0.9976, 0.9979, 0.9975, 0.9974, 0.9979, 0.9982, 0.9978, 0.9973, 0.9989, 0.9984, 0.9986, 0.999, 0.9988, 0.9987, 0.9999, 0.9995, 0.9992, 0.9992, 0.9995, 0.9993, 0.9992],
    delayFrames: 28,
  },
  {
    name: "JupUSD",
    ticker: "JUPUSD",
    logo: "jupusd.png",
    color: "#22c55e",
    pricePath: [0.9995, 0.9995, 0.996, 0.9997, 1.0003, 0.9999, 0.9995, 0.9996, 0.9997, 1.0003, 0.9997, 0.9997, 0.9992, 1.0, 1.0002, 1.0003, 0.9999, 0.9996, 0.9998, 1.0015, 0.9995, 1.0003, 1.0, 1.0004, 1.0003, 0.9998, 1.0001, 0.9919, 0.9997, 0.9995],
    delayFrames: 46,
  },
  {
    name: "FIDD",
    ticker: "FIDD",
    logo: "fidd.png",
    color: "#10b981",
    pricePath: [0.9955, 0.9997, 1.0003, 0.9991, 0.9995, 0.9997, 0.9994, 0.9996, 0.9989, 0.9996, 0.9996, 0.9996, 0.9995, 0.9987, 0.9999, 0.9996, 0.9998, 0.9995, 1.0003, 0.9997, 0.9995, 0.9994, 0.9997, 0.9998, 1.0003, 0.9994, 0.9999, 0.9996, 1.0, 0.9999],
    delayFrames: 64,
  },
];

const CARD_W = 860;
const CARD_H = 400;
const CHART_W = 760;
const CHART_H = 200;

// ─── Premium Mini Chart (stablecoin variant) ────────────────────────

const MiniChart: React.FC<{
  path: number[];
  color: string;
  progress: number;
  uniqueId: string;
  frame: number;
  settled: boolean;
  cardIndex: number;
}> = ({ path, color, progress, uniqueId, frame, settled, cardIndex }) => {
  const visiblePoints = Math.ceil(path.length * Math.min(progress, 1));
  if (visiblePoints < 2) return null;

  const visibleSlice = path.slice(0, visiblePoints);
  const minP = Math.min(...path) - 0.001;
  const maxP = Math.max(...path) + 0.001;
  const range = maxP - minP;

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

  // Ghost trail
  const ghostStart = Math.max(0, points.length - 6);
  const ghostPoints = points.slice(ghostStart, points.length - 1);
  const ghostPath = ghostPoints.length >= 2
    ? `M${ghostPoints.map(([x, y]) => `${x},${y}`).join(" L")}`
    : null;

  const [cr, cg, cb] = hexRgb(color);

  // $1 reference line position
  const dollarY = CHART_H - ((1.0 - minP) / range) * CHART_H * 0.8 - CHART_H * 0.1;
  // Deviation band ($0.999 and $1.001)
  const devLowY = CHART_H - ((0.999 - minP) / range) * CHART_H * 0.8 - CHART_H * 0.1;
  const devHighY = CHART_H - ((1.001 - minP) / range) * CHART_H * 0.8 - CHART_H * 0.1;

  // Area breathing
  const areaBreath = settled ? 0.9 + Math.sin(frame * 0.03 + cardIndex * 0.7) * 0.1 : 1;

  // Line shimmer
  const lineWidth = settled ? 3 + Math.sin(frame * 0.05 + cardIndex * 0.5) * 0.3 : 3;

  // Phase-staggered dot pulse
  const dotPhase = frame * 0.08 + cardIndex * 1.3;
  const dotPulseR = 12 + Math.sin(dotPhase) * 4;
  const dotPulseOp = 0.08 + Math.sin(dotPhase) * 0.04;

  // Crosshair
  const showCrosshair = progress >= 0.98 && settled;

  // Scan cursor
  const scanX = progress < 1 ? lastPt[0] : -10;
  const scanOp = progress < 1 ? 0.4 : 0;

  // Peg distance — current price proximity to $1
  const currentPriceVal = visibleSlice[visibleSlice.length - 1];
  const pegDist = Math.abs(currentPriceVal - 1.0);
  const pegInBand = pegDist <= 0.001;
  const pegDotColor = pegInBand ? "#22c55e" : "#f59e0b";
  const pegDotX = lastPt[0];

  // Y-axis labels
  const gridValues = [0.25, 0.5, 0.75].map((v) => {
    const price = minP + range * v;
    return { y: CHART_H * (1 - v), label: price.toFixed(4) };
  });

  return (
    <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      <defs>
        <linearGradient id={`stbl-grad-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2 * areaBreath} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
        <filter id={`stbl-glow-${uniqueId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
        </filter>
        <filter id={`stbl-peg-glow-${uniqueId}`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
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
            fill="rgba(255,255,255,0.15)" fontSize={8}
            fontFamily="monospace"
          >
            {g.label}
          </text>
        </React.Fragment>
      ))}

      {/* Scanline texture */}
      {Array.from({ length: Math.floor(CHART_H / 5) }, (_, i) => (
        <line
          key={`sl-${i}`}
          x1={0} y1={i * 5} x2={CHART_W} y2={i * 5}
          stroke="rgba(255,255,255,0.012)" strokeWidth={0.5}
        />
      ))}

      {/* Deviation band ($0.999 — $1.001) */}
      <rect
        x={0} y={Math.min(devHighY, devLowY)}
        width={CHART_W} height={Math.abs(devLowY - devHighY)}
        fill="rgba(34,197,94,0.03)"
      />
      <line
        x1={0} y1={devLowY} x2={CHART_W} y2={devLowY}
        stroke="rgba(34,197,94,0.06)" strokeWidth={0.5} strokeDasharray="2 4"
      />
      <line
        x1={0} y1={devHighY} x2={CHART_W} y2={devHighY}
        stroke="rgba(34,197,94,0.06)" strokeWidth={0.5} strokeDasharray="2 4"
      />

      {/* $1.00 glow peg line (background glow) */}
      <line
        x1={0} y1={dollarY} x2={CHART_W} y2={dollarY}
        stroke="rgba(34,197,94,0.08)" strokeWidth={3}
        filter={`url(#stbl-peg-glow-${uniqueId})`}
      />
      {/* $1.00 reference line */}
      <line
        x1={0} y1={dollarY} x2={CHART_W} y2={dollarY}
        stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4 4"
      />
      <text
        x={CHART_W - 4} y={dollarY - 4}
        fill="rgba(255,255,255,0.3)" fontSize={10}
        textAnchor="end" fontFamily="monospace"
      >
        $1.00
      </text>

      {/* Peg distance indicator dot on reference line */}
      {showCrosshair && (
        <>
          <circle cx={pegDotX} cy={dollarY} r={4} fill={pegDotColor} opacity={0.6} />
          <circle cx={pegDotX} cy={dollarY} r={2} fill={pegDotColor} />
        </>
      )}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#stbl-grad-${uniqueId})`} />

      {/* Layer 1: Glow stroke */}
      <path
        d={linePath} fill="none"
        stroke={`rgba(${cr},${cg},${cb},0.15)`}
        strokeWidth={8} strokeLinejoin="round"
        filter={`url(#stbl-glow-${uniqueId})`}
      />

      {/* Ghost trail */}
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

      {/* Layer 3: Core highlight */}
      <path
        d={linePath} fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={0.5} strokeLinejoin="round"
      />

      {/* Scan cursor during draw */}
      {scanOp > 0 && (
        <line
          x1={scanX} y1={0} x2={scanX} y2={CHART_H}
          stroke={`rgba(${cr},${cg},${cb},${scanOp})`}
          strokeWidth={1.5}
        />
      )}

      {/* Crosshair cursor */}
      {showCrosshair && (
        <>
          <line
            x1={lastPt[0]} y1={0} x2={lastPt[0]} y2={CHART_H}
            stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} strokeDasharray="3 3"
          />
          <line
            x1={0} y1={lastPt[1]} x2={CHART_W} y2={lastPt[1]}
            stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} strokeDasharray="3 3"
          />
          <rect
            x={lastPt[0] + 6} y={lastPt[1] - 10}
            width={60} height={16} rx={3}
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
          <circle
            cx={lastPt[0]} cy={lastPt[1]} r={dotPulseR}
            fill="none" stroke={`rgba(${cr},${cg},${cb},${dotPulseOp})`}
            strokeWidth={0.8}
          />
          <circle
            cx={lastPt[0]} cy={lastPt[1]} r={8}
            fill={`rgba(${cr},${cg},${cb},0.2)`}
            filter={`url(#stbl-glow-${uniqueId})`}
          />
          <circle
            cx={lastPt[0]} cy={lastPt[1]} r={5}
            fill={`rgba(${cr},${cg},${cb},0.5)`}
          />
          <circle cx={lastPt[0]} cy={lastPt[1]} r={2.5} fill="white" />
        </>
      )}
    </svg>
  );
};

// ─── Single stablecoin card ─────────────────────────────────────────

const StablecoinCard: React.FC<{
  coin: StablecoinDef;
  index: number;
  assetDir: string;
}> = ({ coin, index, assetDir }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < coin.delayFrames) return null;

  const localFrame = frame - coin.delayFrames;
  const [cr, cg, cb] = hexRgb(coin.color);

  // Spring entrance
  const enterProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.8 },
    durationInFrames: 15,
  });

  // Chart draw-in
  const chartProgress = interpolate(localFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const settled = localFrame > 24;

  // Position
  const GAP = 20;
  const totalH = STABLECOINS.length * CARD_H + (STABLECOINS.length - 1) * GAP;
  const startY = (1920 - totalH) / 2;
  const cardX = (W - CARD_W) / 2;
  const cardY = startY + index * (CARD_H + GAP);

  // Ambient drift
  const driftX = settled ? noise2D("scdx" + coin.ticker, frame * 0.008, 0) * 1 : 0;
  const driftY = settled ? noise2D("scdy" + coin.ticker, 0, frame * 0.008) * 0.6 : 0;

  // Price with ambient tick
  const currentIdx = Math.min(
    Math.floor(chartProgress * (coin.pricePath.length - 1)),
    coin.pricePath.length - 1,
  );
  const currentPrice = coin.pricePath[currentIdx];
  const priceTick = settled ? noise2D("spt" + coin.ticker, frame * 0.02, 0) * 0.3 : 0;
  const displayPrice = currentPrice + priceTick * 0.0001;
  const priceText = `$${displayPrice.toFixed(4)}`;

  const startPrice = coin.pricePath[0];
  const changePercent = (((currentPrice - startPrice) / startPrice) * 100).toFixed(2);
  const isNegative = currentPrice < startPrice;

  // Logo glow pulse
  const logoGlow = settled ? 10 + Math.sin(frame * 0.06 + index * 1.2) * 3 : 10;

  // Flash burst on chart complete
  const flashFrame = coin.delayFrames + 20;
  const flashLife = frame - flashFrame;
  const showFlash = flashLife >= 0 && flashLife <= 4;
  const flashR = showFlash ? interpolate(flashLife, [0, 4], [6, 30]) : 0;
  const flashOp = showFlash ? interpolate(flashLife, [0, 4], [0.4, 0]) : 0;

  return (
    <>
      {/* Ambient color bleed */}
      <div
        style={{
          position: "absolute",
          left: cardX + CARD_W / 2 - 250 + driftX,
          top: cardY + CARD_H / 2 - 80 + driftY,
          width: 500,
          height: 160,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(${cr},${cg},${cb},0.04) 0%, transparent 70%)`,
          filter: "blur(50px)",
          opacity: enterProgress,
          pointerEvents: "none",
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
          transform: `scale(${0.7 + enterProgress * 0.3}) translateY(${(1 - enterProgress) * 30}px)`,
          background: "linear-gradient(135deg, rgba(18,22,38,0.92) 0%, rgba(10,13,22,0.92) 100%)",
          border: "none",
          borderRadius: 18,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          backdropFilter: "blur(10px)",
          boxShadow: `
            0 4px 16px rgba(0,0,0,0.4),
            0 12px 48px rgba(0,0,0,0.35),
            0 0 20px rgba(${cr},${cg},${cb},0.03),
            inset 0 1px 0 rgba(255,255,255,0.05),
            inset 1px 0 0 rgba(255,255,255,0.02)
          `,
        }}
      >
        {/* Gradient border overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 18,
            border: "1px solid transparent",
            background: `linear-gradient(135deg, rgba(${cr},${cg},${cb},0.25), rgba(${cr},${cg},${cb},0.04)) border-box`,
            WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            pointerEvents: "none",
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", width: 56, height: 56, borderRadius: "50%", flexShrink: 0 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", overflow: "hidden",
              boxShadow: `
                0 0 ${logoGlow}px rgba(${cr},${cg},${cb},0.2),
                inset 0 0 0 2px rgba(${cr},${cg},${cb},0.25)
              `,
            }}>
              <Img
                src={staticFile(`${assetDir}/logos/${coin.logo}`)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            {/* Gradient ring */}
            <div style={{
              position: "absolute", inset: -1,
              borderRadius: "50%",
              background: `conic-gradient(from 0deg, rgba(${cr},${cg},${cb},0.35), rgba(${cr},${cg},${cb},0.06), rgba(${cr},${cg},${cb},0.35))`,
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #fff calc(100% - 1.5px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #fff calc(100% - 1.5px))",
              pointerEvents: "none",
            }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              color: "white", fontSize: 28, fontWeight: 800,
              fontFamily: "Inter, sans-serif", letterSpacing: 1.5,
            }}>
              {coin.ticker}
            </div>
            <div style={{
              color: "rgba(255,255,255,0.35)", fontSize: 15,
              fontFamily: "Inter, sans-serif",
            }}>
              30d · CoinGecko
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              color: "white", fontSize: 26, fontWeight: 700, fontFamily: "monospace",
              textShadow: `0 0 6px rgba(${cr},${cg},${cb},0.12)`,
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
            path={coin.pricePath}
            color={coin.color}
            progress={chartProgress}
            uniqueId={coin.ticker}
            frame={frame}
            settled={settled}
            cardIndex={index}
          />
        </div>

        {/* Flash burst */}
        {showFlash && (
          <div style={{
            position: "absolute",
            right: 60,
            bottom: 80,
            width: flashR * 2,
            height: flashR * 2,
            marginLeft: -flashR,
            marginTop: -flashR,
            borderRadius: "50%",
            border: `1.5px solid rgba(${cr},${cg},${cb},${flashOp})`,
            pointerEvents: "none",
          }} />
        )}

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            borderRadius: "0 0 18px 18px",
            background: `linear-gradient(90deg, rgba(${cr},${cg},${cb},0.5), rgba(${cr},${cg},${cb},0.1), transparent)`,
          }}
        />
      </div>
    </>
  );
};

// ─── Main component ─────────────────────────────────────────────────

interface Props {
  assetDir?: string;
}

export const StablecoinCards: React.FC<Props> = ({ assetDir = "shorts/short-03" }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {STABLECOINS.map((coin, i) => (
        <StablecoinCard key={coin.ticker} coin={coin} index={i} assetDir={assetDir} />
      ))}
    </AbsoluteFill>
  );
};
