import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { FIELD_BG } from "./chrome";
import { BrandMark } from "../../components/BrandMark";
import { C, EASE, font, FPS, H, monoFont, sec, W } from "./theme";

// ── StrategyFlipDiagram — the sketch, kept honest: two stacked rows per exploit,
// BEFORE on top and AFTER below, so the difference sits in front of you the way
// it does on the whiteboard. One continuous board the camera flies over.
//
// The reveal is sequenced the way the lesson is taught:
//   1. the first line lands  — You lose, the cheat wins, under the old product;
//   2. the second line lands — same two people, the result inverted, under the
//      new product;
//   3. the grid shows the difference — big BEFORE / AFTER, and the mechanism that
//      flipped it (one market → ten thousand; price on the trade → price sealed).
//
//   ACT 1 — INFORMATION.  The insider who knows the Trump trade beats one
//     directional bet while there is ONE market. Trade ten thousand at once and
//     his single secret is worth nothing.
//   ACT 2 — SPEED.  The hedge fund that spent $1B on infrastructure beats you
//     while the price is revealed ON the trade. Seal it — reveal it AFTER — and
//     there is nothing left to race.
//
// Pastel-glass world, blue dot lattice, the BatchSettleDiagram camera.

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ci = (frame: number, a: number, b: number, from: number, to: number, easing?: (t: number) => number): number =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const pop = (frame: number, start: number, cfg = { damping: 13, stiffness: 160, mass: 0.7 }): number =>
  start == null ? 1 : spring({ frame: frame - start, fps: FPS, config: cfg });

// ── board geometry — one wide surface; two exploits laid out left → right ─────
const BW = 3360;
const BH = H;
const ACT1_CX = 820;
const ACT2_CX = 2520;
const BOTH_CX = 1690;

// columns within an exploit (relative to its centre)
const DX_LABEL = -560; // the big BEFORE / AFTER word
const DX_YOU = -250;
const DX_OPP = -20;
const DX_MECH = 430; // the product + the mechanism that proves the difference

// the two rows
const Y_BEFORE = 330;
const Y_AFTER = 706;
const FIG_SCALE = 0.7;
const TAG_DY = -140;
const NAME_DY = 128;

// ── timeline (frames @60) ─────────────────────────────────────────────────────
const T = {
  a1Before: [0, sec(0.9)] as [number, number],
  a1After: [sec(2.1), sec(3.0)] as [number, number],
  a1Grid: [sec(4.4), sec(5.8)] as [number, number],
  glide: [sec(8.0), sec(9.6)] as [number, number],
  a2Before: [sec(9.2), sec(10.1)] as [number, number],
  a2After: [sec(11.3), sec(12.2)] as [number, number],
  a2Grid: [sec(13.6), sec(15.0)] as [number, number],
  pullBack: [sec(17.0), sec(18.6)] as [number, number],
};
const TOTAL = sec(20.4);

// ── internal camera — keyframed glide over the board ──────────────────────────
const CAM = Easing.bezier(0.5, 0, 0.2, 1);
type Key = { at: number; cx: number; cy: number; scale: number };
const KEYS: Key[] = [
  { at: 0, cx: ACT1_CX, cy: 540, scale: 1.0 },
  { at: T.glide[0], cx: ACT1_CX, cy: 540, scale: 1.0 },
  { at: T.glide[1], cx: ACT2_CX, cy: 540, scale: 1.0 },
  { at: T.pullBack[0], cx: ACT2_CX, cy: 540, scale: 1.0 },
  { at: T.pullBack[1], cx: BOTH_CX, cy: 540, scale: 0.6 }, // both exploits, both rows
  { at: TOTAL, cx: BOTH_CX, cy: 540, scale: 0.6 },
];
const cameraAt = (frame: number): { cx: number; cy: number; scale: number } => {
  if (frame <= KEYS[0].at) return KEYS[0];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i];
    const b = KEYS[i + 1];
    if (frame <= b.at) {
      const p = a.at === b.at ? 1 : CAM(clamp01((frame - a.at) / (b.at - a.at)));
      return { cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p), scale: lerp(a.scale, b.scale, p) };
    }
  }
  return KEYS[KEYS.length - 1];
};

const place = (left: number, top: number): React.CSSProperties => ({
  position: "absolute",
  left,
  top,
  transform: "translate(-50%,-50%)",
});

const glass = (radius: number): React.CSSProperties => ({
  background: "linear-gradient(160deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.44) 100%)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: radius,
  boxShadow: "0 10px 28px rgba(70,74,140,0.14), inset 0 1px 0 rgba(255,255,255,0.86)",
});

const Bloom: React.FC<{ x: number; y: number; r: number; color: string; op: number }> = ({ x, y, r, color, op }) =>
  op <= 0.01 ? null : (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
        opacity: op,
        filter: "blur(8px)",
        pointerEvents: "none",
      }}
    />
  );

// ── the ink stick figure — head, spine, arms, legs (the sketch's hand) ─────────
const StickPerson: React.FC<{ scale?: number; ink?: string; draw?: number }> = ({ scale = 1, ink = C.text, draw = 1 }) => {
  const op = clamp01(draw);
  return (
    <svg width={150 * scale} height={250 * scale} viewBox="0 0 150 250" style={{ overflow: "visible", opacity: op }}>
      <g fill="none" stroke={ink} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={75} cy={46} r={32} />
        <line x1={75} y1={78} x2={75} y2={156} />
        <line x1={75} y1={98} x2={34} y2={134} />
        <line x1={75} y1={98} x2={116} y2={134} />
        <line x1={75} y1={156} x2={36} y2={232} />
        <line x1={75} y1={156} x2={114} y2={232} />
      </g>
    </svg>
  );
};

// ── the Win / Lose pill ────────────────────────────────────────────────────────
const ResultTag: React.FC<{ cx: number; cy: number; win: boolean; start: number }> = ({ cx, cy, win, start }) => {
  const frame = useCurrentFrame();
  if (frame < start) return null;
  const s = pop(frame, start, { damping: 11, stiffness: 175, mass: 0.7 });
  const op = ci(frame, start, start + 8, 0, 1);
  const col = win ? C.up : C.down;
  return (
    <div style={{ ...place(cx, cy), opacity: op }}>
      <div
        style={{
          transform: `scale(${clamp01(s).toFixed(3)})`,
          padding: "7px 24px",
          borderRadius: 999,
          background: `${col}1f`,
          border: `2.5px solid ${col}`,
          fontFamily: font,
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "0.02em",
          color: col,
          whiteSpace: "nowrap",
        }}
      >
        {win ? "WIN" : "LOSE"}
      </div>
    </div>
  );
};

// ── a figure in a row — stick person, the result above, the name below ─────────
// a losing figure can carry a `note` (the sketch's "?????" — its own excuse).
const Figure: React.FC<{ cx: number; cy: number; name: string; sub: string; accent: string; win: boolean; start: number; note?: string }> = ({
  cx,
  cy,
  name,
  sub,
  accent,
  win,
  start,
  note,
}) => {
  const frame = useCurrentFrame();
  const draw = ci(frame, start, start + sec(0.5), 0, 1, EASE.out);
  const op = ci(frame, start, start + sec(0.4), 0, 1);
  const glow = win ? ci(frame, start, start + sec(0.5), 0, 0.85) : 0;
  return (
    <>
      <Bloom x={cx} y={cy} r={150} color={`${C.up}40`} op={glow} />
      <ResultTag cx={cx} cy={cy + TAG_DY} win={win} start={start + sec(0.18)} />
      <div style={{ ...place(cx, cy), opacity: op * (win ? 1 : 0.74), zIndex: 10 }}>
        <StickPerson scale={FIG_SCALE} ink={C.text} draw={draw} />
      </div>
      <div style={{ ...place(cx, cy + NAME_DY), opacity: op, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <div style={{ fontFamily: font, fontSize: 25, fontWeight: 800, color: accent, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{name}</div>
        {note ? (
          <div style={{ fontFamily: font, fontSize: 17, fontWeight: 700, color: C.down, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>“{note}”</div>
        ) : (
          <div style={{ fontFamily: monoFont, fontSize: 14, fontWeight: 700, color: C.dim, whiteSpace: "nowrap" }}>{sub}</div>
        )}
      </div>
    </>
  );
};

// ── the mechanism cell — the product, and the thing that proves the difference ─
type MechKind = "info" | "speed";
const MechCell: React.FC<{ cx: number; cy: number; kind: MechKind; after: boolean; start: number; grow: number }> = ({
  cx,
  cy,
  kind,
  after,
  start,
  grow,
}) => {
  const frame = useCurrentFrame();
  if (frame < start) return null;
  const s = pop(frame, start, { damping: 13, stiffness: 150, mass: 0.7 });
  const op = ci(frame, start, start + 10, 0, 1);
  const accent = after ? C.blue : C.faint;
  const W_CELL = 452;
  const H_CELL = 244;

  const label =
    kind === "info" ? (after ? "10,000 MARKETS AT ONCE" : "1 MARKET") : after ? "PRICE REVEALED AFTER TRADE" : "PRICE REVEALED ON TRADE";

  return (
    <div style={{ ...place(cx, cy), opacity: op, transform: `translate(-50%,-50%) scale(${lerp(0.84, 1, clamp01(s)).toFixed(3)})` }}>
      <div
        style={{
          width: W_CELL,
          height: H_CELL,
          ...glass(22),
          border: `2.5px solid ${accent}`,
          boxShadow: after
            ? `0 16px 40px rgba(0,113,227,0.18), 0 0 ${(14 + grow * 40).toFixed(0)}px ${C.blue}33, inset 0 1px 0 rgba(255,255,255,0.86)`
            : "0 12px 30px rgba(70,74,140,0.14), inset 0 1px 0 rgba(255,255,255,0.86)",
          display: "flex",
          flexDirection: "column",
          padding: 18,
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontFamily: monoFont, fontSize: 14, fontWeight: 700, letterSpacing: "0.13em", color: after ? C.blue : C.faint }}>THE PRODUCT</div>
        <div style={{ fontFamily: font, fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.01em", marginTop: 4, lineHeight: 1.05 }}>{label}</div>
        <div style={{ position: "relative", flex: 1, marginTop: 10 }}>
          {kind === "info" ? <InfoMech after={after} grow={grow} /> : <SpeedMech after={after} grow={grow} />}
        </div>
      </div>
    </div>
  );
};

// ACT 1's proof — one market, or ten thousand of them
const G_COLS = 18;
const G_ROWS = 7;
const INFO_SEED = { c: 4, r: 2 }; // off-centre, so the one known market reads as a lone tile
const InfoMech: React.FC<{ after: boolean; grow: number }> = ({ after, grow }) => {
  if (!after) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 220, height: 78, ...glass(12), border: `2px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", padding: 10, boxSizing: "border-box" }}>
          <div style={{ fontFamily: font, fontSize: 19, fontWeight: 700, color: C.text, textAlign: "center", lineHeight: 1.1 }}>Will Trump cut rates?</div>
        </div>
      </div>
    );
  }
  const cells = [];
  for (let r = 0; r < G_ROWS; r++) {
    for (let c = 0; c < G_COLS; c++) {
      const dist = Math.hypot(c - INFO_SEED.c, r - INFO_SEED.r) / Math.hypot(G_COLS, G_ROWS);
      const seed = c === INFO_SEED.c && r === INFO_SEED.r;
      // the one known market is there from the start; the field grows around it
      const reveal = seed ? 1 : clamp01((grow - dist * 0.7) / 0.3);
      cells.push({ c, r, reveal, seed });
    }
  }
  const count = Math.round(Math.pow(10, lerp(0, 4, clamp01(grow))));
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: `repeat(${G_COLS}, 1fr)`, gridTemplateRows: `repeat(${G_ROWS}, 1fr)`, gap: 3 }}>
        {cells.map(({ reveal, seed }, i) => (
          <div
            key={i}
            style={{
              borderRadius: 3,
              background: seed ? "#FF8A4C30" : `${C.blue}16`,
              border: `1px solid ${seed ? "#FF8A4C" : `${C.blue}3a`}`,
              opacity: reveal * (seed ? 1 : 0.7),
              boxShadow: seed ? "0 0 12px #FF8A4C88" : "none",
            }}
          />
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: clamp01((grow - 0.02) * 6) }}>
        <div style={{ fontFamily: font, fontSize: 50, fontWeight: 800, color: C.blue, fontVariantNumeric: "tabular-nums", textShadow: "0 2px 14px rgba(240,242,244,0.95), 0 0 18px rgba(240,242,244,0.95)" }}>
          {count.toLocaleString("en-US")}
        </div>
      </div>
    </div>
  );
};

// ACT 2's proof — the price visible and raced, or sealed and dead
const SpeedMech: React.FC<{ after: boolean; grow: number }> = ({ after, grow }) => {
  const frame = useCurrentFrame();
  if (!after) {
    const phase = ((frame / sec(0.85)) % 1 + 1) % 1;
    const x = lerp(96, 4, phase);
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div style={{ fontFamily: font, fontSize: 34, fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums" }}>$104,280</div>
        <svg width={100} height={30} style={{ overflow: "visible" }}>
          <line x1={0} y1={15} x2={100} y2={15} stroke="rgba(60,64,130,0.16)" strokeWidth={2} />
          <circle cx={x} cy={15} r={6} fill="#FF7A59" />
          <path d="M 12 8 L 4 15 L 12 22" fill="none" stroke="#FF7A59" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ position: "relative", fontFamily: font, fontSize: 34, fontWeight: 800, color: C.faint, fontVariantNumeric: "tabular-nums", filter: `blur(${(grow * 7).toFixed(1)}px)`, opacity: 1 - grow * 0.6 }}>
        $104,280
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: grow, transform: `translateY(${((1 - grow) * -26).toFixed(0)}px)` }}>
        <svg width={40} height={44} viewBox="0 0 42 46">
          <rect x={6} y={20} width={30} height={22} rx={5} fill="none" stroke={C.dim} strokeWidth={4} />
          <path d="M12 20 V14 a9 9 0 0 1 18 0 V20" fill="none" stroke={C.dim} strokeWidth={4} strokeLinecap="round" />
          <circle cx={21} cy={30} r={3.4} fill={C.dim} />
        </svg>
        <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 800, letterSpacing: "0.12em", color: C.dim }}>SEALED</div>
      </div>
    </div>
  );
};

// ── the BIG before / after word, far left of each row ──────────────────────────
const BigBA: React.FC<{ cx: number; cy: number; text: string; color: string; start: number }> = ({ cx, cy, text, color, start }) => {
  const frame = useCurrentFrame();
  if (frame < start) return null;
  const s = pop(frame, start, { damping: 12, stiffness: 150, mass: 0.8 });
  const op = ci(frame, start, start + 10, 0, 1);
  return (
    <div style={{ ...place(cx, cy), opacity: op, transform: `translate(-50%,-50%) scale(${lerp(0.7, 1, clamp01(s)).toFixed(3)})` }}>
      <div style={{ fontFamily: font, fontSize: 58, fontWeight: 800, letterSpacing: "0.04em", color, whiteSpace: "nowrap", textShadow: `0 2px 16px ${color}33` }}>{text}</div>
    </div>
  );
};

// ── a faint band behind a row — red for the losing line, green for the winning ─
const RowBand: React.FC<{ cx: number; cy: number; tint: string; op: number }> = ({ cx, cy, tint, op }) =>
  op <= 0.01 ? null : (
    <div
      style={{
        position: "absolute",
        left: cx - 740,
        top: cy - 168,
        width: 1480,
        height: 336,
        borderRadius: 26,
        background: `${tint}0c`,
        border: `1px solid ${tint}26`,
        opacity: op,
      }}
    />
  );

// ── one exploit — two stacked rows, the second a mirror of the first ──────────
type ActCfg = {
  cx: number;
  kind: MechKind;
  oppName: string;
  oppSub: string;
  oppAccent: string;
  speech: string;
  rowBefore: [number, number];
  rowAfter: [number, number];
  grid: [number, number];
};

const Act: React.FC<{ cfg: ActCfg }> = ({ cfg }) => {
  const frame = useCurrentFrame();
  const { cx } = cfg;
  if (frame < cfg.rowBefore[0]) return null;

  const beforeIn = ci(frame, cfg.rowBefore[0], cfg.rowBefore[1], 0, 1, EASE.out);
  const afterIn = ci(frame, cfg.rowAfter[0], cfg.rowAfter[1], 0, 1, EASE.out);
  const grow = ci(frame, cfg.grid[0], cfg.grid[1], 0, 1, EASE.inOut);

  return (
    <>
      <RowBand cx={cx} cy={Y_BEFORE} tint={C.down} op={beforeIn * 0.9} />
      <RowBand cx={cx} cy={Y_AFTER} tint={C.up} op={afterIn * 0.9} />

      {/* the BIG before / after — lands with the grid, the third beat */}
      <BigBA cx={cx + DX_LABEL} cy={Y_BEFORE} text="BEFORE" color={C.down} start={cfg.grid[0]} />
      <BigBA cx={cx + DX_LABEL} cy={Y_AFTER} text="AFTER" color={C.up} start={cfg.grid[0] + sec(0.25)} />

      {/* BEFORE line — You lose, the cheat wins, under the old product */}
      <Figure cx={cx + DX_YOU} cy={Y_BEFORE} name="You" sub="one directional bet" accent={C.blue} win={false} start={cfg.rowBefore[0]} />
      <Figure cx={cx + DX_OPP} cy={Y_BEFORE} name={cfg.oppName} sub={cfg.oppSub} accent={cfg.oppAccent} win={true} start={cfg.rowBefore[0] + sec(0.12)} />
      <MechCell cx={cx + DX_MECH} cy={Y_BEFORE} kind={cfg.kind} after={false} start={cfg.rowBefore[0] + sec(0.3)} grow={0} />

      {/* AFTER line — same two, the result inverted, under the new product */}
      <Figure cx={cx + DX_YOU} cy={Y_AFTER} name="You" sub="one directional bet" accent={C.blue} win={true} start={cfg.rowAfter[0]} />
      <Figure
        cx={cx + DX_OPP}
        cy={Y_AFTER}
        name={cfg.oppName}
        sub={cfg.oppSub}
        accent={cfg.oppAccent}
        win={false}
        start={cfg.rowAfter[0] + sec(0.12)}
        note={frame >= cfg.grid[0] ? cfg.speech : undefined}
      />
      <MechCell cx={cx + DX_MECH} cy={Y_AFTER} kind={cfg.kind} after={true} start={cfg.rowAfter[0] + sec(0.3)} grow={grow} />
    </>
  );
};

const ACTS: ActCfg[] = [
  {
    cx: ACT1_CX,
    kind: "info",
    oppName: "The insider",
    oppSub: "knows the Trump trade",
    oppAccent: "#6E5BFF",
    speech: "I only know one market.",
    rowBefore: T.a1Before,
    rowAfter: T.a1After,
    grid: T.a1Grid,
  },
  {
    cx: ACT2_CX,
    kind: "speed",
    oppName: "The hedge fund",
    oppSub: "$1B in infrastructure",
    oppAccent: "#FF7A59",
    speech: "My edge was only speed.",
    rowBefore: T.a2Before,
    rowAfter: T.a2After,
    grid: T.a2Grid,
  },
];

export const StrategyFlipDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = cameraAt(frame);
  const eff = cam.scale;
  const tx = W / 2 - cam.cx * eff;
  const ty = H / 2 - cam.cy * eff;

  const eyebrowOp = ci(frame, sec(0.4), sec(1.2), 0, 1) * ci(frame, T.pullBack[0], T.pullBack[1], 1, 0.45);

  return (
    <AbsoluteFill style={{ background: FIELD_BG, fontFamily: font }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(120% 90% at 50% -10%, rgba(0,113,227,0.10) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />
      <BrandMark surface="light" />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: BW,
          height: BH,
          transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${eff.toFixed(5)})`,
          transformOrigin: "0 0",
          willChange: "transform",
          background: FIELD_BG,
          backgroundImage: "radial-gradient(circle, rgba(0,113,227,0.22) 1.2px, transparent 1.5px)",
          backgroundSize: "14px 14px",
        }}
      >
        {ACTS.map((cfg) => (
          <Act key={cfg.cx} cfg={cfg} />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          top: 46,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: eyebrowOp,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontFamily: monoFont, fontSize: 19, fontWeight: 700, letterSpacing: "0.22em", color: C.faint }}>
          SAME MARKET · SAME STRATEGY · CHANGE THE PRODUCT
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const strategyFlipDiagramMeta = {
  id: "StrategyFlipDiagram",
  component: StrategyFlipDiagram,
  durationInFrames: TOTAL,
  fps: FPS,
  width: W,
  height: H,
};
