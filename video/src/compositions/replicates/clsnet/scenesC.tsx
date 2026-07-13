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
  const detailP = lerp(f, [2188, 2196], [0, 1]) * lerp(f, [2279, 2291], [1, 0]);
  // shrink-into-doc: full gantt → mini panel inside the left doc. gen10 MEASURED
  // per-frame from the ref VIDEO (the regular_NNNN plate grid is ~+3f offset and
  // gave a false ~10f-late read for three rounds). The ref HOLDS the full gantt
  // to ~f2306 then shrinks FAST 2306-2315 (accelerating). sp maps the measured
  // navy-panel bbox EXACTLY onto the proportional target REPORT.panel
  // (340,470,205,120): f2306 (51,72,1660,933)=sp.15 · f2308 (76,108,1531,860)=.225
  // · f2310 (124,176,1283,722)=.368 · f2312 (216,300,833,471)=.635 · settled 2315.
  // (was st=lerp[2303,2324] quadOut = the f2306-2318 worst window, panel too
  // small at f2306 / too late at f2312.)
  const sp = interpolate(f, [2303, 2306, 2308, 2310, 2312, 2315], [0, 0.15, 0.225, 0.368, 0.635, 1], clamp);
  const R = {
    x: REPORT.panel.x * sp,
    y: REPORT.panel.y * sp + pageY,
    w: 1920 + (REPORT.panel.w - 1920) * sp,
    h: 1080 + (REPORT.panel.h - 1080) * sp,
  };
  // doc outline draws around the shrinking panel — completes by 2315 (was 2324)
  const docR = {
    x: interpolate(f, [2306, 2311, 2315], [-150, 95, REPORT.docL.x], clamp),
    y: interpolate(f, [2306, 2311, 2315], [-700, -30, REPORT.docL.y], clamp),
    w: interpolate(f, [2306, 2311, 2315], [2600, 1040, REPORT.docL.w], clamp),
    h: interpolate(f, [2306, 2311, 2315], [2900, 1070, REPORT.docL.h], clamp),
  };
  const docOp = lerp(f, [2306, 2311], [0, 1]);
  // CLSNet box slides in from the RIGHT and SHRINKS as it travels (gen10, box =
  // square-navy CC in the right region, measured by LEFT-EDGE + side from the ref
  // video). It arrives BIG and clipped by the screen top/bottom, then converges —
  // Lx/side: 1589/980@2314 · 1440/836@2315 · 1232/674@2317 · 1157/614@2318 ·
  // 997/488@2321 → ReportOutScene continues to settle cx959/329@2334. It comes in
  // WITH the mesh mark + wordmark (ClsNetBox draws both). Nothing shows before
  // f2314 (left edge at/right-of the screen edge). The r6 "navy bar sweep" was a
  // mis-read of the shrinking panel's own right edge — removed; the box entry was
  // ~10f late (entered 2313 at cx2350 offscreen) = the f2306-2318 worst window.
  const boxLx = interpolate(f, [2313, 2314, 2315, 2317, 2318, 2319, 2321, 2324], [1793, 1589, 1440, 1232, 1157, 1094, 997, 888], clamp);
  const boxW = interpolate(f, [2313, 2314, 2315, 2317, 2318, 2319, 2321, 2324], [1080, 980, 836, 674, 614, 565, 488, 435], clamp);
  const boxCy = interpolate(f, [2313, 2315, 2317, 2321, 2325], [528, 515, 509, 516, 519], clamp);
  const stubRY = interpolate(f, [2314, 2324], [575, 552], clamp);
  const stubX0 = boxLx + boxW + 20;
  return (
    <AbsoluteFill>
      {/* white ground appears behind the shrinking panel */}
      {sp > 0 && <div style={{ position: "absolute", inset: 0, backgroundColor: C.white }} />}
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
        // NOTE (window-1 investigation): the ref gantt bars carry a ~2-3px
        // white outline the Pill component omits (probed f2300: fill x212-346 /
        // outline x207-350). Adding it as a CSS outline is EYE-correct but
        // SSIM-adverse on well-matched frames (2px A/B: f2300 +0.0044 but
        // f2195/2280 -0.0018/-0.0012 — it merely shifts ~0.001 from window A to
        // window B, failing NEW≥OLD). Left out; revisit only under the owner's
        // eye. A constant pill y-shift was also rejected — the ref pill y drifts
        // non-uniformly (row0 fill-top 184@2210→190@2300, row4 +2@2300, lesson 2).
        return (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, opacity: rowOp }}>
            <Pill x={x} y={y} w={i === 2 && detailP > 0.5 ? 130 : r.w} h={GANTT.pillH} color={PILL_COL[r.color]} />
            <SansText text={COPY.ganttIds[i]} x={x + (i === 2 && detailP > 0.5 ? 130 : r.w) + 24} y={y + 11} fs={GANTT.labelFs} color={C.white} />
          </div>
        );
      })}
      {/* footnote rules bottom-left: PRE-DETAIL ONLY. The ref shows them
          f2166-2188, the detail card covers them, and they NEVER return — probed
          navy(absent) at f2280/f2300 (the f2312 white there is the shrinking
          panel's white ground, not a rule). The old `(1 - detailP)` factor made
          them REAPPEAR across the 2279-2303 restore (detailP falls back to 0),
          painting white lines the ref lacks — the dominant f2300 defect (0.817,
          the window's worst frame). Fade out with the card grow, stay gone. */}
      <div style={{ position: "absolute", left: 193, top: 971, width: 530, height: 2, backgroundColor: C.white, opacity: lerp(f, [2188, 2196], [1, 0]) * lerp(f, [2166, 2172], [0, 1]) }} />
      <div style={{ position: "absolute", left: 192, top: 1010, width: 395, height: 2, backgroundColor: C.white, opacity: lerp(f, [2188, 2196], [1, 0]) * lerp(f, [2170, 2176], [0, 1]) }} />
      {/* detail card: ref GROWS it out of the collapsing gantt rows (opaque,
          full by ~f2196), THEN populates the field text (~2200-2208) — was an
          opacity crossfade of a fixed full-size card (ghost rows showed through
          the translucent card; text appeared with the card). Now: fast opaque
          entrance + scale-grow + delayed content reveal (eye-audit vs vf 2190/
          2196/2202). Exit unchanged (text fades first, then card). */}
      {detailP > 0 && (
        <DetailCard
          opacity={lerp(f, [2188, 2193], [0, 1]) * lerp(f, [2281, 2290], [1, 0])}
          growP={lerp(f, [2188, 2196], [0.14, 1])}
          contentOpacity={lerp(f, [2198, 2207], [0, 1]) * lerp(f, [2279, 2286], [1, 0])}
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
      {/* CLSNet box slides in from the right WITH mesh + wordmark (gen10) */}
      {f >= 2314 && stubX0 < 1910 && <Elbow points={[[stubX0, stubRY], [1920, stubRY]]} />}
      {/* negative A/B (r6): a doc→box left stub at y572 scored −0.002 at
          f2315 — the ref line's exact extent is unmeasured; leave it out */}
      {f >= 2314 && <ClsNetBox x={boxLx} y={boxCy - boxW / 2} w={boxW} labelFs={(48 * boxW) / 345} />}
    </AbsoluteFill>
  );
};

const DetailCard: React.FC<{ opacity: number; growP?: number; contentOpacity?: number }> = ({ opacity, growP = 1, contentOpacity = 1 }) => {
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
        transform: `scale(${growP})`,
        transformOrigin: "50% 50%",
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: contentOpacity }}>
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
  // gen10: the ref holds the settled report to ~f2360 then EXITS it f2362-2377
  // (docs slide DOWN + out as the handshake hexes rise) — was held to f2396,
  // the r11 worst window #4 f2352-2402 (report layout lingered vs rising hexes).
  const out = lerp(f, [2363, 2377], [1, 0]);
  // whole group drifts +125px (fr_2330 → fr_2360), then slides down on exit
  const dy = lerp(f, [2332, 2358], [0, REPORT.driftY]) + lerp(f, [2362, 2377], [0, 360]);
  const meshP = lerp(f, [2342, 2352], [0, 1]);
  const rightOp = lerp(f, [2324, 2330], [0, 1]);
  // gen10: continue the measured box slide across the 2324 handoff (GanttScene
  // ends cx1105/w418) to the settled square by f2334 — cx989/w347@2329, then
  // REPORT.box cx959/w329. (was settled by 2330 at cx1073→977.)
  const boxW = interpolate(f, [2324, 2329, 2334], [418, 347, REPORT.box.w], clamp);
  const boxCx = interpolate(f, [2324, 2329, 2334], [1105, 989, REPORT.box.x + REPORT.box.w / 2], clamp);
  const boxCy = interpolate(f, [2324, 2334], [519, REPORT.box.y + REPORT.box.w / 2], clamp);
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
        <ClsNetBox x={boxCx - boxW / 2} y={boxCy - boxW / 2 + dy} w={boxW} labelFs={(48 * boxW) / 345} />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 18: handshake (f2372-2480) ═══
export const HandshakeScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.handshake[0] || f >= SEG.payment[0] + 16) return null;
  // gen10: the ref exits the report docs ~f2362-2372, then the A/B hexes RISE
  // from below and settle 2372-2392 (measured montage_hsrise: hexes solid, not
  // fading; near-final by ~f2385); the handshake graphic + horizontal arrows
  // form LATER ~2405-2425. Was inOp=lerp[2404,2420] for the WHOLE scene = the
  // report 3-doc layout held f2372-2404 while the ref showed rising hexes (r11
  // worst window #4 f2352-2402). ReportOut's white bg backs us until f2412.
  const bgOp = lerp(f, [2372, 2384], [0, 1]);
  const hexOp = lerp(f, [2370, 2379], [0, 1]);
  const hexRise = lerp(f, [2372, 2392], [210, 0]);
  // ref un-hexes A/B into the two cities-on-a-line by ~f2480 (boundary scan
  // vf 2474/2478/2480): the cities are SOLID at the payment scene's first frame.
  // Was out=[2470,2484] + payment in=[2482,2496] = a crossfade DIP (ghost hexes
  // at f2480, cities only 29% at f2486). Now handshake exits over the SAME
  // window payment enters (2472-2482) so the sum holds ~1 (reads as the un-hex
  // morph) and the cities are solid by 2482.
  const out = lerp(f, [2472, 2482], [1, 0]);
  const graphicOp = lerp(f, [2405, 2420], [0, 1]);
  const arrowP = lerp(f, [2424, 2440], [0, 1]);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: C.white, opacity: bgOp }} />
      <div style={{ position: "absolute", inset: 0, opacity: hexOp, transform: `translateY(${hexRise}px)` }}>
        <SmallHex art="cityA" cx={427} cy={372} w={385} artW={1150} letter="A" />
        <SmallHex art="cityB" cx={1512} cy={755} w={396} artW={1190} letter="B" />
        <Doc x={255} y={510} w={91} h={110} />
        <Doc x={1611} y={900} w={90} h={110} />
      </div>
      {/* handshake graphic + horizontal arrows form later (~2405-2425) */}
      <div style={{ position: "absolute", inset: 0, opacity: graphicOp }}>
        <TracedArt name="handshake" x={715} y={490} />
        <Elbow points={[[1010, 460], [690, 460]]} arrow="end" drawP={arrowP} />
        <Elbow points={[[930, 830], [1245, 830]]} arrow="end" drawP={arrowP} />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 19: payment complete (f2480-2612) ═══
export const PaymentScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  // mount 8f early so the cities crossfade in as the handshake hexes un-hex
  // (kills the f2480 dip — cities solid by 2482 like the ref)
  if (f < SEG.payment[0] - 8 || f >= 2652) return null;
  const inOp = lerp(f, [2472, 2482], [0, 1]);
  // ref holds the payment layout well past 2612 (fr_2630 still shows the
  // below-line plumbing), everything cleared by 2650 (fr_2650 = bare line)
  const out = lerp(f, [2636, 2650], [1, 0]);
  const arrOp = lerp(f, [2505, 2518], [0, 1]);
  const belowOp = lerp(f, [2520, 2538], [0, 1]);
  // r5: ref shows the orange return plumbing SOLID by 2560 (was fading in
  // 2556-2580); the orange up-arrows into the cities are gone by ~2610
  const orangeP = lerp(f, [2532, 2546], [0, 1]);
  const upArrowOp = orangeP * lerp(f, [2596, 2612], [1, 0]);
  // r15: the ref does NOT hold this layout static — it whip-scrolls the whole
  // payment tableau LEFT and off-screen, then Strip2 grows from the bare line.
  // Measured rigidly (badge/box/text move as one): 0 until f2615, then an
  // accelerating exit −11@2620 −104@2625 −468@2630, fully off-frame by ~2635.
  // The horizon line stays put (it is the shared baseline Strip2's line
  // continues), so only the tableau rides the offset. Kills the invented static
  // hold + fade the ref never had (lesson 5).
  const scrollX = interpolate(f, [2615, 2620, 2625, 2630, 2635], [0, -11, -104, -468, -1730], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: inOp * out }}>
      <div style={{ position: "absolute", left: 0, top: 368, width: 1920, height: 3, backgroundColor: C.navy }} />
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${scrollX}px)` }}>
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
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 20: strip reprise with navy band + CLSNet box (f2612-2833) ═══
// r8 ground-truth: band y404-676, five wide re-traced composites anchored
// at their trace-crop origins, 16 vertical pill traversals clipped to the
// band, and the measured EXIT — the band expands into the full-navy report
// card 2814-2827 (no fade; the old fade-out was invented). Box fades
// 2826-2832 (orange mass 4500@2820 → 3445@2824 → 2264@2828 → 0@2832).
export const Strip2Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < 2640 || f >= 2833) return null;
  // entry (fr_2650 → fr_2680): the payment line descends to y455, then grows
  // into the band while clusters + box fade in
  const lineY = lerp(f, [2640, 2654], [368, 455]);
  const growP = lerp(f, [2656, 2678], [0, 1]);
  const grownTop = interpolate(f, STRIP2.expandF as unknown as number[], STRIP2.expandTop as unknown as number[], clamp);
  const grownBot = interpolate(f, STRIP2.expandF as unknown as number[], STRIP2.expandBot as unknown as number[], clamp);
  const bandTop = lineY + (grownTop - 455) * growP;
  const bandBottom = lineY + 3 + (grownBot - 458) * growP;
  const contentOp = lerp(f, [2660, 2680], [0, 1]);
  const sx = (x0: number) => x0 - (f - STRIP2.anchorF) * STRIP2.rate;
  return (
    <AbsoluteFill style={{ backgroundColor: C.white }}>
      <div style={{ position: "absolute", inset: 0, opacity: contentOp }}>
      {/* recolor: the traces' white fill plane is #FFFFFF but the page is
          #FDFDFD — the plate edge reads as a faint rectangle otherwise */}
      {STRIP2.ups.map((u, i) => {
        const x = sx(u.sx);
        if (x + u.w < -50 || x > 1970) return null;
        return <TracedArt key={i} name={u.art} x={x} y={u.y} scale={1} recolor={{ "#FFFFFF": C.white }} />;
      })}
      {STRIP2.dns.map((d, i) => {
        const x = sx(d.sx);
        if (x + d.w < -50 || x > 1970) return null;
        return <TracedArt key={i} name={d.art} x={x} y={d.y} scale={1} recolor={{ "#FFFFFF": C.white }} />;
      })}
      </div>
      <div style={{ position: "absolute", left: 0, top: bandTop, width: 1920, height: Math.max(3, bandBottom - bandTop), backgroundColor: C.navy, overflow: "hidden" }}>
        {/* vertical pill traversals (screen-fixed x, ~30px/f), clipped to the band */}
        {contentOp >= 1 && STRIP2.vpills.map((p, i) => {
          const top = p.top0 + 30 * p.dir * (f - p.f0);
          if (top + p.h < bandTop || top > bandBottom) return null;
          return <Pill key={i} x={p.x} y={top - bandTop} w={p.w} h={p.h} color={p.c} />;
        })}
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: contentOp }}>
      {/* CLSNet box fixed at center, orange border, no label. side/artD*
          measured r8: ref outer 200.5² at (860,436), content +3/+4 vs
          pure scaling */}
      <ClsNetBox x={STRIP2.box.x} y={STRIP2.box.y} w={STRIP2.box.w} label={false} border="orange" markP={lerp(f, [2668, 2690], [0, 1])} side={200.5} artDx={3} artDy={4} opacity={lerp(f, [2826, 2832], [1, 0])} />
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
  // strip2's band expansion IS the navy fill (complete 2827); this short
  // navy-over-navy ramp just hands the background off invisibly
  const bgOp = lerp(f, [2825, 2827], [0, 1]);
  // ── r17 STRUCTURAL REWRITE ─────────────────────────────────────────────────
  // The whole card was re-measured off the ref (pixel scans of vf 2822..2990).
  // FOUR structural errors, each of which cost more than any re-draw could win:
  //
  //  1. CARD EXTENT. Ref outline is x[364,1555] y[139,940] = 1192×802 with a 4px
  //     stroke and DIAGONAL corners (TL + BR rounded r64; TR + BL square — the
  //     same leaf motif the pills use). We drew 840×700 at (530,190), 2.5px, four
  //     40px corners. Everything inside the card inherited the error.
  //
  //  2. EIGHT SEGMENTS PER ROW, not six — at 3-4px gaps, not 10 — spanning
  //     x[496,1475], not the bunched x[600,1175] we drew. Each pill carries a 3px
  //     WHITE STROKE (the old bare Pill had none), so the outer box insets by 3.
  //     Exact per-segment (x,w) tables below; they are pixel-identical across every
  //     settled frame, so they are transcribed, not modelled.
  //
  //  3. THE MERGE IS FICTION. The ref rows draw in by f2926 and then hold FROZEN
  //     TO THE PIXEL through f2978 — the segments never net down into 3 blocks.
  //     The old mergeP swapped in 3 fat blocks at f2940 and held them to f2976,
  //     i.e. it corrupted f2940-2976 — precisely the r13 worst window. Deleted.
  //
  //  4. THE CLOCK RAN LATE. Measured: outline + rules draw f2856-2874 (we started
  //     at 2874 and only finished at 2898, so we showed empty navy for 24 frames
  //     in which the ref already had a complete card); rows draw f2906-2926 (ours
  //     settled at 2942); rules RETRACT rightward f2970-2983; and the rows HARD-CUT
  //     — no fade — tan f2979, org f2980, lav f2981 (we cross-faded 2972-2982).
  //
  // The collapse is untouched: the f>=2982 pill trajectory is hardcoded and
  // card-independent, so only the 6-frame f2976-2982 handoff moves, and it moves
  // the RIGHT way — the ref card compresses vertically IN PLACE (top y139, left
  // x364), which the new card.{x,w} now feed straight into the wide pill instead
  // of the old 530→365 sideways jump (lesson 3: express through consistent transforms).
  const card = { x: 364, y: 139, w: 1192, h: 802 };
  const R = 64; // diagonal corner radius (TL + BR); TR + BL are square
  const STROKE = 4;
  // Outline + rules are drawn by ONE pen, and the per-frame edge scan (2854..2876)
  // pins both its ROUTE and its speed. Route: counter-clockwise from the bottom-
  // right — bottom edge, then left, then top, then right (B fills 2856-2863, L
  // 2863-2864, T 2864-2865, R 2865-2869). Speed: a hard S — 6% at 2860, 18% at
  // 2862, 66% at 2864, 96% at 2868. A straight lerp put the pen on the TOP edge at
  // 2860 while the ref was still on the BOTTOM, and that misplaced ink cost more
  // than drawing nothing (lesson 4) — it was the one frame this round regressed.
  // The rules ride the same clock (measured 0.666 at 2864 vs the card's 0.663).
  const cardP = interpolate(
    f,
    [2855, 2858, 2860, 2862, 2863, 2864, 2865, 2866, 2867, 2868, 2869, 2872],
    [0, 0.018, 0.063, 0.18, 0.33, 0.663, 0.813, 0.887, 0.93, 0.958, 0.97, 1],
    clamp,
  );
  // path length: two straight pairs + two quarter arcs — derived, so it cannot drift
  const dash = 2 * (card.w - R) + 2 * (card.h - R) + Math.PI * R;
  // segment FILL rects (x,w), transcribed from the settled ref; the 3px white
  // stroke sits outside them, so the outer box is (x-3, w+6). Fill height 44.
  const SEG_FILL_H = 44;
  const SEG_STROKE = 3;
  const rows: { fy: number; cut: number; color: string; segs: [number, number][] }[] = [
    {
      fy: 372,
      cut: 2981,
      color: C.lavender,
      segs: [[496, 168], [667, 83], [753, 83], [839, 182], [1025, 167], [1196, 83], [1282, 83], [1368, 83]],
    },
    {
      fy: 520,
      cut: 2980,
      color: C.orangeDeep,
      segs: [[496, 94], [594, 76], [674, 174], [854, 164], [1032, 82], [1124, 82], [1210, 179], [1394, 82]],
    },
    {
      fy: 667,
      cut: 2979,
      color: C.tan,
      segs: [[496, 168], [667, 83], [754, 82], [840, 180], [1024, 95], [1122, 76], [1202, 175], [1380, 83]],
    },
  ];
  // rules ride the card's pen in, hold full, then RETRACT rightward (measured)
  const ruleTopP = cardP * lerp(f, [2970, 2982], [1, 0]);
  const ruleBotP = cardP * lerp(f, [2970, 2979], [1, 0]);
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
            /* counter-clockwise from the bottom-right, so the dash reveals the
               edges in the ref's order: bottom → left → top → right */
            d={`M${card.x + card.w - R},${card.y + card.h - STROKE / 2} H${card.x + STROKE / 2} V${card.y + R} Q${card.x + STROKE / 2},${card.y + STROKE / 2} ${card.x + R},${card.y + STROKE / 2} H${card.x + card.w - STROKE / 2} V${card.y + card.h - R} Q${card.x + card.w - STROKE / 2},${card.y + card.h - STROKE / 2} ${card.x + card.w - R},${card.y + card.h - STROKE / 2}`}
            fill="none"
            stroke={C.white}
            strokeWidth={STROKE}
            strokeDasharray={dash}
            strokeDashoffset={dash * (1 - cardP)}
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
      {/* rules — measured x/y/w, 6px thick; they draw with the card and retract right */}
      {ruleTopP > 0 && (
        <div style={{ position: "absolute", left: 469, top: 214, width: 1037 * ruleTopP, height: 6, backgroundColor: C.white }} />
      )}
      {ruleBotP > 0 && (
        <>
          <div style={{ position: "absolute", left: 469, top: 869, width: 311 * ruleBotP, height: 6, backgroundColor: C.white }} />
          <div style={{ position: "absolute", left: 889, top: 869, width: 89 * ruleBotP, height: 6, backgroundColor: C.white }} />
        </>
      )}
      {/* netting rows — 8 stroked pills each, at their transcribed positions. They
          draw in f2906-2926, hold FROZEN, then hard-cut per row (no fade). */}
      {rows.map((r, ri) =>
        f >= r.cut ? null : (
          <React.Fragment key={ri}>
            {r.segs.map(([fx, fw], i) => {
              // scattered-but-settled stagger: every segment is up by f2926, as in the ref
              const t0 = 2906 + ri * 1.5 + i * 1.4;
              const op = lerp(f, [t0, t0 + 8], [0, 1]);
              if (op <= 0) return null;
              return (
                <div
                  key={`${ri}-${i}`}
                  style={{
                    position: "absolute",
                    left: fx - SEG_STROKE,
                    top: r.fy - SEG_STROKE,
                    width: fw + SEG_STROKE * 2,
                    height: SEG_FILL_H + SEG_STROKE * 2,
                    boxSizing: "border-box",
                    backgroundColor: r.color,
                    border: `${SEG_STROKE}px solid ${C.white}`,
                    // leaf, matching the card: TL + BR rounded, TR + BL square
                    borderRadius: `${SEG_FILL_H / 2}px 0px ${SEG_FILL_H / 2}px 0px`,
                    opacity: op,
                  }}
                />
              );
            })}
          </React.Fragment>
        ),
      )}
    </AbsoluteFill>
  );
};

// ═══ Scene 23: map with FX Global Code badges (f3104-3364) ═══
// gen9 re-trace: the second-map hexes carried the FIRST-map r1 traces
// (wrong buildings — temple where the ref shows a city cluster) UPSCALED to
// 254 (r7's "1.18x bigger" read was wrong — measured native is ~215×190, the
// same size as the first map). Re-traced from the settled badge-free frame
// regular_0254 (f3162) at each hex's measured centre + native bbox.
const MB_AW = 216;
const MB_AH = 196;
const MB_HEXES: { art: string; cx: number; cy: number }[] = [
  { art: "mbHexHeli", cx: 386, cy: 410 },
  { art: "mbHexOffice", cx: 662, cy: 248 },
  { art: "mbHexBank", cx: 577, cy: 788 },
  { art: "mbHexBank2", cx: 1092, cy: 418 },
  { art: "mbHexTowers2", cx: 916, cy: 725 },
  { art: "mbHexSail", cx: 1513, cy: 344 },
  { art: "mbHexCity2", cx: 1432, cy: 768 },
];
const BADGE_POS: [number, number][] = [
  [412, 428], [685, 264], [599, 824], [1116, 448], [933, 750], [1520, 371], [1441, 801],
];

export const MapBadgesScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { sans: SANS, serif: SERIF } = useBrand();
  const f = frame;
  if (f < SEG.mapBadges[0] || f >= 3396) return null;
  // ref: the world map is BRIGHT/full by ~f3112 (vf 3104/3112/3120), not a 26f
  // dim fade to 3130 — the old ramp left a grey half-lit map through the whole
  // hex cascade. Draw it in fast.
  const mapP = lerp(f, [3104, 3113], [0, 1]);
  // implode: crisp shrink (no fade). r9 ground truth (measure_implode.py,
  // white map-content bbox ratio vs settled 0264): scale 0.804 at f3300,
  // 0.037 at f3312.5, gone by 3318 — a slow lead-in then a fast collapse.
  // The old montage-eyeballed curve hit 0.70 at f3300 (shrinking too early),
  // costing the f3300 keyframe (window #1 worst, idx66 0.802).
  const scale = interpolate(f, [3288, 3300, 3312.5, 3318], [1, 0.804, 0.037, 0], clamp);
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
          transformOrigin: "960px 537px", // r9 measured implode origin (bbox-center solve)
        }}
      >
        <TracedArt name="worldMap" x={MAP.x} y={MAP.y} opacity={mapP} />
        {/* r6/r7 probed at f3280 vs f700: map outline IDENTICAL (bbox
            206-1711/60-1015) but hexes ~1.18x bigger at shifted centers
            (fill-offset method); badges 104x102 at measured absolute spots,
            35-badges GREY-BLUE #5A7593 / 50-badges TEAL #006F88 (corner-
            sampled — r5's all-teal read was text-polluted). */}
        {MB_HEXES.map((hx, i) => {
          // ref has the first hex present WITH the map (~f3112) then ~1 more
          // every 9f (vf 3112→1, 3120→2, 3160→6, 3180→7). Old 3116+i*7 with a
          // 10f grow put hex0 full only at ~f3126 — the whole cascade ran late.
          const pop = 3106 + i * 9;
          const s = lerp(f, [pop, pop + 8], [0, 1]);
          if (s <= 0) return null;
          return (
            <div key={hx.art} style={{ position: "absolute", left: hx.cx - (MB_AW * s) / 2, top: hx.cy - (MB_AH * s) / 2 }}>
              <TracedArt name={hx.art} scale={s} />
            </div>
          );
        })}
        {/* badges */}
        {MB_HEXES.map((hx, i) => {
          const at = 3160 + i * 9;
          const op = lerp(f, [at, at + 8], [0, 1]);
          if (op <= 0) return null;
          const fifty = [false, true, false, false, true, true, false][i];
          const [bx, by] = BADGE_POS[i];
          return (
            <div
              key={`b${hx.art}`}
              style={{
                position: "absolute",
                left: bx,
                top: by,
                width: 104,
                height: 102,
                backgroundColor: fifty ? "#006F88" : "#5A7593",
                opacity: op,
                padding: "9px 9px",
              }}
            >
              <div style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.1, color: C.white, textAlign: "center", whiteSpace: "pre" }}>{"FX Global\nCode"}</div>
              <div style={{ fontFamily: SANS, fontSize: 11, color: "rgba(235,237,244,0.75)", marginTop: 1, textAlign: "center" }}>Principle</div>
              <div style={{ fontFamily: SERIF, fontSize: 42, lineHeight: 0.85, color: "rgba(235,237,244,0.85)", textAlign: "center" }}>{fifty ? "50" : "35"}</div>
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
  // hold the ledge fully opaque through f3940 (was [3936,3946], which greyed it
  // as it faded to the dark behind while the ref stays white through ~f3938).
  // The endcard navy wipes in over the top from f3938-3940 (EndCardScene enterOp)
  // and fully covers the ledge by f3940, so this delayed fade is only ever seen
  // as full white ledge at f3936-3939 — matching the ref's late, fast handoff.
  const out = lerp(f, [3940, 3946], [1, 0]);
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
  // TitleCard paints a full navy AbsoluteFill, and EndCardScene renders LAST
  // (on top of LedgeScene). SEG.outro[0]=3926 mounted that navy over the STILL
  // LIVE ledge outro — the ref holds the ledge cities+stacks through ~f3933
  // (probed white top at 3930/3933, navy by 3946) then hands off to the navy
  // endcard, but the comp buried the ledge under navy from 3926 (f3930 = 0.598,
  // the video's single worst frame). Ramp the endcard in over the ledge's own
  // out-window [3936,3946] so 3926-3936 stays transparent (ledge shows) and the
  // handoff reads as the measured ledge fade. Full opacity well before the
  // endcard content assembles (logo/mark from 3957), so nothing downstream moves.
  // The ref hands off FAST (edge-in wipe, not a uniform crossfade: white through
  // f3936-3938, ~80% navy by f3940, full navy f3946). Per-frame ref-gated:
  // ledge-showing beats navy through f3938 (0.82 vs 0.68), navy wins from f3940
  // (0.79 vs ~0.5). So hold the ledge (enterOp=0) through f3938 then snap to full
  // navy by f3940 — every transition frame then scores >= the old full-navy cover.
  const enterOp = lerp(f, [3938, 3940], [0, 1]);
  return (
    <AbsoluteFill style={{ opacity: enterOp }}>
      <TitleCard frame={f} endcard />
      {/* disclaimer: measured against ref_4110 — the ref runs larger, looser and
          dimmer than the data defaults (fs 34 / lh 1.15 / α0.75). Probed line1
          cap-top y879, cap-height ~30px (fs≈43), line pitch 60px (lh≈1.4), glyph
          colour (94,115,155) ≈ α0.5. Override inline (ENDCARD is data.ts). */}
      <SansText
        text={COPY.disclaimer}
        x={ENDCARD.disclaimer.x}
        y={864}
        fs={43}
        lineHeight={1.4}
        color="rgba(200,206,220,0.5)"
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
