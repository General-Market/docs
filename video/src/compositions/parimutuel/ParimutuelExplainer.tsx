import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from "remotion";
import { IdleZoom } from "../anticheat/vibe";
import { BlueField } from "../anticheat-edit/props/BlueField";
import { font, scene } from "../anticheat-edit/props/tokens";
import { FPS, H, SCHEDULE, TOTAL_FRAMES, W, type BeatKey } from "./theme";
import {
  CostBeat,
  FlowBeat,
  GuaranteesBeat,
  LandingBeat,
  PotBeat,
  QuestionBeat,
  ScaleBeat,
  ThresholdBeat,
} from "./beats";

// ParimutuelExplainer — how the batch market resists being rigged, told as a
// chain of state transformations over one continuous blue field.
//
//   one question → the threshold → A + B = C → B → A → × 10,000 → cost → why.
//
// The field never cuts; only the content on top of it transforms. Silent and
// text-driven: a music bed (Eternal Odyssey, entering on its "hope rising"
// beat) plus a faint tech-hum atmosphere carry the pacing. No voice.

const BEAT_COMPONENTS: Record<BeatKey, React.FC<{ durationInFrames: number }>> = {
  question: QuestionBeat,
  threshold: ThresholdBeat,
  pot: PotBeat,
  flow: FlowBeat,
  scale: ScaleBeat,
  cost: CostBeat,
  guarantees: GuaranteesBeat,
  landing: LandingBeat,
};

// Eternal Odyssey enters on its turn (89.211s into the source); play it as a
// bed, a touch louder than the talk's ducked level since there's no voice.
const MUSIC_TRIM = Math.round(89.211 * FPS);

export const ParimutuelExplainer: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: scene.blueAbyss, fontFamily: font }}>
      <Audio
        src={staticFile("anticheat-edit/music/03-eternal-odyssey.mp3")}
        trimBefore={MUSIC_TRIM}
        volume={(f) =>
          interpolate(
            f,
            [0, 24, TOTAL_FRAMES - 44, TOTAL_FRAMES],
            [0, 0.34, 0.34, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      <Audio
        src={staticFile("anticheat-edit/atmos/tech-hum.mp3")}
        volume={(f) =>
          interpolate(
            f,
            [0, 30, TOTAL_FRAMES - 44, TOTAL_FRAMES],
            [0, 0.12, 0.12, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />

      <IdleZoom durationInFrames={TOTAL_FRAMES} from={1.0} to={1.04}>
        <BlueField />
        {SCHEDULE.map((slot) => {
          const Comp = BEAT_COMPONENTS[slot.key];
          return (
            <Sequence
              key={slot.key}
              from={slot.from}
              durationInFrames={slot.durationInFrames}
              name={slot.key}
            >
              <Comp durationInFrames={slot.durationInFrames} />
            </Sequence>
          );
        })}
      </IdleZoom>
    </AbsoluteFill>
  );
};

export const parimutuelExplainerMeta = {
  id: "ParimutuelExplainer",
  component: ParimutuelExplainer,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
