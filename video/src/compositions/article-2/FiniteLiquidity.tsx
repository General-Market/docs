import React from "react";
import { AbsoluteFill, useCurrentFrame, spring } from "remotion";
import {
  Stage,
  TrackBoard,
  BeatTitle,
  camAt,
  ci,
  clamp01,
  C,
  EASE,
  font,
  FPS,
  W,
  H,
  sec,
} from "./ThreeWallsTrack";
import { VcSource, VenueCard, MMChip, FlowStream, GovBox, type VenueState } from "./ThreeWallsPrimitives";

// Wall 2 · Finite Liquidity — the VC-subsidy treadmill, ridden left to right.
// The three market makers and the VC tap are screen-fixed: the SAME finite
// liquidity, always with us. The venues slide past on the board. VC funds the
// centred venue, the makers feed it, it pays a rebate back — then the camera
// glides right to the next, bigger raise and the venue we left busts behind us.
// Liquidity follows the money. Three cycles, a fast montage, then "2 years
// later": a venue is funded AND sealed by a government box, a challenger raises
// the biggest round yet — and this time the makers don't switch.

const DURATION = sec(22); // 1320

// ── venues on the board (left → right) ───────────────────────────────────────
const CY = 540;
interface V {
  x: number;
  name: string;
  raise: string;
  tvl: string;
  tint: string;
  montage?: boolean;
}
const VENUES: V[] = [
  { x: 1000, name: "Venue A", raise: "$20M", tvl: "$20M", tint: C.blue },
  { x: 2450, name: "Venue B", raise: "$55M", tvl: "$55M", tint: C.violet },
  { x: 3900, name: "Venue C", raise: "$140M", tvl: "$140M", tint: C.pink },
  { x: 5000, name: "D", raise: "", tvl: "", tint: "#17B0A6", montage: true },
  { x: 5750, name: "E", raise: "", tvl: "", tint: "#FF7A59", montage: true },
  { x: 6500, name: "F", raise: "", tvl: "", tint: "#9AB02A", montage: true },
  { x: 7250, name: "G", raise: "", tvl: "", tint: "#2BA6F0", montage: true },
];
const VF = { x: 8500, name: "Venue H", raise: "$400M", tvl: "$400M", tint: C.blue }; // the boxed survivor
const CHAL = { x: 9450, name: "Venue I", raise: "$900M", tint: "#7B5CFF" }; // the challenger that fails
const BOARD_W = 10200;

// camera rests on each real cycle, accelerates through the montage, settles on VF
const camera = (frame: number) =>
  camAt(
    frame,
    [
      { t: 0, x: VENUES[0].x, scale: 1 },
      { t: sec(3.0), x: VENUES[0].x, scale: 1 },
      { t: sec(4.2), x: VENUES[1].x, scale: 1 },
      { t: sec(6.6), x: VENUES[1].x, scale: 1 },
      { t: sec(7.8), x: VENUES[2].x, scale: 1 },
      { t: sec(10.0), x: VENUES[2].x, scale: 1 },
      { t: sec(14.2), x: VF.x, scale: 1 }, // montage glide → settle on VF
      { t: DURATION, x: VF.x, scale: 1 },
    ],
    EASE.inOut,
  );

// A venue's life is driven by where the camera is relative to it: dark before
// the camera reaches it, alive as it centres, bust once the camera moves on.
const venueLife = (camX: number, vx: number): { state: VenueState; centred: number; aura: number } => {
  const d = camX - vx;
  const centred = clamp01(1 - Math.abs(d) / 320);
  if (d < -360) return { state: "dark", centred, aura: 0 };
  if (d > 360) return { state: "bust", centred: 0, aura: 0 };
  const state: VenueState = centred > 0.45 ? "alive" : "funded";
  return { state, centred, aura: centred * 0.7 };
};

// screen-fixed actors
const VC_SCREEN = { x: W / 2, y: 150 };
const MM_SCREEN = [
  { x: W / 2 - 280, y: 905 },
  { x: W / 2, y: 905 },
  { x: W / 2 + 280, y: 905 },
];
const VENUE_SCREEN = { x: W / 2, y: 540 };

export const FiniteLiquidity: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camera(frame);

  // which venue is most centred, and how centred
  let active = -1;
  let activeCentred = 0;
  [...VENUES, VF].forEach((v, i) => {
    const c = clamp01(1 - Math.abs(cam.x - v.x) / 320);
    if (c > activeCentred) {
      activeCentred = c;
      active = i;
    }
  });
  const activeVenue = active >= 0 ? [...VENUES, VF][active] : null;

  // the 2-years-later beat: camera settled on VF
  const onVF = cam.x > VF.x - 200;
  const govDrop = spring({ frame: frame - sec(15.4), fps: FPS, config: { damping: 18, stiffness: 90 } });
  const chalPour = ci(frame, sec(17.0), sec(18.0), 0, 1);
  const chalAura = ci(frame, sec(17.0), sec(18.6), 0, 0.9);
  // the challenger's pull-lines reach for the makers and are rejected
  const pullActive = ci(frame, sec(18.4), sec(19.0), 0, 0.45) * ci(frame, sec(20.2), sec(21.0), 1, 0);

  // VC + maker streams feed the centred venue (screen space). Rebate flows back
  // only while the camera rests (high centredness). On VF the makers stay locked.
  const feed = activeCentred;
  const rebate = clamp01((activeCentred - 0.7) / 0.3);
  // escalating raise label by the active venue
  const raiseLabel = activeVenue?.raise || "";

  return (
    <Stage>
      <TrackBoard width={BOARD_W} cam={cam} spine={{ x1: 700, x2: BOARD_W - 600, y: CY }}>
        {/* the venues, sliding past */}
        {VENUES.map((v, i) => {
          const life = venueLife(cam.x, v.x);
          return (
            <VenueCard
              key={i}
              cx={v.x}
              cy={CY}
              state={life.state}
              aura={life.aura}
              tint={v.tint}
              name={v.montage ? undefined : v.name}
              tvl={v.montage ? undefined : v.tvl}
              w={v.montage ? 150 : 230}
              h={v.montage ? 104 : 156}
            />
          );
        })}

        {/* the survivor + its government box */}
        <VenueCard cx={VF.x} cy={CY} state={onVF ? "alive" : "dark"} aura={onVF ? 0.55 + 0.3 * (govDrop > 0.5 ? 1 : 0) : 0} tint={VF.tint} name={VF.name} tvl={VF.tvl} w={240} h={160} />
        {govDrop > 0.01 && <GovBox cx={VF.x} cy={CY} drop={govDrop} w={320} h={250} />}

        {/* the challenger to the right of VF — raises big, but is never fed */}
        <VenueCard cx={CHAL.x} cy={CY} state={chalAura > 0.4 ? "alive" : "funded"} aura={chalAura} tint={CHAL.tint} name={CHAL.name} tvl={CHAL.raise} w={230} h={156} />
      </TrackBoard>

      {/* ── screen-fixed actors + flows ─────────────────────────────────────── */}
      <AbsoluteFill>
        {/* VC pours into the centred venue */}
        <FlowStream from={{ x: VC_SCREEN.x, y: VC_SCREEN.y + 50 }} to={{ x: VENUE_SCREEN.x, y: VENUE_SCREEN.y - 80 }} active={feed} color="#E8A13A" count={7} speed={0.8} dotR={8} boardW={W} boardH={H} />
        {/* the three makers feed it */}
        {MM_SCREEN.map((m, i) => (
          <FlowStream key={i} from={{ x: m.x, y: m.y - 70 }} to={{ x: VENUE_SCREEN.x, y: VENUE_SCREEN.y + 80 }} active={feed} color={C.violet} count={5} speed={0.6} dotR={6} boardW={W} boardH={H} />
        ))}
        {/* rebate back to the makers while resting */}
        {MM_SCREEN.map((m, i) => (
          <FlowStream key={`r${i}`} from={{ x: VENUE_SCREEN.x, y: VENUE_SCREEN.y + 80 }} to={{ x: m.x, y: m.y - 70 }} active={rebate * 0.7} color={C.up} count={4} speed={0.7} dotR={6} boardW={W} boardH={H} />
        ))}

        {/* final beat: VC also pours into the challenger; makers refuse to switch */}
        {onVF && (
          <>
            <FlowStream from={{ x: VC_SCREEN.x, y: VC_SCREEN.y + 50 }} to={{ x: W - 220, y: VENUE_SCREEN.y - 80 }} active={chalPour} color="#E8A13A" count={9} speed={0.9} dotR={9} boardW={W} boardH={H} />
            {MM_SCREEN.map((m, i) => (
              <FlowStream key={`p${i}`} from={{ x: m.x, y: m.y - 70 }} to={{ x: W - 220, y: VENUE_SCREEN.y + 40 }} active={pullActive} color={C.violet} count={4} speed={0.9} dotR={6} boardW={W} boardH={H} />
            ))}
          </>
        )}

        {/* the VC tap, top */}
        <div style={{ position: "absolute", left: VC_SCREEN.x, top: VC_SCREEN.y, transform: "translate(-50%,-50%)" }}>
          <VcSource cx={0} cy={0} size={88} label="VC" amount={raiseLabel} />
        </div>

        {/* the three finite makers — fixed fill, never grow */}
        {MM_SCREEN.map((m, i) => (
          <MMChip key={`mm${i}`} cx={m.x} cy={m.y} fill={0.7} color={C.violet} h={120} label={`MM ${i + 1}`} amount="$10M" />
        ))}

        <CaptionSeq frame={frame} onVF={onVF} />
      </AbsoluteFill>

      {/* the "2 years later" title rides in as the camera settles on VF */}
      {frame >= sec(14.0) && <BeatTitle title="2 years later" delay={sec(14.2)} size={50} />}
    </Stage>
  );
};

const CaptionSeq: React.FC<{ frame: number; onVF: boolean }> = ({ frame }) => {
  const lines: { at: number; until: number; text: string }[] = [
    { at: sec(0.8), until: sec(3.0), text: "VC pays for the liquidity" },
    { at: sec(4.4), until: sec(6.6), text: "a bigger raise — the makers switch" },
    { at: sec(7.9), until: sec(9.9), text: "the one they left goes bust" },
    { at: sec(10.4), until: sec(13.6), text: "again, and again, and again" },
    { at: sec(15.6), until: sec(17.0), text: "this one is protected" },
    { at: sec(18.8), until: sec(21.4), text: "the challenger raises more — the makers stay" },
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

export const finiteLiquidityMeta = {
  id: "FiniteLiquidity",
  component: FiniteLiquidity,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
