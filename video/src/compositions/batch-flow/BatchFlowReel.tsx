import React from "react";
import { Sequence } from "remotion";
import { Stage } from "./chrome";
import { FPS, H, SCHEDULE, TOTAL_FRAMES, W, type BeatKey } from "./theme";
import {
  EnterBeat,
  PayoutBeat,
  PoolBeat,
  ProductBeat,
  SettleBeat,
  TradersBeat,
} from "./beats-mechanism";
import { MultiplyBeat, UnlockBeat } from "./beats-scale";

// BatchFlowReel — from the product UI to the throughput graph, in the RetailPnL
// CRT/neon style. One persistent Stage; each beat is a Sequence on top of it.
// Beats are added to REGISTRY as they're built (phased).

const REGISTRY: Partial<Record<BeatKey, React.FC<{ durationInFrames: number }>>> = {
  product: ProductBeat,
  enter: EnterBeat,
  traders: TradersBeat,
  pool: PoolBeat,
  settle: SettleBeat,
  payout: PayoutBeat,
  multiply: MultiplyBeat,
  unlock: UnlockBeat,
};

export const BatchFlowReel: React.FC = () => (
  <Stage>
    {SCHEDULE.map((slot) => {
      const Comp = REGISTRY[slot.key];
      if (!Comp) return null;
      return (
        <Sequence key={slot.key} from={slot.from} durationInFrames={slot.durationInFrames} name={slot.key}>
          <Comp durationInFrames={slot.durationInFrames} />
        </Sequence>
      );
    })}
  </Stage>
);

export const batchFlowReelMeta = {
  id: "BatchFlowReel",
  component: BatchFlowReel,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
