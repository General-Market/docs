import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

/*
 * Rainbows · Flashblocks — SFX track v3 (music-as-SFX)
 *
 * The track is built like a score. Three layers stack:
 *   1. PULSE — a recurring tick that acts like a metronome. Spacing
 *      tightens during action, opens up during quiet beats.
 *   2. WORDS — every visible word reveal gets its own tap (mouse-click
 *      / low-pop / sharp-pop). Numbers and emphasis words get the pop.
 *   3. HITS  — phase transitions, shape entrances, gunshots, wipes.
 *      These are the "percussion" — they land on or near pulse beats.
 *
 * 24fps, 0–756 frames. 12-frame base pulse ≈ 120bpm. Half-pulse (6f)
 * during high-energy passages.
 *
 * Volumes follow a strict ladder so layers stack without smearing:
 *   pulse        0.10–0.18
 *   word ticks   0.30–0.45
 *   event hits   0.45–0.65
 *   percussion   0.60–0.80
 */

const sfx = (name: string) => staticFile(`sfx/mx6/${name}`);

interface CueProps {
  from: number;
  src: string;
  volume?: number;
  trimAfter?: number;
  playbackRate?: number;
  /* Sequence window length. The Audio tag mounts only inside this
   * window — without it, every cue stays mounted from `from` to the
   * end of the composition and we hit Remotion's audio-tag cap. */
  dur?: number;
}

const Cue: React.FC<CueProps> = ({
  from,
  src,
  volume = 0.6,
  trimAfter,
  playbackRate,
  dur = 18,
}) => (
  <Sequence from={from} durationInFrames={dur} layout="none">
    <Audio src={src} volume={volume} trimAfter={trimAfter} playbackRate={playbackRate} />
  </Sequence>
);

const S = {
  whooshLong: "long-whoosh-001.mp3",
  whooshSharpLong: "sharp-long-whoosh.mp3",
  whooshSharpFast: "sharp-fast-whoosh.mp3",
  whooshEpicFast: "epic-fast-whoosh.mp3",
  whooshEpic1: "epic-whoosh-001.mp3",
  whooshEpic2: "epic-whoosh-002.mp3",
  whooshFastCine: "fast-cinematic-whoosh-stereo.mp3",
  whooshVeryFastCine: "very-fast-cinematic-whoosh.mp3",
  whooshVeryFast: "very-fast-whoosh.wav",
  click: "mouse-click.mp3",
  clickKey: "keyboard-click.mp3",
  clickDigi: "digital-click.mp3",
  popLow: "low-pop.mp3",
  popCartoon: "pop-cartoon.mp3",
  popSharp: "sharp-pop.mp3",
  select1: "select-001.mp3",
  select2: "select-002.mp3",
  select3: "select-003.mp3",
  select4: "select-004.mp3",
  selectGame: "video-game-select.mp3",
  obtain1: "obtain-001.mp3",
  obtain2: "obtain-002.mp3",
  obtain2Dry: "obtain-002-without-reverb.mp3",
  on: "on-001.mp3",
  clap: "sharp-clap.mp3",
  err1: "error-001.mp3",
  err2: "error-002.mp3",
  wrong: "wrong-001.mp3",
};

/* ═════════════════════════════════════════════════════════════════════
   Layer 1 — PULSE
   A repeating tick that gives the track its tempo. `step` controls
   density: 12 = base pulse, 8 = tighter, 6 = double-time.
   ═════════════════════════════════════════════════════════════════════ */
const pulse = (
  fromFrame: number,
  toFrame: number,
  step: number,
  baseVol: number = 0.14,
  keyPrefix: string = "p",
): React.ReactNode[] => {
  const cues: React.ReactNode[] = [];
  for (let f = fromFrame, i = 0; f < toFrame; f += step, i++) {
    // Alternate two sample types so the metronome doesn't feel mechanical.
    const isStrong = i % 2 === 0;
    const src = isStrong ? S.clickDigi : S.click;
    const vol = isStrong ? baseVol : baseVol * 0.75;
    const rate = 1.0 + ((i % 4) - 1.5) * 0.04;
    cues.push(
      <Cue
        key={`${keyPrefix}-${f}`}
        from={f}
        src={sfx(src)}
        volume={vol}
        playbackRate={rate}
        dur={6}
      />,
    );
  }
  return cues;
};

export const Sfx: React.FC = () => {
  return (
    <>
      {/* ───────────────────────────────────────────────────────────
          PULSE TRACK — assembled in segments.
          0–84    Scene 01:    12f pulse        (calm, words landing on beat)
          84–132  Scene 02:     8f pulse        (tightens for the question)
          132–204 Scene 03:     8f pulse        (orbit energy)
          204–251 Scene 04 A:  12f pulse
          251–298 Scene 04 B:   6f pulse        (counter ramp double-time)
          298–312 Scene 04 hold: silence
          312–420 Scene 05:     8f pulse        (action density)
          420–461 Scene 06 A:  12f pulse
          461–504 Scene 06 B:  silence          (serif italic breathes)
          504–540 Scene 10a:   silence          ("gain more" alone)
          540–612 Scene 10b:   silence          (UI + "while trading…")
          612–626 Wipe:        silence
          626–756 Endcard:     16f wide pulse   (open, settled)
          ─────────────────────────────────────────────────────────── */}
      {pulse(0, 84, 12, 0.13, "s1")}
      {pulse(84, 132, 8, 0.14, "s2")}
      {pulse(132, 204, 8, 0.15, "s3")}
      {pulse(204, 251, 12, 0.13, "s4a")}
      {pulse(251, 298, 6, 0.16, "s4b")}
      {pulse(312, 420, 8, 0.14, "s5")}
      {pulse(420, 461, 12, 0.13, "s6a")}
      {pulse(626, 756, 16, 0.10, "s10c")}

      {/* ═════════════════════════════════════════════════════════════
          Scene 01 — Hook (0–84)
          Conveyor sweeps under "You spent 10,000 hours" → "perfecting
          your trading strategies."
          ═════════════════════════════════════════════════════════════ */}
      {/* Conveyor ambient */}
      <Cue from={0} src={sfx(S.whooshLong)} volume={0.4} dur={48} />
      <Cue from={36} src={sfx(S.whooshLong)} volume={0.32} playbackRate={0.85} dur={48} />

      {/* Phrase A — every word ticks */}
      <Cue from={0} src={sfx(S.popLow)} volume={0.4} playbackRate={1.0} />        {/* You */}
      <Cue from={10} src={sfx(S.click)} volume={0.42} />                          {/* spent */}
      <Cue from={15} src={sfx(S.popSharp)} volume={0.7} />                        {/* 10,000 — emphasis */}
      <Cue from={21} src={sfx(S.click)} volume={0.4} playbackRate={1.05} />       {/* hours */}

      {/* v10,000 lands at horizontal center — payoff */}
      <Cue from={36} src={sfx(S.popSharp)} volume={0.72} playbackRate={0.92} />
      <Cue from={37} src={sfx(S.obtain2Dry)} volume={0.45} trimAfter={20} dur={22} />

      {/* Phrase A → B switch */}
      <Cue from={41} src={sfx(S.whooshVeryFast)} volume={0.62} />

      {/* Phrase B — every word ticks */}
      <Cue from={47} src={sfx(S.popLow)} volume={0.45} />                         {/* perfecting */}
      <Cue from={53} src={sfx(S.click)} volume={0.42} playbackRate={1.04} />      {/* your */}
      <Cue from={58} src={sfx(S.popLow)} volume={0.45} playbackRate={0.97} />     {/* trading */}
      <Cue from={64} src={sfx(S.popSharp)} volume={0.65} />                       {/* strategies — knife */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 02 — TryRainbows (84–132)
          "How rainbows improve / your gains?" slides in together.
          ═════════════════════════════════════════════════════════════ */}
      <Cue from={84} src={sfx(S.whooshSharpLong)} volume={0.65} dur={48} />
      {/* All five words enter on the same slide — five quick taps to
          mark each one as a discrete word. */}
      <Cue from={87} src={sfx(S.click)} volume={0.36} playbackRate={1.06} />      {/* How */}
      <Cue from={90} src={sfx(S.click)} volume={0.4} playbackRate={1.0} />        {/* rainbows */}
      <Cue from={93} src={sfx(S.click)} volume={0.38} playbackRate={1.08} />      {/* improve */}
      <Cue from={97} src={sfx(S.click)} volume={0.36} playbackRate={1.04} />      {/* your */}
      <Cue from={101} src={sfx(S.popLow)} volume={0.48} />                        {/* gains? */}
      <Cue from={120} src={sfx(S.select3)} volume={0.32} trimAfter={18} dur={18} />        {/* hold */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 03 — CubeExplode (132–204)
          Beat 1 (132): 4 boxes punch in. Beat 2 (154): text border
          snaps in and orbits. Beat 3 (174): rectangles morph to shapes.
          ═════════════════════════════════════════════════════════════ */}
      {/* Boxes punch in — staggered ticks */}
      <Cue from={132} src={sfx(S.popCartoon)} volume={0.6} />                     {/* Stocks */}
      <Cue from={133} src={sfx(S.popLow)} volume={0.5} playbackRate={1.05} />     {/* Crypto */}
      <Cue from={134} src={sfx(S.popLow)} volume={0.5} playbackRate={1.1} />      {/* Predictions */}
      <Cue from={135} src={sfx(S.popLow)} volume={0.5} playbackRate={1.15} />     {/* Memecoins */}
      <Cue from={138} src={sfx(S.clickDigi)} volume={0.32} />

      {/* Text border snaps + orbit ambient */}
      <Cue from={154} src={sfx(S.whooshSharpFast)} volume={0.62} />
      <Cue from={158} src={sfx(S.select4)} volume={0.42} />
      <Cue from={162} src={sfx(S.whooshLong)} volume={0.26} trimAfter={36} dur={36} />     {/* orbit drone */}

      {/* Morph beat — four shapes arrive */}
      <Cue from={174} src={sfx(S.obtain2)} volume={0.55} dur={32} />
      <Cue from={175} src={sfx(S.whooshVeryFastCine)} volume={0.45} />
      <Cue from={178} src={sfx(S.popLow)} volume={0.4} playbackRate={1.2} />      {/* Flower */}
      <Cue from={180} src={sfx(S.popLow)} volume={0.4} playbackRate={1.0} />      {/* Heart */}
      <Cue from={182} src={sfx(S.popLow)} volume={0.4} playbackRate={0.85} />     {/* Star */}
      <Cue from={184} src={sfx(S.popLow)} volume={0.4} playbackRate={0.9} />      {/* Cloud */}
      <Cue from={192} src={sfx(S.clickDigi)} volume={0.36} />

      {/* ═════════════════════════════════════════════════════════════
          Scene 04 — FilterAndPercent (204–312)
          Phrase A: 5 words. Phase swap +47. Counter 0→70 (~34f).
          Starburst expand 1.8s. Subtitle reveal +74.
          ═════════════════════════════════════════════════════════════ */}
      <Cue from={204} src={sfx(S.whooshSharpFast)} volume={0.45} />

      {/* Phrase A — typewriter feel, errors land on the semantic words */}
      <Cue from={205} src={sfx(S.click)} volume={0.45} />                         {/* Rainbows */}
      <Cue from={210} src={sfx(S.click)} volume={0.45} playbackRate={1.04} />     {/* filters */}
      <Cue from={214} src={sfx(S.click)} volume={0.42} playbackRate={1.08} />     {/* out */}
      <Cue from={219} src={sfx(S.wrong)} volume={0.55} />                         {/* illegal */}
      <Cue from={223} src={sfx(S.err1)} volume={0.5} />                           {/* activities */}

      {/* Phase swap → light gradient */}
      <Cue from={251} src={sfx(S.whooshEpic1)} volume={0.62} dur={36} />
      <Cue from={256} src={sfx(S.whooshVeryFastCine)} volume={0.52} />
      <Cue from={256} src={sfx(S.click)} volume={0.36} />                         {/* "regaining" reveal */}

      {/* Counter ramp 0→70 — 8 ticks accelerating */}
      <Cue from={257} src={sfx(S.obtain1)} volume={0.6} dur={36} />
      {[260, 264, 267, 270, 273, 277, 282, 288].map((f, i) => (
        <Cue
          key={`s4-count-${i}`}
          from={f}
          src={sfx(S.clickDigi)}
          volume={0.24 + i * 0.018}
          playbackRate={1.0 + i * 0.04}
        />
      ))}
      <Cue from={291} src={sfx(S.popSharp)} volume={0.6} />                       {/* 70% lands */}

      {/* Starburst radiate */}
      <Cue from={263} src={sfx(S.whooshSharpLong)} volume={0.48} dur={48} />
      <Cue from={265} src={sfx(S.on)} volume={0.32} trimAfter={42} dur={42} />

      {/* Subtitle "of your potential profits" — 4 word ticks */}
      <Cue from={278} src={sfx(S.obtain2Dry)} volume={0.45} dur={22} />
      <Cue from={278} src={sfx(S.click)} volume={0.34} />                         {/* of */}
      <Cue from={281} src={sfx(S.click)} volume={0.34} playbackRate={1.04} />     {/* your */}
      <Cue from={284} src={sfx(S.click)} volume={0.36} playbackRate={1.08} />     {/* potential */}
      <Cue from={288} src={sfx(S.popLow)} volume={0.45} />                        {/* profits — emphasis */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 05 — Manipulators (312–420)
          Title "Removing", 6 conveyor shapes, 4 sniper passes.
          ═════════════════════════════════════════════════════════════ */}
      <Cue from={312} src={sfx(S.whooshSharpLong)} volume={0.55} dur={48} />
      <Cue from={313} src={sfx(S.selectGame)} volume={0.45} />
      <Cue from={313} src={sfx(S.click)} volume={0.4} />                          {/* "Removing" */}
      <Cue from={316} src={sfx(S.select4)} volume={0.32} />                       {/* rail */}

      {/* 6 conveyor shapes appearing */}
      {[316, 318, 320, 323, 325, 328].map((f, i) => (
        <Cue
          key={`s5-shape-${i}`}
          from={f}
          src={sfx(S.popLow)}
          volume={0.34 - i * 0.014}
          playbackRate={1.18 - i * 0.04}
        />
      ))}

      {/* Conveyor scroll ambient */}
      <Cue from={319} src={sfx(S.whooshLong)} volume={0.22} trimAfter={84} dur={84} />

      {/* 4 sniper passes — each is a 5-cue mini-phrase:
          lock-on / shot / tracer / detonate / debris.
          Each label word ("frontrunners" / "orderbook spoofers" /
          "illegal insiders" / "market manipulators") arrives with the
          shot — the clap IS the word reveal. */}
      {[
        { start: 325, lockSnd: S.select2 },
        { start: 348, lockSnd: S.select3 },
        { start: 371, lockSnd: S.select2 },
        { start: 394, lockSnd: S.select1 },
      ].map((pass, i) => (
        <React.Fragment key={`s5-pass-${i}`}>
          <Cue from={pass.start - 7} src={sfx(pass.lockSnd)} volume={0.46} />
          <Cue from={pass.start} src={sfx(S.clap)} volume={0.78} playbackRate={0.95 + i * 0.03} />
          <Cue from={pass.start + 1} src={sfx(S.whooshVeryFast)} volume={0.46} />
          <Cue from={pass.start + 5} src={sfx(S.popSharp)} volume={0.62} />
          <Cue from={pass.start + 6} src={sfx(S.err2)} volume={0.36} />
          <Cue from={pass.start + 14} src={sfx(S.popLow)} volume={0.28} playbackRate={0.85} />
        </React.Fragment>
      ))}

      {/* ═════════════════════════════════════════════════════════════
          Scene 06 — HonestTraders (420–504)
          6 concentric rings + Phrase 1 (6 words) → Phrase 2 (4 serif).
          ═════════════════════════════════════════════════════════════ */}
      {/* Concentric rings — each gets a soft "select" descending */}
      <Cue from={420} src={sfx(S.on)} volume={0.4} trimAfter={36} dur={36} />
      {[
        { f: 420, snd: S.select1, v: 0.36 },
        { f: 424, snd: S.select2, v: 0.32 },
        { f: 429, snd: S.select3, v: 0.28 },
        { f: 433, snd: S.select4, v: 0.25 },
        { f: 437, snd: S.select1, v: 0.22 },
        { f: 442, snd: S.select2, v: 0.20 },
      ].map((c, i) => (
        <Cue
          key={`s6-ring-${i}`}
          from={c.f}
          src={sfx(c.snd)}
          volume={c.v}
          playbackRate={1.0 + i * 0.025}
        />
      ))}

      {/* Phrase 1 — 6 words */}
      <Cue from={422} src={sfx(S.click)} volume={0.42} />                         {/* Leaving */}
      <Cue from={425} src={sfx(S.click)} volume={0.38} playbackRate={1.04} />     {/* the */}
      <Cue from={428} src={sfx(S.click)} volume={0.42} playbackRate={0.98} />     {/* same */}
      <Cue from={431} src={sfx(S.click)} volume={0.42} playbackRate={1.06} />     {/* amount */}
      <Cue from={434} src={sfx(S.click)} volume={0.38} playbackRate={1.02} />     {/* of */}
      <Cue from={437} src={sfx(S.popLow)} volume={0.52} />                        {/* profits */}

      {/* Phase swap — into the serif italic close */}
      <Cue from={461} src={sfx(S.whooshVeryFastCine)} volume={0.58} />
      <Cue from={467} src={sfx(S.obtain2Dry)} volume={0.62} dur={22} />

      {/* Phrase 2 — 4 words, building to "traders" */}
      <Cue from={469} src={sfx(S.popLow)} volume={0.4} playbackRate={0.95} />     {/* to */}
      <Cue from={473} src={sfx(S.popLow)} volume={0.45} />                        {/* fewer */}
      <Cue from={478} src={sfx(S.popLow)} volume={0.5} playbackRate={0.92} />     {/* honest */}
      <Cue from={482} src={sfx(S.popSharp)} volume={0.65} />                      {/* traders */}

      {/* ═════════════════════════════════════════════════════════════
          Scene 10 — Finale, three scenes:
            10a (504–540) "gain more" big bold on teal
            10b (540–612) UI homepage + "while trading the same assets with"
            10c (612–756) square wipe (612–626) → General lockup endcard
          ═════════════════════════════════════════════════════════════ */}

      {/* 10a — "gain more" entry */}
      <Cue from={504} src={sfx(S.whooshSharpLong)} volume={0.58} dur={48} />
      <Cue from={506} src={sfx(S.popSharp)} volume={0.62} />                      {/* gain */}
      <Cue from={511} src={sfx(S.popSharp)} volume={0.55} playbackRate={0.92} />  {/* more */}
      <Cue from={513} src={sfx(S.obtain2)} volume={0.45} trimAfter={26} dur={26} />

      {/* 10b — UI mockup drops in */}
      <Cue from={540} src={sfx(S.whooshSharpLong)} volume={0.55} dur={48} />
      <Cue from={544} src={sfx(S.select4)} volume={0.42} />                       {/* UI lands */}

      {/* 10b — "while trading the same assets with" — 6 word ticks (start at frame 568 = 540+28) */}
      <Cue from={568} src={sfx(S.click)} volume={0.34} />                         {/* while */}
      <Cue from={571} src={sfx(S.click)} volume={0.36} playbackRate={1.04} />     {/* trading */}
      <Cue from={574} src={sfx(S.click)} volume={0.34} playbackRate={1.0} />      {/* the */}
      <Cue from={577} src={sfx(S.click)} volume={0.36} playbackRate={1.08} />     {/* same */}
      <Cue from={580} src={sfx(S.click)} volume={0.34} playbackRate={1.04} />     {/* assets */}
      <Cue from={583} src={sfx(S.click)} volume={0.32} playbackRate={1.0} />      {/* with */}

      {/* 10c — square wipe (612–626) eats the teal */}
      <Cue from={612} src={sfx(S.whooshEpicFast)} volume={0.75} dur={24} />
      <Cue from={617} src={sfx(S.whooshEpic2)} volume={0.42} dur={36} />

      {/* 10c — Endcard reveal: bouncing dot, logo mark, "General" wordmark */}
      <Cue from={626} src={sfx(S.obtain2)} volume={0.68} dur={32} />
      <Cue from={626} src={sfx(S.popCartoon)} volume={0.48} />                    {/* bouncing dot */}
      <Cue from={629} src={sfx(S.popLow)} volume={0.34} playbackRate={1.1} />     {/* dot bounce */}
      <Cue from={632} src={sfx(S.popLow)} volume={0.3} playbackRate={1.2} />
      <Cue from={632} src={sfx(S.select4)} volume={0.4} />                        {/* logo mark fade */}
      <Cue from={636} src={sfx(S.click)} volume={0.42} />                         {/* "General" */}
      <Cue from={640} src={sfx(S.on)} volume={0.3} trimAfter={48} dur={48} />

      {/* 10c — Tagline "Markets for everything." — 3 word ticks */}
      <Cue from={652} src={sfx(S.clickDigi)} volume={0.42} />                     {/* Markets */}
      <Cue from={655} src={sfx(S.click)} volume={0.36} playbackRate={1.06} />     {/* for */}
      <Cue from={658} src={sfx(S.popLow)} volume={0.42} />                        {/* everything */}
    </>
  );
};
