---
title: Strategies
description: The five built-in strategies, their exact decision rules, deterministic seeding, and how to write your own.
order: 6
group: Build
mode: how-to
---

```gmplain
The reference bot ships with five ways to pick UP or DOWN: a coin flip, follow the trend, bet against the trend, mostly-up, and mostly-down. You choose one by name in the config. The random ones are repeatable on purpose — the same wallet key always produces the same flips. Writing your own strategy is one small function.
```

```gmsummary
What strategies are built in? :: Five one-line rules in make_strategy, one pick per market
How do I pick one? :: strategy in config.toml, or the STRATEGY env variable
Why are picks repeatable? :: The RNG is seeded from your key plus the name
Why do momentum and contrarian pick one direction? :: The bot never fills in change — feed it real data
How do I write my own? :: One dict entry; same-length list of UP/DOWN back
```

## What strategies are built in?

Five. Each is a one-line rule inside `make_strategy` in `bot.py`. A strategy takes the block's market list and returns one `"UP"` or `"DOWN"` per market.

| Name | Rule per market | Randomness |
|---|---|---|
| `random` | 50/50 coin flip | yes, seeded |
| `momentum` | `UP` if `change >= 0`, else `DOWN` | none |
| `contrarian` | `DOWN` if `change >= 0`, else `UP` | none |
| `bullish` | one pick from `["UP","UP","UP","DOWN"]` — 75% UP | yes, seeded |
| `bearish` | one pick from `["UP","DOWN","DOWN","DOWN"]` — 75% DOWN | yes, seeded |

`change` is the market's recent percent move. A missing value counts as 0, and 0 counts as UP for momentum — the exact test is `(m.get("change") or 0) >= 0`. That default hides a trap, covered two sections down.

## How do I pick one?

Set the name in either place; the environment variable wins:

- `config.toml`: `strategy = "momentum"`
- environment: `STRATEGY=momentum`

An unknown name does not crash the bot. It logs a warning and falls back to `random`.

## Why are picks repeatable?

Because the random number generator is seeded from your private key and the strategy name:

```python
seed = int(hashlib.sha256(f"{private_key}:{name}".encode()).hexdigest(), 16) % (2**32)
rng = random.Random(seed)
```

Same key + same strategy name = the same sequence of picks, every run. Two consequences:

- **Reproducibility.** Re-running with the same key replays identical decisions in the same order.
- **Distinctness.** Two bots with different keys both running `random` make different picks — a fleet does not move in lockstep.

The generator is created once at startup and consumed pick by pick, so each pick also depends on how many came before it in the run. The *sequence* is deterministic; an individual pick is position-dependent.

## Why do momentum and contrarian pick one direction?

Because the reference bot hands them no data. When `bot.py` joins a block, it builds the market list as:

```python
markets = [{"id": mid, "change": None} for mid in market_ids]
```

`change` is always `None`, and `(None or 0) >= 0` is true. **As shipped, `momentum` picks UP on every market and `contrarian` picks DOWN on every market.** The rules are real; the input is missing.

To make them mean something, feed in real change data before predicting:

1. Call `GET /vision/snapshot` — each market in the snapshot carries a `change_pct` field (null for markets with no history).
2. Match snapshot entries to the block's market ids by asset id.
3. Set `"change": float(change_pct)` in each market dict before calling the strategy; leave markets with a null `change_pct` at `None` — they keep the 0 default.

The outcome: momentum now follows each market's actual recent move, and contrarian fades it.

## How do I write my own?

Add one entry to the `strategies` dict inside `make_strategy`, then select it by name.

The contract:

- **Input:** `markets` — a list of dicts, one per market, with `"id"` and `"change"` keys.
- **Output:** a list of `"UP"` / `"DOWN"` strings, same length and same order as `markets`.

```python
"alternating": lambda markets: [
    "UP" if i % 2 == 0 else "DOWN" for i, m in enumerate(markets)
],
```

Run it with `STRATEGY=alternating`.

Three rules of the road:

- **Return the full length.** If your list is short, the bot pads the tail with coin flips that ignore your seed — your run stops being reproducible.
- **Use the seeded `rng`, not the global `random`,** if your strategy needs randomness and you want repeatable picks.
- **Order matters.** Bit *i* of the bitmap is market *i* of the block's config — your output order is your prediction. The encoding is fixed: [Bitmap encoding](/docs/bots/bitmap-encoding) (~4 min).

You can also change your picks after joining, any time before the round locks: [Update predictions before the lock](/docs/bots/update-predictions) (~4 min).

```gmseealso
[{"title": "Update predictions before the lock", "href": "/docs/bots/update-predictions"}, {"title": "Bitmap encoding", "href": "/docs/bots/bitmap-encoding"}, {"title": "Run the reference bot in 5 minutes", "href": "/docs/bots/quickstart"}]
```

Next: [Errors and fixes](/docs/bots/errors) (~3 min)
