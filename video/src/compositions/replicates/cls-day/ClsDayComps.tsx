// cls-day lane barrel — RootReplicas.tsx imports ONLY this file.
// Comp ids and export names are stable: ClsDay-Replicate, ClsDay-SideBySide,
// CrxSettlementDay. Ref: public/cls-day-original.mp4 (1920×1080, 25fps, 3750f).
import { ClsDayReplicate } from "./ClsDayReplicate";
import { ClsDaySideBySide } from "./ClsDaySideBySide";
import { CrxSettlementDay } from "./CrxSettlementDay";
import { DURATION, FPS, H, W } from "./data";

export const clsDayReplicateMeta = {
  id: "ClsDay-Replicate",
  component: ClsDayReplicate,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};

export const clsDaySideBySideMeta = {
  id: "ClsDay-SideBySide",
  component: ClsDaySideBySide,
  durationInFrames: DURATION,
  fps: FPS,
  width: W * 2,
  height: H,
};

export const crxSettlementDayMeta = {
  id: "CrxSettlementDay",
  component: CrxSettlementDay,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
