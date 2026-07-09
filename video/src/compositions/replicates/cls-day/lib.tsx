// cls-day shared primitives — all geometry traced from reference frames.
// Local coordinate notes reference the end-card ink block (1076×757 at
// video x422,y161) and per-scene probe logs in STATE-cls-day.md.
import React from "react";
import { C, SANS, SERIF } from "./data";

// ─── CLS swirl mark ───
// Traced from crop-mark (235×235). Built from stacked circles: white disc,
// navy cut disc offset up-left, white inner crescent, navy core, white
// bottom swoosh. viewBox 0 0 235 235.
export const ClsMark: React.FC<{ size: number; ink?: string; bg?: string }> = ({
  size,
  ink = "#FCFCFC",
  bg = C.navyBg,
}) => (
  <svg width={size} height={size} viewBox="0 0 235 235">
    {/* outer crescent: big disc minus up-left-offset disc */}
    <path
      d="M 118 3
         A 114 114 0 1 1 61 216
         A 132 132 0 0 0 194 133
         A 100 100 0 0 0 62 30
         A 114 114 0 0 1 118 3 Z"
      fill={ink}
    />
    {/* inner crescent (left-heavy ring around the core) */}
    <path
      d="M 118 32
         A 92 92 0 1 0 174 196
         A 108 108 0 0 1 63 172
         A 80 80 0 0 1 63 62
         A 92 92 0 0 1 118 32 Z"
      fill={ink}
    />
    {/* core cut */}
    <ellipse cx="122" cy="117" rx="62" ry="72" fill={bg} />
    {/* bottom swoosh */}
    <path
      d="M 60 190
         A 96 96 0 0 0 175 196
         A 120 120 0 0 1 60 190 Z"
      fill={ink}
    />
  </svg>
);

// ─── CLS letterforms ───
// Traced from end-card column scans (strip x255..1076 → letters viewBox
// 0 0 830 235; C at 0..300, L at 300..470, S at 540..830 approx).
export const ClsLetters: React.FC<{ height: number; ink?: string }> = ({
  height,
  ink = "#FCFCFC",
}) => {
  const w = (height / 235) * 830;
  return (
    <svg width={w} height={height} viewBox="0 0 830 235">
      {/* C — bracket open right, hooked bar ends */}
      <path
        d="M 295 0
           L 100 0
           Q 0 0 0 100
           L 0 135
           Q 0 227 100 227
           L 262 227
           Q 297 227 302 196
           Q 290 202 260 202
           L 110 202
           Q 45 202 45 130
           L 45 105
           Q 45 44 110 44
           L 258 44
           Q 288 44 300 50
           Q 296 14 295 0 Z"
        fill={ink}
      />
      {/* L — stem top-left, bar right with beak end */}
      <path
        d="M 305 0
           L 350 0
           L 350 155
           Q 350 202 400 202
           L 570 202
           Q 600 202 612 190
           Q 618 214 622 227
           L 385 227
           Q 305 227 305 150
           L 305 0 Z"
        fill={ink}
      />
      {/* S — square s with round caps */}
      <path
        d="M 680 0
           L 790 0
           Q 796 20 800 44
           L 690 44
           Q 655 44 655 70
           Q 655 95 690 95
           L 755 95
           Q 830 95 830 155
           Q 830 227 745 227
           L 640 227
           Q 626 227 618 213
           Q 610 196 612 190
           Q 622 202 645 202
           L 740 202
           Q 785 202 785 160
           Q 785 137 745 137
           L 680 137
           Q 610 137 610 70
           Q 610 0 680 0 Z"
        fill={ink}
      />
    </svg>
  );
};

export const ClsWordmark: React.FC<{
  height: number;
  ink?: string;
  bg?: string;
  gap?: number;
}> = ({ height, ink = "#FCFCFC", bg = C.navyBg, gap = 0.24 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: height * gap }}>
    <ClsMark size={height} ink={ink} bg={bg} />
    <ClsLetters height={height * 0.97} ink={ink} />
  </div>
);

// ─── Pillar icons (line art, stroke-based) ───
const S_W = 5;

export const IconHandshake: React.FC<{ size: number; ink?: string; accent?: string }> = ({
  size,
  ink = "#FCFCFC",
  accent = C.red,
}) => (
  <svg width={size} height={size * 0.8} viewBox="0 0 200 160">
    {/* right hand (white) */}
    <path
      d="M 60 62 L 100 32 Q 112 24 124 32 L 168 62 Q 178 70 170 82 L 150 108 Q 140 120 126 112"
      fill="none" stroke={ink} strokeWidth={S_W} strokeLinecap="round" strokeLinejoin="round"
    />
    <path d="M 168 62 L 196 48" stroke={ink} strokeWidth={S_W} strokeLinecap="round" />
    {/* clasp knuckles (accent) */}
    {[0, 1, 2, 3].map((i) => (
      <ellipse
        key={i}
        cx={62 + i * 17}
        cy={92 + i * 8}
        rx="12"
        ry="9"
        transform={`rotate(-35 ${62 + i * 17} ${92 + i * 8})`}
        fill="none"
        stroke={accent}
        strokeWidth={S_W}
      />
    ))}
    {/* left arm (accent) then white fingers */}
    <path d="M 4 58 L 34 44 L 62 66" fill="none" stroke={accent} strokeWidth={S_W} strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M 118 96 Q 132 106 122 116 M 104 104 Q 118 114 108 124 M 90 110 Q 102 120 94 128"
      fill="none" stroke={ink} strokeWidth={S_W} strokeLinecap="round"
    />
    <path d="M 4 108 L 40 122" stroke={ink} strokeWidth={S_W} strokeLinecap="round" />
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
              left: x + 8,
              top: y + h + 2,
              fontFamily: SANS,
              fontSize: labelSize,
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
}> = ({ x, y, w, h, logoP = 1, opacity = 1 }) => (
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
      <ClsWordmark height={h * 0.5} />
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
}> = ({ cx, cy, r, thick, progress, pct, ringBg = C.donutGrey, ringFg = C.navyBg, center = "none", textColor = "#FCFCFC", fontSize = 90, gapDeg = 14 }) => {
  const R = r;
  const circ = 2 * Math.PI * R;
  const sweep = Math.max(0, Math.min(1, progress));
  const size = (r + thick) * 2 + 8;
  return (
    <div style={{ position: "absolute", left: cx - size / 2, top: cy - size / 2, width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={ringBg} strokeWidth={thick} />
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
}> = ({ w, h, ink = C.navyDeep, accent = C.red, variant = 0, strokeW = 2.5 }) => (
  <svg width={w} height={h} viewBox="0 0 200 160">
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
}> = ({ x, y, w = 300, h = 220, letter, badge = "tl", variant = 0, opacity = 1, ink = C.navyDeep, badgeP = 1 }) => {
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
        <Buildings w={w * 0.66} h={h * 0.76} variant={variant} />
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
      borderRadius: h * 0.3,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity,
    }}
  >
    <IconHandshake size={w * 0.55} />
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
