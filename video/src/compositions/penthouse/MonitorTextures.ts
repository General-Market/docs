import { generateCandles, generateLineData, generateOrderBook } from "./chartData";

// ── Shared helpers ──────────────────────────────────────────────────────────
const BG = "#0d1117";
const GRID = "rgba(255,255,255,0.04)";
const TEXT_DIM = "rgba(255,255,255,0.35)";
const GREEN = "#00e676";
const RED = "#ff3d00";
const BLUE = "#3B82F6";
const GOLD = "#FFD700";
const PURPLE = "#8B5CF6";

function clearBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, pad: { t: number; r: number; b: number; l: number }, rows: number) {
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const chartH = h - pad.t - pad.b;
  for (let i = 0; i <= rows; i++) {
    const y = pad.t + (i / rows) * chartH;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = TEXT_DIM, size = 11) {
  ctx.fillStyle = color;
  ctx.font = `${size}px monospace`;
  ctx.fillText(text, x, y);
}

// ── Candlestick Chart ──────────────────────────────────────────────────────
export function drawCandlestick(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number, seed = 42) {
  clearBg(ctx, w, h);
  const candles = generateCandles(seed, 50);
  const pad = { t: 30, r: 12, b: 20, l: 50 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;

  const allP = candles.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...allP) * 0.998;
  const maxP = Math.max(...allP) * 1.002;
  const range = maxP - minP;
  const yScale = (p: number) => pad.t + chartH - ((p - minP) / range) * chartH;

  drawGrid(ctx, w, h, pad, 5);

  // Price labels
  for (let i = 0; i <= 5; i++) {
    const val = minP + (i / 5) * range;
    const y = yScale(val);
    drawLabel(ctx, val.toFixed(1), 2, y + 4, TEXT_DIM, 9);
  }

  const candleW = chartW / 50;
  const bodyW = candleW * 0.6;
  const visibleCount = Math.min(50, Math.floor(frame * 0.7) + 5);

  for (let i = 0; i < visibleCount; i++) {
    const c = candles[i];
    const x = pad.l + i * candleW + candleW / 2;
    const bullish = c.close >= c.open;
    const color = bullish ? GREEN : RED;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yScale(c.high));
    ctx.lineTo(x, yScale(c.low));
    ctx.stroke();

    const bodyTop = yScale(Math.max(c.open, c.close));
    const bodyH = Math.max(1, yScale(Math.min(c.open, c.close)) - bodyTop);
    ctx.fillStyle = color;
    ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyH);
  }

  drawLabel(ctx, "OHLC · 1H · SMA(14)", pad.l + 4, pad.t - 10, TEXT_DIM, 11);

  // Pulsing dot on last candle
  if (visibleCount > 0) {
    const last = candles[visibleCount - 1];
    const lx = pad.l + (visibleCount - 1) * candleW + candleW / 2;
    const ly = yScale(last.close);
    const pulse = 3 + Math.sin(frame * 0.15) * 2;
    ctx.beginPath();
    ctx.arc(lx, ly, pulse, 0, Math.PI * 2);
    ctx.fillStyle = last.close >= last.open ? GREEN : RED;
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(lx, ly, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Line Chart ─────────────────────────────────────────────────────────────
export function drawLineChart(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number, seed = 77, color = BLUE) {
  clearBg(ctx, w, h);
  const data = generateLineData(seed, 80);
  const pad = { t: 24, r: 10, b: 20, l: 45 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;

  const minV = Math.min(...data) * 0.98;
  const maxV = Math.max(...data) * 1.02;
  const range = maxV - minV;

  drawGrid(ctx, w, h, pad, 4);

  // Price labels
  for (let i = 0; i <= 4; i++) {
    const val = maxV - (i / 4) * range;
    const y = pad.t + (i / 4) * chartH;
    drawLabel(ctx, val.toFixed(1), 2, y + 4, TEXT_DIM, 9);
  }

  const visiblePts = Math.min(80, Math.floor(frame * 1.2) + 10);

  // Area fill
  ctx.beginPath();
  for (let i = 0; i < visiblePts; i++) {
    const x = pad.l + (i / 79) * chartW;
    const y = pad.t + chartH - ((data[i] - minV) / range) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  const lastX = pad.l + ((visiblePts - 1) / 79) * chartW;
  ctx.lineTo(lastX, pad.t + chartH);
  ctx.lineTo(pad.l, pad.t + chartH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH);
  grad.addColorStop(0, color + "40");
  grad.addColorStop(1, color + "00");
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  for (let i = 0; i < visiblePts; i++) {
    const x = pad.l + (i / 79) * chartW;
    const y = pad.t + chartH - ((data[i] - minV) / range) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pulsing dot
  if (visiblePts > 0) {
    const lx = pad.l + ((visiblePts - 1) / 79) * chartW;
    const ly = pad.t + chartH - ((data[visiblePts - 1] - minV) / range) * chartH;
    const pulse = 4 + Math.sin(frame * 0.15) * 2;
    ctx.beginPath();
    ctx.arc(lx, ly, pulse, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(lx, ly, 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  drawLabel(ctx, "PRICE · 15M", pad.l + 4, pad.t - 8, TEXT_DIM, 11);
}

// ── Order Book ─────────────────────────────────────────────────────────────
export function drawOrderBook(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number, seed = 123) {
  clearBg(ctx, w, h);
  const levels = 10;
  const midPrice = 127.45;
  const book = generateOrderBook(seed, levels, midPrice);

  const pad = { t: 28, r: 8, b: 8, l: 8 };
  const innerW = w - pad.l - pad.r;
  const rowH = (h - pad.t - pad.b) / (levels * 2 + 1);
  const maxSize = Math.max(...book.bids.map(l => l.size), ...book.asks.map(l => l.size));

  drawLabel(ctx, "ORDER BOOK", pad.l + 4, 18, TEXT_DIM, 11);
  drawLabel(ctx, "PRICE", pad.l + 4, pad.t - 2, "rgba(255,255,255,0.25)", 8);
  ctx.textAlign = "right";
  drawLabel(ctx, "SIZE", w - pad.r - 4, pad.t - 2, "rgba(255,255,255,0.25)", 8);
  ctx.textAlign = "left";

  const progress = Math.min(1, frame / 40);

  // Asks (reversed)
  const asks = [...book.asks].reverse();
  asks.forEach((level, i) => {
    const y = pad.t + i * rowH;
    const jitter = 1 + Math.sin(frame * 0.04 + i * 0.5) * 0.15;
    const barW = (level.size / maxSize) * innerW * 0.6 * progress * jitter;

    ctx.fillStyle = "rgba(255,61,0,0.15)";
    ctx.fillRect(w - pad.r - barW, y + 1, barW, rowH - 2);
    ctx.fillStyle = RED;
    ctx.globalAlpha = 0.8;
    ctx.font = "9px monospace";
    ctx.fillText(level.price.toFixed(2), pad.l + 4, y + rowH - 3);
    ctx.textAlign = "right";
    ctx.globalAlpha = 0.6;
    ctx.fillText((level.size * jitter).toFixed(1), w - pad.r - 4, y + rowH - 3);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  });

  // Spread
  const spreadY = pad.t + levels * rowH;
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(pad.l, spreadY, innerW, rowH);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "bold 10px monospace";
  const spread = book.asks[0].price - book.bids[0].price;
  ctx.fillText(`${midPrice.toFixed(2)} · ${spread.toFixed(2)}`, w / 2, spreadY + rowH - 3);
  ctx.textAlign = "left";

  // Bids
  book.bids.forEach((level, i) => {
    const y = pad.t + (levels + 1 + i) * rowH;
    const jitter = 1 + Math.sin(frame * 0.04 + i * 0.5) * 0.15;
    const barW = (level.size / maxSize) * innerW * 0.6 * progress * jitter;

    ctx.fillStyle = "rgba(0,230,118,0.15)";
    ctx.fillRect(w - pad.r - barW, y + 1, barW, rowH - 2);
    ctx.fillStyle = GREEN;
    ctx.globalAlpha = 0.8;
    ctx.font = "9px monospace";
    ctx.fillText(level.price.toFixed(2), pad.l + 4, y + rowH - 3);
    ctx.textAlign = "right";
    ctx.globalAlpha = 0.6;
    ctx.fillText((level.size * jitter).toFixed(1), w - pad.r - 4, y + rowH - 3);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  });
}

// ── Terminal / Code ────────────────────────────────────────────────────────
export function drawTerminal(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  clearBg(ctx, w, h);

  // Title bar dots
  const dotY = 10;
  ctx.fillStyle = "#ff5f56"; ctx.beginPath(); ctx.arc(12, dotY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffbd2e"; ctx.beginPath(); ctx.arc(24, dotY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#27c93f"; ctx.beginPath(); ctx.arc(36, dotY, 4, 0, Math.PI * 2); ctx.fill();
  drawLabel(ctx, "strategy.py", 50, 14, "rgba(255,255,255,0.3)", 9);

  const lines = [
    { text: "$ python3 run_strategy.py", color: GREEN, delay: 0 },
    { text: "[INFO] Loading model weights...", color: PURPLE, delay: 3 },
    { text: "[INFO] Fetching OHLCV data...", color: PURPLE, delay: 8 },
    { text: "[OK] 2,847 candles loaded", color: GREEN, delay: 14 },
    { text: "[SIGNAL] BUY BTC @ 97,432.50", color: GOLD, delay: 20 },
    { text: "[RISK] Position size: 0.45 BTC", color: BLUE, delay: 25 },
    { text: "[P&L] Unrealized: +$1,247.30", color: GREEN, delay: 32 },
    { text: "[SIGNAL] SELL ETH @ 3,288.10", color: RED, delay: 38 },
    { text: "[OK] Order filled @ 3,287.95", color: GREEN, delay: 43 },
    { text: "[INFO] Next scan in 14s...", color: PURPLE, delay: 50 },
    { text: "[SIGNAL] BUY SOL @ 198.45", color: GOLD, delay: 58 },
    { text: "[OK] Limit order placed", color: GREEN, delay: 63 },
  ];

  ctx.font = "10px monospace";
  lines.forEach((line, i) => {
    const lineFrame = frame - 20 - line.delay;
    if (lineFrame < 0) return;
    const opacity = Math.min(1, lineFrame / 3);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, 10, 32 + i * 16);
  });

  // Blinking cursor
  if (Math.floor(frame * 0.1) % 2 === 0) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#fff";
    const lastVisibleLine = lines.filter(l => frame >= 20 + l.delay).length;
    ctx.fillRect(10 + 200, 24 + lastVisibleLine * 16, 6, 12);
  }
  ctx.globalAlpha = 1;
}

// ── Heat Map ───────────────────────────────────────────────────────────────
export function drawHeatMap(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number, seed = 42) {
  clearBg(ctx, w, h);
  drawLabel(ctx, "SECTOR HEAT", 8, 16, TEXT_DIM, 11);

  const labels = ["BTC", "ETH", "SOL", "AVAX", "LINK", "DOT", "MATIC", "ARB", "OP", "ATOM", "UNI", "AAVE"];
  const cols = 4;
  const cellW = (w - 16) / cols;
  const cellH = (h - 32) / Math.ceil(labels.length / cols);

  labels.forEach((label, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 8 + col * cellW;
    const y = 26 + row * cellH;
    // Slowly shifting values
    const value = (Math.sin(frame * 0.02 + i * 1.3) + Math.sin(frame * 0.035 + i * 0.7)) * 5;
    const intensity = Math.abs(value) / 10;
    const isPositive = value >= 0;

    ctx.fillStyle = isPositive
      ? `rgba(0,230,118,${Math.min(0.5, intensity * 0.35)})`
      : `rgba(255,61,0,${Math.min(0.5, intensity * 0.35)})`;
    ctx.beginPath();
    ctx.roundRect(x, y, cellW - 4, cellH - 4, 3);
    ctx.fill();

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px monospace";
    ctx.fillText(label, x + cellW / 2 - 2, y + cellH / 2 - 2);
    ctx.fillStyle = isPositive ? GREEN : RED;
    ctx.font = "9px monospace";
    ctx.fillText(`${isPositive ? "+" : ""}${value.toFixed(1)}%`, x + cellW / 2 - 2, y + cellH / 2 + 12);
    ctx.textAlign = "left";
  });
}

// ── Portfolio / P&L Panel ──────────────────────────────────────────────────
export function drawPortfolio(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  clearBg(ctx, w, h);
  drawLabel(ctx, "PORTFOLIO P&L", 8, 16, TEXT_DIM, 11);

  const holdings = [
    { sym: "BTC", qty: "0.45", pnl: 2847.30, pct: 4.2 },
    { sym: "ETH", qty: "12.5", pnl: -890.50, pct: -2.1 },
    { sym: "SOL", qty: "85", pnl: 1247.80, pct: 7.4 },
    { sym: "NVDA", qty: "25", pnl: 3150.00, pct: 5.6 },
    { sym: "TSLA", qty: "15", pnl: -420.30, pct: -3.2 },
    { sym: "SPY", qty: "50", pnl: 675.90, pct: 1.1 },
  ];

  const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0);
  const rowH = (h - 60) / (holdings.length + 1);

  // Header
  ctx.font = "9px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillText("SYMBOL", 10, 36);
  ctx.fillText("QTY", w * 0.35, 36);
  ctx.textAlign = "right";
  ctx.fillText("P&L", w - 10, 36);
  ctx.textAlign = "left";

  holdings.forEach((h, i) => {
    const y = 50 + i * rowH;
    const appear = Math.min(1, (frame - 15 - i * 4) / 5);
    if (appear <= 0) return;
    ctx.globalAlpha = appear;

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 10px monospace";
    ctx.fillText(h.sym, 10, y + 12);
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(h.qty, w * 0.35, y + 12);

    ctx.textAlign = "right";
    ctx.fillStyle = h.pnl >= 0 ? GREEN : RED;
    ctx.fillText(`${h.pnl >= 0 ? "+" : ""}$${Math.abs(h.pnl).toFixed(0)}`, w - 50, y + 12);
    ctx.fillText(`${h.pct >= 0 ? "+" : ""}${h.pct.toFixed(1)}%`, w - 10, y + 12);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  });

  // Total
  const totalY = 50 + holdings.length * rowH + 8;
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.moveTo(10, totalY - 4);
  ctx.lineTo(w - 10, totalY - 4);
  ctx.stroke();
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = totalPnl >= 0 ? GREEN : RED;
  ctx.textAlign = "right";
  ctx.fillText(`TOTAL: ${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toFixed(0)}`, w - 10, totalY + 12);
  ctx.textAlign = "left";
}
