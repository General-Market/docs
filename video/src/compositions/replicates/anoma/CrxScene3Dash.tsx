import React from "react";
import { interpolate } from "remotion";
import { clamp } from "./AnomaComposition";
import { BORDER, BarChart, CARD, Card, CrxMark, INK, Money, SEC, SUCCESS, SUCCESS_SOFT, TER, UsdcMark, UsdtMark, label, tag, tnum } from "./CrxCardKit";

// ─── Scene 3 (f216-325): portfolio overview under "Introducing CRX" ───
// Card mounts on the f216 snare. Bars grow from f238 and are FINISHED on
// the f260 music hit (E=0.648) — the chart payoff now lands on the track's
// early peak, not the silent f282; it then rests before the f304 blur-out
// into the f326 snare cut, instead of dying mid-growth. Balance
// column mirrors the live app: number first, "Total value" beneath,
// then Available / Margin Locked / Unrealized P&L and the token rows.
const S3_BARS = { h: [118, 94, 140, 128, 172], months: ["Feb", "Mar", "Apr", "May", "Jun"] };
const S3_ROWS: [string, string, boolean][] = [
  ["Available", "$16,700", false],
  ["Margin Locked", "$12,500", false],
  ["Unrealized P&L", "+$1,240", true],
];
const S3_TOKENS = [
  { name: "USDC", sub: "USD Coin", amt: "25,000", usd: "$25,000" },
  { name: "USDT", sub: "Tether", amt: "4,200", usd: "$4,200" },
];

export const CrxScene3Dash: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 216 || frame >= 326) return null;
  const opacity =
    interpolate(frame, [215, 238], [0, 1], clamp) *
    interpolate(frame, [304, 326], [1, 0], clamp);
  const growth = (fr: number) =>
    interpolate(
      // BarChart staggers each bar by i*2, so the current-month (hero) bar
      // finishes at array-end + 8. End at 252 so the hero lands on the f260
      // music hit and rests before the f304 blur-out. The 238→252 ramp is the
      // 238→274 ramp compressed to keep the same shape while ending 22f earlier
      // (a literal last-key swap would break interpolate's monotonic input).
      fr,
      [238, 241, 243, 246, 249, 252],
      [0, 0.18, 0.4, 0.62, 0.84, 1],
      clamp,
    );
  const blurIn = interpolate(frame, [216, 246], [3.5, 0], clamp);
  const blurOut = interpolate(frame, [304, 326], [0, 6], clamp);
  return (
    <Card
      x={CARD.left}
      y={CARD.top}
      w={CARD.w}
      h={CARD.h}
      opacity={opacity}
      blur={Math.max(blurIn, blurOut)}
    >
      <div style={{ position: "absolute", inset: 0, padding: 30 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CrxMark size={20} />
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Portfolio</span>
          </div>
        </div>

        {/* page-grammar hairline under the header */}
        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            top: 66,
            height: 1,
            backgroundColor: BORDER,
          }}
        />

        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em", ...tnum }}>
              $30,440
              <span style={{ fontSize: "0.7em", fontWeight: 400, opacity: 0.6 }}>.00</span>
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: SUCCESS,
                backgroundColor: SUCCESS_SOFT,
                borderRadius: 980,
                padding: "3px 10px",
                ...tnum,
              }}
            >
              +4.3% MTD
            </div>
          </div>
          <div style={{ fontSize: 13, color: SEC, marginTop: 2 }}>
            Total value · Updated just now
          </div>
        </div>

        {S3_ROWS.map(([k, v, green], i) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: 30,
              top: 166 + i * 44,
              width: 290,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${BORDER}`,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 400, color: SEC }}>{k}</span>
            <Money d={v} fs={13.5} color={green ? SUCCESS : INK} />
          </div>
        ))}

        {S3_TOKENS.map((t, i) => (
          <div
            key={t.name}
            style={{
              position: "absolute",
              left: 30,
              top: 298 + i * 56,
              width: 290,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {t.name === "USDC" ? <UsdcMark size={26} /> : <UsdtMark size={26} />}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: TER }}>{t.sub}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div>
                <Money d={t.amt} fs={13.5} />
              </div>
              <div style={{ fontSize: 11.5, color: TER, ...tnum }}>{t.usd}.00</div>
            </div>
          </div>
        ))}

        <div style={{ position: "absolute", left: 386, top: 166, ...label }}>Hedged notional</div>
        <div style={{ position: "absolute", right: 30, top: 163, ...tag, fontSize: 11.5 }}>6M</div>
        <BarChart
          frame={frame}
          growth={growth}
          bars={S3_BARS.h}
          months={S3_BARS.months}
          x={392}
          y={398}
          barW={34}
          gap={62}
          plotH={180}
          gridLabels={["$0.6M", "$1.2M", "$1.8M"]}
          labelGutter={376}
          pill={{ at: 260, text: "$1.7M" }}
        />
      </div>
    </Card>
  );
};
