import { mulberry32 } from "../../shorts/short-02/components/city/cityConfig";
import { generateCandles } from "./candlestick";

export function drawCandlestickOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  seed: number,
  upColor: string,
  downColor: string,
  bgColor: string = "#0d1117",
) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  const totalCandles = 80;
  const candles = generateCandles(seed, totalCandles);
  const windowSize = 28;

  const scrollPos = ((frame * 0.18) + seed * 7) % (totalCandles - windowSize);
  const startIdx = Math.floor(scrollPos);
  const visible = candles.slice(startIdx, startIdx + windowSize);

  const prices = visible.flatMap((c) => [c.high, c.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const padX = 8;
  const padY = 8;
  const barW = (w - padX * 2) / windowSize;

  ctx.globalAlpha = 0.85;
  for (let i = 0; i < visible.length; i++) {
    const c = visible[i];
    const bullish = c.close >= c.open;
    const color = bullish ? upColor : downColor;
    const x = padX + i * barW + barW * 0.15;
    const bodyW = barW * 0.7;

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
  ctx.globalAlpha = 1;
}

export function drawLineOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  seed: number,
  lineColor: string,
  bgColor: string = "#0d1117",
) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry32(seed);
  const totalPts = 120;
  const data: number[] = [];
  let val = 50 + rng() * 30;
  for (let i = 0; i < totalPts; i++) {
    val += (rng() - 0.48) * 4;
    val = Math.max(10, Math.min(90, val));
    data.push(val);
  }

  const windowSize = 50;
  const scrollPos = ((frame * 0.22) + seed * 7) % (totalPts - windowSize);
  const startIdx = Math.floor(scrollPos);
  const visible = data.slice(startIdx, startIdx + windowSize);

  const padX = 8;
  const padY = 8;

  ctx.globalAlpha = 0.4;
  const gradient = ctx.createLinearGradient(0, padY, 0, h - padY);
  gradient.addColorStop(0, lineColor + "30");
  gradient.addColorStop(1, lineColor + "00");
  ctx.beginPath();
  ctx.moveTo(padX, h - padY);
  for (let i = 0; i < visible.length; i++) {
    const x = padX + (i / (windowSize - 1)) * (w - padX * 2);
    const y = padY + ((100 - visible[i]) / 100) * (h - padY * 2);
    ctx.lineTo(x, y);
  }
  const lastX = padX + ((visible.length - 1) / (windowSize - 1)) * (w - padX * 2);
  ctx.lineTo(lastX, h - padY);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  for (let i = 0; i < visible.length; i++) {
    const x = padX + (i / (windowSize - 1)) * (w - padX * 2);
    const y = padY + ((100 - visible[i]) / 100) * (h - padY * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  const lastY = padY + ((100 - visible[visible.length - 1]) / 100) * (h - padY * 2);
  const pulse = 3 + Math.sin(frame * 0.12 + seed) * 1.5;
  ctx.beginPath();
  ctx.arc(lastX, lastY, pulse, 0, Math.PI * 2);
  ctx.fillStyle = lineColor;
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawOrderBookOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  seed: number,
  bidColor: string,
  askColor: string,
  bgColor: string = "#0d1117",
) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry32(seed);
  const f = frame + seed * 7;
  const levels = 10;
  const midPrice = 100 + rng() * 50;

  const depthH = Math.floor(h * 0.42);
  const depthY = 4;
  const midX = w / 2;

  const bidDepth: number[] = [];
  const askDepth: number[] = [];
  let cumBid = 0, cumAsk = 0;
  for (let i = 0; i < levels; i++) {
    const bJitter = 1 + Math.sin(f * 0.04 + i * 0.7) * 0.25;
    const aJitter = 1 + Math.sin(f * 0.05 + i * 0.5 + 2) * 0.25;
    cumBid += (rng() * 15 + 5) * bJitter;
    cumAsk += (rng() * 15 + 5) * aJitter;
    bidDepth.push(cumBid);
    askDepth.push(cumAsk);
  }
  const maxDepth = Math.max(bidDepth[levels - 1], askDepth[levels - 1]);
  const stepX = (midX - 8) / levels;

  // Bid depth area
  ctx.beginPath();
  ctx.moveTo(midX, depthY + depthH);
  for (let i = 0; i < levels; i++) {
    const x = midX - (i + 1) * stepX;
    const y = depthY + depthH - (bidDepth[i] / maxDepth) * (depthH - 8);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(midX - levels * stepX, depthY + depthH);
  ctx.closePath();
  ctx.fillStyle = bidColor + "30";
  ctx.fill();
  ctx.strokeStyle = bidColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(midX, depthY + depthH);
  for (let i = 0; i < levels; i++) {
    const x = midX - (i + 1) * stepX;
    const y = depthY + depthH - (bidDepth[i] / maxDepth) * (depthH - 8);
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Ask depth area
  ctx.beginPath();
  ctx.moveTo(midX, depthY + depthH);
  for (let i = 0; i < levels; i++) {
    const x = midX + (i + 1) * stepX;
    const y = depthY + depthH - (askDepth[i] / maxDepth) * (depthH - 8);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(midX + levels * stepX, depthY + depthH);
  ctx.closePath();
  ctx.fillStyle = askColor + "30";
  ctx.fill();
  ctx.strokeStyle = askColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(midX, depthY + depthH);
  for (let i = 0; i < levels; i++) {
    const x = midX + (i + 1) * stepX;
    const y = depthY + depthH - (askDepth[i] / maxDepth) * (depthH - 8);
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Center price
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(midX - 1, depthY, 2, depthH);
  const spreadJitter = Math.sin(f * 0.03) * 0.04;
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText((midPrice + spreadJitter).toFixed(2), midX, depthY + 12);
  ctx.textAlign = "start";

  // Bottom half: orderbook rows
  const bookY = depthY + depthH + 6;
  const bookH = h - bookY - 4;
  const rowH = bookH / (levels * 2 + 1);
  const padX = 4;

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, bookY + levels * rowH, w, rowH);
  ctx.fillStyle = bidColor;
  ctx.font = "bold 9px monospace";
  ctx.fillText((midPrice + spreadJitter).toFixed(2), padX + 2, bookY + levels * rowH + rowH * 0.75);

  const rng2 = mulberry32(seed + 50);
  for (let i = 0; i < levels; i++) {
    const jitter = 1 + Math.sin(f * 0.06 + i * 0.8) * 0.3;
    const flash = Math.sin(f * 0.15 + i * 1.3) > 0.85 ? 0.15 : 0;

    const askPrice = midPrice + (levels - i) * 0.5;
    const askSize = (rng2() * 18 + 4) * jitter;
    const askRowY = bookY + i * rowH;
    const askBarW = (askSize / 30) * (w * 0.38);
    ctx.fillStyle = askColor + "20";
    ctx.fillRect(w - padX - askBarW, askRowY, askBarW, rowH - 1);
    if (flash > 0) { ctx.fillStyle = askColor + "40"; ctx.fillRect(w - padX - askBarW, askRowY, askBarW, rowH - 1); }
    ctx.fillStyle = askColor;
    ctx.font = "8px monospace";
    ctx.fillText(askPrice.toFixed(2), padX + 2, askRowY + rowH * 0.75);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "right";
    ctx.fillText(askSize.toFixed(1), w - padX - 2, askRowY + rowH * 0.75);
    ctx.textAlign = "start";

    const bidPrice = midPrice - (i + 1) * 0.5;
    const bidSize = (rng2() * 18 + 4) * jitter;
    const bidRowY = bookY + (levels + 1 + i) * rowH;
    const bidBarW = (bidSize / 30) * (w * 0.38);
    ctx.fillStyle = bidColor + "20";
    ctx.fillRect(w - padX - bidBarW, bidRowY, bidBarW, rowH - 1);
    if (flash > 0) { ctx.fillStyle = bidColor + "40"; ctx.fillRect(w - padX - bidBarW, bidRowY, bidBarW, rowH - 1); }
    ctx.fillStyle = bidColor;
    ctx.font = "8px monospace";
    ctx.fillText(bidPrice.toFixed(2), padX + 2, bidRowY + rowH * 0.75);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "right";
    ctx.fillText(bidSize.toFixed(1), w - padX - 2, bidRowY + rowH * 0.75);
    ctx.textAlign = "start";
  }
}
