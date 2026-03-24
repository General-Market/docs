import { mulberry32 } from "../../shorts/short-02/components/city/cityConfig";

export function drawTickerOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  seed: number,
  upColor: string,
  downColor: string,
) {
  const tick = Math.floor(frame / 3);
  const rng = mulberry32(seed + tick * 137);

  const basePrice = 50 + (seed % 400);
  const change = (rng() - 0.45) * 4;
  const price = basePrice + change;
  const pctChange = (change / basePrice) * 100;
  const isUp = change > 0;
  const color = isUp ? upColor : downColor;

  ctx.globalAlpha = 0.9;

  ctx.font = "bold 11px monospace";
  ctx.textAlign = "right";
  ctx.fillStyle = color;
  ctx.fillText(`${price.toFixed(2)}`, w - 6, 14);

  ctx.font = "9px monospace";
  ctx.fillText(
    `${isUp ? "+" : ""}${pctChange.toFixed(2)}%`,
    w - 6,
    26,
  );

  const vol = Math.floor(rng() * 800 + 100);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "9px monospace";
  ctx.fillText(`Vol ${vol}K`, 6, h - 6);

  const bid = price - rng() * 0.3;
  const ask = price + rng() * 0.3;
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText(`${bid.toFixed(2)} / ${ask.toFixed(2)}`, w - 6, h - 6);

  ctx.textAlign = "start";
  ctx.globalAlpha = 1;
}
