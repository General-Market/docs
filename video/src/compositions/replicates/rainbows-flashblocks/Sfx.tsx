import React from "react";
import { Audio, Sequence, interpolate, staticFile } from "remotion";

/*
 * Rainbows · Flashblocks — SFX track v5 (locked palette)
 *
 * One sample per role. One volume per role. No drift, no variation.
 * Repetition is what makes it feel like a score.
 *
 *   WORD          select-003       0.18  every word reveal anywhere
 *   POP           sharp-pop        0.50  emphasis + detonate (impact)
 *   WHOOSH        sharp-fast-whoosh 0.40  every scene/phase transition
 *   AMBIENT       long-whoosh-001  0.22  conveyor sweep, orbit drone
 *   CONVEYOR TICK low-pop          0.10  each version (v1→v10,000), each Scene 5 item
 *   SHAPE         pop-cartoon      0.32  cube boxes, morph shapes
 *   RING          select-001       0.16  every concentric ring
 *   COUNTER TICK  digital-click    0.18  counter ramp 0→70
 *   LOCK-ON       select-002       0.28  reticle pre-shot
 *   SHOT          sharp-clap       0.65  sniper gunshot
 *   PAYOFF        obtain-002       0.55  v10,000 lands, endcard reveal, phase-2 close
 *   COUNTER PAYOFF obtain-001      0.50  counter scale-up
 *   WIPE          epic-fast-whoosh 0.65  square wipe at finale
 *
 * 24fps, 0–756 frames.
 */

const sfx = (name: string) => staticFile(`sfx/mx6/${name}`);

const F = {
  word: "obtain-002-without-reverb.mp3",
  pop: "sharp-pop.mp3",
  whoosh: "sharp-fast-whoosh.mp3",
  ambient: "long-whoosh-001.mp3",
  conveyorTick: "low-pop.mp3",
  shape: "pop-cartoon.mp3",
  ring: "select-001.mp3",
  counterTick: "digital-click.mp3",
  lockOn: "select-002.mp3",
  shot: "sharp-clap.mp3",
  payoff: "obtain-002.mp3",
  counterPayoff: "obtain-001.mp3",
  wipe: "epic-fast-whoosh.mp3",
};

const V = {
  word: 0.14,
  pop: 0.5,
  whoosh: 0.4,
  ambient: 0.22,
  conveyorTick: 0.1,
  shape: 0.32,
  ring: 0.16,
  counterTick: 0.18,
  lockOn: 0.28,
  shot: 0.65,
  payoff: 0.55,
  counterPayoff: 0.5,
  wipe: 0.65,
};

interface CueProps {
  from: number;
  src: string;
  volume: number;
  /* Sequence window length. Required: without it the Audio mounts at
   * `from` and stays mounted to the end of the comp — Remotion caps at
   * 40 simultaneous tags. */
  dur: number;
  trimAfter?: number;
}

const Cue: React.FC<CueProps> = ({ from, src, volume, dur, trimAfter }) => (
  <Sequence from={from} durationInFrames={dur} layout="none">
    <Audio src={src} volume={volume} trimAfter={trimAfter} />
  </Sequence>
);

/* Role components — every cue routes through one of these so the
 * sample/volume table is enforced at the type level. */
const Word: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.word)} volume={V.word} dur={10} />
);
const Pop: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.pop)} volume={V.pop} dur={14} />
);
const Whoosh: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.whoosh)} volume={V.whoosh} dur={18} />
);
const Ambient: React.FC<{ from: number; dur: number }> = ({ from, dur }) => (
  <Cue from={from} src={sfx(F.ambient)} volume={V.ambient} trimAfter={dur} dur={dur} />
);
const ConveyorTick: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.conveyorTick)} volume={V.conveyorTick} dur={6} />
);
const Shape: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.shape)} volume={V.shape} dur={10} />
);
const Ring: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.ring)} volume={V.ring} dur={12} />
);
const CounterTick: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.counterTick)} volume={V.counterTick} dur={6} />
);
const LockOn: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.lockOn)} volume={V.lockOn} dur={14} />
);
const Shot: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.shot)} volume={V.shot} dur={14} />
);
const Payoff: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.payoff)} volume={V.payoff} dur={32} />
);
const CounterPayoff: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.counterPayoff)} volume={V.counterPayoff} dur={36} />
);
const Wipe: React.FC<{ from: number }> = ({ from }) => (
  <Cue from={from} src={sfx(F.wipe)} volume={V.wipe} dur={24} />
);

/* Scene 01 conveyor — 14 ticks across the S-curve sweep, denser
 * through the middle where the visual motion peaks. v10,000 lands at
 * frame 36 with the payoff, so the last tick sits just before that. */
const SCENE01_CONVEYOR_TICKS = [3, 7, 11, 14, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35];

/* Music bed — `launch-track.mp3`, 117.5 BPM, energy from f0.
 * Beats at every ~12.25 frames; scene boundaries land within 1-3 frames
 * of beats at 84, 540, 612, 638 — close enough to feel cohesive without
 * being mechanical.
 * Fade in 0–12, hold at low volume, fade out 580–612 so the endcard's
 * sustained tone owns the finale. */
const MUSIC_END = 612;
const MUSIC_TARGET_VOL = 0.16;
const musicVolume = (f: number) => {
  if (f < 0 || f > MUSIC_END) return 0;
  const fadeIn = interpolate(f, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(f, [580, MUSIC_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return MUSIC_TARGET_VOL * Math.min(fadeIn, fadeOut);
};

const MusicBed: React.FC = () => (
  <Sequence from={0} durationInFrames={MUSIC_END} layout="none">
    <Audio src={staticFile("music/launch-track.mp3")} volume={musicVolume} />
  </Sequence>
);

export const Sfx: React.FC = () => {
  return (
    <>
      {/* Music bed — sits at -15 dB under SFX, fades out into endcard tone */}
      <MusicBed />
      {/* ═════════════════════════════════════════════════════════════
          Scene 01 — Hook (0–84)
          "You spent 10,000 hours" → "perfecting your trading strategies."
          Conveyor sweeps v1 → v10,000 underneath.
          ═════════════════════════════════════════════════════════════ */}
      <Ambient from={0} dur={42} />
      {SCENE01_CONVEYOR_TICKS.map((f) => (
        <ConveyorTick key={`s1-tick-${f}`} from={f} />
      ))}

      {/* Phrase A */}
      <Word from={0} />     {/* You */}
      <Word from={10} />    {/* spent */}
      <Pop from={15} />     {/* 10,000 */}
      <Word from={21} />    {/* hours */}

      {/* v10,000 parks at center */}
      <Payoff from={36} />

      {/* Phrase A → B */}
      <Whoosh from={41} />

      {/* Phrase B */}
      <Word from={47} />    {/* perfecting */}
      <Word from={53} />    {/* your */}
      <Word from={58} />    {/* trading */}
      <Pop from={64} />     {/* strategies */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 02 — TryRainbows (84–132)
          ═════════════════════════════════════════════════════════════ */}
      <Whoosh from={84} />
      <Word from={87} />    {/* How */}
      <Word from={90} />    {/* rainbows */}
      <Word from={93} />    {/* improve */}
      <Word from={97} />    {/* your */}
      <Pop from={101} />    {/* gains? */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 03 — CubeExplode (132–204)
          ═════════════════════════════════════════════════════════════ */}
      {/* Boxes punch in — 4 shapes mark the entry, no whoosh on top */}
      <Shape from={132} />  {/* Stocks */}
      <Shape from={133} />  {/* Crypto */}
      <Shape from={134} />  {/* Predictions */}
      <Shape from={135} />  {/* Memecoins */}

      {/* Text border snap + orbit drone */}
      <Whoosh from={154} />
      <Ambient from={158} dur={42} />

      {/* Morph */}
      <Whoosh from={174} />
      <Shape from={178} />  {/* Flower */}
      <Shape from={180} />  {/* Heart */}
      <Shape from={182} />  {/* Star */}
      <Shape from={184} />  {/* Cloud */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 04 — FilterAndPercent (204–312)
          ═════════════════════════════════════════════════════════════ */}
      <Whoosh from={204} />
      <Word from={205} />   {/* Rainbows */}
      <Word from={210} />   {/* filters */}
      <Word from={214} />   {/* out */}
      <Word from={219} />   {/* illegal */}
      <Word from={223} />   {/* activities */}

      {/* Phase swap → counter ramp */}
      <Whoosh from={251} />
      <CounterPayoff from={257} />
      {[260, 264, 268, 272, 276, 281, 287].map((f) => (
        <CounterTick key={`s4-count-${f}`} from={f} />
      ))}
      <Pop from={291} />    {/* 70% lands */}

      {/* Subtitle — 4 words mark the reveal, no whoosh on top */}
      <Word from={278} />   {/* of */}
      <Word from={281} />   {/* your */}
      <Word from={284} />   {/* potential */}
      <Word from={288} />   {/* profits */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 05 — Manipulators (312–420)
          ═════════════════════════════════════════════════════════════ */}
      <Whoosh from={312} />
      <Word from={313} />   {/* Removing */}

      {/* 4 conveyor items tick as they appear; items 4 and 5 land
       * inside the sniper sequence (start frame 325) so they go
       * silent — the sniper takes over. */}
      {[316, 318, 320, 323].map((f) => (
        <ConveyorTick key={`s5-item-${f}`} from={f} />
      ))}

      <Ambient from={319} dur={84} />

      {/* 4 sniper passes — same 3-cue mini-phrase each time */}
      {[325, 348, 371, 394].map((start) => (
        <React.Fragment key={`s5-pass-${start}`}>
          <LockOn from={start - 7} />
          <Shot from={start} />
          <Pop from={start + 5} />   {/* detonate */}
        </React.Fragment>
      ))}

      {/* ═════════════════════════════════════════════════════════════
          Scene 06 — HonestTraders (420–504)
          ═════════════════════════════════════════════════════════════ */}
      {/* 6 concentric rings — same sample, same volume. Ring 5 is
       * shifted from 437 → 440 so it doesn't fire the same frame as
       * the Pop on "profits". */}
      {[420, 424, 429, 433, 440, 444].map((f) => (
        <Ring key={`s6-ring-${f}`} from={f} />
      ))}

      {/* Phrase 1 */}
      <Word from={422} />   {/* Leaving */}
      <Word from={425} />   {/* the */}
      <Word from={428} />   {/* same */}
      <Word from={431} />   {/* amount */}
      <Word from={434} />   {/* of */}
      <Pop from={437} />    {/* profits */}

      {/* Phase swap → serif italic close */}
      <Whoosh from={461} />
      <Payoff from={467} />

      {/* Phrase 2 */}
      <Word from={469} />   {/* to */}
      <Word from={473} />   {/* fewer */}
      <Word from={478} />   {/* honest */}
      <Pop from={482} />    {/* traders */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 10a — GainMore (504–540)
          ═════════════════════════════════════════════════════════════ */}
      <Whoosh from={504} />
      <Pop from={506} />    {/* gain */}
      <Pop from={511} />    {/* more */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 10b — TradingWith (540–612)
          UI cursor enters at f4, hovers third card at f24, clicks at f38.
          Global click frame = 540 + 38 = 578.
          ═════════════════════════════════════════════════════════════ */}
      <Whoosh from={540} />
      {/* Soft hover tick when cursor lands on the card */}
      <ConveyorTick from={564} />
      {/* Click — short pop. Same family as the Pop role, lighter weight. */}
      <ConveyorTick from={578} />
      <Word from={568} />   {/* while */}
      <Word from={571} />   {/* trading */}
      <Word from={574} />   {/* the */}
      <Word from={577} />   {/* same */}
      <Word from={580} />   {/* assets */}
      <Word from={583} />   {/* with */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 10c — Endcard (612–756)
          Local frame 0–14: square wipe to white
          ENDCARD_START at local 14 — global 626 begins the endcard.
          ec  0–15   pills assemble L→R (7 pills × 1.5f stagger + 6f fade)
          ec 16      LOCK-IN — chromatic flash + shockwave ring  → global 642
          ec 16–34   wordmark "General" wipes in
          ec 36–50   tagline arrives
          Global = 626 + ec for endcard events.
          ═════════════════════════════════════════════════════════════ */}
      <Wipe from={612} />

      {/* Pill ticks — one per pill, light percussion as the mark builds.
       * Pill i starts at ec = i * 1.5; in global frames: 626 + i*1.5. */}
      {[626, 627, 629, 630, 632, 633, 635].map((f) => (
        <ConveyorTick key={`s10c-pill-${f}`} from={f} />
      ))}

      {/* Lock-in (ec=16, global 642) — payoff + pop on the chromatic flash */}
      <Payoff from={642} />
      <Pop from={642} />

      {/* Wordmark wipe — "General" reveals. */}
      <Word from={642} />

      {/* Tagline (ec=36, global 662) */}
      <Word from={662} />   {/* Markets */}
      <Word from={665} />   {/* for */}
      <Word from={669} />   {/* everything */}

      {/* Sustained tone — the only sound in the video that holds.
       * Drone runs from lock-in to comp end (114 frames), low-volume
       * to sit under the tagline cues, then alone for the final hold. */}
      <Ambient from={642} dur={114} />
    </>
  );
};
