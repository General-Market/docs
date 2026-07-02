// 3D "paper world" primitives shared by the IRSwap replica scenes.
// Convention: world units = reference screen pixels at the anchor pose.
// Anchor camera sits at (0,0,DCAM) looking down -z; a plane at z=0
// spanning x∈[-427,427], y∈[-240,240] fills the 854x480 frame 1:1.
// worldX = u - 427, worldY = 240 - v.

import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill } from "remotion";

export const W = 854;
export const H = 480;
export const VFOV = 40;
export const DCAM = 240 / Math.tan((VFOV / 2) * (Math.PI / 180)); // ≈659.38

export type V3 = [number, number, number];
export type Pt = [number, number];

// ── projection helpers (translation-only camera looking -z) ──────
export const project = (p: V3, cam: V3): Pt => {
  const d = cam[2] - p[2];
  return [427 + (DCAM * (p[0] - cam[0])) / d, 240 - (DCAM * (p[1] - cam[1])) / d];
};

// Solve camera x/y so that world point p projects to screen (u,v) given cz.
export const solveCamXY = (p: V3, u: number, v: number, cz: number): [number, number] => {
  const d = cz - p[2];
  return [p[0] - ((u - 427) * d) / DCAM, p[1] - ((240 - v) * d) / DCAM];
};

// Ray through screen (u,v) from camera position `cam`: origin cam,
// direction ((u-427)/D, (240-v)/D, -1).
const rayDir = (u: number, v: number): V3 => [(u - 427) / DCAM, (240 - v) / DCAM, -1];

// Intersect the screen ray with plane (point p0, normal n).
export const unprojectOnPlane = (
  u: number,
  v: number,
  p0: V3,
  n: V3,
  cam: V3 = [0, 0, DCAM],
): V3 => {
  const d = rayDir(u, v);
  const denom = n[0] * d[0] + n[1] * d[1] + n[2] * d[2];
  const t =
    (n[0] * (p0[0] - cam[0]) + n[1] * (p0[1] - cam[1]) + n[2] * (p0[2] - cam[2])) / denom;
  return [cam[0] + d[0] * t, cam[1] + d[1] * t, cam[2] + d[2] * t];
};

// ── wall fit ─────────────────────────────────────────────────────
// Fit a vertical plane holding equally spaced vertical gridlines to the
// measured anchor screen xs. Model: gridline i root at
// P_i = (x0 + i·m, ·, z0 - i·p·(z-sign)), depth d_i = d0 + i·p,
// u'_i = D·x_i/d_i. Solve p, m with d0=D fixed via first gridline,
// then renormalize so the center gridline sits at z=0.
export type WallFit = {
  origin: V3; // 3D position of gridline 0 root at y=0
  dirS: V3; // unit vector along the wall (increasing gridline index)
  spacing: number; // world distance between gridlines
  normal: V3;
  yawRad: number; // rotation.y for a PlaneGeometry to lie in this wall
};

export const fitWall = (gridXs: readonly number[]): WallFit => {
  const u = gridXs.map((x) => x - 427);
  const n = u.length;
  // equations (i=1..n-1): i·u_i·p − D·i·m = −(u_i − u_0)·d0, d0 = D
  let a11 = 0,
    a12 = 0,
    a22 = 0,
    b1 = 0,
    b2 = 0;
  for (let i = 1; i < n; i++) {
    const c1 = i * u[i];
    const c2 = -DCAM * i;
    const rhs = -(u[i] - u[0]) * DCAM;
    a11 += c1 * c1;
    a12 += c1 * c2;
    a22 += c2 * c2;
    b1 += c1 * rhs;
    b2 += c2 * rhs;
  }
  const det = a11 * a22 - a12 * a12;
  const p = (b1 * a22 - b2 * a12) / det;
  // depths with d0 = D: d_i = D + i·p ; renormalize so center gridline z=0
  const ic = (n - 1) / 2;
  const k = DCAM / (DCAM + ic * p);
  const depth = (i: number) => (DCAM + i * p) * k;
  const xAt = (i: number) => (u[i] !== undefined ? (u[i] * depth(i)) / DCAM : 0);
  // gridline world positions at y=0
  const P0: V3 = [xAt(0), 0, DCAM - depth(0)];
  const P1: V3 = [xAt(1), 0, DCAM - depth(1)];
  const dx = P1[0] - P0[0];
  const dz = P1[2] - P0[2];
  const spacing = Math.hypot(dx, dz);
  const dirS: V3 = [dx / spacing, 0, dz / spacing];
  const normal: V3 = [-dirS[2], 0, dirS[0]]; // dirS × up, pointing camera-ish
  const yawRad = Math.atan2(-dirS[2], dirS[0]);
  return { origin: P0, dirS, spacing, normal, yawRad };
};

// Wall-space coords: s along dirS from origin, y = world y.
export const unprojToWall = (
  fit: WallFit,
  u: number,
  v: number,
  cam: V3 = [0, 0, DCAM],
): Pt => {
  const p = unprojectOnPlane(u, v, fit.origin, fit.normal, cam);
  const s =
    (p[0] - fit.origin[0]) * fit.dirS[0] + (p[2] - fit.origin[2]) * fit.dirS[2];
  return [s, p[1]];
};

export const wallToWorld = (fit: WallFit, s: number, y: number): V3 => [
  fit.origin[0] + fit.dirS[0] * s,
  y,
  fit.origin[2] + fit.dirS[2] * s,
];

// Unproject a screen point onto the horizontal plane y = yF.
export const unprojToFloor = (
  u: number,
  v: number,
  yF: number,
  cam: V3 = [0, 0, DCAM],
): V3 => unprojectOnPlane(u, v, [0, yF, 0], [0, 1, 0], cam);

// ── React pieces ─────────────────────────────────────────────────

// Measured (f1690): flat #FDFDFD plateau over the central ~75%, elliptical
// rolloff to #DADADA floor; ellipse center displaced below frame center.
export const Vignette: React.FC<{ opacity?: number; soft?: boolean }> = ({
  opacity = 1,
  soft = false,
}) => (
  <AbsoluteFill
    style={{
      background: soft
        ? // buildings-map scenes: near-uniform light sheet, mild corners
          "radial-gradient(760px 480px at 50% 58%, #FCFCFB 0%, #FCFCFB 50%, #F1F1EF 75%, #E9E9E7 100%)"
        : "radial-gradient(620px 400px at 50% 64%, #FDFDFD 0%, #FDFDFD 56%, #ECECEB 66%, #DADADA 78%, #DADADA 100%)",
      opacity,
    }}
  />
);

// Per-frame redrawn canvas texture on a plane. Placement via explicit
// position / rotation; size in world units. Canvas resolution = size × res.
export const CanvasPlane: React.FC<{
  frame: number;
  width: number;
  height: number;
  res?: number;
  position: V3;
  rotation?: [number, number, number];
  draw: (ctx: CanvasRenderingContext2D, frame: number, w: number, h: number) => void;
  renderOrder?: number;
}> = ({ frame, width, height, res = 2, position, rotation = [0, 0, 0], draw, renderOrder = 0 }) => {
  const cw = Math.round(width * res);
  const ch = Math.round(height * res);
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    return c;
  }, [cw, ch]);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  useLayoutEffect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(res, 0, 0, res, 0, 0);
    draw(ctx, frame, width, height);
    texture.needsUpdate = true;
  }, [canvas, texture, frame, draw, cw, ch, res, width, height]);
  return (
    <mesh position={position} rotation={rotation} renderOrder={renderOrder}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
};

// Camera rig: translation camera; optional pitch (rotX<0 looks down).
export const CameraRig: React.FC<{ position: V3; rotX?: number }> = ({
  position,
  rotX = 0,
}) => {
  return <CameraSetter position={position} rotX={rotX} />;
};

// Needs to live inside the Canvas tree.
import { useThree } from "@react-three/fiber";
const CameraSetter: React.FC<{ position: V3; rotX: number }> = ({ position, rotX }) => {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.rotation.set(rotX, 0, 0);
    camera.updateMatrixWorld();
  }, [camera, position, rotX]);
  return null;
};

export const Room: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThreeCanvas
    width={W}
    height={H}
    style={{ position: "absolute", inset: 0 }}
    gl={{ antialias: true, alpha: true }}
    flat
    camera={{ fov: VFOV, position: [0, 0, DCAM], near: 10, far: 20000 }}
  >
    {children}
  </ThreeCanvas>
);
