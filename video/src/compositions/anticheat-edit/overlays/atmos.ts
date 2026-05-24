// Atmosphere timeline — low beds under the music (Epidemic Sound, lqmp3).
//
// final.mp4 seconds. Mixed near-invisible (gain 0.03–0.06) — felt, not heard.
// Everything dark ENDS by the speech end (~645s, on "…your counterparty"):
// when the machine stops, its textures stop, and the warm outro arrives in
// clean air — the score plays on through the end card. Files in
// public/anticheat-edit/atmos/.

export type AtmosCue = {
  at: number;
  until: number;
  file: string;
  gain: number;
  loop: boolean;
  label: string;
};

export const ATMOS_CUES: AtmosCue[] = [
  { at: 28, until: 645, file: "tech-hum.mp3", gain: 0.035, loop: true, label: "tech hum — institutional machine (body bed)" },
  { at: 238, until: 339, file: "dark-drone.mp3", gain: 0.04, loop: true, label: "dark drone — §4 paranoia" },
  { at: 433, until: 645, file: "dark-drone.mp3", gain: 0.045, loop: true, label: "dark drone — §6 menace → §8 dread" },
  { at: 516, until: 602, file: "clock-tick-loop.mp3", gain: 0.035, loop: true, label: "clock tick — §7 statistical bleed" },
  { at: 588, until: 645, file: "sub-rumble.mp3", gain: 0.06, loop: false, label: "sub rumble — into the §8 dread peak" },
  { at: 602, until: 645, file: "heartbeat.mp3", gain: 0.05, loop: false, label: "heartbeat — §8 dread peak" },
];
