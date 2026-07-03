// One world, one camera.
//
// The seven scene solves are chained into a single global path. Each scene
// keeps its local coordinate frame and is placed into the shared world by a
// rigid transform — a translation, plus a constant X-tilt for the two
// pitched scenes (Community/Outro parameterize the same picture with a
// pitched camera where Slot's solve is frontal). The transforms are chosen
// so the camera POSE (position and orientation) is continuous at every
// handoff.
//
// Why this is exact and not approximate: lerp1 clamps outside its key
// range, so every per-scene solve is frozen for a run of frames on both
// sides of its boundary. Each handoff frame below sits inside such a
// frozen-frozen window — the two solves agree not just at the joint but
// for every overlap frame around it, so no velocity reset can occur.
//   A @1705  ChartRoom frozen 1650→ / Buildings clamped →1725
//   B @3580  Buildings frozen 3555→ / Chart2 clamped →3600
//   C @4131  Chart2 frozen 4110→   / Slot solve clamped →4268 (= PAPER_CAM)
//   D @4263  same solve family (camSlot covers AdvDis+Slot) — nothing to join
//   E @4690  Slot table ends 4690  / Community translation clamped →4715,
//            orientation joined by the constant A_TILT
//   F @5280  Community frozen 5271→ / Outro clamped →5283 (pitch 30° both)

import type { V3 } from "./world";
import { camChartRoom } from "../scenes/ChartRoom";
import { camBld } from "../scenes/Buildings";
import { camChart2 } from "../scenes/Chart2";
import { camSlot } from "../scenes/floorPaper";
import { camCommunity } from "../scenes/Community";
import { camOutro } from "../scenes/Outro";

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const rotXv = (a: number, v: V3): V3 => [
  v[0],
  v[1] * Math.cos(a) - v[2] * Math.sin(a),
  v[1] * Math.sin(a) + v[2] * Math.cos(a),
];

// Handoff frames — each inside a frozen-frozen window (see header).
export const H = { A: 1705, B: 3580, C: 4131, E: 4690, F: 5280 } as const;

// Constant world tilt for the pitched scenes: at the E handoff the frontal
// slot camera and Community's pitched camera describe the same frame, so
// Community's region is tilted by exactly its entry pitch.
export const A_TILT = camCommunity(H.E).pitch;

// Scene→world translations, chained left to right (ChartRoom = identity).
export const T_BLD: V3 = sub(camChartRoom(H.A), camBld(H.A).cam);
export const T_C2: V3 = add(T_BLD, sub(camBld(H.B).cam, camChart2(H.B)));
export const T_SLOT: V3 = add(T_C2, sub(camChart2(H.C), camSlot(H.C)));
export const T_COMM: V3 = add(
  T_SLOT,
  sub(camSlot(H.E), rotXv(A_TILT, camCommunity(H.E).cam)),
);
// Frozen-equality placement of the outro region (both solves clamped at H.F).
const T_OUTRO_FROZEN: V3 = add(
  T_COMM,
  sub(rotXv(A_TILT, camCommunity(H.F).cam), rotXv(A_TILT, camOutro(H.F).pos)),
);

// Boundary-F bridge: the reference NEVER stops pulling back, but both local
// solves are frozen 5265→5283 (community translation clamps at 5265, the
// outro descent starts at 5283) — the merged camera would hold 18 duplicate
// frames. So the camera keeps gliding: an ease-in quadratic from the
// community end pose into the outro first key, whose end velocity equals
// the outro descent's own first-segment velocity (CAM_O 5283→5290 ≈
// [−2.14, −4.29, −2.86]/frame local). Displacement = 9 × that velocity;
// the outro region shifts by the same vector so the join stays exact.
const BRIDGE0 = 5265;
const BRIDGE1 = 5283;
const D_OUTRO: V3 = rotXv(A_TILT, [-19.3, -38.6, -25.7]);
export const T_OUTRO: V3 = add(T_OUTRO_FROZEN, D_OUTRO);

export type WorldPose = { pos: V3; rotX: number; rotZ: number };

export const worldCam = (f: number): WorldPose => {
  if (f < H.A) return { pos: camChartRoom(f), rotX: 0, rotZ: 0 };
  if (f < H.B) return { pos: add(camBld(f).cam, T_BLD), rotX: 0, rotZ: 0 };
  if (f < H.C) return { pos: add(camChart2(f), T_C2), rotX: 0, rotZ: 0 };
  if (f < H.E) return { pos: add(camSlot(f), T_SLOT), rotX: 0, rotZ: 0 };
  if (f < BRIDGE0) {
    const { cam, pitch } = camCommunity(f);
    return { pos: add(rotXv(A_TILT, cam), T_COMM), rotX: A_TILT - pitch, rotZ: 0 };
  }
  if (f < BRIDGE1) {
    const { cam, pitch } = camCommunity(f); // translation frozen; pitch ramps to 30° by 5271
    const t = (f - BRIDGE0) / (BRIDGE1 - BRIDGE0);
    const p0 = add(rotXv(A_TILT, cam), T_COMM);
    return {
      pos: [p0[0] + D_OUTRO[0] * t * t, p0[1] + D_OUTRO[1] * t * t, p0[2] + D_OUTRO[2] * t * t],
      rotX: A_TILT - pitch,
      rotZ: 0,
    };
  }
  const { pos, pitch, roll } = camOutro(f);
  return { pos: add(rotXv(A_TILT, pos), T_OUTRO), rotX: A_TILT - pitch, rotZ: roll };
};
