import React from "react";
import { AbsoluteFill } from "remotion";
import { C, GANTT, DETAIL, MAP, SEG, ENDCARD } from "./data";
import { useBrand, useCopy } from "./brand";
import { TracedArt } from "./TracedArt";
import { Badge, ClsNetBox, Doc, Elbow, Pill, SansText, SerifLabel, lerp } from "./ui";
import { TitleCard } from "./scenesA";
import { SmallHex } from "./scenesB";

const PILL_COL: Record<string, string> = {
  lavender: C.lavender,
  tan: C.tan,
  orangeDeep: C.orangeDeep,
};

// ═══ Scene 16: gantt cascade (f2212-2290) ═══
export const GanttScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < 2150 || f >= 2312) return null;
  const bgOp = lerp(f, [2152, 2166], [0, 1]);
  // rows cascade in staggered; collapse to detail at ~2290
  const detailP = lerp(f, [2240, 2266], [0, 1]);
  const out = lerp(f, [2292, 2306], [1, 0]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy, opacity: bgOp * out }}>
      {/* top bracket ruler */}
      <svg width={1920} height={60} style={{ position: "absolute", top: GANTT.rulerY - 30 }}>
        <path
          d={`M${GANTT.rulerX},40 V15 H${GANTT.rulerX + GANTT.rulerW} V40 ${Array.from({ length: 5 }, (_, i) => `M${GANTT.rulerX + ((i + 1) * GANTT.rulerW) / 6},15 V32`).join(" ")}`}
          fill="none"
          stroke={C.white}
          strokeWidth={2.5}
        />
      </svg>
      {/* rows */}
      {GANTT.rows.map((r, i) => {
        const at = 2166 + i * 7;
        const op = lerp(f, [at, at + 7], [0, 1]);
        if (op <= 0) return null;
        // in detail phase only row 0 (EM9E) and row 2 (PO1I) remain
        const keep = i === 0 || i === 2;
        const rowOp = op * (keep ? 1 : 1 - detailP);
        if (rowOp <= 0) return null;
        // detail phase: PO1I row drops to bottom
        const y = i === 2 ? r.y + detailP * (985 - r.y) : r.y;
        const x = i === 2 ? r.x + detailP * (605 - r.x) : r.x;
        return (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, opacity: rowOp }}>
            <Pill x={x} y={y} w={i === 2 && detailP > 0.5 ? 130 : r.w} h={44} color={PILL_COL[r.color]} />
            <SansText text={COPY.ganttIds[i]} x={x + (i === 2 && detailP > 0.5 ? 130 : r.w) + 24} y={y + 8} fs={GANTT.labelFs} color={C.white} />
          </div>
        );
      })}
      {/* footnote rules bottom-left (pre-detail only) */}
      <div style={{ position: "absolute", left: 210, top: 980, width: 900, height: 2, backgroundColor: C.white, opacity: (1 - detailP) * lerp(f, [2216, 2224], [0, 1]) }} />
      <div style={{ position: "absolute", left: 210, top: 1012, width: 500, height: 2, backgroundColor: C.white, opacity: (1 - detailP) * lerp(f, [2220, 2228], [0, 1]) }} />
      {/* detail card */}
      {detailP > 0 && <DetailCard opacity={lerp(f, [2248, 2268], [0, 1])} />}
    </AbsoluteFill>
  );
};

const DetailCard: React.FC<{ opacity: number }> = ({ opacity }) => {
  const COPY = useCopy();
  const { sans: SANS } = useBrand();
  if (opacity <= 0) return null;
  const { card } = DETAIL;
  const rowH = (card.h - 60) / COPY.detail.length;
  return (
    <div
      style={{
        position: "absolute",
        left: card.x,
        top: card.y,
        width: card.w,
        height: card.h,
        borderRadius: `4px 4px ${card.r + 14}px 4px`,
        backgroundColor: C.lavender,
        opacity,
      }}
    >
      {COPY.detail.map(([k, v], i) => (
        <React.Fragment key={k}>
          <div
            style={{
              position: "absolute",
              left: DETAIL.labelX - card.x,
              top: 40 + i * rowH,
              fontFamily: SANS,
              fontSize: DETAIL.rowFs,
              color: C.navy,
            }}
          >
            {k}
          </div>
          <div
            style={{
              position: "absolute",
              left: DETAIL.valueX - card.x,
              top: 40 + i * rowH,
              fontFamily: SANS,
              fontSize: DETAIL.rowFs,
              color: C.orangeDeep,
            }}
          >
            {v}
          </div>
          {i < COPY.detail.length - 1 && (
            <div
              style={{
                position: "absolute",
                left: 30,
                top: 40 + (i + 1) * rowH - 18,
                width: card.w - 60,
                height: 1.5,
                backgroundColor: C.navy,
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              left: DETAIL.valueX - card.x - 25,
              top: 40 + i * rowH - (i === 0 ? 40 : 18),
              width: 1.5,
              height: rowH + (i === 0 ? 22 : 0),
              backgroundColor: C.navy,
            }}
          />
        </React.Fragment>
      ))}
    </div>
  );
};

// ═══ Scene 17: report out of CLSNet (f2290-2372 → white) ═══
export const ReportOutScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < 2296 || f >= SEG.handshake[0] + 40) return null;
  const inOp = lerp(f, [2298, 2312], [0, 1]);
  const out = lerp(f, [2396, 2412], [1, 0]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: inOp }}>
      <div style={{ position: "absolute", inset: 0, opacity: out }}>
        {/* big report doc with gantt mini-panel */}
        <svg width={310} height={400} viewBox="0 0 310 400" style={{ position: "absolute", left: 160, top: 90 }}>
          <path d="M3,3 H240 L307,70 V370 Q307,397 280,397 H3 Z" fill={C.white} stroke={C.navy} strokeWidth={4} strokeLinejoin="round" />
          <rect x={38} y={22} width={90} height={8} fill={C.navy} />
          <rect x={30} y={165} width={250} height={140} rx={10} fill={C.navy} />
          <rect x={210} y={330} width={70} height={18} rx={9} fill={C.orangeDeep} />
        </svg>
        {/* mini gantt inside the doc */}
        {COPY.ganttIds.slice(0, 9).map((id, i) => (
          <div key={id} style={{ position: "absolute", left: 205 + i * 6, top: 268 + i * 13, width: 40, height: 7, borderRadius: 3, backgroundColor: [C.lavender, C.lavender, C.tan, C.orangeDeep][i % 4] }} />
        ))}
        <Elbow points={[[315, 60], [315, 0]]} opacity={1} />
        <Elbow points={[[475, 285], [590, 285]]} opacity={1} />
        {/* big CLSNet box */}
        <ClsNetBox x={1145} y={95} w={620} labelFs={56} />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 18: handshake (f2372-2480) ═══
export const HandshakeScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.handshake[0] || f >= SEG.payment[0] + 16) return null;
  const inOp = lerp(f, [2404, 2420], [0, 1]);
  const out = lerp(f, [2470, 2484], [1, 0]);
  const arrowP = lerp(f, [2424, 2440], [0, 1]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: inOp * out }}>
      <SmallHex art="cityA" cx={427} cy={372} w={385} artW={1150} letter="A" />
      <SmallHex art="cityB" cx={1512} cy={755} w={396} artW={1190} letter="B" />
      <Doc x={255} y={510} w={91} h={110} />
      <Doc x={1611} y={900} w={90} h={110} />
      {/* handshake pill (traced: navy pill + white/orange hands) */}
      <TracedArt name="handshake" x={715} y={490} />
      <Elbow points={[[1010, 460], [690, 460]]} arrow="end" drawP={arrowP} />
      <Elbow points={[[930, 830], [1245, 830]]} arrow="end" drawP={arrowP} />
    </AbsoluteFill>
  );
};

// ═══ Scene 19: payment complete (f2480-2612) ═══
export const PaymentScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < SEG.payment[0] || f >= SEG.strip2[0] + 14) return null;
  const inOp = lerp(f, [2482, 2496], [0, 1]);
  const out = lerp(f, [2600, 2614], [1, 0]);
  const arrOp = lerp(f, [2505, 2518], [0, 1]);
  const belowOp = lerp(f, [2520, 2538], [0, 1]);
  const orangeP = lerp(f, [2556, 2580], [0, 1]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: inOp * out }}>
      <div style={{ position: "absolute", left: 0, top: 505, width: 1920, height: 3, backgroundColor: C.navy }} />
      <div style={{ position: "absolute", left: 105, top: 505 - 295 * 0.62, opacity: 1 }}>
        <TracedArt name="cityA" scale={0.62} />
      </div>
      <div style={{ position: "absolute", left: 930, top: 505 - 545 * 0.68 }}>
        <TracedArt name="cityB" scale={0.68} />
      </div>
      <Badge letter="A" cx={98} cy={415} r={36} />
      <Badge letter="B" cx={1822} cy={415} r={36} />
      {/* Payment complete double arrow */}
      {arrOp > 0 && (
        <>
          <SansText text={COPY.paymentComplete} x={760} y={272} fs={34} color={C.serifNavy} opacity={arrOp} width={400} align="center" />
          <svg width={1920} height={1080} style={{ position: "absolute", opacity: arrOp }}>
            <path d="M700,330 H1195 M700,330 l16,-9 M700,330 l16,9 M1195,330 l-16,-9 M1195,330 l-16,9" stroke={C.serifNavy} strokeWidth={3} fill="none" />
          </svg>
        </>
      )}
      {/* below-line settlement plumbing */}
      {belowOp > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: belowOp }}>
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            <path d="M560,508 V635 H655 M1300,508 V635 H1245" stroke={C.navy} strokeWidth={2.5} fill="none" />
            <path d="M890,860 V960 M890,960 l-8,-14 M890,960 l8,-14 M1013,860 V960 M1013,960 l-8,-14 M1013,960 l8,-14" stroke={C.navy} strokeWidth={2.5} fill="none" />
          </svg>
          <SmallHex art="mHexBank2" cx={790} cy={745} w={230} artW={215} />
          <SmallHex art="mHexCity2" cx={1113} cy={745} w={230} artW={215} />
          <Doc x={640} y={690} w={72} h={90} />
          <Doc x={1195} y={690} w={72} h={90} />
          <ClsNetBox x={877} y={985} w={150} labelFs={20} />
        </div>
      )}
      {/* orange return paths */}
      {orangeP > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: orangeP }}>
          <Elbow points={[[875, 1060], [180, 1060], [180, 560]]} arrow="end" />
          <Elbow points={[[1030, 1060], [1740, 1060], [1740, 560]]} arrow="end" />
          <Doc x={112} y={478} w={64} h={80} />
          <Doc x={1745} y={478} w={64} h={80} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ═══ Scene 20: strip reprise with navy band + CLSNet rider (f2612-2822) ═══
export const Strip2Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.strip2[0] || f >= SEG.reportCard[0] + 14) return null;
  const inOp = lerp(f, [2612, 2626], [0, 1]);
  const out = lerp(f, [2808, 2822], [1, 0]);
  const bandY = 380;
  const bandH = 240;
  const hourX = (h: number) => 400 + h * 320 - (f - 2612) * 6.2;
  const ups = [
    { art: "rowBank", hour: 0.4, scale: 1.05 },
    { art: "stripTowerUp", hour: 2.6, scale: 1.0 },
    { art: "rowTowers", hour: 5.2, scale: 0.9 },
    { art: "rowBank", hour: 8.2, scale: 1.05 },
  ];
  const dns = [
    { art: "stripInvSail", hour: 0.9 },
    { art: "stripInvBrick", hour: 3.6 },
    { art: "stripInvCity", hour: 6.2 },
    { art: "stripInvSail", hour: 9.0 },
  ];
  const boxX = Math.max(720, Math.min(1160, hourX(1.9)));
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: inOp * out }}>
      {ups.map((u, i) => {
        const x = hourX(u.hour);
        if (x < -700 || x > 2100) return null;
        const artH = { rowBank: 145, stripTowerUp: 255, rowTowers: 265 }[u.art] ?? 200;
        return <TracedArt key={i} name={u.art} x={x} y={bandY - artH * u.scale + 3} scale={u.scale} />;
      })}
      {dns.map((d, i) => {
        const x = hourX(d.hour);
        if (x < -700 || x > 2100) return null;
        return (
          <TracedArt
            key={i}
            name={d.art}
            x={x}
            y={bandY + bandH - 2}
            recolor={{ "#FFFFFF": C.navy }}
          />
        );
      })}
      <div style={{ position: "absolute", left: 0, top: bandY, width: 1920, height: bandH, backgroundColor: C.navy }} />
      {/* CLSNet box riding the band, orange border, no label */}
      <ClsNetBox x={boxX} y={bandY + 30} w={180} label={false} border="orange" markP={lerp(f, [2650, 2680], [0, 1])} />
      {/* drifting pills in the band */}
      <Pill x={hourX(0.2)} y={bandY + 150} w={90} h={34} color={C.orangeDeep} />
      <Pill x={hourX(3.4)} y={bandY + 60} w={80} h={30} color={C.lavender} />
    </AbsoluteFill>
  );
};

// ═══ Scene 21: netting report card (f2822-2990) ═══
export const ReportCardScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.reportCard[0] - 12 || f >= SEG.buildPop[0] + 12) return null;
  const bgOp = lerp(f, [2810, 2824], [0, 1]);
  const cardP = lerp(f, [2830, 2856], [0, 1]);
  const rowsP = lerp(f, [2862, 2886], [0, 1]);
  // segments merge (netting) f2900-2950
  const mergeP = lerp(f, [2900, 2950], [0, 1]);
  const out = lerp(f, [2978, 2992], [1, 0]);
  const card = { x: 530, y: 190, w: 840, h: 700 };
  const rows = [
    { y: 390, color: C.lavender, segs: [90, 55, 120, 80, 60, 95] },
    { y: 480, color: C.orangeDeep, segs: [130, 70, 60, 100, 90, 70] },
    { y: 560, color: C.tan, segs: [75, 110, 140, 60, 85, 55] },
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy, opacity: bgOp * out }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <path
          d={`M${card.x + 40},${card.y} H${card.x + card.w - 40} Q${card.x + card.w},${card.y} ${card.x + card.w},${card.y + 40} V${card.y + card.h - 40} Q${card.x + card.w},${card.y + card.h} ${card.x + card.w - 40},${card.y + card.h} H${card.x + 40} Q${card.x},${card.y + card.h} ${card.x},${card.y + card.h - 40} V${card.y + 40} Q${card.x},${card.y} ${card.x + 40},${card.y}`}
          fill="none"
          stroke={C.white}
          strokeWidth={2.5}
          strokeDasharray={3100}
          strokeDashoffset={3100 * (1 - cardP)}
        />
      </svg>
      <div style={{ position: "absolute", left: card.x + 70, top: card.y + 75, width: (card.w - 140) * rowsP, height: 2.5, backgroundColor: C.white }} />
      {rows.map((r, ri) => {
        const total = r.segs.reduce((a, b) => a + b, 0) + (r.segs.length - 1) * 10;
        // merged state: 3 wide segments
        const merged = [total * 0.45, total * 0.3, total * 0.19];
        const segs = mergeP < 0.5 ? r.segs : merged;
        const gap = mergeP < 0.5 ? 10 : 14;
        let xa = card.x + 70;
        return (
          <React.Fragment key={ri}>
            {segs.map((wseg, i) => {
              const el = (
                <Pill
                  key={`${ri}-${i}-${segs.length}`}
                  x={xa}
                  y={r.y}
                  w={wseg}
                  h={40}
                  color={r.color}
                  opacity={rowsP * lerp(f, [2862 + ri * 8 + i * 4, 2870 + ri * 8 + i * 4], [0, 1])}
                />
              );
              xa += wseg + gap;
              return el;
            })}
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: card.x + 70, top: card.y + 620, width: 130 * rowsP, height: 2.5, backgroundColor: C.white }} />
      <div style={{ position: "absolute", left: card.x + 280, top: card.y + 620, width: 60 * rowsP, height: 2.5, backgroundColor: C.white }} />
    </AbsoluteFill>
  );
};

// ═══ Scene 22: building pop on split (f2990-3104) ═══
export const BuildPopScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.buildPop[0] || f >= SEG.mapBadges[0]) return null;
  const inOp = lerp(f, [2990, 3002], [0, 1]);
  const growP = lerp(f, [3006, 3040], [0, 1]);
  const pillP = lerp(f, [3020, 3040], [0, 1]);
  const orangeOp = lerp(f, [3052, 3064], [0, 1]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: inOp }}>
      <div style={{ position: "absolute", left: 0, top: 505, width: 1920, height: 575, backgroundColor: C.navy }} />
      {/* cluster pops up from behind the navy edge */}
      <div style={{ position: "absolute", left: 640, top: 505 - 255 * growP, width: 640, height: 255 * growP, overflow: "hidden" }}>
        <TracedArt name="stripTowerUp" x={160} y={0} scale={1} />
      </div>
      {/* white outline pill bottom-left */}
      <svg width={260} height={80} viewBox="0 0 260 80" style={{ position: "absolute", left: 285, top: 585, opacity: pillP }}>
        <path d={`M40,4 H220 Q256,4 256,40 Q256,76 220,76 H40 Q4,76 4,40 Q4,4 40,4`} fill="none" stroke={C.white} strokeWidth={3} strokeDasharray={620} strokeDashoffset={620 * (1 - pillP)} />
      </svg>
      {/* orange filled pill */}
      <Pill x={1330} y={620} w={170} h={56} color={C.orangeDeep} opacity={orangeOp} />
    </AbsoluteFill>
  );
};

// ═══ Scene 23: map with FX Global Code badges (f3104-3364) ═══
export const MapBadgesScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { sans: SANS, serif: SERIF } = useBrand();
  const f = frame;
  if (f < SEG.mapBadges[0] || f >= SEG.circle[0] + 20) return null;
  const mapP = lerp(f, [3104, 3130], [0, 1]);
  // implode: scale to dot f3290-3348
  const implodeP = lerp(f, [3290, 3348], [0, 1]);
  const scale = 1 - implodeP * 0.985;
  const bgNavy = lerp(f, [3326, 3352], [0, 1]);
  // circle grows back f3364-3396
  const circleR = lerp(f, [3352, 3396], [16, 435]);
  const showCircle = f >= 3352;
  const circleCx = lerp(f, [3352, 3396], [960, 890]);
  const circleCy = lerp(f, [3352, 3396], [640, 495]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.blue }}>
      {bgNavy > 0 && <div style={{ position: "absolute", inset: 0, backgroundColor: C.navy, opacity: bgNavy }} />}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: "960px 620px",
          opacity: 1 - implodeP * 0.6,
        }}
      >
        <TracedArt name="worldMap" x={MAP.x} y={MAP.y} opacity={mapP} />
        {MAP.hexes.map((hx, i) => {
          const pop = 3116 + i * 7;
          const s = lerp(f, [pop, pop + 10], [0, 1]);
          if (s <= 0) return null;
          return (
            <div key={hx.art} style={{ position: "absolute", left: hx.cx - (MAP.hexW * s) / 2, top: hx.cy - (MAP.hexW * 0.906 * s) / 2 }}>
              <TracedArt name={hx.art} scale={s} />
            </div>
          );
        })}
        {/* badges */}
        {MAP.hexes.map((hx, i) => {
          const at = 3160 + i * 9;
          const op = lerp(f, [at, at + 8], [0, 1]);
          if (op <= 0) return null;
          const fifty = i % 2 === 0;
          return (
            <div
              key={`b${i}`}
              style={{
                position: "absolute",
                left: hx.cx + 40,
                top: hx.cy + 10,
                width: 92,
                height: 94,
                backgroundColor: fifty ? C.card50 : C.card35,
                opacity: op,
                padding: "8px 8px",
              }}
            >
              <div style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.1, color: C.white }}>FX Global{"\n"}Code</div>
              <div style={{ fontFamily: SANS, fontSize: 10, color: C.cardText, marginTop: 2 }}>Principle</div>
              <div style={{ fontFamily: SERIF, fontSize: 38, lineHeight: 0.9, color: "rgba(235,237,244,0.8)", textAlign: "right" }}>{fifty ? "50" : "35"}</div>
            </div>
          );
        })}
      </div>
      {showCircle && (
        <div
          style={{
            position: "absolute",
            left: circleCx - circleR,
            top: circleCy - circleR,
            width: circleR * 2,
            height: circleR * 2,
            borderRadius: circleR,
            backgroundColor: C.blue,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ═══ Scene 24: circle handshake / PvP (f3364-3480) ═══
export const CircleScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < 3396 || f >= SEG.mosaic[0] + 14) return null;
  const drift = lerp(f, [3396, 3480], [0, 55]);
  const artOp = lerp(f, [3400, 3414], [0, 1]);
  const out = lerp(f, [3468, 3484], [1, 0]);
  const cx = 890 + drift;
  const cy = 495;
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy, opacity: 1 }}>
      <div style={{ position: "absolute", left: cx - 435, top: cy - 435, width: 870, height: 870, borderRadius: 435, backgroundColor: C.blue, opacity: out }} />
      <div style={{ position: "absolute", inset: 0, opacity: artOp * out }}>
        {/* white dot + arrows + orange square + handshake pill */}
        <div style={{ position: "absolute", left: cx - 190 - 22, top: cy - 165 - 22, width: 44, height: 44, borderRadius: 22, backgroundColor: C.white }} />
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          <path d={`M${cx + 55},${cy - 165} H${cx - 145} M${cx - 145},${cy - 165} l14,-8 M${cx - 145},${cy - 165} l14,8`} stroke={C.white} strokeWidth={3} fill="none" />
          <path d={`M${cx - 45},${cy + 160} H${cx + 155} M${cx + 155},${cy + 160} l-14,-8 M${cx + 155},${cy + 160} l-14,8`} stroke={C.white} strokeWidth={3} fill="none" />
        </svg>
        <div style={{ position: "absolute", left: cx + 170, top: cy + 138, width: 46, height: 46, backgroundColor: C.orangeDeep }} />
        <TracedArt name="handshake" x={cx - 155} y={cy - 105} scale={0.63} />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 25: currency mosaic (f3480-3688) ═══
const MOSAIC_ROWS = [
  { y: 150, label: "CNH", labelColor: C.white, labelX: 1660 },
  { y: 330, label: "RUB", labelColor: C.orangeDeep, labelX: 1450 },
  { y: 510, label: "THB", labelColor: C.orangeDeep, labelX: 120 },
  { y: 690, label: "PLN", labelColor: C.white, labelX: 320 },
  { y: 870, label: "AED", labelColor: C.orangeDeep, labelX: 60 },
];
const MOSAIC_PILLS = [C.steel, C.tan, C.orangeDeep, C.lavender, C.pillNavy, C.tan, C.steelDark, C.orangeDeep];

export const MosaicScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.mosaic[0] || f >= SEG.shield[0] + 10) return null;
  // diagonal wipe out f3600-3650
  const wipeP = lerp(f, [3600, 3652], [0, 1]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy }}>
      {MOSAIC_ROWS.map((r, ri) => {
        const rowOp = lerp(f, [3488 + ri * 10, 3502 + ri * 10], [0, 1]);
        if (rowOp <= 0) return null;
        return (
          <div key={ri} style={{ position: "absolute", inset: 0, opacity: rowOp }}>
            <div style={{ position: "absolute", left: 0, top: r.y + 116, width: 1920, height: 1.5, backgroundColor: "rgba(253,253,253,0.7)" }} />
            {Array.from({ length: 12 }, (_, i) => {
              const seed = (ri * 7 + i * 13) % 11;
              const w = 55 + (seed % 4) * 25;
              const x = ((i * 190 + seed * 31 - (f - 3480) * 3.1 * (ri % 2 ? 1 : -1)) % 2100 + 2100) % 2100 - 90;
              const on = (seed + i) % 3 !== 0;
              if (!on) return null;
              return <Pill key={i} x={x} y={r.y + 40 + (seed % 3) * 22} w={w} h={26} color={MOSAIC_PILLS[(seed + i) % MOSAIC_PILLS.length]} />;
            })}
            <SerifLabel text={r.label} x={r.labelX} capTop={r.y + 20} fs={62} color={r.labelColor} />
          </div>
        );
      })}
      {wipeP > 0 && (
        <div
          style={{
            position: "absolute",
            left: -200,
            top: -3000 + wipeP * 3400,
            width: 2400,
            height: 3000,
            backgroundColor: C.navy,
            transform: "rotate(-14deg)",
            transformOrigin: "center bottom",
            borderBottom: `3px solid ${C.band}`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ═══ Scene 26: shield (f3688-3762) ═══
export const ShieldScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.shield[0] || f >= SEG.ledge[0] + 10) return null;
  const whiteP = lerp(f, [3690, 3712], [0, 1]);
  const shieldP = lerp(f, [3706, 3726], [0, 1]);
  const out = lerp(f, [3752, 3764], [1, 0]);
  const split = 930;
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy, opacity: 1 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: split * whiteP, height: 1080, backgroundColor: C.white }} />
      {/* zipper band */}
      <div style={{ position: "absolute", left: split * whiteP, top: 0, width: 36, height: 1080, backgroundColor: C.band, opacity: whiteP }} />
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: split * whiteP, top: i * 95 + 40, width: 36, height: 2, backgroundColor: C.navy, opacity: whiteP * 0.8 }} />
      ))}
      {shieldP > 0 && (
        <div style={{ position: "absolute", left: 700, top: 225, width: 512, height: 640, opacity: out, transform: `scale(${shieldP})`, transformOrigin: "center" }}>
          <ShieldSVG />
        </div>
      )}
    </AbsoluteFill>
  );
};

const ShieldSVG: React.FC = () => (
  <svg width={512} height={640} viewBox="0 0 512 640">
    {/* left half: orange outline + fill on white */}
    <g>
      <path d="M256,20 C200,45 130,55 60,55 L60,330 C60,470 150,560 256,615 Z" fill="none" stroke={C.orange} strokeWidth={7} />
      <path d="M256,75 C210,92 160,100 105,102 L105,330 C105,440 175,515 256,560 Z" fill={C.orangeDeep} />
    </g>
    {/* right half: white outline + fill on navy */}
    <g>
      <path d="M256,20 C312,45 382,55 452,55 L452,330 C452,470 362,560 256,615 Z" fill="none" stroke={C.white} strokeWidth={7} />
      <path d="M256,75 C302,92 352,100 407,102 L407,330 C407,440 337,515 256,560 Z" fill={C.white} />
    </g>
    <path d="M440,395 h24 M452,383 v24" stroke={C.white} strokeWidth={3} />
  </svg>
);

// ═══ Scene 27: ledge + stacks + cities (f3762-3926) ═══
export const LedgeScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.ledge[0] || f >= SEG.outro[0] + 12) return null;
  // ledge rotates from diagonal to flat f3762-3812
  const tilt = lerp(f, [3766, 3812], [5.5, 0]);
  const citiesOp = lerp(f, [3822, 3838], [0, 1]);
  const out = lerp(f, [3914, 3928], [1, 0]);
  const ledgeY = 505;
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: out }}>
      <div
        style={{
          position: "absolute",
          left: -200,
          top: ledgeY,
          width: 2400,
          height: 1400,
          backgroundColor: C.navy,
          transform: `rotate(${-tilt}deg)`,
          transformOrigin: "50% 0%",
          borderTop: `14px solid ${C.band}`,
        }}
      >
        {Array.from({ length: 26 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: i * 95, top: 0, width: 2, height: 16, backgroundColor: C.navy }} />
        ))}
      </div>
      {/* stack groups (counter-rotated with the ledge) */}
      <div style={{ position: "absolute", inset: 0, transform: `rotate(${-tilt}deg)`, transformOrigin: `760px ${ledgeY}px` }}>
        <StackGroup x={130} baseY={ledgeY} cols={[[C.steel, C.steel, C.steelDark, C.pillNavy, C.pillNavy], [C.steel, C.steelDark, C.steel]]} f={f} at={3770} />
        <StackGroup x={880} baseY={ledgeY} cols={[[C.tan, C.tan, C.tan], [C.tan, C.orangeDeep, C.tan, C.tan, C.orangeDeep]]} f={f} at={3782} />
        {citiesOp > 0 && (
          <>
            <div style={{ position: "absolute", left: 330, top: ledgeY - 295 * 0.55, opacity: citiesOp }}>
              <TracedArt name="cityA" scale={0.55} />
            </div>
            <div style={{ position: "absolute", left: 1180, top: ledgeY - 545 * 0.55, opacity: citiesOp }}>
              <TracedArt name="cityB" scale={0.55} />
            </div>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

const StackGroup: React.FC<{
  x: number;
  baseY: number;
  cols: string[][];
  f: number;
  at: number;
}> = ({ x, baseY, cols, f, at }) => (
  <>
    {cols.map((col, ci) => (
      <React.Fragment key={ci}>
        {col.map((c, i) => {
          const op = lerp(f, [at + ci * 8 + i * 5, at + ci * 8 + i * 5 + 6], [0, 1]);
          if (op <= 0) return null;
          return <Pill key={i} x={x + ci * 78} y={baseY - 40 - i * 44} w={68} h={36} color={c} opacity={op} />;
        })}
      </React.Fragment>
    ))}
  </>
);

// ═══ Scene 28: outro logo draw (f3926-4002) ═══
export const OutroScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const { serif: SERIF, logoArt } = useBrand();
  const f = frame;
  if (f < SEG.outro[0] || f >= SEG.endcard[0] + 20) return null;
  const logoP = lerp(f, [3932, 3960], [0, 1]);
  const wordP = lerp(f, [3950, 3978], [0, 1]);
  const toEnd = lerp(f, [3992, 4010], [0, 1]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy, opacity: 1 - toEnd }}>
      {logoArt && <TracedArt name={logoArt} x={947} y={105} opacity={logoP} />}
      <div
        style={{
          position: "absolute",
          left: 1075,
          top: 700,
          fontFamily: SERIF,
          fontSize: 150,
          lineHeight: 1,
          color: C.white,
          clipPath: `inset(0 0 0 ${(1 - wordP) * 100}%)`,
        }}
      >
        {COPY.brand}
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 29: end card (f4002-4168) ═══
export const EndCardScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const { sans: SANS } = useBrand();
  const f = frame;
  if (f < SEG.endcard[0] - 12) return null;
  const inOp = lerp(f, [3992, 4010], [0, 1]);
  const extrasOp = lerp(f, [4055, 4075], [0, 1]);
  return (
    <AbsoluteFill style={{ opacity: inOp }}>
      <TitleCard frame={f} endcard />
      <SansText
        text={COPY.disclaimer}
        x={ENDCARD.disclaimer.x}
        y={ENDCARD.disclaimer.y}
        fs={ENDCARD.disclaimer.fs}
        color="rgba(200,206,220,0.75)"
        opacity={extrasOp}
      />
      <div
        style={{
          position: "absolute",
          left: ENDCARD.urlBox.x,
          top: ENDCARD.urlBox.y,
          width: ENDCARD.urlBox.w,
          height: ENDCARD.urlBox.h,
          backgroundColor: C.white,
          opacity: extrasOp,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: SANS,
          fontSize: ENDCARD.urlFs,
          color: C.navy,
        }}
      >
        {COPY.url}
      </div>
    </AbsoluteFill>
  );
};
