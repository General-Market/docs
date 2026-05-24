// Music timeline — one curated track per emotional movement of the talk.
//
// The speech ends at 10:45 and the outro end card holds after it (composition
// runs to 652.1s; see MUSIC_END). The final cue plays on through the card. Four
// cues carry the arc:
//   dark exposé (Pitch-Black City → Mammoth) → the turn (Eternal Odyssey) →
//   the warm close (Don't Lose Faith). Three changes across the whole film.
//
// `at`/`until` are final.mp4 seconds — `at` lands on a section boundary from
// overlays/timeline.tsx (a real emotional turn in the talk). `trimStart` is the
// punchy entry point *inside* the source track, chosen from the energy curve so
// the music lands at force on the first frame — never the slow 0:00 climb. Each
// trimStart is an exact beat of its track (scripts/analyze_music). Cues loop the
// trimmed segment (so a loop re-entry is just as punchy as the first), with a
// short crossfade at the seam, and never fall silent under a long section.
//
// `gain` is the ducked level under the voice (the voice lives in final.mp4).
// Files live in public/anticheat-edit/music/, copied from the ES_* downloads.

export type MusicCue = {
  /** final.mp4 second where this track starts (a section boundary). */
  at: number;
  /** final.mp4 second where this track ends (next cue's `at`, or MUSIC_END). */
  until: number;
  /** filename under public/anticheat-edit/music/ */
  file: string;
  /** punchy entry inside the source track, in track-seconds (an exact beat). */
  trimStart: number;
  /** full length of the source track, in seconds (from ffprobe). */
  trackDuration: number;
  /** ducked volume under the voice. */
  gain: number;
  label: string;
};

// End of the music — the END of the composition, not the baked talk. The
// speech is cut at 10:45 ("Always choose who is your counterparty.") and the
// outro end card holds after it; the warm close now plays ON through the card
// and fades out on its final frame. This equals compositionDurationFrames / FPS
// in AntiCheatEditComposition (SPEECH_END_SEC 645.2 − crossfade + end card =
// 19563 frames @ 30). Keep the two in sync if the cut moves.
export const MUSIC_END = 652.1;

/**
 * Section play-times the cues are pinned to (overlays/timeline.tsx):
 *   0       cold open
 *   146.696 M4 Listing Front-Running (mid-exposé hand-off)
 *   482.045 the turn — "but there are solutions" (turn-thin-field)
 *   618.815 the close (turn-infra-gap → outro)
 */
export const MUSIC_CUES: MusicCue[] = [
  {
    // Cold, intelligent, investigative. Dense from its first note — opens on a
    // forceful accent (E≈0.75 at 13.096s), so the chill lands at frame one.
    at: 0,
    until: 146.696,
    file: "01-pitch-black-city.mp3",
    trimStart: 13.096,
    trackDuration: 120.833,
    gain: 0.17,
    label: "§exposé A — cold open + M1-M3 — Pitch-Black City",
  },
  {
    // The machine that never stops favouring the house. Enter on the rise into
    // the relentless ostinato wall (E 0.18→0.82 at 21.525s) — the rig, locked.
    at: 146.696,
    until: 482.045,
    file: "02-mammoth.mp3",
    trimStart: 21.525,
    trackDuration: 218.182,
    gain: 0.15,
    label: "§exposé B — M4-M13 into the dread — Mammoth",
  },
  {
    // The turn. Major-key ascension. Enter on the lift (89.211s) so it climbs
    // into the sustained-high plateau (105-155s) exactly as the answer lands.
    at: 482.045,
    until: 618.815,
    file: "03-eternal-odyssey.mp3",
    trimStart: 89.211,
    trackDuration: 179.667,
    gain: 0.22,
    label: "§turn — the solution, hope rising — Eternal Odyssey",
  },
  {
    // The close — warm, resolved. Enter just before the warm peak (74.234s) so
    // the resolution swells across the outro. A gift, understated.
    at: 618.815,
    until: MUSIC_END,
    file: "04-dont-lose-faith.mp3",
    trimStart: 74.234,
    trackDuration: 122.007,
    gain: 0.2,
    label: "§outro — the warm close — Don't Lose Faith",
  },
];
