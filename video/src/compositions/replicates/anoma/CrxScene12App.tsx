import React from "react";
import { interpolate } from "remotion";
import { DIATYPE } from "./diatype";
import { clamp } from "./AnomaComposition";
import { BG, BORDER, BarChart, CARD_SHADOW, Card, CrxMark, FlagPair, INK, Money, SEC, SUCCESS, SURFACE2, TEAL, TER, WELL, fadeIn, label, tag, tnum } from "./CrxCardKit";

// ─── Scene 12 (f1489-1620): the app, full width, under "CRX Sandbox is Live." ───
// Nav + portfolio, AFTER the story's trade: margin locked reflects the
// $2.5M hedge, and the positions list carries it. The card mounts on the
// f1489 snare (the strong finale cut). Bars grow from f1511 and are FINISHED
// on the f1577 snare — a long rest before the fade instead of growth
// running into the cut. Positions land on the f1533 snare (with "Live") and
// f1555. The Portfolio pill is chrome — the real nav never
// animates it in, so it is present from the scene's first frame.
// Card stays bottom-anchored (top + h = 720). The amber sandbox banner was
// removed, so the app shell is 30px shorter: top moves down 30 (291→321) and
// height shrinks 30 (429→399), keeping the bottom edge pinned and the nav flush
// at the card top with no empty band.
const S12 = { left: 83, top: 321, w: 1114, h: 399 };
const S12_BARS = { h: [72, 55, 84, 78, 106], months: ["Feb", "Mar", "Apr", "May", "Jun"] };
const S12_TABS = ["Swap", "Transfer", "Portfolio", "Compliance"];

const POSITIONS = [
  { at: 1533, a: "us", b: "br", pair: "USD/BRL", side: "Long", notional: "$2.5M", pnl: "+$1,240", health: 0.86 },
  { at: 1555, a: "us", b: "mx", pair: "USD/MXN", side: "Short", notional: "$1.0M", pnl: "+$310", health: 0.72 },
];

// The whole UI wears the landing face, so the nav wears Diatype too — a
// Helvetica nav read as a seam. Ink #1a1a1a, a frosted white bar over a
// warm-grey hairline.
const NAV_FONT = DIATYPE;
const NAV_INK = "#1a1a1a";
const NAV_BORDER = "#e7e7e2";

export const CrxScene12App: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 1489 || frame >= 1621) return null;
  const opacity =
    interpolate(frame, [1489, 1511], [0, 1], clamp) *
    interpolate(frame, [1599, 1621], [1, 0], clamp);
  if (opacity <= 0) return null;
  const growth = (fr: number) =>
    // End at 1569 so the staggered hero bar (i*2) finishes on the f1577 snare
    // and rests before the f1599 fade.
    interpolate(fr, [1511, 1522, 1533, 1544, 1555, 1569], [0, 0.18, 0.42, 0.68, 0.9, 1], clamp);
  const pillOn = 1; // chrome never animates itself in
  return (
    <Card x={S12.left} y={S12.top} w={S12.w} h={S12.h} opacity={opacity} radius={16} bg={BG}>
      {/* nav — flush at the card top now the sandbox banner is gone */}
      <div
        style={{
          position: "absolute",
          top: 0,
          width: "100%",
          height: 48,
          backgroundColor: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px) saturate(1.8)",
          borderBottom: `1px solid ${NAV_BORDER}`,
          display: "flex",
          alignItems: "center",
          padding: "0 26px",
          fontFamily: NAV_FONT,
        }}
      >
        <CrxMark size={19} />
        <span
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginLeft: 8,
            color: NAV_INK,
          }}
        >
          CRX
        </span>
        <div style={{ display: "flex", gap: 4, marginLeft: 40 }}>
          {S12_TABS.map((t) => {
            const active = t === "Portfolio";
            // TopNav: Transfer / Portfolio / Compliance are dropdown
            // menus and carry a small chevron; Swap is a bare link.
            const hasMenu = t !== "Swap";
            return (
              <div
                key={t}
                style={{
                  position: "relative",
                  fontSize: 13.5,
                  fontWeight: 400,
                  color: NAV_INK,
                  opacity: active ? 1 : 0.7,
                  padding: "6px 13px",
                }}
              >
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 8,
                      backgroundColor: SURFACE2,
                      opacity: pillOn,
                    }}
                  />
                )}
                <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                  {t}
                  {hasMenu && (
                    <svg
                      viewBox="0 0 9 9"
                      width={9}
                      height={9}
                      style={{ marginLeft: 4, opacity: 0.55 }}
                    >
                      <path
                        d="M2 3.5 L4.5 6 L7 3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginLeft: "auto",
            backgroundColor: TEAL,
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            borderRadius: 980,
            padding: "8px 16px",
            boxShadow: "0 1px 1px 0 rgba(0,0,0,0.08), 0 8px 20px -12px rgba(0,0,0,0.4)",
          }}
        >
          Connect wallet
        </div>
      </div>

      {/* balance card — margin reflects the hedge opened in scene 4 */}
      <div
        style={{
          position: "absolute",
          left: 26,
          top: 72,
          width: 300,
          height: 300,
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: "20px 22px",
          boxShadow: CARD_SHADOW,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.018em", ...tnum }}>
          $30,440
          <span style={{ fontSize: "0.7em", fontWeight: 400, opacity: 0.6 }}>.00</span>
        </div>
        <div style={{ fontSize: 12.5, color: SEC, marginTop: 3 }}>Total value</div>
        {(
          [
            ["Available", "$9,930", false],
            ["Margin Locked", "$10,510", false],
            ["Unrealized P&L", "+$1,550", true],
          ] as [string, string, boolean][]
        ).map(([k, v, green], i) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: 22,
              top: 116 + i * 52,
              width: 256,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${BORDER}`,
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 400, color: SEC }}>{k}</span>
            <Money d={v} fs={13} color={green ? SUCCESS : INK} />
          </div>
        ))}
      </div>

      {/* hedged notional chart */}
      <div
        style={{
          position: "absolute",
          left: 342,
          top: 72,
          width: 400,
          height: 300,
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: "20px 22px",
          boxShadow: CARD_SHADOW,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={label}>Hedged notional</div>
          <div style={{ ...tag, fontSize: 11 }}>6M</div>
        </div>
        <BarChart
          frame={frame}
          growth={growth}
          bars={S12_BARS.h}
          months={S12_BARS.months}
          x={64}
          y={246}
          barW={36}
          gap={64}
          plotH={147}
          gridLabels={["$1.4M", "$2.8M", "$4.2M"]}
          labelGutter={60}
          pill={{ at: 1577, text: "$3.0M" }}
        />
      </div>

      {/* positions */}
      <div
        style={{
          position: "absolute",
          left: 758,
          top: 72,
          width: 330,
          height: 300,
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: "20px 22px",
          boxShadow: CARD_SHADOW,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={label}>Positions</div>
          <div style={{ fontSize: 12, fontWeight: 400, color: SEC }}>View all ›</div>
        </div>
        {POSITIONS.map((pos, i) => {
          const op = fadeIn(frame, pos.at, 4);
          return (
            <div
              key={pos.pair}
              style={{
                position: "absolute",
                left: 22,
                top: 52 + i * 96,
                width: 286,
                height: 96,
                borderBottom: i === 0 ? `1px solid ${BORDER}` : undefined,
                opacity: op,
                paddingTop: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <FlagPair a={pos.a} b={pos.b} size={19} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{pos.pair}</span>
                  <span style={{ ...tag, fontSize: 11.5 }}>{pos.side}</span>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: SUCCESS, ...tnum }}>
                  {pos.pnl}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 10,
                }}
              >
                <span style={{ fontSize: 12.5, color: TER, ...tnum }}>{pos.notional} notional</span>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 11.5, color: SUCCESS, fontWeight: 400 }}>Healthy</span>
                  <div
                    style={{
                      position: "relative",
                      width: 56,
                      height: 5,
                      borderRadius: 980,
                      backgroundColor: WELL,
                    }}
                  >
                    <div
                      style={{
                        width: 56 * pos.health * Math.min(1, op * 1.2),
                        height: 5,
                        borderRadius: 980,
                        backgroundColor: SUCCESS,
                      }}
                    />
                    {op >= 1 && (
                      <div
                        style={{
                          position: "absolute",
                          left: 56 * pos.health - 1,
                          top: -1,
                          width: 2,
                          height: 7,
                          backgroundColor: INK,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
