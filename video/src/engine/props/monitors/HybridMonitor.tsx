import React, { useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { staticFile } from "remotion";
import {
  drawCandlestickOverlay,
  drawLineOverlay,
  drawOrderBookOverlay,
} from "../../charts";
import { drawTickerOverlay } from "../../charts";
import type { ScreenDef } from "../../../shorts/short-02/screenConfig";
import { TEX_W, TEX_H } from "./MonitorScreen";

// ---------------------------------------------------------------------------
// Hybrid monitor (static PNG screenshot + animated chart overlay)
// ---------------------------------------------------------------------------

export const HybridMonitor: React.FC<{
  position: [number, number, number];
  screenW: number;
  screenH: number;
  screenDef: ScreenDef;
  frame: number;
  accentColor: string;
  hideStand?: boolean;
}> = ({ position, screenW, screenH, screenDef, frame, accentColor, hideStand }) => {
  const imageTexture = useLoader(THREE.TextureLoader, staticFile(screenDef.image));
  // NPOT-safe filters (384px height is not power-of-2)
  imageTexture.minFilter = THREE.LinearFilter;
  imageTexture.generateMipmaps = false;

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return { canvas: c, texture: t };
  }, []);

  const ctx = canvas.getContext("2d");
  if (ctx && imageTexture.image) {
    // 1. Draw static screenshot — auto-fit (contain) + optional scale-down
    const img = imageTexture.image as HTMLImageElement;
    const imgW = img.naturalWidth || img.width || TEX_W;
    const imgH = img.naturalHeight || img.height || TEX_H;
    const imgAspect = imgW / imgH;
    const canvasAspect = TEX_W / TEX_H;
    const sc = screenDef.scale ?? 1;
    let dw: number, dh: number, dx: number, dy: number;
    if (imgAspect > canvasAspect) {
      dw = TEX_W * sc; dh = (TEX_W / imgAspect) * sc;
    } else {
      dh = TEX_H * sc; dw = (TEX_H * imgAspect) * sc;
    }
    dx = (TEX_W - dw) / 2; dy = (TEX_H - dh) / 2;
    ctx.fillStyle = screenDef.overlay?.bgColor ?? "#0d1117";
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.drawImage(img, dx, dy, dw, dh);

    // 2. Draw animated overlay with platform-matching background
    if (screenDef.overlay) {
      const { type, x, y, w, h, seed, upColor, downColor, bgColor } = screenDef.overlay;
      const s = seed ?? 100;
      const up = upColor ?? "#00e676";
      const down = downColor ?? "#ff3d00";
      const bg = bgColor ?? "#0d1117";
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.translate(x, y);
      if (type === "candlestick") {
        drawCandlestickOverlay(ctx, w, h, frame, s, up, down, bg);
        drawTickerOverlay(ctx, w, h, frame, s, up, down);
      } else if (type === "line") {
        drawLineOverlay(ctx, w, h, frame, s, up, bg);
        drawTickerOverlay(ctx, w, h, frame, s, up, down);
      } else if (type === "orderbook") {
        drawOrderBookOverlay(ctx, w, h, frame, s, up, down, bg);
      } else if (type === "ticker") {
        drawTickerOverlay(ctx, w, h, frame, s, up, down);
      }
      ctx.restore();
    }
    texture.needsUpdate = true;
  }

  const glowCol = useMemo(() => new THREE.Color(accentColor), [accentColor]);

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[screenW + 0.016, screenH + 0.016, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      <mesh position={[0, -(screenH / 2 + 0.01), -0.008]}>
        <boxGeometry args={[screenW + 0.016, 0.025, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[screenW, screenH]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive={new THREE.Color("#ffffff")}
          emissiveIntensity={1.5}
          roughness={0.1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        position={[0, 0, 0.4]}
        intensity={0.5}
        color={glowCol}
        distance={2}
        decay={2}
      />
      {!hideStand && (
        <>
          <mesh position={[0, -(screenH / 2 + 0.10), -0.02]}>
            <boxGeometry args={[0.04, 0.18, 0.008]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
          <mesh position={[0, -(screenH / 2 + 0.18), 0.025]}>
            <boxGeometry args={[0.18, 0.012, 0.12]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
        </>
      )}
    </group>
  );
};
