// Portrait pair chart — one screen, one comparison.
//
// A tall Lorenz panel. The rigged venue's curve sits low (its top few wallets
// keep almost everything); the fair venue's curve lifts toward the perfectly-
// fair diagonal — it "moves left". `progress` drives that lift, so the move
// reads as motion. On the red screens the wedge between the fair curve and the
// diagonal is shaded: that area is what the top still keeps.
//
// The panel is always a light field, so it reads on either the white or the
// blue screen behind it. Colour and the red wedge come from the host.

import React from "react";
import { Img, staticFile } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { MARKETS_CONCENTRATION } from "./data";
import { LOGOS_BY_VENUE } from "./logos";

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
});

const byLabel = (label: string) =>
  MARKETS_CONCENTRATION.snapshots.find((s) => s.label === label)!;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Canvas of the chart panel. The host sizes/positions the wrapper to ~60% H.
const CW = 1000;
const CH = 1180;
const plotL = 116;
const plotR = CW - 56; // 944
const plotW = plotR - plotL; // 828
const plotT = 250;
const plotB = 968;
const plotH = plotB - plotT; // 718

const X_LABELS = MARKETS_CONCENTRATION.xLabels;
const xAt = (i: number, n: number) => plotL + (i / (n - 1)) * plotW;
const yAt = (v: number) => plotT + (1 - v / 100) * plotH;
const poly = (vals: number[]) =>
  vals.map((v, i) => `${xAt(i, vals.length).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");

const INK = "#1D2026";
const DIM = "#6E727A";
const GHOST = "#AEB3BB";

type Props = {
  fair: string;
  rigged: string;
  /** 0 → fair curve sits on the rigged one; 1 → fully lifted to fair. */
  progress: number;
  color: string;
  highlight: boolean;
};

export const RetailPnLPairChart: React.FC<Props> = ({
  fair,
  rigged,
  progress,
  color,
  highlight,
}) => {
  const fairSnap = byLabel(fair);
  const riggedSnap = byLabel(rigged);
  const moved = riggedSnap.values.map((v, i) =>
    lerp(v, fairSnap.values[i] ?? v, progress),
  );
  const logos = (LOGOS_BY_VENUE[fair] ?? []).slice(0, 5);

  // Wedge between the fair curve and the perfectly-fair diagonal. The curve's
  // ends sit on the two corners, so the diagonal closes the polygon.
  const wedge = `${plotL.toFixed(1)},${plotB.toFixed(1)} ${[...moved]
    .map((v, i) => [xAt(i, moved.length), yAt(v)] as const)
    .reverse()
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ")}`;

  return (
    <div style={{ position: "relative", width: CW, height: CH }}>
      {/* Light panel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 44,
          background: "linear-gradient(180deg, #FFFFFF 0%, #F4F6F9 100%)",
          border: "1px solid rgba(20,32,60,0.10)",
          boxShadow: "0 40px 110px -44px rgba(12,28,70,0.55)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          width: CW,
          textAlign: "center",
          fontFamily: INTER,
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "0.02em", color: DIM }}>
          Who keeps the profit
        </div>
        <div style={{ fontSize: 24, fontWeight: 500, color: GHOST, marginTop: 8 }}>
          share captured by the bottom % of wallets
        </div>
      </div>

      <svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="pair-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        {/* y gridlines + labels */}
        {[0, 20, 40, 60, 80, 100].map((tick) => (
          <g key={tick}>
            <line x1={plotL} x2={plotR} y1={yAt(tick)} y2={yAt(tick)} stroke="rgba(10,12,20,0.07)" strokeWidth={1.5} />
            <text x={plotL - 22} y={yAt(tick) + 10} textAnchor="end" fontFamily={INTER} fontSize={26} fontWeight={600} fill={DIM}>
              {tick}%
            </text>
          </g>
        ))}

        {/* x ticks */}
        {X_LABELS.map((label, i) => (
          <text key={label} x={xAt(i, X_LABELS.length)} y={plotB + 44} textAnchor="middle" fontFamily={INTER} fontSize={23} fontWeight={600} fill={DIM}>
            {label}
          </text>
        ))}

        {/* perfectly-fair diagonal */}
        <line x1={plotL} y1={plotB} x2={plotR} y2={plotT} stroke="rgba(40,46,60,0.42)" strokeWidth={2.5} strokeDasharray="11 13" />
        <text x={plotR - 4} y={plotT - 16} textAnchor="end" fontFamily={INTER} fontSize={24} fontWeight={600} fill={DIM}>
          perfectly fair
        </text>

        {/* red wedge — what the top keeps */}
        {highlight ? <polygon points={wedge} fill="rgba(232,38,38,0.18)" /> : null}

        {/* rigged curve — where you were (stays as a ghost) */}
        <polyline points={poly(riggedSnap.values)} fill="none" stroke={GHOST} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />

        {/* fair curve — lifting left toward fair */}
        <polyline points={poly(moved)} fill="none" stroke={color} strokeWidth={15} opacity={0.4} filter="url(#pair-glow)" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={poly(moved)} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        {moved.map((v, i) => (
          <circle key={i} cx={xAt(i, moved.length)} cy={yAt(v)} r={7} fill={color} stroke="#FFFFFF" strokeWidth={2.5} />
        ))}

        {/* "moves left" cue during the lift */}
        {progress > 0.06 && progress < 0.94 ? (
          <text x={(plotL + plotR) / 2} y={plotB + 96} textAnchor="middle" fontFamily={INTER} fontSize={30} fontWeight={700} fill={INK}>
            ◂ the curve moves left
          </text>
        ) : null}
      </svg>

      {/* fair venue logos */}
      {logos.length > 0 ? (
        <div style={{ position: "absolute", top: plotB + 110, left: plotL, width: plotW, display: "flex", justifyContent: "center", gap: 16 }}>
          {logos.map((logo) => (
            <div
              key={logo.file}
              style={{
                width: 96,
                height: 96,
                borderRadius: 22,
                background: "#FFFFFF",
                boxShadow: "0 12px 30px -16px rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 14,
              }}
            >
              <Img src={staticFile(logo.file)} alt={logo.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
