import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import type { SfxDef } from "../sfxMap";
import { PLOB } from "../sfxMap";

// ── Types ──────────────────────────────────────────────────────────────

export interface SfxEvent {
  /** Frame offset from parent Sequence start. Default: 0 */
  at?: number;
  /** Sound file name (string) or SfxDef role from sfxMap */
  sound?: string | SfxDef;
  /** Volume override (takes precedence over SfxDef.vol) */
  volume?: number;
  /** How many frames the Audio element lives. Default: 45 */
  duration?: number;
}

interface SfxProps {
  /**
   * Sound name (string), SfxDef role, or array of timed events.
   * Omit entirely for the default plob.
   *
   * @example <Sfx sound={TICK}><Chart /></Sfx>
   * @example <Sfx sound="scroll-tick"><Chart /></Sfx>
   * @example <Sfx sound={[{ sound: PLOB }, { at: 10, sound: TICK }]}><Card /></Sfx>
   */
  sound?: string | SfxDef | SfxEvent[];
  /** Volume override 0-1 (takes precedence over SfxDef.vol). Default: from SfxDef or 0.25 */
  volume?: number;
  /** Delay in frames from parent Sequence start. Default: 0 */
  delay?: number;
  /** Audio element duration in frames. Default: 45 */
  duration?: number;
  children?: React.ReactNode;
}

// ── Defaults ───────────────────────────────────────────────────────────

const DEFAULT_DUR = 45;

// ── Resolve SfxDef or string to file + vol ─────────────────────────────

function resolve(s: string | SfxDef | undefined): { file: string; vol: number } {
  if (!s) return { file: PLOB.file, vol: PLOB.vol };
  if (typeof s === "string") return { file: s, vol: PLOB.vol };
  return { file: s.file, vol: s.vol };
}

const sfxPath = (name: string) =>
  staticFile(`sfx/${name}${name.endsWith(".mp3") ? "" : ".mp3"}`);

// ── Component ──────────────────────────────────────────────────────────

export const Sfx: React.FC<SfxProps> = ({
  sound,
  volume,
  delay = 0,
  duration = DEFAULT_DUR,
  children,
}) => {
  // Normalize to event array
  const events: SfxEvent[] = Array.isArray(sound)
    ? sound
    : [{ at: delay, sound: sound ?? PLOB, volume, duration }];

  return (
    <>
      {children}
      {events.map((e, i) => {
        const at = e.at ?? delay;
        const { file, vol: defVol } = resolve(e.sound);
        const vol = e.volume ?? volume ?? defVol;
        const dur = e.duration ?? duration;

        return (
          <Sequence key={i} from={at} durationInFrames={dur} layout="none">
            <Audio src={sfxPath(file)} volume={vol} />
          </Sequence>
        );
      })}
    </>
  );
};
