// ---------------------------------------------------------------------------
// Canvas texture generator for building facades
// Adapted from penthouse CityBuildings3D — parameterized colors for Miami look
// ---------------------------------------------------------------------------

import { mulberry32 } from "./cityConfig";

/**
 * Paints a single building facade onto a canvas element.
 * Returns the canvas for use as THREE.CanvasTexture source.
 *
 * Uses 2D canvas API: background → mullions → spandrels → per-window lit/unlit
 * with gradients → glass reflection streaks → lobby band.
 */
export function createBuildingFacade(
  seed: number,
  litPct: number,
  glassColor: string,
  litColor: string,
  bodyColor: string,
  mullionColor: string,
  texW = 256,
  texH = 512,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry32(seed);

  // --- Background fill (facade body) ---
  ctx.fillStyle = bodyColor;
  ctx.fillRect(0, 0, texW, texH);

  // --- Floor & column layout ---
  const numFloors = 18 + Math.floor(rng() * 12);
  const numCols = 5 + Math.floor(rng() * 4);
  const floorH = texH / numFloors;
  const colW = texW / numCols;
  const mullW = 2 + Math.floor(rng() * 3);
  const spandrelH = Math.max(2, floorH * (0.18 + rng() * 0.12));

  // --- Vertical mullions (structural columns) ---
  ctx.fillStyle = mullionColor;
  for (let c = 0; c <= numCols; c++) {
    const x = c * colW;
    ctx.fillRect(x - mullW / 2, 0, mullW, texH);
  }

  // --- Parse hex colors for per-pixel blending ---
  const parseHex = (hex: string) => {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  };
  const glass = parseHex(glassColor);
  const lit = parseHex(litColor);

  // --- Floor-by-floor windows ---
  for (let fl = 0; fl < numFloors; fl++) {
    const floorY = fl * floorH;
    const floorDark = rng() < 0.10;
    const floorBrightness = floorDark ? 0 : 0.6 + rng() * 0.4;

    // Horizontal spandrel band
    ctx.fillStyle = mullionColor;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, floorY, texW, spandrelH);
    ctx.globalAlpha = 1;

    if (floorDark) continue;

    for (let c = 0; c < numCols; c++) {
      const winLeft = c * colW + mullW / 2 + 1;
      const winTop = floorY + spandrelH + 1;
      const winW = colW - mullW - 2;
      const winH = floorH - spandrelH - 2;
      if (winW < 2 || winH < 2) continue;

      const isLit = rng() < litPct;

      if (!isLit) {
        // Unlit window — glass tint
        ctx.fillStyle = `rgba(${glass.r},${glass.g},${glass.b},0.7)`;
        ctx.fillRect(winLeft, winTop, winW, winH);

        // Diagonal reflection gradient (Dubai glass look)
        const grad = ctx.createLinearGradient(winLeft, winTop, winLeft + winW, winTop + winH);
        grad.addColorStop(0, `rgba(${Math.min(255, glass.r + 40)},${Math.min(255, glass.g + 40)},${Math.min(255, glass.b + 40)},${0.06 + rng() * 0.08})`);
        grad.addColorStop(0.5, "transparent");
        grad.addColorStop(1, `rgba(${glass.r},${glass.g},${glass.b},${0.03 + rng() * 0.05})`);
        ctx.fillStyle = grad;
        ctx.fillRect(winLeft, winTop, winW, winH);
        continue;
      }

      // Lit window — warm interior glow
      const brightness = floorBrightness * (0.7 + rng() * 0.3);
      const warmth = rng();
      let r: number, g: number, b: number;

      if (warmth > 0.5) {
        // Warm yellow-orange (dominant for Miami warmth)
        r = lit.r;
        g = lit.g - Math.floor(rng() * 30);
        b = lit.b - Math.floor(rng() * 40);
      } else if (warmth > 0.25) {
        // Cool white-blue office light
        r = 180 + Math.floor(rng() * 40);
        g = 200 + Math.floor(rng() * 30);
        b = 240;
      } else {
        // Warm amber
        r = 255;
        g = 160 + Math.floor(rng() * 40);
        b = 60 + Math.floor(rng() * 40);
      }

      const alpha = brightness * (0.5 + rng() * 0.35);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillRect(winLeft, winTop, winW, winH);

      // Interior depth gradient (darker at top for ceiling shadow)
      const interGrad = ctx.createLinearGradient(winLeft, winTop, winLeft, winTop + winH);
      interGrad.addColorStop(0, `rgba(0,0,0,${0.15 + rng() * 0.1})`);
      interGrad.addColorStop(0.5, "transparent");
      interGrad.addColorStop(1, `rgba(0,0,0,0.05)`);
      ctx.fillStyle = interGrad;
      ctx.fillRect(winLeft, winTop, winW, winH);
    }
  }

  // --- Lobby band (brighter bottom ~2 floors) ---
  const lobbyH = floorH * 2;
  const lobbyGrad = ctx.createLinearGradient(0, texH - lobbyH, 0, texH);
  lobbyGrad.addColorStop(0, "transparent");
  lobbyGrad.addColorStop(0.3, `rgba(${lit.r},${lit.g},${lit.b},0.15)`);
  lobbyGrad.addColorStop(1, `rgba(${lit.r},${lit.g},${lit.b},0.25)`);
  ctx.fillStyle = lobbyGrad;
  ctx.fillRect(0, texH - lobbyH, texW, lobbyH);

  // --- Glass tint overlay ---
  ctx.fillStyle = `rgba(${glass.r},${glass.g},${glass.b},0.06)`;
  ctx.fillRect(0, 0, texW, texH);

  // --- Vertical reflection streak ---
  const streakX = texW * (0.3 + rng() * 0.4);
  const streakGrad = ctx.createLinearGradient(streakX - 30, 0, streakX + 30, 0);
  streakGrad.addColorStop(0, "transparent");
  streakGrad.addColorStop(0.5, `rgba(${Math.min(255, glass.r + 60)},${Math.min(255, glass.g + 60)},${Math.min(255, glass.b + 60)},${0.04 + rng() * 0.04})`);
  streakGrad.addColorStop(1, "transparent");
  ctx.fillStyle = streakGrad;
  ctx.fillRect(0, 0, texW, texH);

  return canvas;
}
