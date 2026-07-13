// cls-day shared primitives — all geometry traced from reference frames.
// Local coordinate notes reference the end-card ink block (1076×757 at
// video x422,y161) and per-scene probe logs in STATE-cls-day.md.
import React from "react";
import { C, SANS, SERIF } from "./data";
import { ClsWordmark } from "../cls-shared/logo";

// ─── CLS logo ───
// The swirl mark + letterforms moved to cls-shared/logo.tsx (one corporate
// mark, both explainer lanes). Re-exported here so lane imports stay stable.
export { ClsMark, ClsLetters, ClsWordmark } from "../cls-shared/logo";

// ─── Pillar icons (line art, stroke-based) ───
const S_W = 5;

export const IconHandshake: React.FC<{ size: number; ink?: string; accent?: string }> = ({
  size,
  ink = "#FCFCFC",
  accent = C.red,
}) => (
  <svg width={size} height={size * 0.69} viewBox="0 0 174 120">
    {/* traced from ref f2550 pill crop (/1.5, origin 863,465) */}
    {/* red arm along the top-left: horizontal, then one clean up-step into the
        clasp junction (ref has no downward hook here — the old Q curl was spurious) */}
    <path d="M 0 30 L 36 30 L 63 5" fill="none" stroke={accent} strokeWidth={S_W} strokeLinecap="round" strokeLinejoin="round" />
    {/* white right hand (r7 re-trace from the isolated white-ink plate,
        f2550: rounded back, beak palm hook, FOUR hooked finger strokes —
        the old trapezoid-with-fold + bump-chain read wrong at eye level) */}
    {/* top contour into the right cuff */}
    <path d="M 72 2 L 124 2 Q 133 2 137 7 L 145 18 Q 148 21 153 21 L 174 21" fill="none" stroke={ink} strokeWidth={S_W} strokeLinecap="round" strokeLinejoin="round" />
    {/* left palm edge + beak hook curling up-right */}
    <path d="M 72 2 Q 60 12 53 29 Q 49 40 57 44 Q 65 47 71 41 Q 76 36 81 34" fill="none" stroke={ink} strokeWidth={S_W} strokeLinecap="round" strokeLinejoin="round" />
    {/* knuckle ridge: the palm dips from the beak down to the row of knuckles the
        four fingers hang from (ref f80: the ridge sits at svg_y~64) */}
    <path d="M 80 44 Q 110 61 149 63" fill="none" stroke={ink} strokeWidth={S_W} strokeLinecap="round" strokeLinejoin="round" />
    {/* four fingers wrapping down over the clasp. Ref f80/f85 (5x zoom): each
        finger is a clean CAPSULE OUTLINE — a stadium with navy showing inside, the
        white twin of the red knuckles, near-vertical leaning down-left. The old
        per-finger U-hook (line + Q..Q up-curl) read as thin scratchy bars; a single
        line reads too thin. One calm capsule per finger matches the ref's actual
        construction and line-count. [cx,cy center · rot deg] */}
    {([
      [90, 85, 50, 113],
      [105, 87, 49, 111],
      [120, 87, 47, 110],
      [133.5, 83.5, 44, 110],
    ] as const).map(([cx, cy, len, rot], i) => (
      <rect
        key={i}
        x={cx - len / 2}
        y={cy - 7}
        width={len}
        height={14}
        rx={7}
        transform={`rotate(${rot} ${cx} ${cy})`}
        fill="none"
        stroke={ink}
        strokeWidth={S_W}
      />
    ))}
    {/* right hand edge from the cuff down to the knuckle ridge */}
    <path d="M 153 21 Q 156 44 145 64" fill="none" stroke={ink} strokeWidth={S_W} strokeLinecap="round" />
    {/* bottom-left white cuff dash */}
    <path d="M 0 80 L 28 80" stroke={ink} strokeWidth={S_W} strokeLinecap="round" />
    {/* clasp knuckles (accent, rounded squares descending the diagonal) */}
    {([[32, 70], [48, 83], [63, 95], [78, 106]] as const).map(([cx, cy], i) => (
      <rect
        key={i}
        x={cx - 12}
        y={cy - 9.5}
        width={24}
        height={19}
        rx={7}
        transform={`rotate(-38 ${cx} ${cy})`}
        fill="none"
        stroke={accent}
        strokeWidth={S_W}
      />
    ))}
  </svg>
);

export const IconProcess: React.FC<{ size: number; ink?: string; accent?: string }> = ({
  size,
  ink = "#FCFCFC",
  accent = C.red,
}) => (
  <svg width={size} height={size} viewBox="0 0 200 200">
    <rect x="30" y="8" width="44" height="44" rx="8" fill="none" stroke={ink} strokeWidth={S_W} />
    <circle cx="100" cy="100" r="26" fill="none" stroke={ink} strokeWidth={S_W} />
    <path d="M 140 100 L 172 100 L 172 40 L 100 40" fill="none" stroke={ink} strokeWidth={S_W} />
    <path d="M 118 40 l 14 -9 v 18 z" fill={ink} />
    <path d="M 30 70 L 14 70 L 14 150 L 96 150" fill="none" stroke={accent} strokeWidth={S_W} />
    <path d="M 92 141 l 16 9 l -16 9 z" fill={accent} />
    <path d="M 146 176 L 166 138 L 186 176 Z" fill="none" stroke={ink} strokeWidth={S_W} strokeLinejoin="round" />
  </svg>
);

export const IconData: React.FC<{ size: number; ink?: string; accent?: string }> = ({
  size,
  ink = "#FCFCFC",
  accent = C.red,
}) => (
  <svg width={size} height={size} viewBox="0 0 200 200">
    {[14, 66, 118].map((y) => (
      <rect key={y} x="20" y={y} width="130" height="40" rx="8" fill="none" stroke={ink} strokeWidth={S_W} />
    ))}
    {[34, 86, 138].map((y) => (
      <rect key={y} x="38" y={y} width="22" height="5" fill={accent} />
    ))}
    <circle cx="152" cy="132" r="36" fill="none" stroke={ink} strokeWidth={S_W} />
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={138 + i * 9} y={146 - 8 - i * 6} width="5" height={8 + i * 6} fill={accent} />
    ))}
    <path d="M 85 158 L 85 192 M 58 192 L 112 192 M 60 192 a 8 8 0 1 0 -16 0 a 8 8 0 1 0 16 0" fill="none" stroke={ink} strokeWidth={S_W} />
  </svg>
);

// ─── Timeline band ───
// Standard: grey strip 40px, hour ticks navy y(band-4)..(band+60),
// "HH:00" Helvetica 30px navy, label 8px right of tick.
export type BandProps = {
  y?: number;
  h?: number;
  originX: number; // screen x of originHour tick
  originHour: number;
  pxPerHour: number;
  labels?: boolean;
  tickAbove?: number; // tick extension above strip top
  tickBelow?: number; // tick extension below strip bottom
  labelSize?: number;
  labelDx?: number; // label x offset from tick (default 8)
  labelDy?: number; // label y offset below band bottom (default 2)
  labelWeight?: number; // label font weight (default 400)
  hMin?: number; // clamp drawn hours to >= hMin (default: none)
  hMax?: number; // clamp drawn hours to <= hMax (default: none)
  ink?: string;
};

export const TimelineBand: React.FC<BandProps> = ({
  y = 88,
  h = 40,
  originX,
  originHour,
  pxPerHour,
  labels = true,
  tickAbove = 4,
  tickBelow = 20,
  labelSize = 30,
  labelDx = 8,
  labelDy = 2,
  labelWeight = 400,
  hMin,
  hMax,
  ink = C.navyDeep,
}) => {
  const ticks: React.ReactNode[] = [];
  // hours visible: solve originX + (k-originHour)*pxPerHour in [-50, 1970]
  const kMin = Math.max(hMin ?? -Infinity, Math.floor(originHour + (-80 - originX) / pxPerHour));
  const kMax = Math.min(hMax ?? Infinity, Math.ceil(originHour + (2000 - originX) / pxPerHour));
  for (let k = kMin; k <= kMax; k++) {
    const x = originX + (k - originHour) * pxPerHour;
    const hh = ((k % 24) + 24) % 24;
    ticks.push(
      <React.Fragment key={k}>
        <div
          style={{
            position: "absolute",
            left: x - 1.5,
            top: y - tickAbove,
            width: 3,
            height: h + tickAbove + tickBelow,
            background: ink,
          }}
        />
        {labels && (
          <div
            style={{
              position: "absolute",
              left: x + labelDx,
              top: y + h + labelDy,
              fontFamily: SANS,
              fontSize: labelSize,
              fontWeight: labelWeight,
              color: ink,
              whiteSpace: "pre",
            }}
          >
            {String(hh).padStart(2, "0")}:00
          </div>
        )}
      </React.Fragment>,
    );
  }
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: y,
          width: 1920,
          height: h,
          background: C.bandGrey,
        }}
      />
      {ticks}
    </>
  );
};

// Red hollow triangle marker (pointing down) above the band.
export const MarkerTriangle: React.FC<{ x: number; y: number; size?: number }> = ({
  x,
  y,
  size = 30,
}) => (
  <svg
    width={size}
    height={size * 0.82}
    viewBox="0 0 30 24.6"
    style={{ position: "absolute", left: x - size / 2, top: y }}
  >
    <path d="M 2.5 2 L 27.5 2 L 15 22.6 Z" fill="none" stroke={C.marker} strokeWidth="4" strokeLinejoin="miter" />
  </svg>
);

// Milestone: red vertical line + bold time + label lines (navy).
export const Milestone: React.FC<{
  x: number;
  lineTop: number;
  lineBottom: number;
  time?: string;
  label?: readonly string[];
  textY?: number;
  timeSize?: number;
  labelSize?: number;
  lineW?: number;
  side?: "right" | "left";
  color?: string;
  textColor?: string;
  opacity?: number;
}> = ({
  x,
  lineTop,
  lineBottom,
  time,
  label = [],
  textY,
  timeSize = 44,
  labelSize = 26,
  lineW = 5,
  side = "right",
  color = C.marker,
  textColor = C.navyInk,
  opacity = 1,
}) => (
  <div style={{ opacity }}>
    <div
      style={{
        position: "absolute",
        left: x - lineW / 2,
        top: lineTop,
        width: lineW,
        height: lineBottom - lineTop,
        background: color,
      }}
    />
    {time !== undefined && (
      <div
        style={{
          position: "absolute",
          left: side === "right" ? x + 14 : undefined,
          right: side === "left" ? 1920 - x + 14 : undefined,
          top: textY ?? lineTop + 40,
          fontFamily: SANS,
          color: textColor,
          textAlign: side === "right" ? "left" : "right",
          lineHeight: 1.25,
        }}
      >
        <div style={{ fontSize: timeSize, fontWeight: 700 }}>{time}</div>
        {label.map((l, i) => (
          <div key={i} style={{ fontSize: labelSize }}>
            {l}
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─── Chip (leaf money token) ───
export const Chip: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  color: string;
  opacity?: number;
  rot?: number;
}> = ({ x, y, w = 132, h = 104, color, opacity = 1, rot = 0 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: color,
      borderRadius: `${h * 0.58}px 0 ${h * 0.58}px 0`,
      opacity,
      transform: rot ? `rotate(${rot}deg)` : undefined,
    }}
  />
);

// ─── CLS pill (navy chip-radius rect + wordmark) ───
// The pill carries the brand CHIP radius — rounded TL + BR, SQUARE TR + BL —
// the same corner grammar `Chip` above already had. It is a RATIO of the
// pill's height, not an absolute; fitted per-frame to the ref's solid-navy
// fill at BOTH pill sizes (r17), and the two agree, so it is a rig constant:
//   S10  433x196 @(742,718), f1900/f1950:  TL r=53.0 (.270h) · BR r=51.1 (.261h) · TR/BL SQUARE
//   S17  259x117 @(834,473), f3240..f3340: TL r=31.7 (.271h) · BR r=30.6 (.262h) · TR/BL SQUARE
// (S4 hand-shapes its own pill inline and independently landed 52 on h=197 =
// .264 — three sizes, one number.) We drew a UNIFORM h*0.28 on all four: the
// two square corners were rounded away, ~1.2k px of navy missing per pill.
export const PILL_R = 0.265; // corner radius / pill height

export const ClsPill: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  logoP?: number; // wordmark reveal 0..1
  opacity?: number;
  logoScale?: number; // wordmark height / pill height (rig constant: 0.366)
}> = ({ x, y, w, h, logoP = 1, opacity = 1, logoScale = 0.5 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: C.navyBg,
      borderRadius: `${h * PILL_R}px 0 ${h * PILL_R}px 0`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity,
      overflow: "hidden",
    }}
  >
    <div style={{ opacity: logoP }}>
      <ClsWordmark height={h * logoScale} />
    </div>
  </div>
);

// ─── Document sheet (page with folded corner) ───
export const DocSheet: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  ink?: string;
  fill?: string;
  strokeW?: number;
  foldR?: number; // fold size as fraction of w
  children?: React.ReactNode;
  opacity?: number;
}> = ({ x, y, w, h, ink = "#FCFCFC", fill = "none", strokeW = 3, foldR = 0.14, children, opacity = 1 }) => {
  const f = w * foldR;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute" }}>
        <path
          d={`M 8 ${h - 8} L 8 8 L ${w - f - 8} 8 L ${w - 8} ${f + 8} L ${w - 8} ${h - 8} Z`}
          fill={fill}
          stroke={ink}
          strokeWidth={strokeW}
          strokeLinejoin="round"
        />
        <path
          d={`M ${w - f - 8} 8 L ${w - f - 8} ${f + 8} L ${w - 8} ${f + 8}`}
          fill="none"
          stroke={ink}
          strokeWidth={strokeW}
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </div>
  );
};

// ─── Donut (ring progress, serif % center) ───
export const Donut: React.FC<{
  cx: number;
  cy: number;
  r: number; // mid radius
  thick: number;
  progress: number; // 0..1 sweep of navy from top clockwise
  pct: string;
  ringBg?: string;
  ringFg?: string;
  center?: string;
  textColor?: string;
  fontSize?: number;
  gapDeg?: number; // white gap at top when in-progress look
  bgSweep?: number; // grey ring draw-in 0..1 (clockwise from top)
  pctDy?: number; // ink-measured vertical nudge (flex centers the line box, not the ink)
}> = ({ cx, cy, r, thick, progress, pct, ringBg = C.donutGrey, ringFg = C.navyBg, center = "none", textColor = "#FCFCFC", fontSize = 90, gapDeg = 14, bgSweep = 1, pctDy = 0 }) => {
  const R = r;
  const circ = 2 * Math.PI * R;
  const sweep = Math.max(0, Math.min(1, progress));
  const size = (r + thick) * 2 + 8;
  return (
    <div style={{ position: "absolute", left: cx - size / 2, top: cy - size / 2, width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={R}
          fill="none"
          stroke={ringBg}
          strokeWidth={thick}
          strokeDasharray={bgSweep >= 1 ? undefined : `${bgSweep * circ} ${circ}`}
          transform={bgSweep >= 1 ? undefined : `rotate(-90 ${size / 2} ${size / 2})`}
        />
        {center !== "none" && <circle cx={size / 2} cy={size / 2} r={R - thick / 2} fill={center} />}
        {sweep > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke={ringFg}
            strokeWidth={thick}
            strokeDasharray={`${sweep * (1 - gapDeg / 360) * circ} ${circ}`}
            transform={`rotate(${-90 + gapDeg / 2} ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: SERIF,
          fontSize,
          color: textColor,
          fontVariantNumeric: "lining-nums",
          transform: `translateY(${pctDy}px)`,
        }}
      >
        {pct}
      </div>
    </div>
  );
};

// ─── Check circle (red disc, white tick) ───
export const CheckCircle: React.FC<{ x: number; y: number; size?: number; opacity?: number }> = ({
  x,
  y,
  size = 64,
  opacity = 1,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    style={{ position: "absolute", left: x - size / 2, top: y - size / 2, opacity }}
  >
    <circle cx="32" cy="32" r="30" fill={C.marker} />
    <path d="M 18 33 L 28 43 L 47 22" fill="none" stroke="#FCFCFC" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Building line-art ───
// Simplified two-tower block: red-detail tower + navy neighbor, ground line.
// gen12 re-trace: the settled ref skyline (identical design in S4/S10/S17) is a
// DENSE ~7-building city, not the old 3-tower sketch — a center red tower flanked
// by navy towers, light grey slabs behind, blue ground ticks and a red car. Traced
// per-building from ref f1900 (probes in work/cls-day/gen12; vb = ref−(290,310),
// viewBox 378×282 = the S10 hex, stretched to fill each hex; clip is the caller's).
export const Buildings: React.FC<{
  w: number;
  h: number;
  ink?: string;
  accent?: string;
  variant?: 0 | 1;
  strokeW?: number;
  dense?: boolean; // legacy prop — the re-traced skyline is always dense
}> = ({ w, h, ink = C.navyDeep, accent = C.red, variant = 0, strokeW = 3 }) => {
  const salmon = "#EEC9AF";
  const slab = "#E4E4E8";
  const paper = "#FDFDFD";
  const sw = strokeW;
  return (
    <svg width={w} height={h} viewBox="0 0 378 282" preserveAspectRatio="none">
      {variant === 0 ? (
        <>
          {/* grey slabs behind the right cluster (ref: the right half is packed
              with slab + building up to the chamfer, not white) */}
          <rect x={232} y={128} width={20} height={130} fill={slab} />
          <rect x={286} y={150} width={50} height={108} fill={slab} />
          {/* far-left slender navy tower + mast, horizontal windows */}
          <line x1={44} y1={56} x2={44} y2={76} stroke={ink} strokeWidth={2} />
          <rect x={26} y={76} width={38} height={182} fill={paper} stroke={ink} strokeWidth={sw} />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <line key={i} x1={31} y1={94 + i * 18} x2={59} y2={94 + i * 18} stroke={ink} strokeWidth={1.6} />
          ))}
          {/* plain navy building behind-left */}
          <rect x={60} y={150} width={30} height={108} fill={paper} stroke={ink} strokeWidth={sw} />
          {/* dots building, rounded top-left */}
          <path d={`M 88 258 L 88 122 Q 88 112 98 112 L 140 112 L 140 258 Z`} fill={paper} stroke={ink} strokeWidth={sw} />
          {[0, 1].map((c) =>
            [0, 1, 2, 3].map((r) => <rect key={`${c}${r}`} x={104 + c * 20} y={148 + r * 26} width={4} height={12} fill={ink} />),
          )}
          {/* right navy building: 2-row window-BOX grid (ref f1900 rightcluster
              5x — rectangular panes, not the old plain floor bands) */}
          <rect x={238} y={80} width={40} height={178} fill={paper} stroke={ink} strokeWidth={sw} />
          <line x1={238} y1={104} x2={278} y2={104} stroke={ink} strokeWidth={sw} />
          {[0, 1].map((r) =>
            [0, 1].map((c) => (
              <rect key={`rb${r}${c}`} x={244 + c * 16} y={110 + r * 40} width={13} height={26} fill={paper} stroke={ink} strokeWidth={2} />
            )),
          )}
          <line x1={238} y1={196} x2={278} y2={196} stroke={ink} strokeWidth={sw} />
          {/* far-right stepped navy tower — taller, reaching x354 under the
              chamfer (ref keeps the right third packed, not white) */}
          <path d={`M 282 258 L 282 150 L 320 150 L 320 120 L 354 120 L 354 258 Z`} fill={paper} stroke={ink} strokeWidth={sw} />
          {/* center red tower: cap + antennae, body w/ inner windows, wide base grid, door */}
          <line x1={184} y1={26} x2={184} y2={40} stroke={accent} strokeWidth={2} />
          <line x1={196} y1={26} x2={196} y2={40} stroke={accent} strokeWidth={2} />
          <rect x={148} y={40} width={84} height={26} fill={paper} stroke={accent} strokeWidth={sw} />
          <line x1={150} y1={58} x2={230} y2={58} stroke={accent} strokeWidth={sw} />
          <rect x={150} y={70} width={80} height={90} fill={paper} stroke={accent} strokeWidth={sw} />
          <rect x={162} y={92} width={56} height={68} fill={paper} stroke={accent} strokeWidth={2} />
          <rect x={168} y={98} width={16} height={54} fill={accent} />
          <rect x={190} y={98} width={16} height={54} fill={salmon} />
          <rect x={140} y={160} width={102} height={98} fill={paper} stroke={accent} strokeWidth={sw} />
          {[0, 1, 2, 3].map((c) =>
            [0, 1, 2, 3].map((r) => <rect key={`b${c}${r}`} x={158 + c * 22} y={178 + r * 20} width={5} height={12} fill={accent} />),
          )}
          <rect x={176} y={238} width={22} height={20} fill={paper} stroke={accent} strokeWidth={2} />
          <line x1={187} y1={238} x2={187} y2={258} stroke={accent} strokeWidth={1.6} />
          {/* red car bottom-left */}
          <path d={`M 52 254 L 52 236 Q 52 228 60 228 L 96 228 Q 104 228 104 236 L 104 254 Z`} fill={paper} stroke={accent} strokeWidth={2.2} />
          <line x1={56} y1={240} x2={100} y2={240} stroke={accent} strokeWidth={1.6} />
          <circle cx={66} cy={254} r={6} fill={paper} stroke={accent} strokeWidth={2} />
          <circle cx={92} cy={254} r={6} fill={paper} stroke={accent} strokeWidth={2} />
          {/* ground line + blue/navy ticks */}
          <line x1={20} y1={258} x2={358} y2={258} stroke={ink} strokeWidth={sw} />
          {[135, 150, 172, 224, 241].map((x, i) => (
            <line key={`bt${i}`} x1={x} y1={244} x2={x} y2={258} stroke={C.blue} strokeWidth={3} />
          ))}
          {[113, 258, 300, 316].map((x, i) => (
            <line key={`nt${i}`} x1={x} y1={246} x2={x} y2={258} stroke={ink} strokeWidth={2.5} />
          ))}
        </>
      ) : (
        <>
          {/* grey slabs behind the red tower + far right */}
          <rect x={236} y={112} width={28} height={146} fill={slab} />
          <rect x={322} y={150} width={26} height={108} fill={slab} />
          {/* far-left wide navy building, rounded top-left, vertical window bars */}
          <path d={`M 30 258 L 30 62 Q 30 50 42 50 L 116 50 L 116 258 Z`} fill={paper} stroke={ink} strokeWidth={sw} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={`vb${i}`} x1={52 + i * 11} y1={84} x2={52 + i * 11} y2={114} stroke={ink} strokeWidth={2} />
          ))}
          <line x1={30} y1={122} x2={116} y2={122} stroke={ink} strokeWidth={sw} />
          {/* navy ladder building (foreground left) */}
          <rect x={38} y={124} width={50} height={134} fill={paper} stroke={ink} strokeWidth={sw} />
          {[0, 1, 2, 3].map((i) => (
            <line key={`lr${i}`} x1={44} y1={140 + i * 22} x2={82} y2={140 + i * 22} stroke={ink} strokeWidth={sw} />
          ))}
          {/* right navy building: top box + antenna, ladder windows */}
          <line x1={288} y1={70} x2={288} y2={96} stroke={ink} strokeWidth={2} />
          <rect x={268} y={96} width={50} height={28} fill={paper} stroke={ink} strokeWidth={sw} />
          <rect x={268} y={124} width={50} height={134} fill={paper} stroke={ink} strokeWidth={sw} />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`rr${i}`} x1={276} y1={140 + i * 22} x2={310} y2={140 + i * 22} stroke={ink} strokeWidth={sw} />
          ))}
          {/* center red tower B: antenna, crown of bars, banded head, twin dashed columns */}
          <rect x={160} y={16} width={10} height={28} fill={paper} stroke={accent} strokeWidth={2} />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <line key={`cr${i}`} x1={162 + i * 9} y1={56} x2={162 + i * 9} y2={78} stroke={accent} strokeWidth={2.4} />
          ))}
          <rect x={158} y={78} width={66} height={78} fill={paper} stroke={accent} strokeWidth={sw} />
          <rect x={162} y={96} width={58} height={12} fill={salmon} />
          <line x1={158} y1={118} x2={224} y2={118} stroke={accent} strokeWidth={sw} />
          <rect x={160} y={128} width={30} height={12} fill={accent} />
          <line x1={158} y1={144} x2={224} y2={144} stroke={accent} strokeWidth={sw} />
          {/* red lintel band spans the FULL width over both dashed columns
              (ref B x130-252), not just the head width (was x158-224) */}
          <rect x={130} y={156} width={122} height={14} fill={accent} />
          <rect x={130} y={150} width={28} height={108} fill={paper} stroke={accent} strokeWidth={sw} />
          <rect x={224} y={150} width={28} height={108} fill={paper} stroke={accent} strokeWidth={sw} />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`dl${i}`} x1={144} y1={166 + i * 18} x2={144} y2={176 + i * 18} stroke={accent} strokeWidth={2} />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`dr${i}`} x1={238} y1={166 + i * 18} x2={238} y2={176 + i * 18} stroke={accent} strokeWidth={2} />
          ))}
          <rect x={176} y={236} width={30} height={22} fill={paper} stroke={accent} strokeWidth={2} />
          <line x1={186} y1={236} x2={186} y2={258} stroke={accent} strokeWidth={1.6} />
          <line x1={196} y1={236} x2={196} y2={258} stroke={accent} strokeWidth={1.6} />
          {/* red car bottom-left */}
          <path d={`M 92 256 L 92 240 Q 92 232 100 232 L 122 232 Q 130 232 130 240 L 130 256 Z`} fill={paper} stroke={accent} strokeWidth={2.2} />
          <circle cx={104} cy={256} r={5} fill={paper} stroke={accent} strokeWidth={2} />
          <circle cx={122} cy={256} r={5} fill={paper} stroke={accent} strokeWidth={2} />
          {/* ground line + blue/navy ticks */}
          <line x1={20} y1={258} x2={358} y2={258} stroke={ink} strokeWidth={sw} />
          {[64, 82, 172, 200, 258, 278].map((x, i) => (
            <line key={`bt${i}`} x1={x} y1={244} x2={x} y2={258} stroke={C.blue} strokeWidth={3} />
          ))}
          {[150, 228, 300, 316].map((x, i) => (
            <line key={`nt${i}`} x1={x} y1={246} x2={x} y2={258} stroke={ink} strokeWidth={2.5} />
          ))}
        </>
      )}
    </svg>
  );
};

// Rounded elongated-hexagon outline. Same 6 vertices / bounding box as the old
// sharp path (top y4, bottom y(h-4), points at x6 / x(w-6)) — rounding only
// pulls the path INWARD so HW/HH and the flat-edge centres callers attach to
// (S4 arrows at ±HW/2, S10 connectors at the flat bottom) stay put. Each corner
// is a quadratic-bezier fillet. Ref (measured s10/s17 f1900/f3300): the flat top
// & bottom hug their line to near the vertex, then sweep down the diagonal — so
// the setback is asymmetric (flat ≈0.033w, diagonal ≈0.085w). ONE string drives
// the outline <path> AND the buildings clip, so nothing bleeds past the edge.
const hexPath = (w: number, h: number): string => {
  const inset = w * 0.22;
  const hh = h / 2;
  const V: readonly (readonly [number, number])[] = [
    [inset, 4],
    [w - inset, 4],
    [w - 6, hh],
    [w - inset, h - 4],
    [inset, h - 4],
    [6, hh],
  ];
  const dFlat = w * 0.033;
  const dDiag = w * 0.085;
  const n = V.length;
  const isFlat = (i: number, j: number) => Math.abs(V[i][1] - V[j][1]) < 1;
  const back = (i: number, j: number, d: number): [number, number] => {
    const dx = V[j][0] - V[i][0];
    const dy = V[j][1] - V[i][1];
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(d, len * 0.45) / len;
    return [V[i][0] + dx * t, V[i][1] + dy * t];
  };
  const f = (v: number) => v.toFixed(2);
  const pin: [number, number][] = [];
  const pout: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const prev = (i + n - 1) % n;
    const next = (i + 1) % n;
    pin[i] = back(i, prev, isFlat(i, prev) ? dFlat : dDiag);
    pout[i] = back(i, next, isFlat(i, next) ? dFlat : dDiag);
  }
  let d = `M ${f(pout[n - 1][0])} ${f(pout[n - 1][1])}`;
  for (let i = 0; i < n; i++) {
    d += ` L ${f(pin[i][0])} ${f(pin[i][1])} Q ${f(V[i][0])} ${f(V[i][1])} ${f(pout[i][0])} ${f(pout[i][1])}`;
  }
  return d + " Z";
};

// Hexagon city: elongated hex outline + buildings + letter badge.
export const HexCity: React.FC<{
  x: number; // center
  y: number;
  w?: number;
  h?: number;
  letter?: string;
  badge?: "tl" | "tr";
  variant?: 0 | 1;
  opacity?: number;
  ink?: string;
  badgeP?: number;
  dense?: boolean;
}> = ({ x, y, w = 300, h = 220, letter, badge = "tl", variant = 0, opacity = 1, ink = C.navyDeep, badgeP = 1, dense }) => {
  const hw = w / 2;
  const hh = h / 2;
  const path = hexPath(w, h);
  // Badge disc (S4/S10 only — S17/S19 pass no letter). Ref f1900/f640 measured:
  // diameter ≈94 @ w378/382 (0.249w), centred on the top vertex (≈0.206w from
  // the near side), sitting ~half above the top edge. Much larger than the old
  // 56 and shifted onto the corner, matching the ref's heavy corner disc.
  const bd = Math.round(w * 0.2487);
  const boff = Math.round(w * 0.082);
  const btop = Math.round(h * 0.007 - bd / 2);
  return (
    <div style={{ position: "absolute", left: x - hw, top: y - hh, width: w, height: h, opacity }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute" }}>
        <path d={path} fill="#FDFDFD" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      </svg>
      {/* gen12: the re-traced skyline fills the hex interior; clip to the SAME
          rounded-hex path so edge buildings under the chamfer read as white. */}
      <div style={{ position: "absolute", inset: 0, clipPath: `path("${path}")` }}>
        <Buildings w={w} h={h} variant={variant} dense={dense} />
      </div>
      {letter && badgeP > 0 && (
        <div
          style={{
            position: "absolute",
            left: badge === "tl" ? boff : undefined,
            right: badge === "tr" ? boff : undefined,
            top: btop,
            width: bd,
            height: bd,
            borderRadius: bd / 2,
            background: C.navyBg,
            color: "#FCFCFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SERIF,
            fontSize: Math.round(bd * 0.57),
            transform: `scale(${badgeP})`,
          }}
        >
          {letter}
        </div>
      )}
    </div>
  );
};

// Small hexagon with bank (central bank) icon.
export const BankHex: React.FC<{ x: number; y: number; size?: number; opacity?: number }> = ({
  x,
  y,
  size = 96,
  opacity = 1,
}) => {
  const w = size;
  const h = size * 0.92;
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, opacity }}>
      <svg width={w} height={h} viewBox="0 0 100 92">
        <path
          d="M 28 3 L 72 3 L 96 46 L 72 89 L 28 89 L 4 46 Z"
          fill="#FDFDFD"
          stroke={C.navyDeep}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* bank columns */}
        <path d="M 30 38 L 50 26 L 70 38 Z" fill="none" stroke={C.navyDeep} strokeWidth="3" strokeLinejoin="round" />
        {[36, 47, 58].map((bx) => (
          <line key={bx} x1={bx} y1="42" x2={bx} y2="60" stroke={C.navyDeep} strokeWidth="3" />
        ))}
        <line x1="30" y1="64" x2="70" y2="64" stroke={C.navyDeep} strokeWidth="3" />
      </svg>
    </div>
  );
};

// ─── Handshake pill (navy rounded rect + handshake line icon) ───
export const HandshakePill: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
}> = ({ x, y, w, h, opacity = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: C.navyBg,
      // leaf shape like the chips: TL+BR rounded, TR+BL near-square (ref f2550)
      borderRadius: `${h * 0.27}px 8px ${h * 0.27}px 8px`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity,
    }}
  >
    <div style={{ transform: "translateY(-8px)" }}>
      <IconHandshake size={w * 0.46} />
    </div>
  </div>
);

// ─── Padlock (open/closed) with list panel ───
export const Padlock: React.FC<{
  x: number;
  y: number;
  size?: number;
  closed: boolean;
  opacity?: number;
  dashOpacity?: number;
}> = ({ x, y, size = 150, closed, opacity = 1, dashOpacity = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: size, height: size * 1.2, opacity }}>
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120">
      <rect x="12" y="46" width="76" height="66" rx="10" fill="#FDFDFD" stroke={C.navyDeep} strokeWidth="4" />
      {closed ? (
        <path d="M 28 46 L 28 30 Q 28 8 50 8 Q 72 8 72 30 L 72 46" fill="none" stroke={C.navyDeep} strokeWidth="4" />
      ) : (
        <path d="M 28 46 L 28 30 Q 28 8 50 8 Q 72 8 72 30 L 72 38" fill="none" stroke={C.navyDeep} strokeWidth="4" transform="rotate(-14 28 46)" />
      )}
      {[62, 78, 94].map((ly, i) => (
        <React.Fragment key={i}>
          <circle cx="28" cy={ly} r="3.5" fill="none" stroke={C.navyDeep} strokeWidth="2.5" />
          <line x1="38" y1={ly} x2="72" y2={ly} stroke={C.red} strokeWidth="3.5" opacity={dashOpacity} />
        </React.Fragment>
      ))}
    </svg>
  </div>
);
