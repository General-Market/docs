import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { FPS, BRAND_GREEN, PANEL } from "../theme";
import { COMPARISONS } from "../proofData";

const sec = (s: number) => Math.round(s * FPS);

// Face safe zone: 35%-65% horizontal (672px-1248px), 20%-80% vertical (216px-864px)
// ZONE B = left of face (0-672px), ZONE C = right of face (1248px-1920px)

// ---------------------------------------------------------------------------
// Timing — local seconds (frame 0 = 194.04s in video)
// ---------------------------------------------------------------------------

// Diagram 1: Market Overwhelm -> Structure
const OVERWHELM_IN = sec(0);
const OVERWHELM_OUT = sec(10.9);
const FREEZE_AT = sec(8); // markets freeze and rearrange

// Diagram 2: Single vs All Markets Paradigm
const PARADIGM_IN = sec(10.9);
const PARADIGM_OUT = sec(18.1);

// Diagram 3: Scatter Plot
const SCATTER_IN = sec(18.1);
const SCATTER_OUT = sec(22.8);

// ---------------------------------------------------------------------------
// Market name data — cascading ticker
// ---------------------------------------------------------------------------

const MARKET_NAMES = [
  "xQc_viewers",
  "pokimane_viewers",
  "Berlin_delay",
  "München_delay",
  "DOGE_price",
  "SHIB_price",
  "CS2_players",
  "Dota2_players",
  "BTC_price",
  "ETH_price",
  "Hamburg_delay",
  "Frankfurt_delay",
  "shroud_viewers",
  "tarik_viewers",
  "SOL_price",
  "PEPE_price",
  "Apex_players",
  "Valorant_players",
  "Stuttgart_delay",
  "Köln_delay",
  "summit1g_viewers",
  "mizkif_viewers",
  "ADA_price",
  "AVAX_price",
  "GTA5_players",
  "Rust_players",
  "Nürnberg_delay",
  "Dresden_delay",
  "xqcow_viewers",
  "hasanabi_viewers",
  "MATIC_price",
  "DOT_price",
  "TF2_players",
  "Palworld_players",
  "Leipzig_delay",
  "Bremen_delay",
  "loltyler1_viewers",
  "trainwreckstv_viewers",
  "LINK_price",
  "UNI_price",
  "Fortnite_players",
  "LoL_players",
  "Essen_delay",
  "Düsseldorf_delay",
  "amouranth_viewers",
  "nickmercs_viewers",
  "NEAR_price",
  "FTM_price",
];

const CATEGORIES = [
  { label: "TWITCH", color: "#9146FF", names: MARKET_NAMES.filter((n) => n.includes("viewers")) },
  { label: "TRAINS", color: "#ef4444", names: MARKET_NAMES.filter((n) => n.includes("delay")) },
  { label: "CRYPTO", color: "#f59e0b", names: MARKET_NAMES.filter((n) => n.includes("price")) },
  { label: "GAMING", color: "#06b6d4", names: MARKET_NAMES.filter((n) => n.includes("players")) },
];

// ---------------------------------------------------------------------------
// 1. Market Overwhelm -> Structure (ZONE C: right panel + ZONE B: left panel)
// ---------------------------------------------------------------------------

const MarketOverwhelm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = OVERWHELM_OUT - OVERWHELM_IN;

  const enterOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [duration - 10, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Freeze transition: 0 = scrolling, 1 = frozen/organized
  const freezeProgress = interpolate(frame, [FREEZE_AT - OVERWHELM_IN, FREEZE_AT - OVERWHELM_IN + sec(1.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const isFrozen = frame >= FREEZE_AT - OVERWHELM_IN;

  // Scroll speed decelerates as we approach freeze
  const scrollSpeed = interpolate(frame, [0, FREEZE_AT - OVERWHELM_IN - sec(0.5), FREEZE_AT - OVERWHELM_IN], [6, 4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scrollOffset = frame * scrollSpeed;

  // "Structure = opportunity" label
  const labelOpacity = interpolate(frame, [FREEZE_AT - OVERWHELM_IN + sec(1), FREEZE_AT - OVERWHELM_IN + sec(1.8)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const labelScale = spring({
    frame: Math.max(frame - (FREEZE_AT - OVERWHELM_IN + sec(1)), 0),
    fps,
    config: { damping: 12, stiffness: 160, mass: 0.6 },
  });

  return (
    <AbsoluteFill style={{ opacity: Math.min(enterOpacity, exitOpacity) }}>
      {/* ZONE C: Right panel — scrolling market names */}
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 160,
          width: 560,
          height: 720,
          overflow: "hidden",
          ...PANEL,
          padding: 0,
        }}
      >
        {!isFrozen ? (
          // Scrolling ticker mode
          <div
            style={{
              transform: `translateY(-${scrollOffset}px)`,
              padding: "12px 20px",
            }}
          >
            {Array.from({ length: 120 }, (_, i) => {
              const name = MARKET_NAMES[i % MARKET_NAMES.length];
              const cat = CATEGORIES.find((c) => c.names.includes(name));
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: monoFont,
                    fontSize: 17,
                    fontWeight: 500,
                    color: cat?.color ?? "rgba(250,250,250,0.5)",
                    padding: "4px 0",
                    letterSpacing: "0.02em",
                    opacity: 0.7 + 0.3 * Math.sin(i * 0.7),
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </div>
              );
            })}
          </div>
        ) : (
          // Organized grid mode
          <div
            style={{
              padding: "16px 20px",
              opacity: freezeProgress,
            }}
          >
            {CATEGORIES.map((cat, ci) => (
              <div key={cat.label} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 13,
                    fontWeight: 700,
                    color: cat.color,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 6,
                    opacity: interpolate(
                      frame,
                      [FREEZE_AT - OVERWHELM_IN + sec(0.3 + ci * 0.2), FREEZE_AT - OVERWHELM_IN + sec(0.8 + ci * 0.2)],
                      [0, 1],
                      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                    ),
                  }}
                >
                  {cat.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {cat.names.slice(0, 6).map((name, ni) => {
                    const stagger = ci * 0.15 + ni * 0.05;
                    const itemOpacity = interpolate(
                      frame,
                      [FREEZE_AT - OVERWHELM_IN + sec(0.5 + stagger), FREEZE_AT - OVERWHELM_IN + sec(1.0 + stagger)],
                      [0, 1],
                      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                    );
                    return (
                      <div
                        key={name}
                        style={{
                          fontFamily: monoFont,
                          fontSize: 12,
                          fontWeight: 400,
                          color: cat.color,
                          opacity: itemOpacity * 0.8,
                          background: `${cat.color}15`,
                          border: `1px solid ${cat.color}30`,
                          borderRadius: 4,
                          padding: "3px 8px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {name.replace("_", " ")}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Structure = opportunity label */}
            <div
              style={{
                textAlign: "center",
                marginTop: 20,
                opacity: labelOpacity,
                transform: `scale(${interpolate(labelScale, [0, 1], [0.8, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`,
              }}
            >
              <div
                style={{
                  fontFamily: font,
                  fontSize: 22,
                  fontWeight: 800,
                  color: BRAND_GREEN,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  textShadow: `0 0 20px ${BRAND_GREEN}44`,
                }}
              >
                Structure = opportunity.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ZONE B: Left panel — proof stats comparison */}
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 240,
          width: 560,
        }}
      >
        {/* Polymarket stat */}
        <StatRow
          frame={frame}
          delaySec={0.5}
          label="Polymarket"
          markets={COMPARISONS.polymarketMarkets}
          positions={COMPARISONS.polymarketPositionsPerDay + " positions/day"}
          color="rgba(250,250,250,0.5)"
          barWidth={8}
        />
        {/* GM stat */}
        <StatRow
          frame={frame}
          delaySec={2}
          label="General Market"
          markets={COMPARISONS.gmMarkets}
          positions={COMPARISONS.gmPositionsPerDay + " positions/day"}
          color={BRAND_GREEN}
          barWidth={100}
        />
        {/* Ratio label */}
        <div
          style={{
            marginTop: 24,
            opacity: interpolate(frame, [sec(3.5), sec(4.5)], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 28,
              fontWeight: 700,
              color: BRAND_GREEN,
              textAlign: "center",
              textShadow: `0 0 16px ${BRAND_GREEN}44`,
            }}
          >
            {COMPARISONS.ratio}
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 14,
              color: "rgba(250,250,250,0.5)",
              textAlign: "center",
              marginTop: 4,
            }}
          >
            more positions per cycle
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const StatRow: React.FC<{
  frame: number;
  delaySec: number;
  label: string;
  markets: string;
  positions: string;
  color: string;
  barWidth: number;
}> = ({ frame, delaySec, label, markets, positions, color, barWidth }) => {
  const enter = interpolate(frame, [sec(delaySec), sec(delaySec + 0.8)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const barGrow = interpolate(frame, [sec(delaySec + 0.3), sec(delaySec + 1.5)], [0, barWidth], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  return (
    <div
      style={{
        ...PANEL,
        padding: "16px 24px",
        marginBottom: 12,
        opacity: enter,
        transform: `translateX(${interpolate(enter, [0, 1], [-20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 14,
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: monoFont, fontSize: 22, fontWeight: 700, color }}>{markets}</div>
          <div style={{ fontFamily: font, fontSize: 12, color: "rgba(250,250,250,0.45)", marginTop: 2 }}>markets</div>
        </div>
        <div style={{ flex: 1, height: 6, background: "rgba(250,250,250,0.08)", borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              width: `${barGrow}%`,
              height: "100%",
              background: color,
              borderRadius: 3,
              boxShadow: color === BRAND_GREEN ? `0 0 8px ${BRAND_GREEN}66` : "none",
            }}
          />
        </div>
        <div style={{ fontFamily: monoFont, fontSize: 13, color, opacity: 0.8, whiteSpace: "nowrap" }}>{positions}</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. Single vs All Markets Paradigm (ZONE B+C: wide)
// ---------------------------------------------------------------------------

const SingleVsAllParadigm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = PARADIGM_OUT - PARADIGM_IN;

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [duration - 10, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Left panel enters from left
  const leftSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });
  const leftX = interpolate(leftSpring, [0, 1], [-40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Right panel enters from right (delayed)
  const rightFrame = Math.max(frame - sec(0.6), 0);
  const rightSpring = spring({
    frame: rightFrame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });
  const rightX = interpolate(rightSpring, [0, 1], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rightOpacity = interpolate(rightFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Total edge numbers animate
  const leftEdge = interpolate(frame, [sec(2), sec(3.5)], [0, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  const rightEdge = interpolate(frame, [sec(2.5), sec(4)], [0, 5.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Highlight right panel when total is revealed
  const highlightGlow = interpolate(frame, [sec(4), sec(5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // "8x" multiplier label
  const multiplierOpacity = interpolate(frame, [sec(4.5), sec(5.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Bottom text
  const bottomOpacity = interpolate(frame, [sec(5), sec(6)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const panelStyle: React.CSSProperties = {
    ...PANEL,
    width: 380,
    padding: "28px 32px",
  };

  return (
    <AbsoluteFill style={{ opacity: Math.min(enterOpacity, exitOpacity) }}>
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 420, // gap for face
          alignItems: "flex-start",
        }}
      >
        {/* LEFT: Traditional */}
        <div
          style={{
            ...panelStyle,
            transform: `translateX(${leftX}px)`,
            border: "1px solid rgba(250,250,250,0.1)",
          }}
        >
          {/* Magnifying glass icon */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <svg width={48} height={48} viewBox="0 0 48 48" fill="none">
              <circle cx={20} cy={20} r={14} stroke="rgba(250,250,250,0.4)" strokeWidth={2.5} />
              <line x1={30} y1={30} x2={42} y2={42} stroke="rgba(250,250,250,0.4)" strokeWidth={2.5} strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontFamily: monoFont, fontSize: 14, fontWeight: 700, color: "rgba(250,250,250,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center", marginBottom: 16 }}>
            Traditional
          </div>
          <ParadigmRow label="Deep analysis on 1 market" delay={0.4} frame={frame} color="rgba(250,250,250,0.65)" />
          <ParadigmRow label="Need: 60% edge to profit" delay={0.8} frame={frame} color="rgba(250,250,250,0.65)" />
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <div style={{ fontFamily: font, fontSize: 14, color: "rgba(250,250,250,0.4)", marginBottom: 4 }}>Total edge</div>
            <div style={{ fontFamily: monoFont, fontSize: 42, fontWeight: 700, color: "rgba(250,250,250,0.6)" }}>
              {leftEdge.toFixed(1)}
            </div>
          </div>
        </div>

        {/* RIGHT: General Market */}
        <div
          style={{
            ...panelStyle,
            transform: `translateX(${rightX}px)`,
            opacity: rightOpacity,
            border: `1px solid ${BRAND_GREEN}${Math.round(highlightGlow * 0.4 * 255).toString(16).padStart(2, "0")}`,
            boxShadow: highlightGlow > 0 ? `0 0 ${30 * highlightGlow}px ${BRAND_GREEN}22, inset 0 0 ${20 * highlightGlow}px ${BRAND_GREEN}08` : "none",
          }}
        >
          {/* Radar sweep icon */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <svg width={48} height={48} viewBox="0 0 48 48" fill="none">
              <circle cx={24} cy={24} r={18} stroke={BRAND_GREEN} strokeWidth={1.5} opacity={0.4} />
              <circle cx={24} cy={24} r={12} stroke={BRAND_GREEN} strokeWidth={1.5} opacity={0.3} />
              <circle cx={24} cy={24} r={6} stroke={BRAND_GREEN} strokeWidth={1.5} opacity={0.2} />
              <line
                x1={24}
                y1={24}
                x2={24 + 18 * Math.cos(frame * 0.08)}
                y2={24 + 18 * Math.sin(frame * 0.08)}
                stroke={BRAND_GREEN}
                strokeWidth={2}
                opacity={0.7}
              />
              <circle cx={24} cy={24} r={2} fill={BRAND_GREEN} />
            </svg>
          </div>
          <div style={{ fontFamily: monoFont, fontSize: 14, fontWeight: 700, color: BRAND_GREEN, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center", marginBottom: 16 }}>
            General Market
          </div>
          <ParadigmRow label="Pattern recognition on 5000 markets" delay={1} frame={frame} color={BRAND_GREEN} dimmed />
          <ParadigmRow label="Need: 0.1% edge per market" delay={1.4} frame={frame} color={BRAND_GREEN} dimmed />
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <div style={{ fontFamily: font, fontSize: 14, color: "rgba(250,250,250,0.4)", marginBottom: 4 }}>Total edge</div>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 42,
                fontWeight: 700,
                color: BRAND_GREEN,
                textShadow: highlightGlow > 0 ? `0 0 ${20 * highlightGlow}px ${BRAND_GREEN}66` : "none",
              }}
            >
              {rightEdge.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* 8x multiplier badge */}
      <div
        style={{
          position: "absolute",
          top: 540,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: multiplierOpacity,
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 28,
            fontWeight: 700,
            color: BRAND_GREEN,
            background: `${BRAND_GREEN}15`,
            border: `2px solid ${BRAND_GREEN}44`,
            borderRadius: 8,
            padding: "6px 20px",
            textShadow: `0 0 12px ${BRAND_GREEN}44`,
          }}
        >
          8x more total edge
        </div>
      </div>

      {/* Bottom: Law of large numbers */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: bottomOpacity,
        }}
      >
        <div
          style={{
            ...PANEL,
            display: "inline-block",
            padding: "14px 40px",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 20,
              fontWeight: 600,
              color: "rgba(250,250,250,0.75)",
              letterSpacing: 0.5,
            }}
          >
            Law of large numbers: small edges compound across{" "}
            <span style={{ color: BRAND_GREEN, fontWeight: 700 }}>5,000 markets</span>.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ParadigmRow: React.FC<{
  label: string;
  delay: number;
  frame: number;
  color: string;
  dimmed?: boolean;
}> = ({ label, delay, frame, color, dimmed }) => {
  const opacity = interpolate(frame, [sec(delay), sec(delay + 0.5)], [0, dimmed ? 0.7 : 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(frame, [sec(delay), sec(delay + 0.5)], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  return (
    <div
      style={{
        fontFamily: font,
        fontSize: 15,
        fontWeight: 500,
        color,
        padding: "5px 0",
        opacity,
        transform: `translateX(${x}px)`,
      }}
    >
      {label}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. Scatter Plot (ZONE B+C: wide)
// ---------------------------------------------------------------------------

// Log scale ticks for X axis
const X_TICKS = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000];
const X_LABELS = ["1", "10", "100", "1K", "10K", "100K", "1M", "10M"];

// Y axis ticks
const Y_TICKS = [0.01, 0.1, 1, 10, 100];
const Y_LABELS = ["0.01%", "0.1%", "1%", "10%", "100%"];

const PLOT_LEFT = 120;
const PLOT_RIGHT = 1800;
const PLOT_TOP = 180;
const PLOT_BOTTOM = 880;
const PLOT_W = PLOT_RIGHT - PLOT_LEFT;
const PLOT_H = PLOT_BOTTOM - PLOT_TOP;

const logScale = (val: number, min: number, max: number, pxMin: number, pxMax: number) => {
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const logVal = Math.log10(val);
  const t = (logVal - logMin) / (logMax - logMin);
  return pxMin + t * (pxMax - pxMin);
};

const xPx = (val: number) => logScale(val, 1, 10_000_000, PLOT_LEFT, PLOT_RIGHT);
const yPx = (val: number) => logScale(val, 0.01, 100, PLOT_BOTTOM, PLOT_TOP); // inverted

// Data points
const TRAD_X = 100;
const TRAD_Y = 10;
const GM_X = 10_000_000;
const GM_Y = 0.01;

const ScatterPlot: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = SCATTER_OUT - SCATTER_IN;

  const enterOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 1: Axes draw (0-0.8s)
  const axisProgress = interpolate(frame, [0, sec(0.8)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Phase 2: Grid lines fade in (0.5-1.2s)
  const gridOpacity = interpolate(frame, [sec(0.5), sec(1.2)], [0, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 3: Traditional dot appears (1.0-1.8s)
  const tradDotProgress = interpolate(frame, [sec(1.0), sec(1.8)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Phase 4: GM dot appears (1.8-2.6s)
  const gmDotProgress = interpolate(frame, [sec(1.8), sec(2.6)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Phase 5: Shaded areas (2.6-3.5s)
  const areaOpacity = interpolate(frame, [sec(2.6), sec(3.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Phase 6: "QUANTITY > QUALITY" label (3.2-4s)
  const labelOpacity = interpolate(frame, [sec(3.2), sec(3.8)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const tradDotCx = xPx(TRAD_X);
  const tradDotCy = yPx(TRAD_Y);
  const gmDotCx = xPx(GM_X);
  const gmDotCy = yPx(GM_Y);

  // Trail paths — dot slides in from origin
  const tradTrailX = interpolate(tradDotProgress, [0, 1], [PLOT_LEFT, tradDotCx], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tradTrailY = interpolate(tradDotProgress, [0, 1], [PLOT_BOTTOM, tradDotCy], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const gmTrailX = interpolate(gmDotProgress, [0, 1], [PLOT_LEFT, gmDotCx], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const gmTrailY = interpolate(gmDotProgress, [0, 1], [PLOT_BOTTOM, gmDotCy], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: Math.min(enterOpacity, exitOpacity) }}>
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        {/* Dark backdrop */}
        <rect x={PLOT_LEFT - 20} y={PLOT_TOP - 40} width={PLOT_W + 40} height={PLOT_H + 100} rx={12} fill="rgba(10,10,10,0.85)" />

        {/* Grid lines */}
        {X_TICKS.map((tick) => {
          const px = xPx(tick);
          return (
            <line
              key={`gx-${tick}`}
              x1={px}
              y1={PLOT_TOP}
              x2={px}
              y2={PLOT_BOTTOM}
              stroke="rgba(250,250,250,0.08)"
              strokeWidth={1}
              opacity={gridOpacity / 0.15}
              strokeDasharray="4 4"
            />
          );
        })}
        {Y_TICKS.map((tick) => {
          const py = yPx(tick);
          return (
            <line
              key={`gy-${tick}`}
              x1={PLOT_LEFT}
              y1={py}
              x2={PLOT_RIGHT}
              y2={py}
              stroke="rgba(250,250,250,0.08)"
              strokeWidth={1}
              opacity={gridOpacity / 0.15}
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Axes */}
        <line
          x1={PLOT_LEFT}
          y1={PLOT_BOTTOM}
          x2={PLOT_LEFT + PLOT_W * axisProgress}
          y2={PLOT_BOTTOM}
          stroke="rgba(250,250,250,0.5)"
          strokeWidth={2}
        />
        <line
          x1={PLOT_LEFT}
          y1={PLOT_BOTTOM}
          x2={PLOT_LEFT}
          y2={PLOT_BOTTOM - PLOT_H * axisProgress}
          stroke="rgba(250,250,250,0.5)"
          strokeWidth={2}
        />

        {/* X-axis labels */}
        {X_TICKS.map((tick, i) => {
          const px = xPx(tick);
          return (
            <text
              key={`xl-${tick}`}
              x={px}
              y={PLOT_BOTTOM + 28}
              textAnchor="middle"
              fill="rgba(250,250,250,0.45)"
              fontSize={13}
              fontFamily={monoFont}
              opacity={axisProgress}
            >
              {X_LABELS[i]}
            </text>
          );
        })}

        {/* Y-axis labels */}
        {Y_TICKS.map((tick, i) => {
          const py = yPx(tick);
          return (
            <text
              key={`yl-${tick}`}
              x={PLOT_LEFT - 14}
              y={py + 4}
              textAnchor="end"
              fill="rgba(250,250,250,0.45)"
              fontSize={13}
              fontFamily={monoFont}
              opacity={axisProgress}
            >
              {Y_LABELS[i]}
            </text>
          );
        })}

        {/* Axis titles */}
        <text
          x={PLOT_LEFT + PLOT_W / 2}
          y={PLOT_BOTTOM + 56}
          textAnchor="middle"
          fill="rgba(250,250,250,0.55)"
          fontSize={16}
          fontFamily={font}
          fontWeight={600}
          opacity={axisProgress}
        >
          Markets traded / day
        </text>
        <text
          x={PLOT_LEFT - 60}
          y={PLOT_TOP + PLOT_H / 2}
          textAnchor="middle"
          fill="rgba(250,250,250,0.55)"
          fontSize={16}
          fontFamily={font}
          fontWeight={600}
          opacity={axisProgress}
          transform={`rotate(-90 ${PLOT_LEFT - 60} ${PLOT_TOP + PLOT_H / 2})`}
        >
          Edge needed per market
        </text>

        {/* Shaded area: Traditional (small rectangle) */}
        <rect
          x={PLOT_LEFT}
          y={tradDotCy}
          width={tradDotCx - PLOT_LEFT}
          height={PLOT_BOTTOM - tradDotCy}
          fill="rgba(239,68,68,0.12)"
          opacity={areaOpacity}
        />

        {/* Shaded area: GM (large rectangle) */}
        <rect
          x={PLOT_LEFT}
          y={gmDotCy}
          width={gmDotCx - PLOT_LEFT}
          height={PLOT_BOTTOM - gmDotCy}
          fill={`${BRAND_GREEN}18`}
          opacity={areaOpacity}
        />

        {/* Traditional dot trail */}
        {tradDotProgress > 0 && (
          <line
            x1={PLOT_LEFT}
            y1={PLOT_BOTTOM}
            x2={tradTrailX}
            y2={tradTrailY}
            stroke="#ef4444"
            strokeWidth={2}
            opacity={0.5}
            strokeDasharray="4 3"
          />
        )}

        {/* GM dot trail */}
        {gmDotProgress > 0 && (
          <line
            x1={PLOT_LEFT}
            y1={PLOT_BOTTOM}
            x2={gmTrailX}
            y2={gmTrailY}
            stroke={BRAND_GREEN}
            strokeWidth={2}
            opacity={0.5}
            strokeDasharray="4 3"
          />
        )}

        {/* Traditional dot */}
        <circle
          cx={tradTrailX}
          cy={tradTrailY}
          r={interpolate(tradDotProgress, [0.5, 1], [0, 10], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          fill="#ef4444"
          opacity={tradDotProgress}
        />
        {tradDotProgress > 0.8 && (
          <text
            x={tradDotCx + 16}
            y={tradDotCy - 16}
            fill="#ef4444"
            fontSize={14}
            fontFamily={monoFont}
            fontWeight={700}
            opacity={interpolate(tradDotProgress, [0.8, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          >
            Traditional (100, 10%)
          </text>
        )}

        {/* GM dot */}
        <circle
          cx={gmTrailX}
          cy={gmTrailY}
          r={interpolate(gmDotProgress, [0.5, 1], [0, 12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          fill={BRAND_GREEN}
          opacity={gmDotProgress}
        />
        {/* GM dot glow */}
        {gmDotProgress > 0.5 && (
          <circle
            cx={gmDotCx}
            cy={gmDotCy}
            r={18 + 4 * Math.sin(frame * 0.15)}
            fill="none"
            stroke={BRAND_GREEN}
            strokeWidth={1.5}
            opacity={gmDotProgress * 0.4}
          />
        )}
        {gmDotProgress > 0.8 && (
          <text
            x={gmDotCx - 16}
            y={gmDotCy - 20}
            fill={BRAND_GREEN}
            fontSize={14}
            fontFamily={monoFont}
            fontWeight={700}
            textAnchor="end"
            opacity={interpolate(gmDotProgress, [0.8, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          >
            GM (10M, 0.01%)
          </text>
        )}

        {/* "QUANTITY &gt; QUALITY" label above GM area */}
        <text
          x={gmDotCx - 200}
          y={gmDotCy - 50}
          fill={BRAND_GREEN}
          fontSize={26}
          fontFamily={font}
          fontWeight={800}
          letterSpacing={3}
          opacity={labelOpacity}
        >
          QUANTITY &gt; QUALITY
        </text>
      </svg>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main composition — MoatDiagrams
// ---------------------------------------------------------------------------

export const MoatDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* 1. Market Overwhelm (0s-10.9s local) */}
      <Sequence from={OVERWHELM_IN} durationInFrames={OVERWHELM_OUT - OVERWHELM_IN}>
        <MarketOverwhelm />
      </Sequence>

      {/* 2. Single vs All Paradigm (10.9s-18.1s local) */}
      <Sequence from={PARADIGM_IN} durationInFrames={PARADIGM_OUT - PARADIGM_IN}>
        <SingleVsAllParadigm />
        <Audio src={staticFile("sfx/text-appear-blip.mp3")} volume={0.6} startFrom={sec(4)} />
      </Sequence>

      {/* 3. Scatter Plot (18.1s-22.8s local) */}
      <Sequence from={SCATTER_IN} durationInFrames={SCATTER_OUT - SCATTER_IN}>
        <ScatterPlot />
        <Audio src={staticFile("sfx/drop-cinematic-hit.mp3")} volume={0.65} startFrom={0} />
      </Sequence>
    </AbsoluteFill>
  );
};
