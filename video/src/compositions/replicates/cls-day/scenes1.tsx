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

// ─── S1: intro (f0..123) — mark draws, letters+tagline+icons reveal ───
// Exit f108..122: a white slash splits the card in two; both pieces are
// STATIC content clipped by the moving slash edges (measured bar extents),
// while the S2 ruler wipe levels in underneath.
export const S1Intro: React.FC<{ frame: number; pack: Pack; BrandLogo?: React.FC<{ markP: number; lettersP: number }> }> = ({
  frame,
  pack,
  BrandLogo,
}) => {
  if (frame >= 124) return null;
  const markP = interpolate(frame, [0, 18], [0.15, 1], { ...clamp, easing: EASE });
  const lettersP = interpolate(frame, [8, 30], [0, 1], clamp);
  const taglineP = interpolate(frame, [26, 44], [0, 1], clamp);
  const iconsP = interpolate(frame, [40, 58], [0, 1], clamp);
  const card = <LogoCard markP={markP} lettersP={lettersP} taglineP={taglineP} iconsP={iconsP} pack={pack} BrandLogo={BrandLogo} />;
  if (frame < 107) return card;
  // slash edge tables at y540 (probed white runs f107..117); the slit opens
  // at x~975 and both edges accelerate apart while the ruler plane rises
  const slashL = lutS([[107, 896], [109, 888], [110, 878], [111, 856], [112, 792], [113, 660], [114, 488], [115, 230], [116, -60], [117, -420]])(frame);
  const slashR = lutS([[107, 975], [108, 986], [109, 1000], [110, 1040], [111, 1110], [112, 1240], [113, 1510], [114, 1859], [115, 2400]])(frame);
  // edges lean ~14° from vertical (top toward the right)
  const dx = 0.25;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, clipPath: `polygon(-300px -200px, ${slashL + 740 * dx}px -200px, ${slashL - 760 * dx}px 1300px, -300px 1300px)` }}>
        {card}
      </div>
      <div style={{ position: "absolute", inset: 0, clipPath: `polygon(${slashR + 740 * dx}px -200px, 2300px -200px, 2300px 1300px, ${slashR - 760 * dx}px 1300px)` }}>
        {card}
      </div>
    </>
  );
};

// The intro wipe is the S2 ruler itself sweeping up from the bottom-right
// with the white world glued below it (measured: line at -17°, y960
// 1300@f100 → 725@f110 → 534@f124); WipeIn stays exported as a no-op for
// mount-order stability.
export const WipeIn: React.FC<{ frame: number }> = () => null;

// ─── S2: currency carousel (f100..300) ───
// Ruler: navy hairline y534 + grey strip y538..552, ticks every 50px.
// Serif pairs ~310px Georgia; top code above the ruler, bottom below.
// Chip columns at x1252 / x1432 (w132 h104, pitch 156).
type PairPhase = { i: number; settle: number; leave: number };
const PAIR_TIMES: PairPhase[] = [
  { i: 0, settle: 129, leave: 154 }, // USD/JPY (pans in f119..129, collapses into the ruler f154..168)
  { i: 1, settle: 180, leave: 226 }, // DKK/GBP
  { i: 2, settle: 232, leave: 252 }, // AUD/CHF (accelerating)
  { i: 3, settle: 256, leave: 272 }, // HKD/NZD
  { i: 4, settle: 276, leave: 292 }, // EUR/GBP
];

export const S2Currencies: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 96 || frame >= 320) return null;
  const bgP = interpolate(frame, [117, 122], [0, 1], clamp);
  // ruler-led wipe (measured f104..126): the line rises steeply from the
  // bottom-right, then levels onto y534; the white world rides below it.
  const rulerY = lutS([[104, 1300], [106, 1113], [108, 943], [110, 768], [112, 660], [114, 556], [116, 541], [118, 539], [122, 536], [126, 534]])(frame);
  const rulerRot = lutS([[106, -30], [114, -33], [116, -19], [118, -10], [120, -5], [122, -2.4], [124, -0.8], [126, 0]])(frame);
  // ruler slides off with the globe arrival (docks into ring) f288..305
  const rulerOff = interpolate(frame, [288, 308], [0, 1], clamp);
  const pairColor = (c: "red" | "navy") => (c === "red" ? C.red : C.navyInk);
  // chip columns: x1317/x1507, chip 112×71, pitch 80, stacked through the ruler
  const CHIP_COLORS_L = [C.chipGrey, C.chipGrey, C.chipNavy, C.chipGrey, C.chipGrey, C.chipGrey, C.chipGrey];
  const CHIP_COLORS_R = [C.chipCream, C.chipRed, C.chipCream, C.chipCream, C.chipCream, C.chipCream, C.chipCream, C.chipCream, C.chipCream];
  const rulerXf = `translate(${rulerOff * -2400}px, ${rulerY - 534}px) rotate(${rulerRot}deg)`;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 }}>
      <div style={{ position: "absolute", inset: 0, background: C.white, opacity: bgP }} />
      {/* white world below the sweeping line (the wipe) — under the pairs/chips */}
      {frame < 126 && (
        <div style={{ position: "absolute", inset: 0, transform: rulerXf, transformOrigin: "960px 534px" }}>
          <div style={{ position: "absolute", left: -700, top: 548, width: 3400, height: 2600, background: C.white }} />
        </div>
      )}
      {/* pairs — serif sits ON the ruler: top baseline y534, bottom cap-top y558 */}
      {PAIR_TIMES.map(({ i, settle, leave }) => {
        const pair = pack.currencyPairs[i];
        if (!pair) return null;
        // measured grammar: codes PAN IN from the right (USD at x1730 @f121),
        // then COLLAPSE INTO the ruler line on exit (top sinks, bottom rises)
        const enter = i === 0 ? 119 : settle - 12;
        if (frame < enter || frame > leave + 15) return null;
        const xIn = interpolate(frame, [enter, settle], [1500, 0], { ...clamp, easing: EASE });
        const sink = interpolate(frame, [leave, leave + 14], [0, 350], { ...clamp, easing: Easing.in(Easing.quad) });
        return (
          <div key={i} style={{ position: "absolute", inset: 0 }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 534, clipPath: "inset(0 0 0 0)", overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  left: 335,
                  top: 534 - 320 * 0.95,
                  fontFamily: pack.serif,
                  fontSize: 320,
                  lineHeight: 0.93,
                  color: pairColor(pair.topColor),
                  transform: `translate(${xIn}px, ${sink}px)`,
                }}
              >
                {pair.top}
              </div>
            </div>
            <div style={{ position: "absolute", left: 0, top: 548, width: 1920, height: 532, overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  left: 445,
                  top: 556 - 548,
                  fontFamily: pack.serif,
                  fontSize: 320,
                  lineHeight: 0.93,
                  color: pairColor(pair.topColor === "red" ? "navy" : "red"),
                  transform: `translate(${xIn}px, ${-sink}px)`,
                }}
              >
                {pair.bottom}
              </div>
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
      {/* ruler — fine ticks every 22px; leads the white wipe in, then exits with the globe */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: rulerXf,
          transformOrigin: "960px 534px",
        }}
      >
        <div style={{ position: "absolute", left: -200, top: 531, width: 2600, height: 3, background: C.navyDeep }} />
        <div style={{ position: "absolute", left: -200, top: 534, width: 2600, height: 14, background: C.bandGrey }} />
        {Array.from({ length: 119 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: -200 + i * 22, top: 534, width: 1.5, height: 14, background: C.navyDeep }} />
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
// Band mid y490 h85; one ornate cluster every ~2h (603px); mirrored navy
// world below. Exit f920..940: the world rises + shrinks into the S6 band
// (y152 h54) while the city ink fades — the ref never crossfades.
export const S5Skyline: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 674 || frame >= 941) return null;
  const bandY = 490;
  const bandH = 85;
  // measured: x(09:00) = 288 - 1.54*(f-750)
  const x9 = 288 - 1.54 * (frame - 750);
  const px = 301.5;
  // exit rise+shrink (band centers measured f918..940)
  const riseC = lutS([
    [918, 532.5], [920, 521.5], [922, 506.5], [924, 481.5], [926, 430.5], [928, 327],
    [930, 250.5], [932, 214.5], [934, 195.5], [936, 185.5], [938, 179.5], [940, 179],
  ])(frame);
  const sc = lutS([[918, 1], [922, 0.953], [924, 0.929], [926, 0.906], [928, 0.8], [930, 0.718], [932, 0.671], [936, 0.647], [940, 0.635]])(frame);
  const inkP = interpolate(frame, [924, 930], [1, 0], clamp);
  const docs = [
    { x: 700, t0: 700, sym: "$" },
    { x: 1210, t0: 760, sym: "€" },
    { x: 1560, t0: 830, sym: "$" },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${riseC - 532.5}px) scale(${sc})`, transformOrigin: "960px 532.5px" }}>
        {/* navy lower world (tall so the shrink never exposes the floor) */}
        <div style={{ position: "absolute", left: -600, top: bandY + bandH, width: 3200, height: 2000, background: C.navyBg }} />
        <div style={{ position: "absolute", left: x9, top: 0, width: 5200, opacity: inkP }}>
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
          {/* one ornate cluster every ~2h (ref f750: red-tower centers
              134+610k, tower top y181 → scale 1.28) */}
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (i % 2 ? -378 : -333) + i * 610,
                top: bandY - 384,
                transform: "scale(1.28)",
                transformOrigin: "top left",
              }}
            >
              <Buildings2 variant={(i % 2) as 0 | 1} />
            </div>
          ))}
          {/* mirrored clusters below (red+white ink on navy) reach the frame
              bottom (ref: centers 431+610k, depth past y1080 → scaleY 1.7) */}
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (i % 2 ? -39 : -85) + i * 610,
                top: bandY + bandH,
                width: 460,
                height: 300,
                transform: "translateY(384px) scale(1.28, -1.28)",
                transformOrigin: "0 0",
              }}
            >
              <Buildings2 variant={((i + 1) % 2) as 0 | 1} dark />
            </div>
          ))}
        </div>
        {/* grey band on top of buildings */}
        <div style={{ position: "absolute", left: -600, top: bandY, width: 3200, height: bandH, background: C.bandGrey }} />
        {/* floating instruction docs */}
        {docs.map(({ x, t0, sym }, i) => {
          if (frame < t0) return null;
          const p = interpolate(frame, [t0, t0 + 12], [0, 1], clamp) * inkP;
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
    </div>
  );
};

// piecewise-linear table sampler (scene-local)
const lutS =
  (t: [number, number][]) =>
  (frame: number): number => {
    if (frame <= t[0][0]) return t[0][1];
    for (let i = 1; i < t.length; i++) {
      if (frame <= t[i][0]) {
        const [f0, v0] = t[i - 1];
        const [f1, v1] = t[i];
        return v0 + ((frame - f0) / (f1 - f0)) * (v1 - v0);
      }
    }
    return t[t.length - 1][1];
  };

// skyline cluster: dominant ornate red tower + navy sidekicks + grey sliver
// (grammar traced from ref f750 — stripes and window grids, not dot boxes)
const Buildings2: React.FC<{ variant: 0 | 1; dark?: boolean }> = ({ variant, dark }) => {
  const ink = dark ? "#FDFDFD" : C.navyDeep;
  const accent = C.red; // the mirrored world keeps its red ink (ref f750)
  const bg = dark ? "transparent" : "#FDFDFD";
  const sliver = dark ? "rgba(253,253,253,0.25)" : "#DCDCDC";
  return (
    <svg width={460} height={300} viewBox="0 0 460 300">
      {variant === 0 ? (
        <>
          {/* grey backdrop sliver */}
          <rect x={210} y={200} width={40} height={100} fill={sliver} />
          {/* small navy building left, dash windows + antenna */}
          <rect x={20} y={165} width={52} height={135} fill={bg} stroke={ink} strokeWidth="3" />
          <line x1={36} y1={165} x2={36} y2={148} stroke={ink} strokeWidth="3" />
          <line x1={28} y1={152} x2={44} y2={152} stroke={ink} strokeWidth="3" />
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <line key={r} x1={30} y1={182 + r * 18} x2={52} y2={182 + r * 18} stroke={ink} strokeWidth="3.5" />
          ))}
          {/* dominant red tower: crown, stripe rows, window grid, red band */}
          <rect x={95} y={55} width={40} height={20} fill="none" stroke={accent} strokeWidth="3" />
          <line x1={115} y1={55} x2={115} y2={38} stroke={accent} strokeWidth="3" />
          <path d={`M 80 300 L 80 75 L 190 75 Q 200 75 200 88 L 200 300`} fill={bg} stroke={accent} strokeWidth="3.5" />
          {[0, 1, 2, 3, 4, 5, 6].map((c) => (
            <line key={c} x1={100 + c * 13} y1={92} x2={100 + c * 13} y2={124} stroke={accent} strokeWidth="3" />
          ))}
          <rect x={94} y={136} width={92} height={16} fill={accent} />
          {[0, 1].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <rect key={`${r}${c}`} x={98 + c * 23} y={162 + r * 26} width={15} height={16} fill="none" stroke={accent} strokeWidth="2.5" />
            )),
          )}
          {[0, 1, 2, 3, 4].map((c) => (
            <line key={c} x1={102 + c * 20} y1={224} x2={102 + c * 20} y2={296} stroke={accent} strokeWidth="3" strokeDasharray="8 7" />
          ))}
          {/* small navy building right with window boxes */}
          <rect x={214} y={218} width={64} height={82} fill={bg} stroke={ink} strokeWidth="3" />
          {[0, 1].map((r) =>
            [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={222 + c * 19} y={230 + r * 22} width={10} height={12} fill={ink} />),
          )}
        </>
      ) : (
        <>
          <rect x={330} y={190} width={36} height={110} fill={sliver} />
          {/* small navy building left */}
          <rect x={30} y={185} width={50} height={115} fill={bg} stroke={ink} strokeWidth="3" />
          <line x1={46} y1={185} x2={46} y2={168} stroke={ink} strokeWidth="3" />
          {[0, 1, 2, 3, 4].map((r) => (
            <line key={r} x1={40} y1={200 + r * 18} x2={62} y2={200 + r * 18} stroke={ink} strokeWidth="3.5" />
          ))}
          {/* dominant red tower: filled-square column + stripe wing + crown */}
          <path d={`M 105 300 L 105 68 Q 105 58 115 58 L 150 58 L 150 300`} fill={bg} stroke={accent} strokeWidth="3.5" />
          {[0, 1, 2, 3, 4].map((r) => (
            <rect key={r} x={116} y={78 + r * 42} width={22} height={22} fill={r % 2 === 0 ? accent : "none"} stroke={accent} strokeWidth="2.5" />
          ))}
          <path d={`M 150 300 L 150 92 Q 150 82 160 82 L 235 82 Q 245 82 245 95 L 245 300`} fill={bg} stroke={accent} strokeWidth="3.5" />
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <line key={c} x1={165 + c * 13} y1={108} x2={165 + c * 13} y2={210} stroke={accent} strokeWidth="3" />
          ))}
          <rect x={130} y={44} width={46} height={14} fill="none" stroke={accent} strokeWidth="3" />
          {/* small navy building right */}
          <rect x={260} y={210} width={58} height={90} fill={bg} stroke={ink} strokeWidth="3" />
          {[0, 1, 2].map((r) => (
            <rect key={r} x={270} y={222 + r * 24} width={26} height={12} fill="none" stroke={ink} strokeWidth="2.5" />
          ))}
        </>
      )}
    </svg>
  );
};

// ─── S6: pay-in schedule 00:00 (f923..1176) ───
// Arrival: navy sweeps in from top-right f923..930 (no crossfade); the band
// ticks + red 00:00 line pan in from the right, decelerating (red line
// x630@f930 → x293@f940 measured). Exit: the camera dives into the doc's
// last blue bar f1152..1176 (zoom, focus 1016,755) — S7's blue field IS
// that bar.
export const S6Schedule: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 923 || frame >= 1177) return null;
  // navy arrival: a vertical edge sweeps right→left above the rising band
  // (probed f923..930: x 1671→1548→1382→1152→830→400→50→0)
  const sweepX = lutS([[922, 1920], [923, 1671], [924, 1548], [925, 1382], [926, 1152], [927, 830], [928, 400], [929, 50], [930, -10]])(frame);
  // the S5 band top while it rises (the sweep stops at the band)
  const bandTopS5 = lutS([[923, 500], [924, 466], [926, 411], [928, 296], [930, 224], [934, 168], [938, 155], [940, 152]])(frame);
  const panIn = lutS([[929, 480], [930, 337], [932, 159], [934, 71], [936, 25], [938, 3], [940, 0]])(frame);
  const textP = interpolate(frame, [948, 962], [0, 1], clamp);
  // text block slides off left f985..1015 (measured mid-exit at f1000)
  const textX = interpolate(frame, [985, 1015], [0, -1250], { ...clamp, easing: Easing.in(Easing.quad) });
  const rightP = interpolate(frame, [960, 974], [0, 1], clamp);
  const docP = interpolate(frame, [988, 1015], [0, 1], { ...clamp, easing: EASE });
  const axisP = interpolate(frame, [1025, 1042], [0, 1], clamp);
  // exit zoom into the last bar (blue-area growth table, f1152..1176)
  const zoomS = lutS([[1152, 1], [1156, 1.35], [1158, 1.7], [1160, 2.1], [1162, 2.7], [1164, 4], [1166, 7], [1168, 11], [1170, 15], [1172, 20], [1176, 26]])(frame);
  const bars = [0, 1, 2, 3, 4];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoomS})`, transformOrigin: "1016px 755px" }}>
        {/* navy arrival above the band: vertical edge sweeping right→left */}
        {frame < 938 ? (
          <div style={{ position: "absolute", left: sweepX, top: 0, width: 1980 - sweepX, height: bandTopS5, background: C.navyBg }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: C.navyBg }} />
        )}
        <div style={{ opacity: frame >= 929 ? 1 : 0, clipPath: frame < 941 ? `inset(0 0 0 ${panIn * 1.27}px)` : undefined }}>
          <TimelineBand y={152} h={54} originX={293 + panIn} originHour={24} pxPerHour={199} ink="#FDFDFD" labelSize={32} tickBelow={24} />
          {/* red milestone line at 00:00 (band top to y445) */}
          <Milestone x={293 + panIn} lineTop={152} lineBottom={445} />
        </div>
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
        {/* schedule document with gantt — measured (310,260) 966×671 */}
        {docP > 0 && frame >= 988 && (
          <SchedDoc frame={frame} docP={docP} axisP={axisP} bars={bars} x={310} y={260} w={966} h={671} dark />
        )}
      </div>
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
  // bar rects measured on ref f1142, as fractions of the 966×671 page;
  // the last bar is double height — it is the S7 zoom target.
  const RECTS: [number, number, number, number][] = [
    [0.0838, 0.2578, 0.1014, 0.0537],
    [0.1988, 0.3487, 0.2143, 0.0537],
    [0.4203, 0.4531, 0.1004, 0.0537],
    [0.557, 0.5633, 0.1014, 0.0537],
    [0.6791, 0.6796, 0.1046, 0.1163],
  ];
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: docP }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* page outline w/ top-right fold */}
        <path
          d={`M 4 ${h - 4} L 4 4 L ${w - w * 0.1} 4 L ${w - 4} ${w * 0.1} L ${w - 4} ${h - 4} Z`}
          fill="none"
          stroke={ink}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d={`M ${w - w * 0.1} 4 L ${w - w * 0.1} ${w * 0.1} L ${w - 4} ${w * 0.1}`} fill="none" stroke={ink} strokeWidth="4" />
        {/* axis with hanging ticks */}
        {axisP > 0 && (
          <g opacity={axisP}>
            <line x1={w * 0.078} y1={h * 0.115} x2={w * 0.787} y2={h * 0.115} stroke={ink} strokeWidth="3" />
            {Array.from({ length: 8 }, (_, i) => (
              <line
                key={i}
                x1={w * 0.078 + i * (w * 0.1)}
                y1={h * 0.115}
                x2={w * 0.078 + i * (w * 0.1)}
                y2={h * 0.164}
                stroke={ink}
                strokeWidth="2.5"
              />
            ))}
          </g>
        )}
        {/* bars staircase */}
        {bars.map((b) => {
          const [fx, fy, fw, fh] = RECTS[b];
          const outlineAt = fillFrom - 25 + b * 8;
          const fillAt = fillFrom + b * 14;
          if (frame < outlineAt) return null;
          const filled = frame >= fillAt;
          return (
            <rect
              key={b}
              x={fx * w}
              y={fy * h}
              width={fw * w}
              height={fh * h}
              rx={h * 0.0537 * 0.3}
              fill={filled ? C.blue : "none"}
              stroke={ink}
              strokeWidth="3"
            />
          );
        })}
        {/* footer text lines */}
        <line x1={w * 0.09} y1={h * 0.865} x2={w * 0.8} y2={h * 0.865} stroke={ink} strokeWidth="3" />
        <line x1={w * 0.09} y1={h * 0.915} x2={w * 0.62} y2={h * 0.915} stroke={ink} strokeWidth="3" />
        <line x1={w * 0.09} y1={h * 0.96} x2={w * 0.16} y2={h * 0.96} stroke={ink} strokeWidth="3" />
        <line x1={w * 0.18} y1={h * 0.96} x2={w * 0.23} y2={h * 0.96} stroke={ink} strokeWidth="3" />
      </svg>
    </div>
  );
};

// ─── S7: netting donuts (f1170..1466) ───
// Measured: grey ring draws in at (958,517) f1170..1188, slides right to
// (1352,517) f1192..1212 (outer R 355, thick 131); one big icon circle
// r237 at (511,511), later two r150 circles; no dashed connectors.
export const S7Netting: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 1170 || frame >= 1478) return null;
  const bgP = interpolate(frame, [1170, 1174], [0, 1], clamp);
  const outP = interpolate(frame, [1464, 1476], [0, 1], clamp);
  const ringIn = lutS([[1170, 0.05], [1172, 0.115], [1174, 0.26], [1176, 0.7], [1178, 0.86], [1180, 0.94], [1182, 0.975], [1188, 1]])(frame);
  const cx = interpolate(frame, [1192, 1212], [958, 1352], { ...clamp, easing: EASE });
  const cy = 517;
  // phases
  const p96 = interpolate(frame, [1240, 1285], [0, 0.96], { ...clamp, easing: EASE });
  const p99 = interpolate(frame, [1345, 1385], [0.96, 0.99], clamp);
  const progress = frame < 1240 ? 0 : frame < 1345 ? p96 : p99;
  const pct = frame < 1248 ? pack.percents[0] : frame < 1352 ? pack.percents[1] : pack.percents[2];
  const icon1P = interpolate(frame, [1238, 1250], [0, 1], clamp);
  const splitP = interpolate(frame, [1352, 1364], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.blue, opacity: bgP * (1 - outP) }}>
      <Donut
        cx={cx}
        cy={cy}
        r={289.5}
        thick={131}
        progress={progress}
        pct={frame >= 1230 ? pct : ""}
        ringBg={C.donutGrey}
        ringFg={C.navyBg}
        center="none"
        textColor="#FCFCFC"
        fontSize={130}
        bgSweep={ringIn}
      />
      {progress > 0.2 && <MarkerTriangle x={cx} y={cy - 289.5 - 131 / 2 - 52} size={40} />}
      {/* icon circles (one big, then two) */}
      {icon1P > 0 && splitP < 1 && <NetIcon x={511} y={511} r={237} p={icon1P * (1 - splitP)} kind="in" />}
      {splitP > 0 && (
        <>
          <NetIcon x={516} y={313} r={150} p={splitP} kind="in" />
          <NetIcon x={515} y={721} r={150} p={splitP} kind="out" />
        </>
      )}
    </div>
  );
};

const NetIcon: React.FC<{ x: number; y: number; r: number; p: number; kind: "in" | "out" }> = ({ x, y, r, p, kind }) => {
  const s = r / 110; // glyph scale
  return (
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <circle cx={x} cy={y} r={r} fill="none" stroke="#FDFDFD" strokeWidth={4} />
        {/* chip stack glyph */}
        <g transform={`translate(${x} ${y}) scale(${s}) translate(-56 -40)`}>
          {[0, 1, 2].map((row) => (
            <rect key={row} x={0} y={row * 30} width={58} height={21} rx={9} fill="none" stroke="#FDFDFD" strokeWidth={3.5} />
          ))}
          {kind === "in" ? (
            <path d="M 68 12 L 102 12 M 90 0 L 102 12 L 90 24 M 68 42 L 96 42 M 68 72 L 88 72" stroke="#FDFDFD" strokeWidth={4.5} fill="none" />
          ) : (
            <path d="M 102 12 L 68 12 M 80 0 L 68 12 L 80 24 M 68 42 L 96 42" stroke="#FDFDFD" strokeWidth={4.5} fill="none" />
          )}
        </g>
      </svg>
    </div>
  );
};
