import React from "react";
import { AbsoluteFill, useCurrentFrame, spring } from "remotion";
import {
  Stage,
  TrackBoard,
  BeatTitle,
  camAt,
  ci,
  C,
  EASE,
  font,
  FPS,
  W,
  H,
  sec,
  type FaceState,
} from "./ThreeWallsTrack";
import {
  TraderChip,
  MMChip,
  FlowStream,
  BarTail,
  barTailLayout,
  GeneralLayer,
  type BarTailParams,
} from "./ThreeWallsPrimitives";

// Wall 3 · Asphyxiation by Winners — ridden along the long tail.
// Given free choice, traders crowd the same three winner markets; the long tail
// starves while the maker collects. The camera holds tight on the winners, then
// slides right along the dead tail to show how long it runs — then pulls back to
// the whole board as the General layer forces breadth across every market and
// the money flows back to the traders. Everything lives on the board and rides
// the camera; no cuts.

const DURATION = sec(16); // 960
const BOARD_W = 3600;

const PARAMS: BarTailParams = {
  n: 28,
  baselineY: 720,
  startX: 480,
  barW: 70,
  gap: 24,
  maxH: 480,
  decay: 0.42,
};
const BARS = barTailLayout(PARAMS);
const WINNERS = [0, 1, 2];

const TRADER_A = { x: 250, y: 300 };
const TRADER_B = { x: 250, y: 540 };
const MM = { x: 3380, y: 470 };

// ── beats (frames) ──────────────────────────────────────────────────────────
const B = {
  grow: sec(1.0),
  crowdIn: sec(3.0),
  panEnd: sec(5.0), // slid along the tail
  wideEnd: sec(7.0), // pulled back to the whole board
  harvestEnd: sec(9.0), // money back to the maker
  sweepEnd: sec(11.0), // General layer sealed
  fanEnd: sec(13.0), // forced across all bars
  // 13–16: money back to traders, hold
};

const camera = (frame: number) =>
  camAt(
    frame,
    [
      { t: 0, x: 600, scale: 1.4 },
      { t: B.crowdIn, x: 600, scale: 1.4 },
      { t: B.panEnd, x: 1850, scale: 1.22 }, // slide right along the tail
      { t: B.wideEnd, x: 1800, scale: 0.52 }, // pull back to the whole board
      { t: DURATION, x: 1800, scale: 0.52 },
    ],
    EASE.inOut,
  );

export const AsphyxiationByWinners: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camera(frame);

  const reveal = spring({ frame: frame - B.grow, fps: FPS, config: { damping: 16, mass: 0.9, stiffness: 90 }, durationInFrames: 60 });

  // crowd the 3 winners
  const crowd = ci(frame, B.crowdIn - sec(1.0), B.crowdIn, 0, 1, EASE.out) * ci(frame, B.harvestEnd - sec(2.0), B.harvestEnd - sec(1.4), 1, 0);
  const winnerHighlight = frame >= B.crowdIn - sec(1.0) ? 3 : 0;

  // money flows back to the maker
  const harvest = ci(frame, B.wideEnd - sec(0.5), B.wideEnd + sec(0.5), 0, 1) * ci(frame, B.harvestEnd, B.harvestEnd + sec(0.6), 1, 0);
  const mmFill = ci(frame, B.wideEnd, B.harvestEnd, 0.4, 0.95);

  // the General layer sweeps the whole tail
  const sweep = ci(frame, B.harvestEnd + sec(0.3), B.sweepEnd, 0, 1, EASE.out);

  // forced breadth — fan to ALL bars
  const fanOut = ci(frame, B.sweepEnd, B.sweepEnd + sec(1.0), 0, 1, EASE.out) * ci(frame, B.fanEnd, B.fanEnd + sec(0.6), 1, 0);
  const breadthHighlight = frame >= B.sweepEnd + sec(0.5) ? BARS.length : winnerHighlight;

  // money flows back to the traders
  const payback = ci(frame, B.fanEnd, B.fanEnd + sec(1.0), 0, 1);
  const mmSettle = ci(frame, B.sweepEnd, B.fanEnd + sec(0.5), 0.95, 0.6);

  // faces
  const traderFace: FaceState =
    frame >= B.fanEnd ? "happy" : frame >= B.sweepEnd ? "neutral" : frame >= B.wideEnd ? "unhappy" : "happy";
  const mmFace: FaceState = frame >= B.fanEnd ? "neutral" : "neutral";
  const reservoir = frame >= B.sweepEnd ? mmSettle : mmFill;
  const showFaces = frame >= B.wideEnd - sec(0.5);

  return (
    <Stage>
      <TrackBoard width={BOARD_W} cam={cam}>
        {/* the long-tail bar graph */}
        <BarTail params={PARAMS} reveal={reveal} highlight={frame >= B.sweepEnd ? breadthHighlight : winnerHighlight} />

        {/* winner pulse glow */}
        {frame >= B.crowdIn - sec(1.0) && frame < B.harvestEnd
          ? WINNERS.map((i) => {
              const b = BARS[i];
              const r = 36 * (1 + 0.06 * Math.sin((frame - B.crowdIn) / 7));
              return (
                <div
                  key={`pulse-${i}`}
                  style={{
                    position: "absolute",
                    left: b.cx - r,
                    top: b.topY - r,
                    width: r * 2,
                    height: r * 2,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(94,120,255,0.35) 0%, rgba(94,120,255,0) 70%)",
                    pointerEvents: "none",
                  }}
                />
              );
            })
          : null}

        {/* General layer over the whole bar region */}
        <GeneralLayer x={PARAMS.startX - 40} y={180} w={BARS[BARS.length - 1].cx - PARAMS.startX + 120} h={580} sweep={sweep} />

        {/* crowd the winners */}
        {WINNERS.map((i) => (
          <FlowStream key={`ca-${i}`} from={TRADER_A} to={{ x: BARS[i].cx, y: BARS[i].topY }} active={crowd} color={C.blue} count={5} speed={0.7} boardW={BOARD_W} />
        ))}
        {WINNERS.map((i) => (
          <FlowStream key={`cb-${i}`} from={TRADER_B} to={{ x: BARS[i].cx, y: BARS[i].topY }} active={crowd} color="#FF7A59" count={5} speed={0.7} boardW={BOARD_W} />
        ))}
        {WINNERS.map((i) => (
          <FlowStream key={`cm-${i}`} from={MM} to={{ x: BARS[i].cx, y: BARS[i].topY }} active={crowd} color={C.violet} count={5} speed={0.7} boardW={BOARD_W} />
        ))}

        {/* money flows back to the maker */}
        {WINNERS.map((i) => (
          <FlowStream key={`h-${i}`} from={{ x: BARS[i].cx, y: BARS[i].topY }} to={MM} active={harvest} color={C.violet} count={6} speed={0.8} boardW={BOARD_W} />
        ))}

        {/* forced breadth — fan to ALL bars */}
        {BARS.map((b, i) => (
          <FlowStream key={`fa-${i}`} from={TRADER_A} to={{ x: b.cx, y: b.topY }} active={fanOut} color={C.blue} count={3} speed={0.9} dotR={5} boardW={BOARD_W} />
        ))}
        {BARS.map((b, i) => (
          <FlowStream key={`fb-${i}`} from={TRADER_B} to={{ x: b.cx, y: b.topY }} active={fanOut} color="#FF7A59" count={3} speed={0.9} dotR={5} boardW={BOARD_W} />
        ))}

        {/* money flows back to the traders */}
        {BARS.map((b, i) => (
          <FlowStream key={`pa-${i}`} from={{ x: b.cx, y: b.topY }} to={TRADER_A} active={payback} color={C.blue} count={3} speed={0.85} dotR={5} boardW={BOARD_W} />
        ))}
        {BARS.map((b, i) => (
          <FlowStream key={`pb-${i}`} from={{ x: b.cx, y: b.topY }} to={TRADER_B} active={payback} color="#FF7A59" count={3} speed={0.85} dotR={5} boardW={BOARD_W} />
        ))}

        {/* the actors, on top — sized to stay readable when the camera pulls back */}
        <TraderChip cx={TRADER_A.x} cy={TRADER_A.y} label="T1" name="Trader 1" color={C.blue} size={120} face={showFaces ? traderFace : undefined} />
        <TraderChip cx={TRADER_B.x} cy={TRADER_B.y} label="T2" name="Trader 2" color="#FF7A59" size={120} face={showFaces ? traderFace : undefined} />
        <MMChip cx={MM.x} cy={MM.y} fill={reservoir} color={C.violet} face={showFaces ? mmFace : undefined} h={184} label="Maker" amount="$" />
      </TrackBoard>

      {/* titles + captions */}
      <AbsoluteFill>
        <CaptionSeq frame={frame} />
      </AbsoluteFill>
      {frame >= B.fanEnd - sec(0.3) && <BeatTitle title="Forced to spread — the traders win" delay={B.fanEnd} size={48} />}
    </Stage>
  );
};

const CaptionSeq: React.FC<{ frame: number }> = ({ frame }) => {
  const lines: { at: number; until: number; text: string }[] = [
    { at: sec(1.4), until: B.crowdIn + sec(0.0), text: "free choice — traders crowd the winners" },
    { at: B.panEnd - sec(1.6), until: B.wideEnd - sec(0.4), text: "the long tail gets nothing" },
    { at: B.wideEnd + sec(0.2), until: B.harvestEnd, text: "the maker collects — traders unhappy" },
    { at: B.harvestEnd + sec(0.4), until: B.sweepEnd, text: "General forces trade across all markets" },
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

export const asphyxiationByWinnersMeta = {
  id: "AsphyxiationByWinners",
  component: AsphyxiationByWinners,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
