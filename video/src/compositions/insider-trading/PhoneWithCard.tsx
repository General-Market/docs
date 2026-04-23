// iPhone with a source card painted onto its screen. Uses the same GLB
// and camera setup as the Worldcoin phone — swaps the broll video for
// a canvas-rasterised card (Twitch / Deutsche Bahn / Movies & TV).
//
// Renders as its own ThreeCanvas so it can stack over the vortex
// without sharing a Three.js scene or camera with it.

import React, { useState, useEffect, useMemo } from "react";
import {
  AbsoluteFill,
  delayRender,
  continueRender,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";
import { FEATURED_SOURCES } from "./SourceCardsWall";

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.opt.glb");
useGLTF.preload(MODEL_URL);

// Defaults copied from DeviceBroll — these are the only camera + phone
// positions proven to render the screen flush to the viewer.
const PHONE_CAM_POS = new THREE.Vector3(-2.8, 2.375, -4.44);
const PHONE_CAM_TARGET = new THREE.Vector3(-2.921, 2.475, -1.564);
const PHONE_POS = new THREE.Vector3(-3, 2.5, 0);
const PHONE_QUAT = new THREE.Quaternion(0, 0, 0, 1);
const PHONE_SCALE = 22.486;

const SCREEN_ASPECT = 9 / 19.5;

// ── Card canvas ─────────────────────────────────────────────────────────

const CARD_FONT =
  "'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

const CHART_COLORS = ["#2563EB", "#059669", "#D97706", "#7C3AED"] as const;
const LOGO_BG = "#F4F4F5";
const NAME_COLOR = "#0A0A0A";
const MARKET_COLOR = "#A1A1AA";
const ROW_DIVIDER = "#F4F4F5";

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = objUrl;
    });
  } catch {
    return null;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatMarkets(n: number): string {
  return n >= 1000 ? n.toLocaleString() : String(n);
}

function pctColor(pct: number): string {
  if (pct > 0.001) return "#059669";
  if (pct < -0.001) return "#DC2626";
  return "#6B7280";
}

function pctText(pct: number): string {
  if (Math.abs(pct) < 0.01) return "0.00%";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRand(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function sparklineValues(id: string, count: number, salt: number): number[] {
  const rnd = seededRand(hashStr(id + "_" + salt));
  const out: number[] = [];
  let v = 0.5 + (rnd() - 0.5) * 0.2;
  for (let i = 0; i < count; i++) {
    v += (rnd() - 0.5) * 0.1;
    if (v < 0.12) v = 0.12;
    if (v > 0.9) v = 0.9;
    out.push(v);
  }
  return out;
}

export type CardOverlayMode = "plain" | "sealed" | "speed";

function drawSealedOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
) {
  // Dim the card so the watermark dominates
  ctx.fillStyle = "rgba(10, 10, 10, 0.62)";
  ctx.fillRect(0, 0, W, H);

  // Diagonal SEALED watermark
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 8);
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.font = `900 180px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SEALED", 0, 0);

  // Subtitle beneath
  ctx.font = `600 36px ${CARD_FONT}`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText("visible at settlement", 0, 130);
  ctx.restore();

  // Top + bottom accent rules
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillRect(60, H * 0.32, W - 120, 3);
  ctx.fillRect(60, H * 0.68, W - 120, 3);
}

// Build a speed-mode canvas that's multiple screens tall — the phone
// shows a scrolling window through it, so the feed visibly streams
// past. Canvas is used as a dedicated texture; the base card is
// never shown in speed mode.
const SPEED_ROW_H = 58;
const SPEED_ROW_COUNT = 60; // ~3-4 viewports worth of content
const SPEED_HEADER_H = 160;

function buildSpeedCanvas(
  sourceId: string,
): HTMLCanvasElement {
  const W = 720;
  const H = SPEED_HEADER_H + SPEED_ROW_H * SPEED_ROW_COUNT;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#06080e";
  ctx.fillRect(0, 0, W, H);

  // Header — pinned to the top of the canvas; the phone window only
  // shows a fraction of H at a time, so we repeat the header visually
  // inside the feed too.
  ctx.fillStyle = "#0b0e14";
  ctx.fillRect(0, 0, W, SPEED_HEADER_H);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 92px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("100,000 / s", W / 2, 110);
  ctx.fillStyle = "#7c8699";
  ctx.font = `700 22px ${CARD_FONT}`;
  ctx.fillText("LIVE TRADE FEED", W / 2, 142);

  const rnd = seededRand(hashStr(sourceId + "_speed"));
  const tickers = [
    "VIS",
    "GM",
    "ITP",
    "WEA",
    "TWI",
    "STM",
    "POL",
    "NAS",
    "SEC",
    "CNG",
    "BTC",
    "ETH",
    "TRN",
    "MOV",
    "USD",
    "EUR",
  ];
  for (let i = 0; i < SPEED_ROW_COUNT; i++) {
    const y = SPEED_HEADER_H + i * SPEED_ROW_H;
    const tkr = tickers[Math.floor(rnd() * tickers.length)];
    const price = (1 + rnd() * 400).toFixed(2);
    const qty = Math.floor(rnd() * 9999) + 1;
    const up = rnd() > 0.48;

    ctx.fillStyle = i % 2 === 0 ? "#0a0c14" : "#0d1120";
    ctx.fillRect(0, y, W, SPEED_ROW_H);

    // Direction dot
    ctx.fillStyle = up ? "#10A96A" : "#DC2626";
    ctx.beginPath();
    ctx.arc(40, y + SPEED_ROW_H / 2, 7, 0, Math.PI * 2);
    ctx.fill();

    // Ticker
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `800 30px ${MONO_FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(tkr, 66, y + SPEED_ROW_H / 2 + 10);

    // Price
    ctx.fillStyle = up ? "#34D399" : "#F87171";
    ctx.font = `700 30px ${MONO_FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`$${price}`, W - 200, y + SPEED_ROW_H / 2 + 10);

    // Qty
    ctx.fillStyle = "#B8BCC6";
    ctx.font = `600 24px ${MONO_FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`×${qty.toLocaleString()}`, W - 28, y + SPEED_ROW_H / 2 + 10);
  }

  return canvas;
}

// Portrait-oriented canvas matching the iPhone screen aspect. Larger
// than the vortex tiles so the texture reads sharp on a full-screen
// iPhone. Content adapted to the taller frame: bigger header, more
// rows, a larger chart area.
function buildCardCanvas(
  sourceId: string,
  logo: HTMLImageElement | null,
  overlay: CardOverlayMode = "plain",
): HTMLCanvasElement {
  const W = 720;
  const H = Math.round(W / SCREEN_ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const source = FEATURED_SOURCES.find((s) => s.id === sourceId);
  if (!source) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    return canvas;
  }

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  const padX = 36;

  // Accent bar
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0, source.accent);
  accentGrad.addColorStop(1, source.accent + "44");
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, W, 10);

  // Header — logo + name + LIVE pill
  const headerY = 48;
  const logoSize = 116;
  const logoX = padX;
  const logoY = headerY;

  if (logo && logo.width > 0 && logo.height > 0) {
    const ratio = Math.min(logoSize / logo.width, logoSize / logo.height);
    const lw = logo.width * ratio;
    const lh = logo.height * ratio;
    ctx.drawImage(
      logo,
      logoX + (logoSize - lw) / 2,
      logoY + (logoSize - lh) / 2,
      lw,
      lh,
    );
  } else {
    ctx.fillStyle = LOGO_BG;
    drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 18);
    ctx.fill();
  }

  // Name
  const textX = logoX + logoSize + 24;
  ctx.fillStyle = NAME_COLOR;
  ctx.font = `800 52px ${CARD_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(source.name, textX, headerY + 58);

  // LIVE pill
  const pillW = 124;
  const pillH = 42;
  const pillX = W - padX - pillW;
  const pillY = headerY + 10;
  ctx.fillStyle = source.accent + "22";
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 21);
  ctx.fill();
  ctx.fillStyle = source.accent;
  ctx.beginPath();
  ctx.arc(pillX + 22, pillY + pillH / 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 22px ${CARD_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("Live", pillX + 40, pillY + 30);

  // Markets subline
  ctx.fillStyle = MARKET_COLOR;
  ctx.font = `600 26px ${MONO_FONT}`;
  ctx.textAlign = "left";
  const mStr = formatMarkets(source.markets);
  ctx.fillText(mStr, textX, headerY + 102);
  ctx.font = `500 26px ${CARD_FONT}`;
  const mW = ctx.measureText(mStr).width;
  ctx.fillText(` markets · ${source.unit}`, textX + mW, headerY + 102);

  // Divider
  const dividerTopY = headerY + 138;
  ctx.strokeStyle = ROW_DIVIDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, dividerTopY);
  ctx.lineTo(W - padX, dividerTopY);
  ctx.stroke();

  // Stat rows — show up to 4
  const rows = source.subs.slice(0, 4);
  const rowH = 82;
  const rowsStart = dividerTopY + 22;
  rows.forEach((sub, j) => {
    const rowY = rowsStart + j * rowH;
    const rowCY = rowY + rowH / 2;

    ctx.fillStyle = CHART_COLORS[j % 4];
    ctx.beginPath();
    ctx.arc(padX + 10, rowCY, 10, 0, Math.PI * 2);
    ctx.fill();

    const badgeSize = 46;
    const badgeX = padX + 32;
    const badgeY = rowCY - badgeSize / 2;
    if (sub.badge) {
      const bw = Math.max(badgeSize, 64);
      ctx.fillStyle = sub.badgeBg ?? "#71717A";
      drawRoundedRect(ctx, badgeX, badgeY, bw, badgeSize, 8);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `800 22px ${CARD_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(sub.badge, badgeX + bw / 2, rowCY + 8);
    } else {
      ctx.fillStyle = "#E4E4E7";
      ctx.beginPath();
      ctx.arc(
        badgeX + badgeSize / 2,
        rowCY,
        badgeSize / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = "#71717A";
      ctx.font = `800 24px ${CARD_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(
        sub.name.charAt(0).toUpperCase(),
        badgeX + badgeSize / 2,
        rowCY + 8,
      );
    }

    // Name
    const nameX = badgeX + 70;
    const pctX = W - padX;
    const valueX = pctX - 160;
    const nameMaxW = valueX - nameX - 14;

    ctx.fillStyle = NAME_COLOR;
    ctx.font = `600 28px ${CARD_FONT}`;
    ctx.textAlign = "left";
    let name = sub.name;
    while (ctx.measureText(name).width > nameMaxW && name.length > 4) {
      name = name.slice(0, -1);
    }
    if (name !== sub.name) name = name.slice(0, -1) + "…";
    ctx.fillText(name, nameX, rowCY + 10);

    // Value
    ctx.fillStyle = NAME_COLOR;
    ctx.font = `600 28px ${MONO_FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(sub.value, valueX + 150, rowCY + 10);

    // Pct
    ctx.fillStyle = pctColor(sub.pct);
    ctx.font = `600 26px ${MONO_FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(pctText(sub.pct), pctX, rowCY + 10);
  });
  ctx.textAlign = "left";

  // Chart
  const chartTopY = rowsStart + rows.length * rowH + 20;
  ctx.strokeStyle = ROW_DIVIDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, chartTopY);
  ctx.lineTo(W - padX, chartTopY);
  ctx.stroke();

  const chartX = padX;
  const chartY = chartTopY + 24;
  const chartW = W - padX * 2;
  const chartH = H - chartY - 40;

  // Accent gradient background
  const chartBgGrad = ctx.createLinearGradient(
    chartX,
    chartY,
    chartX,
    chartY + chartH,
  );
  chartBgGrad.addColorStop(0, "rgba(255,255,255,0)");
  chartBgGrad.addColorStop(1, source.accent + "18");
  ctx.fillStyle = chartBgGrad;
  ctx.fillRect(chartX, chartY, chartW, chartH);

  const series = [
    { color: CHART_COLORS[0], values: sparklineValues(source.id, 48, 0) },
    { color: source.accent, values: sparklineValues(source.id, 48, 3) },
  ];
  for (const { color, values } of series) {
    const pts = values.map((v, k) => ({
      x: chartX + (k / (values.length - 1)) * chartW,
      y: chartY + (1 - v) * chartH,
    }));

    const areaGrad = ctx.createLinearGradient(
      chartX,
      chartY,
      chartX,
      chartY + chartH,
    );
    areaGrad.addColorStop(0, color + "33");
    areaGrad.addColorStop(1, color + "00");
    ctx.fillStyle = areaGrad;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, chartY + chartH);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(pts[pts.length - 1].x, chartY + chartH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.stroke();

    const end = pts[pts.length - 1];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Apply the requested overlay on top of the fully-drawn base card.
  if (overlay === "sealed") {
    drawSealedOverlay(ctx, W, H);
  } else if (overlay === "speed") {
    // Speed mode: discard the base card entirely and return a tall
    // dedicated speed canvas. PhoneScene scrolls through it via
    // texture.offset.y animation per frame.
    return buildSpeedCanvas(sourceId);
  }

  return canvas;
}

// ── Three.js phone setup ────────────────────────────────────────────────

// Screen-mesh fingerprint. The iPhone display is the only material in
// the iPhone subtree that ships with an emissiveMap. On first mount we
// clone the material (so our mutations don't leak into the shared GLB
// cache) and tag the clone. On remount/replay the clone is still in
// place, so we recognise it by the tag and reuse it — the old version
// of this function keyed off "has emissiveMap and no baseColorMap",
// which fails after the first session because by then the material
// DOES have a baseColorMap (our card texture), and the screen would
// silently stop updating.
const SCREEN_CLONE_TAG = "__pwcScreenClone";

function findScreenMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((child) => {
    if (found) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) return;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (!mat || !mat.emissiveMap) return;
    if (!mat.userData[SCREEN_CLONE_TAG]) {
      const cloned = mat.clone();
      cloned.userData[SCREEN_CLONE_TAG] = true;
      mesh.material = cloned;
    }
    found = mesh;
  });
  return found;
}

function applyCoverFit(
  texture: THREE.Texture,
  srcAspect: number,
  dstAspect: number,
) {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (srcAspect > dstAspect) {
    const r = dstAspect / srcAspect;
    texture.repeat.set(r, 1);
    texture.offset.set((1 - r) / 2, 0);
  } else {
    const r = srcAspect / dstAspect;
    texture.repeat.set(1, r);
    texture.offset.set(0, (1 - r) / 2);
  }
  texture.needsUpdate = true;
}

const PhoneScene: React.FC<{
  texture: THREE.CanvasTexture;
  frame: number;
  /** Extra Y-axis rotation in degrees, added on top of the sine pivot. */
  yAxisExtraDeg: number;
  /** When true, scroll texture.offset.y per frame (speed-mode feed). */
  scrollTexture: boolean;
  /** Compact mode: no idle bob/pivot, reduced scale. */
  compact: boolean;
}> = ({ texture, frame, yAxisExtraDeg, scrollTexture, compact }) => {
  const { camera } = useThree();
  const gltf = useGLTF(MODEL_URL);

  const iphone = useMemo(
    () => gltf.scene.getObjectByName("iphone") ?? null,
    [gltf],
  );
  const screenMesh = useMemo(
    () => (iphone ? findScreenMesh(iphone) : null),
    [iphone],
  );

  // Hide everything except the iPhone
  useMemo(() => {
    const iphoneNode = gltf.scene.getObjectByName("iphone");
    const inPhone = new Set<THREE.Object3D>();
    if (iphoneNode) iphoneNode.traverse((c) => inPhone.add(c));
    gltf.scene.traverse((child) => {
      if (!inPhone.has(child) && child !== gltf.scene) {
        if ((child as THREE.Mesh).isMesh) {
          child.visible = false;
        }
      }
    });
  }, [gltf]);

  // Paint the card canvas onto the phone screen. Run as an effect so
  // the texture swap definitely fires every time the `texture` prop
  // reference changes — side effects during render were sometimes
  // being skipped by @react-three/fiber's reconciler when the swap
  // coincided with other mutations.
  useEffect(() => {
    if (!screenMesh || !texture) return;
    const canvasEl = texture.image as HTMLCanvasElement;
    const srcAspect = canvasEl.width / canvasEl.height;
    applyCoverFit(texture, srcAspect, SCREEN_ASPECT);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    const mat = screenMesh.material as THREE.MeshStandardMaterial;
    mat.map = texture;
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveMap = texture;
    mat.emissiveIntensity = 1.0;
    mat.needsUpdate = true;
  }, [screenMesh, texture]);

  // Speed-mode per-frame scroll: the texture is taller than the phone
  // window, and we advance the V offset each frame so the trade feed
  // streams upward past the viewer. Wraps cleanly when it exits.
  if (scrollTexture && texture) {
    const canvasEl = texture.image as HTMLCanvasElement;
    const srcAspect = canvasEl.width / canvasEl.height;
    // cover-fit reserves a window of size `r` in Y starting at (1-r)/2.
    const r =
      srcAspect < SCREEN_ASPECT ? srcAspect / SCREEN_ASPECT : 1;
    const baseCenter = (1 - r) / 2;
    // Scroll speed: 0.024 of texture height per frame. Negative because
    // lower offset.y shows content further down the image (= trades
    // appear to stream upward).
    const scrollProgress = (-frame * 0.024) % r;
    texture.offset.y = baseCenter + scrollProgress;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
  }

  // Independent motion, large enough to read as a living prop. Y-bob
  // sweeps ±0.35 scene units at ~1 cycle / 3.5s; Y-axis pivot sweeps
  // ±15° at ~1 cycle / 5.2s. Compact mode skips both and locks scale
  // down so the phone reads as one of the vortex cards.
  const t = frame / 30;
  const bobY = compact ? 0 : Math.sin(t * 1.8) * 0.35;
  const pivotY =
    (compact ? 0 : (Math.sin(t * 1.2) * 15 * Math.PI) / 180) +
    (yAxisExtraDeg * Math.PI) / 180;
  const scale = compact ? PHONE_SCALE * 0.42 : PHONE_SCALE;

  if (iphone) {
    iphone.position.set(PHONE_POS.x, PHONE_POS.y + bobY, PHONE_POS.z);
    const animQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, pivotY, 0, "YXZ"),
    );
    iphone.quaternion.copy(PHONE_QUAT).multiply(animQuat);
    iphone.scale.setScalar(scale);
  }

  const perspCam = camera as THREE.PerspectiveCamera;
  perspCam.position.copy(PHONE_CAM_POS);
  perspCam.lookAt(PHONE_CAM_TARGET);
  perspCam.fov = 50;
  perspCam.near = 0.1;
  perspCam.far = 200;
  perspCam.updateProjectionMatrix();

  return (
    <>
      <primitive object={gltf.scene} />
      <Environment preset="studio" environmentIntensity={1.8} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, -5]} intensity={2.5} />
      <directionalLight
        position={[-4, 4, 3]}
        intensity={0.6}
        color="#c0d8e8"
      />
    </>
  );
};

// ── Exported composition ────────────────────────────────────────────────

export const PhoneWithCard: React.FC<{
  /** FEATURED_SOURCES.id of the card currently painted on the screen. */
  cardSourceId: string;
  /** Optional list of IDs to prebuild so swaps are instant (no render gap). */
  preloadSourceIds?: string[];
  /** Extra Y-axis rotation in degrees, stacked on top of the idle pivot. */
  yAxisExtraDeg?: number;
  /** Overlay applied on top of the card. Prebuilt alongside the base. */
  overlayMode?: CardOverlayMode;
  /** Shrink the phone and lock out the idle bob/pivot. */
  compact?: boolean;
  width?: number;
  height?: number;
}> = ({
  cardSourceId,
  preloadSourceIds,
  yAxisExtraDeg = 0,
  overlayMode = "plain",
  compact = false,
  width = 1920,
  height = 1080,
}) => {
  const frame = useCurrentFrame();
  // Textures keyed by source ID. Built once per instance; swapping
  // cardSourceId picks from this map instead of rebuilding.
  const [textures, setTextures] = useState<
    Record<string, THREE.CanvasTexture>
  >({});
  const [handle] = useState(() => delayRender("phone-card-atlas"));

  // Resolve the full list of IDs we need textures for. Include
  // cardSourceId itself so the currently-displayed phase is always
  // prebuilt too.
  const ids = useMemo(() => {
    const set = new Set<string>(
      preloadSourceIds ? [...preloadSourceIds] : [],
    );
    set.add(cardSourceId);
    return Array.from(set);
  }, [preloadSourceIds, cardSourceId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const built: Record<string, THREE.CanvasTexture> = {};
      const overlays: CardOverlayMode[] = ["plain", "sealed", "speed"];
      await Promise.all(
        ids.flatMap((id) =>
          overlays.map(async (mode) => {
            const logo = await loadImage(
              staticFile(`source-imgs/icons/${id}.png`),
            );
            if (cancelled) return;
            const canvas = buildCardCanvas(id, logo, mode);
            const tex = new THREE.CanvasTexture(canvas);
            tex.needsUpdate = true;
            tex.magFilter = THREE.LinearFilter;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.generateMipmaps = true;
            tex.anisotropy = 8;
            built[`${id}:${mode}`] = tex;
          }),
        ),
      );
      if (cancelled) return;
      setTextures(built);
      continueRender(handle);
    })().catch(() => {
      if (!cancelled) continueRender(handle);
    });
    return () => {
      cancelled = true;
    };
    // ids is a stable memoised array; changes only when the user passes a
    // different preload list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join("|"), handle]);

  const lookupKey = `${cardSourceId}:${overlayMode}`;
  const active = textures[lookupKey];
  if (!active) {
    if (Object.keys(textures).length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[PhoneWithCard] miss: ${lookupKey}; have: ${Object.keys(
          textures,
        ).join(", ")}`,
      );
    }
    return <AbsoluteFill style={{ background: "transparent" }} />;
  }

  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      <ThreeCanvas
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
        camera={{
          position: [-2.8, 2.375, -4.44],
          fov: 50,
          near: 0.1,
          far: 200,
        }}
      >
        <PhoneScene
          texture={active}
          frame={frame}
          yAxisExtraDeg={yAxisExtraDeg}
          scrollTexture={overlayMode === "speed"}
          compact={compact}
        />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
