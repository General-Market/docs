import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { BigStat } from "./components/BigStat";
import { WordReveal } from "./components/WordReveal";
import { PersonGrid } from "./components/PersonGrid";
import { Leaderboard } from "./components/Leaderboard";

/* ───── inline sub-components ───── */

const FONT = "'IBM Plex Mono', 'Courier New', monospace";
const TEAL = "#3ECDA0";
const RED = "#c41e50";

const Wireframe: React.FC<{ startFrame?: number }> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;
  const op = interpolate(elapsed, [0, 15], [0, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const r1 = elapsed * 0.4;
  const r2 = elapsed * -0.25;
  const r3 = elapsed * 0.6;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: op,
      }}
    >
      <svg width={600} height={600} viewBox="-300 -300 600 600">
        <g transform={`rotate(${r1})`}>
          <polygon
            points="0,-200 173,100 -173,100"
            fill="none"
            stroke={TEAL}
            strokeWidth={1.5}
          />
        </g>
        <g transform={`rotate(${r2})`}>
          <polygon
            points="0,-150 130,75 -130,75"
            fill="none"
            stroke={TEAL}
            strokeWidth={1}
            opacity={0.6}
          />
        </g>
        <g transform={`rotate(${r3})`}>
          <polygon
            points="0,-100 87,50 -87,50"
            fill="none"
            stroke={TEAL}
            strokeWidth={0.8}
            opacity={0.35}
          />
        </g>
      </svg>
    </div>
  );
};

const CodeBlock: React.FC<{ startFrame?: number }> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;
  const lines = [
    "import virtuals as vt",
    "",
    "class TradingAgent(vt.Agent):",
    "    def __init__(self):",
    '        self.model = vt.load("gpt-quant-v3")',
    "        self.risk = 0.02",
    "        self.portfolio = {}",
    "",
    "    def on_tick(self, market):",
    "        signals = self.model.predict(market)",
    "        if signals.confidence > 0.85:",
    "            size = self.kelly(signals)",
    "            self.execute(signals.direction, size)",
    "",
    "    def kelly(self, signals):",
    "        edge = signals.expected - 1.0",
    "        return (edge / signals.variance) * self.risk",
    "",
    "agent = TradingAgent()",
    "vt.compete(agent, arena='weekly-100k')",
  ];

  const visibleLines = Math.min(
    lines.length,
    Math.floor(interpolate(elapsed, [0, 60], [0, lines.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }))
  );

  const op = interpolate(elapsed, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: 740,
        backgroundColor: "#0d0d0d",
        borderRadius: 12,
        padding: "28px 32px",
        border: "1px solid rgba(62,205,160,0.2)",
        opacity: op,
      }}
    >
      {lines.slice(0, visibleLines).map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: FONT,
            fontSize: 16,
            lineHeight: 1.7,
            color: line.includes("class") || line.includes("def")
              ? TEAL
              : line.includes("#") || line.includes("import")
                ? "#7ec8a0"
                : line.includes("'") || line.includes('"')
                  ? "#f0c040"
                  : "#c8c8c8",
            whiteSpace: "pre",
          }}
        >
          {line || "\u00A0"}
        </div>
      ))}
    </div>
  );
};

const OrderBook: React.FC<{ startFrame?: number }> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;
  const op = interpolate(elapsed, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bids = [
    [1.0423, 12400],
    [1.0421, 8900],
    [1.042, 15600],
    [1.0418, 6700],
    [1.0416, 22100],
    [1.0414, 9300],
  ];
  const asks = [
    [1.0425, 11200],
    [1.0427, 7800],
    [1.0429, 18400],
    [1.0431, 5500],
    [1.0433, 14900],
    [1.0435, 8100],
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        gap: 40,
        opacity: op,
      }}
    >
      <div>
        <div style={{ fontFamily: FONT, fontSize: 13, color: "#666", marginBottom: 8, textAlign: "center" }}>
          BIDS
        </div>
        {bids.map(([price, size], i) => {
          const rowOp = interpolate(elapsed - i * 3, [0, 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT,
                fontSize: 15,
                color: TEAL,
                display: "flex",
                gap: 24,
                opacity: rowOp,
                marginBottom: 4,
              }}
            >
              <span>{(price as number).toFixed(4)}</span>
              <span style={{ color: "#5a5a5a" }}>{(size as number).toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      <div>
        <div style={{ fontFamily: FONT, fontSize: 13, color: "#666", marginBottom: 8, textAlign: "center" }}>
          ASKS
        </div>
        {asks.map(([price, size], i) => {
          const rowOp = interpolate(elapsed - i * 3, [0, 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT,
                fontSize: 15,
                color: RED,
                display: "flex",
                gap: 24,
                opacity: rowOp,
                marginBottom: 4,
              }}
            >
              <span>{(price as number).toFixed(4)}</span>
              <span style={{ color: "#5a5a5a" }}>{(size as number).toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BuySellPills: React.FC<{ startFrame?: number }> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frame - startFrame;

  const s = spring({
    frame: Math.max(0, elapsed),
    fps,
    config: { damping: 14, stiffness: 90, mass: 0.8 },
    durationInFrames: 12,
  });
  const op = elapsed < 0 ? 0 : s;
  const rotation = elapsed * 3;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        opacity: op,
      }}
    >
      <svg width={60} height={60} viewBox="0 0 60 60" style={{ transform: `rotate(${rotation}deg)` }}>
        <circle cx={30} cy={30} r={26} fill="none" stroke={TEAL} strokeWidth={2} strokeDasharray="12 6" />
        <circle cx={30} cy={30} r={4} fill={TEAL} />
      </svg>
      <div style={{ display: "flex", gap: 32 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 36,
            fontWeight: 700,
            color: "#fff",
            backgroundColor: TEAL,
            borderRadius: 50,
            padding: "14px 56px",
            letterSpacing: 2,
          }}
        >
          BUY
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 36,
            fontWeight: 700,
            color: "#fff",
            backgroundColor: RED,
            borderRadius: 50,
            padding: "14px 56px",
            letterSpacing: 2,
          }}
        >
          SELL
        </div>
      </div>
    </div>
  );
};

const HFTChart: React.FC<{ startFrame?: number }> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;
  const op = interpolate(elapsed, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const points: Array<[number, number]> = [];
  for (let x = 0; x < 500; x += 3) {
    const y =
      180 +
      Math.sin(x * 0.03) * 40 +
      Math.sin(x * 0.07 + 1) * 25 +
      Math.cos(x * 0.12) * 15 +
      (Math.random() - 0.5) * 8;
    points.push([x, y]);
  }
  const visibleCount = Math.min(
    points.length,
    Math.floor(interpolate(elapsed, [0, 60], [0, points.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }))
  );
  const d = points
    .slice(0, visibleCount)
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`)
    .join(" ");

  return (
    <div
      style={{
        position: "absolute",
        left: "15%",
        top: "8%",
        width: "70%",
        height: "60%",
        backgroundColor: "#1a1a1a",
        borderRadius: 8,
        overflow: "hidden",
        opacity: op,
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 500 360" preserveAspectRatio="none">
        <path d={d} fill="none" stroke={TEAL} strokeWidth={2} />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 16,
          fontFamily: FONT,
          fontSize: 13,
          color: "#666",
        }}
      >
        HFT VOLUME — 10Y
      </div>
    </div>
  );
};

const VirtualsLogo: React.FC<{ startFrame?: number }> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frame - startFrame;
  const s = spring({
    frame: Math.max(0, elapsed),
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.6 },
    durationInFrames: 12,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "30%",
        transform: "translate(-50%, -50%)",
        opacity: elapsed < 0 ? 0 : s,
      }}
    >
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={55} fill="none" stroke={TEAL} strokeWidth={3} />
        <text
          x={60}
          y={68}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={36}
          fontWeight={700}
          fill={TEAL}
        >
          V
        </text>
      </svg>
    </div>
  );
};

const PersonSingle: React.FC<{
  color?: string;
  size?: number;
  opacity?: number;
}> = ({ color = "#c8e8db", size = 80, opacity = 1 }) => (
  <svg width={size} height={size * 1.25} viewBox="0 0 40 50" style={{ opacity }}>
    <circle cx={20} cy={12} r={10} fill={color} />
    <path d="M4 50 L10 28 Q20 22 30 28 L36 50 Z" fill={color} />
  </svg>
);

/* ───── main composition ───── */

export const VirtualsReplicateV2: React.FC = () => {
  const frame = useCurrentFrame();

  const bgT = interpolate(frame, [1320, 1350], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bgR = Math.round(242 * (1 - bgT));
  const bgG = Math.round(245 * (1 - bgT));
  const bgB = Math.round(247 * (1 - bgT));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgb(${bgR},${bgG},${bgB})`,
        fontFamily: FONT,
      }}
    >
      {/* ── Scene 1: 70% stat (f0–135) ── */}
      <Sequence from={0} durationInFrames={135}>
        <BigStat value="70%" startFrame={0} />
        <WordReveal
          text="of all trading volume"
          startFrame={30}
          centerY={68}
          color="#b0b0b0"
          fontSize={32}
        />
        <WordReveal
          text="is now run by algorithms"
          startFrame={75}
          centerY={76}
          color="#1a1a1a"
          fontSize={32}
        />
      </Sequence>

      {/* ── Scene 2: HFT chart (f135–195) ── */}
      <Sequence from={135} durationInFrames={60}>
        <HFTChart startFrame={0} />
      </Sequence>

      {/* ── Scene 3: $11B stat (f195–360) ── */}
      <Sequence from={195} durationInFrames={165}>
        <BigStat value="$" startFrame={0} fontSize={160} />
        <BigStat value="$11,000,000,000" startFrame={30} fontSize={80} />
        <WordReveal text="a year" startFrame={45} centerY={68} color={TEAL} fontSize={36} />
        <WordReveal text="in profits" startFrame={60} centerY={76} color="#b0b0b0" fontSize={32} />
      </Sequence>

      {/* ── Scene 4: Wall St / hedge funds (f285–435) ── */}
      <Sequence from={285} durationInFrames={150}>
        <WordReveal
          text="Wall Street hedge funds"
          startFrame={0}
          centerY={38}
          color="#1a1a1a"
          fontSize={48}
        />
        <WordReveal
          text="the smartest money on earth"
          startFrame={60}
          centerY={52}
          color="#b0b0b0"
          fontSize={36}
        />
      </Sequence>

      {/* ── Scene 5: 79% stat (f435–510) ── */}
      <Sequence from={435} durationInFrames={75}>
        <BigStat value="79%" startFrame={0} color={RED} />
      </Sequence>

      {/* ── Scene 6: "That's you" (f510–585) ── */}
      <Sequence from={510} durationInFrames={75}>
        <WordReveal
          text="That's you losing."
          startFrame={0}
          centerY={50}
          color="#1a1a1a"
          fontSize={52}
          highlightWords={{ "you": RED, "losing.": RED }}
        />
      </Sequence>

      {/* ── Scene 7: 80% quit (f585–660) ── */}
      <Sequence from={585} durationInFrames={75}>
        <WordReveal
          text="80% of all day traders quit within 2 years"
          startFrame={0}
          centerY={50}
          color="#1a1a1a"
          fontSize={40}
          highlightWords={{ "80%": RED, "quit": RED }}
        />
      </Sequence>

      {/* ── Scene 8: Studies (f660–735) ── */}
      <Sequence from={660} durationInFrames={75}>
        <WordReveal
          text="Multiple independent studies across decades"
          startFrame={0}
          centerY={45}
          color="#1a1a1a"
          fontSize={36}
        />
      </Sequence>

      {/* ── Scene 9: Person grid appears (f735–885) ── */}
      <Sequence from={735} durationInFrames={150}>
        <PersonGrid count={100} columns={15} collapseToOne={false} collapseFrame={9999} />
        <WordReveal
          text="and landed on the exact same number"
          startFrame={60}
          centerY={85}
          color="#1a1a1a"
          fontSize={32}
        />
      </Sequence>

      {/* ── Scene 10: Person grid collapses to 3 then 1 (f885–1035) ── */}
      <Sequence from={885} durationInFrames={150}>
        <PersonGrid count={100} columns={15} collapseToOne collapseFrame={15} />
        <WordReveal
          text="only 1% are consistently profitable after fees"
          startFrame={60}
          centerY={85}
          color="#1a1a1a"
          fontSize={28}
          highlightWords={{ "1%": TEAL }}
        />
      </Sequence>

      {/* ── Scene 11: Blank white pause (f1035–1110) ── */}
      <Sequence from={1035} durationInFrames={75}>
        <AbsoluteFill />
      </Sequence>

      {/* ── Scene 12: Repeat 80% quit (f1110–1185) ── */}
      <Sequence from={1110} durationInFrames={75}>
        <WordReveal
          text="80% of all day traders quit"
          startFrame={0}
          centerY={50}
          color="#1a1a1a"
          fontSize={44}
          highlightWords={{ "80%": RED }}
        />
      </Sequence>

      {/* ── Scene 13: What if it wasn't you (f1185–1260) ── */}
      <Sequence from={1185} durationInFrames={75}>
        <div style={{ position: "absolute", left: "50%", top: "28%", transform: "translate(-50%, -50%)" }}>
          <PersonSingle color="#b0b0b0" size={70} />
        </div>
        <WordReveal
          text="What if it wasn't you trading?"
          startFrame={0}
          centerY={58}
          color="#1a1a1a"
          fontSize={44}
          highlightWords={{ "wasn't": TEAL, "you": TEAL }}
        />
      </Sequence>

      {/* ── Scene 14: Virtuals logo + AI Agent (f1260–1335) ── */}
      <Sequence from={1260} durationInFrames={75}>
        <VirtualsLogo startFrame={0} />
        <WordReveal
          text="What if it was your AI Agent?"
          startFrame={15}
          centerY={62}
          color="#1a1a1a"
          fontSize={44}
          highlightWords={{ "AI": TEAL, "Agent?": TEAL }}
        />
      </Sequence>

      {/* ── Scene 15: BUY/SELL pills + carousel (f1335–1485) ── */}
      {/* bg now transitioning to black */}
      <Sequence from={1335} durationInFrames={150}>
        <BuySellPills startFrame={0} />
      </Sequence>

      {/* ── Scene 16: Can AI make money? (f1485–1635) ── */}
      <Sequence from={1485} durationInFrames={150}>
        <WordReveal
          text="Can AI actually make money trading?"
          startFrame={0}
          centerY={45}
          color="#fff"
          fontSize={44}
          highlightWords={{ "AI": TEAL, "money": TEAL }}
        />
      </Sequence>

      {/* ── Scene 17: Most AI bots fail (f1635–1785) ── */}
      <Sequence from={1635} durationInFrames={150}>
        <WordReveal
          text="Most AI trading bots fail too."
          startFrame={0}
          centerY={45}
          color="#fff"
          fontSize={44}
          highlightWords={{ "fail": RED }}
        />
        <WordReveal
          text="Same edge decay. Same overfitting."
          startFrame={45}
          centerY={58}
          color="#888"
          fontSize={30}
        />
      </Sequence>

      {/* ── Scene 18: Wireframe + infrastructure (f1785–1935) ── */}
      <Sequence from={1785} durationInFrames={150}>
        <Wireframe startFrame={0} />
        <WordReveal
          text="We build infrastructure for the ones that don't."
          startFrame={20}
          centerY={82}
          color="#fff"
          fontSize={32}
          highlightWords={{ "infrastructure": TEAL }}
        />
      </Sequence>

      {/* ── Scene 19: $100K EVERY WEEK (f1935–2085) ── */}
      <Sequence from={1935} durationInFrames={150}>
        <BigStat value="$100,000" startFrame={0} fontSize={120} />
        <WordReveal
          text="EVERY WEEK"
          startFrame={20}
          centerY={68}
          color="#fff"
          fontSize={52}
        />
        <WordReveal
          text="in prize pools"
          startFrame={40}
          centerY={78}
          color="#888"
          fontSize={28}
        />
      </Sequence>

      {/* ── Scene 20: Leaderboard 3 rows (f2085–2235) ── */}
      <Sequence from={2085} durationInFrames={150}>
        <Leaderboard rowCount={3} startFrame={0} highlightTop={1} />
      </Sequence>

      {/* ── Scene 21: Order book data (f2235–2385) ── */}
      <Sequence from={2235} durationInFrames={150}>
        <OrderBook startFrame={0} />
        <WordReveal
          text="Every trade. Every signal. Every edge."
          startFrame={30}
          centerY={85}
          color="#fff"
          fontSize={28}
          highlightWords={{ "Every": TEAL }}
        />
      </Sequence>

      {/* ── Scene 22: Leaderboard 5 rows + metrics (f2385–2535) ── */}
      <Sequence from={2385} durationInFrames={150}>
        <Leaderboard rowCount={5} startFrame={0} highlightTop={3} />
        <WordReveal
          text="profitability, and consistency"
          startFrame={30}
          centerY={88}
          color="#888"
          fontSize={24}
        />
      </Sequence>

      {/* ── Scene 23: Top 10 selection + code (f2535–2685) ── */}
      <Sequence from={2535} durationInFrames={150}>
        <CodeBlock startFrame={0} />
        <WordReveal
          text="Top 10 compete. Code is the strategy."
          startFrame={15}
          centerY={12}
          color="#fff"
          fontSize={28}
          highlightWords={{ "Top": TEAL, "10": TEAL }}
        />
      </Sequence>

      {/* ── Scene 24: Code + enter the ring (f2685–2835) ── */}
      <Sequence from={2685} durationInFrames={150}>
        <CodeBlock startFrame={0} />
        <WordReveal
          text="Enter the ring."
          startFrame={10}
          centerY={12}
          color="#fff"
          fontSize={44}
          highlightWords={{ "ring.": TEAL }}
        />
      </Sequence>

      {/* ── Scene 25: Top 10 leaderboard + share (f2835–2985) ── */}
      <Sequence from={2835} durationInFrames={150}>
        <Leaderboard rowCount={10} startFrame={0} highlightTop={1} />
        <WordReveal
          text="you share in their profits"
          startFrame={10}
          centerY={10}
          color="#fff"
          fontSize={32}
          highlightWords={{ "share": TEAL, "profits": TEAL }}
        />
        <div
          style={{
            position: "absolute",
            right: 60,
            top: 40,
            fontFamily: FONT,
            fontSize: 64,
            fontWeight: 700,
            color: TEAL,
            opacity: interpolate(
              useCurrentFrame(),
              [20, 35],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            ),
          }}
        >
          TOP 10
        </div>
      </Sequence>

      {/* ── Scene 26: Wireframe + Agent Commerce (f2985–3135) ── */}
      <Sequence from={2985} durationInFrames={150}>
        <Wireframe startFrame={0} />
        <WordReveal
          text="Agent Commerce"
          startFrame={15}
          centerY={80}
          color="#fff"
          fontSize={56}
          highlightWords={{ "Agent": TEAL }}
        />
      </Sequence>

      {/* ── Scene 27: $100K repeat (f3135–3285) ── */}
      <Sequence from={3135} durationInFrames={150}>
        <BigStat value="$100,000" startFrame={0} fontSize={120} />
        <WordReveal
          text="EVERY WEEK"
          startFrame={20}
          centerY={68}
          color="#fff"
          fontSize={52}
        />
      </Sequence>

      {/* ── Scene 28: Fade to black (f3285–3303) ── */}
      <Sequence from={3285} durationInFrames={18}>
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(0,0,0,${interpolate(
              useCurrentFrame(),
              [0, 18],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            )})`,
          }}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export const virtualsReplicateV2Meta = {
  id: "VirtualsReplicateV2",
  component: VirtualsReplicateV2,
  durationInFrames: 3303,
  fps: 30,
  width: 1920,
  height: 1080,
};
