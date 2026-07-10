import React from "react";
import { AbsoluteFill } from "remotion";
import { C, TITLE, HEXROW, FLOWS, GLOBE, MAP, SEG } from "./data";
import { useBrand, useCopy } from "./brand";
import { TracedArt } from "./TracedArt";
import { ClsNetBox, HexIcon, Pill, SansText, SerifLabel, lerp } from "./ui";

// ═══ Scene 1: Title (f0-150) ═══
// CLSNet reveals right-to-left; CLS logo + tagline fade; supporting text;
// principle cards slide-fade in with transient loader bars; outro = slight
// CCW tilt + white diagonal wipe (f130-150).
// In endcard mode the SAME layout assembles element by element on navy
// (measured fr_3966/fr_3981/fr_4011): logo 3957-3977, wordmark reveal
// 3959-3973, supporting 3974-3980, card 35 as bar→body 3978-3996, card 50
// 3997-4013.
export const TitleCard: React.FC<{ frame: number; endcard?: boolean }> = ({
  frame,
  endcard = false,
}) => {
  const { copy: COPY, serif: SERIF, logoArt, logoText } = useBrand();
  const f = frame;
  const logoOp = endcard ? lerp(f, [3957, 3977], [0, 1]) : lerp(f, [2, 18], [0, 1]);
  const supportOp = endcard ? lerp(f, [3974, 3980], [0, 1]) : lerp(f, [10, 24], [0, 1]);
  const wordP = endcard ? lerp(f, [3959, 3973], [0, 1]) : lerp(f, [0, 11], [0, 1]);
  const card1Op = endcard ? lerp(f, [3979, 3983], [0, 1]) : lerp(f, [22, 38], [0, 1]);
  const card2Op = endcard ? lerp(f, [3998, 4002], [0, 1]) : lerp(f, [40, 56], [0, 1]);
  const card1Grow = endcard ? lerp(f, [3982, 3990], [0, 1]) : 1;
  const card2Grow = endcard ? lerp(f, [4001, 4008], [0, 1]) : 1;
  const card1Parts = endcard
    ? { kicker: lerp(f, [3985, 3990], [0, 1]), num: lerp(f, [3988, 3993], [0, 1]), strip: lerp(f, [3991, 3996], [0, 1]) }
    : undefined;
  const card2Parts = endcard
    ? { kicker: lerp(f, [4003, 4008], [0, 1]), num: lerp(f, [4005, 4010], [0, 1]), strip: lerp(f, [4008, 4013], [0, 1]) }
    : undefined;
  const bar1Op = endcard ? 0 : lerp(f, [20, 26], [0, 1]) * lerp(f, [34, 40], [1, 0]);
  const bar2Op = endcard ? 0 : lerp(f, [34, 38], [0, 1]) * lerp(f, [46, 52], [1, 0]);
  const wmBarOp = endcard ? 0 : lerp(f, [4, 8], [0, 1]) * lerp(f, [26, 36], [1, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: C.navy }}>
      {/* CLS logo (traced white art) + tagline */}
      {logoArt ? (
        <TracedArt name={logoArt} x={TITLE.logo.x} y={TITLE.logo.y} scale={1} opacity={logoOp} />
      ) : (
        <div
          style={{
            position: "absolute",
            left: TITLE.logo.x,
            top: TITLE.logo.y,
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 64,
            color: C.white,
            opacity: logoOp,
          }}
        >
          {logoText}
        </div>
      )}
      {/* Supporting line */}
      <SansText
        text={COPY.supporting}
        x={TITLE.supporting.x}
        y={TITLE.supporting.y}
        fs={TITLE.supporting.fs}
        color={C.white}
        opacity={supportOp}
      />
      {/* CLSNet wordmark — reveal right-to-left via clip */}
      <div
        style={{
          position: "absolute",
          left: TITLE.wordmark.x,
          top: TITLE.wordmark.capTop - 0.30 * 200,
          width: TITLE.wordmark.right - TITLE.wordmark.x + 20,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: 200,
            lineHeight: 1,
            color: C.white,
            // ref reveals the trailing letters first (t=0 shows only "t")
            clipPath: `inset(0 0 0 ${(1 - wordP) * 100}%)`,
            whiteSpace: "pre",
            transform: "scaleX(1.14)",
            transformOrigin: "left top",
          }}
        >
          {COPY.brand}
        </div>
      </div>
      {/* transient loader bar right of wordmark */}
      <div
        style={{
          position: "absolute",
          left: 930,
          top: 592,
          width: 200,
          height: 8,
          backgroundColor: "#5E6E8C",
          opacity: wmBarOp,
        }}
      />
      {/* Principle cards */}
      <PrincipleCard
        x={TITLE.card1.x}
        y={TITLE.card1.y}
        w={TITLE.card1.w}
        h={TITLE.card1.h}
        stripY={TITLE.card1.stripY}
        body={C.card35}
        strip={C.card35Strip}
        num={COPY.p35.num}
        kicker={COPY.p35.kicker}
        stripText={COPY.p35.strip}
        opacity={card1Op}
        growP={card1Grow}
        parts={card1Parts}
      />
      <PrincipleCard
        x={TITLE.card2.x}
        y={TITLE.card2.y}
        w={TITLE.card2.w}
        h={TITLE.card2.h}
        stripY={TITLE.card2.stripY}
        body={C.card50}
        strip={C.card50Strip}
        num={COPY.p50.num}
        kicker={COPY.p50.kicker}
        stripText={COPY.p50.strip}
        opacity={card2Op}
        growP={card2Grow}
        parts={card2Parts}
      />
      {/* transient loader bars under/next to cards */}
      <div style={{ position: "absolute", left: 875, top: 708, width: 430, height: 22, backgroundColor: "#8286A0", opacity: bar1Op }} />
      <div style={{ position: "absolute", left: 1340, top: 560, width: 300, height: 10, backgroundColor: C.card50Strip, opacity: bar2Op }} />
    </AbsoluteFill>
  );
};

export const PrincipleCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  stripY: number;
  body: string;
  strip: string;
  num: string;
  kicker: string;
  stripText: string;
  opacity?: number;
  // endcard assembly: body grows vertically out of a bar at y560 (fr_3981);
  // kicker/num/strip fade in separately
  growP?: number;
  parts?: { kicker: number; num: number; strip: number };
}> = ({ x, y, w, h, stripY, body, strip, num, kicker, stripText, opacity = 1, growP = 1, parts }) => {
  const { serif: SERIF, sans: SANS } = useBrand();
  if (opacity <= 0) return null;
  // bar rect in card-local coords: y 204-244 (screen 560-600)
  const bodyTop = 204 * (1 - growP);
  const bodyBottom = 244 + (h - 244) * growP;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity }}>
      <div style={{ position: "absolute", left: 0, top: bodyTop, width: w, height: bodyBottom - bodyTop, backgroundColor: body }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: stripY - y,
          width: w,
          height: h - (stripY - y),
          backgroundColor: strip,
          opacity: (parts?.strip ?? 1) * (growP >= 1 ? 1 : 0),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 28,
          top: 24,
          fontFamily: SERIF,
          fontSize: 44,
          color: C.cardText,
          lineHeight: 1,
          opacity: parts?.kicker ?? 1,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          position: "absolute",
          right: 16,
          top: stripY - y - 182,
          fontFamily: SERIF,
          fontSize: 195,
          lineHeight: 1,
          color: "rgba(230,232,240,0.55)",
          opacity: parts?.num ?? 1,
        }}
      >
        {num}
      </div>
      <div
        style={{
          position: "absolute",
          left: 24,
          top: stripY - y + 14,
          fontFamily: SANS,
          fontSize: 30,
          lineHeight: 1.15,
          color: C.navy,
          whiteSpace: "pre-wrap",
          opacity: (parts?.strip ?? 1) * (growP >= 1 ? 1 : 0),
        }}
      >
        {stripText}
      </div>
    </div>
  );
};

// Title outro: tilt + white diagonal wipe (f130-150)
export const TitleOutro: React.FC<{ frame: number; children: React.ReactNode }> = ({
  frame,
  children,
}) => {
  const tilt = lerp(frame, [130, 150], [0, -10]);
  const wipe = lerp(frame, [130, 150], [0, 1]);
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `rotate(${tilt}deg) translateY(${wipe * -160}px)`,
          transformOrigin: "30% 40%",
        }}
      >
        {children}
      </AbsoluteFill>
      {wipe > 0 && (
        <div
          style={{
            position: "absolute",
            left: -400 + (1 - wipe) * 2600,
            top: -200,
            width: 3200,
            height: 1600,
            backgroundColor: C.white,
            transform: "rotate(-10deg)",
            transformOrigin: "center",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ═══ Scene 2: Rows build (f148-320) ═══
const ROW_LINES = [220, 462, 765, 1035];
const ROW_ART: {
  art: string;
  y: number;
  settleX: number;
  spawnX: number;
  pop: number; // frame the cluster pops
  settle: number; // frame slide completes
}[] = [
  { art: "rowBank", y: 77, settleX: 60, spawnX: 780, pop: 172, settle: 250 },
  { art: "rowOffice", y: 253, settleX: 120, spawnX: 560, pop: 196, settle: 268 },
  { art: "rowTowers", y: 500, settleX: 210, spawnX: 850, pop: 214, settle: 286 },
  { art: "rowSail", y: 800, settleX: 1100, spawnX: 1420, pop: 245, settle: 300 },
];

export const RowsBuild: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.rows[0] || f >= SEG.hexRow[0] + 18) return null;
  const lineP = lerp(f, [148, 162], [0, 1]);
  // rows collapse toward the hex row at the end (f318-336 crossfade out)
  const out = lerp(f, [318, 334], [1, 0]);
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", opacity: out }}>
      {ROW_LINES.map((y, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            top: y,
            width: 1920 * lineP,
            height: 3,
            backgroundColor: C.navy,
          }}
        />
      ))}
      {ROW_ART.map((r, i) => {
        if (f < r.pop) return null;
        const x = lerp(f, [r.pop, r.settle], [r.spawnX, r.settleX]);
        const grow = lerp(f, [r.pop, r.pop + 10], [0, 1]);
        return (
          <TracedArt
            key={i}
            name={r.art}
            x={x}
            y={r.y}
            opacity={1}
            style={{
              clipPath: `inset(0 ${(1 - grow) * 60}% 0 ${(1 - grow) * 30}%)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ═══ Scene 3+4: hex row + CLSNet + flows (f320-462) ═══
const HEX_ARTS = ["hexBank", "hexOffice", "hexTowers", "hexSail"];

export const HexRowFlows: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.hexRow[0] || f >= SEG.flows[1] + 14) return null;
  const inOp = lerp(f, [322, 336], [0, 1]);
  const boxOp = lerp(f, [330, 344], [0, 1]);
  // globe scene push: everything slides left off as globe arrives (f452-470)
  const shift = lerp(f, [452, 470], [0, -1920]);
  const out = lerp(f, [452, 468], [1, 0]);

  // ruler + pills phase (f366+)
  const rulerP = lerp(f, [366, 384], [0, 1]);
  // pair labels: USD/CNH f≈380-425, EUR/CZK f≈428-462
  const pairAOp = lerp(f, [382, 392], [0, 1]) * lerp(f, [420, 430], [1, 0]);
  const pairBOp = lerp(f, [430, 440], [0, 1]);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${shift * 0.3}px)` }}>
        {/* ruler */}
        {rulerP > 0 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: FLOWS.rulerY,
              width: 1920 * rulerP,
              height: FLOWS.rulerH,
              backgroundColor: C.band,
            }}
          />
        )}
        {rulerP >= 1 &&
          Array.from({ length: 14 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 70 + i * FLOWS.tickEvery,
                top: FLOWS.rulerY + 2,
                width: 2.5,
                height: 16,
                backgroundColor: C.navy,
              }}
            />
          ))}
        {/* hexagons */}
        {HEX_ARTS.map((a, i) => (
          <HexIcon
            key={a}
            art={a}
            cx={HEXROW.centers[i]}
            cy={HEXROW.cy}
            w={HEXROW.hexW}
            opacity={inOp}
          />
        ))}
        {/* CLSNet box */}
        <ClsNetBox x={HEXROW.box.x} y={HEXROW.box.y} opacity={boxOp} />
        {/* pill stacks (above: steel/navy; below: orange/tan) */}
        {f >= 372 &&
          FLOWS.stacks.map((cx, si) => {
            const upCols = [C.steel, si === 1 ? C.pillNavy : C.steelDark, C.steel];
            const dnCols = [si % 2 ? C.tan : C.orangeDeep, C.tan, C.tan];
            const n = Math.floor(lerp(f, [374 + si * 6, 400 + si * 6], [0, 3.99]));
            return (
              <React.Fragment key={si}>
                {upCols.slice(0, n).map((col, i) => (
                  <Pill
                    key={`u${i}`}
                    x={cx - FLOWS.pillW / 2}
                    y={FLOWS.rulerY - 14 - (i + 1) * (FLOWS.pillH + FLOWS.pillGap)}
                    color={col}
                  />
                ))}
                {dnCols.slice(0, n).map((col, i) => (
                  <Pill
                    key={`d${i}`}
                    x={cx - FLOWS.pillW / 2}
                    y={FLOWS.rulerY + FLOWS.rulerH + 14 + i * (FLOWS.pillH + FLOWS.pillGap)}
                    color={col}
                  />
                ))}
              </React.Fragment>
            );
          })}
        {/* currency pair labels */}
        <SerifLabel text="USD" x={FLOWS.labelTop.x} capTop={FLOWS.labelTop.capTop} fs={FLOWS.labelTop.fs} color={C.serifNavy} opacity={pairAOp} />
        <SerifLabel text="CNH" x={FLOWS.labelBot.x} capTop={FLOWS.labelBot.capTop} fs={FLOWS.labelBot.fs} color={C.orangeDeep} opacity={pairAOp} />
        <SerifLabel text="EUR" x={FLOWS.labelTop.x} capTop={FLOWS.labelTop.capTop} fs={FLOWS.labelTop.fs} color={C.serifNavy} opacity={pairBOp} />
        <SerifLabel text="CZK" x={FLOWS.labelBot.x} capTop={FLOWS.labelBot.capTop} fs={FLOWS.labelBot.fs} color={C.orangeDeep} opacity={pairBOp} />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 5: Globe + lock (f462-566) ═══
export const GlobeScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { sans: SANS } = useBrand();
  const f = frame;
  if (f < SEG.globe[0] - 10 || f >= SEG.globe[1] + 10) return null;
  const slideIn = lerp(f, [455, 478], [900, 0]);
  const out = lerp(f, [556, 566], [1, 0]);
  // globe rotation: crossfade globeA→globeB over the scene
  const spin = lerp(f, [478, 545], [0, 1]);
  const ringSpin = lerp(f, [478, 566], [0, -38]);
  const lockState = f < 500 ? "lockOpen" : f < 528 ? "lockList" : "lockClosed";
  const lockOp = lerp(f, [470, 480], [0, 1]);
  // grey band sweeping into ring from left (f462-480)
  const bandP = lerp(f, [458, 476], [0, 1]);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${slideIn}px)` }}>
        {bandP > 0 && bandP < 1 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 844,
              width: (GLOBE.cx - 40) * bandP,
              height: 28,
              backgroundColor: C.band,
            }}
          />
        )}
        {/* ring: grey donut with ticks + time labels */}
        <svg
          width={2 * GLOBE.ringR + 40}
          height={2 * GLOBE.ringR + 40}
          viewBox={`0 0 ${2 * GLOBE.ringR + 40} ${2 * GLOBE.ringR + 40}`}
          style={{
            position: "absolute",
            left: GLOBE.cx - GLOBE.ringR - 20,
            top: GLOBE.cy - GLOBE.ringR - 20,
          }}
        >
          <g transform={`rotate(${ringSpin} ${GLOBE.ringR + 20} ${GLOBE.ringR + 20})`}>
            <circle
              cx={GLOBE.ringR + 20}
              cy={GLOBE.ringR + 20}
              r={(GLOBE.ringR + GLOBE.r) / 2}
              fill="none"
              stroke={C.band}
              strokeWidth={GLOBE.ringR - GLOBE.r}
            />
            {Array.from({ length: 48 }, (_, i) => {
              const a = (i * Math.PI * 2) / 48;
              const long = i % 2 === 0;
              const r0 = GLOBE.r - 4;
              const r1 = long ? GLOBE.ringR + 14 : GLOBE.ringR - 4;
              return (
                <line
                  key={i}
                  x1={GLOBE.ringR + 20 + r0 * Math.sin(a)}
                  y1={GLOBE.ringR + 20 - r0 * Math.cos(a)}
                  x2={GLOBE.ringR + 20 + r1 * Math.sin(a)}
                  y2={GLOBE.ringR + 20 - r1 * Math.cos(a)}
                  stroke={C.navy}
                  strokeWidth={1.6}
                />
              );
            })}
            {["23:00", "00:00", "06:30", "07:00", "09:00"].map((t, i) => {
              const a = ((i * 47 - 8) * Math.PI) / 180;
              const rr = GLOBE.ringR + 28;
              return (
                <text
                  key={i}
                  x={GLOBE.ringR + 20 + rr * Math.sin(a)}
                  y={GLOBE.ringR + 20 - rr * Math.cos(a)}
                  fontFamily={SANS}
                  fontSize={20}
                  fill={C.navy}
                  transform={`rotate(${(a * 180) / Math.PI} ${GLOBE.ringR + 20 + rr * Math.sin(a)} ${GLOBE.ringR + 20 - rr * Math.cos(a)})`}
                >
                  {t}
                </text>
              );
            })}
          </g>
        </svg>
        {/* globe disc + rotating continents (crossfade of two traced states) */}
        <div
          style={{
            position: "absolute",
            left: GLOBE.cx - GLOBE.r,
            top: GLOBE.cy - GLOBE.r,
            width: 2 * GLOBE.r,
            height: 2 * GLOBE.r,
            borderRadius: GLOBE.r,
            backgroundColor: C.blue,
            border: `4px solid ${C.navy}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: GLOBE.cx - 360,
            top: GLOBE.cy - 360,
            width: 720,
            height: 720,
            borderRadius: 360,
            overflow: "hidden",
          }}
        >
          <TracedArt name="globeA" x={0} y={-170 + 0} scale={1} opacity={1 - spin} style={{ left: -22 - spin * 160 }} />
          <TracedArt name="globeB" x={0} y={-170} scale={1} opacity={spin} style={{ left: -22 + (1 - spin) * 160 }} />
        </div>
        {/* orange triangle marker */}
        <svg width={44} height={36} viewBox="0 0 44 36" style={{ position: "absolute", left: GLOBE.triangle.x - 22, top: GLOBE.triangle.y }}>
          <path d="M4,4 H40 L22,32 Z" fill="none" stroke={C.orange} strokeWidth={5} strokeLinejoin="round" />
        </svg>
        {/* lock */}
        <TracedArt name={lockState} x={GLOBE.lock.x} y={GLOBE.lock.y} opacity={lockOp} />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scenes 6-7: blue expand, map draw, hexes, 120 currencies (f560-745) ═══
export const MapScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < SEG.mapDraw[0] || f >= SEG.mapHexes[1] + 16) return null;
  // blue rounded rect expands to full bleed f560-586
  const expand = lerp(f, [560, 586], [0, 1]);
  const radius = lerp(f, [560, 590], [400, 0]);
  const mapP = lerp(f, [575, 605], [0, 1]);
  const w = 1120 + 800 * expand;
  const h = 630 + 450 * expand;
  const labelOp = lerp(f, [672, 684], [0, 1]);
  // out: map+hexes dissolve into network scene (f732-748)
  const out = lerp(f, [732, 748], [1, 0]);
  return (
    <AbsoluteFill style={{ opacity: 1 }}>
      <div
        style={{
          position: "absolute",
          left: 960 - w / 2,
          top: 540 - h / 2,
          width: w,
          height: h,
          backgroundColor: C.blue,
          borderRadius: radius,
        }}
      />
      <div style={{ position: "absolute", inset: 0, opacity: out }}>
        <TracedArt
          name="worldMap"
          x={MAP.x}
          y={MAP.y}
          opacity={mapP}
          recolor={{ "#FFFFFF": C.white }}
        />
        {/* mini hexes pop f600-660 staggered */}
        {MAP.hexes.map((hx, i) => {
          const pop = 600 + i * 9;
          const s = lerp(f, [pop, pop + 12], [0, 1]);
          if (s <= 0) return null;
          return (
            <div
              key={hx.art}
              style={{
                position: "absolute",
                left: hx.cx - (MAP.hexW * s) / 2,
                top: hx.cy - (MAP.hexW * 0.906 * s) / 2,
                width: MAP.hexW * s,
                height: MAP.hexW * 0.906 * s,
              }}
            >
              <TracedArt name={hx.art} scale={s} />
            </div>
          );
        })}
        <SerifLabel
          text={COPY.currencies120}
          x={MAP.label.x}
          capTop={MAP.label.capTop}
          fs={MAP.label.fs}
          color={C.serifNavy}
          opacity={labelOp}
        />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 8: network hexes + product docs (f745-913) ═══
// measured islands at t=31: 375×332 hexes at these centers
const NET_HEXES = [
  { art: "mHexHeli", cx: 393, cy: 409, w: 375 },
  { art: "mHexBank", cx: 774, cy: 678, w: 375 },
  { art: "mHexBank2", cx: 1179, cy: 414, w: 375 },
  { art: "mHexCity2", cx: 1594, cy: 650, w: 375 },
];

export const NetworkScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < SEG.network[0] - 6 || f >= SEG.network[1]) return null;
  const inOp = lerp(f, [742, 758], [0, 1]);
  const linesP = lerp(f, [760, 782], [0, 1]);
  // product docs appear along the connectors
  const docs = [
    { label: COPY.docLabels[0], x: 470, y: 780, at: 800 },
    { label: COPY.docLabels[1], x: 880, y: 300, at: 815 },
    { label: COPY.docLabels[2], x: 1290, y: 290, at: 830 },
    { label: COPY.docLabels[3], x: 850, y: 760, at: 860 },
    { label: COPY.docLabels[4], x: 930, y: 760, at: 868 },
  ];
  const wipe = lerp(f, [900, 913], [0, 1]); // hard-ish cut to cities at 913
  return (
    <AbsoluteFill style={{ backgroundColor: C.blue }}>
      <div style={{ position: "absolute", inset: 0, opacity: inOp }}>
        {/* elbow connectors between hexes */}
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          <path
            d="M393,575 V800 H590 M774,512 V330 H1000 M1179,580 V790 H1410 M1365,414 H1594 V480"
            fill="none"
            stroke={C.navy}
            strokeWidth={3}
            strokeDasharray={2400}
            strokeDashoffset={2400 * (1 - linesP)}
          />
        </svg>
        {NET_HEXES.map((hx) => (
          <div key={hx.art}>
            <div
              style={{
                position: "absolute",
                left: hx.cx - hx.w / 2,
                top: hx.cy - (hx.w * 0.906) / 2,
              }}
            >
              <TracedArt name={hx.art} scale={hx.w / 215} />
            </div>
          </div>
        ))}
        {docs.map((d, i) => {
          const op = lerp(f, [d.at, d.at + 8], [0, 1]);
          return <DocLabel key={i} {...d} opacity={op} />;
        })}
      </div>
      {wipe > 0 && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: C.white, opacity: wipe }} />
      )}
    </AbsoluteFill>
  );
};

const DocLabel: React.FC<{ label: string; x: number; y: number; opacity: number }> = ({
  label,
  x,
  y,
  opacity,
}) => {
  const { sans: SANS } = useBrand();
  if (opacity <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity }}>
      <svg width={78} height={96} viewBox="0 0 78 96">
        <path d="M2,2 H60 L76,18 V94 H2 Z" fill={C.white} stroke={C.navy} strokeWidth={2.5} strokeLinejoin="round" />
        <path d="M60,2 V18 H76" fill="none" stroke={C.navy} strokeWidth={2.5} />
        <text x={10} y={40} fontFamily={SANS} fontSize={15} fill={C.orangeDeep}>
          {label.split("\n").map((s, i) => (
            <tspan key={i} x={10} dy={i === 0 ? 0 : 16}>
              {s}
            </tspan>
          ))}
        </text>
      </svg>
    </div>
  );
};
