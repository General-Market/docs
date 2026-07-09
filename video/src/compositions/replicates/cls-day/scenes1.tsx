// cls-day scenes: intro → netting (f0..f1466). All positions/timings
// measured from reference contact sheets (0.5s grid) and per-pixel probes;
// refined per-round via still A/Bs.
import React from "react";
import { interpolate, Easing } from "remotion";
import { C, clamp, Pack } from "./data";
import {
  ClsMark,
  ClsLetters,
  IconHandshake,
  IconProcess,
  IconData,
  TimelineBand,
  MarkerTriangle,
  Milestone,
  Chip,
  ClsPill,
  HexCity,
  Donut,
  Padlock,
} from "./lib";

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

// ─── Logo card (intro + end card share this layout) ───
// End-card geometry: mark x422 y166 size 235; letters x702 y166 h230;
// tagline x442 y426 (65px light sans); icons y651 h170; labels y866 serif 34.
export const LogoCard: React.FC<{
  markP?: number;
  lettersP?: number;
  taglineP?: number;
  iconsP?: number;
  pack: Pack;
  BrandLogo?: React.FC<{ markP: number; lettersP: number }>;
}> = ({ markP = 1, lettersP = 1, taglineP = 1, iconsP = 1, pack, BrandLogo }) => {
  const icons = [
    { X: 572, Icon: IconHandshake, label: pack.pillars[0], cx: 672 },
    { X: 857, Icon: IconProcess, label: pack.pillars[1], cx: 950 },
    { X: 1177, Icon: IconData, label: pack.pillars[2], cx: 1260 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.navyBg }}>
      {BrandLogo ? (
        <BrandLogo markP={markP} lettersP={lettersP} />
      ) : (
        <>
          <div style={{ position: "absolute", left: 422, top: 166, opacity: markP }}>
            <ClsMark size={235} />
          </div>
          <div style={{ position: "absolute", left: 702, top: 168, opacity: lettersP }}>
            <ClsLetters height={230} />
          </div>
        </>
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 420,
          width: 1920,
          textAlign: "center",
          fontFamily: pack.sans,
          fontWeight: 300,
          fontSize: 66,
          letterSpacing: 1,
          color: "#FCFCFC",
          opacity: taglineP,
        }}
      >
        {pack.tagline}
      </div>
      {icons.map(({ X, Icon, label, cx }, i) => (
        <div key={i} style={{ opacity: iconsP }}>
          <div style={{ position: "absolute", left: X, top: 651 }}>
            <Icon size={180} />
          </div>
          <div
            style={{
              position: "absolute",
              left: cx - 150,
              top: 862,
              width: 300,
              textAlign: "center",
              fontFamily: pack.serif,
              fontSize: 34,
              color: "#FCFCFC",
            }}
          >
            {label}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── S1: intro (f0..112) — mark draws, letters+tagline+icons reveal ───
export const S1Intro: React.FC<{ frame: number; pack: Pack; BrandLogo?: React.FC<{ markP: number; lettersP: number }> }> = ({
  frame,
  pack,
  BrandLogo,
}) => {
  if (frame >= 130) return null;
  const markP = interpolate(frame, [0, 18], [0.15, 1], { ...clamp, easing: EASE });
  const lettersP = interpolate(frame, [8, 30], [0, 1], clamp);
  const taglineP = interpolate(frame, [26, 44], [0, 1], clamp);
  const iconsP = interpolate(frame, [40, 58], [0, 1], clamp);
  return (
    <LogoCard markP={markP} lettersP={lettersP} taglineP={taglineP} iconsP={iconsP} pack={pack} BrandLogo={BrandLogo} />
  );
};

// ─── Diagonal white wipe f100..118 (rotated sheet sweeps from right) ───
export const WipeIn: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 96 || frame >= 122) return null;
  const t = interpolate(frame, [96, 120], [0, 1], { ...clamp, easing: EASE });
  // white plane rotated ~-28°, sweeping leftward across the screen
  const x = interpolate(t, [0, 1], [2400, -400]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: -800,
        width: 4200,
        height: 2800,
        background: C.white,
        transform: "rotate(-28deg)",
      }}
    />
  );
};

// ─── S2: currency carousel (f100..300) ───
// Ruler: navy hairline y534 + grey strip y538..552, ticks every 50px.
// Serif pairs ~310px Georgia; top code above the ruler, bottom below.
// Chip columns at x1252 / x1432 (w132 h104, pitch 156).
type PairPhase = { i: number; settle: number; leave: number };
const PAIR_TIMES: PairPhase[] = [
  { i: 0, settle: 118, leave: 172 }, // USD/JPY
  { i: 1, settle: 180, leave: 226 }, // DKK/GBP
  { i: 2, settle: 232, leave: 252 }, // AUD/CHF (accelerating)
  { i: 3, settle: 256, leave: 272 }, // HKD/NZD
  { i: 4, settle: 276, leave: 292 }, // EUR/GBP
];

export const S2Currencies: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 96 || frame >= 320) return null;
  const bgP = interpolate(frame, [116, 124], [0, 1], clamp);
  // ruler: rotates in with the wipe, settles horizontal y534
  const rulerRot = interpolate(frame, [100, 122], [-28, 0], { ...clamp, easing: EASE });
  // ruler slides off with the globe arrival (docks into ring) f288..305
  const rulerOff = interpolate(frame, [288, 308], [0, 1], clamp);
  const pairColor = (c: "red" | "navy") => (c === "red" ? C.red : C.navyInk);
  // chip columns: x1317/x1507, chip 112×71, pitch 80, stacked through the ruler
  const CHIP_COLORS_L = [C.chipGrey, C.chipGrey, C.chipNavy, C.chipGrey, C.chipGrey, C.chipGrey, C.chipGrey];
  const CHIP_COLORS_R = [C.chipCream, C.chipRed, C.chipCream, C.chipCream, C.chipCream, C.chipCream, C.chipCream, C.chipCream, C.chipCream];
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 }}>
      <div style={{ position: "absolute", inset: 0, background: C.white, opacity: bgP }} />
      {/* pairs — serif sits ON the ruler: top baseline y534, bottom cap-top y558 */}
      {PAIR_TIMES.map(({ i, settle, leave }) => {
        const pair = pack.currencyPairs[i];
        if (!pair) return null;
        const enter = settle - 16;
        if (frame < enter || frame > leave + 16) return null;
        const yIn = interpolate(frame, [enter, settle], [520, 0], { ...clamp, easing: EASE });
        const yOut = interpolate(frame, [leave, leave + 16], [0, -560], { ...clamp, easing: Easing.in(Easing.quad) });
        const dy = yIn + yOut;
        return (
          <div key={i} style={{ position: "absolute", inset: 0, transform: `translateY(${dy}px)` }}>
            <div
              style={{
                position: "absolute",
                left: 335,
                top: 534 - 320 * 0.95,
                fontFamily: pack.serif,
                fontSize: 320,
                lineHeight: 0.93,
                color: pairColor(pair.topColor),
              }}
            >
              {pair.top}
            </div>
            <div
              style={{
                position: "absolute",
                left: 445,
                top: 556,
                fontFamily: pack.serif,
                fontSize: 320,
                lineHeight: 0.93,
                color: pairColor(pair.topColor === "red" ? "navy" : "red"),
              }}
            >
              {pair.bottom}
            </div>
          </div>
        );
      })}
      {/* chip columns grow through the scene, stacked tight across the ruler */}
      {CHIP_COLORS_L.map((color, k) => {
        const start = 118 + k * 5;
        if (frame < start) return null;
        const p = interpolate(frame, [start, start + 6], [0, 1], clamp);
        const r = k < 3 ? k - 3 : k - 2; // rows -3..-1, +1..+4
        const y = r < 0 ? 534 + r * 80 - 5 : 538 + 14 + (r - 1) * 80 + 5;
        return <Chip key={`l${k}`} x={1317} y={y} w={112} h={71} color={color} opacity={p} />;
      })}
      {CHIP_COLORS_R.map((color, k) => {
        const start = 114 + k * 5;
        if (frame < start) return null;
        const p = interpolate(frame, [start, start + 6], [0, 1], clamp);
        const r = k < 5 ? k - 5 : k - 4; // rows -5..-1, +1..+4
        const y = r < 0 ? 534 + r * 80 - 5 : 538 + 14 + (r - 1) * 80 + 5;
        return <Chip key={`r${k}`} x={1507} y={y} w={112} h={71} color={color} opacity={p} />;
      })}
      {/* ruler — fine ticks every 22px */}
      <div
        style={{
          position: "absolute",
          left: -200 + rulerOff * -2400,
          top: 531,
          width: 2600,
          transform: `rotate(${rulerRot}deg)`,
          transformOrigin: "1500px 0px",
        }}
      >
        <div style={{ position: "absolute", top: 0, width: 2600, height: 3, background: C.navyDeep }} />
        <div style={{ position: "absolute", top: 3, width: 2600, height: 14, background: C.bandGrey }} />
        {Array.from({ length: 119 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: i * 22, top: 3, width: 1.5, height: 14, background: C.navyDeep }} />
        ))}
      </div>
    </div>
  );
};

// ─── S3: globe clock (f300..460) ───
// Globe cx960 cy690: blue disc r235, grey ring r240..276, ticks, red
// time marks; marker triangle above y560. Padlock right x1310 y610.
const GLOBE = { cx: 960, cy: 690, r: 235, ringW: 36 };

export const S3Globe: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 288 || frame >= 470) return null;
  const arriveX = interpolate(frame, [288, 310], [700, 0], { ...clamp, easing: EASE });
  const exitP = interpolate(frame, [452, 468], [0, 1], clamp);
  const rot = interpolate(frame, [300, 460], [0, -120], clamp); // map drift
  const lockIn = interpolate(frame, [345, 358], [0, 1], clamp);
  const lockClosed = frame >= 400;
  const { cx, cy, r, ringW } = GLOBE;
  return (
    <div style={{ position: "absolute", inset: 0, transform: `translateX(${arriveX}px)`, opacity: 1 - exitP }}>
      {/* ring */}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <circle cx={cx} cy={cy} r={r + ringW / 2 + 2} fill="none" stroke={C.bandGrey} strokeWidth={ringW} />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
          const r0 = r + 2;
          const r1 = r + ringW + 6;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * r0}
              y1={cy + Math.sin(a) * r0}
              x2={cx + Math.cos(a) * r1}
              y2={cy + Math.sin(a) * r1}
              stroke={i % 6 === 0 ? C.red : C.navyDeep}
              strokeWidth={i % 6 === 0 ? 3.5 : 2}
            />
          );
        })}
        {/* globe */}
        <circle cx={cx} cy={cy} r={r} fill={C.blue} />
        {/* simplified drifting continents */}
        <g clipPath="url(#globeClip)">
          <g transform={`translate(${rot} 0)`}>
            <Continents cx={cx} cy={cy} r={r} />
            <Continents cx={cx + 940} cy={cy} r={r} />
          </g>
        </g>
        <defs>
          <clipPath id="globeClip">
            <circle cx={cx} cy={cy} r={r - 2} />
          </clipPath>
        </defs>
      </svg>
      {/* clock labels */}
      <div style={{ position: "absolute", left: cx + r + 28, top: cy - r - 10, fontFamily: "Helvetica", fontSize: 17, color: C.navyDeep, transform: "rotate(55deg)" }}>
        00:00
      </div>
      <MarkerTriangle x={cx} y={cy - r - ringW - 46} size={34} />
      <Padlock x={1290} y={600} closed={lockClosed} opacity={lockIn} />
    </div>
  );
};

// white map outlines (very simplified continents, stroke only)
const Continents: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => (
  <g transform={`translate(${cx - r} ${cy - r}) scale(${(r * 2) / 470})`} fill="none" stroke="#FDFDFD" strokeWidth={5} strokeLinejoin="round">
    {/* americas */}
    <path d="M 120 40 L 180 55 L 175 95 L 145 130 L 150 175 L 125 225 L 130 280 L 105 340 L 95 400 L 80 340 L 88 270 L 70 210 L 85 150 L 70 95 Z" />
    {/* europe/africa */}
    <path d="M 300 60 L 360 70 L 385 110 L 360 150 L 390 200 L 375 270 L 340 330 L 315 290 L 300 220 L 280 160 L 295 110 Z" />
  </g>
);

// ─── S4: trade executed diagram (f460..674) ───
// Band top (standard), marker slides toward 00:00 at center. Hexes A/B
// y380 centers x480/1408; pill center (968,720) 300×110; blue arrow y372.
export const S4Trade: React.FC<{ frame: number; pack: Pack; PillLogo?: React.FC<{ h: number }> }> = ({
  frame,
  pack,
  PillLogo,
}) => {
  if (frame < 440 || frame >= 674) return null;
  const bandIn = interpolate(frame, [440, 462], [0, 1], clamp);
  // measured: marker fixed at 960; 23:00 under it at f550; pan -1.3px/f
  const hourAt = 23 + (frame - 550) * 0.00917;
  const hexIn = interpolate(frame, [462, 486], [0, 1], { ...clamp, easing: EASE });
  const hexSpread = interpolate(frame, [500, 528], [0, 1], { ...clamp, easing: EASE });
  const badgeP = interpolate(frame, [528, 540], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const arrowP = interpolate(frame, [540, 562], [0, 1], { ...clamp, easing: EASE });
  const pillP = interpolate(frame, [548, 566], [0, 1], clamp);
  const connP = interpolate(frame, [560, 585], [0, 1], { ...clamp, easing: EASE });
  const coinP = interpolate(frame, [606, 618], [0, 1], clamp);
  const ax = interpolate(hexSpread, [0, 1], [700, 435]);
  const bx = interpolate(hexSpread, [0, 1], [1220, 1473]);
  const hy = 475;
  const HW = 402;
  const HH = 415;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 }}>
      <div style={{ opacity: bandIn }}>
        <TimelineBand y={96} originX={960} originHour={hourAt} pxPerHour={141.7} />
        <MarkerTriangle x={960} y={27} size={60} />
      </div>
      <HexCity x={ax} y={hy} w={HW} h={HH} letter="A" badgeP={badgeP} variant={0} opacity={hexIn} />
      <HexCity x={bx} y={hy} w={HW} h={HH} letter="B" badge="tr" badgeP={badgeP} variant={1} opacity={hexIn} />
      {/* trade executed arrow y531 */}
      {arrowP > 0 && (
        <>
          <svg width={1920} height={1080} style={{ position: "absolute", opacity: arrowP }}>
            <line x1={ax + HW / 2 + 10} y1={531} x2={ax + HW / 2 + 10 + (bx - ax - HW - 20) * arrowP} y2={531} stroke={C.skyBlue} strokeWidth={4} />
            <path d={`M ${ax + HW / 2 + 24} 531 l 20 -11 v 22 z`} fill={C.skyBlue} transform={`rotate(180 ${ax + HW / 2 + 34} 531)`} />
            <path d={`M ${bx - HW / 2 - 44} 531 l 20 -11 v 22 z`} fill={C.skyBlue} />
          </svg>
          <div
            style={{
              position: "absolute",
              left: 960 - 150,
              top: 488,
              width: 300,
              textAlign: "center",
              fontFamily: pack.sans,
              fontSize: 28,
              color: C.skyBlue,
              opacity: arrowP,
            }}
          >
            {pack.tradeExecuted}
          </div>
        </>
      )}
      {/* connectors into pill */}
      {connP > 0 && (
        <svg width={1920} height={1080} style={{ position: "absolute", opacity: connP }}>
          <path
            d={`M ${ax + 10} ${hy + HH / 2 - 8} L ${ax + 10} 785 Q ${ax + 10} 812 ${ax + 40} 812 L 796 812`}
            fill="none"
            stroke={C.navyDeep}
            strokeWidth={3.5}
          />
          <path d="M 796 812 l -22 -12 v 24 z" fill={C.navyDeep} transform="translate(22 0)" />
          <path
            d={`M ${bx - 10} ${hy + HH / 2 - 8} L ${bx - 10} 785 Q ${bx - 10} 812 ${bx - 40} 812 L 1124 812`}
            fill="none"
            stroke={C.navyDeep}
            strokeWidth={3.5}
          />
          <path d={`M 1124 812 l 22 -12 v 24 z`} fill={C.navyDeep} transform="translate(-22 0)" />
        </svg>
      )}
      {pillP > 0 && <ClsPillSlot x={826} y={759} w={250} h={107} p={pillP} PillLogo={PillLogo} />}
      {/* money icon under A */}
      {coinP > 0 && (
        <svg width={64} height={64} viewBox="0 0 60 60" style={{ position: "absolute", left: ax - 90, top: hy + HH / 2 + 20, opacity: coinP }}>
          <rect x="4" y="10" width="52" height="40" rx="12" fill="none" stroke={C.red} strokeWidth="3" />
          <circle cx="30" cy="30" r="11" fill="none" stroke={C.red} strokeWidth="2.5" />
          <text x="30" y="36" textAnchor="middle" fontFamily="Helvetica" fontSize="16" fill={C.red}>
            $
          </text>
        </svg>
      )}
    </div>
  );
};

export const ClsPillSlot: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  p: number;
  PillLogo?: React.FC<{ h: number }>;
}> = ({ x, y, w, h, p, PillLogo }) =>
  PillLogo ? (
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
        opacity: p,
      }}
    >
      <PillLogo h={h * 0.5} />
    </div>
  ) : (
    <ClsPill x={x} y={y} w={w} h={h} opacity={p} />
  );

// ─── S5: skyline (f674..940) ───
// Band mid y400 h40; upright buildings sit on y400; mirrored navy world
// below y440. Ticks up to y192 (labels top) and down to y870 (labels).
// Content pans left ~35px/s.
export const S5Skyline: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 674 || frame >= 952) return null;
  const fadeOut = interpolate(frame, [936, 950], [0, 1], clamp);
  const bandY = 490;
  const bandH = 85;
  // measured: x(09:00) = 288 - 1.54*(f-750)
  const x9 = 288 - 1.54 * (frame - 750);
  const px = 301.5;
  const docs = [
    { x: 700, t0: 700, sym: "$" },
    { x: 1210, t0: 760, sym: "€" },
    { x: 1560, t0: 830, sym: "$" },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - fadeOut }}>
      {/* navy lower world */}
      <div style={{ position: "absolute", left: 0, top: bandY + bandH, width: 1920, height: 1080 - bandY - bandH, background: C.navyBg }} />
      <div style={{ position: "absolute", left: x9, top: 0, width: 5200 }}>
        {/* hour ticks + labels above and mirrored below (+6h) */}
        {Array.from({ length: 16 }, (_, i) => {
          const x = (i - 1) * px;
          const hh = (8 + i) % 24;
          return (
            <React.Fragment key={i}>
              <div style={{ position: "absolute", left: x, top: 215, width: 3, height: bandY - 215, background: C.navyDeep }} />
              <div style={{ position: "absolute", left: x + 8, top: 182, fontFamily: "Helvetica", fontSize: 27, color: C.navyDeep }}>
                {String(hh).padStart(2, "0")}:00
              </div>
              <div style={{ position: "absolute", left: x, top: bandY + bandH, width: 3, height: 285, background: "#FDFDFD" }} />
              <div
                style={{ position: "absolute", left: x + 8, top: bandY + bandH + 290, fontFamily: "Helvetica", fontSize: 27, color: "#FDFDFD" }}
              >
                {String((hh + 6) % 24).padStart(2, "0")}:00
              </div>
            </React.Fragment>
          );
        })}
        {/* upright buildings above the band (sit on y490) */}
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: -220 + i * 380, top: bandY - 262 }}>
            <Buildings2 variant={(i % 2) as 0 | 1} />
          </div>
        ))}
        {/* mirrored buildings below (white/red ink on navy) */}
        {Array.from({ length: 14 }, (_, i) => (
          <div
            key={i}
            style={{ position: "absolute", left: -30 + i * 380, top: bandY + bandH, transform: "scaleY(-1)", transformOrigin: "top" }}
          >
            <Buildings2 variant={((i + 1) % 2) as 0 | 1} dark />
          </div>
        ))}
      </div>
      {/* grey band on top of buildings */}
      <div style={{ position: "absolute", left: 0, top: bandY, width: 1920, height: bandH, background: C.bandGrey }} />
      {/* floating instruction docs */}
      {docs.map(({ x, t0, sym }, i) => {
        if (frame < t0) return null;
        const p = interpolate(frame, [t0, t0 + 12], [0, 1], clamp);
        const drift = interpolate(frame, [t0, t0 + 120], [0, -60], clamp);
        return (
          <svg key={i} width={64} height={78} viewBox="0 0 64 78" style={{ position: "absolute", left: x - 0.7 * (frame - 750), top: 90 + drift, opacity: p }}>
            <path d="M 4 74 L 4 4 L 44 4 L 60 20 L 60 74 Z" fill="#FDFDFD" stroke={C.navyDeep} strokeWidth="3" strokeLinejoin="round" />
            <path d="M 44 4 L 44 20 L 60 20" fill="none" stroke={C.navyDeep} strokeWidth="3" />
            <circle cx="32" cy="46" r="13" fill="none" stroke={C.red} strokeWidth="2.5" />
            <text x="32" y="53" textAnchor="middle" fontFamily="Helvetica" fontSize="20" fill={C.red}>
              {sym}
            </text>
          </svg>
        );
      })}
    </div>
  );
};

// skyline building cluster (wider than the hex one)
const Buildings2: React.FC<{ variant: 0 | 1; dark?: boolean }> = ({ variant, dark }) => {
  const ink = dark ? "#FDFDFD" : C.navyDeep;
  const accent = C.red;
  const bg = dark ? "transparent" : "#FDFDFD";
  return (
    <svg width={330} height={262} viewBox="0 0 330 232">
      {variant === 0 ? (
        <>
          <rect x="90" y="10" width="70" height="222" fill={bg} stroke={accent} strokeWidth="3" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((r) =>
            [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={100 + c * 18} y={22 + r * 25} width="10" height="13" fill={accent} />),
          )}
          <rect x="160" y="70" width="60" height="162" fill={bg} stroke={ink} strokeWidth="3" />
          {[0, 1, 2, 3, 4].map((r) => (
            <line key={r} x1="168" y1={86 + r * 28} x2="212" y2={86 + r * 28} stroke={ink} strokeWidth="3" />
          ))}
          <rect x="30" y="120" width="60" height="112" fill={bg} stroke={ink} strokeWidth="3" />
          <rect x="220" y="140" width="46" height="92" fill={bg} stroke={ink} strokeWidth="3" />
        </>
      ) : (
        <>
          <rect x="150" y="16" width="76" height="216" fill={bg} stroke={accent} strokeWidth="3" />
          <rect x="164" y="4" width="42" height="12" fill="none" stroke={accent} strokeWidth="3" />
          {[0, 1, 2, 3, 4, 5, 6].map((r) =>
            [0, 1].map((c) => <rect key={`${r}${c}`} x={162 + c * 28} y={28 + r * 27} width="14" height="12" fill={accent} />),
          )}
          <rect x="80" y="90" width="70" height="142" fill={bg} stroke={ink} strokeWidth="3" />
          {[0, 1, 2, 3].map((r) => (
            <rect key={r} x={92} y={104 + r * 30} width="16" height="10" fill="none" stroke={ink} strokeWidth="2.5" />
          ))}
          <rect x="226" y="110" width="54" height="122" fill={bg} stroke={ink} strokeWidth="3" />
        </>
      )}
    </svg>
  );
};

// ─── S6: pay-in schedule 00:00 (f940..1188) ───
export const S6Schedule: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 936 || frame >= 1205) return null;
  const bgP = interpolate(frame, [936, 950], [0, 1], clamp);
  const textP = interpolate(frame, [948, 962], [0, 1], clamp);
  // text block slides off left f985..1015 (measured mid-exit at f1000)
  const textX = interpolate(frame, [985, 1015], [0, -1250], { ...clamp, easing: Easing.in(Easing.quad) });
  const rightP = interpolate(frame, [960, 974], [0, 1], clamp);
  const docP = interpolate(frame, [985, 1005], [0, 1], { ...clamp, easing: EASE });
  const axisP = interpolate(frame, [1025, 1042], [0, 1], clamp);
  const outP = interpolate(frame, [1188, 1204], [0, 1], clamp);
  const bars = [0, 1, 2, 3, 4];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.navyBg, opacity: bgP * (1 - outP) }}>
      <TimelineBand y={152} h={54} originX={293} originHour={24} pxPerHour={199} ink="#FDFDFD" labelSize={32} tickBelow={24} />
      {/* red milestone line at 00:00 (band top to y445) */}
      <Milestone x={293} lineTop={152} lineBottom={445} />
      <div style={{ opacity: textP, transform: `translateX(${textX}px)` }}>
        <div style={{ position: "absolute", left: 360, top: 585, fontFamily: pack.sans, fontWeight: 700, fontSize: 130, color: "#FCFCFC" }}>
          {pack.milestones.m0000.time}
        </div>
        <div style={{ position: "absolute", left: 368, top: 748, fontFamily: pack.sans, fontSize: 38, color: "#FCFCFC" }}>
          {pack.milestones.m0000.label.join(" ")}
        </div>
      </div>
      {/* preview of 06:30 milestone right: red tick on band + label */}
      <div style={{ opacity: rightP }}>
        <div style={{ position: "absolute", left: 1586, top: 152, width: 5, height: 54, background: C.marker }} />
        <div style={{ position: "absolute", left: 1540, top: 628, fontFamily: pack.sans, fontSize: 28, color: "#FCFCFC", lineHeight: 1.35 }}>
          {pack.milestones.m0630.label.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
      {/* schedule document with gantt (drawn white, fills blue) */}
      {docP > 0 && frame >= 985 && (
        <SchedDoc frame={frame} docP={docP} axisP={axisP} bars={bars} x={1032} y={645} w={400} h={425} dark />
      )}
    </div>
  );
};

export const SchedDoc: React.FC<{
  frame: number;
  docP: number;
  axisP: number;
  bars: number[];
  x: number;
  y: number;
  w: number;
  h: number;
  dark?: boolean;
  fillFrom?: number;
}> = ({ frame, docP, axisP, bars, x, y, w, h, dark, fillFrom = 1055 }) => {
  const ink = dark ? "#FDFDFD" : C.navyDeep;
  const n = bars.length;
  const bw = w * 0.19;
  const bh = h * 0.093;
  const stepX = w * 0.155;
  const stepY = h * 0.115;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: docP }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* page outline w/ top-right fold */}
        <path
          d={`M 4 ${h - 4} L 4 4 L ${w - w * 0.13} 4 L ${w - 4} ${w * 0.13} L ${w - 4} ${h - 4} Z`}
          fill="none"
          stroke={ink}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d={`M ${w - w * 0.13} 4 L ${w - w * 0.13} ${w * 0.13} L ${w - 4} ${w * 0.13}`} fill="none" stroke={ink} strokeWidth="3" />
        {/* axis */}
        {axisP > 0 && (
          <g opacity={axisP}>
            <line x1={w * 0.12} y1={h * 0.14} x2={w * 0.66} y2={h * 0.14} stroke={ink} strokeWidth="2.5" />
            {Array.from({ length: 7 }, (_, i) => (
              <line
                key={i}
                x1={w * 0.12 + i * (w * 0.09)}
                y1={h * 0.14}
                x2={w * 0.12 + i * (w * 0.09)}
                y2={h * 0.17}
                stroke={ink}
                strokeWidth="2"
              />
            ))}
          </g>
        )}
        {/* bars staircase */}
        {bars.map((b) => {
          const bx = w * 0.1 + b * stepX;
          const by = h * 0.2 + b * stepY;
          const outlineAt = fillFrom - 25 + b * 8;
          const fillAt = fillFrom + b * 14;
          if (frame < outlineAt) return null;
          const filled = frame >= fillAt;
          return (
            <rect
              key={b}
              x={bx}
              y={by}
              width={bw + (b === n - 1 ? bw * 0.4 : 0)}
              height={bh}
              rx={bh * 0.3}
              fill={filled ? C.blue : "none"}
              stroke={ink}
              strokeWidth="2.5"
            />
          );
        })}
        {/* footer text lines */}
        <line x1={w * 0.1} y1={h * 0.83} x2={w * 0.62} y2={h * 0.83} stroke={ink} strokeWidth="2.5" />
        <line x1={w * 0.1} y1={h * 0.88} x2={w * 0.55} y2={h * 0.88} stroke={ink} strokeWidth="2.5" />
        <line x1={w * 0.1} y1={h * 0.93} x2={w * 0.17} y2={h * 0.93} stroke={ink} strokeWidth="2.5" />
        <line x1={w * 0.19} y1={h * 0.93} x2={w * 0.24} y2={h * 0.93} stroke={ink} strokeWidth="2.5" />
      </svg>
    </div>
  );
};

// ─── S7: netting donuts (f1188..1466) ───
export const S7Netting: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 1188 || frame >= 1478) return null;
  const bgP = interpolate(frame, [1188, 1202], [0, 1], clamp);
  const outP = interpolate(frame, [1464, 1476], [0, 1], clamp);
  // phases
  const p96 = interpolate(frame, [1240, 1285], [0, 0.96], { ...clamp, easing: EASE });
  const p99 = interpolate(frame, [1345, 1385], [0.96, 0.99], clamp);
  const progress = frame < 1240 ? 0 : frame < 1345 ? p96 : p99;
  const pct = frame < 1248 ? pack.percents[0] : frame < 1352 ? pack.percents[1] : pack.percents[2];
  const icon1P = interpolate(frame, [1252, 1266], [0, 1], clamp);
  const icon2P = interpolate(frame, [1330, 1344], [0, 1], clamp);
  const grey = frame < 1240;
  return (
    <div style={{ position: "absolute", inset: 0, background: C.blue, opacity: bgP * (1 - outP) }}>
      <Donut
        cx={1080}
        cy={510}
        r={230}
        thick={95}
        progress={progress}
        pct={pct}
        ringBg={grey ? C.donutGrey : C.donutGrey}
        ringFg={C.navyBg}
        center={grey ? C.blue : "none"}
        textColor="#FCFCFC"
        fontSize={120}
      />
      {progress > 0.2 && <MarkerTriangle x={1080} y={510 - 230 - 95 - 46} size={40} />}
      {/* icon circles + dashed connectors */}
      {icon1P > 0 && <NetIcon x={610} y={frame >= 1330 ? 388 : 510} p={icon1P} kind="in" toX={1080 - 230 - 60} toY={510} />}
      {icon2P > 0 && <NetIcon x={610} y={632} p={icon2P} kind="out" toX={1080 - 230 - 60} toY={510} />}
    </div>
  );
};

const NetIcon: React.FC<{ x: number; y: number; p: number; kind: "in" | "out"; toX: number; toY: number }> = ({
  x,
  y,
  p,
  kind,
  toX,
  toY,
}) => (
  <div style={{ position: "absolute", inset: 0, opacity: p }}>
    <svg width={1920} height={1080} style={{ position: "absolute" }}>
      <circle cx={x} cy={y} r={64} fill="none" stroke="#FDFDFD" strokeWidth={3.5} />
      <path d={`M ${x + 64} ${y} L ${(x + toX) / 2} ${y} L ${(x + toX) / 2} ${toY} L ${toX} ${toY}`} fill="none" stroke="#FDFDFD" strokeWidth={3} strokeDasharray="10 10" />
      {/* chip stack glyph */}
      <g transform={`translate(${x - 34} ${y - 26})`}>
        {[0, 1, 2].map((r) => (
          <rect key={r} x={0} y={r * 19} width={38} height={13} rx={6} fill="none" stroke="#FDFDFD" strokeWidth={2.5} />
        ))}
        {kind === "in" ? (
          <path d="M 44 8 L 66 8 M 58 0 L 66 8 L 58 16 M 44 27 L 62 27 M 44 46 L 58 46" stroke="#FDFDFD" strokeWidth={3} fill="none" />
        ) : (
          <path d="M 66 8 L 44 8 M 52 0 L 44 8 L 52 16 M 44 27 L 62 27" stroke="#FDFDFD" strokeWidth={3} fill="none" />
        )}
      </g>
    </svg>
  </div>
);
