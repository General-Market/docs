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
        <div style={{ fontFamily: monoFont, fontSize: 24, fontWeight: 700, letterSpacing: "0.1em", color: C.dim }}>{BIZ[kind].label}</div>
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
    {label && <div style={{ fontFamily: monoFont, fontSize: 24, fontWeight: 700, letterSpacing: "0.1em", color: C.dim }}>BROKER</div>}
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
    <div style={{ fontFamily: font, fontSize: big ? 50 : 38, fontWeight: 800, letterSpacing: "-0.02em", color: C.text, textAlign: "center", lineHeight: 1.04 }}>
      {title}
    </div>
    {sub && <div style={{ fontFamily: monoFont, fontSize: 24, fontWeight: 700, letterSpacing: "0.04em", color: accent }}>{sub}</div>}
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
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: "0.16em",
      color,
    }}
  >
    {text}
  </div>
);

// ─── volatility chart — the heart of the "old way" beat, made legible ─────────
// A locked FD rate (flat teal dashed) and the spot price drifting away from it
// (red, drawn on). The shaded gap is the risk the broker must price in.
export const VolatilityChart: React.FC<{ draw: number; w?: number; h?: number }> = ({ draw, w = 540, h = 320 }) => {
  const padL = 18;
  const padR = 18;
  const lockY = h * 0.34; // the locked rate line
  const x0 = padL;
  const x1 = w - padR;
  // spot wanders, then dives below the locked rate — the divergence
  const spot: [number, number][] = [
    [x0, lockY],
    [x0 + (x1 - x0) * 0.18, lockY - 16],
    [x0 + (x1 - x0) * 0.36, lockY + 8],
    [x0 + (x1 - x0) * 0.54, lockY + 54],
    [x0 + (x1 - x0) * 0.72, lockY + 92],
    [x1, lockY + 150],
  ];
  let len = 0;
  for (let i = 1; i < spot.length; i++) len += Math.hypot(spot[i][0] - spot[i - 1][0], spot[i][1] - spot[i - 1][1]);
  const off = (1 - clamp01(draw)) * len;
  const poly = spot.map((p) => p.join(",")).join(" ");
  const last = spot[spot.length - 1];
  // the shaded risk gap follows the drawn portion
  const drawnEnd = lerp(x0, x1, clamp01(draw));
  const visible = spot.filter((p) => p[0] <= drawnEnd + 1);
  const gapArea =
    visible.length > 1
      ? `${x0},${lockY} ${visible.map((p) => p.join(",")).join(" ")} ${visible[visible.length - 1][0]},${lockY}`
      : "";
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="vol-gap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.bad} stopOpacity={0.26} />
          <stop offset="100%" stopColor={C.bad} stopOpacity={0.04} />
        </linearGradient>
      </defs>
      {/* shaded risk */}
      {gapArea && <polygon points={gapArea} fill="url(#vol-gap)" />}
      {/* locked FD rate */}
      <line x1={x0} y1={lockY} x2={x1} y2={lockY} stroke={C.teal} strokeWidth={4} strokeDasharray="12 9" strokeLinecap="round" />
      <text x={x0} y={lockY - 16} fontFamily={monoFont} fontSize={24} fontWeight={700} fill={C.teal}>
        Locked FD rate
      </text>
      {/* spot */}
      <polyline points={poly} fill="none" stroke={C.bad} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={off} />
      {draw > 0.5 && (
        <>
          <circle cx={last[0]} cy={last[1]} r={7} fill={C.bad} stroke="#fff" strokeWidth={2.5} opacity={clamp01((draw - 0.5) * 2)} />
          <text x={last[0]} y={last[1] + 34} textAnchor="end" fontFamily={monoFont} fontSize={24} fontWeight={700} fill={C.bad} opacity={clamp01((draw - 0.5) * 2)}>
            Spot drifts
          </text>
        </>
      )}
    </svg>
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
