import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  Stage,
  TrackBoard,
  BeatTitle,
  camAt,
  ci,
  clamp01,
  commas,
  C,
  EASE,
  font,
  monoFont,
  FPS,
  W,
  H,
  sec,
} from "./ThreeWallsTrack";
import { GridWall, ShatterBurst, FlowStream, TraderChip, heatColor } from "./ThreeWallsPrimitives";

// Wall 1 · Technical Overload — one matching engine drawn as a wall of order
// books. The camera holds tight on a calm green panel that keeps up with a
// trader's orders, then pulls all the way back: that panel was one tile in a
// wall of a billion books. Everyone trades at once, the wall reddens cell by
// cell, and it shatters. The throughput ceiling, made physical. The wall rides
// the camera; the actors and the readout are screen-space HUD.

const DURATION = sec(11); // 660

// ── the wall, in board coordinates ──────────────────────────────────────────
const COLS = 40;
const ROWS = 24;
const TILE = 120;
const GAP = 3;
const WALL_W = COLS * TILE + (COLS - 1) * GAP; // 4917
const WALL_H = ROWS * TILE + (ROWS - 1) * GAP; // 2949
const CXB = WALL_W / 2;
const CYB = WALL_H / 2;

const TIGHT = 6.5; // one panel fills the frame
const WIDE = 0.34; // the whole wall fits, with a margin

// ── beats (frames) ──────────────────────────────────────────────────────────
const B = {
  holdEnd: sec(2.4), // 144 — tight on the calm panel
  pullEnd: sec(6.0), // 360 — pulled all the way out
  loadEnd: sec(9.0), // 540 — parallel fire reddens it
  // 540–660: shatter
};

const camera = (frame: number) =>
  camAt(
    frame,
    [
      { t: 0, x: CXB, y: CYB, scale: TIGHT },
      { t: B.holdEnd, x: CXB, y: CYB, scale: TIGHT },
      { t: B.pullEnd, x: CXB, y: CYB, scale: WIDE },
      { t: DURATION, x: CXB, y: CYB, scale: WIDE * 1.04 },
    ],
    EASE.inOut,
  );

// ── the top readout — the green light and the live count ────────────────────
const Readout: React.FC<{ frame: number }> = ({ frame }) => {
  const op = ci(frame, sec(0.4), sec(1.0), 0, 1) * ci(frame, B.loadEnd + sec(0.3), B.loadEnd + sec(0.8), 1, 0);
  if (op <= 0.01) return null;
  const count = ci(frame, B.holdEnd, B.pullEnd, 100000, 1_000_000_000, EASE.inOut);
  const heat = clamp01(ci(frame, B.pullEnd, B.loadEnd, 0, 1));
  const dot = heat < 0.5 ? C.up : heatColor(heat);
  const status = heat < 0.15 ? "OK" : heat < 0.8 ? "STRAINING" : "OVERLOAD";
  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: op,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 18,
          padding: "16px 34px",
          borderRadius: 999,
          background: "linear-gradient(160deg, rgba(255,255,255,0.78), rgba(255,255,255,0.55))",
          border: "1px solid rgba(255,255,255,0.75)",
          boxShadow: "0 18px 44px rgba(58,62,130,0.22), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            background: dot,
            boxShadow: `0 0 16px ${dot}`,
          }}
        />
        <span style={{ fontFamily: font, fontSize: 40, fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
          {commas(count)}
        </span>
        <span style={{ fontFamily: monoFont, fontSize: 21, fontWeight: 700, color: C.dim, letterSpacing: "0.04em" }}>
          ORDER BOOKS
        </span>
        <span style={{ fontFamily: font, fontSize: 21, fontWeight: 800, color: dot, letterSpacing: "0.02em" }}>
          · {status}
        </span>
      </div>
    </div>
  );
};

export const TechnicalOverload: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camera(frame);

  const heat = clamp01(ci(frame, B.pullEnd, B.loadEnd, 0, 1));
  const wallOpacity = ci(frame, B.loadEnd, B.loadEnd + sec(0.2), 1, 0);
  const breakT = frame >= B.loadEnd ? (frame - B.loadEnd) / FPS : 0;

  // The single trader firing into the calm panel (tight beat), screen space.
  const tightFire = ci(frame, sec(0.7), sec(1.0), 0, 1) * ci(frame, B.holdEnd, B.holdEnd + sec(0.4), 1, 0);
  // The three traders firing in parallel (load beat), screen space.
  const loadFire = ci(frame, B.pullEnd - sec(0.4), B.pullEnd + sec(0.4), 0, 1) * ci(frame, B.loadEnd - sec(0.1), B.loadEnd, 1, 0);

  const center = { x: W / 2, y: H / 2 + 30 };
  const threeTraders = [
    { x: 250, y: 300, label: "T1", color: C.blue },
    { x: 250, y: 800, label: "T2", color: "#FF7A59" },
    { x: 1670, y: 540, label: "T3", color: "#7B5CFF" },
  ];

  return (
    <Stage>
      <TrackBoard width={WALL_W} height={WALL_H} cam={cam}>
        <div style={{ opacity: wallOpacity }}>
          <GridWall x={0} y={0} cols={COLS} rows={ROWS} tile={TILE} gap={GAP} heat={heat} cellPitch={8} seed={11} />
        </div>
        <ShatterBurst cx={CXB} cy={CYB} spreadW={WALL_W} spreadH={WALL_H} t={breakT} count={150} seed={313} />
      </TrackBoard>

      {/* screen-space HUD */}
      <AbsoluteFill>
        <Readout frame={frame} />

        {/* tight beat — one trader feeding the calm panel */}
        {tightFire > 0.01 && (
          <>
            <FlowStream from={{ x: 360, y: H / 2 }} to={center} active={tightFire} color={C.up} count={6} speed={0.9} dotR={11} boardW={W} boardH={H} />
            <div style={{ opacity: tightFire }}>
              <TraderChip cx={300} cy={H / 2} label="T" name="Trader" color={C.blue} size={96} />
            </div>
          </>
        )}

        {/* load beat — three traders firing in parallel */}
        {loadFire > 0.01 && (
          <div style={{ opacity: loadFire }}>
            {threeTraders.map((t) => (
              <FlowStream
                key={t.label}
                from={{ x: t.x + (t.x < W / 2 ? 70 : -70), y: t.y }}
                to={center}
                active={loadFire}
                color={heatColor(clamp01(heat))}
                count={7}
                speed={1.2}
                dotR={9}
                boardW={W}
                boardH={H}
              />
            ))}
            {threeTraders.map((t) => (
              <TraderChip key={`c-${t.label}`} cx={t.x} cy={t.y} label={t.label} color={t.color} size={84} />
            ))}
          </div>
        )}

        {/* one bottom caption at a time, across all beats */}
        <CaptionSeq frame={frame} />
      </AbsoluteFill>

      {/* the verdict slams in on the break */}
      {breakT > 0 && (
        <BeatTitle title="One engine can't hold them all" delay={B.loadEnd + sec(0.3)} size={52} />
      )}
    </Stage>
  );
};

// The lower captions across the pull-back and load beats. One line at a time.
const CaptionSeq: React.FC<{ frame: number }> = ({ frame }) => {
  const lines: { at: number; until: number; text: string }[] = [
    { at: sec(1.0), until: B.holdEnd + sec(0.2), text: "100,000 markets — the engine keeps up" },
    { at: B.holdEnd + sec(0.35), until: B.pullEnd - sec(0.2), text: "every market needs its own book" },
    { at: B.pullEnd + sec(0.2), until: B.loadEnd - sec(0.2), text: "now everyone trades at once" },
  ];
  const active = lines.find((l) => frame >= l.at && frame < l.until);
  if (!active) return null;
  const op = ci(frame, active.at, active.at + sec(0.25), 0, 1) * ci(frame, active.until - sec(0.25), active.until, 1, 0);
  const y = ci(frame, active.at, active.at + sec(0.3), 14, 0, EASE.out);
  return (
    <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: op, transform: `translateY(${y.toFixed(1)}px)` }}>
      <div
        style={{
          padding: "15px 36px",
          borderRadius: 999,
          background: "linear-gradient(160deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.48) 100%)",
          border: "1px solid rgba(255,255,255,0.72)",
          boxShadow: "0 18px 44px rgba(58,62,130,0.24), inset 0 1px 0 rgba(255,255,255,0.9)",
          fontFamily: font,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: C.text,
        }}
      >
        {active.text}
      </div>
    </div>
  );
};

export const technicalOverloadMeta = {
  id: "TechnicalOverload",
  component: TechnicalOverload,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
