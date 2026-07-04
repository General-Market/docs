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

const FONT = "'IBM Plex Mono', 'Courier New', monospace";
const TEAL = "#3ECDA0";
const RED = "#c41e50";

/* ───────────────── inline sub-components ───────────────── */

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
    Math.floor(
      interpolate(elapsed, [0, 60], [0, lines.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    )
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
              : line.includes("import")
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

/* exported to satisfy noUnusedLocals — not used in current storyboard */
export const OrderBook: React.FC<{ startFrame?: number }> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;
  const op = interpolate(elapsed, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bids: [number, number][] = [
    [1.0423, 12400],
    [1.0421, 8900],
    [1.042, 15600],
    [1.0418, 6700],
    [1.0416, 22100],
    [1.0414, 9300],
  ];
  const asks: [number, number][] = [
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
        <div
          style={{
            fontFamily: FONT,
            fontSize: 13,
            color: "#666",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
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
              <span>{price.toFixed(4)}</span>
              <span style={{ color: "#5a5a5a" }}>{size.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      <div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 13,
            color: "#666",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
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
              <span>{price.toFixed(4)}</span>
              <span style={{ color: "#5a5a5a" }}>{size.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BuySellPills: React.FC<{ startFrame?: number }> = ({
  startFrame = 0,
}) => {
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

  /* Cycling icon index — swaps every 20 frames */
  const iconIdx = Math.floor(elapsed / 20) % 4;
  const iconPaths = [
    /* whale */
    "M12 24c6-2 14-6 16-12 1-3-2-5-5-5-2 0-4 2-4 4 0 3 2 5 5 5-4 4-8 6-12 8z",
    /* chart */
    "M4 28 L10 18 L16 22 L22 10 L28 14",
    /* diamond */
    "M16 4 L28 16 L16 28 L4 16 Z",
    /* bolt */
    "M18 4 L8 18 H16 L14 28 L24 14 H16 Z",
  ];

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
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: TEAL,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={40}
          height={40}
          viewBox="0 0 32 32"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <path d={iconPaths[iconIdx]} fill="#fff" stroke="none" />
        </svg>
      </div>
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

  const points: [number, number][] = [];
  for (let x = 0; x < 500; x += 3) {
    const y =
      180 +
      Math.sin(x * 0.03) * 40 +
      Math.sin(x * 0.07 + 1) * 25 +
      Math.cos(x * 0.12) * 15;
    points.push([x, y]);
  }
  const visibleCount = Math.min(
    points.length,
    Math.floor(
      interpolate(elapsed, [0, 50], [0, points.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    )
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
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 500 360"
        preserveAspectRatio="none"
      >
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
      {/* Timestamp axis */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 16,
          right: 16,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: FONT,
          fontSize: 10,
          color: "#555",
        }}
      >
        {["11:30:13", "11:30:17", "11:30:20", "11:30:23", "11:30:28", "11:30:31", "11:30:34", "11:30:37", "11:30:41", "11:30:44"].map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      {/* Exchange stats table */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 16,
          fontFamily: FONT,
          fontSize: 10,
          color: "#777",
          display: "grid",
          gridTemplateColumns: "50px 50px 50px",
          gap: "1px 12px",
          lineHeight: 1.5,
        }}
      >
        {[
          ["NSDQ", "2,821", "10,691"],
          ["BOST", "855", "251"],
          ["PACF", "2,644", "3,715"],
          ["BATS", "2,713", "2,050"],
          ["EDGX", "1,300", "970"],
        ].map(([ex, q, t]) => (
          <React.Fragment key={ex}>
            <span style={{ color: "#3a7" }}>{ex}</span>
            <span>{q}</span>
            <span>{t}</span>
          </React.Fragment>
        ))}
      </div>
      {/* Composite/NBBO legend */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 16,
          fontFamily: FONT,
          fontSize: 10,
          color: "#888",
        }}
      >
        <div>Composite/NBBO</div>
        <div style={{ color: "#7a7a7a" }}>○ National Best Bid</div>
        <div style={{ color: "#7a7a7a" }}>○ National Best Ask</div>
      </div>
    </div>
  );
};

const VirtualsLogo: React.FC<{ startFrame?: number }> = ({
  startFrame = 0,
}) => {
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
        <circle
          cx={60}
          cy={60}
          r={55}
          fill="none"
          stroke={TEAL}
          strokeWidth={3}
        />
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
  <svg
    width={size}
    height={size * 1.25}
    viewBox="0 0 40 50"
    style={{ opacity }}
  >
    <circle cx={20} cy={12} r={10} fill={color} />
    <path d="M4 50 L10 28 Q20 22 30 28 L36 50 Z" fill={color} />
  </svg>
);

const FadeOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${op})` }} />
  );
};

/* ───── subtitle with crossfade (used in Scene 1) ───── */

const CrossfadeSubtitles: React.FC<{
  line1: string;
  line2: string;
  line1Start: number;
  crossfadeFrame: number;
  fontSize?: number;
  centerY?: number;
  line1Color?: string;
  line2Color?: string;
  highlightWords1?: Record<string, string>;
  highlightWords2?: Record<string, string>;
}> = ({
  line1,
  line2,
  line1Start,
  crossfadeFrame,
  fontSize = 32,
  centerY = 58,
  line1Color = "#b0b0b0",
  line2Color = "#1a1a1a",
  highlightWords1 = {},
  highlightWords2 = {},
}) => {
  const frame = useCurrentFrame();

  const line1Opacity = interpolate(
    frame,
    [crossfadeFrame - 10, crossfadeFrame + 5],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const line2Opacity = interpolate(
    frame,
    [crossfadeFrame - 5, crossfadeFrame + 10],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <>
      <div style={{ opacity: frame >= line1Start ? line1Opacity : 0 }}>
        <WordReveal
          text={line1}
          startFrame={line1Start}
          centerY={centerY}
          color={line1Color}
          fontSize={fontSize}
          highlightWords={highlightWords1}
        />
      </div>
      <div style={{ opacity: line2Opacity }}>
        <WordReveal
          text={line2}
          startFrame={crossfadeFrame}
          centerY={centerY}
          color={line2Color}
          fontSize={fontSize}
          highlightWords={highlightWords2}
        />
      </div>
    </>
  );
};

/* ───── NEW: Globe icon ───── */

const GlobeIcon: React.FC<{ size?: number }> = ({ size = 80 }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <circle
      cx={40}
      cy={40}
      r={36}
      fill="none"
      stroke={TEAL}
      strokeWidth={2.5}
    />
    <ellipse
      cx={40}
      cy={40}
      rx={16}
      ry={36}
      fill="none"
      stroke={TEAL}
      strokeWidth={1.5}
    />
    <line x1={4} y1={40} x2={76} y2={40} stroke={TEAL} strokeWidth={1.5} />
    <path
      d="M10 25 Q25 22 40 25 Q55 22 70 25"
      fill="none"
      stroke={TEAL}
      strokeWidth={1.2}
    />
    <path
      d="M10 55 Q25 58 40 55 Q55 58 70 55"
      fill="none"
      stroke={TEAL}
      strokeWidth={1.2}
    />
  </svg>
);

/* ───── NEW: Underline text ("estimate" with teal underline) ───── */

const UnderlineText: React.FC<{
  startFrame?: number;
}> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;

  const textOp = interpolate(elapsed, [0, 20], [0.1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const underlineWidth = interpolate(elapsed, [15, 35], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 52,
          fontWeight: 400,
          opacity: textOp,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 16px",
        }}
      >
        <span style={{ color: "#1a1a1a" }}>That&apos;s</span>
        <span style={{ color: "#1a1a1a" }}>not</span>
        <span style={{ color: "#1a1a1a" }}>an</span>
        <span
          style={{
            color: TEAL,
            fontWeight: 700,
            display: "inline-block",
            position: "relative",
          }}
        >
          estimate
          <div
            style={{
              position: "absolute",
              bottom: -4,
              left: 0,
              width: `${underlineWidth}%`,
              height: 3,
              backgroundColor: TEAL,
              borderRadius: 2,
            }}
          />
        </span>
      </div>
    </div>
  );
};

/* ───────────────── main composition ───────────────── */

export const VirtualsReplicateV2: React.FC = () => {
  const frame = useCurrentFrame();

  // White bg (#f2f5f7) for S01-S20 (rf0 to rf1785), then fade to black rf1750-rf1785
  const bgT = interpolate(frame, [1750, 1785], [0, 1], {
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
      {/* ──── S01: "70%" + subtitles (rf0–135) ──── */}
      <Sequence from={0} durationInFrames={135}>
        <BigStat value="70%" startFrame={0} fontSize={380} />
        <CrossfadeSubtitles
          line1="of all trading volume"
          line2="is now run by algorithms"
          line1Start={30}
          crossfadeFrame={75}
          fontSize={32}
          centerY={58}
          line1Color="#b0b0b0"
          line2Color="#1a1a1a"
        />
      </Sequence>

      {/* ──── S02: HFT chart (rf135–210) ──── */}
      <Sequence from={135} durationInFrames={75}>
        <HFTChart startFrame={0} />
      </Sequence>

      {/* ──── S03: "$11,000,000,000 a year" over chart (rf210–270) ──── */}
      <Sequence from={210} durationInFrames={60}>
        <HFTChart startFrame={-75} />
        <BigStat value="$11,000,000,000" startFrame={0} fontSize={80} />
        <WordReveal
          text="a year"
          startFrame={20}
          centerY={68}
          color="#888"
          fontSize={36}
          align="center"
        />
      </Sequence>

      {/* ──── S04: "in profits" standalone (rf270–300) ──── */}
      <Sequence from={270} durationInFrames={30}>
        <WordReveal
          text="in profits"
          align="center"
          startFrame={-5}
          framesPerWord={4}
          centerY={50}
          color="#1a1a1a"
          fontSize={65}
        />
      </Sequence>

      {/* ──── S05: Wall St + "hedge funds" teal (rf300–330) ──── */}
      <Sequence from={300} durationInFrames={30}>
        <AbsoluteFill style={{ backgroundColor: "#d0d0d0" }} />
        <WordReveal
          text="hedge funds"
          startFrame={-5}
          framesPerWord={4}
          centerY={50}
          color={TEAL}
          fontSize={52}
          align="center"
        />
      </Sequence>

      {/* ──── S06: Blank white (rf330–360) ──── */}
      <Sequence from={330} durationInFrames={30}>
        <AbsoluteFill />
      </Sequence>

      {/* ──── S07: "the smartest money on the planet" + globe (rf360–420) ──── */}
      <Sequence from={360} durationInFrames={60}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <GlobeIcon size={80} />
          <WordReveal
            text="the smartest money on the planet"
            align="center"
            startFrame={0}
            centerY={55}
            color="#1a1a1a"
            fontSize={44}
          />
        </div>
      </Sequence>

      {/* ──── S08: Person grid with counting stat overlay (rf420–495) ──── */}
      {/* Original: red/pink grid of ~100 icons, ~3 green survivors at bottom, */}
      {/* huge semi-transparent "97%" counting up overlaid on the grid */}
      <Sequence from={420} durationInFrames={75}>
        <PersonGrid
          count={100}
          columns={13}
          showStatOverlay
          statValue={97}
          statDuration={60}
          survivorCount={3}
        />
      </Sequence>

      {/* ──── S09: "That's not an estimate" — estimate teal+underline (rf495–570) ──── */}
      <Sequence from={495} durationInFrames={75}>
        <UnderlineText startFrame={0} />
      </Sequence>

      {/* ──── S10: "Multiple independent studies" (rf570–615) ──── */}
      <Sequence from={570} durationInFrames={45}>
        <WordReveal
          text="Multiple independent studies"
          startFrame={0}
          centerY={50}
          color="#1a1a1a"
          fontSize={40}
          highlightWords={{ Multiple: TEAL }}
        />
      </Sequence>

      {/* ──── S11: Person grid fills + "landed on the exact same number" (rf615–735) ──── */}
      <Sequence from={615} durationInFrames={120}>
        <PersonGrid
          count={100}
          columns={15}
          collapseToOne={false}
          collapseFrame={9999}
        />
        <WordReveal
          text="and landed on the exact same number"
          startFrame={45}
          centerY={52}
          color="#1a1a1a"
          fontSize={32}
          highlightWords={{ exact: "#1a1a1a", same: "#1a1a1a" }}
        />
      </Sequence>

      {/* ──── S12: Grid → 3 icons (rf735–810) ──── */}
      <Sequence from={735} durationInFrames={75}>
        <ThreeIconCollapse startFrame={0} />
      </Sequence>

      {/* ──── S13: 3→1 icon + "only 1% consistently profitable after fees" (rf810–975) ──── */}
      <Sequence from={810} durationInFrames={165}>
        <OneIconWithDollars startFrame={0} />
        <WordReveal
          text="only 1% are consistently profitable after fees"
          startFrame={45}
          centerY={80}
          color="#1a1a1a"
          fontSize={28}
          highlightWords={{ "1%": TEAL }}
        />
      </Sequence>

      {/* ──── S14: Blank white (rf975–1110) ──── */}
      <Sequence from={975} durationInFrames={135}>
        <AbsoluteFill />
      </Sequence>

      {/* ──── S15: "80% of all day traders quit" (rf1110–1185) ──── */}
      <Sequence from={1110} durationInFrames={75}>
        <WordReveal
          text="80% of all day traders quit"
          startFrame={0}
          centerY={50}
          color="#1a1a1a"
          fontSize={44}
          highlightWords={{ "80%": TEAL }}
        />
      </Sequence>

      {/* ──── S16: "What if it wasn't you" + person icon (rf1185–1260) ──── */}
      <Sequence from={1185} durationInFrames={75}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "28%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <PersonSingle color={TEAL} size={100} />
        </div>
        <WordReveal
          text="What if it wasn't you"
          align="center"
          startFrame={0}
          centerY={58}
          color="#1a1a1a"
          fontSize={44}
          highlightWords={{ "wasn't": TEAL, you: TEAL }}
        />
      </Sequence>

      {/* ──── S17: Virtuals logo + "AI Agent?" (rf1260–1335) ──── */}
      <Sequence from={1260} durationInFrames={75}>
        <VirtualsLogo startFrame={0} />
        <WordReveal
          text="What if it was your AI Agent?"
          align="center"
          startFrame={15}
          centerY={62}
          color="#1a1a1a"
          fontSize={44}
          highlightWords={{ AI: TEAL, "Agent?": TEAL }}
        />
      </Sequence>

      {/* ──── S18: BUY/SELL carousel — WHITE bg (rf1335–1485) ──── */}
      <Sequence from={1335} durationInFrames={150}>
        <BuySellPills startFrame={0} />
      </Sequence>

      {/* ──── S19: "Can AI actually make money" — WHITE bg (rf1485–1635) ──── */}
      <Sequence from={1485} durationInFrames={150}>
        <WordReveal
          text="Can AI actually make money"
          align="center"
          startFrame={0}
          centerY={45}
          color="#1a1a1a"
          fontSize={44}
          highlightWords={{ AI: TEAL }}
        />
      </Sequence>

      {/* ──── S20: "Most AI trading bots fail too." — WHITE bg (rf1635–1785) ──── */}
      <Sequence from={1635} durationInFrames={150}>
        <WordReveal
          text="Most AI trading bots fail too."
          align="center"
          startFrame={0}
          centerY={45}
          color="#1a1a1a"
          fontSize={44}
        />
      </Sequence>

      {/* ──── S21: Wireframe + "We build infrastructure" — BLACK bg (rf1785–1935) ──── */}
      <Sequence from={1785} durationInFrames={150}>
        <Wireframe startFrame={0} />
        <WordReveal
          text="We build infrastructure"
          startFrame={20}
          centerY={82}
          color="#fff"
          fontSize={40}
          highlightWords={{ infrastructure: TEAL }}
        />
      </Sequence>

      {/* ──── S22: "$100,000 EVERY WEEK" (rf1935–2085) ──── */}
      <Sequence from={1935} durationInFrames={150}>
        <BigStat value="$100,000" startFrame={0} fontSize={120} color={TEAL} />
        <WordReveal
          text="EVERY WEEK"
          startFrame={20}
          centerY={68}
          color={TEAL}
          fontSize={52}
          align="center"
        />
      </Sequence>

      {/* ──── S23: Leaderboard 3 rows (rf2085–2235) ──── */}
      <Sequence from={2085} durationInFrames={150}>
        <Leaderboard rowCount={3} startFrame={0} highlightTop={1} />
      </Sequence>

      {/* ──── S24: Leaderboard 5 rows + "profitability, and consistency" (rf2235–2385) ──── */}
      <Sequence from={2235} durationInFrames={150}>
        <Leaderboard rowCount={5} startFrame={0} highlightTop={3} />
        <WordReveal
          text="profitability, and consistency"
          startFrame={30}
          align="center"
          centerY={88}
          color={TEAL}
          fontSize={24}
        />
      </Sequence>

      {/* ──── S25: Code block + "Enter the ring" (rf2385–2685) ──── */}
      <Sequence from={2385} durationInFrames={300}>
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

      {/* ──── S26: "you share / TOP 10" + leaderboard — split layout (rf2685–2835) ──── */}
      <Sequence from={2685} durationInFrames={150}>
        {/* Left side: text stack */}
        <div style={{ position: "absolute", left: "8%", top: "25%", maxWidth: 500 }}>
          <WordReveal
            text="you share"
            startFrame={0}
            centerY={0}
            color="#fff"
            fontSize={36}
            highlightWords={{ share: TEAL }}
            leftOffset={0}
          />
          <div style={{ marginTop: 80 }}>
            <WordReveal
              text="If they finish"
              startFrame={15}
              centerY={0}
              color="#888"
              fontSize={28}
              leftOffset={0}
            />
          </div>
          <div style={{ marginTop: 130, fontFamily: FONT, fontSize: 72, fontWeight: 700, color: TEAL }}>
            TOP 10
          </div>
        </div>
        {/* Right side: leaderboard */}
        <div style={{ position: "absolute", right: "5%", top: "15%", width: 550 }}>
          <Leaderboard rowCount={5} startFrame={0} highlightTop={3} />
        </div>
      </Sequence>

      {/* ──── S27: Wireframe + "Agent Commerce" (rf2835–2985) ──── */}
      <Sequence from={2835} durationInFrames={150}>
        <Wireframe startFrame={0} />
        <WordReveal
          text="We build infrastructure for Agent Commerce"
          startFrame={15}
          centerY={80}
          color="#fff"
          fontSize={40}
          highlightWords={{ infrastructure: TEAL, Agent: TEAL, Commerce: TEAL }}
        />
      </Sequence>

      {/* ──── S28: "$100,000 EVERY WEEK" repeat (rf2985–3135) ──── */}
      <Sequence from={2985} durationInFrames={150}>
        <BigStat value="$100,000" startFrame={0} fontSize={120} color={TEAL} />
        <WordReveal
          text="EVERY WEEK"
          startFrame={20}
          centerY={68}
          color={TEAL}
          fontSize={52}
          align="center"
        />
      </Sequence>

      {/* ──── S29: Fade to black (rf3135–3303) ──── */}
      <Sequence from={3135} durationInFrames={168}>
        <FadeOverlay />
      </Sequence>
    </AbsoluteFill>
  );
};

/* ───── NEW: 3 icons (intermediate collapse step) ───── */

const ThreeIconCollapse: React.FC<{ startFrame?: number }> = ({
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;

  const fadeIn = interpolate(elapsed, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        opacity: fadeIn,
      }}
    >
      <PersonSingle color="#c8e8db" size={60} opacity={0.35} />
      <PersonSingle color={TEAL} size={80} opacity={1} />
      <PersonSingle color="#c8e8db" size={60} opacity={0.35} />
    </div>
  );
};

/* ───── NEW: Single icon with floating $ signs ───── */

const OneIconWithDollars: React.FC<{ startFrame?: number }> = ({
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;

  const fadeIn = interpolate(elapsed, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dollarData = [
    { x: -40, delay: 10 },
    { x: 20, delay: 16 },
    { x: -10, delay: 22 },
  ];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeIn,
      }}
    >
      <PersonSingle color={TEAL} size={100} />
      {dollarData.map((d, i) => {
        const floatY = interpolate(
          elapsed - d.delay,
          [0, 30, 60],
          [0, -25, -50],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const floatOp = interpolate(
          elapsed - d.delay,
          [0, 10, 40, 55],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(50% + ${d.x}px)`,
              top: `calc(50% + ${floatY}px - 80px)`,
              fontFamily: FONT,
              fontSize: 28,
              fontWeight: 700,
              color: TEAL,
              opacity: floatOp,
            }}
          >
            $
          </div>
        );
      })}
    </div>
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
