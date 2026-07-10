import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { C, CIRCLE, GANTT, DETAIL, LEDGE, MAP, MOS, REPORT, SEG, STRIP2, ENDCARD } from "./data";
import { clamp } from "./ui";
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

// ═══ Scene 16: gantt cascade (f2127-2324) ═══
// Measured: page rides up from below 2129-2143 (bracket at screen y≈892 at
// f2133), rows cascade 2145+i*3.2, detail card 2240-2266, dissolves BACK into
// the gantt 2279-2291, full gantt holds to 2303, then the whole panel shrinks
// into a document (fr_2312 mid, settled fr_2330) while the CLSNet box slides in.
export const GanttScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < 2129 || f >= 2324) return null;
  // ride-in from below (p ≈ t^1.4 fits the f2133 measurement)
  const rideT = lerp(f, [2129, 2143], [0, 1]);
  const pageY = 1080 * (1 - Math.pow(rideT, 1.4));
  const bracketP = lerp(f, [2131, 2142], [0, 1]);
  // detail phase in (r5 lavender-mass track: card grows 2188-2200 — kf t88),
  // then reversed (ref restores the full gantt by 2291)
  const detailP = lerp(f, [2188, 2202], [0, 1]) * lerp(f, [2279, 2291], [1, 0]);
  // shrink-into-doc: full screen → mini panel inside the left doc (quadOut)
  const st = lerp(f, [2303, 2324], [0, 1]);
  const sp = 1 - (1 - st) * (1 - st);
  const R = {
    x: REPORT.panel.x * sp,
    y: REPORT.panel.y * sp + pageY,
    w: 1920 + (REPORT.panel.w - 1920) * sp,
    h: 1080 + (REPORT.panel.h - 1080) * sp,
  };
  // doc outline keyframed through fr_2306 (offscreen-big) / fr_2312 / fr_2330
  const docR = {
    x: interpolate(f, [2306, 2312, 2324], [-150, 95, REPORT.docL.x], clamp),
    y: interpolate(f, [2306, 2312, 2324], [-700, -30, REPORT.docL.y], clamp),
    w: interpolate(f, [2306, 2312, 2324], [2600, 1040, REPORT.docL.w], clamp),
    h: interpolate(f, [2306, 2312, 2324], [2900, 1070, REPORT.docL.h], clamp),
  };
  const docOp = lerp(f, [2306, 2312], [0, 1]);
  const boxX = interpolate(f, [2313, 2323], [1920, REPORT.box.x], { ...clamp, easing: (t) => 1 - (1 - t) * (1 - t) });
  return (
    <AbsoluteFill>
      {/* white ground appears behind the shrinking panel */}
      {st > 0 && <div style={{ position: "absolute", inset: 0, backgroundColor: C.white }} />}
      {/* navy page (shrinks to the doc's mini panel) */}
      <div
        style={{
          position: "absolute",
          left: R.x,
          top: R.y,
          width: R.w,
          height: R.h,
          backgroundColor: C.navy,
          borderRadius: 14 * sp,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${R.w / 1920}, ${R.h / 1080})`, transformOrigin: "0 0" }}>
      {/* top bracket ruler */}
      <svg width={1920} height={60} style={{ position: "absolute", top: GANTT.rulerY - 30 }}>
        <path
          d={`M${GANTT.rulerX},40 V15 H${GANTT.rulerX + GANTT.rulerW} V40 ${Array.from({ length: 5 }, (_, i) => `M${GANTT.rulerX + ((i + 1) * GANTT.rulerW) / 6},15 V32`).join(" ")}`}
          fill="none"
          stroke={C.white}
          strokeWidth={2.5}
          strokeDasharray={4700}
          strokeDashoffset={4700 * (1 - bracketP)}
        />
      </svg>
      {/* rows */}
      {GANTT.rows.map((r, i) => {
        const at = 2145 + i * 3.2;
        const op = lerp(f, [at, at + 5], [0, 1]);
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
            <Pill x={x} y={y} w={i === 2 && detailP > 0.5 ? 130 : r.w} h={GANTT.pillH} color={PILL_COL[r.color]} />
            <SansText text={COPY.ganttIds[i]} x={x + (i === 2 && detailP > 0.5 ? 130 : r.w) + 24} y={y + 11} fs={GANTT.labelFs} color={C.white} />
          </div>
        );
      })}
      {/* footnote rules bottom-left (pre-detail only; fr_2172: y971/1010) */}
      <div style={{ position: "absolute", left: 193, top: 971, width: 530, height: 2, backgroundColor: C.white, opacity: (1 - detailP) * lerp(f, [2166, 2172], [0, 1]) }} />
      <div style={{ position: "absolute", left: 192, top: 1010, width: 395, height: 2, backgroundColor: C.white, opacity: (1 - detailP) * lerp(f, [2170, 2176], [0, 1]) }} />
      {/* detail card (text fades first on the way out) */}
      {detailP > 0 && (
        <DetailCard
          opacity={lerp(f, [2192, 2208], [0, 1]) * lerp(f, [2281, 2290], [1, 0])}
          textOpacity={lerp(f, [2279, 2286], [1, 0])}
        />
      )}
        </div>
      </div>
      {/* document outline drawing around the shrinking panel */}
      {docOp > 0 && (
        <svg
          width={docR.w}
          height={docR.h}
          viewBox="0 0 270 345"
          preserveAspectRatio="none"
          style={{ position: "absolute", left: docR.x, top: docR.y, opacity: docOp }}
        >
          <path
            d="M4,4 H206 L266,64 V341 H44 Q4,341 4,301 Z"
            fill="none"
            stroke={C.navy}
            strokeWidth={4}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path d="M206,4 V64 H266" fill="none" stroke={C.navy} strokeWidth={4} vectorEffect="non-scaling-stroke" />
          <rect x={24} y={22} width={62} height={6} fill={C.navy} />
          <rect x={24} y={36} width={40} height={5} fill={C.navy} />
          <rect x={177} y={293} width={67} height={22} rx={8} fill={C.orangeDeep} opacity={lerp(f, [2310, 2316], [0, 1])} />
        </svg>
      )}
      {/* CLSNet box slides in from the right */}
      {f >= 2313 && <ClsNetBox x={boxX} y={REPORT.box.y} w={REPORT.box.w} labelFs={48} />}
    </AbsoluteFill>
  );
};

const DetailCard: React.FC<{ opacity: number; textOpacity?: number }> = ({ opacity, textOpacity = 1 }) => {
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
              opacity: textOpacity,
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
              opacity: textOpacity,
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

// ═══ Scene 17: report out of CLSNet (f2324-2412) ═══
// Measured fr_2330 (settled) / fr_2360 (after +125px drift, mesh icons on docs):
// left doc + CLSNet box + right doc, orange verticals from the top edge,
// orange horizontal stubs at y547 between the elements.
const ReportDoc: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  pillColor: string;
  meshP: number;
}> = ({ x, y, w, h, pillColor, meshP }) => {
  // deterministic scatter dots (processing) that give way to the mesh icon
  const dots = [
    [128, 78], [172, 96], [96, 108], [150, 126], [200, 118], [118, 142], [176, 150], [142, 88],
  ] as const;
  const mesh = [
    [135, 55], [175, 62], [200, 90], [198, 125], [170, 152], [130, 155], [102, 128], [104, 88], [150, 105],
  ] as const;
  return (
    <svg width={w} height={h} viewBox="0 0 270 345" style={{ position: "absolute", left: x, top: y }}>
      <path d="M4,4 H206 L266,64 V341 H44 Q4,341 4,301 Z" fill={C.white} stroke={C.navy} strokeWidth={4} strokeLinejoin="round" />
      <path d="M206,4 V64 H266" fill="none" stroke={C.navy} strokeWidth={4} />
      <rect x={24} y={22} width={62} height={6} fill={C.navy} />
      <rect x={24} y={36} width={40} height={5} fill={C.navy} />
      {/* scatter dots → geodesic mesh */}
      {meshP < 1 && dots.map(([dx, dy], i) => (
        <circle key={`d${i}`} cx={dx} cy={dy} r={2.5} fill={C.navy} opacity={1 - meshP} />
      ))}
      {meshP > 0 && (
        <g opacity={meshP}>
          {mesh.map(([mx, my], i) => (
            <React.Fragment key={`m${i}`}>
              {mesh.slice(i + 1).map(([nx, ny], j) => {
                const dist = Math.hypot(nx - mx, ny - my);
                if (dist > 78) return null;
                return <line key={j} x1={mx} y1={my} x2={nx} y2={ny} stroke={C.navy} strokeWidth={1.2} />;
              })}
            </React.Fragment>
          ))}
        </g>
      )}
      {/* mini gantt panel */}
      <rect x={40} y={155} width={205} height={120} rx={10} fill={C.navy} />
      <path d={`M58,172 H228 M58,172 V178 M92,172 V178 M126,172 V178 M160,172 V178 M194,172 V178 M228,172 V178`} stroke={C.white} strokeWidth={1.5} fill="none" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect
          key={i}
          x={56 + i * 16}
          y={186 + i * 12}
          width={34}
          height={8}
          rx={3}
          fill={[C.lavender, C.lavender, C.tan, C.orangeDeep][i % 4]}
        />
      ))}
      <rect x={177} y={293} width={67} height={22} rx={8} fill={pillColor} />
    </svg>
  );
};

export const ReportOutScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < 2324 || f >= SEG.handshake[0] + 40) return null;
  const out = lerp(f, [2396, 2412], [1, 0]);
  // whole group drifts +125px (fr_2330 → fr_2360)
  const dy = lerp(f, [2332, 2358], [0, REPORT.driftY]);
  const meshP = lerp(f, [2342, 2352], [0, 1]);
  const rightOp = lerp(f, [2324, 2330], [0, 1]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white }}>
      <div style={{ position: "absolute", inset: 0, opacity: out }}>
        {/* orange verticals pinned to the top edge */}
        <Elbow points={[[REPORT.vertLx, 0], [REPORT.vertLx, REPORT.docL.y + dy]]} />
        <Elbow points={[[REPORT.vertRx, 0], [REPORT.vertRx, REPORT.docR.y + dy]]} opacity={rightOp} />
        {/* horizontal stubs */}
        <Elbow points={[[570, REPORT.horizY + dy], [712, REPORT.horizY + dy]]} />
        <Elbow points={[[1195, REPORT.horizY + dy], [1385, REPORT.horizY + dy]]} opacity={rightOp} />
        <ReportDoc x={REPORT.docL.x} y={REPORT.docL.y + dy} w={REPORT.docL.w} h={REPORT.docL.h} pillColor={C.orangeDeep} meshP={meshP} />
        <div style={{ position: "absolute", inset: 0, opacity: rightOp }}>
          <ReportDoc x={REPORT.docR.x} y={REPORT.docR.y + dy} w={REPORT.docR.w} h={REPORT.docR.h} pillColor={C.pillNavy} meshP={meshP} />
        </div>
        <ClsNetBox x={REPORT.box.x} y={REPORT.box.y + dy} w={REPORT.box.w} labelFs={48} />
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
  if (f < SEG.payment[0] || f >= 2652) return null;
  const inOp = lerp(f, [2482, 2496], [0, 1]);
  // ref holds the payment layout well past 2612 (fr_2630 still shows the
  // below-line plumbing), everything cleared by 2650 (fr_2650 = bare line)
  const out = lerp(f, [2636, 2650], [1, 0]);
  const arrOp = lerp(f, [2505, 2518], [0, 1]);
  const belowOp = lerp(f, [2520, 2538], [0, 1]);
  // r5: ref shows the orange return plumbing SOLID by 2560 (was fading in
  // 2556-2580); the orange up-arrows into the cities are gone by ~2610
  const orangeP = lerp(f, [2532, 2546], [0, 1]);
  const upArrowOp = orangeP * lerp(f, [2596, 2612], [1, 0]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: inOp * out }}>
      <div style={{ position: "absolute", left: 0, top: 368, width: 1920, height: 3, backgroundColor: C.navy }} />
      <div style={{ position: "absolute", left: 215, top: 368 - 295 * 0.47, opacity: 1 }}>
        <TracedArt name="cityA" scale={0.47} />
      </div>
      {/* r5: the ref payment cityB is a WIDER arrangement than the intro art
          (w873×h277 vs uniform-scale 630) — traced at native scale from
          ref_2610 (badge painted out) */}
      <TracedArt name="cityBPay" x={1000} y={80} />
      <Badge letter="A" cx={188} cy={265} r={40} />
      <Badge letter="B" cx={1728} cy={265} r={40} />
      {/* Payment complete double arrow */}
      {arrOp > 0 && (
        <>
          <SansText text={COPY.paymentComplete} x={760} y={148} fs={36} color={C.serifNavy} opacity={arrOp} width={400} align="center" />
          <svg width={1920} height={1080} style={{ position: "absolute", opacity: arrOp }}>
            <path d="M735,197 H1180 M735,197 l16,-9 M735,197 l16,9 M1180,197 l-16,-9 M1180,197 l-16,9" stroke={C.serifNavy} strokeWidth={3} fill="none" />
          </svg>
        </>
      )}
      {/* below-line settlement plumbing */}
      {belowOp > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: belowOp }}>
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            <path d="M510,372 V520 H590 M1413,372 V520 H1360" stroke={C.navy} strokeWidth={2.5} fill="none" />
            <path d="M895,660 V800 M895,800 l-9,-15 M895,800 l9,-15 M1035,660 V800 M1035,800 l-9,-15 M1035,800 l9,-15" stroke={C.navy} strokeWidth={2.5} fill="none" />
          </svg>
          <SmallHex art="mHexCity2" cx={785} cy={590} w={240} artW={215} />
          <SmallHex art="mHexHeli" cx={1148} cy={592} w={240} artW={215} />
          <Doc x={565} y={548} w={72} h={90} />
          <Doc x={1292} y={548} w={72} h={90} />
          <ClsNetBox x={875} y={835} w={170} labelFs={26} />
        </div>
      )}
      {/* orange return paths */}
      {orangeP > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: orangeP }}>
          <Elbow points={[[875, 930], [396, 930], [396, 490]]} />
          <Elbow points={[[1045, 930], [1528, 930], [1528, 490]]} />
          <Doc x={360} y={392} w={70} h={95} />
          <Doc x={1495} y={392} w={70} h={95} />
        </div>
      )}
      {/* orange up-arrows delivering payment into the cities (fade ~2596) */}
      {upArrowOp > 0 && (
        <svg width={1920} height={1080} style={{ position: "absolute", opacity: upArrowOp }}>
          <path d="M396,366 V205 M396,205 l-9,16 M396,205 l9,16 M1415,366 V205 M1415,205 l-9,16 M1415,205 l9,16" stroke={C.orange} strokeWidth={3.5} fill="none" />
        </svg>
      )}
    </AbsoluteFill>
  );
};

// ═══ Scene 20: strip reprise with navy band + CLSNet box (f2612-2822) ═══
// Measured regular_0218/0222/0226: band y405-680, scroll 9.76 px/f, the
// orange-border CLSNet box FIXED at screen center; clusters anchored at f2775.
export const Strip2Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < 2640 || f >= SEG.reportCard[0] + 14) return null;
  // ref cuts to the navy report card at ~2823 (white-fraction scan)
  const out = lerp(f, [2820, 2826], [1, 0]);
  // entry (fr_2650 → fr_2680): the payment line descends to y455, then grows
  // into the band while clusters + box fade in
  const lineY = lerp(f, [2640, 2654], [368, 455]);
  const growP = lerp(f, [2656, 2678], [0, 1]);
  const bandTop = lineY + (STRIP2.bandY - 455) * growP;
  const bandBottom = lineY + 3 + (STRIP2.bandY + STRIP2.bandH - 458) * growP;
  const contentOp = lerp(f, [2660, 2680], [0, 1]);
  const { bandY, bandH } = STRIP2;
  const sx = (x0: number) => x0 - (f - STRIP2.anchorF) * STRIP2.rate;
  const artDims: Record<string, [number, number]> = {
    rowBank: [460, 145],
    rowOffice: [420, 210],
    stripTowerUp: [370, 255],
    rowSail: [760, 235],
  };
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: out }}>
      <div style={{ position: "absolute", inset: 0, opacity: contentOp }}>
      {STRIP2.ups.map((u, i) => {
        const x = sx(u.cx);
        if (x < -900 || x > 2400) return null;
        const [aw, ah] = artDims[u.art];
        const s = ("scale" in u ? u.scale : undefined) ?? 1;
        return <TracedArt key={i} name={u.art} x={x - (aw * s) / 2} y={bandY - ah * s + 3} scale={s} />;
      })}
      {STRIP2.dns.map((d, i) => {
        const x = sx(d.cx);
        if (x < -900 || x > 2400) return null;
        const aw = { stripInvSail: 575, stripInvCity: 340, stripInvBrick: 300 }[d.art]!;
        return (
          <TracedArt
            key={i}
            name={d.art}
            x={x - aw / 2}
            y={bandY + bandH - 2}
            recolor={{ "#FFFFFF": C.navy }}
          />
        );
      })}
      </div>
      <div style={{ position: "absolute", left: 0, top: bandTop, width: 1920, height: Math.max(3, bandBottom - bandTop), backgroundColor: C.navy }} />
      <div style={{ position: "absolute", inset: 0, opacity: contentOp }}>
      {/* pills riding the strip inside the band */}
      {STRIP2.pills.map((p, i) => {
        const x = sx(p.x);
        if (x < -300 || x > 2000) return null;
        return <Pill key={i} x={x} y={p.y} w={p.w} h={p.h} color={p.c} />;
      })}
      {/* CLSNet box fixed at center, orange border, no label */}
      <ClsNetBox x={STRIP2.box.x} y={STRIP2.box.y} w={STRIP2.box.w} label={false} border="orange" markP={lerp(f, [2668, 2690], [0, 1])} />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 21+22: netting report card → collapse → building pop (f2822-3104) ═══
// Measured: card holds to 2976, collapses into a wide outline pill (fr_2982:
// 365-1555 × 137-295), pill shrinks to (365,520,430,95) by ~3003; navy top edge
// drops 0→390→543 (fr_3009 / fr_3021); cluster rides the edge; tan pill at
// (210,540) by fr_3060; orange pill bottom-right (1355,940) from ~3018.
export const ReportCardScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.reportCard[0] - 12 || f >= SEG.mapBadges[0]) return null;
  const bgOp = lerp(f, [2818, 2826], [0, 1]);
  // ref: navy holds empty until the outline draws ~2875-2900 (white-frac scan)
  const cardP = lerp(f, [2874, 2898], [0, 1]);
  const rowsP = lerp(f, [2898, 2922], [0, 1]) * lerp(f, [2972, 2982], [1, 0]);
  // segments merge (netting)
  const mergeP = lerp(f, [2925, 2955], [0, 1]);
  const card = { x: 530, y: 190, w: 840, h: 700 };
  const rows = [
    { y: 390, color: C.lavender, segs: [90, 55, 120, 80, 60, 95] },
    { y: 480, color: C.orangeDeep, segs: [130, 70, 60, 100, 90, 70] },
    { y: 560, color: C.tan, segs: [75, 110, 140, 60, 85, 55] },
  ];
  // navy ground edge drops, revealing white above (measured keys)
  const edgeY = interpolate(f, [2997, 3009, 3015], [0, 390, 543], clamp);
  // card outline → wide pill → small pill → slides left (keyframed rects)
  const pill = {
    x: interpolate(f, [2976, 2982, 3003, 3030], [card.x, 365, 365, 210], clamp),
    y: interpolate(f, [2976, 2982, 3003, 3030], [card.y, 137, 520, 540], clamp),
    w: interpolate(f, [2976, 2982, 3003, 3030], [card.w, 1190, 430, 345], clamp),
    h: interpolate(f, [2976, 2982, 3003, 3030], [card.h, 158, 95, 95], clamp),
  };
  const collapseP = lerp(f, [2976, 2982], [0, 1]);
  const outlineOp = lerp(f, [3012, 3022], [1, 0]);
  const tanOp = lerp(f, [3040, 3052], [0, 1]);
  // cluster rises from behind the dropping edge
  const clipRise = lerp(f, [2999, 3010], [0, 1]);
  const clusterS = 1.15;
  const clusterH = 255 * clusterS;
  const orangeOp = lerp(f, [3017, 3023], [0, 1]);
  return (
    <AbsoluteFill style={{ opacity: bgOp }}>
      {/* white ground above the dropping navy edge */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: C.white }} />
      <div style={{ position: "absolute", left: 0, top: edgeY, width: 1920, height: 1080 - edgeY, backgroundColor: C.navy }} />
      {/* cluster pinned to the navy edge */}
      {clipRise > 0 && (
        <div style={{ position: "absolute", left: 960 - (370 * clusterS) / 2, top: edgeY - clusterH * clipRise, width: 370 * clusterS, height: clusterH * clipRise, overflow: "hidden" }}>
          <TracedArt name="stripTowerUp" x={0} y={0} scale={clusterS} />
        </div>
      )}
      {/* card outline (dash-draw, then it becomes the collapse pill) */}
      {collapseP <= 0 ? (
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
      ) : (
        outlineOp > 0 && (
          <div
            style={{
              position: "absolute",
              left: pill.x,
              top: pill.y,
              width: pill.w,
              height: pill.h,
              border: `3px solid ${C.white}`,
              borderRadius: `${Math.min(80, pill.h / 2)}px ${Math.min(80, pill.h / 2)}px ${Math.min(80, pill.h / 2)}px 8px`,
              opacity: outlineOp,
            }}
          />
        )
      )}
      {/* tan pill straddling the edge (fr_3060) */}
      {tanOp > 0 && (
        <div
          style={{
            position: "absolute",
            left: 210,
            top: 540,
            width: 345,
            height: 95,
            backgroundColor: C.tan,
            border: `4px solid ${C.white}`,
            borderRadius: "48px 48px 48px 8px",
            opacity: tanOp,
          }}
        />
      )}
      {/* orange filled pill bottom-right */}
      {orangeOp > 0 && (
        <div
          style={{
            position: "absolute",
            left: 1355,
            top: 940,
            width: 170,
            height: 100,
            backgroundColor: C.orangeDeep,
            border: `4px solid ${C.white}`,
            borderRadius: "50px 50px 50px 8px",
            opacity: orangeOp,
          }}
        />
      )}
      {/* card contents (rows + rules), gone by the collapse */}
      {rowsP > 0 && (
        <>
          <div style={{ position: "absolute", left: card.x + 70, top: card.y + 75, width: (card.w - 140) * rowsP, height: 2.5, backgroundColor: C.white, opacity: rowsP }} />
          {rows.map((r, ri) => {
            const total = r.segs.reduce((a, b) => a + b, 0) + (r.segs.length - 1) * 10;
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
                      opacity={rowsP * lerp(f, [2898 + ri * 8 + i * 4, 2906 + ri * 8 + i * 4], [0, 1])}
                    />
                  );
                  xa += wseg + gap;
                  return el;
                })}
              </React.Fragment>
            );
          })}
          <div style={{ position: "absolute", left: card.x + 70, top: card.y + 620, width: 130 * rowsP, height: 2.5, backgroundColor: C.white, opacity: rowsP }} />
          <div style={{ position: "absolute", left: card.x + 280, top: card.y + 620, width: 60 * rowsP, height: 2.5, backgroundColor: C.white, opacity: rowsP }} />
        </>
      )}
    </AbsoluteFill>
  );
};

// ═══ Scene 23: map with FX Global Code badges (f3104-3364) ═══
export const MapBadgesScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { sans: SANS, serif: SERIF } = useBrand();
  const f = frame;
  if (f < SEG.mapBadges[0] || f >= 3396) return null;
  const mapP = lerp(f, [3104, 3130], [0, 1]);
  // implode: crisp shrink (no fade) — scale measured off the montage cells
  const scale = interpolate(f, [3288, 3306, 3312, 3318], [1, 0.55, 0.15, 0], clamp);
  // light-blue field collapses to a dot (fr_3350: r41 at 960,540), holds,
  // then grows back to the settled circle (fr_3396: r≈458)
  const navyBehind = f >= 3318;
  const circleR = interpolate(
    f,
    [3320, 3327, 3331, 3336, 3342, 3375, 3396],
    [1250, 560, 150, 50, CIRCLE.dotR, CIRCLE.dotR, CIRCLE.r],
    clamp,
  );
  const showCircle = f >= 3320;
  const circleCx = CIRCLE.cx;
  const circleCy = interpolate(f, [3375, 3396], [540, CIRCLE.cy], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: navyBehind ? C.navy : C.blue }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: "960px 520px",
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
          // r5: ref 35/50 assignment read per hex at f3280; all badge bodies
          // are TEAL #006F88 (probed), not the title-card greys
          const fifty = [false, true, false, false, true, true, false][i];
          return (
            <div
              key={`b${i}`}
              style={{
                position: "absolute",
                left: hx.cx + 40,
                top: hx.cy + 10,
                width: 92,
                height: 94,
                backgroundColor: "#006F88",
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

// ═══ Scene 24: circle handshake / PvP (f3396-3480) ═══
// Measured fr_3396/fr_3460: circle static at (960,540) r≈460; the navy
// handshake pill GROWS from (875,505,180×92) to (790,460,350×185).
export const CircleScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  // r5 measured exit: the circle group slides LEFT from 3466 (cx keys probed
  // per frame), the dot/elbows/square cut out 3467-3468 and the handshake pill
  // fades 3468-3471 riding the slide; the bare circle then shrink-morphs into
  // page 1's line-2 col-2 big blue pill (526,472,86,68) — landed by 3485-3486,
  // after which the mosaic page owns it (no fade anywhere).
  if (f < 3396 || f >= 3487) return null;
  const artOp = lerp(f, [3400, 3414], [0, 1]);
  const g = lerp(f, [3400, 3450], [0, 1]);
  const MF = [3466, 3467, 3468, 3469, 3470, 3471, 3472, 3473, 3474, 3475, 3476, 3477, 3478, 3479, 3481, 3483, 3485];
  const cx = interpolate(f, MF, [958, 956, 953, 948, 941, 932, 919, 900, 871, 814, 713, 657, 627, 605, 586, 575, 569], clamp);
  const cy = interpolate(f, MF, [538, 538, 538, 538, 538, 537, 536, 535, 533, 530, 517, 512, 510, 509, 508, 507, 506], clamp);
  const mw = interpolate(f, MF, [917, 917, 917, 917, 917, 917, 917, 917, 917, 917, 800, 521, 377, 280, 180, 122, 86], clamp);
  const mh = interpolate(f, MF, [917, 917, 917, 917, 917, 917, 917, 917, 917, 917, 623, 406, 294, 216, 144, 96, 68], clamp);
  const mr = interpolate(f, MF, [458, 458, 458, 458, 458, 458, 458, 458, 458, 458, 118, 57, 41, 25, 16, 14, 14], clamp);
  const dotOp = lerp(f, [3466, 3468], [1, 0]);
  const pillOp = lerp(f, [3467, 3471], [1, 0]);
  const slideX = cx - 958;
  const slideY = cy - 538;
  const pill = {
    x: CIRCLE.pillFrom.x + (CIRCLE.pillTo.x - CIRCLE.pillFrom.x) * g,
    y: CIRCLE.pillFrom.y + (CIRCLE.pillTo.y - CIRCLE.pillFrom.y) * g,
    w: CIRCLE.pillFrom.w + (CIRCLE.pillTo.w - CIRCLE.pillFrom.w) * g,
    h: CIRCLE.pillFrom.h + (CIRCLE.pillTo.h - CIRCLE.pillFrom.h) * g,
  };
  return (
    <AbsoluteFill style={{ backgroundColor: f < SEG.mosaic[0] ? C.navy : undefined, opacity: 1 }}>
      <div
        style={{
          position: "absolute",
          left: cx - mw / 2,
          top: cy - mh / 2,
          width: mw,
          height: mh,
          borderRadius: f >= 3480 ? "2px 14px 2px 14px" : mr,
          backgroundColor: C.blue,
        }}
      />
      <div style={{ position: "absolute", inset: 0, transform: `translate(${slideX}px, ${slideY}px)` }}>
        {/* navy handshake pill grows in place, then fades 3468-3471 on the slide */}
        {pillOp > 0 && (
          <div
            style={{
              position: "absolute",
              left: pill.x,
              top: pill.y,
              width: pill.w,
              height: pill.h,
              backgroundColor: C.navy,
              borderRadius: `${pill.h * 0.28}px ${pill.h * 0.28}px ${pill.h * 0.28}px ${pill.h * 0.55}px`,
              opacity: pillOp,
            }}
          >
            <div style={{ position: "absolute", left: pill.w / 2 - (490 * 0.55 * (pill.w / 350)) / 2, top: pill.h / 2 - (320 * 0.55 * (pill.w / 350)) / 2 }}>
              <TracedArt name="handshake" scale={0.55 * (pill.w / 350)} style={{ position: "relative" }} />
            </div>
          </div>
        )}
        {artOp * dotOp > 0 && (
          <div style={{ position: "absolute", inset: 0, opacity: artOp * dotOp }}>
            {/* white dot + elbows + orange square (fr_3460) */}
            <div style={{ position: "absolute", left: CIRCLE.whiteDot.cx - CIRCLE.whiteDot.r, top: CIRCLE.whiteDot.cy - CIRCLE.whiteDot.r, width: CIRCLE.whiteDot.r * 2, height: CIRCLE.whiteDot.r * 2, borderRadius: CIRCLE.whiteDot.r, backgroundColor: C.white }} />
            <svg width={1920} height={1080} style={{ position: "absolute" }}>
              <path d="M965,455 V388 H755 M755,388 l16,-9 M755,388 l16,9" stroke={C.white} strokeWidth={3} fill="none" />
              <path d="M965,650 V712 H1160 M1160,712 l-16,-9 M1160,712 l-16,9" stroke={C.white} strokeWidth={3} fill="none" />
            </svg>
            <div style={{ position: "absolute", left: CIRCLE.square.x, top: CIRCLE.square.y, width: CIRCLE.square.w, height: CIRCLE.square.w, backgroundColor: C.orangeDeep }} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 25: currency mosaic (f3477-3645) — r5 ground truth ═══
// Three grey bars draw L→R in cascade (extent keys probed); four pill pages
// pop in/out on a fixed 7-column grid (windows from per-frame ink mass).
// Pop-in: pills approach the line from ~92px outside over 4f (linear),
// scaleY 0.25→1, stack-outer pills lag 2f. Pop-out: the whole stack collapses
// INTO the line (scaleY 1-t^2.5, origin on the line, 4f — bbox-tracked).
// Then the bars converge to y549 (3606-3615) and the merged bar rotates about
// (948,549) to vertical (keys 0/4.2/15/56/90°), becoming the shield zipper.
// corner insets measured row-by-row on page_3505: line-side outer corner is
// square (2px AA), the opposite diagonal carries a 13-14px radius
const MOS_ABOVE_BIG = "2px 14px 2px 14px";
const MOS_ABOVE_SMALL = "2px 13px 2px 13px";
const MOS_BELOW_BIG = "14px 2px 14px 2px";
const MOS_BELOW_SMALL = "13px 2px 13px 2px";

const MosStack: React.FC<{
  cell: string;
  x: number;
  lineTop: number;
  f: number;
  inF: number;
  preLanded?: boolean; // page-1 L2-c2 big blue = the landed circle morph — no pop
}> = ({ cell, x, lineTop, f, inF, preLanded }) => {
  const [above = "", below = ""] = cell.split("/");
  const pills: { x: number; y: number; w: number; h: number; color: string; radius: string; k: number; dir: 1 | -1 }[] = [];
  let yBot = lineTop; // above cursor: next pill's bottom edge
  above.split("").forEach((tk, k) => {
    const big = tk === "B";
    const h = big ? 68 : 34;
    const bottom = k === 0 ? lineTop - (big ? 5 : 6) : yBot - 9;
    pills.push({
      x,
      y: bottom - h,
      w: big ? 86 : 83,
      h,
      color: C.blue,
      radius: big ? MOS_ABOVE_BIG : MOS_ABOVE_SMALL,
      k,
      dir: -1,
    });
    yBot = bottom - h;
  });
  let yTop = lineTop; // below cursor: next pill's top edge
  below.split("").forEach((tk, k) => {
    const big = tk === "O";
    const h = big ? 68 : 35;
    const top = k === 0 ? lineTop + 21 : yTop + (big ? 8 : 8);
    pills.push({
      x: big ? x - 1 : x,
      y: top,
      w: big ? 87 : 83,
      h,
      color: big ? MOS.orange : MOS.tan,
      radius: big ? MOS_BELOW_BIG : MOS_BELOW_SMALL,
      k,
      dir: 1,
    });
    yTop = top + h;
  });
  return (
    <>
      {pills.map((p, i) => {
        const t = preLanded && p.dir === -1 && p.k === 0 ? 1 : Math.min(1, Math.max(0, (f - inF - p.k * 2) / 4));
        if (t <= 0) return null;
        const dy = 92 * (1 - t) * p.dir;
        const sc = 0.25 + 0.75 * t;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              backgroundColor: p.color,
              borderRadius: p.radius,
              transform: `translateY(${dy}px) scaleY(${sc})`,
              opacity: Math.min(1, 3 * t),
            }}
          />
        );
      })}
    </>
  );
};

export const MosaicScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.mosaic[0] || f >= SEG.mosaic[1]) return null;
  const rot = f >= MOS.rotate.f[0];
  const lineY = [
    interpolate(f, MOS.converge.f as unknown as number[], MOS.converge.l0 as unknown as number[], clamp),
    549,
    interpolate(f, MOS.converge.f as unknown as number[], MOS.converge.l2 as unknown as number[], clamp),
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy }}>
      {!rot &&
        MOS.lines.map((_, li) => {
          const ext = interpolate(f, MOS.draw[li].f as unknown as number[], MOS.draw[li].x as unknown as number[], clamp);
          if (ext <= 0) return null;
          return (
            <div key={li} style={{ position: "absolute", left: 0, top: lineY[li] - 4, width: ext, height: 8, backgroundColor: C.grey }} />
          );
        })}
      {rot && (
        <div
          style={{
            position: "absolute",
            left: 948 - 1200,
            top: 545,
            width: 2400,
            height: 8,
            backgroundColor: C.grey,
            transform: `rotate(${-interpolate(f, MOS.rotate.f as unknown as number[], MOS.rotate.deg as unknown as number[], clamp)}deg)`,
            transformOrigin: "1200px 4px",
          }}
        />
      )}
      {MOS.pages.map((pg, pi) => {
        if (f < pg.in || f >= pg.out + 5) return null;
        const tOut = Math.min(1, Math.max(0, (f - pg.out) / 4));
        const sOut = 1 - Math.pow(tOut, 2.5);
        const labelOp = Math.min(1, (f - pg.in) / 2) * (1 - Math.min(1, Math.max(0, (f - pg.out) / 3)));
        return (
          <React.Fragment key={pi}>
            {pg.rows.map((row, li) => (
              <div
                key={li}
                style={{ position: "absolute", inset: 0, transform: `scaleY(${sOut})`, transformOrigin: `960px ${MOS.lines[li] + 4}px` }}
              >
                {row.split("|").map((cell, ci) =>
                  cell === "/" ? null : (
                    <MosStack
                      key={ci}
                      cell={cell}
                      x={MOS.cols[ci]}
                      lineTop={MOS.lines[li]}
                      f={f}
                      inF={pg.in}
                      preLanded={pi === 0 && li === 1 && ci === 2}
                    />
                  ),
                )}
              </div>
            ))}
            {pg.labels.map(([txt, colr], li) => (
              <SerifLabel
                key={li}
                text={txt}
                x={MOS.labelSlots[li].cx - 310}
                width={620}
                align="center"
                capTop={MOS.labelSlots[li].capTop}
                fs={MOS.labelFs}
                tracking={MOS.labelTracking}
                color={colr === "o" ? C.orange : C.white}
                opacity={labelOp}
              />
            ))}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ═══ Scene 26: shield (f3641-3700) ═══
// Probed: zipper draws at x930-966 from f3642; white wipes LEFT from it
// (left edge 928→0 over 3645-3657, ≈t^2.1); shield pops 3661-3672, holds to
// 3690, then shrinks away down-left while the band starts rotating (LedgeScene
// owns the band from 3690 — this scene draws only the shield after that).
export const ShieldScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < 3641 || f >= 3702) return null;
  const split = 928;
  const zipDraw = lerp(f, [3641, 3645], [0, 1]);
  const wipeT = lerp(f, [3645, 3657], [0, 1]);
  const leftEdge = split * (1 - Math.pow(wipeT, 2.1));
  const shieldP = lerp(f, [3661, 3672], [0, 1]);
  // exit: shrink + fall down-left with a slight rotation (montage 3693-3699)
  const exitP = lerp(f, [3690, 3700], [0, 1]);
  const bg = f < 3690;
  return (
    <AbsoluteFill style={{ backgroundColor: bg ? C.navy : undefined }}>
      {bg && (
        <>
          {/* white region wiping left from the zipper */}
          <div style={{ position: "absolute", left: leftEdge, top: 0, width: split - leftEdge, height: 1080, backgroundColor: C.white }} />
          {/* zipper band, fixed at x930 (draws downward) */}
          <div style={{ position: "absolute", left: 930, top: 0, width: 36, height: 1080 * zipDraw, backgroundColor: C.band }} />
          {Array.from({ length: 9 }, (_, i) => {
            const ty = i * 127 + 47;
            if (ty > 1080 * zipDraw) return null;
            return <div key={i} style={{ position: "absolute", left: 930, top: ty, width: 36, height: 2, backgroundColor: C.navy, opacity: 0.8 }} />;
          })}
        </>
      )}
      {shieldP > 0 && exitP < 1 && (
        <div
          style={{
            position: "absolute",
            left: 690,
            top: 222,
            width: 520,
            height: 643,
            transform: `translate(${-250 * exitP}px, ${250 * exitP}px) scale(${shieldP * (1 - 0.8 * exitP)}) rotate(${-24 * exitP}deg)`,
            transformOrigin: "46% 50%",
            opacity: 1 - Math.pow(exitP, 1.5),
          }}
        >
          <ShieldSVG />
        </div>
      )}
    </AbsoluteFill>
  );
};

// Shield re-shaped against fr_3672: square shoulders, near-vertical sides to
// ~55% height, fill inset ~42px following the outline.
const ShieldSVG: React.FC = () => (
  <svg width={520} height={643} viewBox="0 0 520 643">
    {/* left half: orange outline + orange fill (sits on the white side) */}
    <g>
      <path d="M240,2 C185,32 105,48 4,50 L4,345 C4,470 100,570 240,640 Z" fill="none" stroke={C.orange} strokeWidth={6} />
      <path d="M240,50 C190,74 128,87 46,90 L46,340 C46,445 125,528 240,590 Z" fill={C.orangeDeep} />
    </g>
    {/* right half: white outline + white fill (sits on the navy side) */}
    <g>
      <path d="M280,2 C335,32 415,48 516,50 L516,345 C516,470 420,570 280,640 Z" fill="none" stroke={C.white} strokeWidth={6} />
      <path d="M280,50 C330,74 392,87 474,90 L474,340 C474,445 395,528 280,590 Z" fill={C.white} />
    </g>
    {/* sparkle right of the outline */}
    <path d="M505,168 l14,14 M519,168 l-14,14" stroke={C.white} strokeWidth={4} />
  </svg>
);

// ═══ Scene 27: band rotation + stacks + cities (f3690-3946) ═══
// One continuous band: vertical zipper (θ=90 reproduces x928-968) rotating
// through a see-saw to flat (θ keys probed at fr_3708/3732/3762, pivot
// (948,575)). Stacks are axis-aligned leaf pills (135×62, pitch 90) dropping
// in while the group settles; at ~3800 the stacks shrink+slide left/inward and
// the two cities rise on the band (fr_3840).
export const LedgeScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.ledge[0] || f >= 3948) return null;
  const theta = interpolate(
    f,
    LEDGE.thetaKeys as unknown as number[],
    LEDGE.thetaVals as unknown as number[],
    clamp,
  );
  const [pcx, pcy] = LEDGE.center;
  // group settle: stacks ride slightly high, sink to rest (fr_3732 vs fr_3762)
  const settleDy = interpolate(f, [3705, 3732, 3762], [90, 40, 0], clamp);
  // citiesStacks phase: stacks shrink+slide, cities fade in on the band
  const slideP = lerp(f, [3800, 3835], [0, 1]);
  const citiesOp = lerp(f, [3815, 3838], [0, 1]);
  const out = lerp(f, [3936, 3946], [1, 0]);
  const S = LEDGE.stacks;
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: out }}>
      {/* rotating band with attached navy half-plane below it */}
      <div
        style={{
          position: "absolute",
          left: pcx - 2500,
          top: pcy - LEDGE.bandH / 2,
          width: 5000,
          height: LEDGE.bandH,
          backgroundColor: C.band,
          transform: `rotate(${-theta}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: i * LEDGE.tickEvery, top: 0, width: 2, height: LEDGE.bandH, backgroundColor: C.navy, opacity: 0.75 }} />
        ))}
        {/* navy half-plane hanging off the band's lower side */}
        <div style={{ position: "absolute", left: -1000, top: LEDGE.bandH, width: 7000, height: 4000, backgroundColor: C.navy }} />
      </div>
      {/* stack groups (axis-aligned; drop in, settle, then shrink+slide) */}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${-170 * slideP}px, 0) scale(${1 - 0.48 * slideP})`, transformOrigin: `${S.leftX}px ${S.baseline + 62}px` }}>
        <StackCols
          x={S.leftX}
          cols={[[C.pillNavy, C.pillNavy, C.steel, C.steel, C.steel], [C.steel, C.steel, C.steel]]}
          f={f}
          at={3703}
          dy={settleDy}
        />
      </div>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${-325 * slideP}px, 0) scale(${1 - 0.48 * slideP})`, transformOrigin: `${S.rightX}px ${S.baseline + 62}px` }}>
        <StackCols
          x={S.rightX}
          cols={[[C.tan, C.tan, C.tan], [C.orangeDeep, C.orangeDeep, C.tan, C.tan, C.tan]]}
          f={f}
          at={3712}
          dy={settleDy}
        />
      </div>
      {/* cities standing on the flat band (fr_3840: bases at y555) */}
      {citiesOp > 0 && (
        <>
          <div style={{ position: "absolute", left: 370, top: 557 - 295 * 0.44, opacity: citiesOp }}>
            <TracedArt name="cityA" scale={0.44} />
          </div>
          <div style={{ position: "absolute", left: 1210, top: 557 - 545 * 0.42, opacity: citiesOp }}>
            <TracedArt name="cityB" scale={0.42} />
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

// Columns of leaf pills dropping in bottom-up (per-pill fade + fall).
const StackCols: React.FC<{
  x: number;
  cols: string[][];
  f: number;
  at: number;
  dy: number;
}> = ({ x, cols, f, at, dy }) => {
  const S = LEDGE.stacks;
  return (
    <>
      {cols.map((col, ci) => (
        <React.Fragment key={ci}>
          {col.map((c, i) => {
            const start = at + ci * 9 + i * 6;
            const p = lerp(f, [start, start + 12], [0, 1]);
            if (p <= 0) return null;
            const ease = 1 - (1 - p) * (1 - p);
            const yFinal = S.baseline - S.pillH - i * S.pitch + dy;
            return (
              <Pill
                key={i}
                x={x + ci * S.colGap}
                y={yFinal - 300 * (1 - ease)}
                w={S.pillW}
                h={S.pillH}
                color={c}
                opacity={p}
              />
            );
          })}
        </React.Fragment>
      ))}
    </>
  );
};

// ═══ Scene 28+29: end card assembles in place (f3926-4168) ═══
// Measured w9 montage + fr_3966/fr_3981/fr_4011: empty navy to ~3957, then the
// title layout assembles element by element on the SAME navy — no crossfade.
export const EndCardScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const { sans: SANS } = useBrand();
  const f = frame;
  if (f < SEG.outro[0]) return null;
  const extrasOp = lerp(f, [4028, 4048], [0, 1]);
  return (
    <AbsoluteFill>
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
