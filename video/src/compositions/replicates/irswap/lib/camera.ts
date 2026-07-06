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

import { DCAM } from "./world";
import type { V3 } from "./world";
import { PIVOT_XZ } from "../data/buildings3d";
import { camChartRoom, camChartRoomYaw } from "../scenes/ChartRoom";
import { camBld } from "../scenes/Buildings";
import { camChart2, camChart2Yaw } from "../scenes/Chart2";
import { camSlot } from "../scenes/floorPaper";
import { camCommunity } from "../scenes/Community";
import { camOutro, outroD } from "../scenes/Outro";

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

export type WorldPose = { pos: V3; rotX: number; rotZ: number; rotY?: number; fov?: number };

// ── Buildings interior: real pitched aerial camera ───────────────────────
// The buildings/floor/plaques are real meshes at fixed world coords. camBld
// is a FLAT turntable (position + yaw g, no pitch) that faked a pitched view;
// a turntable cannot foreshorten near vs far the way a genuine downward pitch
// does, so the near building always ballooned. Here worldCam gives the shared
// camera a real downward PITCH (rotX<0) — with an optional depth dolly-back
// (BLD_RADIUS, 1 = off). The tilt is
// built AROUND a fixed anchor Q — the turntabled centroid of the three
// building footprints on the floor: at every pitch Q keeps its flat-camera
// screen position, so the cluster stays framed exactly where the tuned flat
// solve placed it and only the view angle changes (near drops, far rises,
// roofs open up). The turntable g still drives azimuth (untouched), so
// arrows/floor/plaques ride along for free. Pinned to the flat pose at both
// handoffs: the envelope is 0 at f≤1725 and f≥3570, where this reduces
// EXACTLY to add(camBld.cam,T_BLD), rotX=0 — so T_BLD/T_C2 and every
// downstream transform are unchanged.
const BLD_PIVOT_Y = -170; // anchor height = floor
// Peak downward pitch (rad). The camera pitches about world-X only (rotZ=0,
// no roll) so the ground horizon stays level; the pitch converts world depth
// into screen height. The buildings were bundle-adjusted under the FLAT
// (yaw-only, look-along-z) solve, so their depths are consistent with a flat
// camera in 2D but sit ~90u apart in depth (LENDER near, BANK mid, COMPANY
// far). A strong pitch turns that residual depth-spread into a big vertical
// stagger — LENDER over-drops, COMPANY over-rises — which reads as a rolled/
// arced building row. Measured against the reference (base contacts at
// f2630: LENDER≈431 BANK≈397 COMPANY≈369; f3300: COMPANY≈411 BANK≈417) the
// reference buildings sit near-flat while its far-reaching ground still
// recedes; both gate frames fit a pitch of ≈0.09-0.12 rad (5-7°), NOT 0.3.
// At ≈0.10 the front-row tilt (BANK-LENDER) and COMPANY's set-back rise both
// match the reference within a few px at f2630/f3300. 0.3/17° over-spread the
// row (LENDER 37px too low, reads as a rolled/arced row); 0.44/25° keystoned.
// The ground still opens up because the floor plane extends far in depth,
// where even a mild pitch reveals recede.
const BLD_PITCH = 0.1;
const BLD_RADIUS = 1.0; // depth dolly-back (1 = pure pitch, buildings full size)
const BLD_MEAN_MID: [number, number] = [-6.986, -95.892]; // mean of B3D mids (xz)
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// 0 at the frozen boundaries, 1 across the live interior.
const bldEnv = (f: number) =>
  Math.min(smooth((f - 1725) / 80), 1 - smooth((f - 3524) / 46));
// Current downward pitch of the buildings camera (rad, ≥0). The rate
// arrow/label planes counter-rotate by this so they stay screen-upright
// (see ArrowPlanes). 0 at both frozen handoffs, so nothing to counter there.
export const bldPitchAt = (f: number): number => BLD_PITCH * bldEnv(f);
const rotXZg = (x: number, z: number, g: number): [number, number] => {
  const c = Math.cos(g);
  const s = Math.sin(g);
  const dx = x - PIVOT_XZ[0];
  const dz = z - PIVOT_XZ[1];
  return [PIVOT_XZ[0] + c * dx + s * dz, PIVOT_XZ[1] - s * dx + c * dz];
};
export const buildingsPose = (f: number): WorldPose => {
  const { cam, g } = camBld(f);
  const env = bldEnv(f);
  if (env <= 0) return { pos: add(cam, T_BLD), rotX: 0, rotZ: 0 };
  const e = BLD_PITCH * env;
  const rf = 1 + (BLD_RADIUS - 1) * env;
  // Anchor Q = turntabled cluster centroid on the floor.
  const [Qx, Qz] = rotXZg(BLD_MEAN_MID[0], BLD_MEAN_MID[1], g);
  const Qy = BLD_PIVOT_Y;
  const dz0 = cam[2] - Qz; // flat camera-space depth of Q
  const u0 = 427 + (DCAM * (Qx - cam[0])) / dz0; // Q's flat screen position
  const v0 = 240 - (DCAM * (Qy - cam[1])) / dz0;
  // Back-project (u0,v0) through the pitched camera and place it a dollied
  // depth t = dz0·rf back along that world ray, so Q re-projects to (u0,v0).
  const rlx = (u0 - 427) / DCAM;
  const rly = (240 - v0) / DCAM;
  const ce = Math.cos(e);
  const se = Math.sin(e);
  const mx = rlx; // m = Rx(-e)·(rlx,rly,-1)
  const my = ce * rly - se;
  const mz = -se * rly - ce;
  const t = dz0 * rf;
  const pos: V3 = [
    Qx - t * mx + T_BLD[0],
    Qy - t * my + T_BLD[1],
    Qz - t * mz + T_BLD[2],
  ];
  return { pos, rotX: -e, rotZ: 0 };
};

export const worldCam = (f: number): WorldPose => {
  if (f < H.A) return { pos: camChartRoom(f), rotX: 0, rotZ: 0, rotY: camChartRoomYaw(f) };
  if (f < H.B) return buildingsPose(f);
  // Chart2 orbits like B/C: rotY from the round-3 refit (0 at both
  // handoffs, so the frozen-window joins are untouched).
  if (f < H.C) return { pos: add(camChart2(f), T_C2), rotX: 0, rotZ: 0, rotY: camChart2Yaw(f) };
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
  // r9: the outro runs a measured lens move (the ref's settle era is a
  // real 3D render at f~560, not this world's 659.38) — D ramps inside
  // the whiteout (5286-5296) and the fov rides it. outroD(5283-5285) =
  // DCAM exactly, so the boundary keeps the global 40-degree lens.
  const { pos, pitch, roll } = camOutro(f);
  const fov = (2 * Math.atan(240 / outroD(f)) * 180) / Math.PI;
  return { pos: add(rotXv(A_TILT, pos), T_OUTRO), rotX: A_TILT - pitch, rotZ: roll, fov };
};
