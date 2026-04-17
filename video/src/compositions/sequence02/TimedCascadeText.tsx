/**
 * TimedCascadeText — CascadeText wrapped in a Sequence so its entry
 * animation fires from the moment it appears in the timeline.
 *
 * Without this wrapper, CascadeText's internal useCurrentFrame() returns
 * the composition-absolute frame, and late-mounted text cuts in fully
 * formed instead of rising through its blur-and-lift curve.
 */

import React from "react";
import { Sequence } from "remotion";
import { CascadeText } from "../../lib/components/Text";
import type { CascadeTextProps } from "../../lib/components/Text";

export interface TimedCascadeTextProps extends CascadeTextProps {
  /** First frame the text appears (composition-absolute). */
  from: number;
  /** How long the text stays mounted, in frames. */
  duration: number;
}

export const TimedCascadeText: React.FC<TimedCascadeTextProps> = ({
  from,
  duration,
  ...cascadeProps
}) => {
  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <CascadeText {...cascadeProps} />
    </Sequence>
  );
};
