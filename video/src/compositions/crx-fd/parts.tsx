import React from "react";
import { C, font, monoFont } from "./theme";

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ─── glass ───────────────────────────────────────────────────────────────────
export const glass = (radius: number): React.CSSProperties => ({
  background: "linear-gradient(160deg, rgba(255,255,255,0.74) 0%, rgba(255,255,255,0.5) 100%)",
  border: "1px solid rgba(255,255,255,0.74)",
  borderRadius: radius,
  boxShadow: "0 14px 36px rgba(60,66,130,0.18), inset 0 1px 0 rgba(255,255,255,0.92)",
});

export const place = (left: number, top: number): React.CSSProperties => ({
  position: "absolute",
  left,
  top,
  transform: "translate(-50%,-50%)",
});

// ─── CRX brand mark — six-spoke asterisk + wordmark ───────────────────────────
export const CRXMark: React.FC<{ size?: number; mono?: string }> = ({ size = 64, mono }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="CRX">
    <defs>
      <linearGradient id="crxMark" gradientUnits="userSpaceOnUse" x1="50" y1="8" x2="50" y2="92">
        <stop offset="0" stopColor="#2AD4BB" />
        <stop offset="0.5" stopColor="#1CC8C6" />
        <stop offset="1" stopColor="#19B6DD" />
      </linearGradient>
    </defs>
    <g fill="none" stroke={mono ?? "url(#crxMark)"} strokeWidth={11} strokeLinecap="round">
      <line x1={50} y1={8} x2={50} y2={92} />
      <line x1={13.6} y1={71} x2={86.4} y2={29} />
      <line x1={13.6} y1={29} x2={86.4} y2={71} />
    </g>
  </svg>
);

export const CRXLockup: React.FC<{ size?: number; mono?: string; gap?: number }> = ({ size = 64, mono, gap = 16 }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap }}>
    <CRXMark size={size} mono={mono} />
    <span style={{ fontFamily: font, fontSize: size * 0.78, fontWeight: 800, letterSpacing: "-0.03em", color: mono ?? C.text }}>CRX</span>
  </div>
);

export const CRXCorner: React.FC = () => (
  <div style={{ position: "absolute", top: 30, left: 34, zIndex: 60 }}>
    <CRXLockup size={40} />
  </div>
);

// ─── business tile — a real firm that hedges FX with a deliverable forward ─────
type BizKind = "factory" | "ship" | "plane";
const BIZ: Record<BizKind, { label: string; paths: React.ReactNode }> = {
  factory: {
    label: "MANUFACTURER",
    paths: (
      <>
        <path d="M12 16h.01" />
        <path d="M16 16h.01" />
        <path d="M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" />
        <path d="M8 16h.01" />
      </>
    ),
  },
  ship: {
    label: "IMPORTER",
    paths: (
      <>
        <path d="M12 10.189V14" />
        <path d="M12 2v3" />
        <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
        <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76" />
        <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      </>
    ),
  },
  plane: {
    label: "AIRLINE",
    paths: <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />,
  },
};

export const BusinessTile: React.FC<{
  kind: BizKind;
  size?: number;
  mood?: "neutral" | "sad" | "happy";
  accent?: string;
  label?: boolean;
}> = ({ kind, size = 168, mood = "neutral", accent = C.teal, label = true }) => {
  const reaction = mood === "happy" ? ":D" : mood === "sad" ? ":(" : null;
  const rColor = mood === "happy" ? C.good : mood === "sad" ? C.bad : C.dim;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ position: "relative" }}>
        <div
          style={{
            ...glass(26),
            width: size,
            height: size,
            border: `2.5px solid ${accent}`,
            boxShadow: `0 18px 44px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.88)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={size * 0.54} height={size * 0.54} viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            {BIZ[kind].paths}
          </svg>
        </div>
        {reaction && (
          <div
            style={{
              position: "absolute",
              top: -16,
              right: -16,
              minWidth: 46,
              height: 46,
              padding: "0 10px",
              borderRadius: 999,
              background: "#fff",
              border: `2.5px solid ${rColor}`,
              boxShadow: `0 8px 20px ${rColor}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: font,
              fontSize: 26,
              fontWeight: 800,
              color: rColor,
            }}
          >
            {reaction}
          </div>
        )}
      </div>
      {label && (
        <div style={{ fontFamily: monoFont, fontSize: 28, fontWeight: 700, letterSpacing: "0.1em", color: C.dim }}>{BIZ[kind].label}</div>
      )}
    </div>
  );
};

// ─── broker — Lucide `user` (ISC) verbatim + a teal tie, in a glass tile ──────
export const BrokerTile: React.FC<{ size?: number; label?: boolean }> = ({ size = 168, label = true }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
    <div
      style={{
        ...glass(26),
        width: size,
        height: size,
        border: `2.5px solid ${C.teal}`,
        boxShadow: `0 18px 44px ${C.teal}33, inset 0 1px 0 rgba(255,255,255,0.88)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * 0.54} height={size * 0.54} viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx={12} cy={7} r={4} />
        <path d="M12 11.4l-1 1.3 1 4.6 1-4.6z" fill={C.teal} stroke={C.teal} strokeWidth={1.2} />
      </svg>
    </div>
    {label && <div style={{ fontFamily: monoFont, fontSize: 28, fontWeight: 700, letterSpacing: "0.1em", color: C.dim }}>BROKER</div>}
  </div>
);

// ─── labelled flow box (Spot / NDF / FD) ──────────────────────────────────────
export const FlowBox: React.FC<{ title: string; sub?: string; accent?: string; w?: number; h?: number; glow?: boolean; big?: boolean }> = ({
  title,
  sub,
  accent = C.text,
  w = 340,
  h = 140,
  glow = false,
  big = false,
}) => (
  <div
    style={{
      ...glass(20),
      width: w,
      height: h,
      border: `2.5px solid ${accent}`,
      boxShadow: glow
        ? `0 18px 44px rgba(60,66,130,0.18), 0 0 52px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.88)`
        : "0 14px 36px rgba(60,66,130,0.16), inset 0 1px 0 rgba(255,255,255,0.88)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      boxSizing: "border-box",
      padding: "0 20px",
    }}
  >
    <div style={{ fontFamily: font, fontSize: big ? 52 : 40, fontWeight: 800, letterSpacing: "-0.02em", color: C.text, textAlign: "center", lineHeight: 1.04 }}>
      {title}
    </div>
    {sub && <div style={{ fontFamily: monoFont, fontSize: 26, fontWeight: 700, letterSpacing: "0.04em", color: accent }}>{sub}</div>}
  </div>
);

// ─── speech bubble ─────────────────────────────────────────────────────────────
export const Speech: React.FC<{ text: string; accent?: string; w?: number; align?: "left" | "right" }> = ({ text, accent = C.text, w = 320, align = "left" }) => (
  <div style={{ position: "relative", width: w }}>
    <div style={{ ...glass(24), padding: "22px 30px", fontFamily: font, fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em", color: accent, textAlign: "center", lineHeight: 1.16 }}>
      {text}
    </div>
    <div
      style={{
        position: "absolute",
        bottom: -13,
        left: align === "left" ? 46 : undefined,
        right: align === "right" ? 46 : undefined,
        width: 26,
        height: 26,
        background: "rgba(255,255,255,0.62)",
        borderRight: "1px solid rgba(255,255,255,0.74)",
        borderBottom: "1px solid rgba(255,255,255,0.74)",
        transform: "rotate(45deg)",
      }}
    />
  </div>
);

export const Kicker: React.FC<{ text: string; color?: string }> = ({ text, color = C.faint }) => (
  <div
    style={{
      display: "inline-block",
      padding: "8px 22px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.6)",
      border: `1.5px solid ${color}44`,
      fontFamily: monoFont,
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: "0.16em",
      color,
    }}
  >
    {text}
  </div>
);

// ─── numbered step card — the "old way", told step by step ────────────────────
export const StepCard: React.FC<{ n: number; title: string; sub?: string; tone?: string; w?: number; lit?: number }> = ({
  n,
  title,
  sub,
  tone = C.teal,
  w = 560,
  lit = 0,
}) => (
  <div
    style={{
      ...glass(20),
      width: w,
      padding: "20px 26px",
      display: "flex",
      alignItems: "center",
      gap: 22,
      border: `2px solid ${lit > 0.5 ? tone : "rgba(255,255,255,0.74)"}`,
      boxShadow: lit > 0.5 ? `0 14px 36px rgba(60,66,130,0.16), 0 0 40px ${tone}40` : "0 14px 36px rgba(60,66,130,0.14), inset 0 1px 0 rgba(255,255,255,0.9)",
      boxSizing: "border-box",
    }}
  >
    <div style={{ flex: "0 0 auto", width: 56, height: 56, borderRadius: "50%", background: tone, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontSize: 30, fontWeight: 800, color: "#fff", boxShadow: `0 6px 18px ${tone}55` }}>
      {n}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontFamily: font, fontSize: 30, fontWeight: 700, color: C.text, lineHeight: 1.12 }}>{title}</div>
      {sub && <div style={{ fontFamily: font, fontSize: 24, fontWeight: 600, color: C.dim, lineHeight: 1.12 }}>{sub}</div>}
    </div>
  </div>
);

// a small label pill rendered inside SVG (text + rect)
const ChartTag: React.FC<{ x: number; y: number; text: string; color: string; anchor: "start" | "end" | "middle" }> = ({ x, y, text, color, anchor }) => {
  const w = text.length * 12.4 + 26;
  const rx = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
  const tx = anchor === "end" ? x - 13 : anchor === "middle" ? x : x + 13;
  return (
    <g>
      <rect x={rx} y={y - 25} width={w} height={34} rx={9} fill="#fff" stroke={color} strokeWidth={1.5} opacity={0.97} />
      <text x={tx} y={y - 1} textAnchor={anchor} fontFamily={font} fontSize={22} fontWeight={700} fill={color}>
        {text}
      </text>
    </g>
  );
};

// ─── payoff panel — the two ways to deliver a forward, on one payoff graph ─────
// X = rate at settlement, Y = the value the business actually receives. A grey
// diagonal is the UNHEDGED swing; the dashed line is the fair locked rate. The
// delivered forward is flat (the swing is gone). The difference between the two
// modes is HOW it's delivered:
//   • premium — the broker forecasts the move and charges for it; the delivered
//     line sits below fair by a guessed PREMIUM, fuzzy with forecast risk.
//   • ndf — only the cash difference settles, exactly; delivered sits ON fair.
export const PayoffPanel: React.FC<{ mode: "premium" | "ndf"; w?: number }> = ({ mode, w = 680 }) => {
  const ndf = mode === "ndf";
  const tone = ndf ? C.good : C.bad;
  const cw = w;
  const ch = 320;
  const padL = 56;
  const padR = 26;
  const padT = 18;
  const padB = 54;
  const x0 = padL;
  const x1 = cw - padR;
  const y0 = ch - padB;
  const y1 = padT;
  const fairY = lerp(y1, y0, 0.34);
  const deliveredY = ndf ? fairY : fairY + 78;
  const uid = mode;
  return (
    <div
      style={{
        ...glass(24),
        width: w,
        padding: "22px 24px 24px",
        border: `2.5px solid ${tone}`,
        boxShadow: `0 16px 44px rgba(60,66,130,0.16), 0 0 46px ${tone}2e, inset 0 1px 0 rgba(255,255,255,0.9)`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 2 }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: tone }} />
        <div style={{ fontFamily: font, fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>
          {ndf ? "Spot + NDF" : "Forward + premium"}
        </div>
        <div style={{ marginLeft: "auto", fontFamily: monoFont, fontSize: 22, fontWeight: 700, letterSpacing: "0.08em", color: tone }}>
          {ndf ? "SETTLE EXACT" : "THE OLD WAY"}
        </div>
      </div>
      <svg width={cw} height={ch} style={{ overflow: "visible" }}>
        <defs>
          <marker id={`pf-axis-${uid}`} markerWidth="9" markerHeight="9" refX="6" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M1,1 L7,4.5 L1,8" fill="none" stroke={C.faint} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        {/* axes */}
        <line x1={x0} y1={y0} x2={x0} y2={y1 - 12} stroke={C.faint} strokeWidth={3} strokeLinecap="round" markerEnd={`url(#pf-axis-${uid})`} />
        <line x1={x0} y1={y0} x2={x1 + 12} y2={y0} stroke={C.faint} strokeWidth={3} strokeLinecap="round" markerEnd={`url(#pf-axis-${uid})`} />
        <text x={x0 - 14} y={y1 - 18} textAnchor="start" fontFamily={monoFont} fontSize={24} fontWeight={700} fill={C.dim}>Your value</text>
        <text x={x1 + 8} y={y0 + 40} textAnchor="end" fontFamily={monoFont} fontSize={24} fontWeight={700} fill={C.dim}>Rate at settlement →</text>
        {/* fair locked rate — the reference */}
        <line x1={x0} y1={fairY} x2={x1} y2={fairY} stroke="rgba(60,64,110,0.34)" strokeWidth={2.5} strokeDasharray="9 8" />
        <ChartTag x={x1 - 6} y={fairY - 8} text="fair rate" color={C.dim} anchor="end" />
        {/* unhedged swing — what they'd suffer with no hedge */}
        <line x1={x0} y1={y0 - 10} x2={x1} y2={y1 + 22} stroke="rgba(60,64,110,0.30)" strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" />
        <text x={x1 - 4} y={y1 + 16} textAnchor="end" fontFamily={font} fontSize={22} fontWeight={700} fill={C.faint}>no hedge: swings</text>

        {mode === "premium" ? (
          <>
            {/* the guessed premium wedge between fair and delivered */}
            <rect x={x0} y={fairY} width={x1 - x0} height={deliveredY - fairY} fill={C.bad} opacity={0.14} />
            {/* forecast-risk band around delivered */}
            <line x1={x0} y1={deliveredY - 24} x2={x1} y2={deliveredY - 24} stroke={C.bad} strokeWidth={2} strokeDasharray="6 8" opacity={0.5} />
            <line x1={x0} y1={deliveredY + 24} x2={x1} y2={deliveredY + 24} stroke={C.bad} strokeWidth={2} strokeDasharray="6 8" opacity={0.5} />
            {/* delivered (below fair, worse) */}
            <line x1={x0} y1={deliveredY} x2={x1} y2={deliveredY} stroke={C.bad} strokeWidth={6} strokeLinecap="round" />
            <circle cx={x1} cy={deliveredY} r={7} fill={C.bad} stroke="#fff" strokeWidth={2.5} />
            <ChartTag x={(x0 + x1) / 2} y={(fairY + deliveredY) / 2 + 6} text="PREMIUM — guessed" color={C.bad} anchor="middle" />
          </>
        ) : (
          <>
            {/* the difference settles in cash → delivered sits exactly on fair */}
            <line x1={x1 - 70} y1={y1 + 30} x2={x1 - 70} y2={fairY} stroke={C.good} strokeWidth={3} strokeDasharray="5 6" />
            <ChartTag x={x1 - 70} y={(y1 + 30 + fairY) / 2} text="Δ settles in cash" color={C.good} anchor="middle" />
            <line x1={x0} y1={deliveredY} x2={x1} y2={deliveredY} stroke={C.good} strokeWidth={6} strokeLinecap="round" />
            <circle cx={x1} cy={deliveredY} r={7} fill={C.good} stroke="#fff" strokeWidth={2.5} />
          </>
        )}
      </svg>
      <div style={{ fontFamily: font, fontSize: 27, fontWeight: 600, color: C.dim, lineHeight: 1.22 }}>
        {ndf ? (
          <>Only the <span style={{ color: C.good, fontWeight: 800 }}>cash difference</span> settles — exact. No premium to forecast.</>
        ) : (
          <>The broker <span style={{ color: C.bad, fontWeight: 800 }}>forecasts the move</span> and charges for it. Guess wrong → lose the deal or lose money.</>
        )}
      </div>
    </div>
  );
};

// ─── an arrow between two board points ─────────────────────────────────────────
export const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; color?: string; draw?: number; width?: number }> = ({
  x1,
  y1,
  x2,
  y2,
  color = C.teal,
  draw = 1,
  width = 3.5,
}) => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const off = (1 - clamp01(draw)) * len;
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" markerEnd="url(#crx-arrow)" strokeDasharray={len} strokeDashoffset={off} opacity={draw > 0.02 ? 1 : 0} />
  );
};

// ─── cursor — swoops in on a bezier and clicks (screen space) ─────────────────
const bez = (t: number, p0: number, p1: number, p2: number, p3: number): number => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

export const Cursor: React.FC<{ frame: number; inFrom: number; clickAt: number; fromXY: [number, number]; toXY: [number, number] }> = ({
  frame,
  inFrom,
  clickAt,
  fromXY,
  toXY,
}) => {
  if (frame < inFrom - 6 || frame > clickAt + 40) return null;
  const t = clamp01((frame - inFrom) / (clickAt - inFrom));
  const e = 1 - Math.pow(1 - t, 3);
  const midX = lerp(fromXY[0], toXY[0], 0.5) + 120;
  const midY = lerp(fromXY[1], toXY[1], 0.4) - 80;
  const x = bez(e, fromXY[0], midX, lerp(fromXY[0], toXY[0], 0.8), toXY[0]);
  const y = bez(e, fromXY[1], midY, lerp(fromXY[1], toXY[1], 0.7), toXY[1]);
  const sc = frame < clickAt ? lerp(1, 0.82, clamp01((frame - (clickAt - 4)) / 4)) : lerp(0.82, 1, clamp01((frame - clickAt) / 6));
  const op = Math.min(clamp01((frame - (inFrom - 6)) / 8), clamp01((clickAt + 40 - frame) / 18));
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 40, height: 40, opacity: op, transform: `scale(${sc.toFixed(3)})`, transformOrigin: "5px 4px", filter: "drop-shadow(0 6px 14px rgba(20,30,80,0.35))", pointerEvents: "none", zIndex: 80 }}>
      <svg viewBox="0 0 24 24" width={40} height={40}>
        <path d="M4.5 3 L4.5 19 L8.5 15.5 L11 21 L13.4 20 L10.9 14.6 L16.5 14.6 Z" fill="#fff" stroke="#0a0a0a" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

export const ClickBurst: React.FC<{ frame: number; at: number; xy: [number, number]; color?: string }> = ({ frame, at, xy, color = C.teal }) => {
  const local = frame - at;
  if (local < -1 || local > 42) return null;
  const t = clamp01(local / 24);
  const e = 1 - Math.pow(1 - t, 3);
  const r1 = lerp(0.3, 3.4, e);
  const op1 = clamp01(local / 6) * clamp01((24 - local) / 18);
  const coreOp = clamp01(local / 4) * clamp01((18 - local) / 14);
  const coreScale = lerp(0.4, 1.7, e);
  const spikes = Array.from({ length: 8 }, (_, i) => (i * Math.PI * 2) / 8);
  const spikeLen = lerp(0, 64, e);
  const spikeOff = lerp(12, 32, e);
  const spikeOp = clamp01(local / 5) * clamp01((26 - local) / 20);
  return (
    <div style={{ position: "absolute", left: xy[0], top: xy[1], width: 0, height: 0, pointerEvents: "none", zIndex: 70 }}>
      <div style={{ position: "absolute", left: -38, top: -38, width: 76, height: 76, borderRadius: "50%", border: `3px solid ${color}`, transform: `scale(${r1.toFixed(2)})`, opacity: op1 }} />
      <div style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: "50%", background: `radial-gradient(circle, #fff 0%, ${color}88 60%, transparent 100%)`, transform: `scale(${coreScale.toFixed(2)})`, opacity: coreOp, filter: "blur(2px)" }} />
      {spikes.map((a, i) => (
        <div key={i} style={{ position: "absolute", left: Math.cos(a) * spikeOff - spikeLen / 2, top: Math.sin(a) * spikeOff - 1.5, width: spikeLen, height: 3, background: color, borderRadius: 2, transform: `rotate(${(a * 180) / Math.PI}deg)`, transformOrigin: "50% 50%", opacity: spikeOp }} />
      ))}
    </div>
  );
};
