import React from "react";
import { SFXTrigger, type SFXEvent } from "../../lib/components/Audio/SFXTrigger";
import sfxEventsData from "./sfx-events.json";

/**
 * All 282 SFX events extracted from the original OF audio via demucs stem
 * separation + librosa onset detection. Each clip is a normalized WAV slice
 * from the isolated "other" stem (no music, no vocals).
 *
 * Categories: impact, whoosh, reveal, click, sparkle
 * Source files: public/sfx/of-extracted/s0N_fNNNN_category.wav
 */
const sfxEvents: SFXEvent[] = sfxEventsData as SFXEvent[];

export const OFReplicateSFX: React.FC = () => {
  return (
    <SFXTrigger
      sfxDir="sfx/of-extracted"
      events={sfxEvents}
    />
  );
};
