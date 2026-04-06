import React from "react";
import { SFXTrigger, type SFXEvent } from "../../../lib/components/Audio/SFXTrigger";
import sfxEventsData from "./sfx-events.json";

const sfxEvents: SFXEvent[] = sfxEventsData as SFXEvent[];

export const GMBrandSFX: React.FC = () => {
  return <SFXTrigger sfxDir="sfx" events={sfxEvents} />;
};
