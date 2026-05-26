import React from "react";
import { Sequence, useCurrentFrame } from "remotion";
import { FIELD_BG, Stage } from "./chrome";
import {
  BOARD_H,
  BOARD_W,
  cameraAt,
  cellOrigin,
  FOCUS,
  FPS,
  H,
  LEAD,
  TOTAL_FRAMES,
  W,
  type BeatKey,
} from "./theme";
import {
  EnterBeat,
  PayoutBeat,
  PoolBeat,
  ProductBeat,
  SettleBeat,
  TradersBeat,
} from "./beats-mechanism";
import { MultiplyBeat, UnlockBeat } from "./beats-scale";

// BatchFlowReel — one board, not nine scenes. Every schematic sits in its own
// cell of a 3×3 board; a camera rests on each in turn and, between them, pulls
// all the way back to show the whole board before diving into the next cell.

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

// The board's paper: #F0F2F4 ground with a fine Base-blue dot lattice, painted
// as a CSS tile so it scales seamlessly with the camera (no SVG seams, no flicker).
const boardField: React.CSSProperties = {
  background: FIELD_BG,
  backgroundImage:
    "radial-gradient(circle, rgba(0,113,227,0.22) 1.2px, transparent 1.5px)",
  backgroundSize: "14px 14px",
};

export const BatchFlowReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { scale, fx, fy } = cameraAt(frame);
  // place the focused board point under the viewport centre
  const tx = W / 2 - fx * scale;
  const ty = H / 2 - fy * scale;

  return (
    <Stage>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: BOARD_W,
          height: BOARD_H,
          transformOrigin: "0 0",
          transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(5)})`,
          willChange: "transform",
          ...boardField,
        }}
      >
        {FOCUS.map((f) => {
          const Comp = REGISTRY[f.key];
          if (!Comp) return null;
          const [ox, oy] = cellOrigin(f.key);
          // begin building LEAD frames before the camera lands, so we arrive on
          // a schematic already in motion; hold the final state afterwards.
          const start = Math.max(0, f.from - LEAD);
          return (
            <div
              key={f.key}
              style={{ position: "absolute", left: ox, top: oy, width: W, height: H, overflow: "hidden" }}
            >
              <Sequence from={start} name={f.key}>
                <Comp durationInFrames={f.durationInFrames + LEAD} />
              </Sequence>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

export const batchFlowReelMeta = {
  id: "BatchFlowReel",
  component: BatchFlowReel,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
