# Trading Twitch on Vision Testnet

A practical account of building a bot that trades 8192 markets every 60 seconds on an Arbitrum Orbit L3 prediction market. The on-chain transport is 90% of the work. The strategy is the remaining 10% that decides whether you make money.

Reference implementation: [`General-Market/vision-bot-examples/twitch`](https://github.com/General-Market/vision-bot-examples/tree/main/twitch).

---

## What we're trading

Vision runs on **Index L3** (Arbitrum Orbit, chainId `111222333`, RPC `http://142.132.164.24/`). A **batch** is a collection of binary markets that all settle together at a tick boundary. The Twitch batch:

- `batchId = 19` (the source id is stable; batchId rotates on every redeploy — the bot discovers the live one)
- `tickDuration = 60 s`
- ~8200 markets: 92% `twitch_stream_*` (individual streamers), 8% `twitch_game_*` (games)
- `thresholdSource: "24h_history"` — resolution baseline is the value 24 h ago

Each market has a `resolutionType` + `thresholdBps`:

| Type | Resolves YES when | Count |
|---|---|---|
| `up_x` | `value > baseline × (1 + bps/10000)` | 4306 |
| `down_x` | `value < baseline × (1 - bps/10000)` | 2341 |
| `up_0` | `value > 0` | 110 |
| `flat_x` | `|value - baseline| / baseline < bps/10000` | 4 |

`thresholdBps` ranges 50 to 10000 — some markets are trivial (`up_x 50bps` = 0.5% move), some are essentially impossible (`up_x 10000bps` = double).

You trade blind. The parimutuel pool totals are not exposed. Your edge comes from your predictor, not from reading the crowd.

## The live infrastructure

Four public HTTP endpoints, no authentication for reads:

```
RPC        http://142.132.164.24/
Vision     0x94d540bb45975bd5a0c7ba9a15a0d34e378f6c61
L3_WUSDC   self-discovered via vision.USDC() — 18 decimals
Data-node  https://generalmarket.io/bot-api
Oracles    http://116.203.156.98/oracle{1,2,3}
```

The `envs/testnet/deployment.json` in the mono repo lists a Vision address with zero bytecode — it describes an intended deployment, not the live one. Trust the chain. Call `eth_getCode(vision_address)` before you rely on a hard-coded address, and `vision.USDC()` before you rely on a hard-coded token.

## The transport

The four operations, in order:

### 1. Discover

```python
# Data-node publishes the live market list per source.
r = requests.get(f"{DATA_NODE}/batches/recommended")
twitch = next(b for b in r.json()["batches"] if b["sourceId"] == "twitch")
config_hash = bytes.fromhex(twitch["configHash"][2:])
markets = twitch["markets"]                    # ~8200 entries, authoritative bit order
```

The oracle separately lists on-chain batches. Match by `config_hash` to find the current `batch_id` — data-node's recommended config can race ahead of chain by one tick; the bot falls back to any live batch with the same `tick_duration`.

### 2. Encode a pick

One bit per market. Always 1024 bytes. MSB-first per byte. `1 = UP`, `0 = DOWN`.

```python
MAX_BITMAP_BYTES = 1024   # covers 8192 markets

def encode_bitmap(bets: list[str], count: int) -> bytes:
    if len(bets) < count:
        raise ValueError("Bitmap underflow — a short bitmap is a silent loss.")
    bitmap = bytearray(MAX_BITMAP_BYTES)
    for i in range(count):
        if bets[i] == "UP":
            bitmap[i // 8] |= 1 << (7 - (i % 8))
    return bytes(bitmap)

bitmap_hash = Web3.keccak(encode_bitmap(picks, len(markets)))
```

The commitment is the keccak256 of the *padded* bytes. If you submit a shorter buffer to the oracle, the hash won't match and your deposit sits in the pool with no pick — resolved as pure loss.

### 3. Commit on-chain

```python
bot.approve_usdc(amount_wei=int(0.1 * 10**18))   # L3 USDC is 18 decimals
bot.vision.functions.joinBatchDirect(
    batch_id, config_hash, deposit_wei, bitmap_hash
).transact()
```

The on-chain transaction reveals *nothing* about your picks — only the 32-byte commitment. The picks themselves are revealed off-chain to oracles.

### 4. Reveal to the oracle quorum

After the join tx confirms, POST the raw bitmap bytes to each oracle. BFT quorum: need `ceil(2/3 × N)` acceptances.

```python
for url in oracles:
    requests.post(f"{url}/vision/bitmap", json={
        "player":        bot_address,
        "batch_id":      batch_id,
        "bitmap_hex":    "0x" + bitmap.hex(),
        "expected_hash": "0x" + bitmap_hash.hex(),
    })
```

Each oracle verifies `keccak256(bytes) == expected_hash`. If the hashes don't match, rejected.

### 5. Settle

Settlement is automatic at the tick boundary. `PlayerSettled(batchId, player, payout, fee)` fires on-chain. Payout is your original deposit ± winnings/losses in 18-dec USDC.

## The strategy architecture

The choice that drives everything else: **predict a number, threshold later.**

```
snapshot + history ─→ extract_features ─→ predictor.predict ─→ scores (list[float])
                                                                  │
                                               picks_from_scores(scores, threshold)
                                                                  │
                                                      [UP, DOWN, UP, …, DOWN]
                                                                  │
                                                     encode_bitmap → 1024 bytes
```

A predictor is anything that returns `list[float]`, one score per market, positive for "UP likely". Binarisation happens at a single well-named function. No ML model ever touches `encode_bitmap` directly. Swap momentum for XGBoost for Claude without changing the transport.

Five predictors ship out of the box:

| Name | Uses history? | Uses ML? | What it does |
|---|:---:|:---:|---|
| `momentum` | no | no | `score = changePct / 100` |
| `contrarian` | no | no | `-changePct / 100` |
| `rolling` | **yes** | no | Weighted sum of short-window changes |
| `xgb` | yes | **yes** | XGBoost binary classifier on rolling features |
| `ensemble` | yes | yes | Weighted blend |
| `claude` | yes | delegated | Wraps base; Claude overrides only uncertain picks |

## Features that actually matter

Tick is 60 s. Anything longer than 15 min isn't predictive of the next tick — we dropped `change_1h`, `change_6h`, `change_24h` from features. The 24 h baseline is retained only as input to the resolution rule.

Per asset:

```
change_1m, change_5m, change_15m        short-window pct changes
vol_5m                                  std of change_pct in last 5 min
slope_5m                                normalised linear-regression slope
streak                                  current same-sign run length
n_obs_5m                                sample density (confidence gate)
hour_utc, day_of_week, is_weekend,      temporal context
is_primetime                            UTC 18–23
baseline_24h                            value 24 h ago (resolution input)
dist_to_up, dist_to_down                signed distance to threshold
category_mean_5m                        per-category platform signal
asset_vs_category_5m                    this asset's idiosyncratic move
current_change_pct                      live snapshot value
```

Features that seemed useful but weren't:

- **`current_resolution`** (whether the market is resolving YES right now). A 60 s tick barely shifts the 24 h baseline, so this feature is ~97% correlated with the next-tick label. Shipping it made the model trivially copy the current state. Removed.
- **Cross-horizon features** (1 h / 6 h / 24 h change). Predictive of slow drift, not tick-boundary resolution. Dropped.

## The label trap

Initial attempt:

```python
label = 1 if next_value > this_value else 0
```

The model trained happily to 57% and we called it a day. Wrong question.

The oracle resolves markets against their *threshold rule*, not against "did it go up at all." A `down_x 10000bps` market resolves YES only if the value falls below the baseline × (1 − 1.0) = zero — essentially never. A `up_x 50bps` market resolves YES with almost every upward tick. Training on "direction" means the model optimises for a target the market doesn't pay on.

Correct label:

```python
def compute_label(next_value, baseline, res_type, bps):
    frac = bps / 10000.0
    if res_type == "up_x":
        return 1 if next_value > baseline * (1 + frac) else 0
    if res_type == "down_x":
        return 1 if next_value < baseline * (1 - frac) else 0
    if res_type == "up_0":
        return 1 if next_value > 0 else 0
    if res_type == "flat_x":
        drift = abs(next_value - baseline) / abs(baseline)
        return 1 if drift < frac else 0
    return 0
```

Retrain on resolution-aware labels: train 97.2%, test 97.1%. Looks impressive until you check the next trap.

## The stickiness trap

Over a 60 s tick, the 24 h baseline shifts by about 1/1440 of its value. If a market is resolving YES right now, it almost certainly still resolves YES next tick. Only **~4% of ticks actually flip resolution.**

The naive baseline — "predict whatever the market is resolving as right now" — scores 95.5% on its own. The XGBoost model scoring 97.2% is doing only 1.6 percentage points of real work.

The right metric is the **flip-catch rate**. On the ~4% of ticks that actually flip, naive gets 0% (by definition). XGBoost catches ~35% of them on the 500-asset × 168 h training set.

Every flip XGBoost catches is money taken from a bot that always copies current state. Not glamorous. Real.

Backtest output reports both numbers:

```python
{
  "n_flips":        17124,
  "n_stuck":        395956,
  "naive_acc":      0.9585,   # always copy current resolution
  "xgb_acc":        0.9716,
  "xgb_flip_acc":   0.3492,   # the only number that matters
  "xgb_stuck_acc":  0.9985,
  "lift_over_naive_pp": 1.31,
}
```

1.31 pp of headline accuracy sounds small. In a parimutuel where most bots cluster around naive, it's the entire edge.

## The model

XGBoost binary classifier, regularised, early-stopped.

```python
from xgboost import XGBClassifier

model = XGBClassifier(
    n_estimators=600,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=5,
    reg_alpha=0.1,
    reg_lambda=1.0,
    early_stopping_rounds=30,
    eval_metric="logloss",
)
```

`build_training_set` is vectorised — O(n_ticks) per asset using pandas time-indexed rolling. A naive per-tick feature rebuild would be O(n²) and unusable at scale.

Training on 500 assets × 168 h of history produces ~1.2 M rows. Fit time ~3 min on a laptop. Train and test accuracies stay within 0.1 pp of each other — the regularisation works.

## Claude as tiebreaker

Claude is too expensive to call on 8192 markets per 60 s tick. But it shines where XGBoost is uncertain — the markets whose scores sit closest to the threshold.

```python
class ClaudePredictor:
    def predict(self, markets, snapshot_by_id):
        base_scores = self.base.predict(markets, snapshot_by_id)
        marginal_idx = k_nearest_to_threshold(base_scores, k=20)
        verdicts = claude_call(markets, features, marginal_idx)
        scores = list(base_scores)
        for i in marginal_idx:
            scores[i] = override(scores[i], verdicts[markets[i]["assetId"]])
        return scores
```

A single Claude call handles all 20 marginals in one JSON response. Cost is bounded regardless of how many markets exist.

## Ensemble

Weighted blend. Default 50% rolling + 50% XGBoost. The weights can be learned later with stacking; they are hard-coded for now because the rolling predictor isn't differentiably superior to any component of XGBoost — it adds interpretability, not accuracy.

```python
class EnsemblePredictor:
    def __init__(self, members):
        total = sum(w for _, w in members)
        self.members = [(p, w / total) for p, w in members]

    def predict(self, markets, snapshot_by_id):
        blended = [0.0] * len(markets)
        for p, w in self.members:
            for i, s in enumerate(p.predict(markets, snapshot_by_id)):
                blended[i] += w * s
        return blended
```

## Backtest

Walk-forward, resolution-aware labels, flip-vs-stuck breakdown. On a 30-asset × 6 h slice:

```
always-NO baseline : 67.6%
momentum           : 50.7%   direction-only
rolling            : 53.3%
xgb                : 92.7%   log-loss 0.185
```

The 2290-prediction sample is too small for flip recall to be reliable (23 flips is noise). Proper measurement needs the full 8192 × 24 h sweep — budget an hour of compute.

The 92.7% beats the 67.6% "always NO" baseline by 25 pp. That's a real edge, dominated by the sticky rule. The alpha-over-sticky is the 35% flip-catch measured in training.

## Running the bot

```bash
git clone https://github.com/General-Market/vision-bot-examples
cd vision-bot-examples/twitch
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# macOS: brew install libomp  (xgboost dependency)

# Infra sanity check — no credentials needed
python main.py probe

# Dryrun with any strategy. Builds the join tx, prints it, exits.
python main.py dryrun --strategy momentum --deposit 0.1
python main.py dryrun --strategy xgb --history-hours 2

# Train the ML model on real history
python main.py train-xgb --hours 168 --max-assets 500 --out models/xgb.pkl

# Walk-forward backtest with flip/stuck breakdown
python main.py backtest --strategy xgb --hours 6 --max-assets 30

# Real trade — signs and sends. Requires BOT_PRIVATE_KEY funded with L3 USDC.
python main.py trade --strategy ensemble --deposit 0.1
```

## The invariants that catch most first-time bots

1. **Bitmap length is always 1024 bytes.** Not `ceil(N/8)`. Not `N`. A shorter buffer hashes to the wrong commitment and the oracle rejects you.
2. **Bit order is MSB-first per byte.** Market `i` → bit `7 - (i % 8)` of byte `i // 8`.
3. **`config_hash` comes from `getBatch` and is passed verbatim.** Never recompute client-side.
4. **Bitmap reveal must follow the join tx confirmation.** Reveal first, rejected with "no on-chain commitment."
5. **L3 USDC is 18 decimals.** `int(0.1 * 10**18)`. Copy-pasted 6-dec math will buy you negligible exposure.
6. **Pool totals are not queryable.** Trade blind.
7. **The deployment JSON can lie.** `eth_getCode` is authoritative.
8. **Self-discover the USDC address** via `vision.USDC()`. Anchor on-chain truth.
9. **Minimum deposit is 0.1 USDC** (`1e17` wei). Lower joins revert.
10. **Missing a tick is cheaper than a guaranteed revert.** If `now + 10s > tick_end - lock_offset`, skip.

## What's not in this bot yet

- **Flip-aware training.** The model sees balanced labels but the alpha is in the 4% flip tail. Weighted sampling or a dedicated flip classifier would likely push flip-recall from 35% toward 50%.
- **Stacked ensemble weights.** Currently 50/50. Proper stacking (meta-learner on out-of-fold predictions) would beat the hand-set weights.
- **Per-asset baseline normalization.** xqc's viewer fluctuation on a 30k base means something very different from a micro streamer's on a 10-viewer base. The model sees both as raw `changePct` in the same units.
- **On-chain event-log scan** (`PlayerSettled`, `BatchJoined` history). Tells you who else is trading, with what deposits, and whether they're winning. The entire bot ecosystem is legible on-chain — we just don't read it yet.

Each of these is one of the honest "not shipped" footnotes. None of them changes the transport. All of them are predictors swappable through the same interface.

## Closing

The engineering that matters: `encode_bitmap`, `joinBatchDirect`, oracle reveal, resolution-aware labels, short-horizon features. The rest is taste.

95% accuracy sounds like a triumph until you check the baseline. 0% flip-catch sounds like failure until you realise naive gets 0%. The honest number is the one that could only exist because a model learned something.
