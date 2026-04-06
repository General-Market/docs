import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { CandlestickChart } from "./CandlestickChart";
import { LineChartLive } from "./LineChartLive";
import { OrderBook } from "./OrderBook";
import { TickerTape } from "./TickerTape";
import { generateLineData, MINI_CHARTS } from "./chartData";

interface Props {
  width: number;
  height: number;
}

// Screen wrapper with bezel, glow, and power-on flicker
const Screen: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  rotateY?: number;
  rotateX?: number;
  glowColor?: string;
  powerOnDelay?: number;
  children: React.ReactNode;
}> = ({
  x,
  y,
  w,
  h,
  rotateY = 0,
  rotateX = 0,
  glowColor = "#3B82F6",
  powerOnDelay = 0,
  children,
}) => {
  const frame = useCurrentFrame();

  // Power-on flicker: 2-3 flickers then solid
  const flickerStart = 5 + powerOnDelay;
  const flickerEnd = flickerStart + 20;

  let screenOpacity: number;
  if (frame < flickerStart) {
    screenOpacity = 0;
  } else if (frame < flickerEnd) {
    const t = frame - flickerStart;
    const flickerPattern = [0, 0.6, 0, 0, 0.8, 0.3, 0, 0.9, 1, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    screenOpacity = flickerPattern[Math.min(t, flickerPattern.length - 1)];
  } else {
    screenOpacity = 1;
  }

  // Glow pulse
  const glowIntensity =
    frame > flickerEnd
      ? 0.3 + Math.sin(frame * 0.05 + powerOnDelay) * 0.1
      : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        perspective: 1200,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
          transformStyle: "preserve-3d",
          opacity: screenOpacity,
        }}
      >
        {/* Glow behind screen */}
        <div
          style={{
            position: "absolute",
            top: -8,
            left: -8,
            right: -8,
            bottom: -8,
            borderRadius: 10,
            boxShadow: `0 0 30px ${Math.round(glowIntensity * 255)}px ${glowColor}40`,
            opacity: glowIntensity,
          }}
        />

        {/* Screen bezel */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 6,
            border: "2px solid rgba(30,30,40,0.9)",
            overflow: "hidden",
            background: "#0d1117",
            boxShadow: `0 0 20px 2px ${glowColor}20, inset 0 0 1px rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.6)`,
          }}
        >
          {children}
        </div>

        {/* Monitor stand hint (bottom reflection) */}
        <div
          style={{
            position: "absolute",
            bottom: -4,
            left: "30%",
            width: "40%",
            height: 4,
            background: "rgba(40,40,50,0.4)",
            borderRadius: "0 0 4px 4px",
          }}
        />
      </div>
    </div>
  );
};

// Mini sparkline chart
const MiniSparkline: React.FC<{
  width: number;
  height: number;
  label: string;
  color: string;
  change: number;
  seed: number;
}> = ({ width, height, label, color, change, seed }) => {
  const data = React.useMemo(() => generateLineData(seed, 30), [seed]);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (width - 16) + 8;
      const y = 28 + (1 - (v - min) / range) * (height - 50);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height}>
      <rect width={width} height={height} fill="#0d1117" rx={4} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        opacity={0.8}
      />
      {/* Label */}
      <text
        x={8}
        y={16}
        fill="rgba(255,255,255,0.5)"
        fontSize={9}
        fontFamily="monospace"
      >
        {label}
      </text>
      {/* Change badge */}
      <rect
        x={width - 52}
        y={height - 22}
        width={44}
        height={16}
        rx={3}
        fill={change >= 0 ? "rgba(0,230,118,0.15)" : "rgba(255,61,0,0.15)"}
      />
      <text
        x={width - 30}
        y={height - 10}
        fill={change >= 0 ? "#00e676" : "#ff3d00"}
        fontSize={9}
        fontFamily="monospace"
        textAnchor="middle"
      >
        {change >= 0 ? "+" : ""}
        {change.toFixed(1)}%
      </text>
    </svg>
  );
};

// Code terminal panel — simulates a code/terminal window
const CodeTerminal: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const lines = [
    { text: "$ python3 run_strategy.py", color: "#00e676", delay: 0 },
    { text: "[INFO] Loading model weights...", color: "#8B5CF6", delay: 3 },
    { text: "[INFO] Fetching OHLCV data...", color: "#8B5CF6", delay: 8 },
    { text: "[OK] 2,847 candles loaded", color: "#00e676", delay: 14 },
    { text: "[SIGNAL] BUY BTC @ 97,432.50", color: "#FFD700", delay: 20 },
    { text: "[RISK] Position size: 0.45 BTC", color: "#3B82F6", delay: 25 },
    { text: "[P&L] Unrealized: +$1,247.30", color: "#00e676", delay: 32 },
    { text: "[SIGNAL] SELL ETH @ 3,288.10", color: "#ff3d00", delay: 38 },
    { text: "[OK] Order filled @ 3,287.95", color: "#00e676", delay: 43 },
    { text: "[INFO] Next scan in 14s...", color: "#8B5CF6", delay: 50 },
  ];

  return (
    <div
      style={{
        width,
        height,
        background: "#0d1117",
        borderRadius: 4,
        padding: 8,
        fontFamily: "monospace",
        fontSize: 9,
        overflow: "hidden",
      }}
    >
      {/* Terminal title bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff5f56" }} />
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ffbd2e" }} />
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#27c93f" }} />
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, marginLeft: 8 }}>
          strategy.py
        </span>
      </div>
      {lines.map((line, i) => {
        const lineOpacity = interpolate(
          frame,
          [20 + line.delay, 23 + line.delay],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        // Cursor blink on last visible line
        const isLastVisible = i === lines.length - 1 || frame < 20 + lines[i + 1]?.delay;
        const cursorVisible = isLastVisible && Math.floor(frame * 0.1) % 2 === 0;

        return (
          <div
            key={i}
            style={{
              opacity: lineOpacity,
              color: line.color,
              lineHeight: 1.6,
              whiteSpace: "nowrap",
            }}
          >
            {line.text}
            {cursorVisible && lineOpacity > 0.5 && (
              <span style={{ color: "#fff", opacity: 0.7 }}>_</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Heat map panel — simulates a correlation/sector heat map
export const TradingScreenGrid: React.FC<Props> = ({ width, height }) => {
  const frame = useCurrentFrame();

  // Ambient particles (floating dust in monitor glow)
  const particles = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 25; i++) {
      arr.push({
        x: (i * 137.5) % width,
        y: (i * 73.7) % height,
        speed: 0.15 + (i % 5) * 0.08,
        size: 1 + (i % 3),
        opacity: 0.04 + (i % 4) * 0.015,
      });
    }
    return arr;
  }, [width, height]);

  // Layout: multi-monitor desk setup (6 main screens + mini charts)
  // Arranged to look like the reference image: curved array of monitors
  const pad = 14;
  const topY = 50; // Below ticker tape

  // Row 1: 3 monitors across the top (main trading views)
  const row1Y = topY;
  const screenW1 = (width - pad * 4) / 3;
  const screenH1 = 340;

  // Row 2: 3 monitors below (secondary data)
  const row2Y = row1Y + screenH1 + pad;
  const screenW2 = (width - pad * 4) / 3;
  const screenH2 = 280;

  // Row 3: 6 mini sparklines at bottom
  const row3Y = row2Y + screenH2 + pad;
  const miniW = (width - pad * 7) / 6;
  const miniH = 90;

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width, height }}>
      {/* Ticker Tape at top */}
      <div style={{ position: "absolute", top: 0, left: 0, width }}>
        <TickerTape width={width} />
      </div>

      {/* === ROW 1: Three main monitors === */}

      {/* Left monitor — Candlestick chart (angled inward) */}
      <Screen
        x={pad}
        y={row1Y}
        w={screenW1}
        h={screenH1}
        rotateY={6}
        glowColor="#3B82F6"
        powerOnDelay={0}
      >
        <CandlestickChart width={screenW1} height={screenH1} seed={42} candleCount={45} />
      </Screen>

      {/* Center monitor — Main candlestick (straight on, slightly larger feel) */}
      <Screen
        x={pad * 2 + screenW1}
        y={row1Y}
        w={screenW1}
        h={screenH1}
        rotateY={0}
        glowColor="#8B5CF6"
        powerOnDelay={2}
      >
        <CandlestickChart width={screenW1} height={screenH1} seed={88} candleCount={50} />
      </Screen>

      {/* Right monitor — Another candlestick (angled inward) */}
      <Screen
        x={pad * 3 + screenW1 * 2}
        y={row1Y}
        w={screenW1}
        h={screenH1}
        rotateY={-6}
        glowColor="#00e676"
        powerOnDelay={4}
      >
        <CandlestickChart width={screenW1} height={screenH1} seed={156} candleCount={40} />
      </Screen>

      {/* === ROW 2: Three secondary monitors === */}

      {/* Left — Line chart */}
      <Screen
        x={pad}
        y={row2Y}
        w={screenW2}
        h={screenH2}
        rotateY={5}
        glowColor="#8B5CF6"
        powerOnDelay={6}
      >
        <LineChartLive width={screenW2} height={screenH2} seed={77} color="#8B5CF6" />
      </Screen>

      {/* Center — Order Book */}
      <Screen
        x={pad * 2 + screenW2}
        y={row2Y}
        w={screenW2}
        h={screenH2}
        rotateY={0}
        glowColor="#00e676"
        powerOnDelay={8}
      >
        <OrderBook width={screenW2} height={screenH2} levels={10} />
      </Screen>

      {/* Right — Code terminal */}
      <Screen
        x={pad * 3 + screenW2 * 2}
        y={row2Y}
        w={screenW2}
        h={screenH2}
        rotateY={-5}
        glowColor="#FFD700"
        powerOnDelay={10}
      >
        <CodeTerminal width={screenW2} height={screenH2} />
      </Screen>

      {/* === ROW 3: Mini sparkline charts === */}
      {MINI_CHARTS.map((chart, i) => (
        <Screen
          key={chart.label}
          x={pad + i * (miniW + pad)}
          y={row3Y}
          w={miniW}
          h={miniH}
          glowColor={chart.color}
          powerOnDelay={12 + i * 2}
        >
          <MiniSparkline
            width={miniW}
            height={miniH}
            label={chart.label}
            color={chart.color}
            change={chart.change}
            seed={chart.seed}
          />
        </Screen>
      ))}

      {/* Desk surface hint */}
      <div
        style={{
          position: "absolute",
          top: row3Y + miniH + 20,
          left: 0,
          width,
          height: 3,
          background:
            "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.03) 20%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.03) 80%, transparent 95%)",
        }}
      />

      {/* Coffee mug silhouettes */}
      <CoffeeMug x={60} y={row3Y + miniH + 30} />
      <CoffeeMug x={width - 110} y={row3Y + miniH + 25} />

      {/* Floating ambient particles */}
      {particles.map((p, i) => {
        const y = (p.y - frame * p.speed) % height;
        const adjustedY = y < 0 ? y + height : y;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x + Math.sin(frame * 0.02 + i) * 10,
              top: adjustedY,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: "rgba(255,255,255,1)",
              opacity: p.opacity,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </div>
  );
};

// Simple coffee mug shape
const CoffeeMug: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 40,
      height: 32,
      borderRadius: "0 0 8px 8px",
      background: "rgba(180,100,40,0.12)",
      border: "1px solid rgba(180,100,40,0.08)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    }}
  >
    {/* Handle */}
    <div
      style={{
        position: "absolute",
        right: -10,
        top: 4,
        width: 12,
        height: 18,
        borderRadius: "0 8px 8px 0",
        border: "1px solid rgba(180,100,40,0.08)",
        borderLeft: "none",
      }}
    />
    {/* Steam */}
    <div
      style={{
        position: "absolute",
        top: -8,
        left: "50%",
        transform: "translateX(-50%)",
        width: 20,
        height: 8,
        background: "radial-gradient(ellipse, rgba(255,255,255,0.03) 0%, transparent 70%)",
        filter: "blur(3px)",
      }}
    />
  </div>
);
