import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

// Quadratic bezier helper: (1-t)^2*P0 + 2(1-t)*t*P1 + t^2*P2
const _bezier2 = (t: number, p0: number, p1: number, p2: number) =>
  (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
void _bezier2;

/**
 * Scene 02 — Public.com product showcase (Round 4 — SSIM-verified)
 * 364 frames at 29fps (~12.5s)
 *
 * Segments (re-timed to match reference):
 * 1. Stocks      (0-28)
 * 2. ETFs        (28-68)
 * 3. Crypto      (68-96)
 * 4. Treasuries  (96-152)
 * 5. "with even more→" + phones (152-212)
 * 6. "One place" glass text      (212-258)
 * 7. "build your portfolio→"     (258-308)
 * 8. "the way you want." + phone (308-364)
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

/* ─── Sparkline (with progressive draw) ─── */
const Spark: React.FC<{
  w?: number;
  h?: number;
  pts?: number[];
  color?: string;
  sw?: number;
  fill?: boolean;
  drawProgress?: number; // 0-1, undefined = fully drawn
}> = ({ w = 60, h = 24, pts = [4, 8, 6, 12, 10, 16, 14, 18, 15, 20], color = C.green, sw = 1.5, fill = false, drawProgress }) => {
  const mx = Math.max(...pts);
  const mn = Math.min(...pts);
  const r = mx - mn || 1;
  const coords = pts.map((p, i) => ({
    x: (i / (pts.length - 1)) * w,
    y: h - ((p - mn) / r) * (h - 4) - 2,
  }));
  const prog = drawProgress !== undefined ? Math.max(0, Math.min(1, drawProgress)) : 1;
  const visibleCount = Math.max(2, Math.ceil(coords.length * prog));
  const visible = coords.slice(0, visibleCount);
  const d = visible.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const lastX = visible[visible.length - 1].x;
  const fillD = d + `L${lastX},${h}L0,${h}Z`;
  return (
    <svg width={w} height={h}>
      {fill && prog > 0.1 && <path d={fillD} fill={`${color}15`} opacity={prog} />}
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
  phase?: number;
  shimmerSpeed?: number;
}> = ({ sz, x, y, op, rot = 0, frame = 0, phase = 0, shimmerSpeed = 1 }) => {
  const f = frame + phase;
  const shimmer = Math.sin(f * 0.09 * shimmerSpeed) * 18;
  const shimmer2 = Math.cos(f * 0.07 * shimmerSpeed) * 12;
  const hlX = 22 + shimmer * 0.4;
  const hlY = 15 + shimmer2 * 0.3;
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
        filter: `drop-shadow(0 8px 24px rgba(140,120,200,0.25))`,
      }}
    >
      {/* Base shape */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at ${35 + shimmer * 0.3}% ${35 + shimmer2 * 0.2}%, rgba(255,255,255,0.88) 0%, rgba(220,210,245,0.55) 22%, rgba(190,180,230,0.38) 48%, rgba(170,160,215,0.28) 72%, rgba(160,150,210,0.18) 100%)`,
          boxShadow: `
            inset -${sz * 0.15}px -${sz * 0.1}px ${sz * 0.3}px rgba(140,120,200,0.28),
            inset ${sz * 0.05}px ${sz * 0.05}px ${sz * 0.2}px rgba(255,255,255,0.65),
            0 ${sz * 0.05}px ${sz * 0.15}px rgba(140,120,200,0.18)
          `,
        }}
      />
      {/* Iridescent overlay — faster sweep */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `conic-gradient(from ${shimmer * 4}deg at ${38 + shimmer2 * 0.2}% ${38 + shimmer * 0.15}%,
            rgba(180,140,255,0.22) 0deg,
            rgba(120,200,255,0.25) 55deg,
            rgba(140,255,200,0.18) 115deg,
            rgba(255,210,140,0.15) 175deg,
            rgba(255,150,200,0.2) 235deg,
            rgba(200,160,255,0.18) 300deg,
            rgba(180,140,255,0.22) 360deg)`,
          mixBlendMode: "overlay",
        }}
      />
      {/* Secondary color band */}
      <div
        style={{
          position: "absolute",
          inset: "10%",
          borderRadius: "50%",
          background: `linear-gradient(${120 + shimmer * 3}deg,
            rgba(200,160,255,0.1) 0%,
            rgba(140,220,255,0.12) 50%,
            rgba(255,180,200,0.08) 100%)`,
          mixBlendMode: "color-dodge",
        }}
      />
      {/* Specular highlight — drifts */}
      <div
        style={{
          position: "absolute",
          left: `${hlX}%`,
          top: `${hlY}%`,
          width: "32%",
          height: "22%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 68%)",
        }}
      />
      {/* Rim light */}
      <div
        style={{
          position: "absolute",
          inset: 2,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.45)",
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
  const shimmer = Math.sin(frame * 0.065) * 16;
  const _shimmer2 = Math.cos(frame * 0.05) * 11;
  void _shimmer2;
  const segments = 8;
  const ringR = sz * 0.34;
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
  const breathe = Math.sin(frame * 0.03) * 0.012;
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
        transform: `perspective(500px) rotateY(-5deg) scale(${1 + breathe})`,
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
  drawProgress?: number;
  float?: number; // frame-based subtle hover
}> = ({ name, ticker, price, x, y, opacity, scale = 1, pts, ic = "#6B7AED", z = 1, drawProgress, float = 0 }) => {
  const fy = Math.sin(float * 0.08) * 2.5;
  const shadowBlur = 32 + Math.sin(float * 0.08) * 4;
  return (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y + fy,
      opacity,
      background: C.card,
      borderRadius: 16,
      padding: "10px 14px",
      boxShadow: `0 ${8 + fy}px ${shadowBlur}px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)`,
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
      <Spark w={40} h={16} pts={pts} drawProgress={drawProgress} />
    </div>
  </div>
  );
};

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
  chartDraw?: number;
}> = ({ title, sub, val, badge, badgeColor = C.green, x, y, op, scale = 1, w = 180, ic = "#6B7AED", chart, chartPts, chartDraw }) => (
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
        <Spark w={w - 32} h={36} pts={chartPts || [10, 12, 11, 14, 13, 16, 15, 18, 17, 20]} color={C.green} fill drawProgress={chartDraw} />
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
const PanelChart: React.FC<{ w: number; h: number; drawProgress?: number }> = ({ w, h, drawProgress = 1 }) => {
  const pts = [20, 22, 18, 24, 21, 28, 25, 30, 27, 32, 29, 35, 31, 38, 34, 40, 36, 42, 39, 44];
  const mx = Math.max(...pts);
  const mn = Math.min(...pts);
  const r = mx - mn || 1;
  const prog = Math.max(0, Math.min(1, drawProgress));
  const visCount = Math.max(2, Math.ceil(pts.length * prog));
  const visible = pts.slice(0, visCount);
  const d = visible
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((p - mn) / r) * (h * 0.5) - h * 0.25;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, opacity: 0.3 * prog }}>
      <path d={d} stroke="rgba(180,170,210,0.4)" strokeWidth={1.5} fill="none" />
    </svg>
  );
};

/* ─── Background dots (slowly drifting) ─── */
const BgDots: React.FC<{ opacity: number; frame?: number }> = ({ opacity, frame = 0 }) => {
  const dx = Math.sin(frame * 0.018) * 6;
  const dy = Math.cos(frame * 0.014) * 4.5;
  return (
    <div
      style={{
        position: "absolute",
        inset: -8,
        opacity,
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        backgroundPosition: `${dx}px ${dy}px`,
      }}
    />
  );
};

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
  const enter = spring({ frame: lf, fps, config: { damping: 13, mass: 0.5, stiffness: 130 }, durationInFrames: 15 });
  const exit = spring({ frame: lf - (dur - 10), fps, config: { damping: 200 }, durationInFrames: 10 });
  const op = Math.min(enter, 1) * (1 - exit);
  const tx = interpolate(enter, [0, 1], [35, 0]) + interpolate(exit, [0, 1], [0, -30]);
  const arrowOp = interpolate(lf, [dur * 0.3, dur * 0.42], [0, 1], CL) * (1 - exit);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: op, transform: `translateX(${tx}px)` }}>
      <BgDots opacity={0.5} frame={frame} />
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
        <PanelChart w={460} h={420} drawProgress={interpolate(lf, [4, 25], [0, 1], CL)} />
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

      {/* ── 1. Stocks (0-28) ── */}
      {frame < 38 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={0}
          dur={28}
          label="Stocks"
          glass={
            <GlassOrb
              sz={180}
              x={340}
              y={290}
              op={sp(frame - 1)}
              rot={interpolate(frame, [0, 28], [0, 15], CL)}
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
                opacity={sp(frame - 2)}
                scale={sp(frame - 2)}
                pts={[4, 6, 5, 8, 7, 10, 9, 12, 11, 14]}
                ic="#4CAF50"
                z={3}
                drawProgress={interpolate(frame, [4, 12], [0, 1], CL)}
                float={frame}
              />
              <StockCard
                name="StandFindr"
                ticker="STF"
                price="$51.55"
                x={130}
                y={320}
                opacity={sp(frame - 5)}
                scale={sp(frame - 5)}
                pts={[3, 5, 4, 7, 6, 5, 8, 9, 7, 10]}
                ic="#9C27B0"
                z={3}
                drawProgress={interpolate(frame, [7, 15], [0, 1], CL)}
                float={frame + 10}
              />
              <StockCard
                name="Fly Fit"
                ticker="FLF"
                price="$254.24"
                x={320}
                y={410}
                opacity={sp(frame - 8)}
                scale={sp(frame - 8)}
                pts={[6, 8, 7, 10, 12, 11, 14, 13, 16, 15]}
                ic="#FF9800"
                z={3}
                drawProgress={interpolate(frame, [10, 18], [0, 1], CL)}
                float={frame + 20}
              />
            </>
          }
        />
      )}

      {/* ── 2. ETFs (28-68) ── */}
      {frame >= 18 && frame < 78 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={28}
          dur={40}
          label="ETFs"
          glass={
            <GlassDonut
              sz={240}
              x={340}
              y={290}
              op={sp(frame - 30)}
              rot={interpolate(frame, [28, 68], [0, 25], CL)}
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
                op={sp(frame - 31)}
                scale={sp(frame - 31)}
                w={210}
                ic="#2196F3"
                chart
                chartPts={[8, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20]}
                chartDraw={interpolate(frame, [34, 48], [0, 1], CL)}
              />
              <InfoCard
                title="Citizen S&P 500 is Up"
                x={280}
                y={420}
                op={sp(frame - 38)}
                scale={sp(frame - 38)}
                w={210}
                ic="#FFC107"
              />
            </>
          }
        />
      )}

      {/* ── 3. Crypto (68-96) ── */}
      {frame >= 58 && frame < 106 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={68}
          dur={28}
          label="Crypto"
          glass={
            <>
              <GlassOrb sz={140} x={340} y={260} op={sp(frame - 70) * 0.9} rot={0} frame={frame} phase={0} shimmerSpeed={1} />
              <GlassOrb sz={90} x={280} y={350} op={sp(frame - 72) * 0.7} rot={0} frame={frame} phase={40} shimmerSpeed={1.3} />
              <GlassOrb sz={65} x={420} y={370} op={sp(frame - 74) * 0.6} rot={0} frame={frame} phase={75} shimmerSpeed={0.8} />
            </>
          }
          cards={
            <>
              <InfoCard title="Bitcoin" sub="BTC" x={155} y={115} op={sp(frame - 71)} scale={sp(frame - 71)} w={140} ic="#F7931A" />
              <InfoCard title="Solana" sub="SOL" x={130} y={370} op={sp(frame - 74)} scale={sp(frame - 74)} w={130} ic="#00D18C" />
              <InfoCard title="Ethereum" sub="ETH" x={350} y={390} op={sp(frame - 77)} scale={sp(frame - 77)} w={140} ic="#627EEA" />
            </>
          }
        />
      )}

      {/* ── 4. Treasuries (96-152) ── */}
      {frame >= 86 && frame < 162 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={96}
          dur={56}
          label="Treasuries"
          glass={
            <GlassPillar
              w={90}
              h={240}
              x={295}
              y={160}
              op={sp(frame - 98)}
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
                op={sp(frame - 100)}
                scale={sp(frame - 100)}
                w={220}
                ic="#5C6BC0"
              />
              <HoldingsCard
                x={140}
                y={340}
                op={sp(frame - 106)}
                scale={sp(frame - 106)}
              />
            </>
          }
        />
      )}

      {/* ── 5. "with even more→" + phones (152-212) ── */}
      {frame >= 144 && frame < 220 && (() => {
        const lf = frame - 152;
        const en = sp(lf);
        const ex = spring({ frame: lf - 50, fps, config: { damping: 200 }, durationInFrames: 12 });
        const op = en * (1 - ex);
        const phoneLabels = ["Commercial Real Estate\nPortfolio", "The Rare Sneaker\nPortfolio", "Music Royalties"];
        const phoneColors = ["#4A90D9", "#E91E63", "#9C27B0"];
        const phonePrices = ["$1,289.43", "$345.55", "$345.55"];
        const phonePts = [
          [2, 4, 3, 6, 5, 8, 7, 10, 9, 12],
          [10, 8, 9, 6, 7, 4, 5, 3, 4, 2],
          [4, 6, 8, 6, 9, 7, 10, 12, 10, 14],
        ];
        /* Header backgrounds matching reference photographic content:
           Phone 1: teal/blue architectural building photo
           Phone 2: pink sneakers on pink background
           Phone 3: dark red/brown vinyl records */
        const headerBgs = [
          "linear-gradient(160deg, #5BA0D0 0%, #3B8CC0 20%, #4A9DD8 40%, #2D7AB4 60%, #6CB0E0 80%, #87C4EB 100%)",
          "linear-gradient(160deg, #E8A0B0 0%, #F0B0C0 20%, #E88898 40%, #D87888 60%, #F0A0B0 80%, #F8C0C8 100%)",
          "linear-gradient(160deg, #8B2020 0%, #6B1818 20%, #A03030 40%, #5A1010 60%, #7A2828 80%, #602020 100%)",
        ];
        /* Phone positions from pixel analysis of reference frame 185:
           Phone 1: x=350-545 (195px), Phone 2: x=555-775 (220px), Phone 3: x=830-1050+ (220px) */
        const phoneXs = [350, 555, 830];
        const phoneWs = [195, 220, 220];
        return (
          <div style={{ position: "absolute", inset: 0, opacity: op }}>
            <BgDots opacity={0.4} frame={frame} />
            <div
              style={{
                position: "absolute",
                left: 60,
                top: "50%",
                transform: `translateY(-50%) translateX(${interpolate(en, [0, 1], [-20, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 52, fontWeight: 700, color: C.navy, fontFamily: F.h, lineHeight: 1.1 }}>
                with even
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 52, fontWeight: 700, color: C.navy, fontFamily: F.h }}>more</span>
                <Arrow opacity={interpolate(lf, [10, 18], [0, 1], CL)} size={32} />
              </div>
            </div>
            {[0, 1, 2].map((i) => {
              const pEn = spring({ frame: lf - i * 6, fps, config: { damping: 12, mass: 0.55, stiffness: 105 } });
              const blurPx = i === 2 ? 1.5 : i === 1 ? 0.3 : 0;
              const floatY = Math.sin((frame + i * 15) * 0.06) * 3 * Math.min(1, pEn);
              return (
                <Phone
                  key={i}
                  w={phoneWs[i]}
                  h={420}
                  style={{
                    position: "absolute",
                    left: phoneXs[i],
                    top: Math.round(interpolate(pEn, [0, 1], [550, 120]) + floatY),
                    opacity: pEn,
                    transform: `perspective(800px) rotateY(${[-3, 0, 3][i]}deg) rotate(${[-1.5, 0, 1.5][i]}deg)`,
                    zIndex: 3 - i,
                    filter: blurPx > 0 ? `blur(${blurPx}px)` : "none",
                  }}
                >
                  {/* Icon + label header */}
                  <div style={{ padding: "24px 14px 6px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 14, background: phoneColors[i], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: F.b, flexShrink: 0 }}>
                      {phoneLabels[i].charAt(0)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.navy, fontFamily: F.b, lineHeight: 1.2, whiteSpace: "pre-line" }}>
                      {phoneLabels[i]}
                    </div>
                  </div>
                  {/* Photo area */}
                  <div
                    style={{
                      width: "100%",
                      height: 140,
                      background: headerBgs[i],
                    }}
                  />
                  {/* Chart + price */}
                  <div style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 9, color: "#999", fontFamily: F.b, marginBottom: 2 }}>Asset value</div>
                    <Spark w={phoneWs[i] - 32} h={40} color={phoneColors[i]} pts={phonePts[i]} fill />
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, fontFamily: F.h, marginTop: 6 }}>{phonePrices[i]}</div>
                    <div style={{ fontSize: 9, color: i === 1 ? C.red : C.green, fontFamily: F.b, marginTop: 2 }}>
                      {i === 1 ? "-5.29%" : "+1.32%"}
                    </div>
                  </div>
                </Phone>
              );
            })}
          </div>
        );
      })()}

      {/* ── 6. "One place" glass text (212-258) ── */}
      {frame >= 204 && frame < 266 && (() => {
        const lf = frame - 212;
        const en = sp(lf);
        const ex = spring({ frame: lf - 38, fps, config: { damping: 200 }, durationInFrames: 10 });
        const op = en * (1 - ex);
        const scSpring = spring({ frame: lf, fps, config: { damping: 10, mass: 0.4, stiffness: 140 } });
        const sc = interpolate(scSpring, [0, 1], [0.88, 1]);
        const shimmer = Math.sin(frame * 0.08) * 10;
        const oneSize = 280;
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
              {/* Shadow layer — soft depth below the glass */}
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  top: 10,
                  fontSize: oneSize,
                  fontWeight: 700,
                  fontFamily: F.h,
                  letterSpacing: -8,
                  lineHeight: 0.85,
                  color: "transparent",
                  WebkitTextStroke: "4px rgba(160,150,200,0.12)",
                  filter: "blur(12px)",
                }}
              >
                One
              </div>
              {/* Back face — darker inner edge simulating 3D depth */}
              <div
                style={{
                  position: "absolute",
                  left: 3,
                  top: 4,
                  fontSize: oneSize,
                  fontWeight: 700,
                  fontFamily: F.h,
                  letterSpacing: -8,
                  lineHeight: 0.85,
                  color: "transparent",
                  WebkitTextStroke: `3px rgba(170,160,210,0.35)`,
                }}
              >
                One
              </div>
              {/* Glass fill layer — translucent interior */}
              <div
                style={{
                  fontSize: oneSize,
                  fontWeight: 700,
                  fontFamily: F.h,
                  letterSpacing: -8,
                  lineHeight: 0.85,
                  color: "transparent",
                  background: `linear-gradient(${140 + shimmer}deg,
                    rgba(210,205,235,0.3) 0%,
                    rgba(195,190,225,0.15) 18%,
                    rgba(230,225,245,0.08) 35%,
                    rgba(185,175,220,0.2) 52%,
                    rgba(205,195,235,0.25) 70%,
                    rgba(220,215,240,0.12) 88%,
                    rgba(200,190,230,0.3) 100%)`,
                  WebkitBackgroundClip: "text",
                  filter: "drop-shadow(0 8px 32px rgba(150,140,200,0.18))",
                }}
              >
                One
              </div>
              {/* Outer stroke — main glass edge */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  fontSize: oneSize,
                  fontWeight: 700,
                  fontFamily: F.h,
                  letterSpacing: -8,
                  lineHeight: 0.85,
                  color: "transparent",
                  WebkitTextStroke: "2.5px rgba(185,175,220,0.55)",
                }}
              >
                One
              </div>
              {/* Inner stroke — offset for 3D hollow tube effect */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  fontSize: oneSize,
                  fontWeight: 700,
                  fontFamily: F.h,
                  letterSpacing: -8,
                  lineHeight: 0.85,
                  color: "transparent",
                  WebkitTextStroke: "1.5px rgba(175,165,215,0.3)",
                  transform: "translate(2px, 2px)",
                }}
              >
                One
              </div>
              {/* Specular highlight — top-left bright edge */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  fontSize: oneSize,
                  fontWeight: 700,
                  fontFamily: F.h,
                  letterSpacing: -8,
                  lineHeight: 0.85,
                  color: "transparent",
                  WebkitTextStroke: "1.2px rgba(255,255,255,0.45)",
                  transform: "translate(-1.5px, -1.5px)",
                }}
              >
                One
              </div>
              {/* Iridescent shimmer — conic gradient moving across the text */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  fontSize: oneSize,
                  fontWeight: 700,
                  fontFamily: F.h,
                  letterSpacing: -8,
                  lineHeight: 0.85,
                  color: "transparent",
                  background: `conic-gradient(from ${shimmer * 6}deg at ${45 + shimmer * 0.3}% 40%,
                    rgba(200,170,255,0.15) 0deg,
                    rgba(140,210,255,0.12) 72deg,
                    rgba(170,255,220,0.08) 144deg,
                    rgba(255,220,170,0.1) 216deg,
                    rgba(255,170,210,0.12) 288deg,
                    rgba(200,170,255,0.15) 360deg)`,
                  WebkitBackgroundClip: "text",
                  mixBlendMode: "overlay",
                }}
              >
                One
              </div>
            </div>
            <div
              style={{
                fontSize: 110,
                fontWeight: 700,
                fontFamily: F.h,
                color: C.blue,
                marginTop: -55,
                letterSpacing: -3,
                textShadow: "0 2px 20px rgba(40,69,224,0.15)",
              }}
            >
              place
            </div>
          </div>
        );
      })()}

      {/* ── 7. "build your portfolio→" (258-308) ── */}
      {frame >= 250 && frame < 316 && (() => {
        const lf = frame - 258;
        const en = sp(lf);
        const ex = spring({ frame: lf - 42, fps, config: { damping: 200 }, durationInFrames: 10 });
        const op = en * (1 - ex);
        return (
          <div style={{ position: "absolute", inset: 0, opacity: op }}>
            <BgDots opacity={0.3} frame={frame} />
            <div
              style={{
                position: "absolute",
                left: 50,
                top: "50%",
                transform: `translateY(calc(-50% + ${interpolate(en, [0, 1], [15, 0])}px)) translateX(${interpolate(en, [0, 1], [-25, 0])}px)`,
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

      {/* ── 8. "the way you want." + phone with 3D rotation (308-364) ── */}
      {frame >= 300 && (() => {
        const lf = frame - 308;
        const leftEn = sp(lf);
        const phoneSpring = spring({ frame: lf - 3, fps, config: { damping: 11, mass: 0.45, stiffness: 95 } });
        const rightEn = sp(Math.max(0, lf - 5));
        const overallOp = sp(lf);

        // 3D Y-axis rotation starts ~1.2s into the segment, runs ~1.5s
        const rotStart = Math.round(fps * 1.2); // ~35 frames in
        const rotDur = Math.round(fps * 1.5);   // ~44 frames
        const rotationY = interpolate(lf, [rotStart, rotStart + rotDur], [0, 180], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        });

        // Screen content fades as phone passes ~70° (content disappears before backface)
        const screenOpacity = interpolate(rotationY, [0, 70, 90], [1, 0.3, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Phone scales up slightly during rotation (reference shows it growing)
        const rotScale = interpolate(lf, [rotStart, rotStart + rotDur * 0.6], [1, 1.08], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });

        // Text fades out as phone rotation takes over
        const textFade = interpolate(lf, [rotStart, rotStart + 12], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Background transitions toward Scene03 blue during final frames
        const bgBlue = interpolate(lf, [rotStart + rotDur * 0.6, rotStart + rotDur], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.in(Easing.cubic),
        });
        const bgColor = bgBlue > 0
          ? `rgb(${Math.round(245 - 241 * bgBlue)}, ${Math.round(245 - 198 * bgBlue)}, ${Math.round(247 - 3 * bgBlue)})`
          : C.bg;

        // Shadow shrinks and fades as phone lifts off during rotation
        const shadowOp = interpolate(rotationY, [0, 90, 180], [0.08, 0.03, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const shadowW = interpolate(rotationY, [0, 180], [160, 60], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div style={{ position: "absolute", inset: 0, opacity: overallOp, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: bgColor }}>
            <BgDots opacity={0.3 * (1 - bgBlue)} frame={frame} />
            <div style={{ position: "absolute", left: 60, top: "50%", transform: `translateY(-50%) translateX(${interpolate(leftEn, [0, 1], [-20, 0])}px)`, opacity: leftEn * textFade }}>
              <span style={{ fontSize: 54, fontWeight: 700, color: C.navy, fontFamily: F.h }}>the way</span>
            </div>
            <div style={{
              position: "relative",
              zIndex: 2,
              opacity: phoneSpring,
              transform: `scale(${rotScale})`,
            }}>
              <Phone
                w={200}
                h={390}
                style={{
                  transform: `perspective(800px) rotateY(${rotationY}deg) rotateX(${2 * (1 - rotationY / 180)}deg) translateY(${interpolate(phoneSpring, [0, 1], [50, 0])}px)`,
                  backfaceVisibility: "hidden",
                }}
              >
                <div style={{ padding: "28px 16px 12px", opacity: screenOpacity }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: "#999", fontFamily: F.b }}>&#9776;</div>
                    <div style={{ fontSize: 8, color: "#999", fontFamily: F.b }}>Invite</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.navy, fontFamily: F.h, marginTop: 4 }}>$125,367.10</div>
                  <div style={{ fontSize: 10, color: C.green, fontFamily: F.b, marginTop: 2 }}>Today  +6.40% ($7,540.88)</div>
                  <Spark w={165} h={50} color={C.green} pts={[20, 22, 24, 23, 26, 25, 28, 30, 32, 34, 33, 36, 38, 40, 42]} sw={1.5} fill />
                  <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
                    {["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"].map((p, i) => (
                      <div key={p} style={{ fontSize: 8, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? C.navy : "#999", background: i === 0 ? "#f0f0f0" : "transparent", borderRadius: 6, padding: "2px 6px", fontFamily: F.b }}>
                        {p}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {[{ l: "Equities", v: "$65,190" }, { l: "Crypto", v: "$33,923" }, { l: "Alts", v: "$7,604" }, { l: "Cash", v: "$7,327" }].map(({ l, v }) => (
                      <div key={l} style={{ flex: 1 }}>
                        <div style={{ fontSize: 6, color: "#999", fontFamily: F.b }}>{l}</div>
                        <div style={{ fontSize: 7, fontWeight: 600, color: C.navy, fontFamily: F.b, marginTop: 1 }}>{v}</div>
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
                  <div style={{ marginTop: 10, background: "#f8f8fa", borderRadius: 10, padding: "8px 10px", position: "relative" }}>
                    <div style={{ fontSize: 9, color: "#999", fontFamily: F.b }}>Account action</div>
                    <div style={{ fontSize: 8, color: C.navy, fontFamily: F.b, marginTop: 2, lineHeight: 1.3 }}>Transfer an existing portfolio into Public in less than 2 minutes</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <span style={{ fontSize: 9, color: C.green, fontFamily: F.b, fontWeight: 600 }}>Transfer a portfolio</span>
                      <span style={{ fontSize: 10, color: "#ccc" }}>&#8250;</span>
                    </div>
                    {/* Blue dot indicator */}
                    <div style={{ position: "absolute", top: 8, right: 10, width: 7, height: 7, borderRadius: 4, background: C.blue }} />
                  </div>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 600, color: C.navy, fontFamily: F.b }}>
                    <span>Assets</span>
                    <span style={{ color: C.blue, fontSize: 9 }}>Price &#8593;</span>
                  </div>
                </div>
              </Phone>
              {/* Phone back face — visible when rotated past 90° */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: 200,
                  height: 390,
                  borderRadius: 200 * 0.14,
                  background: "linear-gradient(180deg, #2A2A2A 0%, #1A1A1A 100%)",
                  boxShadow: "0 12px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
                  transform: `perspective(800px) rotateY(${rotationY + 180}deg) rotateX(${2 * (1 - rotationY / 180)}deg) translateY(${interpolate(phoneSpring, [0, 1], [50, 0])}px)`,
                  backfaceVisibility: "hidden",
                  overflow: "hidden",
                }}
              >
                {/* Camera bump */}
                <div style={{
                  position: "absolute",
                  top: 20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 50,
                  height: 50,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #333 0%, #222 100%)",
                  boxShadow: "inset 0 1px 3px rgba(255,255,255,0.1), 0 2px 6px rgba(0,0,0,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: "linear-gradient(135deg, #111 0%, #1a1a2e 100%)", boxShadow: "inset 0 1px 2px rgba(255,255,255,0.08), 0 0 4px rgba(0,0,0,0.5)" }} />
                </div>
                {/* Logo area */}
                <div style={{
                  position: "absolute",
                  bottom: 40,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.15)",
                  fontFamily: F.h,
                  fontWeight: 700,
                  letterSpacing: 2,
                }}>
                  PUBLIC
                </div>
              </div>
              <div style={{ position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)", width: shadowW, height: 20, borderRadius: "50%", background: `radial-gradient(ellipse, rgba(0,0,0,${shadowOp}) 0%, transparent 70%)` }} />
            </div>
            <div style={{ position: "absolute", right: 60, top: "50%", transform: `translateY(-50%) translateX(${interpolate(rightEn, [0, 1], [20, 0])}px)`, opacity: rightEn * textFade }}>
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
