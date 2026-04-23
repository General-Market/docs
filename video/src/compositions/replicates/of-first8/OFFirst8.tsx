/**
 * OFFirst8 — Ordinary Folk / Bard promo, first 8 seconds
 *
 * REWRITTEN FROM SCRATCH. No GSAP, no Sequences.
 * One component. Absolute frame numbers. Pure interpolate().
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import { loadFont } from "@remotion/google-fonts/GoogleSans";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

const W = 1280;
const H = 720;
const CY = 0.493 * H;
const DARK = "#1A1A2E";
const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
function easeOut2(t: number) { const s = Math.max(0, Math.min(1, t)); return 1 - (1 - s) ** 2; }
function easeOut3(t: number) { const s = Math.max(0, Math.min(1, t)); return 1 - (1 - s) ** 3; }

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// ── background ───────────────────────────────────────────────────────────
const BG: React.FC = () => {
  const f = useCurrentFrame();
  const hs = interpolate(f, [0, 240], [0, 12], cl);
  const x1 = 30 + noise2D("a", f * 0.004, 0) * 10;
  const y1 = 45 + noise2D("b", 0, f * 0.003) * 8;
  const x2 = 82 + noise2D("c", f * 0.003, 1.5) * 8;
  const y2 = 28 + noise2D("d", 1.5, f * 0.004) * 6;
  return (
    <AbsoluteFill style={{
      background: `
        radial-gradient(ellipse 120% 100% at ${x1}% ${y1}%, hsla(${225 + hs},45%,90%,0.85), transparent 65%),
        radial-gradient(ellipse 70% 80% at ${x2}% ${y2}%, hsla(${340 + hs},30%,92%,0.6), transparent 60%),
        linear-gradient(135deg, #F0EDF6 0%, #FAFAFA 45%, #F6F2EF 100%)
      `,
    }} />
  );
};

// ── scatter data ─────────────────────────────────────────────────────────
const EXP = "experimenting".split("");
const EXP_DY = [-30, -22, -14, -6, 2, 10, 18, 24, 30, 35, 38, 41, 44];
const EXP_DX = [-30, -22, -15, -8, 0, 7, 13, 18, 22, 27, 30, 33, 35];

const SOLVE = "Solve\u00A0problems".split("");
// Positions measured from reference f180 — spread across full 1280x720
const SOLVE_SC = [
  { x: 250, y: 260, sz: 86 }, // S — large, left
  { x: 420, y: 290, sz: 44 }, // o
  { x: 340, y: 430, sz: 32 }, // l — below
  { x: 520, y: 250, sz: 46 }, // v
  { x: 650, y: 280, sz: 42 }, // e
  { x: 0, y: 0, sz: 50 },     // space
  { x: 480, y: 420, sz: 34 }, // p — below
  { x: 720, y: 260, sz: 40 }, // r
  { x: 820, y: 290, sz: 48 }, // o
  { x: 580, y: 180, sz: 56 }, // b — above
  { x: 440, y: 460, sz: 30 }, // l — below
  { x: 880, y: 270, sz: 44 }, // e
  { x: 950, y: 410, sz: 42 }, // m — lower right
  { x: 1020, y: 310, sz: 38 }, // s — far right
];
const SOLVE_CW = [31, 27, 14, 27, 25, 14, 27, 17, 27, 27, 14, 25, 36, 19];
const SOLVE_TW = SOLVE_CW.reduce((a, b) => a + b, 0);
const SOLVE_FX: number[] = [];
{ let r = W / 2 - SOLVE_TW / 2; for (let i = 0; i < SOLVE.length; i++) { SOLVE_FX.push(r + SOLVE_CW[i] / 2); r += SOLVE_CW[i]; } }

// Cloud extends FAR beyond viewport (1280x720). Reference shows words cropping off edges.
const CLOUD = [
  // HUGE edge-bleed copies — these MUST crop off screen
  { w: "Brainstorm", x: -900, y: 300, c: "#6B5FD8", sz: 110, wt: 700, bl: 2 },   // crops left+bottom
  { w: "ideas", x: 850, y: 340, c: "#C04868", sz: 100, wt: 700, bl: 1 },         // crops right+bottom
  { w: "Brainstorm", x: 750, y: -250, c: "#C04878", sz: 80, wt: 700, bl: 3 },    // upper right, partially off
  { w: "ideas", x: -700, y: -160, c: "#5F6BDA", sz: 76, wt: 500, bl: 2 },        // left, partially off
  // Mid-field
  { w: "Brainstorm", x: -120, y: -180, c: "#7B5BD0", sz: 48, wt: 500, bl: 4 },   // upper center
  { w: "ideas", x: 300, y: -120, c: "#A050A0", sz: 44, wt: 500, bl: 5 },         // upper right
  { w: "ideas", x: -300, y: 160, c: "#5F7FDA", sz: 52, wt: 500, bl: 3 },         // lower left
  { w: "Brainstorm", x: 400, y: 120, c: "#C04878", sz: 56, wt: 500, bl: 3 },     // right
  // Deep background — heavy blur
  { w: "Brainstorm", x: -500, y: 350, c: "#8060C0", sz: 40, wt: 400, bl: 14 },
  { w: "ideas", x: 550, y: -250, c: "#5F6BDA", sz: 34, wt: 400, bl: 16 },
  { w: "Brainstorm", x: 700, y: -80, c: "#C04878", sz: 36, wt: 400, bl: 15 },
  { w: "ideas", x: -650, y: -200, c: "#5F7FDA", sz: 38, wt: 400, bl: 13 },
  { w: "Brainstorm", x: -200, y: 380, c: "#7B5BD0", sz: 30, wt: 400, bl: 18 },
  { w: "ideas", x: 200, y: 280, c: "#A050A0", sz: 32, wt: 400, bl: 16 },
];

const WE_LETTERS = "Write\u00A0emails".split("");
const WE_CW: Record<string, number> = { W: 38, r: 18, i: 11, t: 15, e: 23, "\u00A0": 12, m: 36, a: 23, l: 11, s: 20 };
// From overlay f160: increase magnitude ~40% to match original positions
const WE_TARGETS = [
  { dx: -580, dy: -140, sz: 66 }, // W — far upper-left, LARGE, blue tint
  { dx: -180, dy: 55, sz: 50 },   // r
  { dx: -120, dy: 42, sz: 50 },   // i
  { dx: -260, dy: 190, sz: 50 },  // t — drops well below
  { dx: -70, dy: 28, sz: 50 },    // e
  { dx: 0, dy: 0, sz: 50 },       // space
  { dx: 10, dy: 28, sz: 50 },     // e
  { dx: 120, dy: 14, sz: 50 },    // m
  { dx: 330, dy: -130, sz: 56 },  // a — floats high right
  { dx: 240, dy: 42, sz: 50 },    // i
  { dx: 400, dy: 28, sz: 50 },    // l
  { dx: 550, dy: 14, sz: 56 },    // s — far right, pink tint
];
const WE_OFFSETS: number[] = [];
{ const ws = WE_LETTERS.map((c) => WE_CW[c] || 17); const tot = ws.reduce((a, b) => a + b, 0); let r = -tot / 2; for (let i = 0; i < ws.length; i++) { WE_OFFSETS.push(r + ws[i] / 2); r += ws[i]; } }

// =====================================================================
export const OFFirst8: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── P1: "You've" (f0–f11) ─────────────────────────────────────────
  const p1 = f <= 11;
  const p1x = interpolate(f, [0, 8], [30, 0], cl);

  // ── P2: "You've been experimenting with" (f8–f62) ─────────────────
  const p2 = f >= 8 && f <= 62;
  const p2f = f - 8;
  const beenOp = interpolate(p2f, [0, 6], [0, 1], cl);
  const withOp = interpolate(p2f, [14, 20], [0, 1], cl);
  const phShift = interpolate(p2f, [0, 30], [0, -100], cl); // start shifting immediately, more distance — overlay shows ~80px offset at f15
  const expL = EXP.map((ch, i) => {
    const as = 7 + i * 0.8; // delayed — reference shows letters barely visible at f15
    const op = interpolate(p2f, [as, as + 5], [0, 1], cl);
    // Position settles over ~35 frames (still shows displacement at f40 = p2f 32)
    // But COLOR settles faster — letters are dark by f35 = p2f 27
    const posSt = easeOut2(interpolate(p2f, [as + 3, as + 38], [0, 1], cl));
    const colSt = easeOut2(interpolate(p2f, [as + 2, as + 22], [0, 1], cl)); // color settles faster than position
    return {
      ch, op, dx: EXP_DX[i] * (1 - posSt), dy: EXP_DY[i] * (1 - posSt),
      sz: lerp(64, 50, posSt),
      col: `rgb(${Math.round(lerp(0x1a, 0x6b, 1 - colSt))},${Math.round(lerp(0x1a, 0x5f, 1 - colSt))},${Math.round(lerp(0x2e, 0xd8, 1 - colSt))})`,
    };
  });

  // ── P3: "Bard" (f63–f84) ──────────────────────────────────────────
  const p3 = f >= 63 && f <= 84;
  const p3f = f - 63;
  const bSc = interpolate(p3f, [0, 6], [0.94, 1], cl);
  const bXd = interpolate(p3f, [0, 6], [6, 0], cl);
  const bOp = p3f >= 17 ? interpolate(p3f, [17, 21], [1, 0], cl) : 1; // instant — full opacity from f63, fade out at f80
  const bPh = p3f / 30 * 2.0;
  const bCols = [0, 1, 2, 3].map((i) => {
    const pos = ((0.35 + i * 0.22 + bPh) % 1.0 + 1) % 1.0;
    const hue = pos < 0.5 ? lerp(240, 340, pos * 2) : lerp(340, 240, (pos - 0.5) * 2);
    const lum = interpolate(p3f, [16, 21], [0.55, 0.25], cl);
    return hsl2rgb(hue % 360, 0.55, Math.max(0.25, lum));
  });

  // ── P4: "to" + backspace (f85–f104) ───────────────────────────────
  const p4 = f >= 85 && f <= 104;
  const p4f = f - 85;
  const showO = p4f < 10;
  const showT = p4f < 14;
  const showCur4 = p4f >= 5;
  const cur4On = (p4f >= 9 && p4f <= 15) ? true : Math.floor(p4f / 5) % 2 === 0;

  // ── P5: Typewriter "Write" (f105–f129) ────────────────────────────
  const p5 = f >= 105 && f <= 129;
  const p5f = f - 105;
  const wCh = [
    { ch: "W", at: 0, c: [0x6b, 0x5b, 0xd8] },
    { ch: "r", at: 5, c: [0x90, 0x50, 0xc0] },
    { ch: "i", at: 9, c: [0xa8, 0x48, 0xa0] },
    { ch: "t", at: 12, c: [0xc0, 0x44, 0x82] },
    { ch: "e", at: 15, c: [0xd0, 0x40, 0x68] },
  ];
  const wVis = wCh.filter((w) => p5f >= w.at);
  const wDone = wVis.length === 5;
  const wCurOn = wDone ? interpolate(p5f, [20, 24], [1, 0], cl) > 0.5 : true;

  // ── P6: "Write emails" pill (f130–f162) ───────────────────────────
  const p6 = f >= 130 && f <= 154; // end before P7 scatter starts at f155
  const p6f = f - 130;
  const wrOp = interpolate(p6f, [0, 2], [0, 1], cl);
  const pBounce = p6f >= 3 ? spring({ frame: p6f - 3, fps, config: { damping: 12, stiffness: 180 } }) : 0;
  const pOp = interpolate(p6f, [3, 5, 18, 23], [0, 1, 1, 0], cl);
  const pX = lerp(30, 0, pBounce);
  const pY = lerp(8, 0, pBounce);
  const pSc = lerp(0.82, 1, pBounce);
  const edOp = interpolate(p6f, [18, 23], [0, 1], cl);

  // ── P7: Scatter → "Solve problems" (f155–f200) ────────────────────
  // Scatter starts at f155 (overlaps end of P6) — reference shows letters already scattered by f160
  const p7 = f >= 155 && f <= 200;
  const p7f = f - 155;
  const scProg = easeOut2(interpolate(p7f, [0, 12], [0, 1], cl));
  const scFade = interpolate(p7f, [8, 15], [1, 0], cl);
  const svApp = interpolate(p7f, [12, 16], [0, 1], cl);
  const svConv = easeOut3(interpolate(p7f, [16, 40], [0, 1], cl));

  // ── P8: "Brainstorm ideas" cloud (f198–f240) ──────────────────────
  const p8 = f >= 198;
  const p8f = f - 198;
  const clApp = interpolate(p8f, [0, 4], [0, 1], cl);
  const clDr = easeOut2(interpolate(p8f, [2, 30], [0, 1], cl));
  const clFd = interpolate(p8f, [15, 32], [1, 0], cl);
  const ftOp = interpolate(p8f, [10, 20], [0, 1], cl);
  const ftSc = interpolate(p8f, [10, 20], [0.96, 1], cl);

  return (
    <AbsoluteFill style={{ fontFamily, overflow: "hidden" }}>
      <BG />

      {p1 && <div style={{ position: "absolute", top: CY, left: W / 2, transform: `translate(calc(-50% + ${p1x}px), -50%)`, fontSize: 50, fontWeight: 400, color: DARK, letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>You{"\u2019"}ve</div>}

      {p2 && (
        <div style={{ position: "absolute", top: CY, left: "50%", transform: `translate(calc(-50% + ${phShift}px), -50%)`, fontSize: 50, fontWeight: 400, color: DARK, letterSpacing: "-0.2px", whiteSpace: "nowrap", display: "flex", alignItems: "baseline", gap: 13 }}>
          <span>You{"\u2019"}ve</span>
          <span style={{ opacity: beenOp }}>been</span>
          <span style={{ display: "inline-flex", alignItems: "baseline" }}>
            {expL.map((l, i) => <span key={i} style={{ display: "inline-block", opacity: l.op, transform: `translate(${l.dx}px, ${l.dy}px)`, fontSize: l.sz, color: l.col, lineHeight: 1 }}>{l.ch}</span>)}
          </span>
          <span style={{ opacity: withOp }}>with</span>
        </div>
      )}

      {p3 && (
        <div style={{ position: "absolute", top: H / 2, left: W / 2, transform: `translate(calc(-50% + ${bXd}px), -50%) scale(${bSc})`, fontSize: 105, fontWeight: 400, letterSpacing: "-1.5px", opacity: bOp, whiteSpace: "nowrap", display: "inline-flex" }}>
          {"Bard".split("").map((ch, i) => { const [r, g, b] = bCols[i]; return <span key={i} style={{ color: `rgb(${r},${g},${b})` }}>{ch}</span>; })}
        </div>
      )}

      {p4 && (
        <div style={{ position: "absolute", top: CY, left: W / 2, transform: "translate(-50%, -50%)", fontSize: 50, fontWeight: 400, color: DARK, letterSpacing: "-0.2px", whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>
          <span>{showT && "t"}{showO && "o"}</span>
          {showCur4 && <span style={{ display: "inline-block", width: 2.5, height: 44, backgroundColor: DARK, marginLeft: 2, opacity: cur4On ? 1 : 0 }} />}
        </div>
      )}

      {p5 && (
        <div style={{ position: "absolute", top: CY, left: W / 2, transform: "translate(-50%, -50%)", fontSize: 50, fontWeight: 400, color: DARK, letterSpacing: "-0.2px", whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>
          {wVis.map((w, i) => <span key={i} style={{ color: `rgb(${w.c[0]},${w.c[1]},${w.c[2]})` }}>{w.ch}</span>)}
          <span style={{ display: "inline-block", width: 2.5, height: 44, backgroundColor: DARK, marginLeft: 2, opacity: wCurOn ? 1 : 0 }} />
        </div>
      )}

      {p6 && (
        <div style={{ position: "absolute", top: CY, left: "50%", transform: "translate(-50%, -50%)", fontSize: 50, fontWeight: 400, color: DARK, letterSpacing: "-0.2px", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#111", opacity: wrOp }}>Write</span>
          {pOp > 0.01 && <span style={{ display: "inline-block", opacity: pOp, transform: `translate(${pX}px, ${pY}px) scale(${pSc})` }}><span style={{ display: "inline-block", background: "linear-gradient(90deg, #D04878, #A858B8, #6878E0)", padding: "6px 14px", borderRadius: 4, color: "#FFF", fontSize: 50, fontWeight: 400, lineHeight: 1.2 }}>emails</span></span>}
          {edOp > 0.01 && <span style={{ opacity: edOp }}>emails</span>}
        </div>
      )}

      {p7 && (
        <AbsoluteFill>
          {scFade > 0.01 && WE_LETTERS.map((ch, i) => {
            const t = WE_TARGETS[i];
            const sz = lerp(50, t.sz, scProg);
            return (
              <div key={`w${i}`} style={{ position: "absolute", top: CY, left: "50%", transform: `translate(calc(-50% + ${WE_OFFSETS[i] + t.dx * scProg}px), calc(-50% + ${t.dy * scProg}px))`, fontFamily, fontSize: sz, fontWeight: 400, color: DARK, opacity: scFade, letterSpacing: "-0.2px" }}>{ch}</div>
            );
          })}
          {SOLVE.map((ch, i) => {
            if (ch === "\u00A0") return null;
            const sc = SOLVE_SC[i];
            const tint = i === 0 ? (1 - svConv) : 0;
            return (
              <div key={`s${i}`} style={{ position: "absolute", top: lerp(sc.y, CY, svConv), left: lerp(sc.x, SOLVE_FX[i], svConv), transform: "translate(-50%, -50%)", fontFamily, fontSize: lerp(sc.sz, 50, svConv), fontWeight: 400, color: `rgb(${Math.round(lerp(0x1a, 0x60, tint))},${Math.round(lerp(0x1a, 0x58, tint))},${Math.round(lerp(0x2e, 0xc0, tint))})`, opacity: svApp, letterSpacing: "-0.2px" }}>{ch}</div>
            );
          })}
        </AbsoluteFill>
      )}

      {p8 && (
        <AbsoluteFill>
          {CLOUD.map((cw, i) => (
            <div key={i} style={{ position: "absolute", top: CY, left: "50%", transform: `translate(calc(-50% + ${lerp(cw.x, cw.x * 0.08, clDr)}px), calc(-50% + ${lerp(cw.y, cw.y * 0.08, clDr)}px))`, fontFamily, fontSize: cw.sz, fontWeight: cw.wt, color: cw.c, whiteSpace: "nowrap", opacity: clApp * (i < 4 ? 0.95 : i < 7 ? 0.7 : 0.45) * clFd, filter: cw.bl > 0 ? `blur(${cw.bl}px)` : undefined }}>{cw.w}</div>
          ))}
          <div style={{ position: "absolute", top: CY, left: "50%", transform: `translate(-50%, -50%) scale(${ftSc})`, fontSize: 50, fontWeight: 400, color: DARK, letterSpacing: "-0.2px", whiteSpace: "nowrap", opacity: ftOp }}>Brainstorm ideas</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const ofFirst8Meta = {
  id: "OFFirst8",
  component: OFFirst8,
  width: W,
  height: H,
  fps: 30,
  durationInFrames: 240,
};
