import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

/*
 * Rainbows · Flashblocks — SFX track v4 (one sound per kind of thing)
 *
 * The score uses a fixed palette. Same kind of event gets the same
 * sample, every time. Repetition is what makes it feel like music.
 * Volumes are calibrated so the layers stack without smearing.
 *
 *   WORD          mouse-click     0.18  every word reveal, anywhere
 *   EMPHASIS      sharp-pop       0.50  numbers, knife words, "gain"
 *   WHOOSH        sharp-fast-…    0.45  scene/phase transitions
 *   AMBIENT       long-whoosh     0.25  conveyor sweep, orbit drone
 *   CONVEYOR TICK low-pop         0.10  each version (v1→v10,000)
 *   SHAPE/BOX     low-pop         0.30  cube boxes, morph shapes
 *   RING          select-001      0.18  every concentric ring
 *   COUNTER TICK  digital-click   0.18  counter ramp 0→70
 *   SHOT          sharp-clap      0.65  sniper gunshot
 *   DETONATE      sharp-pop       0.45  sniper impact
 *   LOCK-ON       select-002      0.28  reticle pre-shot
 *   PAYOFF        obtain-002      0.55  v10,000 lands, endcard reveal
 *   COUNTER PAYOFF obtain-001     0.50  counter scale-up
 *   WIPE          epic-fast-whoosh 0.65  square wipe at finale
 *
 * 24fps, 0–756 frames.
 */

const sfx = (name: string) => staticFile(`sfx/mx6/${name}`);

const FILES = {
  word: "mouse-click.mp3",
  emphasis: "sharp-pop.mp3",
  whoosh: "sharp-fast-whoosh.mp3",
  ambient: "long-whoosh-001.mp3",
  conveyorTick: "low-pop.mp3",
  shape: "low-pop.mp3",
  ring: "select-001.mp3",
  counterTick: "digital-click.mp3",
  shot: "sharp-clap.mp3",
  detonate: "sharp-pop.mp3",
  lockOn: "select-002.mp3",
  payoff: "obtain-002.mp3",
  counterPayoff: "obtain-001.mp3",
  wipe: "epic-fast-whoosh.mp3",
};

interface CueProps {
  from: number;
  src: string;
  volume?: number;
  trimAfter?: number;
  /* Sequence window length. Without it, every Audio mounts at `from`
   * and stays mounted to the end of the composition — Remotion caps at
   * 40 simultaneous tags and we hit the cap fast. */
  dur?: number;
}

const Cue: React.FC<CueProps> = ({ from, src, volume = 0.5, trimAfter, dur = 18 }) => (
  <Sequence from={from} durationInFrames={dur} layout="none">
    <Audio src={src} volume={volume} trimAfter={trimAfter} />
  </Sequence>
);

/* Helpers — one component per role keeps the rules visible. */
const Word: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(FILES.word)} volume={0.18} dur={12} />
);
const Emphasis: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(FILES.emphasis)} volume={0.5} dur={14} />
);
const Whoosh: React.FC<{ from: number; volume?: number; dur?: number }> = ({
  from,
  volume = 0.45,
  dur = 18,
}) => <Cue from={from} src={sfx(FILES.whoosh)} volume={volume} dur={dur} />;
const Ambient: React.FC<{ from: number; volume?: number; dur: number }> = ({
  from,
  volume = 0.25,
  dur,
}) => (
  <Cue from={from} src={sfx(FILES.ambient)} volume={volume} trimAfter={dur} dur={dur} />
);
const ConveyorTick: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(FILES.conveyorTick)} volume={0.1} dur={6} />
);
const Shape: React.FC<{ from: number; volume?: number }> = ({ from, volume = 0.3 }) => (
  <Cue from={from} src={sfx(FILES.shape)} volume={volume} dur={10} />
);
const Ring: React.FC<{ from: number; volume?: number }> = ({ from, volume = 0.18 }) => (
  <Cue from={from} src={sfx(FILES.ring)} volume={volume} dur={12} />
);
const CounterTick: React.FC<{ from: number; volume?: number }> = ({ from, volume = 0.18 }) => (
  <Cue from={from} src={sfx(FILES.counterTick)} volume={volume} dur={6} />
);

/* Conveyor pass timings for Scene 01 — 14 ticks distributed across
 * the S-curve sweep so the rate matches perceived motion: slow at the
 * edges, dense through the middle. v10,000 lands at frame 36 with the
 * payoff cue, so the last tick sits just before that. */
const SCENE01_CONVEYOR_TICKS = [3, 7, 11, 14, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35];

export const Sfx: React.FC = () => {
  return (
    <>
      {/* ═════════════════════════════════════════════════════════════
          Scene 01 — Hook (0–84)
          Conveyor sweeps under "You spent 10,000 hours" → "perfecting
          your trading strategies." Each version (v1 → v10,000) ticks
          as it passes the center.
          ═════════════════════════════════════════════════════════════ */}
      <Ambient from={0} dur={42} volume={0.28} />
      {SCENE01_CONVEYOR_TICKS.map((f) => (
        <ConveyorTick key={`s1-tick-${f}`} from={f} />
      ))}

      {/* Phrase A — every word */}
      <Word from={0} />     {/* You */}
      <Word from={10} />    {/* spent */}
      <Emphasis from={15} />{/* 10,000 */}
      <Word from={21} />    {/* hours */}

      {/* v10,000 parks at center — the conveyor's payoff */}
      <Cue from={36} src={sfx(FILES.payoff)} volume={0.55} dur={32} />

      {/* Phrase A → B switch */}
      <Whoosh from={41} />

      {/* Phrase B — every word */}
      <Word from={47} />    {/* perfecting */}
      <Word from={53} />    {/* your */}
      <Word from={58} />    {/* trading */}
      <Emphasis from={64} />{/* strategies */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 02 — TryRainbows (84–132)
          "How rainbows improve / your gains?" slides in.
          ═════════════════════════════════════════════════════════════ */}
      <Whoosh from={84} dur={24} />
      <Word from={87} />    {/* How */}
      <Word from={90} />    {/* rainbows */}
      <Word from={93} />    {/* improve */}
      <Word from={97} />    {/* your */}
      <Emphasis from={101} />{/* gains? */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 03 — CubeExplode (132–204)
          Boxes punch in (132), text border snaps in (154), morph (174).
          ═════════════════════════════════════════════════════════════ */}
      <Whoosh from={132} />
      <Shape from={132} volume={0.32} />  {/* Stocks box */}
      <Shape from={133} volume={0.3} />   {/* Crypto */}
      <Shape from={134} volume={0.3} />   {/* Predictions */}
      <Shape from={135} volume={0.3} />   {/* Memecoins */}

      <Whoosh from={154} volume={0.4} />  {/* text border snap */}
      <Ambient from={158} dur={42} volume={0.18} />  {/* orbit drone */}

      <Whoosh from={174} volume={0.4} />  {/* morph */}
      <Shape from={178} volume={0.3} />   {/* Flower */}
      <Shape from={180} volume={0.3} />   {/* Heart */}
      <Shape from={182} volume={0.3} />   {/* Star */}
      <Shape from={184} volume={0.3} />   {/* Cloud */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 04 — FilterAndPercent (204–312)
          Phrase A: 5 words. Phase swap (251). Counter 0→70 (~34f).
          Subtitle reveal at 278.
          ═════════════════════════════════════════════════════════════ */}
      <Whoosh from={204} volume={0.4} />
      <Word from={205} />   {/* Rainbows */}
      <Word from={210} />   {/* filters */}
      <Word from={214} />   {/* out */}
      <Word from={219} />   {/* illegal */}
      <Word from={223} />   {/* activities */}

      {/* Phase swap → counter */}
      <Whoosh from={251} />
      <Cue from={257} src={sfx(FILES.counterPayoff)} volume={0.5} dur={36} />
      {[260, 264, 268, 272, 276, 281, 287].map((f) => (
        <CounterTick key={`s4-count-${f}`} from={f} />
      ))}
      <Emphasis from={291} /> {/* 70% lands */}

      {/* Subtitle — 4 words */}
      <Whoosh from={278} volume={0.3} />
      <Word from={278} />   {/* of */}
      <Word from={281} />   {/* your */}
      <Word from={284} />   {/* potential */}
      <Word from={288} />   {/* profits */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 05 — Manipulators (312–420)
          Title "Removing", 6 conveyor shapes, 4 sniper passes at
          +13 / +36 / +59 / +82 (comp 325 / 348 / 371 / 394).
          ═════════════════════════════════════════════════════════════ */}
      <Whoosh from={312} />
      <Word from={313} />   {/* Removing */}

      {/* 6 conveyor shapes appear */}
      {[316, 318, 320, 323, 325, 328].map((f) => (
        <Shape key={`s5-shape-${f}`} from={f} volume={0.22} />
      ))}

      {/* Conveyor scroll ambient */}
      <Ambient from={319} dur={84} volume={0.2} />

      {/* 4 sniper passes — same 3-cue sequence each time */}
      {[325, 348, 371, 394].map((start) => (
        <React.Fragment key={`s5-pass-${start}`}>
          <Cue from={start - 7} src={sfx(FILES.lockOn)} volume={0.28} dur={14} />
          <Cue from={start} src={sfx(FILES.shot)} volume={0.65} dur={14} />
          <Cue from={start + 5} src={sfx(FILES.detonate)} volume={0.45} dur={14} />
        </React.Fragment>
      ))}

      {/* ═════════════════════════════════════════════════════════════
          Scene 06 — HonestTraders (420–504)
          6 concentric rings + Phrase 1 (6 words) → Phrase 2 (4 serif).
          ═════════════════════════════════════════════════════════════ */}
      {/* Concentric rings — same sample every time, descending volume */}
      {[
        { f: 420, v: 0.22 },
        { f: 424, v: 0.20 },
        { f: 429, v: 0.18 },
        { f: 433, v: 0.16 },
        { f: 437, v: 0.14 },
        { f: 442, v: 0.12 },
      ].map((c) => (
        <Ring key={`s6-ring-${c.f}`} from={c.f} volume={c.v} />
      ))}

      {/* Phrase 1 — 6 words */}
      <Word from={422} />   {/* Leaving */}
      <Word from={425} />   {/* the */}
      <Word from={428} />   {/* same */}
      <Word from={431} />   {/* amount */}
      <Word from={434} />   {/* of */}
      <Emphasis from={437} />{/* profits */}

      {/* Phase swap — into the serif italic close */}
      <Whoosh from={461} />
      <Cue from={467} src={sfx(FILES.payoff)} volume={0.5} dur={28} />

      {/* Phrase 2 — 4 words */}
      <Word from={469} />   {/* to */}
      <Word from={473} />   {/* fewer */}
      <Word from={478} />   {/* honest */}
      <Emphasis from={482} />{/* traders */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 10a — GainMore (504–540)
          "gain more" — two big bold words.
          ═════════════════════════════════════════════════════════════ */}
      <Whoosh from={504} />
      <Emphasis from={506} />{/* gain */}
      <Emphasis from={511} />{/* more */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 10b — TradingWith (540–612)
          UI drops in, italic phrase cascades word-by-word.
          ═════════════════════════════════════════════════════════════ */}
      <Whoosh from={540} />
      <Word from={568} />   {/* while */}
      <Word from={571} />   {/* trading */}
      <Word from={574} />   {/* the */}
      <Word from={577} />   {/* same */}
      <Word from={580} />   {/* assets */}
      <Word from={583} />   {/* with */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 10c — Endcard (612–756)
          Square wipe (612–626) → endcard with logo lockup + tagline.
          ═════════════════════════════════════════════════════════════ */}
      <Cue from={612} src={sfx(FILES.wipe)} volume={0.65} dur={24} />
      <Cue from={626} src={sfx(FILES.payoff)} volume={0.55} dur={32} />
      <Word from={636} /> {/* General */}

      {/* Tagline — "Markets for everything." */}
      <Word from={652} />   {/* Markets */}
      <Word from={655} />   {/* for */}
      <Word from={659} />   {/* everything */}
    </>
  );
};
