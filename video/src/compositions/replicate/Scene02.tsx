import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

/**
 * Scene 02 — Public.com product showcase (Round 2 final)
 * 364 frames at 29fps (~12.5s)
 *
 * Segments:
 * 1. Stocks      (0-52)
 * 2. ETFs        (52-100)
 * 3. Crypto      (100-148)
 * 4. Treasuries  (148-210)
 * 5. "with even more→" + phones (210-258)
 * 6. "One place" glass text      (258-292)
 * 7. "build your portfolio→"     (292-326)
 * 8. "the way you want." + phone (326-364)
 */

const C = {
  bg: "#F5F5F7",
  navy: "#1B1B3A",
  blue: "#2845E0",
  green: "#22C55E",
  red: "#EF4444",
  card: "#FFFFFF",
};

const F = {
  h: "'SF Pro Display', 'Helvetica Neue', Arial, sans-serif",
  b: "'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
};

const CL = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/* ─── Arrow ─── */
const Arrow: React.FC<{ opacity: number; size?: number }> = ({ opacity, size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" style={{ opacity, flexShrink: 0 }}>
    <path
      d="M5 14h16M15 8l6 6-6 6"
      stroke={C.blue}
      strokeWidth={2.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ─── Sparkline ─── */
const Spark: React.FC<{
  w?: number;
  h?: number;
  pts?: number[];
  color?: string;
  sw?: number;
  fill?: boolean;
}> = ({ w = 60, h = 24, pts = [4, 8, 6, 12, 10, 16, 14, 18, 15, 20], color = C.green, sw = 1.5, fill = false }) => {
  const mx = Math.max(...pts);
  const mn = Math.min(...pts);
  const r = mx - mn || 1;
  const d = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((p - mn) / r) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  const fillD = d + `L${w},${h}L0,${h}Z`;
  return (
    <svg width={w} height={h}>
      {fill && <path d={fillD} fill={`${color}15`} />}
      <path d={d} stroke={color} strokeWidth={sw} fill="none" />
    </svg>
  );
};

/* ─── CSS Iridescent Glass Orb ─── */
const GlassOrb: React.FC<{
  sz: number;
  x: number;
  y: number;
  op: number;
  rot?: number;
  frame?: number;
}> = ({ sz, x, y, op, rot = 0, frame = 0 }) => {
  const shimmer = Math.sin(frame * 0.06) * 15;
  return (
    <div
      style={{
        position: "absolute",
        left: x - sz / 2,
        top: y - sz / 2,
        width: sz,
        height: sz,
        borderRadius: "50%",
        opacity: op,
        transform: `rotate(${rot}deg)`,
        filter: `drop-shadow(0 8px 24px rgba(140,120,200,0.2))`,
      }}
    >
      {/* Base shape */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at ${35 + shimmer * 0.3}% ${35 + shimmer * 0.2}%, rgba(255,255,255,0.85) 0%, rgba(220,210,245,0.5) 25%, rgba(190,180,230,0.35) 50%, rgba(170,160,215,0.25) 75%, rgba(160,150,210,0.15) 100%)`,
          boxShadow: `
            inset -${sz * 0.15}px -${sz * 0.1}px ${sz * 0.3}px rgba(140,120,200,0.25),
            inset ${sz * 0.05}px ${sz * 0.05}px ${sz * 0.2}px rgba(255,255,255,0.6),
            0 ${sz * 0.05}px ${sz * 0.15}px rgba(140,120,200,0.15)
          `,
        }}
      />
      {/* Iridescent overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `conic-gradient(from ${shimmer * 3}deg at 40% 40%,
            rgba(180,140,255,0.15) 0deg,
            rgba(140,200,255,0.2) 60deg,
            rgba(160,255,200,0.12) 120deg,
            rgba(255,200,150,0.1) 180deg,
            rgba(255,160,200,0.15) 240deg,
            rgba(180,140,255,0.15) 360deg)`,
          mixBlendMode: "overlay",
        }}
      />
      {/* Specular highlight */}
      <div
        style={{
          position: "absolute",
          left: "20%",
          top: "12%",
          width: "35%",
          height: "25%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%)",
        }}
      />
      {/* Rim light */}
      <div
        style={{
          position: "absolute",
          inset: 2,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.4)",
        }}
      />
    </div>
  );
};

/* ─── CSS Iridescent Glass Donut (ETFs) — segmented glass blocks in ring ─── */
const GlassDonut: React.FC<{
  sz: number;
  x: number;
  y: number;
  op: number;
  rot?: number;
  frame?: number;
}> = ({ sz, x, y, op, rot = 0, frame = 0 }) => {
  const shimmer = Math.sin(frame * 0.05) * 10;
  const segments = 8;
  const ringR = sz * 0.34; // radius of the ring center
  const blockW = sz * 0.18;
  const blockH = sz * 0.22;
  return (
    <div
      style={{
        position: "absolute",
        left: x - sz / 2,
        top: y - sz / 2,
        width: sz,
        height: sz,
        opacity: op,
        transform: `rotate(${rot}deg) perspective(500px) rotateX(30deg)`,
        filter: `drop-shadow(0 16px 40px rgba(140,120,200,0.22))`,
      }}
    >
      {Array.from({ length: segments }).map((_, i) => {
        const angle = (i / segments) * 360;
        const rad = (angle * Math.PI) / 180;
        const cx = sz / 2 + Math.cos(rad) * ringR - blockW / 2;
        const cy = sz / 2 + Math.sin(rad) * ringR - blockH / 2;
        const hue = (angle + shimmer * 4) % 360;
        // Blocks further from viewer (top) are slightly darker
        const depth = Math.sin(rad) * 0.15 + 0.85;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              width: blockW,
              height: blockH,
              borderRadius: blockW * 0.25,
              transform: `rotate(${angle + 90}deg)`,
              background: `linear-gradient(${180 + shimmer}deg,
                hsla(${hue}, 40%, 82%, ${depth * 0.8}) 0%,
                hsla(${(hue + 40) % 360}, 35%, 78%, ${depth * 0.6}) 50%,
                hsla(${(hue + 80) % 360}, 30%, 75%, ${depth * 0.7}) 100%)`,
              boxShadow: `
                inset -3px -2px 8px rgba(140,120,200,0.2),
                inset 2px 2px 6px rgba(255,255,255,0.5),
                0 2px 6px rgba(140,120,200,0.1)
              `,
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          />
        );
      })}
    </div>
  );
};

/* ─── CSS Glass Pillar (Treasuries) ─── */
const GlassPillar: React.FC<{
  w: number;
  h: number;
  x: number;
  y: number;
  op: number;
  frame?: number;
}> = ({ w, h, x, y, op, frame = 0 }) => {
  const shimmer = Math.sin(frame * 0.04) * 8;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: op,
        filter: `drop-shadow(0 10px 30px rgba(140,120,200,0.2))`,
        transform: "perspective(500px) rotateY(-5deg)",
      }}
    >
      {/* Column body */}
      <div
        style={{
          position: "absolute",
          left: w * 0.1,
          top: w * 0.3,
          width: w * 0.8,
          height: h - w * 0.6,
          borderRadius: 6,
          background: `linear-gradient(${90 + shimmer}deg,
            rgba(210,200,240,0.6),
            rgba(190,180,225,0.4) 30%,
            rgba(220,210,245,0.5) 50%,
            rgba(180,170,215,0.35) 70%,
            rgba(200,190,235,0.5))`,
          boxShadow: `
            inset -8px 0 20px rgba(160,140,200,0.2),
            inset 4px 0 12px rgba(255,255,255,0.3)
          `,
        }}
      >
        {/* Fluting lines */}
        {[0.25, 0.42, 0.58, 0.75].map((r) => (
          <div
            key={r}
            style={{
              position: "absolute",
              left: `${r * 100}%`,
              top: 8,
              width: 1,
              height: "calc(100% - 16px)",
              background: `linear-gradient(180deg, rgba(255,255,255,0.3), rgba(180,170,220,0.2), rgba(255,255,255,0.3))`,
            }}
          />
        ))}
        {/* Iridescent overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 6,
            background: `linear-gradient(${180 + shimmer * 2}deg,
              rgba(180,140,255,0.1),
              rgba(140,200,255,0.08),
              rgba(255,180,200,0.1))`,
            mixBlendMode: "overlay",
          }}
        />
      </div>
      {/* Capital (top) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: w,
          height: w * 0.22,
          borderRadius: 4,
          background: `linear-gradient(180deg, rgba(220,210,245,0.6), rgba(200,190,235,0.4))`,
          boxShadow: "inset 0 2px 6px rgba(255,255,255,0.4), 0 3px 8px rgba(140,120,200,0.1)",
        }}
      />
      {/* Base (bottom) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: w,
          height: w * 0.22,
          borderRadius: 4,
          background: `linear-gradient(0deg, rgba(220,210,245,0.6), rgba(200,190,235,0.4))`,
          boxShadow: "inset 0 -2px 6px rgba(255,255,255,0.4), 0 3px 8px rgba(140,120,200,0.1)",
        }}
      />
    </div>
  );
};

/* ─── Stock Card ─── */
const StockCard: React.FC<{
  name: string;
  ticker: string;
  price: string;
  x: number;
  y: number;
  opacity: number;
  scale?: number;
  pts?: number[];
  ic?: string;
  z?: number;
}> = ({ name, ticker, price, x, y, opacity, scale = 1, pts, ic = "#6B7AED", z = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity,
      background: C.card,
      borderRadius: 16,
      padding: "10px 14px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      transform: `scale(${scale})`,
      zIndex: z,
    }}
  >
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        background: ic,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: F.b,
        boxShadow: `0 2px 8px ${ic}40`,
      }}
    >
      {ticker.charAt(0)}
    </div>
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, fontFamily: F.b, whiteSpace: "nowrap" }}>
        {name}
      </div>
      <div style={{ fontSize: 10, color: "#999", fontFamily: F.b }}>{ticker}</div>
    </div>
    <div style={{ textAlign: "right", marginLeft: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.navy, fontFamily: F.b }}>{price}</div>
      <Spark w={40} h={16} pts={pts} />
    </div>
  </div>
);

/* ─── Info Card ─── */
const InfoCard: React.FC<{
  title: string;
  sub?: string;
  val?: string;
  badge?: string;
  badgeColor?: string;
  x: number;
  y: number;
  op: number;
  scale?: number;
  w?: number;
  ic?: string;
  chart?: boolean;
  chartPts?: number[];
}> = ({ title, sub, val, badge, badgeColor = C.green, x, y, op, scale = 1, w = 180, ic = "#6B7AED", chart, chartPts }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity: op,
      background: C.card,
      borderRadius: 16,
      padding: "12px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
      width: w,
      transform: `scale(${scale})`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          background: ic,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          fontFamily: F.b,
          boxShadow: `0 2px 8px ${ic}40`,
        }}
      >
        {title.charAt(0)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, fontFamily: F.b }}>{title}</div>
        {sub && <div style={{ fontSize: 10, color: "#999", fontFamily: F.b }}>{sub}</div>}
      </div>
    </div>
    {chart && (
      <div style={{ marginTop: 8 }}>
        <Spark w={w - 32} h={36} pts={chartPts || [10, 12, 11, 14, 13, 16, 15, 18, 17, 20]} color={C.green} fill />
      </div>
    )}
    {val && (
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: C.navy, fontFamily: F.h }}>{val}</span>
        {badge && (
          <span style={{ fontSize: 10, fontWeight: 600, color: badgeColor, fontFamily: F.b }}>{badge}</span>
        )}
      </div>
    )}
  </div>
);

/* ─── Holdings Card ─── */
const HoldingsCard: React.FC<{ x: number; y: number; op: number; scale?: number }> = ({ x, y, op, scale = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity: op,
      background: C.card,
      borderRadius: 16,
      padding: "12px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
      width: 185,
      transform: `scale(${scale})`,
    }}
  >
    <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, fontFamily: F.b, marginBottom: 10 }}>Holdings</div>
    {[
      { name: "Treasury bill", pct: 60, color: "#3949AB" },
      { name: "Treasury bill", pct: 30, color: "#5C6BC0" },
      { name: "Cash", pct: 10, color: "#9FA8DA" },
    ].map((item, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 7, height: 7, borderRadius: 4, background: item.color }} />
        <div style={{ fontSize: 10, color: C.navy, fontFamily: F.b, flex: 1 }}>{item.name}</div>
        <div style={{ width: 55, height: 5, background: "#f0f0f0", borderRadius: 3 }}>
          <div style={{ width: `${item.pct}%`, height: 5, background: item.color, borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 9, color: "#999", fontFamily: F.b, width: 26, textAlign: "right" }}>{item.pct}%</div>
      </div>
    ))}
  </div>
);

/* ─── Phone Mockup ─── */
const Phone: React.FC<{
  w?: number;
  h?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ w = 160, h = 310, children, style }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: w * 0.14,
      background: "#fff",
      boxShadow: "0 12px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
      overflow: "hidden",
      position: "relative",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: w * 0.3,
        height: 18,
        borderRadius: "0 0 12px 12px",
        background: "#000",
        zIndex: 5,
      }}
    />
    {children}
  </div>
);

/* ─── Desktop Mockup ─── */
const Desktop: React.FC<{
  w?: number;
  h?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ w = 420, h = 260, children, style }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", ...style }}>
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 12,
        background: "#fff",
        boxShadow: "0 12px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          height: 24,
          background: "#f8f8f8",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          gap: 5,
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 8, height: 8, borderRadius: 4, background: c }} />
        ))}
      </div>
      <div style={{ display: "flex", height: h - 24 }}>
        <div style={{ width: 65, borderRight: "1px solid #f0f0f0", padding: "10px 8px" }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: C.blue,
              margin: "0 auto 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              fontFamily: F.b,
            }}
          >
            P
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 34,
                height: 4,
                background: i === 0 ? C.navy : "#eee",
                borderRadius: 2,
                margin: "0 auto 7px",
              }}
            />
          ))}
        </div>
        <div style={{ flex: 1, padding: 12 }}>{children}</div>
      </div>
    </div>
    <div style={{ width: 55, height: 20, background: "linear-gradient(180deg, #d0d0d0, #e0e0e0)", borderRadius: "0 0 4px 4px" }} />
    <div style={{ width: 110, height: 6, background: "#d0d0d0", borderRadius: 3 }} />
  </div>
);

/* ─── Background panel chart ─── */
const PanelChart: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const pts = [20, 22, 18, 24, 21, 28, 25, 30, 27, 32, 29, 35, 31, 38, 34, 40, 36, 42, 39, 44];
  const mx = Math.max(...pts);
  const mn = Math.min(...pts);
  const r = mx - mn || 1;
  const d = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((p - mn) / r) * (h * 0.5) - h * 0.25;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, opacity: 0.3 }}>
      <path d={d} stroke="rgba(180,170,210,0.4)" strokeWidth={1.5} fill="none" />
    </svg>
  );
};

/* ─── Background dots ─── */
const BgDots: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity,
      backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)",
      backgroundSize: "24px 24px",
    }}
  />
);

/* ─── Showcase Panel ─── */
const Showcase: React.FC<{
  frame: number;
  fps: number;
  start: number;
  dur: number;
  label: string;
  glass: React.ReactNode;
  cards: React.ReactNode;
}> = ({ frame, fps, start, dur, label, glass, cards }) => {
  const lf = frame - start;
  const enter = spring({ frame: lf, fps, config: { damping: 14, mass: 0.6, stiffness: 120 }, durationInFrames: 18 });
  const exit = spring({ frame: lf - (dur - 14), fps, config: { damping: 200 }, durationInFrames: 14 });
  const op = Math.min(enter, 1) * (1 - exit);
  const tx = interpolate(enter, [0, 1], [40, 0]) + interpolate(exit, [0, 1], [0, -40]);
  const arrowOp = interpolate(lf, [dur * 0.4, dur * 0.55], [0, 1], CL) * (1 - exit);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: op, transform: `translateX(${tx}px)` }}>
      <BgDots opacity={0.5} />
      {/* Panel */}
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 80,
          width: 460,
          height: 420,
          borderRadius: 24,
          background: "rgba(255,255,255,0.7)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.06)",
          backdropFilter: "blur(12px)",
          overflow: "hidden",
        }}
      >
        <PanelChart w={460} h={420} />
      </div>
      {/* Glass objects */}
      {glass}
      {/* Cards */}
      {cards}
      {/* Label */}
      <div style={{ position: "absolute", right: 95, top: "50%", transform: "translateY(-50%)" }}>
        <div style={{ fontSize: 68, fontWeight: 700, color: C.navy, fontFamily: F.h, letterSpacing: -1.5 }}>
          {label}
        </div>
        <div style={{ marginTop: 6 }}>
          <Arrow opacity={arrowOp} size={32} />
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════ MAIN SCENE ═══════════════════════ */

export const Scene02: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sp = (f: number) => spring({ frame: f, fps, config: { damping: 14, mass: 0.6 } });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>

      {/* ── 1. Stocks (0-52) ── */}
      {frame < 64 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={0}
          dur={52}
          label="Stocks"
          glass={
            <GlassOrb
              sz={180}
              x={340}
              y={290}
              op={sp(frame - 2)}
              rot={interpolate(frame, [0, 52], [0, 15], CL)}
              frame={frame}
            />
          }
          cards={
            <>
              <StockCard
                name="Green Waters"
                ticker="GREW"
                price="$345.42"
                x={250}
                y={120}
                opacity={sp(frame - 4)}
                scale={sp(frame - 4)}
                pts={[4, 6, 5, 8, 7, 10, 9, 12, 11, 14]}
                ic="#4CAF50"
                z={3}
              />
              <StockCard
                name="StandFindr"
                ticker="STF"
                price="$51.55"
                x={130}
                y={320}
                opacity={sp(frame - 7)}
                scale={sp(frame - 7)}
                pts={[3, 5, 4, 7, 6, 5, 8, 9, 7, 10]}
                ic="#9C27B0"
                z={3}
              />
              <StockCard
                name="Fly Fit"
                ticker="FLF"
                price="$254.24"
                x={320}
                y={410}
                opacity={sp(frame - 10)}
                scale={sp(frame - 10)}
                pts={[6, 8, 7, 10, 12, 11, 14, 13, 16, 15]}
                ic="#FF9800"
                z={3}
              />
            </>
          }
        />
      )}

      {/* ── 2. ETFs (52-100) ── */}
      {frame >= 40 && frame < 112 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={52}
          dur={48}
          label="ETFs"
          glass={
            <GlassDonut
              sz={240}
              x={340}
              y={290}
              op={sp(frame - 54)}
              rot={interpolate(frame, [52, 100], [0, 25], CL)}
              frame={frame}
            />
          }
          cards={
            <>
              <InfoCard
                title="Citizen S&P 500 ETF"
                val="$300.25"
                badge="+2.1%"
                x={160}
                y={115}
                op={sp(frame - 55)}
                scale={sp(frame - 55)}
                w={210}
                ic="#2196F3"
                chart
                chartPts={[8, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20]}
              />
              <InfoCard
                title="Citizen S&P 500 is Up"
                x={280}
                y={420}
                op={sp(frame - 60)}
                scale={sp(frame - 60)}
                w={210}
                ic="#FFC107"
              />
            </>
          }
        />
      )}

      {/* ── 3. Crypto (100-148) ── */}
      {frame >= 88 && frame < 160 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={100}
          dur={48}
          label="Crypto"
          glass={
            <>
              <GlassOrb sz={140} x={340} y={260} op={sp(frame - 102) * 0.9} rot={0} frame={frame} />
              <GlassOrb sz={90} x={280} y={350} op={sp(frame - 104) * 0.7} rot={0} frame={frame} />
              <GlassOrb sz={65} x={420} y={370} op={sp(frame - 106) * 0.6} rot={0} frame={frame} />
            </>
          }
          cards={
            <>
              <InfoCard title="Bitcoin" sub="BTC" x={155} y={115} op={sp(frame - 103)} scale={sp(frame - 103)} w={140} ic="#F7931A" />
              <InfoCard title="Solana" sub="SOL" x={130} y={370} op={sp(frame - 107)} scale={sp(frame - 107)} w={130} ic="#00D18C" />
              <InfoCard title="Ethereum" sub="ETH" x={350} y={390} op={sp(frame - 110)} scale={sp(frame - 110)} w={140} ic="#627EEA" />
            </>
          }
        />
      )}

      {/* ── 4. Treasuries (148-210) ── */}
      {frame >= 136 && frame < 222 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={148}
          dur={62}
          label="Treasuries"
          glass={
            <GlassPillar
              w={90}
              h={240}
              x={295}
              y={160}
              op={sp(frame - 150)}
              frame={frame}
            />
          }
          cards={
            <>
              <InfoCard
                title="Treasury Account"
                val="$5,585.00"
                badge="+3.44%"
                x={270}
                y={110}
                op={sp(frame - 151)}
                scale={sp(frame - 151)}
                w={220}
                ic="#5C6BC0"
              />
              <HoldingsCard
                x={140}
                y={340}
                op={sp(frame - 158)}
                scale={sp(frame - 158)}
              />
            </>
          }
        />
      )}

      {/* ── 5. "with even more→" + phones (210-258) ── */}
      {frame >= 202 && frame < 266 && (() => {
        const lf = frame - 210;
        const en = sp(lf);
        const ex = spring({ frame: lf - 40, fps, config: { damping: 200 }, durationInFrames: 12 });
        const op = en * (1 - ex);
        const phoneLabels = ["Commercial Real Estate", "The Rare Sneaker Portfolio", "Music Royalties"];
        const phoneColors = ["#4A90D9", "#E91E63", "#9C27B0"];
        const phonePrices = ["$1,289.43", "$345.55", "$492.15"];
        const phonePts = [
          [2, 4, 3, 6, 5, 8, 7, 10, 9, 12],
          [10, 8, 9, 6, 7, 4, 5, 3, 4, 2],
          [4, 6, 8, 6, 9, 7, 10, 12, 10, 14],
        ];
        return (
          <div style={{ position: "absolute", inset: 0, opacity: op }}>
            <BgDots opacity={0.4} />
            <div
              style={{
                position: "absolute",
                left: 80,
                top: "50%",
                transform: `translateY(-50%) translateX(${interpolate(en, [0, 1], [-20, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 52, fontWeight: 700, color: C.navy, fontFamily: F.h, lineHeight: 1.1 }}>
                with even
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 52, fontWeight: 700, color: C.navy, fontFamily: F.h }}>more</span>
                <Arrow opacity={interpolate(lf, [14, 22], [0, 1], CL)} size={32} />
              </div>
            </div>
            {[0, 1, 2].map((i) => {
              const pEn = spring({ frame: lf - i * 4, fps, config: { damping: 14, mass: 0.6, stiffness: 110 } });
              return (
                <Phone
                  key={i}
                  w={155}
                  h={300}
                  style={{
                    position: "absolute",
                    left: 440 + i * 150,
                    top: interpolate(pEn, [0, 1], [420, 180]),
                    opacity: pEn,
                    transform: `perspective(800px) rotateY(${[-4, 0, 4][i]}deg) rotate(${[-2, 0, 2][i]}deg)`,
                    zIndex: 3 - i,
                    filter: i === 2 ? "blur(1px)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: 100,
                      background: `linear-gradient(135deg, ${phoneColors[i]}, ${phoneColors[i]}dd)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: F.b, textAlign: "center", padding: "0 14px", marginTop: 12 }}>
                      {phoneLabels[i]}
                    </div>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    <Spark w={118} h={44} color={phoneColors[i]} pts={phonePts[i]} fill />
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.navy, fontFamily: F.h, marginTop: 8 }}>{phonePrices[i]}</div>
                    <div style={{ fontSize: 10, color: i === 1 ? C.red : C.green, fontFamily: F.b, marginTop: 2 }}>
                      {i === 1 ? "-5.29%" : "+1.32%"}
                    </div>
                  </div>
                </Phone>
              );
            })}
          </div>
        );
      })()}

      {/* ── 6. "One place" glass text (258-292) ── */}
      {frame >= 250 && frame < 300 && (() => {
        const lf = frame - 258;
        const en = sp(lf);
        const ex = spring({ frame: lf - 28, fps, config: { damping: 200 }, durationInFrames: 10 });
        const op = en * (1 - ex);
        const sc = interpolate(en, [0, 1], [0.9, 1]);
        const shimmer = Math.sin(frame * 0.08) * 10;
        return (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              opacity: op,
              transform: `scale(${sc})`,
            }}
          >
            <div style={{ position: "relative" }}>
              {/* Glass fill layer */}
              <div
                style={{
                  fontSize: 195,
                  fontWeight: 700,
                  fontFamily: F.h,
                  letterSpacing: -6,
                  lineHeight: 1,
                  color: "transparent",
                  background: `linear-gradient(${140 + shimmer}deg,
                    rgba(210,200,240,0.35) 0%,
                    rgba(190,180,230,0.2) 25%,
                    rgba(220,210,245,0.15) 45%,
                    rgba(180,170,220,0.25) 65%,
                    rgba(200,190,235,0.3) 100%)`,
                  WebkitBackgroundClip: "text",
                  filter: "drop-shadow(0 6px 20px rgba(160,150,200,0.15))",
                }}
              >
                One
              </div>
              {/* Stroke overlay for glass edge */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  fontSize: 195,
                  fontWeight: 700,
                  fontFamily: F.h,
                  letterSpacing: -6,
                  lineHeight: 1,
                  color: "transparent",
                  WebkitTextStroke: "3px rgba(190,180,225,0.55)",
                }}
              >
                One
              </div>
              {/* Inner highlight */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  fontSize: 195,
                  fontWeight: 700,
                  fontFamily: F.h,
                  letterSpacing: -6,
                  lineHeight: 1,
                  color: "transparent",
                  WebkitTextStroke: "1px rgba(255,255,255,0.3)",
                  transform: "translate(-1px, -1px)",
                }}
              >
                One
              </div>
            </div>
            <div
              style={{
                fontSize: 95,
                fontWeight: 700,
                fontFamily: F.h,
                color: C.blue,
                marginTop: -42,
                letterSpacing: -3,
                textShadow: "0 2px 20px rgba(40,69,224,0.15)",
              }}
            >
              place
            </div>
          </div>
        );
      })()}

      {/* ── 7. "build your portfolio→" (292-326) ── */}
      {frame >= 284 && frame < 332 && (() => {
        const lf = frame - 292;
        const en = sp(lf);
        const ex = spring({ frame: lf - 28, fps, config: { damping: 200 }, durationInFrames: 10 });
        const op = en * (1 - ex);
        return (
          <div style={{ position: "absolute", inset: 0, opacity: op }}>
            <BgDots opacity={0.3} />
            <div
              style={{
                position: "absolute",
                left: 50,
                top: "50%",
                transform: `translateY(-50%) translateX(${interpolate(en, [0, 1], [-25, 0])}px)`,
              }}
            >
              <Desktop w={420} h={250}>
                <div>
                  <div style={{ fontSize: 9, color: "#999", fontFamily: F.b, marginBottom: 2 }}>Portfolio</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.navy, fontFamily: F.h }}>$125,367.10</div>
                  <Spark w={320} h={75} color={C.green} pts={[20, 22, 21, 25, 24, 28, 30, 29, 34, 36, 35, 40, 38, 42, 45]} sw={2} fill />
                  <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                    {[
                      { l: "S", c: "#4CAF50" },
                      { l: "E", c: "#2196F3" },
                      { l: "C", c: "#F7931A" },
                      { l: "T", c: "#5C6BC0" },
                    ].map(({ l, c }) => (
                      <div
                        key={l}
                        style={{
                          width: 24, height: 24, borderRadius: 12, background: c,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 10, fontWeight: 600, fontFamily: F.b,
                          boxShadow: `0 2px 6px ${c}40`,
                        }}
                      >
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
              </Desktop>
              <Phone
                w={90}
                h={175}
                style={{
                  position: "absolute",
                  right: -50,
                  bottom: 25,
                  transform: `perspective(800px) rotateY(-5deg) translateY(${interpolate(sp(lf - 5), [0, 1], [30, 0])}px)`,
                  zIndex: 2,
                }}
              >
                <div style={{ padding: "22px 10px 8px" }}>
                  <Spark w={68} h={38} color={C.green} pts={[4, 6, 5, 8, 10, 12, 11, 15]} fill />
                </div>
              </Phone>
            </div>
            <div
              style={{
                position: "absolute",
                right: 70,
                top: "50%",
                transform: `translateY(-50%) translateX(${interpolate(en, [0, 1], [20, 0])}px)`,
                textAlign: "right",
              }}
            >
              <div style={{ fontSize: 46, fontWeight: 700, color: C.navy, fontFamily: F.h, lineHeight: 1.15 }}>build your</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                <span style={{ fontSize: 46, fontWeight: 700, color: C.navy, fontFamily: F.h }}>portfolio</span>
                <Arrow opacity={interpolate(lf, [12, 18], [0, 1], CL)} size={32} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 8. "the way you want." + phone (326-364) ── */}
      {frame >= 318 && (() => {
        const lf = frame - 326;
        const en = sp(lf);
        const phoneSpring = spring({ frame: lf, fps, config: { damping: 12, mass: 0.5, stiffness: 100 } });
        return (
          <div style={{ position: "absolute", inset: 0, opacity: en, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BgDots opacity={0.3} />
            <div style={{ position: "absolute", left: 60, top: "50%", transform: `translateY(-50%) translateX(${interpolate(en, [0, 1], [-20, 0])}px)` }}>
              <span style={{ fontSize: 54, fontWeight: 700, color: C.navy, fontFamily: F.h }}>the way</span>
            </div>
            <div style={{ position: "relative", zIndex: 2 }}>
              <Phone
                w={200}
                h={390}
                style={{ transform: `perspective(800px) rotateX(2deg) translateY(${interpolate(phoneSpring, [0, 1], [40, 0])}px)` }}
              >
                <div style={{ padding: "28px 16px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 9, color: "#999", fontFamily: F.b }}>Invest</div>
                    <div style={{ fontSize: 8, color: "#bbb", fontFamily: F.b }}>public</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.navy, fontFamily: F.h, marginTop: 2 }}>$125,367.10</div>
                  <div style={{ fontSize: 10, color: C.green, fontFamily: F.b, marginTop: 2 }}>Today +$4,321.50 (+3.69%)</div>
                  <Spark w={165} h={50} color={C.green} pts={[20, 22, 24, 23, 26, 25, 28, 30, 32, 34, 33, 36, 38, 40, 42]} sw={1.5} fill />
                  <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
                    {["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"].map((p, i) => (
                      <div key={p} style={{ fontSize: 8, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? C.navy : "#999", background: i === 0 ? "#f0f0f0" : "transparent", borderRadius: 6, padding: "2px 6px", fontFamily: F.b }}>
                        {p}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {[{ l: "S&P 500", v: "$45,102" }, { l: "Crypto", v: "$31,543" }, { l: "Treasury", v: "$5,841" }].map(({ l, v }) => (
                      <div key={l} style={{ flex: 1 }}>
                        <div style={{ fontSize: 7, color: "#999", fontFamily: F.b }}>{l}</div>
                        <div style={{ fontSize: 8, fontWeight: 600, color: C.navy, fontFamily: F.b, marginTop: 1 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 1, background: "#f0f0f0", margin: "10px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: F.b }}>
                    <span style={{ color: "#999" }}>Buying power</span>
                    <span style={{ color: C.navy, fontWeight: 600 }}>$1,231.40</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {["Deposit", "Invest"].map((btn) => (
                      <div key={btn} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: 10, background: btn === "Invest" ? C.navy : "#f5f5f5", color: btn === "Invest" ? "#fff" : C.navy, fontSize: 10, fontWeight: 600, fontFamily: F.b }}>
                        {btn}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, background: "#f8f8fa", borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, color: "#999", fontFamily: F.b }}>Account action</div>
                    <div style={{ fontSize: 9, color: C.navy, fontFamily: F.b, marginTop: 2 }}>Transfer an existing portfolio into Public</div>
                    <div style={{ fontSize: 9, color: C.green, fontFamily: F.b, marginTop: 4, fontWeight: 600 }}>Transfer a portfolio</div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 600, color: C.navy, fontFamily: F.b }}>
                    <span>Assets</span>
                    <span style={{ color: C.blue, fontSize: 9 }}>Price &#8593;</span>
                  </div>
                </div>
              </Phone>
              <div style={{ position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)", width: 160, height: 20, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,0,0,0.08) 0%, transparent 70%)" }} />
            </div>
            <div style={{ position: "absolute", right: 60, top: "50%", transform: `translateY(-50%) translateX(${interpolate(en, [0, 1], [20, 0])}px)` }}>
              <span style={{ fontSize: 54, fontWeight: 700, color: C.navy, fontFamily: F.h }}>you want.</span>
            </div>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};

export const scene02Meta = {
  id: "ReplicateScene02",
  component: Scene02,
  width: 1280,
  height: 720,
  fps: 29,
  durationInFrames: 364,
};
