# Vision Fund Catalog — Design Spec

> 43 managed vaults, one bot, source-specific strategies.

## Overview

A catalog of branded prediction funds, each a VisionVault deployed via VisionVaultFactory. Each fund trades only specific Vision data sources using a strategy tuned to that source's physics. A single Fund Manager bot process manages all 43 vaults simultaneously — one cycle loop, 43 vault executors, per-fund strategy selection.

## Fund Catalog

### Naming & Branding

Each fund has: a short evocative name (no "Fund" or "Vault" suffix), a ticker symbol (3-4 chars), a 2-sentence pitch explaining the strategy in domain terms, a color, and a source scope.

### Complete Fund List

#### CRYPTO

| # | Name | Symbol | Sources | Strategy | Params | Pitch | Fee | Color |
|---|------|--------|---------|----------|--------|-------|-----|-------|
| 1 | Herd | HERD | coingecko | momentum | {} | Crypto trends persist because the crowd reinforces itself. Herd rides the wave until it breaks. | 20% | #F7931A |
| 2 | Washout | WASH | coingecko | contrarian | min_change_pct: 3 | Every pump gets sold, every dump gets bought. Washout bets on the overcorrection after every move larger than 3%. | 20% | #E74C3C |
| 3 | Degenerator | DGEN | pumpfun | momentum | {} | Memecoins spike then die — but the spike lasts several ticks. Degenerator rides the momentum while it persists. | 25% | #00D18C |
| 4 | Lockflow | LOCK | defi | momentum | min_change_pct: 2 | DeFi TVL moves slowly and with conviction. Lockflow only bets when TVL shifts by more than 2% — ignoring the noise between. | 15% | #1B1B1B |
| 5 | Oracle | ORCL | polymarket | momentum | {} | Prediction markets converge to truth as events approach. Oracle rides the odds direction — the crowd gets smarter as resolution nears. | 20% | #1B1B1B |

#### WEATHER & GEOPHYSICAL

| # | Name | Symbol | Sources | Strategy | Params | Pitch | Fee | Color |
|---|------|--------|---------|----------|--------|-------|-----|-------|
| 6 | Revert | RVRT | weather, openmeteo | contrarian | {} | Temperature always returns to the seasonal mean. Every heatwave ends, every cold snap breaks. Revert bets on the return. | 15% | #2ECC71 |
| 7 | Aftershock | AFTR | earthquake | momentum | {} | Earthquakes come in swarms. After a big one, the next ticks bring more. Aftershock bets on seismic persistence. | 20% | #C0392B |
| 8 | Ember | EMBR | wildfire | momentum | {} | Fire season is fire season. Once hotspots appear in a region, Ember bets they grow — fires don't extinguish themselves between ticks. | 20% | #E67E22 |
| 9 | Clearsky | CLR | airnow | contrarian | {} | AQI spikes are temporary. Smoke clears, winds shift, rain falls. Clearsky bets on recovery after every pollution event. | 15% | #3498DB |
| 10 | Swell | SWEL | ndbc | momentum | {} | Ocean swells propagate across basins for days. A storm generates waves that persist tick-over-tick. Swell rides the propagation. | 15% | #1ABC9C |
| 11 | Aurora | AURA | spaceweather | momentum | {} | Solar storms come in bursts — a high Kp index this tick means elevated activity next tick. Aurora bets on solar persistence. | 15% | #8E44AD |

#### TRANSPORT

| # | Name | Symbol | Sources | Strategy | Params | Pitch | Fee | Color |
|---|------|--------|---------|----------|--------|-------|-----|-------|
| 12 | Cascade | CSCD | mta_subway, tfl_tube, paris_metro | momentum | {} | Transit disruptions cascade. One stuck train creates thirty delayed ones. Cascade bets that disruption persists once it starts. | 20% | #0039A6 |
| 13 | Tailwind | TAIL | flights, ryanair, faa_delays | contrarian | {} | Flight delays resolve. The system recovers by next cycle. Tailwind bets on normalization after disruption. | 15% | #2C3E50 |
| 14 | Gridlock | GRID | tomtom_traffic | momentum | {} | Rush hour traffic builds on itself. Gridlock bets that congestion this tick will be worse next tick — the commute only deepens. | 15% | #34495E |
| 15 | Crossing | XING | cbp_border | momentum | {} | Border waits compound. When lines form, more cars arrive, fewer get processed. Crossing bets that long waits get longer within the same day. | 15% | #1A2744 |
| 16 | Spoke | SPOK | citybikes, db_trains | contrarian | {} | Empty bike racks refill. Late trains catch up. Spoke bets on mean-reversion in transit systems designed to self-balance. | 15% | #EC0016 |

#### ENTERTAINMENT & SOCIAL

| # | Name | Symbol | Sources | Strategy | Params | Pitch | Fee | Color |
|---|------|--------|---------|----------|--------|-------|-----|-------|
| 17 | Prime Time | PRME | twitch | momentum | {} | Viewership begets viewership. When a streamer is hot, more viewers pile in tick-over-tick. Prime Time bets that rising counts keep rising within a session. | 20% | #9146FF |
| 18 | Weekend | WKND | steam | bullish | {} | Gamers play. Steam concurrent players trend up more often than down. Weekend applies a structural long bias to gaming activity. | 15% | #171A21 |
| 19 | Hivemind | HIVE | reddit | momentum | {} | Subreddit growth is viral. Once a community starts gaining subscribers, network effects accelerate it tick-over-tick. Hivemind rides the viral phase. | 15% | #FF4500 |
| 20 | Decay | DCAY | hackernews | contrarian | {} | Every HN story peaks and falls. A high-score story this tick will have fewer points next tick. Decay fades the hype — reliably. | 20% | #F66A0A |
| 21 | Season | SZON | anilist | momentum | {} | Anime popularity spikes at season premiere and sustains for weeks. Season bets that a trending show stays trending tick-over-tick. | 15% | #152232 |
| 22 | Noise | NOIS | fourchan | contrarian | {} | 4chan activity spikes are pure chaos. Every surge crashes back to baseline within a few ticks. Noise fades every spike. | 15% | #3D5C3D |
| 23 | Homecourt | HOME | sports, pandascore | home_field | {} | Home teams win 55-60% across all sports. Homecourt applies a systematic home-team bias — simple, persistent, profitable at scale. | 10% | #1B1B1B |

#### MACRO & ECONOMIC

| # | Name | Symbol | Sources | Strategy | Params | Pitch | Fee | Color |
|---|------|--------|---------|----------|--------|-------|-----|-------|
| 24 | Hawkish | HAWK | rates, treasury, fred | momentum | min_change_pct: 0.5 | Central banks move in cycles. A rate shift this tick predicts another next tick. Hawkish rides the policy direction until the rhetoric turns. | 20% | #003366 |
| 25 | Payroll | PYRL | bls, adzuna | contrarian | {} | Jobs data overshoots every tick. Markets overreact to every release. Payroll fades the surprise — strong data revises down, weak data revises up. | 20% | #2C3E50 |
| 26 | Barrel | BRRL | eia, opec | momentum | {} | Energy prices trend in regimes. When production shifts, the effect persists for many ticks. Barrel follows the supply-demand narrative. | 20% | #00526E |
| 27 | Glacier | GLCR | worldbank, imf | momentum | min_change_pct: 1 | Development indicators move at geological speed. Glacier only bets when something actually changes — which is rare, but when it does, it persists. | 10% | #002244 |
| 28 | Spread | SPRD | ecb, boe, treasury | contrarian | {} | Rate differentials oscillate. When one central bank moves too far from another, convergence pulls them back. Spread bets on the pull. | 20% | #0057B7 |

#### TECH & DEVELOPER

| # | Name | Symbol | Sources | Strategy | Params | Pitch | Fee | Color |
|---|------|--------|---------|----------|--------|-------|-----|-------|
| 29 | Adoption | ADPT | npm, pypi, crates_io | momentum | {} | Package downloads follow adoption S-curves. Rising downloads keep rising tick-over-tick — network effects in the dependency graph. | 15% | #CB3837 |
| 30 | Trending | TRND | github | momentum | {} | GitHub stars spike when a repo gets attention. The spike sustains for several ticks before decay. Trending rides the first wave. | 20% | #24292E |
| 31 | Resilience | RSLN | ioda, cloudflare | contrarian | {} | Internet outages resolve. Infrastructure teams fix things. Resilience bets on recovery — connectivity always comes back. | 15% | #F38020 |
| 32 | Overflow | OFLW | stackexchange | momentum | {} | When a technology gains questions, it's gaining adopters. More questions mean more developers. Overflow rides the flywheel. | 15% | #F48024 |

#### REGULATORY & GOVERNMENT

| # | Name | Symbol | Sources | Strategy | Params | Pitch | Fee | Color |
|---|------|--------|---------|----------|--------|-------|-----|-------|
| 33 | Deadline | DDLN | sec | momentum | {} | SEC filings cluster around deadlines. Filing volume builds tick-over-tick during disclosure windows. Deadline rides the surge. | 15% | #0A3055 |
| 34 | Session | SESN | congress | momentum | {} | When Congress votes, it keeps voting. Legislative activity has momentum — a busy tick predicts another busy tick. | 15% | #1A2744 |
| 35 | Complaint | CMPL | nyc311 | contrarian | {} | NYC complaint spikes resolve. The city returns to its baseline whining within a few ticks. Complaint fades every surge. | 15% | #002D72 |

#### NATURE & ACADEMIC

| # | Name | Symbol | Sources | Strategy | Params | Pitch | Fee | Color |
|---|------|--------|---------|----------|--------|-------|-----|-------|
| 36 | Migration | MIGR | ebird, animals, movebank | momentum | {} | Birds migrate on schedule. When sightings start increasing, they accelerate for many ticks. Migration bets on the biological clock. | 10% | #4CAF50 |
| 37 | Preprint | PRPT | pubmed, crossref, openalex | momentum | {} | Research output clusters around grant cycles. A publishing surge sustains for several ticks. Preprint rides the academic rhythm. | 10% | #2196F3 |

#### WATER & OCEAN

| # | Name | Symbol | Sources | Strategy | Params | Pitch | Fee | Color |
|---|------|--------|---------|----------|--------|-------|-----|-------|
| 38 | Torrent | TRNT | usgs_water, nwps | momentum | {} | River discharge rises for many ticks after rainfall. Water flows downhill and accumulates. Torrent rides the hydrological lag. | 15% | #0288D1 |
| 39 | Tideline | TIDE | noaa_tides, noaa_met | contrarian | {} | Tides are periodic. What goes up comes down, every 12 hours. Tideline bets on reversal — the most predictable mean-reversion in nature. | 15% | #01579B |

#### NICHE & EXOTIC

| # | Name | Symbol | Sources | Strategy | Params | Pitch | Fee | Color |
|---|------|--------|---------|----------|--------|-------|-----|-------|
| 40 | Fastpass | FAST | queue_times | contrarian | {} | Theme park lines peak at 2pm and shrink by closing. Every ride has capacity that forces mean-reversion. Fastpass fades the midday rush. | 15% | #1A1A2E |
| 41 | Soft Serve | SOFT | mcbroken | contrarian | {} | Broken ice cream machines get fixed. McDonald's maintenance cycles are 24-48 hours. Soft Serve bets on repair. | 10% | #FFC72C |
| 42 | After Dark | DARK | chaturbate | momentum | {} | Viewership follows the clock — evening means rising viewers. After Dark bets that peak-hour momentum sustains tick-over-tick. | 15% | #E91E63 |
| 43 | Unusual | UNSL | backpacktf | momentum | {} | TF2 hat prices are driven by community consensus. When an item climbs, collectors pile in. Unusual rides the speculative wave. | 20% | #363636 |

## Bot Architecture: Fund Manager

### Single Process Design

One Python process manages all 43 vaults. Not 43 processes.

```
FundManager
├── config: funds.toml (43 fund specs)
├── executor: Executor (shared web3 + signing)
├── vault_executors: dict[str, VaultExecutor] (one per vault)
├── strategies: dict[str, Strategy] (cached, reused across funds)
├── tracker: FundTracker (tracks all positions across all vaults)
└── feed: VisionFeed (shared WebSocket connection)
```

### Fund Configuration: `funds.toml`

```toml
[manager]
private_key_env = "FUND_MANAGER_KEY"
rpc_url = "http://142.132.164.24/"
factory = "0xbc418956A20DB5C343b56b6AE947AF4896b23A1e"
vision_api = "http://localhost:10001"
data_node = "http://localhost:8200"
poll_interval = 30
deposit_per_batch = 10.0  # USDC per batch join
stake_per_tick = 10.0

[[funds]]
name = "Herd"
symbol = "HERD"
vault = "0x..."
sources = ["coingecko"]
strategy = "momentum"
[funds.params]

[[funds]]
name = "Washout"
symbol = "WASH"
vault = "0x..."
sources = ["coingecko"]
strategy = "contrarian"
[funds.params]
min_change_pct = 3.0

# ... 41 more entries
```

### Cycle Logic

```
Every poll_interval seconds:
  1. Fetch all active batches
  2. Build source_id → [batch] index
  3. For each fund:
     a. Find batches matching fund.sources
     b. Skip batches already joined by this vault
     c. Skip if vault has insufficient idle capital
     d. Load strategy with fund.params
     e. Fetch market data, generate predictions
     f. Join batch via vault_executor
     g. Submit bitmap (player = vault address)
  4. For each fund:
     a. Check for settled batches
     b. Reconcile settled batches
     c. Log vault NAV, PnL, HWM
```

### Strategy Implementation

All strategies use the existing `Strategy` ABC with a `params` dict. No new classes needed except `HomeFieldStrategy` for sports.

**Parameterized strategies:**

- `momentum` + `min_change_pct: N` = threshold momentum (only bet when move > N%)
- `contrarian` + `min_change_pct: N` = threshold contrarian (only fade moves > N%)
- `bullish` = 75% UP bias (no params needed)
- `home_field` = UP for home metrics, DOWN for away (sports-specific market ID parsing)

```python
class Strategy(ABC):
    name: str = ""
    
    def __init__(self, params: dict = None):
        self.params = params or {}
    
    @abstractmethod
    def predict(self, markets: list[dict]) -> list[str]: ...
```

Momentum with params:
```python
class MomentumStrategy(Strategy):
    name = "momentum"
    
    def predict(self, markets):
        threshold = self.params.get("min_change_pct", 0)
        results = []
        for m in markets:
            change = m.get("change") or 0
            if abs(change) < threshold:
                results.append(random.choice(["UP", "DOWN"]))
            elif change >= 0:
                results.append("UP")
            else:
                results.append("DOWN")
        return results
```

Contrarian is identical but inverted. Bullish/Bearish ignore `change` entirely.

HomeField for sports:
```python
class HomeFieldStrategy(Strategy):
    name = "home_field"
    
    def predict(self, markets):
        results = []
        for m in markets:
            mid = (m.get("id") or "").lower()
            if "home" in mid:
                results.append("UP")
            elif "away" in mid:
                results.append("DOWN")
            else:
                results.append("UP" if (m.get("change") or 0) >= 0 else "DOWN")
        return results
```

### FundTracker

Extends the existing Tracker to track positions per vault:

```python
class FundTracker:
    def __init__(self):
        self.vaults: dict[str, dict] = {}  # vault_addr → {positions, history, nav}
    
    def on_join(self, vault_addr, batch_id, deposit, bitmap, bets, bitmap_hash): ...
    def check_all(self) -> dict[str, list[int]]:
        """Returns {vault_addr: [settled_batch_ids]}"""
    def get_fund_summary(self, vault_addr) -> dict: ...
    def save(self, path): ...
    def load(self, path): ...
```

Persistence: single `fund-manager-state.json` file with all vault states.

### Source ID Matching

Batches have a `sourceId` (bytes32 = keccak256 of source name). The fund config uses human-readable source names. The bot resolves names to sourceIds at startup using the batch registry or a precomputed mapping.

```python
SOURCE_IDS = {
    "coingecko": keccak256("coingecko"),
    "earthquake": keccak256("earthquake"),
    ...
}
```

When a batch comes in with `sourceId = 0x9d95c1...`, the bot looks up which source name it belongs to, then checks which funds trade that source.

## Frontend Branding

### Vault Branding Config

In `deployment.json`:

```json
{
  "vaultBranding": {
    "0xVAULT_ADDRESS": {
      "name": "Herd",
      "symbol": "HERD",
      "tagline": "Crypto trends persist because the crowd reinforces itself. Herd rides the wave until it breaks.",
      "color": "#F7931A",
      "sources": ["coingecko"],
      "category": "crypto",
      "strategy": "Momentum"
    }
  }
}
```

### VaultCard Branding

The VaultCard component reads branding from deployment config:

- **Card header**: fund color as gradient background, fund name in white
- **Source badges**: small logos of the source(s) this fund trades
- **Tagline**: 2-sentence pitch below the stats
- **Strategy label**: "Momentum" / "Contrarian" / "Home Field" badge
- **Category tag**: "Crypto" / "Weather" / "Transport" etc.

### Categories on Page

The vaults page groups funds by category with section headers:

```
CRYPTO
[Herd] [Washout] [Degenerator] [Lockflow] [Oracle]

WEATHER & GEOPHYSICAL
[Revert] [Aftershock] [Ember] [Clearsky] [Swell] [Aurora]

TRANSPORT
[Cascade] [Tailwind] [Gridlock] [Crossing] [Spoke]

...
```

## Deployment Plan

### On-Chain (one script, 43 txs)

Deploy script reads `funds.toml`, calls `factory.createVault()` for each fund, writes vault addresses back to config.

### Bot Setup (VPS)

1. `funds.toml` with all 43 fund specs
2. `fund_manager.py` as the single entry point
3. Runs via Docker or systemd on VPS
4. Single private key manages all vaults (the manager address)

### Frontend

1. Deploy script writes vault addresses + branding to `deployment.json`
2. `useVaults()` reads from factory, filters by whitelist
3. `VaultCard` reads branding config for display
4. Push to trigger Vercel auto-deploy

## What This Spec Does NOT Cover

- **Performance analytics** — historical NAV charts, drawdown tracking. Separate spec.
- **Strategy backtesting** — validating strategies against historical tick data. Separate spec.
- **Dynamic strategy switching** — changing a vault's strategy based on market regime. Not in v1.
- **Multi-manager** — different private keys per vault. Not needed; single manager key is simpler.
- **Fee collection** — manager redeeming fee shares. Manual process for now.
