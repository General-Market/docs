import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

// ── Types ──────────────────────────────────────────────────────────────

interface SfxEvent {
  /** Frame offset from parent Sequence start. Default: 0 */
  at?: number;
  /** Sound file name without path or extension (e.g. "comedy-plop") */
  sound?: string;
  /** Volume 0-1 */
  volume?: number;
  /** How many frames the Audio element lives. Default: 45 */
  duration?: number;
}

interface SfxProps {
  /**
   * Single sound name, or array of timed sound events.
   * Omit entirely for the default plob.
   *
   * @example <Sfx sound="scroll-tick"><Card /></Sfx>
   * @example <Sfx sound={[{ sound: "comedy-plop" }, { at: 10, sound: "scroll-tick" }]}><Card /></Sfx>
   */
  sound?: string | SfxEvent[];
  /** Volume 0-1. Default: 0.25 */
  volume?: number;
  /** Delay in frames from parent Sequence start. Default: 0 */
  delay?: number;
  /** Audio element duration in frames. Default: 45 */
  duration?: number;
  children?: React.ReactNode;
}

// ── Defaults ───────────────────────────────────────────────────────────

const DEFAULT_SOUND = "comedy-plop";
const DEFAULT_VOL = 0.25;
const DEFAULT_DUR = 45;

// ── Resolve a sound name to its static path ────────────────────────────

const sfxPath = (name: string) =>
  staticFile(`sfx/${name}${name.endsWith(".mp3") ? "" : ".mp3"}`);

// ── Component ──────────────────────────────────────────────────────────

/**
 * Wrap any visual element — it plays a sound when it enters.
 *
 * The sound is a property of the action. Move the parent <Sequence>,
 * the sound follows. No manual frame math, no separate Audio tags.
 *
 * ```tsx
 * // Default plob on appear:
 * <Sfx><Card /></Sfx>
 *
 * // Custom sound:
 * <Sfx sound="scroll-tick" volume={0.4}><Counter /></Sfx>
 *
 * // Multi-step:
 * <Sfx sound={[
 *   { sound: "comedy-plop" },
 *   { at: 15, sound: "scroll-tick" },
 * ]}><MyAnimation /></Sfx>
 *
 * // Sound only, no visual:
 * <Sfx sound="impact-kick" volume={0.5} />
 * ```
 */
export const Sfx: React.FC<SfxProps> = ({
  sound,
  volume = DEFAULT_VOL,
  delay = 0,
  duration = DEFAULT_DUR,
  children,
}) => {
  // Normalize to event array
  const events: SfxEvent[] = Array.isArray(sound)
    ? sound
    : [{ at: delay, sound: typeof sound === "string" ? sound : DEFAULT_SOUND, volume, duration }];

  return (
    <>
      {children}
      {events.map((e, i) => {
        const at = e.at ?? delay;
        const file = e.sound ?? DEFAULT_SOUND;
        const vol = e.volume ?? volume;
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
