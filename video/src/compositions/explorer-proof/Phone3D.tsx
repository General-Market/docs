// Phone3D — phone built inside the same Three scene as the coins so it
// picks up the studio HDRI and the directional key light. Body is a
// rounded rectangle extruded with a soft bevel; screen is a flat plane
// in front carrying the broll as a video texture sampled from a hidden
// <Video> element owned by the composition. Driven by the same beat
// scalars as the old CssPhone — translateY (CSS px), rotateX/YDeg,
// scale.

import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useVideoTexture } from "@remotion/three";

const PHONE_W = 4.4;
const PHONE_H = 9.2;
const PHONE_T = 0.22;
const PHONE_R = 0.38;
const BEZEL = 0.11;
const SCREEN_R = PHONE_R - BEZEL * 0.55;
const NOTCH_W = 1.05;
const NOTCH_H = 0.27;
const NOTCH_R = 0.13;
// Visible world height at z=0 with camera at z=14, FOV 40°:
// 2 * tan(20°) * 14 ≈ 10.19. So 1 CSS pixel (out of 1080) maps to
// 10.19 / 1080 ≈ 0.00943 world units.
const PX_TO_WORLD_Y = 10.19 / 1080;

function makeRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const cr = Math.max(0, Math.min(r, Math.min(hw, hh)));
  const shape = new THREE.Shape();
  shape.moveTo(-hw + cr, -hh);
  shape.lineTo(hw - cr, -hh);
  shape.absarc(hw - cr, -hh + cr, cr, -Math.PI / 2, 0, false);
  shape.lineTo(hw, hh - cr);
  shape.absarc(hw - cr, hh - cr, cr, 0, Math.PI / 2, false);
  shape.lineTo(-hw + cr, hh);
  shape.absarc(-hw + cr, hh - cr, cr, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw, -hh + cr);
  shape.absarc(-hw + cr, -hh + cr, cr, Math.PI, Math.PI * 1.5, false);
  return shape;
}

function buildPhoneBodyGeometry(): THREE.BufferGeometry {
  const shape = makeRoundedRectShape(PHONE_W, PHONE_H, PHONE_R);
  const bevelThickness = 0.035;
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: PHONE_T,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.05,
    bevelThickness,
    curveSegments: 32,
  });
  geom.translate(0, 0, -PHONE_T / 2 - bevelThickness);
  geom.computeVertexNormals();
  return geom;
}

function buildScreenGeometry(): THREE.BufferGeometry {
  const w = PHONE_W - BEZEL * 2;
  const h = PHONE_H - BEZEL * 2;
  const shape = makeRoundedRectShape(w, h, SCREEN_R);
  const geom = new THREE.ShapeGeometry(shape, 24);
  // ShapeGeometry emits UVs in shape-coordinate space (worldspace within
  // the geometry). Remap to a clean 0..1 grid across the bounding rect
  // so the video texture maps corner-to-corner.
  const pos = geom.attributes.position.array as Float32Array;
  const count = geom.attributes.position.count;
  const uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    uvs[i * 2] = (x + w / 2) / w;
    uvs[i * 2 + 1] = (y + h / 2) / h;
  }
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return geom;
}

function buildNotchGeometry(): THREE.BufferGeometry {
  const shape = makeRoundedRectShape(NOTCH_W, NOTCH_H, NOTCH_R);
  return new THREE.ShapeGeometry(shape, 16);
}

const PhoneScreen: React.FC<{
  videoRef: React.RefObject<HTMLVideoElement | null>;
  geom: THREE.BufferGeometry;
}> = ({ videoRef, geom }) => {
  const videoTex = useVideoTexture(videoRef);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => {
    if (videoTex) {
      videoTex.colorSpace = THREE.SRGBColorSpace;
      mat.map = videoTex;
      mat.color = new THREE.Color(0xffffff);
      mat.needsUpdate = true;
    }
  }, [videoTex, mat]);
  return (
    <mesh
      geometry={geom}
      material={mat}
      position={[0, 0, PHONE_T / 2 + 0.003]}
    />
  );
};

export type Phone3DProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  translateY: number;
  rotateXDeg: number;
  rotateYDeg: number;
  scale: number;
};

export const Phone3D: React.FC<Phone3DProps> = ({
  videoRef,
  translateY,
  rotateXDeg,
  rotateYDeg,
  scale,
}) => {
  const bodyGeom = useMemo(() => buildPhoneBodyGeometry(), []);
  const screenGeom = useMemo(() => buildScreenGeometry(), []);
  const notchGeom = useMemo(() => buildNotchGeometry(), []);

  const bodyMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x0e0e16,
        metalness: 0.6,
        roughness: 0.28,
        envMapIntensity: 1.15,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
      }),
    [],
  );
  const notchMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        toneMapped: false,
      }),
    [],
  );

  const worldY = -translateY * PX_TO_WORLD_Y;
  const rotX = (rotateXDeg * Math.PI) / 180;
  const rotY = (rotateYDeg * Math.PI) / 180;

  const notchY = PHONE_H / 2 - BEZEL - NOTCH_H / 2 - 0.04;
  const notchZ = PHONE_T / 2 + 0.005;

  return (
    <group
      position={[0, 0.5 + worldY, 0]}
      rotation={[rotX, rotY, 0]}
      scale={scale}
    >
      <mesh geometry={bodyGeom} material={bodyMat} />
      <PhoneScreen videoRef={videoRef} geom={screenGeom} />
      <mesh
        geometry={notchGeom}
        material={notchMat}
        position={[0, notchY, notchZ]}
      />
    </group>
  );
};
