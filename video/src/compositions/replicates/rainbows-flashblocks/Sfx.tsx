import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

/*
 * Rainbows · Flashblocks — SFX track (Mx6 library)
 *
 * Cues live in public/sfx/mx6/. Each <Sequence from={...}> places one
 * audio asset against the master composition timeline; the offsets
 * mirror the visual beats already animated in ScenesA / ScenesB / ScenesC.
 *
 * 24fps. Master composition runs 0–648 frames.
 *   01 Hook              0–84
 *   02 TryRainbows      84–132
 *   03 CubeExplode     132–204
 *   04 FilterAndPercent 204–312
 *   05 Manipulators     312–420
 *   06 HonestTraders    420–504
 *   10 Finale           504–648
 *
 * Restraint over density. Each cue must earn its place.
 */

const sfx = (name: string) => staticFile(`sfx/mx6/${name}`);

interface CueProps {
  from: number;
  src: string;
  volume?: number;
  trimAfter?: number;
}

const Cue: React.FC<CueProps> = ({ from, src, volume = 0.7, trimAfter }) => (
  <Sequence from={from} layout="none">
    <Audio src={src} volume={volume} trimAfter={trimAfter} />
  </Sequence>
);

export const Sfx: React.FC = () => {
  return (
    <>
      {/* ── Scene 01 — Hook (0–84) ────────────────────────────────────
         Conveyor sweeps under the words; v10,000 lands at center; phrase
         A→B switch around frame 41. */}
      <Cue from={0} src={sfx("long-whoosh-001.mp3")} volume={0.42} />
      <Cue from={36} src={sfx("sharp-pop.mp3")} volume={0.55} />
      <Cue from={41} src={sfx("very-fast-whoosh.wav")} volume={0.55} />

      {/* ── Scene 02 — TryRainbows (84–132) ──────────────────────────
         Title slides in from the right at +2. */}
      <Cue from={84} src={sfx("sharp-long-whoosh.mp3")} volume={0.6} />

      {/* ── Scene 03 — CubeExplode (132–204) ─────────────────────────
         Boxes punch in at +0; text border snaps in at +22; morph at +42. */}
      <Cue from={132} src={sfx("pop-cartoon.mp3")} volume={0.6} />
      <Cue from={154} src={sfx("sharp-fast-whoosh.mp3")} volume={0.55} />
      <Cue from={174} src={sfx("obtain-002.mp3")} volume={0.5} />

      {/* ── Scene 04 — FilterAndPercent (204–312) ────────────────────
         Word stagger 0–1.95s, phase swap +47, counter ramp +53,
         starburst +59, subtitle at +74. */}
      <Cue from={204} src={sfx("sharp-fast-whoosh.mp3")} volume={0.45} />
      <Cue from={251} src={sfx("epic-whoosh-001.mp3")} volume={0.55} />
      <Cue from={257} src={sfx("obtain-001.mp3")} volume={0.55} />
      <Cue from={278} src={sfx("on-001.mp3")} volume={0.45} />

      {/* ── Scene 05 — Manipulators (312–420) ────────────────────────
         Title at +0; sniper passes at +13 / +36 / +59 / +82.
         Each pass: lock-on (Select), gunshot (Sharp Clap), detonate (Sharp Pop). */}
      <Cue from={312} src={sfx("sharp-long-whoosh.mp3")} volume={0.45} />
      {[13, 36, 59, 82].map((offset, i) => (
        <React.Fragment key={i}>
          <Cue from={312 + offset - 7} src={sfx("select-001.mp3")} volume={0.35} />
          <Cue from={312 + offset} src={sfx("sharp-clap.mp3")} volume={0.7} />
          <Cue from={312 + offset + 6} src={sfx("sharp-pop.mp3")} volume={0.55} />
        </React.Fragment>
      ))}

      {/* ── Scene 06 — HonestTraders (420–504) ───────────────────────
         Words stagger 0–1.7s; phase 2 scale-in at +47. */}
      <Cue from={422} src={sfx("mouse-click.mp3")} volume={0.4} />
      <Cue from={461} src={sfx("very-fast-cinematic-whoosh.mp3")} volume={0.5} />
      <Cue from={467} src={sfx("obtain-002-without-reverb.mp3")} volume={0.55} />

      {/* ── Scene 10 — Finale (504–648) ──────────────────────────────
         "gain more" preroll, fade at +38, square wipe +46→+60, endcard
         at +60, tagline around +86. */}
      <Cue from={504} src={sfx("sharp-long-whoosh.mp3")} volume={0.55} />
      <Cue from={550} src={sfx("epic-fast-whoosh.mp3")} volume={0.7} />
      <Cue from={564} src={sfx("obtain-002.mp3")} volume={0.65} />
      <Cue from={590} src={sfx("digital-click.mp3")} volume={0.45} />
    </>
  );
};
