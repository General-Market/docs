import { mulberry32 } from "../../shorts/short-02/components/city/cityConfig";

export function drawOrderBook(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  accentHex: string,
  seed: number,
) {
  const rng = mulberry32(seed);
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, w, h);

  const levels = 10;
  const midPrice = 100 + rng() * 50;
  const rowH = (h - 40) / (levels * 2 + 1);
  const padX = 10;

  ctx.font = "10px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("PRICE", padX, 18);
  ctx.fillText("SIZE", w - 70, 18);

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(0, 20 + levels * rowH, w, rowH);
  ctx.fillStyle = accentHex;
  ctx.font = "bold 11px monospace";
  ctx.fillText(
    midPrice.toFixed(2),
    padX + 5,
    20 + levels * rowH + rowH * 0.7,
  );

  for (let i = 0; i < levels; i++) {
    const jitter = 1 + Math.sin(frame * 0.04 + i * 0.5) * 0.15;

    const askPrice = midPrice + (levels - i) * 0.5;
    const askSize = (rng() * 20 + 5) * jitter;
    const askY = 20 + i * rowH;
    const askBar = (askSize / 30) * (w * 0.4);
    ctx.fillStyle = "rgba(255,61,0,0.12)";
    ctx.fillRect(w - padX - askBar, askY, askBar, rowH - 1);
    ctx.fillStyle = "#ff3d00";
    ctx.font = "10px monospace";
    ctx.fillText(askPrice.toFixed(2), padX + 5, askY + rowH * 0.7);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(askSize.toFixed(1), w - 65, askY + rowH * 0.7);

    const bidPrice = midPrice - (i + 1) * 0.5;
    const bidSize = (rng() * 20 + 5) * jitter;
    const bidY = 20 + (levels + 1 + i) * rowH;
    const bidBar = (bidSize / 30) * (w * 0.4);
    ctx.fillStyle = "rgba(0,230,118,0.12)";
    ctx.fillRect(w - padX - bidBar, bidY, bidBar, rowH - 1);
    ctx.fillStyle = "#00e676";
    ctx.font = "10px monospace";
    ctx.fillText(bidPrice.toFixed(2), padX + 5, bidY + rowH * 0.7);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(bidSize.toFixed(1), w - 65, bidY + rowH * 0.7);
  }

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, w, 2);
}
