// Canvas-texture builders for the short3d world. All deterministic.
import * as THREE from "three";
import { COL } from "./data";

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ─── grid tile (one cell), repeated across the far plane ───
export function gridTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = COL.bgGrid;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = COL.grid;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 5;
  ctx.strokeRect(-3, -3, 259, 259);
  const t = toTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ─── support bar hatch fill ───
export function hatchTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = COL.barHatchBg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = COL.barHatchLine;
  ctx.lineWidth = 7;
  for (let x = -128; x < 300; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 132);
    ctx.lineTo(x + 132, -4);
    ctx.stroke();
  }
  const t = toTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// ─── soft radial shadow blob (for candle/bar drop shadows) ───
export function shadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(c);
}

export type TextTex = { tex: THREE.CanvasTexture; aspect: number };

// ─── generic italic bold label (white, soft dark shadow) ───
export function labelTexture(
  text: string,
  opts: { px?: number; color?: string; glow?: string; letterSpacing?: number } = {},
): TextTex {
  const px = opts.px ?? 96;
  const ls = opts.letterSpacing ?? 0.06;
  const [mc, mctx] = makeCanvas(8, 8);
  mctx.font = `italic 800 ${px}px 'Switzer', Arial, sans-serif`;
  const wText = mctx.measureText(text).width * (1 + ls * 0.6) + px * (text.length - 1) * ls;
  const w = Math.ceil(wText + px * 1.2);
  const h = Math.ceil(px * 1.7);
  const [c, ctx] = makeCanvas(w, h);
  ctx.font = `italic 800 ${px}px 'Switzer', Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = opts.color ?? "#ffffff";
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = px * 0.25;
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = px * 0.12;
    ctx.shadowOffsetX = px * 0.04;
    ctx.shadowOffsetY = px * 0.05;
  }
  let x = px * 0.6;
  for (const ch of text) {
    ctx.fillText(ch, x, h / 2);
    x += ctx.measureText(ch).width + px * ls;
  }
  void mc;
  return { tex: toTexture(c), aspect: w / h };
}

// ─── BREAKOUT pill (rounded rect + border + glow + text) ───
export function pillTexture(): TextTex {
  const w = 760;
  const h = 260;
  const [c, ctx] = makeCanvas(w, h);
  const r = 62;
  const x0 = 30;
  const y0 = 30;
  const x1 = w - 30;
  const y1 = h - 30;
  const rr = (inset: number) => {
    ctx.beginPath();
    ctx.moveTo(x0 + inset + r, y0 + inset);
    ctx.arcTo(x1 - inset, y0 + inset, x1 - inset, y1 - inset, r);
    ctx.arcTo(x1 - inset, y1 - inset, x0 + inset, y1 - inset, r);
    ctx.arcTo(x0 + inset, y1 - inset, x0 + inset, y0 + inset, r);
    ctx.arcTo(x0 + inset, y0 + inset, x1 - inset, y0 + inset, r);
    ctx.closePath();
  };
  // outer white glow
  ctx.shadowColor = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#ffffff";
  rr(0);
  ctx.fill();
  ctx.shadowBlur = 0;
  // orange body with vertical gradient
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, "#f98a1c");
  g.addColorStop(0.5, COL.orange);
  g.addColorStop(1, COL.orangeDeep);
  ctx.fillStyle = g;
  rr(9);
  ctx.fill();
  // text
  ctx.font = "italic 800 118px 'Switzer', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(120,40,0,0.6)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 5;
  ctx.fillText("BREAKOUT", w / 2, h / 2 + 6);
  return { tex: toTexture(c), aspect: w / h };
}

// ─── circular badge with paper-plane triangle ───
export function badgeTexture(): TextTex {
  const s = 260;
  const [c, ctx] = makeCanvas(s, s);
  ctx.shadowColor = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(0, 30, 0, s - 30);
  g.addColorStop(0, "#f98a1c");
  g.addColorStop(1, COL.orangeDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, 89, 0, Math.PI * 2);
  ctx.fill();
  // paper-plane triangle
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(120,40,0,0.5)";
  ctx.shadowBlur = 3;
  ctx.beginPath();
  ctx.moveTo(s * 0.30, s * 0.52);
  ctx.lineTo(s * 0.72, s * 0.36);
  ctx.lineTo(s * 0.55, s * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e8e0d8";
  ctx.beginPath();
  ctx.moveTo(s * 0.47, s * 0.585);
  ctx.lineTo(s * 0.72, s * 0.36);
  ctx.lineTo(s * 0.55, s * 0.72);
  ctx.closePath();
  ctx.fill();
  return { tex: toTexture(c), aspect: 1 };
}

// ─── dome fill gradient ───
export function domeFillTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const g = ctx.createLinearGradient(256, 0, 0, 256);
  g.addColorStop(0, "rgba(130,40,200,0.40)");
  g.addColorStop(0.55, "rgba(120,70,150,0.26)");
  g.addColorStop(1, "rgba(150,130,60,0.30)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return toTexture(c);
}

// ─── channel fill ───
export function channelFillTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(64, 64);
  const g = ctx.createLinearGradient(0, 0, 64, 64);
  g.addColorStop(0, "rgba(200,180,220,0.30)");
  g.addColorStop(1, "rgba(150,120,190,0.16)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(c);
}
