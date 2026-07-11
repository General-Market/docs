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
    {/* red arm along the top-left */}
    <path d="M 0 30 L 36 30 L 63 5" fill="none" stroke={accent} strokeWidth={S_W} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 8 38 Q 8 56 22 63" fill="none" stroke={accent} strokeWidth={S_W} strokeLinecap="round" />
    {/* white right hand (r7 re-trace from the isolated white-ink plate,
        f2550: rounded back, beak palm hook, FOUR hooked finger strokes —
        the old trapezoid-with-fold + bump-chain read wrong at eye level) */}
    {/* top contour into the right cuff */}
    <path d="M 72 2 L 124 2 Q 133 2 137 7 L 145 18 Q 148 21 153 21 L 174 21" fill="none" stroke={ink} strokeWidth={S_W} strokeLinecap="round" strokeLinejoin="round" />
    {/* left palm edge + beak hook curling up-right */}
    <path d="M 72 2 Q 60 12 53 29 Q 49 40 57 44 Q 65 47 71 41 Q 76 36 81 34" fill="none" stroke={ink} strokeWidth={S_W} strokeLinecap="round" strokeLinejoin="round" />
    {/* inner palm line under the hand back */}
    <path d="M 81 34 Q 96 29 110 29" fill="none" stroke={ink} strokeWidth={S_W} strokeLinecap="round" />
    {/* four fingers: parallel strokes w/ J-hooks at the lower-left ends */}
    {([[110, 29, 71, 68], [122, 38, 83, 77], [134, 47, 95, 86], [146, 56, 107, 95]] as const).map(([tx, ty, bx, by], i) => (
      <path
        key={i}
        d={`M ${tx} ${ty} L ${bx} ${by} Q ${bx - 2} ${by + 8} ${bx + 5} ${by + 9} Q ${bx + 12} ${by + 10} ${bx + 13} ${by + 2}`}
        fill="none"
        stroke={ink}
        strokeWidth={S_W}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ))}
    {/* right hand edge from the cuff down to the last finger */}
    <path d="M 153 21 Q 155 40 146 56" fill="none" stroke={ink} strokeWidth={S_W} strokeLinecap="round" />
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
    <path d="M 145 190 L 165 152 L 185 190 Z" fill="none" stroke={ink} strokeWidth={S_W} strokeLinejoin="round" />
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
    <path d="M 85 158 L 85 178 M 60 178 L 110 178 M 60 178 a 8 8 0 1 0 -16 0 a 8 8 0 1 0 16 0" fill="none" stroke={ink} strokeWidth={S_W} />
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
  ink = C.navyDeep,
}) => {
  const ticks: React.ReactNode[] = [];
  // hours visible: solve originX + (k-originHour)*pxPerHour in [-50, 1970]
  const kMin = Math.floor(originHour + (-80 - originX) / pxPerHour);
  const kMax = Math.ceil(originHour + (2000 - originX) / pxPerHour);
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

// ─── CLS pill (navy rounded rect + wordmark) ───
export const ClsPill: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  logoP?: number; // wordmark reveal 0..1
  opacity?: number;
  logoScale?: number; // wordmark height / pill height (ref S17: 0.425)
}> = ({ x, y, w, h, logoP = 1, opacity = 1, logoScale = 0.5 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: C.navyBg,
      borderRadius: h * 0.28,
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
export const Buildings: React.FC<{
  w: number;
  h: number;
  ink?: string;
  accent?: string;
  variant?: 0 | 1;
  strokeW?: number;
  dense?: boolean; // S17 hexes: mini-city extras (slabs, vehicle, sliver)
}> = ({ w, h, ink = C.navyDeep, accent = C.red, variant = 0, strokeW = 2.5, dense }) => (
  <svg width={w} height={h} viewBox="0 0 200 160">
    {dense && variant === 0 && (
      <>
        <rect x={46} y={70} width={10} height={70} fill="#DCDCDC" />
        <rect x={8} y={62} width={18} height={78} fill="#FDFDFD" stroke={ink} strokeWidth={strokeW} />
        {[0, 1, 2, 3].map((r) => (
          <line key={r} x1={11} y1={72 + r * 14} x2={23} y2={72 + r * 14} stroke={ink} strokeWidth={2} />
        ))}
        <rect x={160} y={96} width={30} height={44} fill="#FDFDFD" stroke={ink} strokeWidth={strokeW} />
        <path d="M 18 138 L 18 128 Q 18 124 22 124 L 44 124 Q 48 124 48 128 L 48 138" fill="none" stroke={accent} strokeWidth={2.2} />
        <circle cx={25} cy={138} r={3} fill="none" stroke={accent} strokeWidth={2} />
        <circle cx={41} cy={138} r={3} fill="none" stroke={accent} strokeWidth={2} />
      </>
    )}
    {dense && variant === 1 && (
      <>
        <rect x={94} y={58} width={8} height={82} fill="#DCDCDC" />
        <rect x={12} y={72} width={30} height={68} fill="#FDFDFD" stroke={ink} strokeWidth={strokeW} />
        {[0, 1, 2].map((r) =>
          [0, 1].map((c) => <rect key={`${r}${c}`} x={18 + c * 12} y={80 + r * 16} width={5} height={7} fill={ink} />),
        )}
        <path d="M 152 138 L 152 128 Q 152 124 156 124 L 178 124 Q 182 124 182 128 L 182 138" fill="none" stroke={accent} strokeWidth={2.2} />
        <circle cx={159} cy={138} r={3} fill="none" stroke={accent} strokeWidth={2} />
        <circle cx={175} cy={138} r={3} fill="none" stroke={accent} strokeWidth={2} />
      </>
    )}
    {variant === 0 ? (
      <>
        {/* red tower center-left */}
        <rect x="55" y="20" width="52" height="120" fill="#FDFDFD" stroke={accent} strokeWidth={strokeW} />
        <rect x="66" y="8" width="30" height="12" fill="none" stroke={accent} strokeWidth={strokeW} />
        {[0, 1, 2, 3, 4, 5].map((r) =>
          [0, 1, 2].map((c) => (
            <rect key={`${r}-${c}`} x={63 + c * 13} y={30 + r * 17} width="8" height="10" fill={accent} />
          )),
        )}
        {/* navy building right */}
        <rect x="112" y="52" width="46" height="88" fill="#FDFDFD" stroke={ink} strokeWidth={strokeW} />
        {[0, 1, 2, 3].map((r) => (
          <line key={r} x1="118" y1={64 + r * 20} x2="152" y2={64 + r * 20} stroke={ink} strokeWidth={strokeW} />
        ))}
        {/* small block left */}
        <rect x="26" y="84" width="29" height="56" fill="#FDFDFD" stroke={ink} strokeWidth={strokeW} />
        <line x1="10" y1="140" x2="190" y2="140" stroke={ink} strokeWidth={strokeW} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line key={i} x1={18 + i * 22} y1="140" x2={18 + i * 22} y2="146" stroke={ink} strokeWidth={strokeW} />
        ))}
      </>
    ) : (
      <>
        {/* variant B: red tower right, stepped navy left */}
        <rect x="100" y="14" width="54" height="126" fill="#FDFDFD" stroke={accent} strokeWidth={strokeW} />
        {[0, 1, 2, 3, 4, 5, 6].map((r) =>
          [0, 1].map((c) => (
            <rect key={`${r}-${c}`} x={112 + c * 20} y={24 + r * 16} width="10" height="9" fill={accent} />
          )),
        )}
        <rect x="44" y="46" width="56" height="94" fill="#FDFDFD" stroke={ink} strokeWidth={strokeW} />
        {[0, 1, 2, 3, 4].map((r) => (
          <rect key={r} x={52} y={56 + r * 17} width="12" height="8" fill="none" stroke={ink} strokeWidth={strokeW} />
        ))}
        <rect x="154" y="70" width="26" height="70" fill="#FDFDFD" stroke={ink} strokeWidth={strokeW} />
        <line x1="14" y1="140" x2="192" y2="140" stroke={ink} strokeWidth={strokeW} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line key={i} x1={22 + i * 22} y1="140" x2={22 + i * 22} y2="146" stroke={ink} strokeWidth={strokeW} />
        ))}
      </>
    )}
  </svg>
);

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
  const inset = w * 0.22;
  return (
    <div style={{ position: "absolute", left: x - hw, top: y - hh, width: w, height: h, opacity }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute" }}>
        <path
          d={`M ${inset} 4 L ${w - inset} 4 L ${w - 6} ${hh} L ${w - inset} ${h - 4} L ${inset} ${h - 4} L 6 ${hh} Z`}
          fill="#FDFDFD"
          stroke={ink}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      <div style={{ position: "absolute", left: w * 0.17, top: h * 0.12, width: w * 0.66, height: h * 0.76 }}>
        <Buildings w={w * 0.66} h={h * 0.76} variant={variant} dense={dense} />
      </div>
      {letter && badgeP > 0 && (
        <div
          style={{
            position: "absolute",
            left: badge === "tl" ? -8 : undefined,
            right: badge === "tr" ? -8 : undefined,
            top: -14,
            width: 56,
            height: 56,
            borderRadius: 28,
            background: C.navyBg,
            color: "#FCFCFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SERIF,
            fontSize: 32,
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
}> = ({ x, y, size = 150, closed, opacity = 1 }) => (
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
          <line x1="38" y1={ly} x2="72" y2={ly} stroke={C.red} strokeWidth="3.5" />
        </React.Fragment>
      ))}
    </svg>
  </div>
);
