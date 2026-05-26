import React from "react";
import { Freeze, useCurrentFrame } from "remotion";
import { FIELD_BG, Stage } from "./chrome";
import {
  BOARD_H,
  BOARD_W,
  cameraAt,
  cellOrigin,
  FOCUS,
  font,
  FPS,
  H,
  PILL_GRADIENT,
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

// BatchFlowReel — one board, fully drawn. Every schematic sits finished in its
// own cell of a 3×3 board from the first frame, so a pull-back always shows the
// whole thing. The camera opens on the entire board, glides into the first cell,
// then pans station to station like a whiteboard video, and pulls back out at
// the end. Each station carries its step number.

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

const StepBadge: React.FC<{ n: number }> = ({ n }) => (
  <div
    style={{
      position: "absolute",
      left: 60,
      top: 54,
      width: 86,
      height: 86,
      borderRadius: 86,
      background: PILL_GRADIENT,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: font,
      fontWeight: 800,
      fontSize: 48,
      color: "#fff",
      border: "2px solid rgba(255,255,255,0.55)",
      boxShadow:
        "0 14px 32px rgba(94,120,255,0.42), 0 3px 10px rgba(0,113,227,0.3), inset 0 1px 0 rgba(255,255,255,0.5)",
    }}
  >
    {n}
  </div>
);

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
        {FOCUS.map((f, i) => {
          const Comp = REGISTRY[f.key];
          if (!Comp) return null;
          const [ox, oy] = cellOrigin(f.key);
          return (
            <div
              key={f.key}
              style={{ position: "absolute", left: ox, top: oy, width: W, height: H, overflow: "hidden" }}
            >
              {/* drawn and held at its finished state, so the board is complete
                  on every frame — the camera tours it, it does not build on arrival */}
              <Freeze frame={f.durationInFrames}>
                <Comp durationInFrames={f.durationInFrames} />
              </Freeze>
              <StepBadge n={i + 1} />
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
