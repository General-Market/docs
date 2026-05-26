import React from "react";
import { useCurrentFrame } from "remotion";
import {
  C,
  font,
  monoFont,
  FPS,
  W,
  H,
  PILL_GRADIENT,
  FACE,
  FaceState,
  clamp01,
  lerp,
  mulberry32,
} from "./ThreeWallsTrack";

// The shared vocabulary for the three walls. Everything that needs absolute
// placement takes a centre (cx, cy) in board coordinates and centres itself on
// it; FlowStream takes from/to centres in that same space. The walls orchestrate
// the timing and feed these primitives their progress.

export type Pt = { x: number; y: number };
const tri = (t: number): number => 1 - Math.abs(t * 2 - 1);

const centred = (cx: number, cy: number): React.CSSProperties => ({
  position: "absolute",
  left: cx,
  top: cy,
  transform: "translate(-50%, -50%)",
});

// Mix two hex colours. Used for the heat ramp green → amber → red.
const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
export const colorLerp = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return `rgb(${r}, ${g}, ${bl})`;
};
const GREEN = "#1FB877";
const AMBER = "#E8A13A";
const RED = "#F2566B";
// green → amber → red across t 0..1
export const heatColor = (t: number): string =>
  t < 0.5 ? colorLerp(GREEN, AMBER, t * 2) : colorLerp(AMBER, RED, (t - 0.5) * 2);

// ── Face ─────────────────────────────────────────────────────────────────────
// A small disc with eyes and a mouth. happy smiles, unhappy frowns, neutral is
// flat with a question — the only expression any chip ever wears.
export const Face: React.FC<{ state: FaceState; size?: number }> = ({ state, size = 30 }) => {
  const color = FACE[state];
  const eyeY = size * 0.4;
  const eyeDx = size * 0.2;
  const r = size * 0.07;
  const mouthY = size * 0.62;
  const mw = size * 0.34;
  const mouth =
    state === "happy"
      ? `M ${size / 2 - mw / 2} ${mouthY} Q ${size / 2} ${mouthY + mw * 0.6} ${size / 2 + mw / 2} ${mouthY}`
      : state === "unhappy"
        ? `M ${size / 2 - mw / 2} ${mouthY + mw * 0.4} Q ${size / 2} ${mouthY - mw * 0.3} ${size / 2 + mw / 2} ${mouthY + mw * 0.4}`
        : `M ${size / 2 - mw / 2} ${mouthY} L ${size / 2 + mw / 2} ${mouthY}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill={color} />
      <circle cx={size / 2 - eyeDx} cy={eyeY} r={r} fill="#fff" />
      <circle cx={size / 2 + eyeDx} cy={eyeY} r={r} fill="#fff" />
      <path d={mouth} stroke="#fff" strokeWidth={size * 0.06} fill="none" strokeLinecap="round" />
      {state === "neutral" ? (
        <text
          x={size / 2}
          y={size * 0.92}
          textAnchor="middle"
          fontSize={size * 0.28}
          fontWeight={800}
          fill="#fff"
          fontFamily={font}
        >
          ?
        </text>
      ) : null}
    </svg>
  );
};

// ── TraderChip ─────────────────────────────────────────────────────────────
// A named actor. Optional face above, name below.
export const TraderChip: React.FC<{
  cx: number;
  cy: number;
  label?: string;
  name?: string;
  color?: string;
  size?: number;
  face?: FaceState;
}> = ({ cx, cy, label = "T", name, color = C.blue, size = 84, face }) => (
  <div style={{ ...centred(cx, cy), display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
    {face ? <Face state={face} size={size * 0.42} /> : null}
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: `linear-gradient(150deg, ${color}, ${color}DD)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        fontSize: size * 0.42,
        fontWeight: 800,
        color: "#fff",
        textShadow: "0 1px 2px rgba(40,40,90,0.3)",
        boxShadow: `0 12px 28px ${color}55, inset 0 1px 0 rgba(255,255,255,0.4)`,
      }}
    >
      {label}
    </div>
    {name ? (
      <div style={{ fontFamily: font, fontSize: size * 0.22, fontWeight: 700, color: C.text }}>{name}</div>
    ) : null}
  </div>
);

// ── MMChip ───────────────────────────────────────────────────────────────────
// A market maker as a finite reservoir: a vertical glass capsule with a liquid
// fill. Capacity is fixed for a whole clip — only the fill moves. An optional
// dollar label sits under the name.
export const MMChip: React.FC<{
  cx: number;
  cy: number;
  fill: number;
  color?: string;
  face?: FaceState;
  h?: number;
  label?: string;
  amount?: string;
}> = ({ cx, cy, fill, color = C.violet, face, h = 104, label = "MM", amount }) => {
  const w = h * 0.46;
  const f = clamp01(fill);
  return (
    <div style={{ ...centred(cx, cy), display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {face ? <Face state={face} size={36} /> : null}
      <div
        style={{
          width: w,
          height: h,
          borderRadius: w / 2,
          background: "rgba(255,255,255,0.55)",
          border: "1.5px solid rgba(255,255,255,0.8)",
          boxShadow: "0 10px 26px rgba(70,74,140,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${f * 100}%`,
            background: `linear-gradient(180deg, ${color}, ${color}CC)`,
          }}
        />
      </div>
      <div style={{ fontFamily: font, fontSize: 18, fontWeight: 800, color: C.text }}>{label}</div>
      {amount ? (
        <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: C.dim, marginTop: -4 }}>{amount}</div>
      ) : null}
    </div>
  );
};

// ── VcSource ──────────────────────────────────────────────────────────────────
// The money tap: a gold coin glyph with an optional dollar figure.
export const VcSource: React.FC<{
  cx: number;
  cy: number;
  size?: number;
  label?: string;
  amount?: string;
}> = ({ cx, cy, size = 78, label = "VC", amount }) => (
  <div style={{ ...centred(cx, cy), display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: "linear-gradient(150deg, #F4C24B, #E8A13A)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        fontSize: size * 0.5,
        fontWeight: 800,
        color: "#fff",
        textShadow: "0 1px 2px rgba(120,80,10,0.4)",
        boxShadow: "0 12px 28px rgba(232,161,58,0.5), inset 0 1px 0 rgba(255,255,255,0.5)",
      }}
    >
      $
    </div>
    <div style={{ fontFamily: font, fontSize: 17, fontWeight: 700, color: C.dim }}>{label}</div>
    {amount ? (
      <div style={{ fontFamily: monoFont, fontSize: 16, fontWeight: 800, color: "#C2841E", marginTop: -4 }}>{amount}</div>
    ) : null}
  </div>
);

// ── VenueCard ─────────────────────────────────────────────────────────────────
// A company/venue. state drives the look; aura (0..1) scales the rebate glow
// behind it. An optional name + TVL dollar figure sit inside.
export type VenueState = "dark" | "funded" | "alive" | "bust";
export const VenueCard: React.FC<{
  cx: number;
  cy: number;
  state: VenueState;
  aura?: number;
  w?: number;
  h?: number;
  name?: string;
  tvl?: string;
  tint?: string;
}> = ({ cx, cy, state, aura = 0, w = 220, h = 150, name, tvl, tint = C.blue }) => {
  const dead = state === "bust";
  const alive = state === "alive";
  const opacity = state === "dark" ? 0.34 : dead ? 0.4 : 1;
  const glow = clamp01(aura);
  return (
    <div style={{ ...centred(cx, cy) }}>
      {glow > 0 ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: w + glow * 360,
            height: h + glow * 360,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(0,113,227,${0.34 * glow}) 0%, rgba(94,120,255,${0.18 * glow}) 40%, rgba(94,120,255,0) 70%)`,
            pointerEvents: "none",
          }}
        />
      ) : null}
      <div
        style={{
          position: "relative",
          width: w,
          height: h,
          borderRadius: 22,
          opacity,
          transform: dead ? "scale(0.92) rotate(-3deg)" : "none",
          background: dead
            ? "linear-gradient(160deg, rgba(150,152,165,0.5), rgba(120,122,138,0.34))"
            : "linear-gradient(160deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.46) 100%)",
          border: alive ? "1.5px solid transparent" : "1px solid rgba(255,255,255,0.6)",
          backgroundImage: alive
            ? `linear-gradient(160deg, rgba(255,255,255,0.78), rgba(255,255,255,0.5)), ${PILL_GRADIENT}`
            : undefined,
          backgroundOrigin: "border-box",
          backgroundClip: alive ? "padding-box, border-box" : undefined,
          boxShadow: alive
            ? "0 18px 44px rgba(94,120,255,0.4), inset 0 1px 0 rgba(255,255,255,0.9)"
            : "0 10px 28px rgba(70,74,140,0.16), inset 0 1px 0 rgba(255,255,255,0.85)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: 14,
            background: dead ? "rgba(120,122,138,0.6)" : `linear-gradient(150deg, ${tint}, ${tint}CC)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font,
            fontWeight: 800,
            fontSize: 24,
            color: "#fff",
          }}
        >
          {dead ? "✕" : name ? name.slice(0, 1) : ""}
        </div>
        {name ? (
          <div style={{ fontFamily: font, fontSize: 20, fontWeight: 800, color: dead ? C.faint : C.text }}>
            {name}
          </div>
        ) : null}
        {tvl ? (
          <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: dead ? C.faint : C.dim, marginTop: -4 }}>
            {dead ? "bust" : tvl}
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ── FlowStream ────────────────────────────────────────────────────────────────
// The A→B verb: a faint connector plus a comet of dots travelling along it.
// Self-animates from the frame clock; `active` (0..1) gates opacity. reverse
// flips the travel direction. The svg spans the whole board so coordinates match.
export const FlowStream: React.FC<{
  from: Pt;
  to: Pt;
  active?: number;
  color?: string;
  count?: number;
  reverse?: boolean;
  speed?: number;
  dotR?: number;
  boardW?: number;
  boardH?: number;
}> = ({
  from,
  to,
  active = 1,
  color = C.blue,
  count = 6,
  reverse = false,
  speed = 0.6,
  dotR = 6,
  boardW = W,
  boardH = H,
}) => {
  const frame = useCurrentFrame();
  const t = (frame / FPS) * speed;
  const a = clamp01(active);
  if (a <= 0) return null;
  return (
    <svg
      width={boardW}
      height={boardH}
      viewBox={`0 0 ${boardW} ${boardH}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={2}
        opacity={a * 0.22}
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      {Array.from({ length: count }).map((_, i) => {
        const phase = (t + i / count) % 1;
        const p = reverse ? 1 - phase : phase;
        const x = lerp(from.x, to.x, p);
        const y = lerp(from.y, to.y, p);
        return <circle key={i} cx={x} cy={y} r={dotR} fill={color} opacity={a * tri(phase) * 0.95} />;
      })}
    </svg>
  );
};

// ── GovBox ────────────────────────────────────────────────────────────────────
// A government enclosure that lowers and seals over a venue. drop 0..1 brings it
// down; a shield seal rides the top bar.
export const GovBox: React.FC<{
  cx: number;
  cy: number;
  drop: number;
  w?: number;
  h?: number;
}> = ({ cx, cy, drop, w = 300, h = 230 }) => {
  const d = clamp01(drop);
  const yOff = lerp(-h - 80, 0, d);
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        transform: `translate(-50%, calc(-50% + ${yOff.toFixed(1)}px))`,
        width: w,
        height: h,
        borderRadius: 24,
        border: "3px solid rgba(31,184,119,0.7)",
        boxShadow: "0 0 0 6px rgba(31,184,119,0.12), 0 18px 44px rgba(20,60,40,0.22)",
        background: "rgba(31,184,119,0.06)",
        opacity: d,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -28,
          left: "50%",
          transform: "translateX(-50%)",
          width: 56,
          height: 56,
          background: "linear-gradient(160deg, #2BD68A, #1FB877)",
          clipPath: "polygon(50% 0%, 100% 22%, 100% 60%, 50% 100%, 0% 60%, 0% 22%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: font,
          fontSize: 28,
          fontWeight: 800,
          color: "#fff",
          boxShadow: "0 8px 20px rgba(31,184,119,0.5)",
        }}
      >
        ★
      </div>
    </div>
  );
};

// ── BarTail ────────────────────────────────────────────────────────────────────
// A vertical bar graph descending into a long tail. Layout shared so a wall can
// both render the bars and aim flows at their tops.
export type BarTailParams = {
  n?: number;
  baselineY: number;
  startX: number;
  barW?: number;
  gap?: number;
  maxH?: number;
  decay?: number;
};
export type BarLayout = { cx: number; topY: number; h: number; baseY: number };

export const barTailLayout = (p: BarTailParams): BarLayout[] => {
  const { n = 18, baselineY, startX, barW = 34, gap = 16, maxH = 360, decay = 0.42 } = p;
  return Array.from({ length: n }).map((_, i) => {
    const h = Math.max(10, maxH / (1 + i * decay));
    const cx = startX + i * (barW + gap) + barW / 2;
    return { cx, topY: baselineY - h, h, baseY: baselineY };
  });
};

export const BarTail: React.FC<{
  params: BarTailParams;
  reveal?: number;
  highlight?: number;
}> = ({ params, reveal = 1, highlight = 0 }) => {
  const { barW = 34 } = params;
  const layout = barTailLayout(params);
  const n = layout.length;
  return (
    <>
      {layout.map((b, i) => {
        const stagger = clamp01(reveal * n - i);
        const h = b.h * stagger;
        const isWinner = i < highlight;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.cx - barW / 2,
              top: b.baseY - h,
              width: barW,
              height: h,
              borderRadius: `${barW / 2}px ${barW / 2}px 4px 4px`,
              background: isWinner
                ? PILL_GRADIENT
                : "linear-gradient(180deg, rgba(120,124,150,0.5), rgba(120,124,150,0.3))",
              boxShadow: isWinner ? "0 8px 22px rgba(94,120,255,0.4)" : "none",
            }}
          />
        );
      })}
    </>
  );
};

// ── GeneralLayer ────────────────────────────────────────────────────────────
// The platform layer: a translucent blue→violet plane that sweeps across a
// region. sweep 0..1 wipes it in from the left. A faint GM monogram marks it.
export const GeneralLayer: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  sweep: number;
}> = ({ x, y, w, h, sweep }) => {
  const s = clamp01(sweep);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 18,
        overflow: "hidden",
        clipPath: `inset(0 ${(1 - s) * 100}% 0 0)`,
        background: "linear-gradient(95deg, rgba(0,113,227,0.16), rgba(158,123,255,0.16))",
        border: "1.5px solid rgba(94,120,255,0.4)",
        boxShadow: "0 14px 40px rgba(94,120,255,0.24)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 28,
          top: 18,
          fontFamily: font,
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "rgba(94,120,255,0.6)",
        }}
      >
        ◇ General
      </div>
    </div>
  );
};

// ── GridWall ────────────────────────────────────────────────────────────────
// The matching engine drawn as a wall of order-book cells. One tile up close
// reads as a dense order grid; the whole wall reads as billions. The cell lines
// are CSS repeating-gradients so they stay crisp at any camera scale (no moiré).
// heat 0..1 ripples the wall green → amber → red as load climbs.
export const GridWall: React.FC<{
  x: number;
  y: number;
  cols: number;
  rows: number;
  tile: number;
  gap?: number;
  heat?: number;
  cellPitch?: number;
  seed?: number;
}> = ({ x, y, cols, rows, tile, gap = 6, heat = 0, cellPitch = 9, seed = 7 }) => {
  const rng = React.useMemo(() => {
    const r = mulberry32(seed);
    return Array.from({ length: cols * rows }, () => r());
  }, [cols, rows, seed]);
  const grid =
    `repeating-linear-gradient(0deg, rgba(13,30,72,0.45) 0 1px, transparent 1px ${cellPitch}px),` +
    `repeating-linear-gradient(90deg, rgba(13,30,72,0.45) 0 1px, transparent 1px ${cellPitch}px)`;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${tile}px)`,
        gridTemplateRows: `repeat(${rows}, ${tile}px)`,
        gap,
      }}
    >
      {rng.map((ph, i) => {
        const local = clamp01((heat - ph * 0.55) * 1.7);
        const base = heatColor(local);
        const glowK = local > 0.55 ? (local - 0.55) / 0.45 : 0;
        return (
          <div
            key={i}
            style={{
              width: tile,
              height: tile,
              background: base,
              backgroundImage: grid,
              borderRadius: 3,
              boxShadow:
                glowK > 0
                  ? `inset 0 0 0 1px rgba(255,255,255,0.18), 0 0 ${(glowK * 14).toFixed(0)}px rgba(242,86,107,${(glowK * 0.7).toFixed(2)})`
                  : "inset 0 0 0 1px rgba(255,255,255,0.18)",
            }}
          />
        );
      })}
    </div>
  );
};

// ── ShatterBurst ──────────────────────────────────────────────────────────────
// The wall breaking. A grid of shards bursts radially from a centre with manual
// physics (pos = vel·t + ½·g·t²), spinning and falling, reddened and depth-graded.
// t is seconds since detonation; ≤ 0 renders nothing.
interface Shard {
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  spin: number;
  size: number;
  tint: string;
  bright: number;
}
export const ShatterBurst: React.FC<{
  cx: number;
  cy: number;
  spreadW: number;
  spreadH: number;
  t: number;
  count?: number;
  seed?: number;
}> = ({ cx, cy, spreadW, spreadH, t, count = 130, seed = 909 }) => {
  // Shards are laid on a coarse grid covering the wall, so at t=0 they tile it
  // solidly (the wall, intact) and only fly apart as t climbs — a break, not a
  // scatter. Each carries the order-book grid texture so it reads as a chunk of
  // the wall, not confetti.
  const shards = React.useMemo<Shard[]>(() => {
    const r = mulberry32(seed);
    const cols = Math.max(4, Math.round(Math.sqrt(count * (spreadW / spreadH))));
    const rows = Math.max(4, Math.round(count / cols));
    const cw = spreadW / cols;
    const ch = spreadH / rows;
    const out: Shard[] = [];
    for (let yy = 0; yy < rows; yy++) {
      for (let xx = 0; xx < cols; xx++) {
        const ox = -spreadW / 2 + (xx + 0.5) * cw;
        const oy = -spreadH / 2 + (yy + 0.5) * ch;
        const dirx = ox / (spreadW / 2 || 1);
        const diry = oy / (spreadH / 2 || 1);
        const speed = 240 + r() * 520;
        out.push({
          ox,
          oy,
          vx: dirx * speed + (r() - 0.5) * 180,
          vy: diry * speed - 160 - r() * 200,
          spin: (r() - 0.5) * 420,
          size: Math.min(cw, ch) * (0.78 + r() * 0.34),
          tint: r() < 0.4 ? AMBER : RED,
          bright: 0.6 + r() * 0.45,
        });
      }
    }
    return out;
  }, [count, seed, spreadW, spreadH]);
  if (t <= 0) return null;
  const g = 820;
  const grid =
    "repeating-linear-gradient(0deg, rgba(13,30,72,0.4) 0 1px, transparent 1px 9px)," +
    "repeating-linear-gradient(90deg, rgba(13,30,72,0.4) 0 1px, transparent 1px 9px)";
  return (
    <>
      {shards.map((s, i) => {
        const px = cx + s.ox + s.vx * t;
        const py = cy + s.oy + s.vy * t + 0.5 * g * t * t;
        const rot = s.spin * t;
        const op = clamp01(1 - t * 0.42);
        if (op <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: s.size,
              height: s.size,
              transform: `translate(-50%, -50%) rotate(${rot.toFixed(1)}deg)`,
              background: s.tint,
              backgroundImage: grid,
              filter: `brightness(${s.bright})`,
              borderRadius: 4,
              opacity: op,
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
            }}
          />
        );
      })}
    </>
  );
};
