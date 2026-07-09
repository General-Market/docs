// cls-day scenes: revised schedule → end card (f1466..f3750).
import React from "react";
import { interpolate, Easing } from "remotion";
import { C, clamp, Pack } from "./data";
import {
  TimelineBand,
  MarkerTriangle,
  Milestone,
  Chip,
  HexCity,
  BankHex,
  HandshakePill,
  CheckCircle,
} from "./lib";
import { SchedDoc, ClsPillSlot, LogoCard } from "./scenes1";

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

// ─── S8: revised pay-in schedule 06:30 (f1466..1700) ───
export const S8Revised: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 1466 || frame >= 1712) return null;
  const outP = interpolate(frame, [1700, 1712], [0, 1], clamp);
  // phase A (1466..1500): standard band + gantt doc; zooms in 1500..1522
  // (measured f1520: band h173 pitch ~507 = 3.58×, doc fold at 446..670/570..800)
  // phase B (1535..1600): 06:30 text + chip stack; phase C: revised staircase
  const zoom = interpolate(frame, [1500, 1522], [1, 3.58], { ...clamp, easing: EASE });
  const phaseB = interpolate(frame, [1535, 1550], [0, 1], clamp);
  const phaseC = interpolate(frame, [1595, 1612], [0, 1], clamp);
  const hourAt = interpolate(frame, [1466, 1535], [3.2, 4.4], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      {phaseB < 1 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoom})`,
            transformOrigin: "340px 340px",
            opacity: 1 - phaseB,
          }}
        >
          <TimelineBand originX={960} originHour={hourAt} pxPerHour={141.6} />
          <MarkerTriangle x={958} y={27} size={60} />
          <SchedDoc frame={frame} docP={1} axisP={1} bars={[0, 1, 2, 3, 4]} x={140} y={560} w={500} h={480} fillFrom={0} />
        </div>
      )}
      {/* 06:30 milestone view */}
      {phaseB > 0 && phaseC < 1 && (
        <div style={{ opacity: phaseB * (1 - phaseC) }}>
          <TimelineBand y={0} h={110} originX={1140} originHour={6.5} pxPerHour={340} labelSize={44} tickBelow={34} />
          <Milestone x={1140} lineTop={0} lineBottom={780} />
          <div style={{ position: "absolute", left: 540, top: 660, fontFamily: pack.sans, fontWeight: 700, fontSize: 110, color: C.navyInk }}>
            {pack.milestones.m0630.time}
          </div>
          <div style={{ position: "absolute", left: 546, top: 800, fontFamily: pack.sans, fontSize: 34, color: C.navyInk, lineHeight: 1.3 }}>
            {pack.milestones.m0630.label.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
          {/* chip stack right */}
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const p = interpolate(frame, [1552 + k * 5, 1560 + k * 5], [0, 1], clamp);
            return (
              <Chip
                key={k}
                x={1218}
                y={640 + k * 54}
                w={90}
                h={42}
                color={k === 5 ? C.chipNavy : C.chipGrey}
                opacity={p * 0.95}
              />
            );
          })}
        </div>
      )}
      {/* revised staircase bars (zoomed schedule, grey → navy) */}
      {phaseC > 0 && (
        <div style={{ opacity: phaseC }}>
          <TimelineBand y={0} h={110} originX={interpolate(frame, [1600, 1700], [980, 620], clamp)} originHour={7} pxPerHour={340} labelSize={44} tickBelow={34} />
          <Milestone x={interpolate(frame, [1600, 1700], [980, 620], clamp) - 170} lineTop={0} lineBottom={1080} />
          {[0, 1, 2, 3, 4].map((b) => {
            const navyAt = 1640 + b * 10;
            const isNavy = frame >= navyAt;
            const slide = interpolate(frame, [1600 + b * 6, 1622 + b * 6], [300, 0], { ...clamp, easing: EASE });
            return (
              <div
                key={b}
                style={{
                  position: "absolute",
                  left: 40 + b * 330 + slide,
                  top: 905 - (4 - b) * 60,
                  width: 300 + (b === 4 ? 80 : 0),
                  height: 52,
                  borderRadius: 16,
                  background: isNavy ? C.navyBg : C.chipGrey,
                  border: `3px solid ${C.navyDeep}`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── S9: zoom times 06:00 | 07:00 → settle band (f1700..1837) ───
export const S9ZoomTimes: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 1700 || frame >= 1850) return null;
  // giant labels sweep left as the clock runs 06:00→07:00
  const sweep = interpolate(frame, [1700, 1790], [500, -900], clamp);
  const zoomOut = interpolate(frame, [1790, 1825], [0, 1], { ...clamp, easing: EASE });
  const scale = interpolate(zoomOut, [0, 1], [1, 0.22]);
  const bandInP = interpolate(frame, [1810, 1830], [0, 1], clamp);
  const labelP = interpolate(frame, [1825, 1840], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white }}>
      {zoomOut < 1 && (
        <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: "960px 200px", opacity: 1 - zoomOut }}>
          {[0, 1].map((i) => {
            const x = 380 + i * 780 + sweep;
            return (
              <React.Fragment key={i}>
                <div style={{ position: "absolute", left: x, top: 130, width: 8, height: 180, background: C.navyInk }} />
                <div style={{ position: "absolute", left: x + 24, top: 152, fontFamily: pack.sans, fontSize: 96, color: C.navyInk }}>
                  {i === 0 ? "06:00" : "07:00"}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
      {/* settled band with 07:00 milestone */}
      <div style={{ opacity: bandInP }}>
        <TimelineBand originX={960} originHour={7} pxPerHour={141.6} />
        <MarkerTriangle x={958} y={27} size={60} />
        <Milestone
          x={960}
          lineTop={84}
          lineBottom={330}
          time={pack.milestones.m0700.time}
          label={pack.milestones.m0700.label}
          textY={170}
          timeSize={40}
          labelSize={24}
          opacity={labelP}
        />
      </div>
    </div>
  );
};

// ─── S10: settlement flows A/CLS/B + central banks (f1837..2075) ───
export const S10Settle: React.FC<{ frame: number; pack: Pack; PillLogo?: React.FC<{ h: number }> }> = ({
  frame,
  pack,
  PillLogo,
}) => {
  if (frame < 1837 || frame >= 2090) return null;
  const outP = interpolate(frame, [2075, 2090], [0, 1], clamp);
  const hexP = interpolate(frame, [1845, 1868], [0, 1], { ...clamp, easing: EASE });
  const pillP = interpolate(frame, [1872, 1890], [0, 1], clamp);
  const bankP = interpolate(frame, [1900, 1916], [0, 1], clamp);
  const connP = interpolate(frame, [1890, 1912], [0, 1], clamp);
  const ax = 571;
  const bx = 1438;
  const hy = 404;
  // chips travel: A→pill (red, pay-in), central bank→pill, pill→both (pay-outs)
  const chips: { p: number; from: [number, number]; to: [number, number]; color: string }[] = [
    { p: travel(frame, 1930, 1990), from: [ax, hy + 190], to: [880, 812], color: C.chipRed },
    { p: travel(frame, 1960, 2020), from: [1370, 700], to: [1130, 812], color: C.chipGrey },
    { p: travel(frame, 1990, 2050), from: [1060, 812], to: [bx, hy + 190], color: C.chipNavy },
    { p: travel(frame, 2010, 2065), from: [900, 812], to: [ax, hy + 190], color: C.chipCream },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      <TimelineBand originX={958} originHour={7} pxPerHour={141.6} />
      <MarkerTriangle x={958} y={27} size={60} />
      <Milestone x={958} lineTop={84} lineBottom={148} time={pack.milestones.m0700.time} label={pack.milestones.m0700.label} textY={160} timeSize={28} labelSize={18} />
      <HexCity x={ax} y={hy} w={380} h={390} letter="A" variant={0} opacity={hexP} />
      <HexCity x={bx} y={hy} w={380} h={390} letter="B" badge="tr" variant={1} opacity={hexP} />
      {bankP > 0 && <BankHex x={1370} y={648} size={100} opacity={bankP} />}
      {connP > 0 && (
        <svg width={1920} height={1080} style={{ position: "absolute", opacity: connP }}>
          <path d={`M ${ax + 10} ${hy + 186} L ${ax + 10} 782 Q ${ax + 10} 812 ${ax + 40} 812 L 796 812`} fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
          <path d="M 796 812 l -22 -12 v 24 z" fill={C.navyDeep} transform="translate(22 0)" />
          <path d={`M 1370 698 L 1370 782 Q 1370 812 1340 812 L 1124 812`} fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
          <path d={`M 1124 812 l 22 -12 v 24 z`} fill={C.navyDeep} transform="translate(-22 0)" />
          <path d={`M ${bx - 10} ${hy + 186} L ${bx - 10} 598`} fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
        </svg>
      )}
      {pillP > 0 && <ClsPillSlot x={826} y={759} w={250} h={107} p={pillP} PillLogo={PillLogo} />}
      {chips.map((c, i) => {
        if (c.p <= 0 || c.p >= 1) return null;
        const x = c.from[0] + (c.to[0] - c.from[0]) * c.p;
        const y = c.from[1] + (c.to[1] - c.from[1]) * c.p;
        return <Chip key={i} x={x - 43} y={y - 17} w={86} h={34} color={c.color} />;
      })}
    </div>
  );
};

const travel = (frame: number, t0: number, t1: number) =>
  interpolate(frame, [t0, t1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });

// ─── S11: payment instruction docs row (f2075..2237) ───
export const S11DocsRow: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 2075 || frame >= 2250) return null;
  const inP = interpolate(frame, [2075, 2090], [0, 1], clamp);
  const outP = interpolate(frame, [2237, 2250], [0, 1], clamp);
  const slide = interpolate(frame, [2085, 2237], [180, -420], clamp);
  const docs = [
    { x: 0, w: 120, h: 150, accent: "navy" },
    { x: 170, w: 150, h: 180, accent: "grey" },
    { x: 380, w: 240, h: 300, accent: "big" },
    { x: 700, w: 130, h: 160, accent: "red" },
    { x: 880, w: 140, h: 170, accent: "tri" },
    { x: 1070, w: 120, h: 150, accent: "reddot" },
    { x: 1250, w: 150, h: 185, accent: "navy" },
    { x: 1460, w: 130, h: 160, accent: "grey" },
    { x: 1650, w: 145, h: 175, accent: "red" },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: inP * (1 - outP) }}>
      <TimelineBand originX={958} originHour={7} pxPerHour={141.6} />
      <MarkerTriangle x={958} y={27} size={60} />
      {docs.map((d, i) => (
        <MiniDoc key={i} x={d.x + slide} yMid={700} w={d.w} h={d.h} big={d.accent === "big"} seed={i} />
      ))}
    </div>
  );
};

export const MiniDoc: React.FC<{ x: number; yMid: number; w: number; h: number; big?: boolean; seed: number }> = ({
  x,
  yMid,
  w,
  h,
  big,
  seed,
}) => {
  const ink = C.navyDeep;
  const accents = [C.navyBg, C.chipGrey, C.red, C.chipCream];
  const acc = accents[seed % 4];
  return (
    <div style={{ position: "absolute", left: x, top: yMid - h / 2 - (big ? 40 : 0) }}>
      {big && (
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 14,
            width: w,
            height: h,
            background: C.white,
            border: `3px solid ${ink}`,
            borderRadius: 4,
          }}
        />
      )}
      <div style={{ position: "relative", width: w, height: h, background: C.white, border: `3px solid ${ink}`, borderRadius: 4 }}>
        <div style={{ position: "absolute", left: w * 0.1, top: h * 0.08, width: w * 0.28, height: h * 0.09, background: acc }} />
        <div style={{ position: "absolute", left: w * 0.1, top: h * 0.3, width: w * 0.8, height: h * 0.1, border: `2px solid ${ink}` }} />
        <div style={{ position: "absolute", left: w * 0.1, top: h * 0.48, width: w * 0.55, height: 3, background: ink }} />
        <div style={{ position: "absolute", left: w * 0.1, top: h * 0.58, width: w * 0.4, height: 3, background: ink }} />
        <div style={{ position: "absolute", left: w * 0.1, top: h * 0.74, width: w * 0.3, height: h * 0.1, background: acc, opacity: 0.6 }} />
      </div>
    </div>
  );
};

// ─── S12: checks on the big doc (f2237..2362) ───
export const S12Checks: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 2237 || frame >= 2375) return null;
  const outP = interpolate(frame, [2362, 2375], [0, 1], clamp);
  const checks = [
    { x: 640, y: 620, at: 2255, tx: 850, ty: 640 },
    { x: 1275, y: 590, at: 2290, tx: 1080, ty: 690 },
    { x: 1320, y: 830, at: 2320, tx: 1090, ty: 800 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      <TimelineBand originX={958} originHour={7} pxPerHour={141.6} />
      <MarkerTriangle x={958} y={27} size={60} />
      <MiniDoc x={840} yMid={720} w={260} h={330} big seed={0} />
      {checks.map((c, i) => {
        const p = interpolate(frame, [c.at, c.at + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
        const lineP = interpolate(frame, [c.at + 4, c.at + 14], [0, 1], clamp);
        if (frame < c.at) return null;
        return (
          <React.Fragment key={i}>
            <svg width={1920} height={1080} style={{ position: "absolute", opacity: lineP }}>
              <line x1={c.x} y1={c.y} x2={c.x + (c.tx - c.x) * lineP} y2={c.y + (c.ty - c.y) * lineP} stroke={C.marker} strokeWidth={3} />
              <circle cx={c.tx} cy={c.ty} r={5} fill="none" stroke={C.marker} strokeWidth={2.5} opacity={lineP} />
            </svg>
            <CheckCircle x={c.x} y={c.y} size={74 * Math.min(p, 1.15)} opacity={Math.min(p * 2, 1)} />
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── S13: PvP handshake (f2362..2737) ───
export const S13Pvp: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 2362 || frame >= 2750) return null;
  const outP = interpolate(frame, [2737, 2750], [0, 1], clamp);
  const cityP = interpolate(frame, [2380, 2405], [0, 1], { ...clamp, easing: EASE });
  const pillP = interpolate(frame, [2370, 2390], [0, 1], clamp);
  const pathP = interpolate(frame, [2410, 2440], [0, 1], { ...clamp, easing: EASE });
  // chip runs, both directions at once (PvP)
  const runs = [
    { t0: 2500, t1: 2570, top: true, color: C.chipRed },
    { t0: 2540, t1: 2610, top: false, color: C.chipGrey },
    { t0: 2570, t1: 2640, top: true, color: C.chipCream },
    { t0: 2600, t1: 2670, top: false, color: C.chipNavy },
    { t0: 2630, t1: 2700, top: true, color: C.chipRed },
    { t0: 2650, t1: 2715, top: false, color: C.chipGrey },
  ];
  const topPath = (p: number): [number, number] => [1650 - p * 1290, 279];
  const botPath = (p: number): [number, number] => [270 + p * 1290, 781];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      {/* band touches the top edge in this scene (y0 h57), static, no marker */}
      <TimelineBand y={0} h={57} originX={101} originHour={4} pxPerHour={285.7} tickAbove={0} tickBelow={22} labelSize={30} />
      {/* big city clusters clipped at frame edges */}
      <div style={{ opacity: cityP }}>
        <BigCity side="left" />
        <BigCity side="right" />
      </div>
      {/* rails */}
      <svg width={1920} height={1080} style={{ position: "absolute", opacity: pathP }}>
        <path d="M 1650 279 L 330 279" fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
        <path d="M 348 279 l 22 -12 v 24 z" fill={C.navyDeep} transform="rotate(180 359 279)" />
        <path d="M 270 781 L 1590 781" fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
        <path d="M 1570 781 l 22 -12 v 24 z" fill={C.navyDeep} />
        {/* vertical line through pill */}
        <line x1={949} y1={279} x2={949} y2={781} stroke={C.navyDeep} strokeWidth={3} />
      </svg>
      <HandshakePill x={759} y={435} w={380} h={213} opacity={pillP} />
      {runs.map((r, i) => {
        const p = interpolate(frame, [r.t0, r.t1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
        if (frame < r.t0 || p >= 1) return null;
        const [x, y] = r.top ? topPath(p) : botPath(p);
        return <Chip key={i} x={x - 48} y={y - 19} w={96} h={38} color={r.color} />;
      })}
    </div>
  );
};

const BigCity: React.FC<{ side: "left" | "right" }> = ({ side }) => {
  const flip = side === "right";
  return (
    <div
      style={{
        position: "absolute",
        left: flip ? 1440 : -140,
        top: 223,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    >
      <svg width={620} height={614} viewBox="0 0 620 614">
        {/* half-hexagon frame: flat top/bottom, right vertex mid-height */}
        <path d="M 0 2 L 420 2 L 618 307 L 420 612 L 0 612" fill="none" stroke={C.navyDeep} strokeWidth={3.5} strokeLinejoin="round" />
        {/* buildings */}
        <rect x="80" y="120" width="120" height="360" fill="#FDFDFD" stroke={C.red} strokeWidth="3.5" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((r) =>
          [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={96 + c * 32} y={140 + r * 42} width="18" height="22" fill={C.red} />),
        )}
        <rect x="210" y="200" width="100" height="280" fill="#FDFDFD" stroke={C.navyDeep} strokeWidth="3.5" />
        {[0, 1, 2, 3, 4].map((r) => (
          <line key={r} x1="222" y1={224 + r * 48} x2="298" y2={224 + r * 48} stroke={C.navyDeep} strokeWidth="3" />
        ))}
        <rect x="320" y="260" width="90" height="220" fill="#FDFDFD" stroke={C.navyDeep} strokeWidth="3.5" />
        <rect x="20" y="280" width="60" height="200" fill="#FDFDFD" stroke={C.navyDeep} strokeWidth="3" />
        <line x1="0" y1="480" x2="510" y2="480" stroke={C.navyDeep} strokeWidth="3.5" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <line key={i} x1={20 + i * 55} y1="480" x2={20 + i * 55} y2="492" stroke={C.navyDeep} strokeWidth="2.5" />
        ))}
      </svg>
    </div>
  );
};

// ─── S14: 09:00 settlement completion target (f2737..2837) ───
export const S14Target: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 2737 || frame >= 2850) return null;
  const inP = interpolate(frame, [2745, 2760], [0, 1], clamp);
  const outP = interpolate(frame, [2837, 2850], [0, 1], clamp);
  // measured: hourAt(960) = 8.15 @f2800 → 8.4 @f2900
  const hourAt = 8.15 + (frame - 2800) * 0.0025;
  const x9 = 960 + (9 - hourAt) * 249;
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      <TimelineBand y={221} h={69} originX={960} originHour={hourAt} pxPerHour={249} tickAbove={4} tickBelow={28} labelSize={34} />
      <MarkerTriangle x={955} y={123} size={90} />
      {/* red line at 09:00 from band bottom down */}
      <Milestone x={x9} lineTop={290} lineBottom={880} opacity={inP} />
      <div style={{ position: "absolute", right: 1920 - x9 + 36, top: 570, textAlign: "right", fontFamily: pack.sans, color: C.navyInk, opacity: inP }}>
        <div style={{ fontSize: 100, fontWeight: 700, lineHeight: 1 }}>{pack.milestones.m0900.time}</div>
        <div style={{ fontSize: 36, lineHeight: 1.35, marginTop: 10 }}>
          {pack.milestones.m0900.label.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── S15: brackets + 8.0+ USD trillion (f2837..3040) ───
export const S15Brackets: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 2837 || frame >= 3055) return null;
  const outP = interpolate(frame, [3040, 3055], [0, 1], clamp);
  const hourAt = 8.4;
  const x7 = 960 + (7 - hourAt) * 248;
  const x9 = 960 + (9 - hourAt) * 248;
  const x12 = 960 + (12 - hourAt) * 248;
  const dropP = interpolate(frame, [2845, 2862], [0, 1], { ...clamp, easing: EASE });
  const b1P = interpolate(frame, [2858, 2888], [0, 1], { ...clamp, easing: EASE });
  const b2P = interpolate(frame, [2880, 2915], [0, 1], { ...clamp, easing: EASE });
  const figP = interpolate(frame, [2930, 2955], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      <TimelineBand y={221} h={69} originX={960} originHour={hourAt} pxPerHour={248} tickAbove={4} tickBelow={28} labelSize={34} />
      <MarkerTriangle x={955} y={123} size={90} />
      {/* red drop lines at 07:00 and 09:00 (band bottom → settlement bar top) */}
      <div style={{ position: "absolute", left: x7 - 2.5, top: 290, width: 5, height: (500 - 290) * dropP, background: C.marker }} />
      <div style={{ position: "absolute", left: x9 - 2.5, top: 290, width: 5, height: (500 - 290) * dropP, background: C.marker }} />
      <BracketBar x={x7} w={(x9 - x7) * b1P} y={500} h={148} label={pack.brackets.settlement} p={b1P} pack={pack} />
      <BracketBar x={x7} w={(x12 - x7) * b2P} y={692} h={152} label={pack.brackets.funding} p={b2P} pack={pack} />
      {/* 8.0+ USD trillion */}
      <div style={{ position: "absolute", left: 180, top: 545, opacity: figP }}>
        <div style={{ width: 250, height: 6, background: C.red }} />
        <div style={{ fontFamily: pack.serif, fontSize: 195, color: C.red, lineHeight: 1.02 }}>
          {pack.trillion.figure}
          <span style={{ fontSize: 95, verticalAlign: "super" }}>{pack.trillion.sup}</span>
        </div>
        <div style={{ fontFamily: pack.serif, fontSize: 62, color: "#7C8AA4", borderBottom: `5px solid ${C.navyInk}`, display: "inline-block", lineHeight: 1.3 }}>
          {pack.trillion.unit}
        </div>
      </div>
    </div>
  );
};

const BracketBar: React.FC<{ x: number; w: number; y: number; h?: number; label: string; p: number; pack: Pack }> = ({
  x,
  w,
  y,
  h = 148,
  label,
  p,
  pack,
}) => {
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: Math.max(w, 10),
        height: h,
        background: C.marker,
        borderRadius: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#FCFCFC",
        fontFamily: pack.sans,
        fontSize: 44,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <span style={{ marginRight: 24, fontSize: 50 }}>⟵</span>
      {label}
      <span style={{ marginLeft: 24, fontSize: 50 }}>⟶</span>
    </div>
  );
};

// ─── S16: pay-outs to members A..H (f3040..3200) ───
export const S16Payouts: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 3040 || frame >= 3215) return null;
  const inP = interpolate(frame, [3040, 3055], [0, 1], clamp);
  const outP = interpolate(frame, [3200, 3215], [0, 1], clamp);
  // measured fast pan: hourAt(960) 11.2 @f3100 → 12.1 @f3150
  const hourAt = 11.2 + (frame - 3100) * 0.018;
  const stacks = [2, 4, 3, 2, 5, 3, 2, 4];
  const colors = [C.chipRed, C.chipNavy, C.chipRed, C.chipGrey, C.chipCream, C.chipNavy, C.chipGrey, C.chipNavy];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: inP * (1 - outP) }}>
      <TimelineBand y={221} h={69} originX={960} originHour={hourAt} pxPerHour={249} tickAbove={4} tickBelow={28} labelSize={34} />
      <MarkerTriangle x={955} y={123} size={90} />
      {pack.members.map((m, i) => {
        const x = 608 + i * 123;
        const flyAt = 3110 + i * 9;
        const fly = interpolate(frame, [flyAt, flyAt + 40], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: x - 28,
                top: 828,
                width: 56,
                height: 56,
                borderRadius: 28,
                background: C.navyBg,
                color: "#FCFCFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: pack.serif,
                fontSize: 32,
              }}
            >
              {m}
            </div>
            {Array.from({ length: stacks[i] }, (_, k) => {
              const appear = interpolate(frame, [3050 + i * 6 + k * 4, 3058 + i * 6 + k * 4], [0, 1], clamp);
              const dx = fly * (1400 + i * 100);
              const op = appear * (1 - fly);
              if (op <= 0) return null;
              return (
                <Chip
                  key={k}
                  x={x - 40 + dx}
                  y={780 - k * 46}
                  w={80}
                  h={36}
                  color={k === stacks[i] - 1 ? colors[i] : k % 2 ? C.chipGrey : C.chipCream}
                  opacity={op}
                />
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── S17: summary diagram (f3200..3440) ───
export const S17Summary: React.FC<{ frame: number; pack: Pack; PillLogo?: React.FC<{ h: number }> }> = ({
  frame,
  pack,
  PillLogo,
}) => {
  if (frame < 3200 || frame >= 3455) return null;
  const inP = interpolate(frame, [3208, 3228], [0, 1], clamp);
  const outP = interpolate(frame, [3430, 3448], [0, 1], clamp);
  const rowsP = [0, 1, 2, 3].map((i) => interpolate(frame, [3250 + i * 14, 3262 + i * 14], [0, 1], clamp));
  // measured band: 02:00 tick at x62, pitch 144.4, y92 h40
  const hx = (h: number) => 62 + (h - 2) * 144.4;
  const ms = pack.milestones;
  const milestones = [
    { h: 6.5, m: ms.m0630, below: true },
    { h: 7, m: ms.m0700, below: false },
    { h: 9, m: ms.m0900, below: false },
    { h: 12, m: ms.m1200, below: false },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: inP * (1 - outP) }}>
      <TimelineBand y={92} originX={hx(7)} originHour={7} pxPerHour={144.4} labelSize={28} tickBelow={18} />
      <MarkerTriangle x={955} y={27} size={56} />
      {milestones.map(({ h, m, below }, i) => (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: hx(h) - 2.5, top: 88, width: 5, height: below ? 110 : 48, background: C.marker }} />
          <div
            style={{ position: "absolute", left: hx(h) + 8, top: below ? 200 : 140, fontFamily: pack.sans, color: C.navyInk, lineHeight: 1.25 }}
          >
            <div style={{ fontSize: 22, fontWeight: 700 }}>{m.time}</div>
            {m.label.map((l, k) => (
              <div key={k} style={{ fontSize: 17 }}>
                {l}
              </div>
            ))}
          </div>
        </React.Fragment>
      ))}
      {/* hexes + pill + shield (measured centers) */}
      <HexCity x={547} y={413} w={290} h={235} variant={0} />
      <HexCity x={1351} y={413} w={290} h={235} variant={1} />
      {/* trade executed arrow y393 */}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <line x1={710} y1={393} x2={1195} y2={393} stroke={C.skyBlue} strokeWidth={3.5} />
        <path d="M 725 393 l 18 -10 v 20 z" fill={C.skyBlue} transform="rotate(180 734 393)" />
        <path d="M 1180 393 l 18 -10 v 20 z" fill={C.skyBlue} />
        {/* connectors down into shield */}
        <path d="M 547 530 L 547 905 L 755 905" fill="none" stroke={C.navyDeep} strokeWidth={3} />
        <path d="M 755 905 l -18 -10 v 20 z" fill={C.navyDeep} transform="translate(18 0)" />
        <path d="M 1351 530 L 1351 905 L 1183 905" fill="none" stroke={C.navyDeep} strokeWidth={3} />
        <path d="M 1183 905 l 18 -10 v 20 z" fill={C.navyDeep} transform="translate(-18 0)" />
        {/* prior to value date dashed */}
        <line x1={430} y1={793} x2={1490} y2={793} stroke={C.skyBlue} strokeWidth={2.5} strokeDasharray="10 8" />
      </svg>
      <div style={{ position: "absolute", left: 860, top: 358, width: 200, textAlign: "center", fontFamily: pack.sans, fontSize: 24, color: C.skyBlue }}>
        {pack.tradeExecuted}
      </div>
      <div style={{ position: "absolute", left: 590, top: 762, fontFamily: pack.sans, fontSize: 22, color: C.skyBlue }}>
        {pack.priorToValueDate}
      </div>
      {/* shield */}
      <svg width={384} height={357} viewBox="0 0 384 357" style={{ position: "absolute", left: 777, top: 570 }}>
        <path
          d="M 28 8 Q 8 8 8 30 L 8 250 Q 8 266 23 275 L 180 350 Q 192 356 204 350 L 361 275 Q 376 266 376 250 L 376 30 Q 376 8 356 8 Z"
          fill="#FDFDFD"
          stroke={C.navyDeep}
          strokeWidth={3}
        />
      </svg>
      <ClsPillSlot x={793} y={476} w={335} h={109} p={1} PillLogo={PillLogo} />
      {pack.summaryRows.map((row, i) => {
        const y = [618, 692, 756, 822][i];
        return (
          <div key={i} style={{ opacity: rowsP[i] }}>
            <RowIcon kind={i} x={812} y={y} />
            <div style={{ position: "absolute", left: 872, top: y - 4, fontFamily: pack.sans, fontSize: 22, color: C.navyInk, lineHeight: 1.3 }}>
              {row.map((l, k) => (
                <div key={k}>{l}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RowIcon: React.FC<{ kind: number; x: number; y: number }> = ({ kind, x, y }) => (
  <svg width={44} height={44} viewBox="0 0 44 44" style={{ position: "absolute", left: x, top: y - 8 }}>
    {kind === 0 && (
      <>
        <path d="M 8 40 L 8 4 L 28 4 L 36 12 L 36 40 Z" fill="none" stroke={C.navyDeep} strokeWidth={2.5} />
        <circle cx="22" cy="24" r="7" fill="none" stroke={C.red} strokeWidth={2} />
      </>
    )}
    {(kind === 1 || kind === 3) && (
      <>
        {[0, 1, 2].map((r) => (
          <rect key={r} x={4} y={6 + r * 12} width={22} height={8} rx={4} fill="none" stroke={r ? C.navyDeep : C.red} strokeWidth={2.2} />
        ))}
        <path d={kind === 1 ? "M 30 10 L 42 10 M 37 5 L 42 10 L 37 15" : "M 42 10 L 30 10 M 35 5 L 30 10 L 35 15"} stroke={kind === 1 ? C.red : C.navyDeep} strokeWidth={2.2} fill="none" />
      </>
    )}
    {kind === 2 && <IconHandshakeMini />}
  </svg>
);

const IconHandshakeMini: React.FC = () => (
  <g>
    <path d="M 6 18 L 16 10 L 26 16 L 38 10" fill="none" stroke={C.navyDeep} strokeWidth={2.2} />
    {[0, 1, 2].map((i) => (
      <ellipse key={i} cx={14 + i * 7} cy={24 + i * 3} rx={5} ry={3.6} transform={`rotate(-30 ${14 + i * 7} ${24 + i * 3})`} fill="none" stroke={C.red} strokeWidth={2} />
    ))}
    <path d="M 26 30 Q 32 34 28 38 M 6 34 L 16 38" fill="none" stroke={C.navyDeep} strokeWidth={2.2} />
  </g>
);

// ─── S18: outro gauge + diagonal rise (f3440..3561) ───
export const S18Outro: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 3440 || frame >= 3561) return null;
  const floorY = interpolate(frame, [3440, 3480], [1080, 888], { ...clamp, easing: EASE });
  const gaugeP = interpolate(frame, [3460, 3480], [0, 1], clamp);
  const needle = interpolate(frame, [3470, 3520], [-160, -35], { ...clamp, easing: EASE });
  const wedgeP = interpolate(frame, [3500, 3560], [0, 1], { ...clamp, easing: EASE });
  const chipsP = interpolate(frame, [3510, 3530], [0, 1], clamp);
  const R = 150;
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white }}>
      {/* chip columns top right */}
      {chipsP > 0 && (
        <div style={{ opacity: chipsP }}>
          {[0, 1, 2, 3].map((col) =>
            [0, 1, 2, 3, 4].map((row) => {
              const colors = [C.chipNavy, C.chipGrey, C.chipCream, C.chipRed];
              const color = colors[(col + row) % 4];
              return (
                <Chip
                  key={`${col}${row}`}
                  x={1120 + col * 155}
                  y={840 - row * 62 - (col % 2) * 30 - wedgeP * 500}
                  w={96}
                  h={40}
                  color={color}
                />
              );
            }),
          )}
        </div>
      )}
      {/* navy floor + horizon band */}
      <div style={{ position: "absolute", left: 0, top: floorY, width: 1920, height: 1200, background: C.navyBg }} />
      <div style={{ position: "absolute", left: 0, top: floorY - 26, width: 1920, height: 26, background: C.bandGrey }} />
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: i * 142, top: floorY - 26, width: 2.5, height: 26, background: C.navyDeep }} />
      ))}
      {/* gauge */}
      {gaugeP > 0 && (
        <svg width={2 * R + 60} height={R + 40} viewBox={`0 0 ${2 * R + 60} ${R + 40}`} style={{ position: "absolute", left: 960 - R - 30, top: floorY - 26 - R - 8, opacity: gaugeP }}>
          <path d={`M 30 ${R + 8} A ${R} ${R} 0 0 1 ${2 * R + 30} ${R + 8}`} fill={C.white} stroke={C.bandGrey} strokeWidth={34} />
          <path
            d={`M ${R + 30 + R * Math.cos(Math.PI)} ${R + 8 + R * Math.sin(Math.PI)} A ${R} ${R} 0 0 1 ${R + 30 + R * Math.cos((needle * Math.PI) / 180)} ${R + 8 + R * Math.sin((needle * Math.PI) / 180)}`}
            fill="none"
            stroke={C.marker}
            strokeWidth={12}
          />
          <line
            x1={R + 30}
            y1={R + 8}
            x2={R + 30 + (R - 24) * Math.cos((needle * Math.PI) / 180)}
            y2={R + 8 + (R - 24) * Math.sin((needle * Math.PI) / 180)}
            stroke={C.marker}
            strokeWidth={7}
          />
          <circle cx={R + 30} cy={R + 8} r={12} fill={C.white} stroke={C.navyDeep} strokeWidth={5} />
        </svg>
      )}
      {/* diagonal navy wedge rise */}
      {wedgeP > 0 && (
        <div
          style={{
            position: "absolute",
            left: -400,
            top: 1080 - wedgeP * 1500,
            width: 3200,
            height: 2200,
            background: C.navyBg,
            transform: `rotate(${-9 * (1 - wedgeP * 0.4)}deg)`,
            transformOrigin: "left top",
          }}
        />
      )}
    </div>
  );
};

// ─── S19: end card (f3561..3750) ───
export const S19EndCard: React.FC<{ frame: number; pack: Pack; BrandLogo?: React.FC<{ markP: number; lettersP: number }> }> = ({
  frame,
  pack,
  BrandLogo,
}) => {
  if (frame < 3561) return null;
  return <LogoCard pack={pack} BrandLogo={BrandLogo} />;
};
