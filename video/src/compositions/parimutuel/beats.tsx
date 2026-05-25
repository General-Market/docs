import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { RevealChars } from "../anticheat/vibe";
import { font, monoFont, scene } from "../anticheat-edit/props/tokens";
import { Beat, MonoLabel, Pill, TONE, useEnter } from "./primitives";

type BeatProps = { durationInFrames: number };

const usd = (n: number): string => "$" + Math.round(n).toLocaleString("en-US");

// Center of the stage, below the title band.
const STAGE_TOP = 300;

// ─── 1 · One question ───────────────────────────────────────────────────────

export const QuestionBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const { rise, op } = useEnter(8);
  const yesIn = useEnter(28);
  const noIn = useEnter(36);
  return (
    <Beat durationInFrames={durationInFrames} title="One question">
      <div
        style={{
          position: "absolute",
          top: STAGE_TOP,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 1120,
            background: scene.chip,
            borderRadius: 32,
            padding: "56px 64px 60px",
            boxShadow: `0 40px 90px ${scene.chipShadow}`,
            opacity: op,
            transform: `translateY(${((1 - rise) * 34).toFixed(1)}px)`,
          }}
        >
          <MonoLabel size={28} color="#6E727A">
            Market · next 10 minutes
          </MonoLabel>
          <div
            style={{
              marginTop: 26,
              fontFamily: font,
              fontSize: 62,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.04,
              color: "#0A0A0A",
            }}
          >
            Will the temperature rise past the line?
          </div>
          <div style={{ display: "flex", gap: 28, marginTop: 50 }}>
            <div
              style={{
                opacity: yesIn.op,
                transform: `translateY(${((1 - yesIn.rise) * 22).toFixed(1)}px)`,
              }}
            >
              <Pill label="YES" glyph="▲" tone="yes" />
            </div>
            <div
              style={{
                opacity: noIn.op,
                transform: `translateY(${((1 - noIn.rise) * 22).toFixed(1)}px)`,
              }}
            >
              <Pill label="NO" glyph="▼" tone="no" />
            </div>
          </div>
        </div>
      </div>
    </Beat>
  );
};

// ─── 2 · The line (threshold chart) ──────────────────────────────────────────

// Price points, left→right, as fractions (0 bottom, 1 top of the plot).
const PRICE_PTS = [0.16, 0.2, 0.34, 0.3, 0.46, 0.58, 0.72, 0.84, 0.92];
const THRESH_FRAC = 0.62; // the +2% line

export const ThresholdBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const px0 = 360;
  const px1 = 1560;
  const plotW = px1 - px0;
  const baseY = 800;
  const topY = 420;
  const plotH = baseY - topY;

  const xAt = (i: number): number => px0 + (i / (PRICE_PTS.length - 1)) * plotW;
  const yAt = (frac: number): number => baseY - frac * plotH;
  const points = PRICE_PTS.map((f, i) => ({ x: xAt(i), y: yAt(f) }));
  const poly = points.map((p) => `${p.x},${p.y}`).join(" ");
  const threshY = yAt(THRESH_FRAC);

  // Reveal the line left→right.
  const revealW = interpolate(frame, [16, 70], [0, plotW], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tipX = px0 + revealW;
  // Sample the polyline y at tipX.
  const yAtX = (x: number): number => {
    const span = plotW / (PRICE_PTS.length - 1);
    const idx = Math.min(PRICE_PTS.length - 2, Math.max(0, Math.floor((x - px0) / span)));
    const t = Math.min(1, Math.max(0, (x - xAt(idx)) / (xAt(idx + 1) - xAt(idx))));
    return points[idx].y + (points[idx + 1].y - points[idx].y) * t;
  };
  const tipY = yAtX(tipX);
  const crossed = tipY < threshY; // above the line

  const labelOp = interpolate(frame, [8, 24], [0, 1], { extrapolateRight: "clamp" });

  return (
    <Beat durationInFrames={durationInFrames} title="The oracle draws the line">
      <AbsoluteFill>
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="none">
          {/* threshold line */}
          <line
            x1={px0}
            y1={threshY}
            x2={px1}
            y2={threshY}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={2.5}
            strokeDasharray="14 12"
            opacity={labelOp}
          />
          {/* revealed price line */}
          <clipPath id="reveal">
            <rect x={px0 - 4} y={topY - 60} width={revealW + 8} height={plotH + 120} />
          </clipPath>
          <polyline
            points={poly}
            fill="none"
            stroke={scene.ink}
            strokeWidth={6}
            strokeLinejoin="round"
            strokeLinecap="round"
            clipPath="url(#reveal)"
          />
          {/* tip dot */}
          <circle cx={tipX} cy={tipY} r={crossed ? 14 : 11} fill={crossed ? TONE.yes : scene.ink} />
          {crossed ? (
            <circle cx={tipX} cy={tipY} r={26} fill="none" stroke={TONE.yes} strokeWidth={3} opacity={0.5} />
          ) : null}
        </svg>
        {/* +2% tag on the threshold */}
        <div
          style={{
            position: "absolute",
            left: px1 - 150,
            top: threshY - 64,
            opacity: labelOp,
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: scene.ink,
            }}
          >
            +2%
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 860,
            textAlign: "center",
          }}
        >
          <MonoLabel size={32}>+2% in ten minutes — above the line wins</MonoLabel>
        </div>
      </AbsoluteFill>
    </Beat>
  );
};

// ─── 3 · A + B = C ────────────────────────────────────────────────────────────

const Bar: React.FC<{
  h: number;
  w: number;
  color: string;
  label: string;
  sub: string;
}> = ({ h, w, color, label, sub }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    <div style={{ height: 380, display: "flex", alignItems: "flex-end" }}>
      <div
        style={{
          width: w,
          height: Math.max(0, h),
          background: color,
          borderRadius: 14,
          boxShadow: `0 18px 40px ${scene.chipShadow}`,
        }}
      />
    </div>
    <div
      style={{
        marginTop: 24,
        fontFamily: font,
        fontSize: 72,
        fontWeight: 800,
        color: scene.ink,
        lineHeight: 1,
      }}
    >
      {label}
    </div>
    <MonoLabel size={24} style={{ marginTop: 12 }}>
      {sub}
    </MonoLabel>
  </div>
);

const Operator: React.FC<{ char: string; op: number }> = ({ char, op }) => (
  <div
    style={{
      fontFamily: font,
      fontSize: 92,
      fontWeight: 300,
      color: scene.inkSoft,
      paddingBottom: 150,
      opacity: op,
    }}
  >
    {char}
  </div>
);

export const PotBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const aH = interpolate(frame, [8, 34], [0, 300], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bH = interpolate(frame, [16, 42], [0, 220], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cH = interpolate(frame, [54, 84], [0, 520], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const plusOp = interpolate(frame, [24, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eqOp = interpolate(frame, [48, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Beat durationInFrames={durationInFrames} title="Two sides, one pot">
      <div
        style={{
          position: "absolute",
          inset: 0,
          top: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
        }}
      >
        <Bar h={aH} w={130} color={TONE.yes} label="A" sub="YES stakes" />
        <Operator char="+" op={plusOp} />
        <Bar h={bH} w={130} color={TONE.no} label="B" sub="NO stakes" />
        <Operator char="=" op={eqOp} />
        <Bar h={cH} w={158} color={scene.accent} label="C" sub="the pot" />
      </div>
    </Beat>
  );
};

// ─── 4 · B → A (losers fund winners) ──────────────────────────────────────────

const Vault: React.FC<{
  title: string;
  amount: number;
  tone: "yes" | "no";
  active: boolean;
}> = ({ title, amount, tone, active }) => {
  const color = tone === "yes" ? TONE.yes : TONE.no;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <div
        style={{
          width: 300,
          height: 200,
          borderRadius: 26,
          background: "rgba(255,255,255,0.06)",
          border: `2.5px solid ${color}`,
          boxShadow: active ? `0 0 60px ${color}66` : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: active ? 1 : 0.55,
          transition: "none",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: scene.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {usd(amount)}
        </div>
      </div>
      <MonoLabel size={28} color={color}>
        {title}
      </MonoLabel>
    </div>
  );
};

export const FlowBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const transferred = interpolate(frame, [24, 88], [0, 840], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const winner = 1000 + transferred;
  const loser = 840 - transferred;

  const leftX = 470;
  const rightX = 1450;
  const flowY = 470;

  // Coins travelling right→left along the arrow.
  const coins = Array.from({ length: 7 });

  return (
    <Beat durationInFrames={durationInFrames} title="The losers pay the winners">
      <AbsoluteFill>
        <svg width="100%" height="100%" viewBox="0 0 1920 1080">
          <defs>
            <marker id="arrowL" markerWidth="14" markerHeight="14" refX="3" refY="6" orient="auto">
              <path d="M12,1 L2,6 L12,11" fill="none" stroke={scene.inkSoft} strokeWidth={2} />
            </marker>
          </defs>
          <line
            x1={rightX - 170}
            y1={flowY}
            x2={leftX + 190}
            y2={flowY}
            stroke={scene.inkSoft}
            strokeWidth={3}
            markerEnd="url(#arrowL)"
            opacity={0.6}
          />
          {coins.map((_, i) => {
            const period = 46;
            const phase = ((frame * 1 + i * (period / coins.length)) % period) / period;
            const cx = interpolate(phase, [0, 1], [rightX - 180, leftX + 200]);
            const arc = Math.sin(phase * Math.PI) * 26;
            const o = Math.sin(phase * Math.PI);
            return <circle key={i} cx={cx} cy={flowY - arc} r={9} fill={TONE.yes} opacity={o * 0.9} />;
          })}
        </svg>
        <div style={{ position: "absolute", left: leftX - 150, top: flowY - 120 }}>
          <Vault title="YES · winners" amount={winner} tone="yes" active />
        </div>
        <div style={{ position: "absolute", left: rightX - 150, top: flowY - 120 }}>
          <Vault title="NO · losers" amount={loser} tone="no" active={false} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 840, textAlign: "center" }}>
          <MonoLabel size={32}>It crossed +2% — NO funds YES</MonoLabel>
        </div>
      </AbsoluteFill>
    </Beat>
  );
};

// ─── 5 · × 10,000 ──────────────────────────────────────────────────────────

const COLS = 48;
const ROWS = 26;

export const ScaleBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const cx = (COLS - 1) / 2;
  const cy = (ROWS - 1) / 2;
  const maxDist = Math.hypot(cx, cy);

  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const dist = Math.hypot(c - cx, r - cy);
      const delay = 10 + (dist / maxDist) * 44;
      const o = interpolate(frame, [delay, delay + 12], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const isSeed = c === Math.round(cx) && r === Math.round(cy);
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            background: isSeed ? TONE.yes : "rgba(255,255,255,0.16)",
            border: `1px solid ${isSeed ? TONE.yes : "rgba(255,255,255,0.26)"}`,
            opacity: isSeed ? 1 : o * 0.85,
          }}
        />,
      );
    }
  }

  const statOp = interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Beat durationInFrames={durationInFrames} title="Now ten thousand">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 22px)`,
            gap: 12,
            justifyContent: "center",
          }}
        >
          {cells}
        </div>
        {/* scrim + centered stat */}
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(40% 36% at 50% 54%, rgba(2,14,43,0.86) 0%, rgba(2,14,43,0.0) 70%)",
            pointerEvents: "none",
          }}
        >
          <div style={{ textAlign: "center", marginTop: 60, opacity: statOp }}>
            <div
              style={{
                fontFamily: font,
                fontSize: 220,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: scene.ink,
                lineHeight: 0.9,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              10,000
            </div>
            <MonoLabel size={34} style={{ marginTop: 24 }}>
              isolated pools — each one sealed off
            </MonoLabel>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </Beat>
  );
};

// ─── 6 · Cost to cheat ───────────────────────────────────────────────────────

export const CostBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const big = interpolate(frame, [40, 96], [0, 50_000_000], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineIn = useEnter(8);
  const stamp = spring({
    fps,
    frame: Math.max(0, frame - 104),
    config: { mass: 0.8, damping: 11, stiffness: 140 },
    durationInFrames: 22,
  });

  return (
    <Beat durationInFrames={durationInFrames} title="To bend one, bend all ten thousand">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 34,
            opacity: lineIn.op,
            transform: `translateY(${((1 - lineIn.rise) * 22).toFixed(1)}px)`,
            marginTop: 40,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: font, fontSize: 92, fontWeight: 800, color: scene.ink }}>
              $5,000
            </div>
            <MonoLabel size={26} style={{ marginTop: 10 }}>
              to bend one
            </MonoLabel>
          </div>
          <div style={{ fontFamily: font, fontSize: 76, fontWeight: 300, color: scene.inkSoft }}>×</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: font, fontSize: 92, fontWeight: 800, color: scene.ink }}>
              10,000
            </div>
            <MonoLabel size={26} style={{ marginTop: 10 }}>
              all at once
            </MonoLabel>
          </div>
        </div>

        <div
          style={{
            marginTop: 70,
            fontFamily: font,
            fontSize: 200,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: scene.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {usd(big)}+
        </div>

        <div
          style={{
            marginTop: 30,
            opacity: Math.min(1, stamp),
            transform: `scale(${(1.4 - stamp * 0.4).toFixed(3)}) rotate(-4deg)`,
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 70,
              fontWeight: 800,
              letterSpacing: "0.02em",
              color: TONE.no,
              border: `5px solid ${TONE.no}`,
              borderRadius: 18,
              padding: "12px 40px",
            }}
          >
            NOT WORTH IT
          </div>
        </div>
      </AbsoluteFill>
    </Beat>
  );
};

// ─── 7 · Three guarantees (the list of 3) ─────────────────────────────────────

const GUARANTEES: { n: string; head: string; sub: string }[] = [
  { n: "01", head: "Sealed.", sub: "No one sees your bet until it resolves." },
  { n: "02", head: "Settled by the oracle.", sub: "Not the house. Not the other side." },
  { n: "03", head: "Split among winners.", sub: "The losing pool, paid out ten thousand times over." },
];

const GuaranteeRow: React.FC<{
  n: string;
  head: string;
  sub: string;
  delay: number;
}> = ({ n, head, sub, delay }) => {
  const { rise, op } = useEnter(delay);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 40,
        opacity: op,
        transform: `translateX(${((1 - rise) * -36).toFixed(1)}px)`,
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 40,
          fontWeight: 700,
          color: scene.accentSoft,
          letterSpacing: "0.04em",
          minWidth: 84,
        }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontFamily: font, fontSize: 66, fontWeight: 800, letterSpacing: "-0.02em", color: scene.ink, lineHeight: 1.05 }}>
          {head}
        </div>
        <div style={{ fontFamily: font, fontSize: 38, fontWeight: 400, color: scene.inkSoft, marginTop: 10 }}>
          {sub}
        </div>
      </div>
    </div>
  );
};

export const GuaranteesBeat: React.FC<BeatProps> = ({ durationInFrames }) => (
  <Beat durationInFrames={durationInFrames} title="Why it can't be bought">
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 52, marginTop: 70, width: 1180 }}>
        {GUARANTEES.map((g, i) => (
          <GuaranteeRow key={g.n} n={g.n} head={g.head} sub={g.sub} delay={14 + i * 16} />
        ))}
      </div>
    </AbsoluteFill>
  </Beat>
);

// ─── 8 · Landing ─────────────────────────────────────────────────────────────

export const LandingBeat: React.FC<BeatProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const sub = interpolate(frame, [40, 56], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const mark = interpolate(frame, [72, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Beat durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "0 120px" }}>
          <div
            style={{
              fontFamily: font,
              fontSize: 104,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1.06,
              color: scene.ink,
            }}
          >
            <div style={{ whiteSpace: "nowrap" }}>
              <RevealChars text="Cheating costs more" startFrame={6} stagger={1.0} duration={12} />
            </div>
            <div style={{ whiteSpace: "nowrap" }}>
              <RevealChars text="than it pays." startFrame={28} stagger={1.0} duration={12} />
            </div>
          </div>
          <div
            style={{
              marginTop: 30,
              fontFamily: font,
              fontSize: 62,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              color: scene.inkSoft,
              opacity: sub,
            }}
          >
            So no one cheats.
          </div>
          <div style={{ marginTop: 56, opacity: mark }}>
            <MonoLabel size={32} color={scene.accentSoft}>
              Anti-cheat, by construction
            </MonoLabel>
          </div>
        </div>
      </AbsoluteFill>
    </Beat>
  );
};
