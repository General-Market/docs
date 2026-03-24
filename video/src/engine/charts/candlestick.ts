import { mulberry32 } from "../../shorts/short-02/components/city/cityConfig";

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
}

export function generateCandles(seed: number, count: number): CandleData[] {
  const rng = mulberry32(seed);
  const candles: CandleData[] = [];
  let price = 100 + rng() * 50;
  for (let i = 0; i < count; i++) {
    const change = (rng() - 0.48) * 4;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + rng() * 2;
    const low = Math.min(open, close) - rng() * 2;
    candles.push({ open, high, low, close });
    price = close;
  }
  return candles;
}

export function drawCandlestick(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  accentHex: string,
  seed: number,
) {
  const candles = generateCandles(seed, 40);
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let y = 0; y < h; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const prices = candles.flatMap((c) => [c.high, c.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const padX = 20;
  const padY = 20;
  const barW = (w - padX * 2) / candles.length;
  const visibleCount = Math.min(candles.length, Math.floor(frame * 0.6) + 5);

  for (let i = 0; i < visibleCount; i++) {
    const c = candles[i];
    const bullish = c.close >= c.open;
    const color = bullish ? "#00e676" : "#ff3d00";
    const x = padX + i * barW + barW * 0.2;
    const bodyW = barW * 0.6;

    const yHigh = padY + ((maxP - c.high) / range) * (h - padY * 2);
    const yLow = padY + ((maxP - c.low) / range) * (h - padY * 2);
    const yOpen = padY + ((maxP - c.open) / range) * (h - padY * 2);
    const yClose = padY + ((maxP - c.close) / range) * (h - padY * 2);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + bodyW / 2, yHigh);
    ctx.lineTo(x + bodyW / 2, yLow);
    ctx.stroke();

    ctx.fillStyle = color;
    const bodyTop = Math.min(yOpen, yClose);
    const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
    ctx.fillRect(x, bodyTop, bodyW, bodyHeight);
  }

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, w, 2);
}
