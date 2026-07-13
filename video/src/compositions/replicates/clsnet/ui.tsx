import React from "react";
import { interpolate } from "remotion";
import { C } from "./data";
import { useBrand } from "./brand";
import { TracedArt } from "./TracedArt";

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const lerp = (
  frame: number,
  range: [number, number],
  out: [number, number],
) => interpolate(frame, range, out, clamp);

// ─── Hexagon (pointed left/right, flat top/bottom) ───
export const hexPoints = (w: number, h: number) =>
  `${0.25 * w},1.5 ${0.75 * w},1.5 ${w - 1.5},${h / 2} ${0.75 * w},${h - 1.5} ${0.25 * w},${h - 1.5} 1.5,${h / 2}`;

export const Hexagon: React.FC<{
  cx: number;
  cy: number;
  w: number;
  h?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  opacity?: number;
  drawP?: number; // 0-1 outline draw progress
  children?: React.ReactNode;
}> = ({
  cx,
  cy,
  w,
  h = w * 0.906,
  stroke = C.navy,
  strokeWidth = 3,
  fill = "none",
  opacity = 1,
  drawP = 1,
  children,
}) => {
  if (opacity <= 0) return null;
  const per = 4 * Math.hypot(0.25 * w, h / 2) * 0.5 + w; // approx perimeter
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", left: cx - w / 2, top: cy - h / 2, opacity, overflow: "visible" }}
    >
      {children}
      <polygon
        points={hexPoints(w, h)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeDasharray={drawP < 1 ? per : undefined}
        strokeDashoffset={drawP < 1 ? per * (1 - drawP) : undefined}
      />
    </svg>
  );
};

// Hexagon with white fill + traced art clipped inside.
export const HexIcon: React.FC<{
  art: string;
  cx: number;
  cy: number;
  w: number;
  opacity?: number;
  artScale?: number;
  drawP?: number;
}> = ({ art, cx, cy, w, opacity = 1, artScale, drawP = 1 }) => {
  if (opacity <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity }}>
      <TracedArt
        name={art}
        x={cx - w / 2}
        y={cy - (w * 0.906) / 2}
        scale={artScale ?? w / 340}
      />
      {drawP < 1 && <Hexagon cx={cx} cy={cy} w={w} drawP={drawP} stroke="rgba(0,39,83,0.001)" />}
    </div>
  );
};

// ─── CLSNet logo box ───
// Geometry re-measured r8: the ref box is SQUARE at every site (f400
// 268.5², f1520 154², f2330 335², f2600 164², f2762 200.5²) — the r1
// h=(w/274)*300*0.94 formula rendered every box 3-6% too tall. `w` stays
// the ART-crop width (274 native) so the traced diamond/dot alignment
// (pixel-exact at f400) is untouched; the box rect is 0.98·w square.
// `side` overrides the square for sites measured off the 0.98 ratio
// (strip2 = 200.5 for w=200); artDx/artDy are per-site measured content
// nudges (ref strip2 draws the diamond +3/+4 vs pure scaling — human
// layout, confirmed dot AND diamond offset together).
// ─── r18: the LABEL is a property of the box, not of the call site ───
// Every site drew it 8px right and ~20% small. Measured ref-vs-render at SIX
// sites (ink bboxes, th=160 on both — one predicate family):
//   site         boxSide   ref labelCtr−boxCtr   ratio    ref inkH   ref fs   we drew
//   flows f400     269           −6.0          −0.0223      36        46.7      48.0
//   locks f1740    221           −5.0          −0.0226      30        38.9      39.2
//   match f1600    156           −4.0          −0.0256      21        27.2      22.0
//   pay   f2560    166           −4.0          −0.0241      22        28.5      26.0
//   detail f2360   331           −7.5          −0.0227      44        57.1      45.8
//   gantt f2320    516*          −             −            69        89.5      73.3
// TWO laws, and each holds at every site:
//   POSITION  the ref seats the label's advance centre 2.26% of the box side
//             LEFT of the box centre. We centred it on `w` — itself 2.75·scale
//             RIGHT of the box centre (box = 0.98·w) — so the ink landed a flat
//             8px right EVERYWHERE (subpixel profile fit: dx = 8.00 at flows AND
//             at locks, ncc 0.998).
//   SIZE      fs = 47·scale reproduces every ref fs above to ±1px. The same
//             profile fit reads our glyphs 2.25%/1.90% wide and 2.6%/1.5% tall at
//             the two default-fs sites → fs 46.94/47.11. Default 48 → 47.
//
// LEGACY ESCAPE HATCH. Both laws are anchored to the BOX, so a site whose box is
// misplaced inherits the error — and a bigger, correctly-centred label on a
// misplaced box is MORE misplaced ink, which loses (lesson 4). Three of the four
// `labelFs` sites have exactly that: match's box is 9px low and 4px narrow (ref
// x769 y341 side 156; we draw x768 y350 side 152), detail's is 7px low and 9px
// narrow (ref x794 y475 side 331; we draw x795 y482 side 322), and gantt's is
// keyframed off it. Applying the law there took the match label crop from .459 to
// .254 — the box error swamps the label. So: **passing `labelFs` opts the site
// out of both laws** (it keeps its hand-fit size and the old centring), and the
// law lands wherever the box is already true — flows, tradeDocs, locks.
// TO THE OWNERS OF scenesB / scenesC / data.ts: fix the box, delete `labelFs`,
// and the site adopts the law for free. Payment is the cheap one — its box is
// already right (ref x876 side 166; we draw x875 side 166.6), so deleting
// `labelFs={26}` alone is worth ~+0.003 on its crop, measured.
export const ClsNetBox: React.FC<{
  x: number;
  y: number;
  w?: number;
  opacity?: number;
  label?: boolean;
  /** legacy hand-fit; passing it opts this site out of BOTH label laws */
  labelFs?: number;
  labelDx?: number;
  border?: "none" | "orange";
  bg?: string;
  markP?: number;
  side?: number;
  artDx?: number;
  artDy?: number;
}> = ({ x, y, w = 274, opacity = 1, label = true, labelFs, labelDx, border = "none", bg = C.navy, markP = 1, side, artDx = 0, artDy = 0 }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  const scale = w / 274;
  const box = side ?? (268.5 / 274) * w;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity }}>
      <div
        style={{
          position: "absolute",
          width: box,
          height: box,
          // outer radius measured 21-22px native at BOTH f400 (navy box,
          // arc ends 21px below top) and f2762 (orange border, arc 15px at
          // scale .73); the r1 value 40 was eyeballed
          borderRadius: 22 * scale,
          backgroundColor: bg,
          // ref strip2 border measured 6px thick at w=200 (x860-865 of
          // x860-1059 outer) = 8px at native 274; border-box keeps the
          // outer bounds at the measured x/y/w
          border: border === "orange" ? `${8 * scale}px solid ${C.orange}` : undefined,
          boxSizing: "border-box",
        }}
      />
      {markP > 0 && (
        <TracedArt name="logoMark" x={artDx} y={artDy} scale={scale} opacity={markP} />
      )}
      {label && (
        <div
          style={{
            position: "absolute",
            // ref cap-top sits 301·scale below the BOX top (flows 974−673=301;
            // locks (797−550)/0.8175=302). With fs 47 the strut eats 10.8·scale
            // of that, so the CSS top is 291·scale (was 292 with fs 48)
            top: (labelFs === undefined ? 291 : 292) * scale,
            // 0.5 − 0.0226 = 0.4774 of the box side, minus the div's own centre
            left: labelDx ?? (labelFs === undefined ? 0.4774 * box - 0.5 * w : 0),
            width: w,
            textAlign: "center",
            whiteSpace: "nowrap",
            fontFamily: brand.sans,
            fontWeight: 700,
            fontSize: labelFs ?? 47 * scale,
            color: C.navy,
          }}
        >
          {brand.boxLabel}
        </div>
      )}
    </div>
  );
};

// ─── Serif label (USD/CNH/EUR…) ───
export const SerifLabel: React.FC<{
  text: string;
  x: number;
  capTop: number;
  fs: number;
  color?: string;
  opacity?: number;
  align?: "left" | "right" | "center";
  width?: number;
  tracking?: number;
}> = ({ text, x, capTop, fs, color = C.navy, opacity = 1, align = "left", width, tracking }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        // Georgia cap sits 0.14em below CSS top at lh 1 (r8-measured at
        // fs138 offset 19.4 and fs200 offset 27; Playfair's factor was 0.30)
        top: capTop - 0.14 * fs,
        width,
        fontFamily: brand.serif,
        fontWeight: 400,
        fontSize: fs,
        lineHeight: 1,
        color,
        opacity,
        whiteSpace: "pre",
        textAlign: align,
        letterSpacing: tracking,
      }}
    >
      {text}
    </div>
  );
};

// ─── Sans text ───
export const SansText: React.FC<{
  text: string;
  x: number;
  y: number;
  fs: number;
  color?: string;
  weight?: number;
  opacity?: number;
  align?: "left" | "right" | "center";
  width?: number;
  lineHeight?: number;
}> = ({ text, x, y, fs, color = C.white, weight = 400, opacity = 1, align = "left", width, lineHeight = 1.15 }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        fontFamily: brand.sans,
        fontWeight: weight,
        fontSize: fs,
        lineHeight,
        color,
        opacity,
        whiteSpace: "pre-wrap",
        textAlign: align,
      }}
    >
      {text}
    </div>
  );
};

// ─── Payment pill ───
export const Pill: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  color: string;
  opacity?: number;
  variant?: "leaf" | "round";
}> = ({ x, y, w = 62, h = 26, color, opacity = 1, variant = "leaf" }) => {
  if (opacity <= 0) return null;
  // "leaf": rounded with one square corner (ref pills read as leaf-shaped)
  const r = h / 2;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        backgroundColor: color,
        borderRadius: variant === "leaf" ? `${r}px ${r}px ${r}px 4px` : r,
        opacity,
      }}
    />
  );
};

// ─── A/B badge ───
export const Badge: React.FC<{
  letter: string;
  cx: number;
  cy: number;
  r?: number;
  opacity?: number;
}> = ({ letter, cx, cy, r = 42, opacity = 1 }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - r,
        top: cy - r,
        width: 2 * r,
        height: 2 * r,
        borderRadius: r,
        backgroundColor: C.navy,
        color: C.white,
        fontFamily: brand.serif,
        fontSize: r * 1.15,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      {letter}
    </div>
  );
};

// ─── Orange elbow connector (H then V or V then H) with optional arrowhead ───
export const Elbow: React.FC<{
  points: [number, number][];
  color?: string;
  width?: number;
  opacity?: number;
  arrow?: "end" | "none";
  drawP?: number;
}> = ({ points, color = C.orange, width = 3, opacity = 1, arrow = "none", drawP = 1 }) => {
  if (opacity <= 0 || points.length < 2 || drawP <= 0) return null;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`)
    .join(" ");
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  const ah = 12;
  return (
    <svg
      width={1920}
      height={1080}
      viewBox="0 0 1920 1080"
      style={{ position: "absolute", left: 0, top: 0, opacity, pointerEvents: "none" }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={drawP < 1 ? len : undefined}
        strokeDashoffset={drawP < 1 ? len * (1 - drawP) : undefined}
      />
      {arrow === "end" && drawP >= 1 && (
        <g transform={`translate(${last[0]},${last[1]}) rotate(${(ang * 180) / Math.PI})`}>
          <path d={`M0,0 L${-ah},${-ah * 0.6} M0,0 L${-ah},${ah * 0.6}`} stroke={color} strokeWidth={width} fill="none" />
        </g>
      )}
    </svg>
  );
};

// ─── Document icon (paper with folded corner + rule lines) ───
export const Doc: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  opacity?: number;
  lines?: { color: string; w: number }[];
  label?: string;
  labelColor?: string;
}> = ({ x, y, w = 90, h = 110, opacity = 1, lines, label, labelColor = C.orangeDeep }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  const fold = w * 0.22;
  const ls = lines ?? [
    { color: C.navy, w: 0.55 },
    { color: C.orangeDeep, w: 0.4 },
    { color: C.navy, w: 0.5 },
  ];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", left: x, top: y, opacity }}
    >
      <path
        d={`M2,2 H${w - fold - 2} L${w - 2},${fold + 2} V${h - 2} H2 Z`}
        fill={C.white}
        stroke={C.navy}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path d={`M${w - fold - 2},2 V${fold + 2} H${w - 2}`} fill="none" stroke={C.navy} strokeWidth={2.5} />
      {label ? (
        <text
          x={w * 0.14}
          y={h * 0.45}
          fontFamily={brand.sans}
          fontSize={w * 0.19}
          fill={labelColor}
        >
          {label.split("\n").map((s, i) => (
            <tspan key={i} x={w * 0.14} dy={i === 0 ? 0 : w * 0.2}>
              {s}
            </tspan>
          ))}
        </text>
      ) : (
        ls.map((l, i) => (
          <rect
            key={i}
            x={w * 0.14}
            y={h * (0.3 + i * 0.16)}
            width={w * l.w}
            height={h * 0.06}
            rx={h * 0.03}
            fill={l.color}
          />
        ))
      )}
    </svg>
  );
};
