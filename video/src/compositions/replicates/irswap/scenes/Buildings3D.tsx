// True-3D buildings + world-plane arrow columns (frames 1705-3587).
// Buildings are rigid extruded solids (gable pentagons, side walls, two
// roof slopes, chimney) standing in the world; silhouettes foreshorten
// with the camera. The rate arrows/labels live on two vertical planes
// over the streets, measured ~99 deg apart in 3D (fit from the
// reference's perspective foreshortening).

import React, { useMemo } from "react";
import * as THREE from "three";
import { CanvasPlane } from "../lib/world";
import type { V3 } from "../lib/world";
import {
  ARR3D, B3D, B3D_DECOR, FLOOR_Y_3D, LBL3D, PIVOT_XZ, PLANE_ANCHOR, PLANES,
} from "../data/buildings3d";
import type { Building3DDef } from "../data/buildings3d";

// yaw about the shared pivot (same convention as rotP in Buildings.tsx)
const rotXZ = (x: number, z: number, g: number): [number, number] => {
  const c = Math.cos(g);
  const s = Math.sin(g);
  const dx = x - PIVOT_XZ[0];
  const dz = z - PIVOT_XZ[1];
  return [PIVOT_XZ[0] + c * dx + s * dz, PIVOT_XZ[1] - s * dx + c * dz];
};

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const useStaticTex = (w: number, h: number, draw: DrawFn, res = 2, mirror = false) =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(w * res));
    c.height = Math.max(2, Math.round(h * res));
    const ctx = c.getContext("2d");
    if (ctx) {
      // mirrored faces are flipped 180° about their local Y; pre-mirror the
      // art so the viewer still sees it with the original chirality
      if (mirror) ctx.setTransform(-res, 0, 0, res, c.width, 0);
      else ctx.setTransform(res, 0, 0, res, 0, 0);
      draw(ctx, w, h);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [w, h, draw, res, mirror]);

type FaceSpec = {
  key: string;
  w: number;
  h: number;
  draw: DrawFn;
  position: V3;
  rotation?: [number, number, number];
  quaternion?: THREE.Quaternion;
  mirror?: boolean;
};

// Enforce outward normals so FrontSide culling hides the interior: the
// reference fades buildings in as flat icons — no internal far-wall edges
// may show through during the transparency ramp.
const orientOutward = (faces: FaceSpec[], center: V3): FaceSpec[] =>
  faces.map((f) => {
    const q = f.quaternion
      ? f.quaternion.clone()
      : new THREE.Quaternion().setFromEuler(new THREE.Euler(...(f.rotation ?? [0, 0, 0])));
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const d = new THREE.Vector3(
      f.position[0] - center[0],
      f.position[1] - center[1],
      f.position[2] - center[2],
    );
    if (d.lengthSq() < 1e-9 || n.dot(d) >= 0) return f;
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    return { ...f, rotation: undefined, quaternion: q, mirror: !f.mirror };
  });

const Face: React.FC<{
  w: number;
  h: number;
  draw: DrawFn;
  position: V3;
  rotation?: [number, number, number];
  quaternion?: THREE.Quaternion;
  opacity: number;
  renderOrder: number;
  mirror?: boolean;
}> = ({ w, h, draw, position, rotation, quaternion, opacity, renderOrder, mirror }) => {
  const tex = useStaticTex(w, h, draw, 2, mirror);
  return (
    <mesh position={position} rotation={rotation} quaternion={quaternion} renderOrder={renderOrder}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={opacity}
        depthWrite
        alphaTest={0.02}
        side={THREE.FrontSide}
        toneMapped={false}
      />
    </mesh>
  );
};

// ── face painters ────────────────────────────────────────────────
// Fills bleed to the exact canvas edges (no transparent margins — margins
// read as white seams between adjoining faces); strokes are inset.
const OUT_W = 2.5;

type ClassicDecor = typeof B3D_DECOR.lender | typeof B3D_DECOR.bank;

const pentaPath = (ctx: CanvasRenderingContext2D, w: number, h: number, Hw: number, inset = 0) => {
  const eave = h - Hw;
  ctx.beginPath();
  ctx.moveTo(w / 2, inset);
  ctx.lineTo(w - inset, eave + inset * 0.5);
  ctx.lineTo(w - inset, h - inset);
  ctx.lineTo(inset, h - inset);
  ctx.lineTo(inset, eave + inset * 0.5);
  ctx.closePath();
};

// column slot with a rounded (arched) top
const colPath = (ctx: CanvasRenderingContext2D, x0: number, y0: number, cw: number, y1: number) => {
  const r = cw / 2;
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  ctx.lineTo(x0, y0 + r);
  ctx.arc(x0 + r, y0 + r, r, Math.PI, 0);
  ctx.lineTo(x0 + cw, y1);
  ctx.closePath();
};

const drawClassicFront = (def: Building3DDef, decor: ClassicDecor): DrawFn => (ctx, w, h) => {
  const { Hw } = def;
  const eave = h - Hw;
  pentaPath(ctx, w, h, Hw);
  ctx.fillStyle = decor.fill;
  ctx.fill();
  // base strip
  const st = decor.strip;
  ctx.fillStyle = st.fill;
  ctx.fillRect(st.u0 * w, h - Hw * st.y1, (st.u1 - st.u0) * w, Hw * (st.y1 - st.y0));
  ctx.strokeStyle = decor.outline;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(st.u0 * w, h - Hw * st.y1, (st.u1 - st.u0) * w, Hw * (st.y1 - st.y0));
  // columns (arched tops)
  const cd = decor.cols;
  for (let i = 0; i < cd.n; i++) {
    const cx = (cd.c0 + i * cd.pitch) * w;
    const x0 = cx - (cd.w * w) / 2;
    const y0 = h - Hw * cd.top;
    const y1 = h - Hw * cd.bot;
    colPath(ctx, x0, y0, cd.w * w, y1);
    ctx.fillStyle = cd.fill;
    ctx.fill();
    ctx.strokeStyle = decor.outline;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
  // outline + architrave
  pentaPath(ctx, w, h, Hw, 1.2);
  ctx.strokeStyle = decor.outline;
  ctx.lineWidth = OUT_W;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1.2, eave);
  ctx.lineTo(w - 1.2, eave);
  ctx.stroke();
};

const drawPentaPlain = (def: Building3DDef, fill: string, outline: string): DrawFn => (ctx, w, h) => {
  pentaPath(ctx, w, h, def.Hw);
  ctx.fillStyle = fill;
  ctx.fill();
  pentaPath(ctx, w, h, def.Hw, 1.2);
  ctx.strokeStyle = outline;
  ctx.lineWidth = OUT_W;
  ctx.lineJoin = "round";
  ctx.stroke();
};

const drawHouseFront = (def: Building3DDef, decor: typeof B3D_DECOR.company): DrawFn => (ctx, w, h) => {
  const { Hw } = def;
  pentaPath(ctx, w, h, Hw);
  ctx.fillStyle = decor.fill;
  ctx.fill();
  // door with arched top
  const d = decor.door;
  const y0 = h - Hw * d.top;
  const dw = (d.u1 - d.u0) * w;
  const r = dw / 2;
  ctx.beginPath();
  ctx.moveTo(d.u0 * w, h - 1);
  ctx.lineTo(d.u0 * w, y0 + r);
  ctx.arc(d.u0 * w + r, y0 + r, r, Math.PI, 0);
  ctx.lineTo(d.u1 * w, h - 1);
  ctx.closePath();
  ctx.fillStyle = d.fill;
  ctx.fill();
  ctx.strokeStyle = decor.outline;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  pentaPath(ctx, w, h, Hw, 1.2);
  ctx.strokeStyle = decor.outline;
  ctx.lineWidth = OUT_W;
  ctx.lineJoin = "round";
  ctx.stroke();
};

const drawRect = (fill: string, outline: string, bandW = 0, bandFill = ""): DrawFn => (ctx, w, h) => {
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  if (bandW > 0) {
    ctx.fillStyle = bandFill;
    ctx.fillRect(0, 0, bandW, h);
  }
  ctx.strokeStyle = outline;
  ctx.lineWidth = OUT_W;
  ctx.strokeRect(OUT_W / 2, OUT_W / 2, w - OUT_W, h - OUT_W);
};

// ── one building ─────────────────────────────────────────────────
export const Building3D: React.FC<{
  name: "lender" | "bank" | "company";
  opacity: number;
  drop: number;
  g: number;
  renderOrder: number;
}> = ({ name, opacity, drop, g, renderOrder }) => {
  const def = B3D[name];
  const faces = useMemo(() => {
    const { Wf, L, Hw, Ha, sdSign } = def;
    const roof = B3D_DECOR.roof;
    const out: FaceSpec[] = [];
    const decor = B3D_DECOR[name];
    const fill = decor.fill;
    const outline = decor.outline;
    const front: DrawFn =
      name === "company"
        ? drawHouseFront(def, B3D_DECOR.company)
        : drawClassicFront(def, decor as ClassicDecor);
    out.push({ key: "front", w: Wf, h: Ha, draw: front, position: [0, Ha / 2, 0] });
    out.push({
      key: "back", w: Wf, h: Ha, draw: drawPentaPlain(def, fill, outline),
      position: [0, Ha / 2, sdSign * L],
    });
    // side walls: canvas x = distance from the front wall
    const band = name === "bank" ? B3D_DECOR.bank.cornerBand : null;
    for (const side of [-1, 1] as const) {
      out.push({
        key: `side${side}`, w: L, h: Hw,
        draw: drawRect(fill, outline, band ? band.w : 0, band ? band.fill : ""),
        position: [side * (Wf / 2), Hw / 2, sdSign * (L / 2)],
        rotation: [0, -sdSign * (Math.PI / 2) * side, 0],
      });
    }
    // roof slopes
    const m = (Ha - Hw - roof.lift) / (Wf / 2);
    const eaveX = Wf / 2 + roof.ovE;
    const eaveY = Ha - m * eaveX;
    const slopeW = Math.hypot(eaveX, Ha - eaveY);
    const ridgeLen = L + roof.ovF + roof.ovB;
    for (const side of [-1, 1] as const) {
      const bx = new THREE.Vector3(side * eaveX, eaveY - Ha, 0).normalize();
      const by = new THREE.Vector3(0, 0, sdSign);
      const bz = new THREE.Vector3().crossVectors(bx, by).normalize();
      const q = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(bx, by, bz),
      );
      out.push({
        key: `roof${side}`, w: slopeW, h: ridgeLen,
        draw: drawRect(fill, outline),
        position: [side * (eaveX / 2), (Ha + eaveY) / 2, sdSign * (L / 2 + (roof.ovB - roof.ovF) / 2)],
        quaternion: q,
      });
    }
    const oriented = orientOutward(out, [0, Ha / 2, (sdSign * L) / 2]);
    // NOTE: the plinth slab (light-gray platform under lender/bank) is a
    // GROUND element. It has moved out of the building actor into the
    // persistent ground layer (see plinthFaces + BuildingSlabs below): it
    // never drops, and it dissolves with the map instead of the building.
    // The building descends onto the fixed slab.
    // chimney (own box: orient about its own center)
    if (name === "company") {
      const ch = B3D_DECOR.company.chimney;
      const xc = -def.eSign * ch.dLat;
      const hCh = ch.top - ch.bottom;
      const yc = (ch.top + ch.bottom) / 2;
      const zF = sdSign * ch.dFr;
      const zB = sdSign * (ch.dFr + ch.w);
      const zc = (zF + zB) / 2;
      const chDraw = drawRect(fill, outline);
      const chf: FaceSpec[] = [
        { key: "chF", w: ch.w, h: hCh, draw: chDraw, position: [xc, yc, zF] },
        { key: "chB", w: ch.w, h: hCh, draw: chDraw, position: [xc, yc, zB] },
        { key: "chL", w: ch.w, h: hCh, draw: chDraw, position: [xc - ch.w / 2, yc, zc], rotation: [0, Math.PI / 2, 0] },
        { key: "chR", w: ch.w, h: hCh, draw: chDraw, position: [xc + ch.w / 2, yc, zc], rotation: [0, Math.PI / 2, 0] },
        { key: "chT", w: ch.w, h: ch.w, draw: chDraw, position: [xc, ch.top, zc], rotation: [-Math.PI / 2, 0, 0] },
      ];
      oriented.push(...orientOutward(chf, [xc, yc, zc]));
    }
    return oriented;
  }, [def, name]);

  if (opacity <= 0.005) return null;
  const [px, pz] = rotXZ(def.mid[0], def.mid[1], g);
  return (
    <group position={[px, FLOOR_Y_3D + drop, pz]} rotation={[0, g - def.theta, 0]}>
      {faces.map((f) => (
        <Face key={f.key} w={f.w} h={f.h} draw={f.draw} position={f.position}
          rotation={f.rotation} quaternion={f.quaternion} opacity={opacity}
          renderOrder={renderOrder} mirror={f.mirror} />
      ))}
    </group>
  );
};

// ── plinth slab (ground layer) ───────────────────────────────────
// The light-gray platform lender/bank stand on. It is world-fixed floor
// furniture, so it lives in the persistent ground layer, not the building
// actor. `plinthFaces` builds the five faces of one plinth in the
// building's local frame; `BuildingSlabs` plants all plinths at their map
// poses (turntable: rotate the map point by g, group yaw g-θ), fades each
// in with its building and out as the map dissolves, and — crucially —
// never drops. The building descends onto the fixed slab.
const PLINTH_H = 7;
const PLINTH_O = 6; // overhang beyond the footprint on every side
const plinthFaces = (def: Building3DDef): FaceSpec[] => {
  const { Wf, L, sdSign } = def;
  const px0 = -(Wf / 2 + PLINTH_O);
  const px1 = Wf / 2 + PLINTH_O;
  const pz0 = Math.min(0, sdSign * L) - PLINTH_O;
  const pz1 = Math.max(0, sdSign * L) + PLINTH_O;
  const pw = px1 - px0;
  const pl = pz1 - pz0;
  const pcz = (pz0 + pz1) / 2;
  const pDraw = drawRect("#E9E9E7", "rgba(130,130,130,0.55)");
  const plf: FaceSpec[] = [
    { key: "plF", w: pw, h: PLINTH_H, draw: pDraw, position: [0, PLINTH_H / 2, pz1] },
    { key: "plB", w: pw, h: PLINTH_H, draw: pDraw, position: [0, PLINTH_H / 2, pz0] },
    { key: "plL", w: pl, h: PLINTH_H, draw: pDraw, position: [px0, PLINTH_H / 2, pcz], rotation: [0, Math.PI / 2, 0] },
    { key: "plR", w: pl, h: PLINTH_H, draw: pDraw, position: [px1, PLINTH_H / 2, pcz], rotation: [0, Math.PI / 2, 0] },
    { key: "plT", w: pw, h: pl, draw: pDraw, position: [0, PLINTH_H, pcz], rotation: [-Math.PI / 2, 0, 0] },
  ];
  return orientOutward(plf, [0, PLINTH_H / 2, pcz]);
};

// Per-building slab fade-in windows (each slab appears with its building);
// all slabs dissolve with the floor map over 3572-3581.
const SLAB_APPEAR: Record<"lender" | "bank", [number, number]> = {
  lender: [1733, 1755],
  bank: [2274, 2312],
};

export const BuildingSlabs: React.FC<{ frame: number; g: number }> = ({ frame, g }) => {
  const c01 = (x: number) => Math.max(0, Math.min(1, x));
  const mapFade = 1 - c01((frame - 3572) / 9);
  return (
    <>
      {(["lender", "bank"] as const).map((name) => {
        const def = B3D[name];
        const app = SLAB_APPEAR[name];
        const op = c01((frame - app[0]) / (app[1] - app[0])) * mapFade;
        if (op <= 0.005) return null;
        const [px, pz] = rotXZ(def.mid[0], def.mid[1], g);
        return (
          <group key={name} position={[px, FLOOR_Y_3D, pz]} rotation={[0, g - def.theta, 0]}>
            {plinthFaces(def).map((f) => (
              <Face key={f.key} w={f.w} h={f.h} draw={f.draw} position={f.position}
                rotation={f.rotation} quaternion={f.quaternion} opacity={op}
                renderOrder={1} mirror={f.mirror} />
            ))}
          </group>
        );
      })}
    </>
  );
};

// ── mini buildings (community scene): real extruded solids ───────
// Same face construction as the map buildings, parameterized for the
// community icon set (vertical gradient fills, doors, columns, boxes).
export type MiniSpec = {
  kind: "house" | "temple" | "box2";
  W: number;
  L: number;
  H: number; // total height (apex)
  eaveFrac: number; // wall height / H (ignored for box2)
  fill: string;
  fillTop?: string;
  outline: string;
  door?: { u0: number; u1: number; top: number; fill: string };
  chimney?: boolean;
  cols?: { n: number; fill: string };
  strip?: boolean;
};

const vgrad = (ctx: CanvasRenderingContext2D, h: number, fill: string, fillTop?: string) => {
  if (!fillTop) return fill;
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, fill);
  g.addColorStop(1, fillTop);
  return g;
};

const miniFront = (s: MiniSpec, Hw: number): DrawFn => (ctx, w, h) => {
  pentaPath(ctx, w, h, Hw);
  ctx.fillStyle = vgrad(ctx, h, s.fill, s.fillTop);
  ctx.fill();
  if (s.cols) {
    const n = s.cols.n;
    const cw = w * (n === 5 ? 0.09 : 0.13);
    const pitch = (w * 0.72) / (n - 1);
    for (let i = 0; i < n; i++) {
      const x0 = w * 0.14 + i * pitch - cw / 2;
      ctx.fillStyle = s.cols.fill;
      ctx.fillRect(x0, h - Hw * 0.92, cw, Hw * 0.66);
    }
  }
  if (s.strip) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(w * 0.05, h - Hw * 0.24, w * 0.9, Hw * 0.1);
  }
  if (s.door) {
    const y0 = h - Hw * s.door.top;
    ctx.fillStyle = s.door.fill;
    ctx.fillRect(s.door.u0 * w, y0, (s.door.u1 - s.door.u0) * w, h - y0 - 1);
    ctx.strokeStyle = s.outline;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(s.door.u0 * w, y0, (s.door.u1 - s.door.u0) * w, h - y0 - 1);
  }
  pentaPath(ctx, w, h, Hw, 1.1);
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = "round";
  ctx.stroke();
};

const miniPlain = (s: MiniSpec, Hw: number): DrawFn => (ctx, w, h) => {
  pentaPath(ctx, w, h, Hw);
  ctx.fillStyle = vgrad(ctx, h, s.fill, s.fillTop);
  ctx.fill();
  pentaPath(ctx, w, h, Hw, 1.1);
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = "round";
  ctx.stroke();
};

const miniRect = (s: MiniSpec): DrawFn => (ctx, w, h) => {
  ctx.fillStyle = vgrad(ctx, h, s.fill, s.fillTop);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(1.1, 1.1, w - 2.2, h - 2.2);
};

const boxFaces = (
  w: number, l: number, y0: number, y1: number, draw: DrawFn, keyP: string,
) => {
  const hh = y1 - y0;
  const yc = (y0 + y1) / 2;
  return [
    { key: `${keyP}F`, w, h: hh, draw, position: [0, yc, l / 2] as V3 },
    { key: `${keyP}B`, w, h: hh, draw, position: [0, yc, -l / 2] as V3 },
    { key: `${keyP}L`, w: l, h: hh, draw, position: [-w / 2, yc, 0] as V3, rotation: [0, Math.PI / 2, 0] as [number, number, number] },
    { key: `${keyP}R`, w: l, h: hh, draw, position: [w / 2, yc, 0] as V3, rotation: [0, Math.PI / 2, 0] as [number, number, number] },
    { key: `${keyP}T`, w, h: l, draw, position: [0, y1, 0] as V3, rotation: [-Math.PI / 2, 0, 0] as [number, number, number] },
  ];
};

export const MiniBuilding: React.FC<{
  spec: MiniSpec;
  position: V3; // base center (world)
  opacity: number;
  scale?: number;
  renderOrder?: number;
}> = ({ spec, position, opacity, scale = 1, renderOrder = 2 }) => {
  const faces = useMemo(() => {
    const { W: w, L: l, H } = spec;
    const out: FaceSpec[] = [];
    if (spec.kind === "box2") {
      // two equal full-width boxes stacked with a horizontal mid-seam — the
      // reference far-left front icon is a modest box split across the middle
      // (front face in two equal panels), not a narrowing tower.
      const plain = miniRect(spec);
      out.push(...orientOutward(boxFaces(w, l, 0, H * 0.5, plain, "b0"), [0, H * 0.25, 0]));
      out.push(...orientOutward(boxFaces(w, l, H * 0.5, H, plain, "b1"), [0, H * 0.75, 0]));
      return out;
    }
    const Hw = H * spec.eaveFrac;
    out.push({ key: "front", w, h: H, draw: miniFront(spec, Hw), position: [0, H / 2, l / 2] });
    out.push({ key: "back", w, h: H, draw: miniPlain(spec, Hw), position: [0, H / 2, -l / 2] });
    const wall = miniRect(spec);
    out.push({ key: "sideL", w: l, h: Hw, draw: wall, position: [-w / 2, Hw / 2, 0], rotation: [0, Math.PI / 2, 0] });
    out.push({ key: "sideR", w: l, h: Hw, draw: wall, position: [w / 2, Hw / 2, 0], rotation: [0, Math.PI / 2, 0] });
    // roof slopes with overhang
    const ovE = w * 0.07;
    const ovF = l * 0.08;
    const m = (H - Hw - 1.5) / (w / 2);
    const eaveX = w / 2 + ovE;
    const eaveY = H - m * eaveX;
    const slopeW = Math.hypot(eaveX, H - eaveY);
    for (const side of [-1, 1] as const) {
      const bx = new THREE.Vector3(side * eaveX, eaveY - H, 0).normalize();
      const by = new THREE.Vector3(0, 0, 1);
      const bz = new THREE.Vector3().crossVectors(bx, by).normalize();
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(bx, by, bz));
      out.push({
        key: `roof${side}`, w: slopeW, h: l + ovF * 2, draw: wall,
        position: [side * (eaveX / 2), (H + eaveY) / 2, 0], quaternion: q,
      });
    }
    const oriented = orientOutward(out, [0, H / 2, 0]);
    if (spec.chimney) {
      const cw = w * 0.11;
      const xc = w * 0.275;
      const chDraw = miniRect(spec);
      const yTop = H * 0.9;
      const yBot = H * 0.45;
      const chf = boxFaces(cw, cw, yBot, yTop, chDraw, "ch").map((f) => ({
        ...f, position: [f.position[0] + xc, f.position[1], f.position[2]] as V3,
      }));
      oriented.push(...orientOutward(chf, [xc, (yBot + yTop) / 2, 0]));
    }
    return oriented;
  }, [spec]);
  if (opacity <= 0.005 || scale <= 0.005) return null;
  return (
    <group position={position} scale={scale}>
      {faces.map((f) => (
        <Face key={f.key} w={f.w} h={f.h} draw={f.draw} position={f.position}
          rotation={f.rotation} quaternion={f.quaternion} opacity={opacity}
          renderOrder={renderOrder} mirror={f.mirror} />
      ))}
    </group>
  );
};

// ── arrow planes ─────────────────────────────────────────────────
export type ArrowAlphas = {
  arrA: number;
  progA: number;
  lblA: number;
  lmA: number;
  vbrVal: string;
  fixArrow: number;
  fixProg: number;
  fix: number;
  red: number;
  redProg: number;
  rightLbl: number;
  slideT: number;
  leftArr: number;
  leftLbl: number;
  cVal: string;
};

// reference arrows: charcoal-outlined fills with a glossy horizontal
// mid-lightening (measured centers: teal 122,223,247 / red 255,164,183)
const TEAL_FLAT: [number, string][] = [
  [0, "#4CB3CD"], [0.5, "#79D2EE"], [1, "#4CB3CD"],
];
const RED_STOPS: [number, string][] = [
  [0, "#F05F6D"], [0.5, "#FFA4B7"], [1, "#F05F6D"],
];
const TITLE_COLOR = "#757777";
const VALUE_COLOR = "#666B6B";

type Run = { t: string; size: number; weight: number; color: string };
type TextOpts = { span?: number; rot?: number };

const setFont = (ctx: CanvasRenderingContext2D, r: Run, font: string) => {
  ctx.font = `${r.weight} ${r.size}px "${font}"`;
};
const runsWidth = (ctx: CanvasRenderingContext2D, runs: Run[], font: string) => {
  let tw = 0;
  for (const r of runs) {
    setFont(ctx, r, font);
    tw += ctx.measureText(r.t).width;
  }
  return tw;
};
// Draw text runs centered at (cx,cy). `span` letter-spaces the text out to
// the measured reference span (the reference typeface tracks wider than
// Titillium); `rot` applies the measured in-plane baseline tilt.
const drawRuns = (
  ctx: CanvasRenderingContext2D, runs: Run[], cx: number, cy: number,
  alpha: number, font: string, opts: TextOpts = {},
) => {
  if (alpha <= 0) return;
  const chars = runs.reduce((s, r) => s + r.t.length, 0);
  let ls = 0;
  let tw = runsWidth(ctx, runs, font);
  if (opts.span && chars > 1) {
    ls = Math.max(0, (opts.span - tw) / (chars - 1));
    tw = tw + ls * (chars - 1);
  }
  ctx.save();
  ctx.translate(cx, cy);
  if (opts.rot) ctx.rotate(opts.rot);
  ctx.globalAlpha = alpha;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  if (ls > 0) ctx.letterSpacing = `${ls}px`;
  let x = -tw / 2;
  for (const r of runs) {
    setFont(ctx, r, font);
    ctx.fillStyle = r.color;
    ctx.fillText(r.t, x, 0);
    x += ctx.measureText(r.t).width;
  }
  if (ls > 0) ctx.letterSpacing = "0px";
  ctx.restore();
};
const title = (t: string, size: number): Run[] => [{ t, size, weight: 400, color: TITLE_COLOR }];
const value = (v: string, size: number): Run[] => [
  { t: v, size, weight: 600, color: VALUE_COLOR },
  { t: " %", size: size * 0.88, weight: 400, color: VALUE_COLOR },
];

const drawArrow = (
  ctx: CanvasRenderingContext2D,
  X: (s: number) => number,
  Y: (y: number) => number,
  def: { tail: number; tip: number; cy: number; T: number; headLen: number; headHalf: number },
  stops: [number, string][],
  alpha: number,
  prog = 1,
) => {
  if (alpha <= 0 || prog <= 0) return;
  const x0 = X(def.tail);
  const x1 = X(def.tip);
  const cy = Y(def.cy);
  const dir = Math.sign(x1 - x0);
  const len = Math.abs(x1 - x0);
  const eff = len * Math.min(1, prog);
  const hl = Math.min(def.headLen, eff);
  const xe = x0 + dir * eff;
  const xs = x0 + dir * (eff - hl);
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x0, cy - def.T / 2);
  ctx.lineTo(xs, cy - def.T / 2);
  ctx.lineTo(xs, cy - def.headHalf);
  ctx.lineTo(xe, cy);
  ctx.lineTo(xs, cy + def.headHalf);
  ctx.lineTo(xs, cy + def.T / 2);
  ctx.lineTo(x0, cy + def.T / 2);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(96,94,96,0.8)";
  ctx.lineWidth = 2.1;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.globalAlpha = 1;
};

const PANEL = {
  leftTeal: { s0: -20, s1: 270, yTop: 175, yBot: -80 },
  rightRed: { s0: -380, s1: -60, yTop: 175, yBot: -100 },
} as const;

const PlaneGroup: React.FC<{
  plane: "leftTeal" | "rightRed";
  frame: number;
  g: number;
  draw: (ctx: CanvasRenderingContext2D, X: (s: number) => number, Y: (y: number) => number) => void;
}> = ({ plane, frame, g, draw }) => {
  const P = PANEL[plane];
  const pl = PLANES[plane];
  const w = P.s1 - P.s0;
  const h = P.yTop - P.yBot;
  const sC = (P.s0 + P.s1) / 2;
  const yC = (P.yTop + P.yBot) / 2;
  const wx = PLANE_ANCHOR[0] + pl.dir[0] * sC;
  const wz = PLANE_ANCHOR[1] + pl.dir[1] * sC;
  const [px, pz] = rotXZ(wx, wz, g);
  // The camera sits on the plane's local -z side for the whole scene, so
  // the group is turned by pi (front face toward camera, text unmirrored)
  // and the s axis maps right-to-left on the canvas.
  const drawCb = React.useCallback(
    (ctx: CanvasRenderingContext2D) => {
      draw(ctx, (s: number) => P.s1 - s, (y: number) => P.yTop - y);
    },
    [draw, P.s1, P.yTop],
  );
  return (
    <group position={[px, yC, pz]} rotation={[0, g + pl.yaw + Math.PI, 0]}>
      <CanvasPlane frame={frame} width={w} height={h} position={[0, 0, 0]}
        draw={drawCb} renderOrder={6} depthTest={false} />
    </group>
  );
};

export const ArrowPlanes: React.FC<{
  frame: number;
  g: number;
  font: string;
  al: ArrowAlphas;
}> = ({ frame, g, font, al }) => {
  const showL = al.arrA > 0 || al.lblA > 0 || al.lmA > 0 || al.leftArr > 0 || al.leftLbl > 0;
  const showR = al.fixArrow > 0 || al.fix > 0 || al.red > 0 || al.rightLbl > 0;
  const drawL = React.useCallback(
    (ctx: CanvasRenderingContext2D, X: (s: number) => number, Y: (y: number) => number) => {
      // phase A: teal arrow + VBR + lending margin labels
      drawArrow(ctx, X, Y, ARR3D.phaseA, TEAL_FLAT, al.arrA, al.progA);
      drawRuns(ctx, title("Variable Base Rate", LBL3D.aVbrTitle.size), X(LBL3D.aVbrTitle.p[0]), Y(LBL3D.aVbrTitle.p[1]), al.lblA, font);
      drawRuns(ctx, value(al.vbrVal, LBL3D.aVbrValue.size), X(LBL3D.aVbrValue.p[0]), Y(LBL3D.aVbrValue.p[1]), al.lblA, font);
      drawRuns(ctx, title("Lending margin", LBL3D.aLmTitle.size), X(LBL3D.aLmTitle.p[0]), Y(LBL3D.aLmTitle.p[1]), al.lmA, font);
      drawRuns(ctx, value("2.0", LBL3D.aLmValue.size), X(LBL3D.aLmValue.p[0]), Y(LBL3D.aLmValue.p[1]), al.lmA, font);
      // phase C: left column
      drawArrow(ctx, X, Y, ARR3D.leftTeal, TEAL_FLAT, al.leftArr);
      drawRuns(ctx, title("Variable Base Rate", LBL3D.cLeftTitle.size), X(LBL3D.cLeftTitle.p[0]), Y(LBL3D.cLeftTitle.p[1]), al.leftLbl, font, { span: LBL3D.cLeftTitle.span, rot: LBL3D.cLeftTitle.rot });
      drawRuns(ctx, value(al.cVal, LBL3D.cLeftValue.size), X(LBL3D.cLeftValue.p[0]), Y(LBL3D.cLeftValue.p[1]), al.leftLbl, font, { rot: LBL3D.cLeftValue.rot });
    },
    [al, font],
  );
  const drawR = React.useCallback(
    (ctx: CanvasRenderingContext2D, X: (s: number) => number, Y: (y: number) => number) => {
      // fixed-rate arrow (solid -> ghost) + labels
      drawArrow(ctx, X, Y, ARR3D.fixed, TEAL_FLAT, al.fixArrow, al.fixProg);
      drawRuns(ctx, title("Fixed Rate", LBL3D.fixTitle.size), X(LBL3D.fixTitle.p[0]), Y(LBL3D.fixTitle.p[1]), al.fix, font);
      drawRuns(ctx, value("3.0", LBL3D.fixValue.size), X(LBL3D.fixValue.p[0]), Y(LBL3D.fixValue.p[1]), al.fix, font);
      // red arrow (world-static through B and C)
      drawArrow(ctx, X, Y, ARR3D.rightRed, RED_STOPS, al.red, al.redProg);
      // VBR label slides in-plane from the B pose to the C pose
      const t = al.slideT;
      const tp: [number, number] = [
        LBL3D.cRightTitleB.p[0] + (LBL3D.cRightTitleC.p[0] - LBL3D.cRightTitleB.p[0]) * t,
        LBL3D.cRightTitleB.p[1] + (LBL3D.cRightTitleC.p[1] - LBL3D.cRightTitleB.p[1]) * t,
      ];
      const vp: [number, number] = [
        LBL3D.cRightValueB.p[0] + (LBL3D.cRightValueC.p[0] - LBL3D.cRightValueB.p[0]) * t,
        LBL3D.cRightValueB.p[1] + (LBL3D.cRightValueC.p[1] - LBL3D.cRightValueB.p[1]) * t,
      ];
      drawRuns(ctx, title("Variable Base Rate", LBL3D.cRightTitleC.size), X(tp[0]), Y(tp[1]), al.rightLbl, font, { span: LBL3D.cRightTitleC.span, rot: LBL3D.cRightTitleC.rot });
      drawRuns(ctx, value(al.cVal, LBL3D.cRightValueC.size), X(vp[0]), Y(vp[1]), al.rightLbl, font, { rot: LBL3D.cRightValueC.rot });
    },
    [al, font],
  );
  return (
    <>
      {showL && <PlaneGroup plane="leftTeal" frame={frame} g={g} draw={drawL} />}
      {showR && <PlaneGroup plane="rightRed" frame={frame} g={g} draw={drawR} />}
    </>
  );
};
