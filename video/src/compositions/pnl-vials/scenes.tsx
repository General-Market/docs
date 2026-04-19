import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { COLOR, END, SCENE_FRAMES, START } from "./theme";
import {
  formatUSD,
  useScene,
  useFrameShake,
  BalanceHUD,
} from "./shared";

// -----------------------------------------------------------------------------
// Utilities shared by scenes
// -----------------------------------------------------------------------------

const Stage: React.FC<{
  bg?: string;
  children: React.ReactNode;
}> = ({ bg = COLOR.bg, children }) => (
  <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
    {children}
  </AbsoluteFill>
);

const Center: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}
  >
    {children}
  </div>
);

// -----------------------------------------------------------------------------
// 01 — Screen: terminal-style P&L counter with streaming fee lines
// -----------------------------------------------------------------------------
export const S01Screen: React.FC = () => {
  const { sceneFrame, balance, hit } = useScene();
  const lossRed = interpolate(balance, [START, END], [0, 1]);
  const tint = `rgba(224, 50, 42, ${0.04 + lossRed * 0.18})`;
  return (
    <Stage>
      <AbsoluteFill style={{ background: tint }} />
      <Center>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              color: COLOR.dim,
              fontFamily: "ui-monospace, monospace",
              fontSize: 36,
              letterSpacing: "0.3em",
              marginBottom: 40,
            }}
          >
            NET P&amp;L
          </div>
          <BalanceHUD balance={balance} hit={hit} color={COLOR.loss} />
          <div
            style={{
              marginTop: 48,
              fontFamily: "ui-monospace, monospace",
              fontSize: 28,
              color: COLOR.dim,
              height: 40,
            }}
          >
            {hit && sceneFrame > 10 ? "— fee applied —" : " "}
          </div>
        </div>
      </Center>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 02 — Candle: SVG candle burning down, wax pooling
// -----------------------------------------------------------------------------
export const S02Candle: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const height = interpolate(t, [0, 1], [780, 80]);
  const puddle = interpolate(t, [0, 1], [0, 260]);
  const flicker = 1 + Math.sin(sceneFrame * 0.9) * 0.08;
  return (
    <Stage bg="#120b06">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="flame" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#fff8c8" />
            <stop offset="40%" stopColor="#ffb24a" />
            <stop offset="100%" stopColor="#ff4e10" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="wax" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f3e0a8" />
            <stop offset="100%" stopColor="#c28a2a" />
          </linearGradient>
        </defs>
        {/* puddle */}
        <ellipse
          cx={540}
          cy={1500}
          rx={120 + puddle}
          ry={24 + puddle * 0.12}
          fill="#8a5a10"
          opacity={0.85}
        />
        {/* body */}
        <rect
          x={470}
          y={1500 - height}
          width={140}
          height={height}
          fill="url(#wax)"
          rx={12}
        />
        {/* wick */}
        <rect
          x={536}
          y={1500 - height - 40}
          width={8}
          height={40}
          fill="#222"
        />
        {/* flame */}
        <ellipse
          cx={540}
          cy={1500 - height - 90}
          rx={48 * flicker}
          ry={90 * flicker}
          fill="url(#flame)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 0,
          right: 0,
          textAlign: "center",
          color: COLOR.ember,
          fontFamily: "ui-monospace, monospace",
          fontSize: 82,
          letterSpacing: "-0.02em",
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 03 — Hourglass: coins falling through neck
// -----------------------------------------------------------------------------
export const S03Hourglass: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const topFill = 1 - t;
  return (
    <Stage bg="#0b0d12">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="hgframe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5b3a18" />
            <stop offset="1" stopColor="#3a2510" />
          </linearGradient>
        </defs>
        <path
          d="M 320 500 L 760 500 L 560 960 L 760 1420 L 320 1420 L 520 960 Z"
          fill="none"
          stroke="url(#hgframe)"
          strokeWidth={14}
        />
        {/* top chamber coins */}
        <path
          d={`M 340 ${520 + (1 - topFill) * 380} L 740 ${520 + (1 - topFill) * 380} L 560 940 L 520 940 Z`}
          fill={COLOR.gold}
          opacity={0.9}
        />
        {/* falling grain */}
        {Array.from({ length: 18 }).map((_, i) => {
          const phase = (sceneFrame * 1.2 + i * 12) % 60;
          const y = 960 + phase * 8;
          if (y > 1420) return null;
          return (
            <circle
              key={i}
              cx={540 + Math.sin(i) * 6}
              cy={y}
              r={4}
              fill={COLOR.gold}
            />
          );
        })}
        {/* bottom pile */}
        <path
          d={`M 540 ${1420 - t * 380} L 760 1420 L 320 1420 Z`}
          fill={COLOR.gold}
          opacity={0.9}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 240,
          left: 0,
          right: 0,
          textAlign: "center",
          color: COLOR.gold,
          fontFamily: "ui-monospace, monospace",
          fontSize: 64,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 04 — Cash stack: bills flying away on each fee
// -----------------------------------------------------------------------------
export const S04CashStack: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const billsLeft = Math.max(1, Math.round(84 * (1 - t)));
  const shake = useFrameShake(3);
  return (
    <Stage bg="#080808">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {/* stack */}
        <g transform={`translate(${shake.x},${shake.y})`}>
          {Array.from({ length: billsLeft }).map((_, i) => (
            <rect
              key={i}
              x={240 - i * 0.3}
              y={1100 - i * 4}
              width={600}
              height={240}
              rx={10}
              fill={i % 2 === 0 ? "#2b4f33" : "#294a2f"}
              stroke="#6c8f70"
              strokeWidth={1.5}
            />
          ))}
          <circle cx={540} cy={1220} r={64} fill="#1a3a22" stroke="#9bc29c" strokeWidth={3} />
          <text
            x={540}
            y={1240}
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontSize={52}
            fill="#dfe7d6"
          >
            $
          </text>
        </g>
        {/* flying bills (fee events as vanished bills) */}
        {Array.from({ length: 6 }).map((_, i) => {
          const offset = (sceneFrame + i * 20) % 60;
          const op = 1 - offset / 60;
          return (
            <rect
              key={i}
              x={540 + Math.sin(i) * 200 + offset * 12}
              y={1100 - offset * 18}
              width={140}
              height={56}
              rx={4}
              fill="#2b4f33"
              opacity={op * 0.6}
              transform={`rotate(${offset * 3} ${540 + Math.sin(i) * 200} ${1100})`}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          color: COLOR.ink,
          fontFamily: "ui-monospace, monospace",
          fontSize: 72,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 05 — Ice cube: melting on a hot surface
// -----------------------------------------------------------------------------
export const S05Ice: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const size = interpolate(t, [0, 1], [420, 40]);
  const puddle = interpolate(t, [0, 1], [0, 360]);
  return (
    <Stage bg="#1a0a0a">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="pan" cx="50%" cy="50%" r="60%">
            <stop offset="0" stopColor="#ff5020" />
            <stop offset="1" stopColor="#2a0808" />
          </radialGradient>
        </defs>
        <ellipse cx={540} cy={1300} rx={440} ry={80} fill="url(#pan)" />
        {/* meltwater */}
        <ellipse
          cx={540}
          cy={1260}
          rx={size * 0.6 + puddle}
          ry={size * 0.16 + puddle * 0.2}
          fill="#74c6ff"
          opacity={0.3}
        />
        {/* cube */}
        <rect
          x={540 - size / 2}
          y={1260 - size}
          width={size}
          height={size}
          rx={size * 0.08}
          fill="rgba(210,240,255,0.85)"
          stroke="#b3e0ff"
          strokeWidth={3}
        />
        {/* balance etched in cube */}
        <text
          x={540}
          y={1260 - size / 2 + size * 0.06}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={size * 0.18}
          fill="#1a4060"
          opacity={0.85}
        >
          {formatUSD(balance)}
        </text>
      </svg>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 06 — Receipt: thermal printer unspooling
// -----------------------------------------------------------------------------
export const S06Receipt: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const linesVisible = Math.min(24, Math.floor(sceneFrame / 5));
  const feeLines = [
    "NETWORK FEE       -4.12",
    "SLIPPAGE          -18.40",
    "GAS               -2.08",
    "ROUTING           -6.80",
    "MEV PROTECTION    -3.14",
    "BRIDGE            -11.22",
    "TAKER             -22.88",
    "SPREAD            -46.10",
    "WITHDRAWAL        -9.66",
    "CONVERSION        -12.03",
    "PRIORITY GAS      -5.70",
    "LP FEE            -38.40",
    "SLIPPAGE          -29.11",
    "SPREAD            -52.77",
    "TAKER             -31.08",
    "ROUTING           -14.50",
    "BRIDGE            -27.33",
    "MEV PROTECTION    -8.80",
    "NETWORK FEE       -6.12",
    "CONVERSION        -19.10",
    "SLIPPAGE          -40.22",
    "TAKER             -55.31",
    "SPREAD            -62.04",
    "LP FEE            -48.88",
  ];
  return (
    <Stage bg="#111">
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 120,
          width: 800,
          minHeight: 1680,
          background: COLOR.paper,
          boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
          padding: 64,
          fontFamily: "ui-monospace, monospace",
          color: "#1a1a14",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 24 }}>
          TRADE RECEIPT
        </div>
        <div style={{ fontSize: 22, color: "#555" }}>
          OPENING BALANCE ......... {formatUSD(START)}
        </div>
        <div style={{ height: 2, background: "#1a1a14", margin: "20px 0" }} />
        {feeLines.slice(0, linesVisible).map((line, i) => (
          <div
            key={i}
            style={{
              fontSize: 26,
              fontFamily: "ui-monospace, monospace",
              padding: "4px 0",
            }}
          >
            {line}
          </div>
        ))}
        <div style={{ height: 2, background: "#1a1a14", margin: "20px 0" }} />
        <div style={{ fontSize: 42, fontWeight: 700 }}>
          REMAINING ........... {formatUSD(balance)}
        </div>
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 07 — Piggy bank: cracks spider, coins leak
// -----------------------------------------------------------------------------
export const S07Piggy: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const crack = Math.min(1, t * 1.4);
  return (
    <Stage bg="#120814">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="piggybody" cx="40%" cy="40%" r="70%">
            <stop offset="0" stopColor="#ffc0cb" />
            <stop offset="1" stopColor="#c07886" />
          </radialGradient>
        </defs>
        {/* body */}
        <ellipse cx={540} cy={900} rx={320} ry={260} fill="url(#piggybody)" />
        <ellipse cx={790} cy={810} rx={50} ry={40} fill="#e8a0ae" />
        <circle cx={790} cy={810} r={10} fill="#301018" />
        <circle cx={800} cy={810} r={10} fill="#301018" />
        {/* legs */}
        <rect x={400} y={1140} width={60} height={80} fill="#a86878" rx={10} />
        <rect x={620} y={1140} width={60} height={80} fill="#a86878" rx={10} />
        {/* slot */}
        <rect x={490} y={680} width={100} height={14} rx={7} fill="#6a2a34" />
        {/* cracks */}
        <g stroke="#2a0a14" strokeWidth={4} fill="none" opacity={crack}>
          <path d="M 380 900 L 470 920 L 440 990 L 520 1000" />
          <path d="M 620 870 L 690 900 L 660 970" />
          <path d="M 540 1060 L 570 1120 L 520 1160" />
        </g>
        {/* leaking coins */}
        {Array.from({ length: 10 }).map((_, i) => {
          const ph = (sceneFrame * 0.8 + i * 8) % 80;
          return (
            <circle
              key={i}
              cx={540 + (i - 5) * 30}
              cy={1160 + ph * 6}
              r={14}
              fill={COLOR.gold}
              opacity={crack * (1 - ph / 80)}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#ffc8d0",
          fontFamily: "ui-monospace, monospace",
          fontSize: 68,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 08 — Balloon: dollar-printed balloon deflating
// -----------------------------------------------------------------------------
export const S08Balloon: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const rx = interpolate(t, [0, 1], [300, 80]);
  const ry = interpolate(t, [0, 1], [360, 60]);
  const y = interpolate(t, [0, 1], [700, 1400]);
  return (
    <Stage bg="#0b0f18">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="balloongrad" cx="40%" cy="35%" r="60%">
            <stop offset="0" stopColor="#6be07b" />
            <stop offset="1" stopColor="#1a4a24" />
          </radialGradient>
        </defs>
        <ellipse cx={540} cy={y} rx={rx} ry={ry} fill="url(#balloongrad)" />
        {/* knot */}
        <polygon
          points={`${540 - 20},${y + ry} ${540 + 20},${y + ry} ${540},${y + ry + 24}`}
          fill="#1a4a24"
        />
        {/* string */}
        <path
          d={`M ${540} ${y + ry + 24} Q ${540 + Math.sin(sceneFrame * 0.1) * 40} ${y + ry + 200} ${540} ${y + ry + 400}`}
          stroke="#666"
          strokeWidth={2}
          fill="none"
        />
        {/* $ sign */}
        <text
          x={540}
          y={y + 24}
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontSize={rx * 0.8}
          fill="#f4fff0"
          fontWeight="bold"
        >
          $
        </text>
      </svg>
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#6be07b",
          fontFamily: "ui-monospace, monospace",
          fontSize: 56,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 09 — Apple: invisible bites removing chunks
// -----------------------------------------------------------------------------
export const S09Apple: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const bites = Math.min(12, Math.floor(sceneFrame / 9));
  return (
    <Stage bg="#0a0a12">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="apple" cx="40%" cy="35%" r="60%">
            <stop offset="0" stopColor="#ff6a4a" />
            <stop offset="1" stopColor="#8a1414" />
          </radialGradient>
          <mask id="bites">
            <rect width={1080} height={1920} fill="white" />
            {Array.from({ length: bites }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              return (
                <circle
                  key={i}
                  cx={540 + Math.cos(angle) * 240}
                  cy={1000 + Math.sin(angle) * 240}
                  r={90}
                  fill="black"
                />
              );
            })}
          </mask>
        </defs>
        <g mask="url(#bites)">
          <ellipse cx={540} cy={1000} rx={320} ry={320} fill="url(#apple)" />
        </g>
        {/* stem */}
        <rect x={530} y={670} width={20} height={40} fill="#3a2a12" />
        {/* leaf */}
        <ellipse cx={570} cy={680} rx={30} ry={14} fill="#3a7a2a" />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#ff8a6a",
          fontFamily: "ui-monospace, monospace",
          fontSize: 64,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 10 — Shredder: dollar bill being shredded
// -----------------------------------------------------------------------------
export const S10Shredder: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const fed = interpolate(t, [0, 1], [0, 380]);
  const strips = 14;
  return (
    <Stage bg="#080808">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {/* shredder body */}
        <rect x={260} y={900} width={560} height={140} rx={20} fill="#2a2a2a" />
        <rect x={340} y={940} width={400} height={14} rx={7} fill="#080808" />
        {/* bill being fed */}
        <g transform={`translate(340, ${540 + fed})`}>
          <rect width={400} height={160} rx={8} fill="#2b4f33" opacity={t < 0.9 ? 1 : 0} />
          <circle cx={200} cy={80} r={40} fill="none" stroke="#9bc29c" strokeWidth={3} />
          <text
            x={200}
            y={98}
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontSize={36}
            fill="#dfe7d6"
          >
            100
          </text>
        </g>
        {/* strips */}
        {Array.from({ length: strips }).map((_, i) => {
          const x = 340 + (i * 400) / strips;
          const stripH = Math.max(0, fed - 40 + Math.sin(i) * 20);
          return (
            <rect
              key={i}
              x={x}
              y={1040}
              width={400 / strips - 2}
              height={stripH}
              fill="#2b4f33"
              opacity={0.9}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          right: 0,
          textAlign: "center",
          color: COLOR.ink,
          fontFamily: "ui-monospace, monospace",
          fontSize: 68,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 11 — Sandcastle: tide erodes it
// -----------------------------------------------------------------------------
export const S11Sandcastle: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const erosion = t;
  const waveOffset = Math.sin(sceneFrame * 0.12) * 20;
  return (
    <Stage bg="#2a3848">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#182230" />
            <stop offset="1" stopColor="#3a4858" />
          </linearGradient>
          <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d4b484" />
            <stop offset="1" stopColor="#8a6a44" />
          </linearGradient>
        </defs>
        <rect width={1080} height={1200} fill="url(#sky)" />
        <rect y={1200} width={1080} height={720} fill="url(#sand)" />
        {/* castle base — decays from left-right */}
        <g opacity={1 - erosion * 0.9}>
          {/* left tower */}
          <rect
            x={340}
            y={1100 + erosion * 180}
            width={80 - erosion * 40}
            height={200 - erosion * 200}
            fill="url(#sand)"
            stroke="#5a4428"
            strokeWidth={2}
          />
          {/* center wall */}
          <rect
            x={440}
            y={1160 + erosion * 80}
            width={200 - erosion * 60}
            height={140 - erosion * 140}
            fill="url(#sand)"
            stroke="#5a4428"
            strokeWidth={2}
          />
          {/* right tower */}
          <rect
            x={660}
            y={1080 + erosion * 200}
            width={80 - erosion * 40}
            height={220 - erosion * 220}
            fill="url(#sand)"
            stroke="#5a4428"
            strokeWidth={2}
          />
          {/* flag */}
          <rect x={696} y={1040 + erosion * 240} width={3} height={60} fill="#888" opacity={1 - erosion * 2} />
          <polygon
            points={`699,${1040 + erosion * 240} 740,${1050 + erosion * 240} 699,${1060 + erosion * 240}`}
            fill={COLOR.loss}
            opacity={1 - erosion * 2}
          />
        </g>
        {/* waves */}
        <path
          d={`M 0 ${1240 + waveOffset} Q 270 ${1220 + waveOffset} 540 ${1240 + waveOffset} T 1080 ${1240 + waveOffset} L 1080 1920 L 0 1920 Z`}
          fill="#3a5878"
          opacity={0.8 + erosion * 0.2}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#e8d8b8",
          fontFamily: "ui-monospace, monospace",
          fontSize: 68,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 12 — Gold bar corroding in acid
// -----------------------------------------------------------------------------
export const S12Acid: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const bubbles = Array.from({ length: 30 }, (_, i) => i);
  return (
    <Stage bg="#0a1208">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="acid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a6a1a" />
            <stop offset="1" stopColor="#1a3a0a" />
          </linearGradient>
          <linearGradient id="goldbar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe070" />
            <stop offset="1" stopColor="#aa7820" />
          </linearGradient>
        </defs>
        {/* beaker */}
        <path
          d="M 280 700 L 280 1400 Q 280 1480 360 1480 L 720 1480 Q 800 1480 800 1400 L 800 700 Z"
          fill="url(#acid)"
          stroke="#6a7a50"
          strokeWidth={4}
        />
        {/* gold bar — shrinking */}
        <g opacity={1 - t * 0.4}>
          <rect
            x={420 + t * 60}
            y={900 + t * 200}
            width={240 - t * 120}
            height={160 - t * 80}
            rx={8}
            fill="url(#goldbar)"
            stroke="#aa7820"
            strokeWidth={3}
          />
        </g>
        {/* bubbles */}
        {bubbles.map((i) => {
          const ph = (sceneFrame * 1.4 + i * 11) % 60;
          const x = 340 + (i * 380) / 30 + Math.sin(i) * 20;
          const y = 1460 - ph * 12;
          if (y < 800) return null;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={4 + (i % 3)}
              fill="#a0d850"
              opacity={0.7}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#c8e88a",
          fontFamily: "ui-monospace, monospace",
          fontSize: 68,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 13 — Hot air balloon: basket descending as sandbags drop
// -----------------------------------------------------------------------------
export const S13HotAir: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const y = interpolate(t, [0, 1], [400, 1500]);
  const bags = 6 - Math.floor(t * 6);
  return (
    <Stage bg="#1c2638">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="ab" cx="40%" cy="40%" r="60%">
            <stop offset="0" stopColor="#ff8a60" />
            <stop offset="0.6" stopColor="#a84028" />
            <stop offset="1" stopColor="#4a1010" />
          </radialGradient>
        </defs>
        {/* envelope */}
        <ellipse cx={540} cy={y} rx={220} ry={260} fill="url(#ab)" />
        {/* seams */}
        {[-120, -60, 0, 60, 120].map((dx) => (
          <path
            key={dx}
            d={`M ${540 + dx} ${y - 260} Q ${540 + dx * 1.4} ${y} ${540 + dx} ${y + 260}`}
            stroke="#2a0808"
            strokeWidth={2}
            fill="none"
          />
        ))}
        {/* ropes */}
        {[-80, -30, 30, 80].map((dx) => (
          <line
            key={dx}
            x1={540 + dx * 1.2}
            y1={y + 240}
            x2={540 + dx}
            y2={y + 380}
            stroke="#3a2a10"
            strokeWidth={2}
          />
        ))}
        {/* basket */}
        <rect
          x={460}
          y={y + 380}
          width={160}
          height={80}
          fill="#5a3818"
          stroke="#3a2410"
          strokeWidth={2}
        />
        {/* sandbags */}
        {Array.from({ length: bags }).map((_, i) => (
          <ellipse
            key={i}
            cx={440 + i * 40}
            cy={y + 480}
            rx={16}
            ry={24}
            fill="#8a6838"
            stroke="#5a4020"
            strokeWidth={2}
          />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#ffbc90",
          fontFamily: "ui-monospace, monospace",
          fontSize: 60,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 14 — Chess king: tips over slowly
// -----------------------------------------------------------------------------
export const S14Chess: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const tilt = interpolate(t, [0, 0.85, 1], [0, 80, 92]);
  return (
    <Stage bg="#141414">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {/* board squares */}
        {Array.from({ length: 8 }).map((_, r) =>
          Array.from({ length: 8 }).map((_, c) => (
            <rect
              key={`${r}-${c}`}
              x={100 + c * 110}
              y={1200 + r * 30}
              width={110}
              height={30}
              fill={(r + c) % 2 === 0 ? "#2a2a2a" : "#4a3a28"}
              opacity={0.4}
            />
          )),
        )}
        {/* king */}
        <g
          transform={`rotate(${tilt} 540 1220) translate(0, ${Math.min(120, tilt * 1.3)})`}
        >
          {/* cross */}
          <rect x={530} y={520} width={20} height={80} fill="#efe9de" />
          <rect x={500} y={545} width={80} height={20} fill="#efe9de" />
          {/* crown */}
          <path
            d="M 480 620 L 600 620 L 580 680 L 500 680 Z"
            fill="#efe9de"
            stroke="#8a8a80"
            strokeWidth={3}
          />
          {/* body */}
          <rect x={500} y={680} width={80} height={360} fill="#efe9de" stroke="#8a8a80" strokeWidth={3} />
          {/* base */}
          <ellipse cx={540} cy={1060} rx={100} ry={30} fill="#efe9de" stroke="#8a8a80" strokeWidth={3} />
          {/* collar */}
          <rect x={490} y={820} width={100} height={28} fill="#d8d2c4" />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 0,
          right: 0,
          textAlign: "center",
          color: COLOR.ink,
          fontFamily: "ui-monospace, monospace",
          fontSize: 68,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 15 — Faucet: green "money water" draining into a grate
// -----------------------------------------------------------------------------
export const S15Faucet: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const streamW = interpolate(t, [0, 1], [40, 4]);
  return (
    <Stage bg="#0a0a0e">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {/* faucet */}
        <rect x={340} y={460} width={40} height={200} fill="#8a8a8a" />
        <rect x={340} y={640} width={240} height={40} fill="#8a8a8a" rx={6} />
        <rect x={560} y={660} width={40} height={80} fill="#8a8a8a" />
        {/* stream */}
        <rect
          x={580 - streamW / 2}
          y={740}
          width={streamW}
          height={700}
          fill="#2ad18e"
          opacity={0.9}
        />
        {/* $ signs falling inside stream */}
        {Array.from({ length: 10 }).map((_, i) => {
          const ph = (sceneFrame * 2 + i * 8) % 60;
          return (
            <text
              key={i}
              x={580}
              y={740 + ph * 12}
              textAnchor="middle"
              fontFamily="Georgia, serif"
              fontSize={28}
              fill="#0a3a22"
              opacity={0.9}
            >
              $
            </text>
          );
        })}
        {/* grate */}
        <rect x={440} y={1440} width={280} height={40} fill="#1a1a1a" />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect
            key={i}
            x={450 + i * 32}
            y={1450}
            width={20}
            height={20}
            fill="#080808"
          />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#6be0a8",
          fontFamily: "ui-monospace, monospace",
          fontSize: 68,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 16 — Flower: petals with dollar amounts wilting
// -----------------------------------------------------------------------------
export const S16Flower: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const petals = 8;
  const t = sceneFrame / SCENE_FRAMES;
  const petalsLeft = Math.max(1, Math.ceil(petals * (1 - t)));
  return (
    <Stage bg="#0a0612">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {/* stem */}
        <rect x={536} y={1000} width={8} height={800} fill="#2a5a20" />
        {/* leaf */}
        <ellipse cx={580} cy={1300} rx={80} ry={30} fill="#3a7a28" />
        {/* center */}
        <circle cx={540} cy={1000} r={80} fill="#e8a028" stroke="#a86a10" strokeWidth={3} />
        {/* petals */}
        {Array.from({ length: petals }).map((_, i) => {
          const angle = (i / petals) * Math.PI * 2;
          const present = i < petalsLeft;
          const dropT = Math.max(0, t - i / petals);
          return (
            <g
              key={i}
              transform={`translate(${540 + Math.cos(angle) * (present ? 140 : 140 + dropT * 600)} ${1000 + Math.sin(angle) * (present ? 140 : 140 + dropT * 800)}) rotate(${(angle * 180) / Math.PI + (present ? 0 : dropT * 180)})`}
            >
              <ellipse
                cx={0}
                cy={0}
                rx={80}
                ry={46}
                fill="#e84878"
                opacity={present ? 1 : Math.max(0, 1 - dropT * 2)}
              />
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#ffb8c8",
          fontFamily: "ui-monospace, monospace",
          fontSize: 64,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 17 — Snow globe: money-snow settling
// -----------------------------------------------------------------------------
export const S17SnowGlobe: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const pile = interpolate(t, [0, 1], [20, 180]);
  return (
    <Stage bg="#0a0b14">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="globeglass" cx="40%" cy="30%" r="70%">
            <stop offset="0" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.02)" />
          </radialGradient>
        </defs>
        {/* base */}
        <rect x={380} y={1320} width={320} height={120} fill="#3a2a18" rx={20} />
        <rect x={360} y={1420} width={360} height={20} fill="#2a1a08" rx={4} />
        {/* globe */}
        <circle cx={540} cy={1080} r={340} fill="url(#globeglass)" stroke="#8a8a8a" strokeWidth={3} />
        <circle cx={540} cy={1080} r={340} fill="#0a1022" opacity={0.6} />
        {/* snow pile at bottom */}
        <path
          d={`M ${540 - 280} ${1380} Q 540 ${1380 - pile} ${540 + 280} ${1380} L ${540 + 280} 1420 L ${540 - 280} 1420 Z`}
          fill="#2a9a6a"
          opacity={0.9}
        />
        {/* falling flakes */}
        {Array.from({ length: 40 }).map((_, i) => {
          const ph = (sceneFrame * (0.6 + (i % 5) * 0.2) + i * 7) % 60;
          const y = 800 + ph * 10;
          const x = 300 + ((i * 127) % 480);
          return (
            <text
              key={i}
              x={x}
              y={y}
              fontFamily="Georgia, serif"
              fontSize={20 + (i % 3) * 6}
              fill="#6be0a8"
              opacity={0.7}
            >
              $
            </text>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#a0e8c0",
          fontFamily: "ui-monospace, monospace",
          fontSize: 68,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 18 — Lottery ticket: scratch-off revealing $12
// -----------------------------------------------------------------------------
export const S18Lottery: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const scratched = interpolate(t, [0, 1], [0, 1]);
  const cells = 6;
  return (
    <Stage bg="#0e0806">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="ticket" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4e8b0" />
            <stop offset="1" stopColor="#c8a838" />
          </linearGradient>
        </defs>
        <rect x={140} y={500} width={800} height={900} rx={12} fill="url(#ticket)" />
        <text
          x={540}
          y={600}
          textAnchor="middle"
          fontFamily="Impact, sans-serif"
          fontSize={64}
          fill="#6a2a10"
        >
          INSTANT WIN
        </text>
        {/* cells */}
        {Array.from({ length: cells }).map((_, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const cx = 240 + col * 240;
          const cy = 780 + row * 220;
          const revealProgress = Math.max(0, scratched * cells - i);
          const revealed = Math.min(1, revealProgress);
          const value = i === cells - 1 ? "$12" : "—";
          return (
            <g key={i}>
              <rect
                x={cx - 80}
                y={cy - 60}
                width={160}
                height={120}
                fill="#6a5a28"
              />
              <rect
                x={cx - 80 + revealed * 160}
                y={cy - 60}
                width={160 - revealed * 160}
                height={120}
                fill="#a8a090"
              />
              <text
                x={cx}
                y={cy + 20}
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
                fontSize={48}
                fill="#3a1a10"
                opacity={revealed}
              >
                {value}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 1460,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#ffd060",
          fontFamily: "ui-monospace, monospace",
          fontSize: 64,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 19 — Wedding ring sinking into dark water
// -----------------------------------------------------------------------------
export const S19Ring: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const t = sceneFrame / SCENE_FRAMES;
  const y = interpolate(t, [0, 1], [700, 1600]);
  const rippleR = ((sceneFrame * 8) % 400) + 80;
  return (
    <Stage bg="#050812">
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="water" cx="50%" cy="50%" r="70%">
            <stop offset="0" stopColor="#0a1a38" />
            <stop offset="1" stopColor="#020418" />
          </radialGradient>
        </defs>
        <rect y={800} width={1080} height={1120} fill="url(#water)" />
        {/* ripples */}
        {[0, 1, 2].map((i) => (
          <ellipse
            key={i}
            cx={540}
            cy={820}
            rx={rippleR - i * 120}
            ry={(rippleR - i * 120) * 0.25}
            fill="none"
            stroke="#4a7ac0"
            strokeWidth={2}
            opacity={Math.max(0, 0.8 - (rippleR - i * 120) / 600)}
          />
        ))}
        {/* ring */}
        <g transform={`translate(540 ${y})`} opacity={Math.max(0.15, 1 - t)}>
          <circle cx={0} cy={0} r={100} fill="none" stroke="#ffd070" strokeWidth={18} />
          <circle cx={0} cy={-100} r={16} fill="#b8f0ff" />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#c0d8ff",
          fontFamily: "ui-monospace, monospace",
          fontSize: 64,
        }}
      >
        {formatUSD(balance)}
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// 20 — Countdown: casino-style split-flap counter collapsing
// -----------------------------------------------------------------------------
export const S20Countdown: React.FC = () => {
  const { sceneFrame, balance } = useScene();
  const digits = formatUSD(balance).replace("$", "").split("");
  return (
    <Stage bg="#080604">
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            color: "#d4a437",
            fontFamily: "ui-monospace, monospace",
            fontSize: 180,
            fontWeight: 700,
            textShadow: "0 0 20px rgba(212,164,55,0.5)",
          }}
        >
          $
        </div>
        {digits.map((d, i) => (
          <div
            key={i}
            style={{
              background: "#1a0f06",
              border: "2px solid #3a2810",
              color: "#ff9440",
              fontFamily: "ui-monospace, monospace",
              fontSize: 180,
              fontWeight: 700,
              padding: "10px 18px",
              minWidth: d === "," || d === "." ? 40 : 120,
              textAlign: "center",
              borderRadius: 8,
              boxShadow: "inset 0 -20px 40px rgba(0,0,0,0.5)",
              transform: `translateY(${Math.sin(sceneFrame * 0.3 + i) * 2}px)`,
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 400,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#6a4a28",
          fontFamily: "ui-monospace, monospace",
          fontSize: 36,
          letterSpacing: "0.4em",
        }}
      >
        REMAINING EQUITY
      </div>
    </Stage>
  );
};

// -----------------------------------------------------------------------------
// Manifest
// -----------------------------------------------------------------------------
export type SceneDef = {
  id: string;
  title: string;
  component: React.FC;
};

export const SCENES: SceneDef[] = [
  { id: "screen", title: "P&L Screen", component: S01Screen },
  { id: "candle", title: "Burning Candle", component: S02Candle },
  { id: "hourglass", title: "Hourglass of Coins", component: S03Hourglass },
  { id: "cashstack", title: "Cash Stack", component: S04CashStack },
  { id: "ice", title: "Ice on a Hot Pan", component: S05Ice },
  { id: "receipt", title: "Trade Receipt", component: S06Receipt },
  { id: "piggy", title: "Cracked Piggy Bank", component: S07Piggy },
  { id: "balloon", title: "Deflating Balloon", component: S08Balloon },
  { id: "apple", title: "Invisible Bites", component: S09Apple },
  { id: "shredder", title: "Paper Shredder", component: S10Shredder },
  { id: "sandcastle", title: "Sandcastle at High Tide", component: S11Sandcastle },
  { id: "acid", title: "Gold in Acid", component: S12Acid },
  { id: "hotair", title: "Hot-Air Descent", component: S13HotAir },
  { id: "chess", title: "Falling King", component: S14Chess },
  { id: "faucet", title: "Open Faucet", component: S15Faucet },
  { id: "flower", title: "Wilting Petals", component: S16Flower },
  { id: "snowglobe", title: "Money Snowglobe", component: S17SnowGlobe },
  { id: "lottery", title: "Scratch-Off", component: S18Lottery },
  { id: "ring", title: "Ring Sinking", component: S19Ring },
  { id: "countdown", title: "Split-Flap Counter", component: S20Countdown },
];

