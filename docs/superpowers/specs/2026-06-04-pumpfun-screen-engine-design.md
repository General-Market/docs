# Pump.fun screen engine — design

**One-line:** A Remotion engine that pixel-clones the Axiom mobile token screen and replays a *real* memecoin pump, accelerated, with synthetic sub-candle micro-motion.

## What it produces

A 1080×1920 @ 60fps portrait clip (~12s) that looks like a screen recording of the Axiom/pump.fun token detail page during a fast pump:

- Candle chart scrolling left, new candle forming at the right edge.
- TradingView-style **autoscaling** Y-axis (mcap ladder re-fits and glides as price climbs).
- Dashed live-price line + green/red pill riding the right edge.
- Header mcap counter + `+Nx` counting up; `Peak Nx`.
- Trade tape ticking at the bottom (real buys/sells, scrolling, ages incrementing).
- Static chrome: green Buy bar + Search.

## Data: real backbone, synthetic micro

| Part | Source |
|---|---|
| Candles (OHLC) | **Real** — GeckoTerminal `/ohlcv/minute` for a trending Solana/pump.fun pool |
| Trades tape | **Real** — GeckoTerminal `/trades` (buy/sell + USD size) |
| Mcap, peak, name, avatar | **Real** — GeckoTerminal pool meta |
| Sub-candle ticks, live-pill flicker | **Synthetic** — interpolated between real candle keyframes |

Fetched **on demand**, cached to a JSON file in the repo. Not fetched per render.

## Architecture — two layers

```
video/scripts/pumpfun/fetch.mjs          # trending → pick → ohlcv+trades+avatar → data json
video/src/compositions/pumpfun-screen/
  PumpFunScreen.tsx   # root AbsoluteFill + Meta export; builds timeline once
  engine.ts           # PURE: buildTimeline(data, config) -> Frame[]  (all motion math)
  theme.ts            # exact Axiom palette + type
  types.ts            # ChartData / Frame shapes
  CandleChart.tsx     # draws one timeline Frame (candles + ladder + live pill)
  Header.tsx          # avatar / name / age / Peak; mcap + Nx counter
  TradeTape.tsx       # bottom table, scrolling rows + age ticks
  BottomBar.tsx       # green Buy + Search (static)
  data/<ticker>.json  # baked real data
video/public/pumpfun/<ticker>-avatar.png  # via staticFile()
```

Registered at the **root** of `src/Root.tsx` (finished video), id `PumpFunScreen`.

## Engine model (the core)

`buildTimeline` runs **once** (in `useMemo`), produces one `Frame` per video frame, so render stays pure and the autoscale easing can be stateful (lerp toward target each step).

- **Acceleration:** `idxFloat = interpolate(frame, [0,total], [startIdx, endIdx])`. The slice is chosen so the vertical spike lands near the end.
- **Window:** last `VISIBLE` candles ending at `idxFloat`; rendered at `x = i - frac` for smooth sub-candle horizontal scroll.
- **Forming candle:** candle at `floor(idxFloat)` is partially drawn by `frac`; its close eases open→realClose, high/low expand with `frac`, plus small deterministic jitter for the live wiggle.
- **Autoscale:** target `[min,max]` = padded nice-rounded bounds of the visible window; **displayed** range lerps toward target each frame so the ladder glides, never snaps. Ladder labels = nice round steps inside the range.
- **Live pill:** value = forming candle close; colour = up/down vs last tick.
- **Tape:** real trades whose timestamp ≤ current playhead, newest first, ages computed from playhead.

## Palette (sampled from reference)

`bg #080a0d` · green `#34da89` · red `#d6283a` · Peak teal `~#46e3c8` · axis grey `#6b7280` · text `#f5f5f5`.

## Hero token

Fetch trending, auto-pick the pool with the biggest clean run-up over its window, show 2–3 candidates. Avatar localised to `public/`.

## Out of scope (YAGNI)

Batch rendering, multiple timeframes UI, real sub-second ticks (minute is finest GeckoTerminal candle — acceleration covers it).
