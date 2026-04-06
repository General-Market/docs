import React, { useMemo } from "react";
import * as THREE from "three";
import { seededRandom } from "./chartData";

// ── Color & math helpers ─────────────────────────────────────────────────────

function numLerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpColor(c1: string, c2: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  return `rgb(${Math.round(numLerp(r1, r2, t))},${Math.round(numLerp(g1, g2, t))},${Math.round(numLerp(b1, b2, t))})`;
}

function lerpColorRGBA(
  c1: string,
  c2: string,
  t: number,
  alpha: number,
): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  return `rgba(${Math.round(numLerp(r1, r2, t))},${Math.round(numLerp(g1, g2, t))},${Math.round(numLerp(b1, b2, t))},${alpha})`;
}

// ── Building specification ───────────────────────────────────────────────────

interface BuildingSpec {
  x: number;
  w: number;
  h: number;
  setback?: { at: number; inset: number };
  spire?: number;
  crown?: "chrysler" | "artDeco" | "pyramid" | "stepped";
  windowRows: number;
  windowCols: number;
  litPct: number;
  tint: string;
  glassReflection?: boolean;
  depth?: number; // 0=close, 1=mid, 2=far — for atmospheric perspective
}

// ── Skyline generation — more varied architecture ────────────────────────────

function generateSkylineUpgraded(): BuildingSpec[] {
  const buildings: BuildingSpec[] = [];

  // ── LEFT CLOSE BUILDING — massive modern glass tower ──
  buildings.push({
    x: -30,
    w: 280,
    h: 650,
    windowRows: 52,
    windowCols: 14,
    litPct: 0.72,
    tint: "#080c16",
    glassReflection: true,
    depth: 0,
  });

  // Second close building overlapping left
  buildings.push({
    x: 170,
    w: 110,
    h: 430,
    windowRows: 32,
    windowCols: 6,
    litPct: 0.58,
    tint: "#0a1020",
    glassReflection: true,
    depth: 0,
  });

  // ── ONE WTC — tall slim modern glass tower ──
  buildings.push({
    x: 470,
    w: 60,
    h: 620,
    windowRows: 54,
    windowCols: 3,
    litPct: 0.75,
    tint: "#0c1626",
    spire: 35,
    glassReflection: true,
    depth: 1,
  });

  // ── Mid-height office buildings center ──
  buildings.push({
    x: 310,
    w: 70,
    h: 340,
    windowRows: 24,
    windowCols: 4,
    litPct: 0.5,
    tint: "#0a1222",
    depth: 1,
  });
  buildings.push({
    x: 560,
    w: 58,
    h: 370,
    windowRows: 26,
    windowCols: 3,
    litPct: 0.52,
    tint: "#0b1324",
    depth: 1,
  });
  buildings.push({
    x: 635,
    w: 75,
    h: 400,
    windowRows: 28,
    windowCols: 4,
    litPct: 0.55,
    tint: "#0a1222",
    glassReflection: true,
    depth: 1,
  });

  // ── Art Deco tower with stepped crown ──
  buildings.push({
    x: 395,
    w: 48,
    h: 360,
    windowRows: 26,
    windowCols: 3,
    litPct: 0.48,
    tint: "#0b1020",
    crown: "stepped",
    depth: 1,
  });

  // ── EMPIRE STATE — center-right, setback + spire ──
  buildings.push({
    x: 740,
    w: 85,
    h: 530,
    windowRows: 38,
    windowCols: 5,
    litPct: 0.65,
    tint: "#0b1222",
    spire: 60,
    setback: { at: 0.7, inset: 16 },
    glassReflection: true,
    depth: 1,
  });

  // ── CHRYSLER — distinctive crown ──
  buildings.push({
    x: 890,
    w: 55,
    h: 460,
    windowRows: 34,
    windowCols: 3,
    litPct: 0.6,
    tint: "#0c1628",
    spire: 50,
    crown: "chrysler",
    depth: 1,
  });

  // ── Additional mid buildings ──
  buildings.push({
    x: 950,
    w: 65,
    h: 280,
    windowRows: 18,
    windowCols: 3,
    litPct: 0.42,
    tint: "#091020",
    depth: 1,
  });
  buildings.push({
    x: 1030,
    w: 55,
    h: 320,
    windowRows: 20,
    windowCols: 3,
    litPct: 0.45,
    tint: "#0a1120",
    depth: 1,
  });

  // ── Art Deco pyramid-top tower ──
  buildings.push({
    x: 1100,
    w: 50,
    h: 380,
    windowRows: 28,
    windowCols: 3,
    litPct: 0.5,
    tint: "#0b1226",
    crown: "pyramid",
    depth: 1,
  });

  // ── Small tower with artDeco top ──
  buildings.push({
    x: 580,
    w: 40,
    h: 290,
    windowRows: 18,
    windowCols: 2,
    litPct: 0.44,
    tint: "#091222",
    crown: "artDeco",
    depth: 1,
  });

  // ── RIGHT CLOSE BUILDING — large glass tower ──
  buildings.push({
    x: 1160,
    w: 230,
    h: 600,
    windowRows: 48,
    windowCols: 12,
    litPct: 0.68,
    tint: "#080c16",
    glassReflection: true,
    depth: 0,
  });

  // ── Additional close-mid building on right ──
  buildings.push({
    x: 1380,
    w: 160,
    h: 480,
    windowRows: 36,
    windowCols: 8,
    litPct: 0.6,
    tint: "#090e1a",
    glassReflection: true,
    depth: 0,
  });

  // ── Distant fill buildings (more of them, smaller) ──
  const rng = seededRandom(777);
  for (let i = 0; i < 14; i++) {
    const x = 280 + rng() * 900;
    const w = 18 + rng() * 35;
    const h = 80 + rng() * 200;
    buildings.push({
      x,
      w,
      h,
      windowRows: Math.floor(h / 20),
      windowCols: Math.max(2, Math.floor(w / 11)),
      litPct: 0.18 + rng() * 0.22,
      tint: "#070a12",
      depth: 2,
    });
  }

  // ── Extra mid-distance buildings for density ──
  for (let i = 0; i < 8; i++) {
    const x = 200 + rng() * 1000;
    const w = 30 + rng() * 50;
    const h = 150 + rng() * 250;
    buildings.push({
      x,
      w,
      h,
      windowRows: Math.floor(h / 18),
      windowCols: Math.max(2, Math.floor(w / 12)),
      litPct: 0.25 + rng() * 0.25,
      tint: "#090e1a",
      depth: 1,
    });
  }

  return buildings;
}

// ── Draw the Chrysler-style crown ────────────────────────────────────────────

function drawCrownChrysler(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  bw: number,
  tint: string,
) {
  // Series of nested arches tapering to the spire
  const arches = 7;
  const archH = 28;
  ctx.fillStyle = tint;
  for (let i = 0; i < arches; i++) {
    const t = i / arches;
    const inset = t * (bw / 2) * 0.85;
    const y = topY - i * (archH / arches) * 1.2;
    const w = bw - inset * 2;
    if (w <= 2) break;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y);
    // Triangular notch
    ctx.lineTo(cx - w / 2, y - archH / arches);
    ctx.lineTo(cx, y - archH / arches - 3);
    ctx.lineTo(cx + w / 2, y - archH / arches);
    ctx.lineTo(cx + w / 2, y);
    ctx.closePath();
    ctx.fill();
  }
  // Bright triangular facets
  ctx.fillStyle = "rgba(180,170,140,0.06)";
  for (let i = 0; i < arches; i++) {
    const t = i / arches;
    const inset = t * (bw / 2) * 0.85;
    const y = topY - i * (archH / arches) * 1.2;
    const w = bw - inset * 2;
    if (w <= 2) break;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y);
    ctx.lineTo(cx, y - archH / arches - 3);
    ctx.lineTo(cx + w / 2, y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCrownStepped(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  bw: number,
  tint: string,
) {
  const steps = 4;
  const stepH = 8;
  ctx.fillStyle = tint;
  for (let i = 0; i < steps; i++) {
    const inset = i * (bw * 0.08);
    const w = bw - inset * 2;
    if (w <= 2) break;
    ctx.fillRect(cx - w / 2, topY - (i + 1) * stepH, w, stepH);
  }
  // Subtle highlight
  ctx.fillStyle = "rgba(160,150,130,0.05)";
  for (let i = 0; i < steps; i++) {
    const inset = i * (bw * 0.08);
    const w = bw - inset * 2;
    if (w <= 2) break;
    ctx.fillRect(cx - w / 2, topY - (i + 1) * stepH, w, 1);
  }
}

function drawCrownPyramid(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  bw: number,
  tint: string,
) {
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2, topY);
  ctx.lineTo(cx, topY - 30);
  ctx.lineTo(cx + bw / 2, topY);
  ctx.closePath();
  ctx.fill();
  // Edge highlight
  ctx.strokeStyle = "rgba(150,140,120,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2, topY);
  ctx.lineTo(cx, topY - 30);
  ctx.lineTo(cx + bw / 2, topY);
  ctx.stroke();
}

function drawCrownArtDeco(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  bw: number,
  tint: string,
) {
  // Ornamental top with layered setbacks and a small dome
  ctx.fillStyle = tint;
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const inset = i * (bw * 0.1);
    const w = bw - inset * 2;
    if (w <= 2) break;
    ctx.fillRect(cx - w / 2, topY - (i + 1) * 6, w, 6);
  }
  // Small dome on top
  const domeR = bw * 0.15;
  const domeY = topY - layers * 6 - domeR;
  ctx.beginPath();
  ctx.arc(cx, domeY + domeR, domeR, Math.PI, 0);
  ctx.fill();
  // Dome highlight
  ctx.fillStyle = "rgba(200,190,160,0.06)";
  ctx.beginPath();
  ctx.arc(cx, domeY + domeR, domeR * 0.7, Math.PI, 0);
  ctx.fill();
}

// ── Main upgraded drawing function ───────────────────────────────────────────

function drawNYCSkylineUpgraded(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  timeOfDay: number = 0,
  rainIntensity: number = 0,
) {
  // timeOfDay: 0 = golden hour afternoon, 0.5 = dusk, 1 = deep night

  // ── Sky gradient ──────────────────────────────────────────────────────────
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.92);

  if (timeOfDay < 0.5) {
    // Golden hour -> dusk transition
    const t = timeOfDay * 2; // 0..1 within this range
    skyGrad.addColorStop(
      0.0,
      lerpColor("#1a3a78", "#0c2050", t),
    );
    skyGrad.addColorStop(
      0.1,
      lerpColor("#1e4488", "#142a5a", t),
    );
    skyGrad.addColorStop(
      0.2,
      lerpColor("#2a5090", "#1a3868", t),
    );
    skyGrad.addColorStop(
      0.35,
      lerpColor("#4a6898", "#3a5878", t),
    );
    skyGrad.addColorStop(
      0.48,
      lerpColor("#7a6a80", "#6a5a70", t),
    );
    skyGrad.addColorStop(
      0.58,
      lerpColor("#c08870", "#b08060", t),
    );
    skyGrad.addColorStop(
      0.68,
      lerpColor("#e09860", "#d09050", t),
    );
    skyGrad.addColorStop(
      0.78,
      lerpColor("#f0a848", "#e0a040", t),
    );
    skyGrad.addColorStop(
      0.88,
      lerpColor("#f0b050", "#d0a050", t),
    );
    skyGrad.addColorStop(
      0.95,
      lerpColor("#ffcc66", "#e0b860", t),
    );
    skyGrad.addColorStop(
      1.0,
      lerpColor("#ffe080", "#e0c060", t),
    );
  } else {
    // Dusk -> deep night transition
    const t = (timeOfDay - 0.5) * 2; // 0..1 within this range
    skyGrad.addColorStop(
      0.0,
      lerpColor("#0c2050", "#050818", t),
    );
    skyGrad.addColorStop(
      0.1,
      lerpColor("#142a5a", "#080c22", t),
    );
    skyGrad.addColorStop(
      0.2,
      lerpColor("#1a3868", "#0a1028", t),
    );
    skyGrad.addColorStop(
      0.35,
      lerpColor("#3a5878", "#101838", t),
    );
    skyGrad.addColorStop(
      0.48,
      lerpColor("#6a5a70", "#1a1a3a", t),
    );
    skyGrad.addColorStop(
      0.58,
      lerpColor("#b08060", "#1e1830", t),
    );
    skyGrad.addColorStop(
      0.68,
      lerpColor("#d09050", "#221a30", t),
    );
    skyGrad.addColorStop(
      0.78,
      lerpColor("#e0a040", "#2a1828", t),
    );
    skyGrad.addColorStop(
      0.88,
      lerpColor("#d0a050", "#1a1420", t),
    );
    skyGrad.addColorStop(
      0.95,
      lerpColor("#e0b860", "#181220", t),
    );
    skyGrad.addColorStop(
      1.0,
      lerpColor("#e0c060", "#141018", t),
    );
  }

  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // ── Purple haze at night ──────────────────────────────────────────────────
  if (timeOfDay > 0.5) {
    const hazeAlpha = (timeOfDay - 0.5) * 0.12;
    const purpleGrad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.4,
      0,
      w * 0.5,
      h * 0.4,
      w * 0.6,
    );
    purpleGrad.addColorStop(0, `rgba(60,30,80,${hazeAlpha})`);
    purpleGrad.addColorStop(0.5, `rgba(40,20,60,${hazeAlpha * 0.4})`);
    purpleGrad.addColorStop(1, "transparent");
    ctx.fillStyle = purpleGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // ── Horizon glow — warm golden glow ───────────────────────────────────────
  const glowI = numLerp(0.18, 0.06, timeOfDay);
  const glowGrad = ctx.createRadialGradient(
    w * 0.42,
    h * 0.86,
    0,
    w * 0.42,
    h * 0.86,
    w * 0.45,
  );
  glowGrad.addColorStop(
    0,
    lerpColorRGBA("#e6aa50", "#ff8844", timeOfDay, glowI),
  );
  glowGrad.addColorStop(
    0.5,
    lerpColorRGBA("#c88c3c", "#cc6630", timeOfDay, glowI * 0.35),
  );
  glowGrad.addColorStop(1, "transparent");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, w, h);

  // ── Secondary horizon glow — right side ─────────────────────────────────
  const glow2I = glowI * 0.6;
  const glow2Grad = ctx.createRadialGradient(
    w * 0.72,
    h * 0.88,
    0,
    w * 0.72,
    h * 0.88,
    w * 0.3,
  );
  glow2Grad.addColorStop(0, `rgba(220,160,70,${glow2I})`);
  glow2Grad.addColorStop(0.6, `rgba(180,120,50,${glow2I * 0.3})`);
  glow2Grad.addColorStop(1, "transparent");
  ctx.fillStyle = glow2Grad;
  ctx.fillRect(0, 0, w, h);

  // ── Animated clouds ───────────────────────────────────────────────────────
  const cloudAlpha = numLerp(0.05, 0.02, timeOfDay);
  for (let i = 0; i < 6; i++) {
    const baseX =
      (i * 380 + frame * (0.18 + i * 0.025)) % (w + 500) - 250;
    const baseY = 50 + i * 60 + Math.sin(i * 2.3) * 40;
    const cloudW = 180 + Math.sin(i * 1.7) * 80;
    const cloudH = 18 + Math.sin(i * 3.1) * 10;
    const cg = ctx.createRadialGradient(
      baseX + cloudW / 2,
      baseY,
      0,
      baseX + cloudW / 2,
      baseY,
      cloudW / 2,
    );
    const cloudColor =
      timeOfDay < 0.3
        ? `rgba(220,200,180,${cloudAlpha})`
        : `rgba(140,130,150,${cloudAlpha})`;
    cg.addColorStop(0, cloudColor);
    cg.addColorStop(
      0.6,
      `rgba(160,150,140,${cloudAlpha * 0.25})`,
    );
    cg.addColorStop(1, "transparent");
    ctx.fillStyle = cg;
    ctx.fillRect(baseX, baseY - cloudH, cloudW, cloudH * 2);
  }

  // ── Stars (fade in as sky darkens) ────────────────────────────────────────
  if (timeOfDay > 0.2) {
    const starAlpha = Math.min(1, (timeOfDay - 0.2) * 1.0);
    const rng = seededRandom(42);
    const starCount = Math.floor(35 + timeOfDay * 80); // more stars at night
    for (let i = 0; i < starCount; i++) {
      const sx = rng() * w;
      const sy = rng() * h * 0.45;
      const twinkle =
        0.5 + Math.sin(frame * 0.04 + i * 2.7) * 0.5;
      const baseBright = 0.06 + rng() * 0.35;
      ctx.fillStyle = `rgba(255,255,255,${starAlpha * baseBright * twinkle})`;
      const radius = 0.5 + rng() * 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
      // Bright stars get a subtle glow
      if (baseBright > 0.28 && twinkle > 0.7) {
        ctx.fillStyle = `rgba(200,210,255,${starAlpha * 0.02 * twinkle})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Buildings ─────────────────────────────────────────────────────────────
  const buildings = generateSkylineUpgraded();
  const baseY = h * 0.88;
  // Sort by height (shortest first → drawn first → tallest on top)
  const sorted = [...buildings].sort((a, b) => a.h - b.h);

  for (const b of sorted) {
    const bx = b.x;
    const isClose = b.w >= 140;
    const isDistant = (b.depth ?? 1) === 2;
    const isMid = (b.depth ?? 1) === 1;
    let topY = baseY - b.h;

    // ── Atmospheric perspective — distant buildings are hazier/bluer ──
    const hazeAmount = isDistant ? 0.4 : isMid ? 0.12 : 0;

    // ── Draw the main building body ──
    if (b.setback) {
      const setbackY = baseY - b.h * b.setback.at;
      ctx.fillStyle = b.tint;
      ctx.fillRect(bx, setbackY, b.w, baseY - setbackY);
      ctx.fillRect(
        bx + b.setback.inset,
        topY,
        b.w - b.setback.inset * 2,
        setbackY - topY,
      );
    } else {
      ctx.fillStyle = b.tint;
      ctx.fillRect(bx, topY, b.w, b.h);
    }

    // ── Crown / decorative top ──
    if (b.crown) {
      const cx = bx + b.w / 2;
      switch (b.crown) {
        case "chrysler":
          drawCrownChrysler(ctx, cx, topY, b.w, b.tint);
          break;
        case "stepped":
          drawCrownStepped(ctx, cx, topY, b.w, b.tint);
          break;
        case "pyramid":
          drawCrownPyramid(ctx, cx, topY, b.w, b.tint);
          break;
        case "artDeco":
          drawCrownArtDeco(ctx, cx, topY, b.w, b.tint);
          break;
      }
    }

    // ── Spire / antenna ──
    if (b.spire) {
      const spireW = b.spire > 40 ? 5 : 3;
      ctx.fillStyle = "#10141c";
      ctx.beginPath();
      ctx.moveTo(bx + b.w / 2 - spireW / 2, topY);
      ctx.lineTo(bx + b.w / 2, topY - b.spire);
      ctx.lineTo(bx + b.w / 2 + spireW / 2, topY);
      ctx.fill();
      // Blinking aviation light at tip
      const blinkOn = Math.sin(frame * 0.08 + bx * 0.01) > 0.2;
      if (blinkOn) {
        ctx.fillStyle = `rgba(255,80,40,${0.6 + timeOfDay * 0.35})`;
        ctx.beginPath();
        ctx.arc(
          bx + b.w / 2,
          topY - b.spire,
          2.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        // Glow
        ctx.fillStyle = `rgba(255,80,40,${0.12 + timeOfDay * 0.12})`;
        ctx.beginPath();
        ctx.arc(
          bx + b.w / 2,
          topY - b.spire,
          7,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    // ── Glass reflection overlay (subtle gradient on building face) ──
    if (b.glassReflection) {
      const reflGrad = ctx.createLinearGradient(bx, topY, bx + b.w, topY);
      reflGrad.addColorStop(0, "rgba(100,120,160,0.0)");
      reflGrad.addColorStop(0.3, "rgba(130,150,200,0.04)");
      reflGrad.addColorStop(0.5, "rgba(160,180,220,0.06)");
      reflGrad.addColorStop(0.7, "rgba(130,150,200,0.03)");
      reflGrad.addColorStop(1, "rgba(100,120,160,0.0)");
      ctx.fillStyle = reflGrad;
      ctx.fillRect(bx, topY, b.w, b.h);

      // Vertical sky reflection gradient (brighter near top)
      const skyReflGrad = ctx.createLinearGradient(
        bx,
        topY,
        bx,
        topY + b.h,
      );
      skyReflGrad.addColorStop(0, "rgba(140,160,200,0.05)");
      skyReflGrad.addColorStop(0.3, "rgba(120,140,180,0.02)");
      skyReflGrad.addColorStop(1, "rgba(80,100,140,0.0)");
      ctx.fillStyle = skyReflGrad;
      ctx.fillRect(bx, topY, b.w, b.h);
    }

    // ── Atmospheric haze overlay ──
    if (hazeAmount > 0) {
      const hazeColor = timeOfDay > 0.5 ? "rgba(12,18,40" : "rgba(20,30,60";
      ctx.fillStyle = `${hazeColor},${hazeAmount})`;
      ctx.fillRect(bx, topY, b.w, b.h);
    }

    // ── Building edge highlights ──
    ctx.fillStyle = isClose
      ? "rgba(180,200,240,0.07)"
      : "rgba(140,170,220,0.04)";
    ctx.fillRect(bx + b.w - 2, topY, 2, b.h);
    ctx.fillStyle = isClose
      ? "rgba(160,180,220,0.05)"
      : "rgba(120,150,200,0.03)";
    ctx.fillRect(bx, topY, 1, b.h);
    ctx.fillStyle = "rgba(140,170,220,0.05)";
    ctx.fillRect(bx, topY, b.w, 1);

    // ── Window grid ─────────────────────────────────────────────────────────
    const margin = isClose ? 4 : 3;
    const winGapX = isClose ? 2.5 : 1.5;
    const winGapY = isClose ? 2.0 : 1.2;

    const totalWinW = b.w - margin * 2;
    const totalWinH = b.h - margin * 2;
    const cellW = totalWinW / b.windowCols;
    const cellH = totalWinH / b.windowRows;
    const sqW = Math.max(1.5, cellW - winGapX);
    const sqH = Math.max(1.5, cellH - winGapY);

    const winRng = seededRandom(Math.round(bx * 100 + b.h));
    const litBoost = timeOfDay * 0.15;

    const setbackRowLimit = b.setback
      ? Math.floor(b.windowRows * b.setback.at)
      : b.windowRows;

    for (let row = 0; row < b.windowRows; row++) {
      for (let col = 0; col < b.windowCols; col++) {
        // More random on/off: base litPct varies per floor cluster
        const floorCluster =
          Math.sin(row * 0.7 + col * 1.3 + bx * 0.01) * 0.1;
        const isLit =
          winRng() < b.litPct + litBoost + floorCluster;
        const warmth = winRng(); // pre-consume for determinism

        if (!isLit) continue;

        let wx: number, wy: number;
        if (b.setback && row < b.windowRows - setbackRowLimit) {
          const narrowW = b.w - b.setback.inset * 2;
          const narrowCellW =
            (narrowW - margin * 2) / b.windowCols;
          if (narrowCellW < 2) continue;
          wx = bx + b.setback.inset + margin + col * narrowCellW;
          wy = topY + margin + row * cellH;
        } else {
          wx = bx + margin + col * cellW;
          wy = topY + margin + row * cellH;
        }

        // TV flicker effect — some windows flicker like TV screens
        const tvFlicker =
          warmth > 0.12 && warmth < 0.2
            ? Math.sin(
                frame * 0.15 + row * 5.3 + col * 3.7 + bx * 0.2,
              ) *
                0.15 +
              Math.sin(
                frame * 0.22 + row * 2.1 + col * 7.9,
              ) *
                0.1
            : 0;

        const flicker =
          Math.sin(
            frame * 0.02 + row * 3.7 + col * 2.1 + bx * 0.1,
          ) > 0.75
            ? 0.1
            : 0;
        const baseAlpha = isClose
          ? 0.5
          : isDistant
            ? 0.18
            : 0.38;
        const alpha =
          baseAlpha + warmth * 0.4 + flicker + tvFlicker;

        if (warmth > 0.55) {
          // Warm amber-gold (most common — real NYC at dusk)
          ctx.fillStyle = `rgba(255,200,110,${alpha})`;
        } else if (warmth > 0.35) {
          // Cool white-blue (office fluorescent)
          ctx.fillStyle = `rgba(190,210,250,${alpha * 0.6})`;
        } else if (warmth > 0.2) {
          // Warm orange (warmer rooms)
          ctx.fillStyle = `rgba(255,170,80,${alpha * 0.85})`;
        } else if (warmth > 0.12) {
          // Cool blue-white (TV screens)
          ctx.fillStyle = `rgba(140,170,255,${(alpha + tvFlicker) * 0.7})`;
        } else {
          // Dark / barely visible interior glow
          ctx.fillStyle = `rgba(80,100,140,${alpha * 0.22})`;
        }
        ctx.fillRect(wx, wy, sqW, sqH);
      }
    }

    // ── Horizontal floor lines on close buildings ──
    if (isClose) {
      for (let row = 0; row < b.windowRows; row++) {
        const lineY = topY + margin + row * cellH;
        ctx.fillStyle = "rgba(30,50,80,0.14)";
        ctx.fillRect(bx, lineY, b.w, 1);
      }
    }

    // ── Vertical glass panel lines on close buildings ──
    if (isClose) {
      const panelW = b.w / (b.windowCols * 2);
      for (let p = 1; p < b.windowCols * 2; p++) {
        ctx.fillStyle = "rgba(40,60,90,0.1)";
        ctx.fillRect(bx + p * panelW, topY, 1, b.h);
      }
    }
  }

  // ── Light pollution glow at city base ─────────────────────────────────────
  const pollutionGrad = ctx.createLinearGradient(0, baseY - 100, 0, baseY + 20);
  pollutionGrad.addColorStop(0, "transparent");
  pollutionGrad.addColorStop(
    0.4,
    `rgba(200,160,80,${0.02 + timeOfDay * 0.04})`,
  );
  pollutionGrad.addColorStop(
    0.7,
    `rgba(220,170,90,${0.05 + timeOfDay * 0.06})`,
  );
  pollutionGrad.addColorStop(
    1.0,
    `rgba(180,140,70,${0.06 + timeOfDay * 0.05})`,
  );
  ctx.fillStyle = pollutionGrad;
  ctx.fillRect(0, baseY - 100, w, 120);

  // Wider ambient city glow (extends higher at night)
  const ambientGlow = ctx.createRadialGradient(
    w * 0.5,
    baseY,
    0,
    w * 0.5,
    baseY,
    w * 0.5,
  );
  ambientGlow.addColorStop(
    0,
    `rgba(200,150,80,${0.03 + timeOfDay * 0.04})`,
  );
  ambientGlow.addColorStop(
    0.6,
    `rgba(180,130,60,${0.01 + timeOfDay * 0.02})`,
  );
  ambientGlow.addColorStop(1, "transparent");
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(0, baseY - 200, w, 250);

  // ── Subtle lens flare dots at bright window clusters ─────────────────────
  if (timeOfDay > 0.3) {
    const flareRng = seededRandom(999);
    const flareCount = 8 + Math.floor(timeOfDay * 12);
    const flareAlpha = (timeOfDay - 0.3) * 0.15;
    for (let i = 0; i < flareCount; i++) {
      const fx = 100 + flareRng() * (w - 200);
      const fy = baseY - 60 - flareRng() * 300;
      const fr = 2 + flareRng() * 4;
      const twinkle =
        0.4 +
        Math.sin(frame * 0.03 + i * 4.1) * 0.6;
      ctx.fillStyle = `rgba(255,220,140,${flareAlpha * twinkle * (0.3 + flareRng() * 0.7)})`;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();
      // Glow ring
      ctx.fillStyle = `rgba(255,200,100,${flareAlpha * twinkle * 0.15})`;
      ctx.beginPath();
      ctx.arc(fx, fy, fr * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Ground/water at bottom ────────────────────────────────────────────────
  const waterGrad = ctx.createLinearGradient(0, baseY, 0, h);
  waterGrad.addColorStop(0, "rgba(10,15,25,0.45)");
  waterGrad.addColorStop(1, "rgba(8,12,20,0.92)");
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, baseY, w, h - baseY);

  // ── City haze at base of buildings ────────────────────────────────────────
  const hazeGrad = ctx.createLinearGradient(
    0,
    baseY - 70,
    0,
    baseY + 12,
  );
  hazeGrad.addColorStop(0, "transparent");
  hazeGrad.addColorStop(
    0.5,
    `rgba(180,140,80,${0.03 + timeOfDay * 0.03})`,
  );
  hazeGrad.addColorStop(
    1,
    `rgba(150,120,70,${0.05 + timeOfDay * 0.04})`,
  );
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, baseY - 70, w, 82);

  // ── Rain effects ──────────────────────────────────────────────────────────
  if (rainIntensity > 0) {
    // Diffuse/blur the city lights slightly by overlaying a semi-transparent layer
    const blurAlpha = rainIntensity * 0.08;
    ctx.fillStyle = `rgba(15,20,35,${blurAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Misty atmosphere
    const mistGrad = ctx.createLinearGradient(0, h * 0.3, 0, h);
    mistGrad.addColorStop(0, `rgba(40,50,70,${rainIntensity * 0.04})`);
    mistGrad.addColorStop(0.5, `rgba(50,60,80,${rainIntensity * 0.08})`);
    mistGrad.addColorStop(1, `rgba(40,50,70,${rainIntensity * 0.06})`);
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, 0, w, h);

    // Diagonal rain streaks
    const rainRng = seededRandom(frame * 3 + 12345);
    const streakCount = Math.floor(rainIntensity * 300);
    ctx.strokeStyle = `rgba(180,200,230,${0.06 + rainIntensity * 0.12})`;
    ctx.lineWidth = 0.8;

    for (let i = 0; i < streakCount; i++) {
      const rx = rainRng() * (w + 100) - 50;
      const ry = rainRng() * h;
      const len = 12 + rainRng() * 25 * rainIntensity;
      const windAngle = 0.15 + Math.sin(frame * 0.01) * 0.05; // slight wind sway
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + len * windAngle, ry + len);
      ctx.stroke();
    }

    // Heavier rain gets thicker drops
    if (rainIntensity > 0.5) {
      const heavyCount = Math.floor((rainIntensity - 0.5) * 120);
      ctx.strokeStyle = `rgba(200,215,240,${0.08 + rainIntensity * 0.08})`;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < heavyCount; i++) {
        const rx = rainRng() * (w + 100) - 50;
        const ry = rainRng() * h;
        const len = 18 + rainRng() * 35;
        const windAngle = 0.15 + Math.sin(frame * 0.01) * 0.05;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + len * windAngle, ry + len);
        ctx.stroke();
      }
    }

    // Rain splash halos at base of buildings during heavy rain
    if (rainIntensity > 0.3) {
      const splashRng = seededRandom(frame * 7 + 55555);
      const splashCount = Math.floor(rainIntensity * 40);
      for (let i = 0; i < splashCount; i++) {
        const sx = splashRng() * w;
        const sy = baseY - 5 + splashRng() * 15;
        const sr = 1 + splashRng() * 3;
        ctx.fillStyle = `rgba(180,200,230,${0.03 + rainIntensity * 0.04})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exported Components
// ═══════════════════════════════════════════════════════════════════════════════

export const SkylineUpgraded: React.FC<{
  frame: number;
  timeOfDay?: number;
  rainIntensity?: number;
}> = ({ frame, timeOfDay = 0, rainIntensity = 0 }) => {
  const canvasRef = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 1024;
    return c;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvasRef);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [canvasRef]);

  const ctx = canvasRef.getContext("2d")!;
  drawNYCSkylineUpgraded(ctx, 2048, 1024, frame, timeOfDay, rainIntensity);
  texture.needsUpdate = true;

  return (
    <group position={[0, 2.0, -2.8]}>
      <mesh>
        <planeGeometry args={[7.0, 4.0]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive={new THREE.Color("#ffffff")}
          emissiveIntensity={0.35}
          roughness={0.9}
          toneMapped={false}
        />
      </mesh>

      {/* City light glow */}
      <pointLight
        position={[0, -0.5, 0.5]}
        color="#FFD090"
        intensity={0.5}
        distance={5}
        decay={2}
      />
      <pointLight
        position={[-2, 0, 0.5]}
        color="#FFC070"
        intensity={0.25}
        distance={4}
        decay={2}
      />
      <pointLight
        position={[2, 0, 0.5]}
        color="#FFC070"
        intensity={0.25}
        distance={4}
        decay={2}
      />
    </group>
  );
};

// ── Window frames — 5 panels, thinner mullions, glass shimmer ────────────────

export const WindowFramesUpgraded: React.FC = () => {
  const frameColor = "#060810";
  const frameZ = -2.75;
  const mullionW = 0.065; // thinner, more elegant mullions
  const edgeW = 0.10;

  // 5 panels: need 4 vertical mullions
  // Total visible width ~6.4 (inner edges at -3.2 to +3.2)
  // 5 panels of ~1.24 each with mullions in between
  const panelWidth = 1.24;
  const mullionXPositions = [
    -panelWidth * 1.5 - mullionW,
    -panelWidth * 0.5,
    panelWidth * 0.5,
    panelWidth * 1.5 + mullionW,
  ];

  return (
    <group>
      {/* Four vertical mullions — divide view into 5 panels */}
      {mullionXPositions.map((x, i) => (
        <mesh key={`vm-${i}`} position={[x, 2.0, frameZ]}>
          <boxGeometry args={[mullionW, 3.8, 0.06]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.15}
            metalness={0.75}
          />
        </mesh>
      ))}

      {/* Subtle horizontal crossbar at mid height */}
      <mesh position={[0, 1.55, frameZ]}>
        <boxGeometry args={[7, 0.025, 0.05]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={0.15}
          metalness={0.75}
        />
      </mesh>

      {/* Second subtle crossbar higher up */}
      <mesh position={[0, 2.8, frameZ]}>
        <boxGeometry args={[7, 0.02, 0.05]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={0.15}
          metalness={0.75}
        />
      </mesh>

      {/* Frame edges (left and right outer borders) */}
      <mesh position={[-3.3, 2.0, frameZ]}>
        <boxGeometry args={[edgeW, 3.8, 0.07]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={0.15}
          metalness={0.75}
        />
      </mesh>
      <mesh position={[3.3, 2.0, frameZ]}>
        <boxGeometry args={[edgeW, 3.8, 0.07]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={0.15}
          metalness={0.75}
        />
      </mesh>

      {/* Top rail */}
      <mesh position={[0, 3.9, frameZ]}>
        <boxGeometry args={[7, 0.06, 0.07]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={0.15}
          metalness={0.75}
        />
      </mesh>

      {/* Bottom sill */}
      <mesh position={[0, 0.15, frameZ]}>
        <boxGeometry args={[7, 0.05, 0.07]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={0.15}
          metalness={0.75}
        />
      </mesh>

      {/* Glass reflection/shimmer panels — subtle transparent planes in front of each window panel */}
      {[-2.48, -1.24, 0, 1.24, 2.48].map((x, i) => (
        <mesh key={`glass-${i}`} position={[x, 2.0, frameZ + 0.03]}>
          <planeGeometry args={[panelWidth - 0.04, 3.7]} />
          <meshStandardMaterial
            color="#88aacc"
            transparent
            opacity={0.018 + (i % 2) * 0.006}
            roughness={0.05}
            metalness={0.95}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};
