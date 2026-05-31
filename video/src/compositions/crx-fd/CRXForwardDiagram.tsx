import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  beatArrival,
  beatDepart,
  BeatKey,
  C,
  cameraAt,
  cellCenter,
  cellOrigin,
  EASE,
  FIELD_BG,
  font,
  FPS,
  H,
  monoFont,
  sec,
  TOTAL_FRAMES,
  W,
} from "./theme";
import {
  Arrow,
  BrokerTile,
  BusinessTile,
  ClickBurst,
  CRXCorner,
  CRXLockup,
  Cursor,
  FlowBox,
  glass,
  Kicker,
  place,
  Speech,
  VolatilityChart,
} from "./parts";
import { Bloom, breathe, clamp01, flash, lerp, pop, punchAt, RingPop } from "./motion";

// centred slot on the cell
const At: React.FC<{ x: number; y: number; z?: number; scale?: number; children: React.ReactNode }> = ({ x, y, z, scale = 1, children }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${scale.toFixed(3)})`, zIndex: z }}>{children}</div>
);

const Op: React.FC<{ ch: string; x: number; y: number }> = ({ ch, x, y }) => (
  <div style={{ ...place(x, y), fontFamily: font, fontSize: 64, fontWeight: 800, color: C.teal }}>{ch}</div>
);

const ArrowDefs: React.FC = () => (
  <defs>
    <marker id="crx-arrow" markerWidth="11" markerHeight="11" refX="7" refY="5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M1,1 L8,5 L1,9" fill="none" stroke={C.teal} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </marker>
  </defs>
);

const Cell: React.FC<{ keyName: BeatKey; children: React.ReactNode }> = ({ keyName, children }) => {
  const [ox, oy] = cellOrigin(keyName);
  return <div style={{ position: "absolute", left: ox, top: oy, width: W, height: H }}>{children}</div>;
};

// ── BEAT 1 — three businesses, all wanting a deliverable forward ───────────────
const WantBeat: React.FC<{ frame: number }> = ({ frame }) => {
  const at = beatArrival("want");
  const f = breathe(frame, 150, 5);
  return (
    <Cell keyName="want">
      <At x={W / 2} y={120}>
        <Kicker text="WHO NEEDS THIS" color={C.teal} />
      </At>
      <At x={W / 2} y={250}>
        <div style={{ fontFamily: font, fontSize: 36, fontWeight: 700, color: C.dim }}>Businesses that get paid in foreign currency</div>
      </At>
      {(["ship", "factory", "plane"] as const).map((k, i) => (
        <At key={k} x={420 + i * 540} y={620} scale={pop(frame, at + i * 4)}>
          <div style={{ transform: `translateY(${(f * (i % 2 ? -1 : 1)).toFixed(1)}px)` }}>
            <BusinessTile kind={k} size={196} accent={C.teal} />
          </div>
        </At>
      ))}
      <At x={W / 2} y={900}>
        <Speech text="We want a Deliverable Forward — lock our rate" accent={C.text} w={760} align="left" />
      </At>
    </Cell>
  );
};

// ── BEAT 2 — the old way: hedge with spot, but spot drifts (made clear) ────────
const HedgeBeat: React.FC<{ frame: number }> = ({ frame }) => {
  const at = beatArrival("hedge");
  return (
    <Cell keyName="hedge">
      <At x={W / 2} y={110}>
        <Kicker text="THE OLD WAY" />
      </At>
      <At x={300} y={420} scale={pop(frame, at)}>
        <BrokerTile size={188} />
      </At>
      {/* broker sells the FD, then must hold a spot hedge while price moves */}
      <At x={300} y={600}>
        <div style={{ fontFamily: font, fontSize: 28, fontWeight: 700, color: C.dim, width: 320, textAlign: "center" }}>
          The broker locks your rate, then hedges in spot
        </div>
      </At>
      <Bloom x={1130} y={520} r={300} color={C.badSoft} op={0.4 + 0.25 * flash(frame, at + sec(0.4), 60)} />
      <At x={1130} y={500} scale={pop(frame, at + 6)}>
        <div style={{ ...glass(22), padding: "26px 30px 18px" }}>
          <VolatilityChart draw={1} w={560} h={330} />
        </div>
      </At>
      <At x={1130} y={840}>
        <div style={{ ...glass(16), padding: "16px 30px", border: `1.5px solid ${C.bad}55`, fontFamily: font, fontSize: 28, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 10 }}>
          Spot drifts from the locked rate → the broker eats the
          <span style={{ color: C.bad, fontWeight: 800 }}>volatility</span>
        </div>
      </At>
    </Cell>
  );
};

// ── BEAT 3 — the problem: expensive FD ─────────────────────────────────────────
const ExpensiveBeat: React.FC<{ frame: number }> = ({ frame }) => {
  const at = beatArrival("expensive");
  const stamp = at + sec(0.4);
  return (
    <Cell keyName="expensive">
      <At x={W / 2} y={120}>
        <Kicker text="THE PROBLEM" color={C.bad} />
      </At>
      <At x={430} y={600} scale={pop(frame, at)}>
        <BusinessTile kind="factory" size={188} mood="sad" accent={C.bad} />
      </At>
      <At x={830} y={400}>
        <Speech text="Too expensive!" accent={C.bad} w={360} align="left" />
      </At>
      <Bloom x={1280} y={540} r={340} color={C.badSoft} op={0.45 + 0.3 * flash(frame, stamp, 50)} />
      <RingPop x={1280} y={540} local={frame - stamp} color={C.bad} max={3.2} />
      <At x={1280} y={540} z={5} scale={pop(frame, stamp, 0.07)}>
        <FlowBox title="Expensive FD" sub="FAT VOLATILITY PREMIUM" accent={C.bad} w={500} h={200} big glow />
      </At>
      <At x={1650} y={840} scale={pop(frame, at + 8)}>
        <BrokerTile size={150} />
      </At>
    </Cell>
  );
};

// ── BEAT 4 — the CRX way: Spot + NDF = Cheap FD (clicked into being) ───────────
const CrxBeat: React.FC<{ frame: number }> = ({ frame }) => {
  const at = beatArrival("crx");
  const click = at + sec(1.4);
  const glow = 0.5 + 0.5 * Math.max(0, breathe(frame, 90, 1));
  return (
    <Cell keyName="crx">
      <At x={W / 2} y={108}>
        <Kicker text="THE CRX WAY" color={C.teal} />
      </At>
      <At x={620} y={340} scale={pop(frame, at)}>
        <FlowBox title="Spot" accent={C.text} w={420} h={130} />
      </At>
      <Op ch="+" x={620} y={452} />
      <At x={620} y={560} scale={pop(frame, at + 5)}>
        <FlowBox title="Non-Delivery Forward" sub="NDF · LOCKED RATE" accent={C.teal} w={460} h={140} />
      </At>
      <Op ch="=" x={620} y={684} />
      <Bloom x={620} y={820} r={320} color={C.goodSoft} op={0.4 + 0.4 * flash(frame, click, 50)} />
      <RingPop x={620} y={820} local={frame - click} color={C.good} max={3.0} />
      <At x={620} y={820} z={5} scale={pop(frame, click, 0.08)}>
        <FlowBox title="Cheap Deliverable Forward" accent={C.good} w={520} h={150} glow big />
      </At>
      {/* CRX engine */}
      <Bloom x={1380} y={500} r={320} color={C.tealSoft} op={0.4 + 0.35 * glow} />
      <At x={1380} y={500} scale={pop(frame, at + 10)}>
        <div
          style={{
            ...glass(28),
            padding: "48px 58px",
            border: `2.5px solid ${C.tealBright}`,
            boxShadow: `0 22px 60px ${C.teal}40, 0 0 ${(50 + 50 * glow).toFixed(0)}px ${C.teal}44, inset 0 1px 0 rgba(255,255,255,0.88)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <CRXLockup size={96} />
          <div style={{ fontFamily: font, fontSize: 28, fontWeight: 700, color: C.dim, textAlign: "center", maxWidth: 380, lineHeight: 1.2 }}>
            CRX manufactures the cheap half — the NDF.
          </div>
        </div>
      </At>
    </Cell>
  );
};

// ── BEAT 5 — the effect: the business wants more ───────────────────────────────
const HappyBeat: React.FC<{ frame: number }> = ({ frame }) => {
  const at = beatArrival("happy");
  const b = Math.max(0, breathe(frame, 46, 9));
  return (
    <Cell keyName="happy">
      <At x={W / 2} y={130}>
        <Kicker text="THE EFFECT" color={C.good} />
      </At>
      <At x={420} y={620} scale={pop(frame, at)}>
        <div style={{ transform: `translateY(${(-b).toFixed(1)}px)` }}>
          <BusinessTile kind="factory" size={196} mood="happy" accent={C.good} />
        </div>
      </At>
      <At x={840} y={380}>
        <Speech text="I want more !!!" accent={C.good} w={360} align="left" />
      </At>
      <Bloom x={1290} y={560} r={280} color={C.goodSoft} op={0.4 + 0.3 * flash(frame, at + sec(0.4), 50)} />
      <At x={1290} y={560} scale={pop(frame, at + 6, 0.07)}>
        <FlowBox title="Cheap FD" accent={C.good} w={400} h={160} glow big />
      </At>
      <At x={1660} y={780} scale={pop(frame, at + 10)}>
        <BrokerTile size={150} />
      </At>
    </Cell>
  );
};

// ── BEAT 6 — before / after ────────────────────────────────────────────────────
const Stat: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <div style={{ fontFamily: font, fontSize: 30, fontWeight: 700, color, lineHeight: 1.35 }}>{text}</div>
);

const ResultBeat: React.FC<{ frame: number }> = ({ frame }) => {
  const at = beatArrival("result");
  const after = at + sec(0.5);
  return (
    <Cell keyName="result">
      <At x={W / 2} y={140}>
        <CRXLockup size={64} />
      </At>
      <At x={540} y={620} scale={pop(frame, at)}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <BrokerTile size={156} label={false} />
          <div style={{ ...glass(18), padding: "24px 40px", border: `1.5px solid ${C.bad}55`, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
            <div style={{ fontFamily: monoFont, fontSize: 24, fontWeight: 700, letterSpacing: "0.14em", color: C.bad }}>BEFORE</div>
            <Stat text="More costs" color={C.text} />
            <Stat text="Bad rates" color={C.bad} />
          </div>
        </div>
      </At>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <ArrowDefs />
        <Arrow x1={760} y1={620} x2={1130} y2={620} color={C.teal} draw={1} width={4} />
      </svg>
      <Bloom x={1380} y={620} r={340} color={C.goodSoft} op={0.4 + 0.35 * flash(frame, after, 50)} />
      <RingPop x={1380} y={560} local={frame - after} color={C.good} max={3.0} />
      <At x={1380} y={620} z={5} scale={pop(frame, after, 0.07)}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <BrokerTile size={156} label={false} />
          <div style={{ ...glass(18), padding: "24px 40px", border: `2.5px solid ${C.good}`, boxShadow: `0 16px 40px ${C.good}33, inset 0 1px 0 rgba(255,255,255,0.88)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
            <div style={{ fontFamily: monoFont, fontSize: 24, fontWeight: 700, letterSpacing: "0.14em", color: C.good }}>AFTER</div>
            <Stat text="More profit" color={C.text} />
            <Stat text="Competitive rates" color={C.good} />
          </div>
        </div>
      </At>
    </Cell>
  );
};

// ── board connectors — the snake the camera follows, faint, drawn once ────────
const SNAKE: BeatKey[] = ["want", "hedge", "expensive", "crx", "happy", "result"];
const BoardConnectors: React.FC = () => (
  <svg width={5760} height={2160} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
    {SNAKE.slice(0, -1).map((k, i) => {
      const [ax, ay] = cellCenter(k);
      const [bx, by] = cellCenter(SNAKE[i + 1]);
      return <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke="rgba(15,175,168,0.16)" strokeWidth={4} strokeDasharray="3 16" strokeLinecap="round" />;
    })}
  </svg>
);

// ── the travelling token — the deliverable-forward contract, riding the snake ─
const Token: React.FC<{ frame: number }> = ({ frame }) => {
  // find the active transition window
  for (let i = 0; i < SNAKE.length - 1; i++) {
    const depart = beatDepart(SNAKE[i]);
    const arrive = beatArrival(SNAKE[i + 1]);
    if (frame >= depart && frame <= arrive) {
      const t = clamp01((frame - depart) / (arrive - depart));
      const e = EASE.inOut(t);
      const [ax, ay] = cellCenter(SNAKE[i]);
      const [bx, by] = cellCenter(SNAKE[i + 1]);
      const x = lerp(ax, bx, e);
      const y = lerp(ay, by, e);
      const op = clamp01(t / 0.18) * clamp01((1 - t) / 0.18);
      const tilt = Math.sin(e * Math.PI * 2) * 7; // a gentle wobble — stays readable
      return (
        <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) rotate(${tilt.toFixed(1)}deg)`, opacity: op }}>
          <div style={{ ...glass(16), width: 96, height: 64, border: `2.5px solid ${C.teal}`, boxShadow: `0 0 30px ${C.teal}55`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontSize: 34, fontWeight: 800, color: C.teal }}>FD</div>
        </div>
      );
    }
  }
  return null;
};

// ── the cursor moment (screen space — valid while the camera sits on CRX) ─────
// when the camera is settled on a cell at scale 1, board→screen maps cell-local
// coords straight to viewport coords, so we can target the box in cell space.
const CRX_CLICK = beatArrival("crx") + sec(1.4);
const CURSOR_IN = beatArrival("crx") + sec(0.5);
const CHEAP_XY: [number, number] = [620, 820];

const CursorMoment: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <ClickBurst frame={frame} at={CRX_CLICK} xy={CHEAP_XY} color={C.good} />
    <Cursor frame={frame} inFrom={CURSOR_IN} clickAt={CRX_CLICK} fromXY={[1380, 520]} toXY={CHEAP_XY} />
  </>
);

export const CRXForwardDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = cameraAt(frame);
  const punch = punchAt(frame, CRX_CLICK, 0.045, 11);
  const eff = cam.scale * punch.scale;
  const tx = W / 2 - cam.fx * eff + punch.sx;
  const ty = H / 2 - cam.fy * eff + punch.sy;

  return (
    <AbsoluteFill style={{ background: FIELD_BG, fontFamily: font }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 50% -10%, rgba(28,200,198,0.12) 0%, transparent 55%)", pointerEvents: "none" }} />
      <CRXCorner />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 5760,
          height: 2160,
          transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${eff.toFixed(5)})`,
          transformOrigin: "0 0",
          willChange: "transform",
          background: FIELD_BG,
          backgroundImage: "radial-gradient(circle, rgba(15,175,168,0.30) 1.7px, transparent 2px)",
          backgroundSize: "26px 26px",
        }}
      >
        <BoardConnectors />
        <WantBeat frame={frame} />
        <HedgeBeat frame={frame} />
        <ExpensiveBeat frame={frame} />
        <CrxBeat frame={frame} />
        <HappyBeat frame={frame} />
        <ResultBeat frame={frame} />
        <Token frame={frame} />
      </div>
      <CursorMoment frame={frame} />
    </AbsoluteFill>
  );
};

export const crxForwardDiagramMeta = {
  id: "CRXForwardDiagram",
  component: CRXForwardDiagram,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
