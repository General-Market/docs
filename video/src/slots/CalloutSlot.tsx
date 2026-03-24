import React from "react";
import type { ShotDef } from "./types";
import { DataCallout } from "../shorts/short-01/components/DataCallout";

interface Props {
  shot: ShotDef;
}

export const CalloutSlot: React.FC<Props> = ({ shot }) => {
  if (!shot.dataCallout && !shot.secondaryCallout && !shot.callouts?.length) {
    return null;
  }

  return (
    <>
      {shot.dataCallout && <DataCallout callout={shot.dataCallout} />}
      {shot.secondaryCallout && <DataCallout callout={shot.secondaryCallout} />}
      {shot.callouts?.map((callout, i) => (
        <DataCallout key={`${callout.text}-${i}`} callout={callout} />
      ))}
    </>
  );
};
