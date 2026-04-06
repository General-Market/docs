import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

const TICKERS = [
  "$PEPE", "$WOJAK", "$MOON", "$RUG", "$COPE", "$FREN", "$WAGMI", "$NGMI",
  "$DOGE2", "$SHIB3", "$APU", "$BONK", "$MFER", "$BODEN", "$TREMP", "$HAWK",
  "$RIZZ", "$SIGMA", "$BASED", "$JEET", "$GEM", "$PUMP", "$DUMP", "$SEND",
];

const MARKET_CAPS = [
  "$2.4K", "$18.7K", "$142K", "$890", "$5.1K", "$67K", "$312K", "$1.2K",
  "$44K", "$8.9K", "$23K", "$456K", "$3.3K", "$91K", "$7.7K", "$210",
  "$55K", "$128K", "$2.1K", "$680", "$34K", "$11K", "$4.5K", "$77K",
];

const TIMESTAMPS = [
  "12m ago", "8m ago", "5m ago", "3m ago", "2m ago", "90s ago", "75s ago", "60s ago",
  "45s ago", "38s ago", "30s ago", "22s ago", "18s ago", "12s ago", "8s ago", "5s ago",
  "just now", "just now", "just now", "just now", "just now", "just now", "just now", "just now",
];

function seededRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function generateCandles(seed: number, rugged: boolean) {
  const candles = [];
  let price = 20 + seededRand(seed) * 40;
  for (let i = 0; i < 4; i++) {
    const open = price;
    const change = (seededRand(seed * 10 + i) - 0.4) * 15;
    const close = rugged && i === 3 ? open * 0.15 : open + change;
    const high = Math.max(open, close) + seededRand(seed + i * 3) * 8;
    const low = Math.min(open, close) - seededRand(seed + i * 7) * 8;
    candles.push({ open, close, high, low });
    price = close;
  }
  return candles;
}

// Parse market cap string to numeric for king-of-the-hill comparison
function parseMarketCap(mc: string): number {
  const num = parseFloat(mc.replace("$", "").replace("K", ""));
  return mc.includes("K") ? num * 1000 : num;
}

const kingIdx = MARKET_CAPS.reduce((best, mc, i) =>
  parseMarketCap(mc) > parseMarketCap(MARKET_CAPS[best]) ? i : best, 0);

const GREEN = "#22c55e";
const RED = "#dc2626";
const YELLOW = "#eab308";
const CARD_BG = "#111111";

// Mini S-curve path for bonding curve label
const BONDING_CURVE_PATH = "M0,20 C5,19 10,18 14,16 C18,14 22,10 26,4 C28,1 30,0 32,0";

export const PumpFunScene: React.FC = () => {
  const frame = useCurrentFrame();

  const launchCount = Math.floor(
    interpolate(frame, [0, 150], [2847, 3218], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

  const rugCount = Math.floor(
    interpolate(frame, [0, 150], [2341, 2509], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

  // SOL price with subtle movement
  const solBase = 187.42;
  const solDrift = Math.sin(frame * 0.07) * 1.8 + Math.sin(frame * 0.13) * 0.6;
  const solPrice = (solBase + solDrift).toFixed(2);
  const solUp = solDrift >= 0;

  const scrollY = frame * 1.8;
  const cols = 4;
  const cardW = 400;
  const cardH = 170;
  const gap = 20;

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", overflow: "hidden" }}>

      {/* SOL price ticker — top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 32,
        background: "#080808", borderBottom: "1px solid #1a1a1a",
        display: "flex", alignItems: "center", paddingLeft: 56, zIndex: 6,
      }}>
        <div style={{
          color: "#666", fontSize: 12, letterSpacing: 1, marginRight: 8,
        }}>SOL</div>
        <div style={{
          color: solUp ? GREEN : RED, fontSize: 14, fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}>
          ${solPrice}
        </div>
        <div style={{
          color: solUp ? GREEN : RED, fontSize: 10, marginLeft: 6, opacity: 0.7,
        }}>
          {solUp ? "\u25B2" : "\u25BC"}
        </div>
      </div>

      {/* Counters — top right */}
      <div style={{ position: "absolute", top: 46, right: 56, textAlign: "right", zIndex: 5 }}>
        <div style={{ display: "flex", gap: 40, justifyContent: "flex-end" }}>
          {/* Launches */}
          <div>
            <div style={{ color: "#555", fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>LAUNCHES TODAY</div>
            <div style={{ color: GREEN, fontSize: 36, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {launchCount.toLocaleString()}
            </div>
          </div>
          {/* Rugs */}
          <div>
            <div style={{ color: "#555", fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>RUGS TODAY</div>
            <div style={{ color: RED, fontSize: 36, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {rugCount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Label */}
      <div style={{ position: "absolute", top: 52, left: 56, color: "#888", fontSize: 20, fontWeight: 600, letterSpacing: 1, zIndex: 5 }}>
        pump.fun — LIVE
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: GREEN, marginLeft: 10, opacity: Math.sin(frame * 0.15) > 0 ? 1 : 0.3 }} />
      </div>

      {/* Cards grid — scrolling up */}
      <div style={{ position: "absolute", top: 120, left: 56, right: 56, bottom: 0, transform: `translateY(-${scrollY}px)` }}>
        {TICKERS.map((ticker, idx) => {
          const row = Math.floor(idx / cols);
          const col = idx % cols;
          const entryFrame = idx * 5;
          const rugFrame = 40 + idx * 6;
          const isRugged = seededRand(idx * 31) > 0.55 && frame > rugFrame;
          const isKing = idx === kingIdx && !isRugged;

          // Entry animation: slide from top + green flash
          const entryProgress = interpolate(frame, [entryFrame, entryFrame + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const entrySlide = interpolate(entryProgress, [0, 1], [-40, 0]);
          const entryFlash = interpolate(frame, [entryFrame, entryFrame + 6, entryFrame + 18], [0, 0.4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

          // Rug animation phases: shake → flash red → shrink to nothing
          const rugAge = isRugged ? frame - rugFrame : -1;
          // Shake phase: frames 0–8
          const shakeAmount = (rugAge >= 0 && rugAge < 8) ? Math.sin(rugAge * 4) * 6 : 0;
          // Red flash phase: frames 2–12
          const rugFlashRed = isRugged ? interpolate(rugAge, [2, 5, 12], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
          // Shrink phase: frames 10–25
          const rugScale = isRugged ? interpolate(rugAge, [10, 25], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
          // Skull appears at frame 8
          const skullOpacity = isRugged ? interpolate(rugAge, [8, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
          // Overall opacity
          const rugOpacity = isRugged ? interpolate(rugAge, [20, 28], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;

          const pct = isRugged ? -((seededRand(idx * 7) * 80 + 15).toFixed(0)) : `+${(seededRand(idx * 13) * 400 + 20).toFixed(0)}`;

          // Liquidity bar: starts full green, empties to red on rug
          const liquidityBase = 0.3 + seededRand(idx * 41) * 0.7;
          const liquidityFill = isRugged
            ? interpolate(rugAge, [0, 15], [liquidityBase, 0.02], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            : liquidityBase;
          const liquidityColor = liquidityFill > 0.3 ? GREEN : liquidityFill > 0.1 ? YELLOW : RED;

          // Bonding curve: show on non-rugged tokens with lower market caps
          const showBondingCurve = !isRugged && parseMarketCap(MARKET_CAPS[idx]) < 100000;

          const candles = generateCandles(idx, isRugged);
          const maxPrice = Math.max(...candles.map((c) => c.high));
          const minPrice = Math.min(...candles.map((c) => c.low));
          const range = maxPrice - minPrice || 1;

          // Card border color
          const borderColor = isRugged
            ? `rgba(220, 38, 38, ${0.3 + rugFlashRed * 0.7})`
            : isKing
              ? YELLOW + "66"
              : "#222";

          // Card background blend with red flash
          const cardBg = rugFlashRed > 0
            ? `rgba(${17 + Math.floor(rugFlashRed * 60)}, ${17 - Math.floor(rugFlashRed * 10)}, ${17 - Math.floor(rugFlashRed * 10)}, 1)`
            : entryFlash > 0
              ? `rgba(${17 + Math.floor(entryFlash * 20)}, ${17 + Math.floor(entryFlash * 40)}, ${17 + Math.floor(entryFlash * 15)}, 1)`
              : CARD_BG;

          return (
            <div key={idx} style={{
              position: "absolute",
              left: col * (cardW + gap),
              top: row * (cardH + gap) + entrySlide,
              width: cardW,
              height: cardH,
              background: cardBg,
              borderRadius: 8,
              border: `1px solid ${borderColor}`,
              padding: "12px 16px",
              opacity: entryProgress * rugOpacity,
              transform: `translateX(${shakeAmount}px) scale(${rugScale})`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              overflow: "hidden",
            }}>
              {/* Top row: ticker info + chart */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  {/* Ticker + crown for king */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ color: "#eee", fontSize: 20, fontWeight: 700 }}>{ticker}</div>
                    {isKing && <span style={{ fontSize: 16 }}>{"\uD83D\uDC51"}</span>}
                  </div>
                  {/* Market cap */}
                  <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>{MARKET_CAPS[idx]}</div>
                  {/* Percentage */}
                  <div style={{ color: isRugged ? RED : GREEN, fontSize: 16, fontWeight: 600, marginTop: 4 }}>{pct}%</div>
                  {/* Timestamp */}
                  <div style={{ color: "#444", fontSize: 10, marginTop: 2 }}>{TIMESTAMPS[idx]}</div>
                </div>

                {/* Mini candlestick chart */}
                <svg width={100} height={56} viewBox="0 0 100 56" style={{ flexShrink: 0 }}>
                  {candles.map((c, ci) => {
                    const x = ci * 25 + 12;
                    const bullish = c.close >= c.open;
                    const color = bullish ? GREEN : RED;
                    const bodyTop = ((maxPrice - Math.max(c.open, c.close)) / range) * 48 + 4;
                    const bodyBot = ((maxPrice - Math.min(c.open, c.close)) / range) * 48 + 4;
                    const wickTop = ((maxPrice - c.high) / range) * 48 + 4;
                    const wickBot = ((maxPrice - c.low) / range) * 48 + 4;
                    return (
                      <g key={ci}>
                        <line x1={x} y1={wickTop} x2={x} y2={wickBot} stroke={color} strokeWidth={1.2} />
                        <rect x={x - 6} y={bodyTop} width={12} height={Math.max(bodyBot - bodyTop, 2)} fill={color} rx={1} />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Bottom row: liquidity bar + bonding curve / rugged label */}
              <div>
                {/* Liquidity bar */}
                <div style={{
                  width: "100%", height: 4, backgroundColor: "#1a1a1a",
                  borderRadius: 2, overflow: "hidden", marginBottom: 6,
                }}>
                  <div style={{
                    width: `${liquidityFill * 100}%`, height: "100%",
                    backgroundColor: liquidityColor, borderRadius: 2,
                    transition: "width 0.1s",
                  }} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 16 }}>
                  {/* Left: bonding curve or rug label */}
                  {isRugged ? (
                    <div style={{ color: RED, fontSize: 10, letterSpacing: 2, fontWeight: 700 }}>RUGGED</div>
                  ) : showBondingCurve ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width={32} height={20} viewBox="0 0 32 20">
                        <path d={BONDING_CURVE_PATH} fill="none" stroke={GREEN} strokeWidth={1.5} opacity={0.6} />
                      </svg>
                      <span style={{ color: GREEN, fontSize: 9, letterSpacing: 1.5, opacity: 0.6, fontWeight: 600 }}>BONDING CURVE</span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Right: liquidity label */}
                  <div style={{ color: "#444", fontSize: 9, letterSpacing: 1 }}>LIQ</div>
                </div>
              </div>

              {/* Skull overlay on rug */}
              {isRugged && skullOpacity > 0 && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: skullOpacity, pointerEvents: "none",
                  fontSize: 48,
                }}>
                  {"\u2620\uFE0F"}
                </div>
              )}

              {/* King glow effect */}
              {isKing && (
                <div style={{
                  position: "absolute", inset: -1, borderRadius: 8,
                  border: `1px solid ${YELLOW}33`,
                  boxShadow: `0 0 20px ${YELLOW}11, inset 0 0 20px ${YELLOW}08`,
                  pointerEvents: "none",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Fades */}
      <div style={{ position: "absolute", top: 110, left: 0, right: 0, height: 50, background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)", zIndex: 4 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 100, background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)", zIndex: 4 }} />
    </AbsoluteFill>
  );
};
