import React from "react";
import { interpolate } from "remotion";
import { clamp } from "./AnomaComposition";
import { BORDER, BORDER_STRONG, BRASS, BRASS_SOFT, CARD, Card, FlagPair, TEAL, TEAL_SOFT, TER, WELL, fadeIn, settle, smooth, tag, tnum } from "./CrxCardKit";

// ─── Scene 9 (f1116-1225): RFQ — quotes from multiple dealers ───
// The RFQ rides the gentle crest. Skeleton rows shimmer; rates ROLL in on the
// slow-pulse grid (f1138/1149/1160, "dealers" lands with the third quote at the
// f1160 crest) with tabular digits; the best rate is ringed on the f1182 snare
// once all three are on the table. The card continues scene 4's trade: USD/BRL,
// $2.5M, Aug 12 2026. Rows carry no dealer avatar — the name and desk line name
// the counterparty; only the best row is ringed in teal-soft.
const DEALERS = [
  { name: "Dealer 1", sub: "Tier-1 bank", rate: 5.4335, lands: 1138, t: "0.6s" },
  { name: "Dealer 2", sub: "Global FX desk", rate: 5.4298, lands: 1149, t: "0.8s" },
  { name: "Dealer 3", sub: "Regional specialist", rate: 5.4319, lands: 1160, t: "1.1s" },
];
const BEST = 1;
const HIGHLIGHT_AT = 1182;

export const CrxScene9Dealers: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 1116 || frame >= 1226) return null;
  const rated = frame >= 1138;
  const highlighted = frame >= HIGHLIGHT_AT;
  const countdown = rated ? 120 - Math.floor((frame - 1138) / 30) : 120;
  return (
    <Card x={CARD.left} y={CARD.top} w={CARD.w} h={CARD.h} opacity={1}>
      <div style={{ position: "absolute", inset: 0, padding: "26px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
            Request for quote
          </span>
          {rated ? (
            <div
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: BRASS,
                backgroundColor: BRASS_SOFT,
                borderRadius: 980,
                padding: "3px 10px",
                ...tnum,
              }}
            >
              Firm · {countdown}s
            </div>
          ) : (
            <div style={{ ...tag, gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: TEAL,
                  opacity: 0.5 + 0.5 * Math.cos((frame * Math.PI) / 22),
                }}
              />
              Quoting…
            </div>
          )}
        </div>

        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            top: 60,
            height: 1,
            backgroundColor: BORDER,
          }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {[
            <span key="p" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <FlagPair a="us" b="br" size={19} />
              <span>USD/BRL</span>
            </span>,
            <span key="n">$2,500,000</span>,
            <span key="d">Aug 12, 2026</span>,
          ].map((chip, i) => (
            <div
              key={i}
              style={{
                ...tag,
                padding: "4px 10px",
                fontSize: 12.5,
                ...tnum,
              }}
            >
              {chip}
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", left: 30, top: 118, fontSize: 12, color: TER }}>
          {rated ? "3 of 3 dealers responded" : "Quoting 3 dealers…"}
        </div>

        {DEALERS.map((d, i) => {
          const isBest = i === BEST;
          const dimT = highlighted && !isBest ? fadeIn(frame, HIGHLIGHT_AT, 4) : 0;
          const dim = 1 - 0.45 * dimT;
          const landed = frame >= d.lands;
          // Rate rolls up to its value over 9 frames, tabular digits.
          const rollT = smooth(interpolate(frame, [d.lands, d.lands + 9], [0, 1], clamp));
          const shown = (d.rate - 0.0165 * (1 - rollT)).toFixed(4);
          const ringOp = highlighted && isBest ? fadeIn(frame, HIGHLIGHT_AT, 4) : 0;
          return (
            <div
              key={d.name}
              style={{
                position: "absolute",
                left: 30,
                top: 146 + i * 84,
                width: 651,
                height: 72,
                borderRadius: 16,
                backgroundColor: ringOp > 0 ? TEAL_SOFT : WELL,
                boxShadow:
                  ringOp > 0
                    ? `0 0 0 2px rgba(15,182,171,${(0.28 * ringOp).toFixed(3)})`
                    : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
                opacity: dim,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{d.name}</div>
                <div style={{ fontSize: 12.5, color: TER }}>
                  {landed ? `${d.sub} · answered ${d.t}` : d.sub}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {highlighted && isBest && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: TEAL,
                      backgroundColor: TEAL_SOFT,
                      borderRadius: 980,
                      padding: "3px 10px",
                      ...settle(frame, HIGHLIGHT_AT, 10, 0.74),
                    }}
                  >
                    Best rate
                  </div>
                )}
                {landed ? (
                  <div style={{ textAlign: "right", opacity: fadeIn(frame, d.lands, 4) }}>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, ...tnum }}>
                      {shown}
                    </div>
                    <div style={{ fontSize: 12, color: TER }}>BRL per USD</div>
                  </div>
                ) : (
                  // Skeleton the app's way: a flat bar on animate-pulse
                  // (opacity breathing, 2s period) — no light sweep.
                  <div
                    style={{
                      width: 86,
                      height: 14,
                      borderRadius: 6,
                      backgroundColor: BORDER_STRONG,
                      opacity: 0.5 + 0.5 * Math.cos(((frame + i * 11) * Math.PI) / 22),
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}

        <div style={{ position: "absolute", left: 30, bottom: 20, fontSize: 12, color: TER }}>
          One request: the whole dealer network answers
        </div>
      </div>
    </Card>
  );
};
