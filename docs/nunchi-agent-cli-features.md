# Nunchi agent-cli — Complete Feature Breakdown

> Source: [github.com/Nunchi-trade/agent-cli](https://github.com/Nunchi-trade/agent-cli)
> Stack: Python 3.10+, Typer CLI, Pydantic models, MCP server, 263 tests

---

## 1. CLI Framework (`cli/main.py`)

Typer-based CLI registered as `hl` entry point. All commands are either direct functions or sub-apps (Typer groups).

```
hl <command>
hl <group> <subcommand>
```

### Top-level commands

| Command | Description |
|---------|-------------|
| `hl run <strategy>` | Start autonomous trading loop with a strategy |
| `hl status` | Show positions, PnL, risk state (from persisted state) |
| `hl trade <instrument> <side> <size>` | Place a single manual order |
| `hl account` | Show exchange account state (balance, margin, positions) |
| `hl strategies` | List all available strategies with descriptions + params |

### Command groups

| Group | Subcommands | Description |
|-------|-------------|-------------|
| `hl wolf` | `run`, `once`, `status`, `presets` | WOLF autonomous multi-slot orchestrator |
| `hl scanner` | `run`, `once`, `status`, `presets` | Opportunity scanner — screen all markets |
| `hl movers` | `run`, `once`, `status`, `presets` | Emerging movers detector (capital inflow) |
| `hl dsl` | `start`, `status`, `presets` | Dynamic Stop Loss trailing stop system |
| `hl howl` | `run`, `report`, `history` | Nightly performance review |
| `hl journal` | `view`, `entry` | Structured trade journal with reasoning |
| `hl wallet` | `auto`, `import`, `list` | Encrypted keystore wallet management |
| `hl setup` | `check`, `bootstrap`, `claim-usdyp` | Environment validation and initialization |
| `hl builder` | `approve`, `status` | Builder fee (revenue on trades) |
| `hl mcp` | `serve` | Start MCP server for AI agents |
| `hl skills` | `list` | Discover available agent skills |

---

## 2. Trading Engine (`cli/engine.py`)

Core autonomous loop: `fetch → risk check → strategy → execute → track → persist`

### Tick loop
- Configurable interval (default 10s)
- Each tick: fetch snapshot → pre-risk check → build context → call `strategy.on_tick()` → filter decisions through risk manager → execute orders → apply fills to position tracker → post-fill risk update → persist state → log tick line
- Graceful shutdown on SIGINT/SIGTERM — cancels all orders, closes all positions
- State persistence via SQLite (`StateDB`) + JSONL trade log
- Resume from saved state on restart (validates strategy + instrument match)

### Tick line output (one-line per tick)
```
[14:32:05] T42 ETH mid=3245.1200 | pos=+0.5 @ 3240.00 | uPnL=+2.56 rPnL=-0.12 | 2 sent 1 filled | risk: OK
```

### Composable guards (optional, attached to engine)
- **DSL guard**: Trailing stop that activates after first fill, auto-computes floor
- **Markout tracker**: Measures fill quality vs anomaly state (MEV protection)
- **Managed order book**: Brackets, conditionals, pegged orders evaluated each tick

---

## 3. Strategy SDK (`sdk/strategy_sdk/`)

### BaseStrategy (abstract)
```python
class BaseStrategy(ABC):
    def __init__(self, strategy_id: str = "unnamed")

    @abstractmethod
    def on_tick(self, snapshot: MarketSnapshot,
                context: Optional[StrategyContext] = None) -> List[StrategyDecision]
```

### StrategyContext (passed each tick)
- `snapshot`: Current market data
- `position_qty`, `position_notional`: Current position
- `unrealized_pnl`, `realized_pnl`: PnL state
- `reduce_only`, `safe_mode`: Risk manager flags
- `round_number`: Tick count
- `meta`: Extensible dict (drawdown %, etc.)

### StrategyDecision (returned by strategies)
- `action`: "place_order" or "noop"
- `instrument`, `side`, `size`, `limit_price`
- `order_type`: "Gtc" (rest), "Ioc" (cross spread), "Alo" (maker-only)
- `meta`: Extensible dict

### Strategy loader
- Resolve by name from registry: `"avellaneda_mm"` → `strategies.avellaneda_mm:AvellanedaMM`
- Or by path: `"mymodule:MyStrategy"`
- Dynamic import + instantiation

---

## 4. 14 Built-in Strategies (`strategies/`)

### Market Making (6)
| Strategy | Key Idea |
|----------|----------|
| `engine_mm` | Production quoting — 4-signal fair value, dynamic spreads (fee+vol+toxicity+event), inventory skew, multi-level ladder |
| `avellaneda_mm` | Avellaneda-Stoikov optimal MM — reservation price + optimal spread from γ, k params |
| `regime_mm` | 4 vol-regime classifier (quiet/normal/volatile/extreme) — auto-adapts spread/sizing |
| `simple_mm` | Symmetric bid/ask at fixed spread around mid — baseline/testing |
| `grid_mm` | Fixed-interval grid levels — accumulate/distribute across price band |
| `liquidation_mm` | Provides liquidity during cascade events — detects OI drops, widens spreads |

### Arbitrage (2)
| Strategy | Key Idea |
|----------|----------|
| `funding_arb` | Cross-venue funding rate divergence — quoting with bias from funding delta |
| `basis_arb` | Implied basis from funding rate — enter when annualized basis exceeds threshold |

### Signal / Directional (3)
| Strategy | Key Idea |
|----------|----------|
| `momentum_breakout` | Volume + price breakout above/below N-period range |
| `mean_reversion` | Trade when price deviates from SMA beyond threshold |
| `aggressive_taker` | Cross spread with directional bias — sinusoidal amplitude modulation |

### Infrastructure (3)
| Strategy | Key Idea |
|----------|----------|
| `hedge_agent` | Reduces excess exposure — fires when net notional exceeds threshold |
| `rfq_agent` | Block-size dark RFQ liquidity for large orders |
| `claude_agent` | Multi-model LLM trading — sends snapshot to Gemini/Claude/OpenAI, receives structured decisions |

---

## 5. Exchange Adapter Layer (`cli/hl_adapter.py`)

Abstraction over the exchange API. Two implementations:

### DirectHLProxy (live)
- `get_snapshot(instrument)` → `MarketSnapshot`
- `place_order(instrument, side, size, price, tif, builder)` → `HLFill | None`
- `cancel_order(instrument, oid)` → `bool`
- `get_open_orders(instrument)` → `List[Dict]`
- `get_account_state()` → `Dict`
- `get_candles(coin, interval, lookback_ms)` → candle data
- `get_all_markets()` → metadata + asset contexts
- `get_all_mids()` → all mid prices
- `set_leverage(leverage, coin)`
- Auto-retries on 429 rate limits (3 attempts, exponential backoff)
- IOC slippage: pushes buys above ask, sells below bid to guarantee fill
- Size rounding to instrument's `szDecimals`
- YEX market symbol mapping (`VXX-USDYP` → `yex:VXX`)

### DirectMockProxy (testing)
- Same interface, no exchange connection
- All orders fill immediately at requested price
- Account state returns $100k mock balance
- Mock candle data generation

---

## 6. Data Models (`common/models.py`)

All Pydantic models:

| Model | Fields |
|-------|--------|
| `MarketSnapshot` | instrument, mid_price, bid, ask, spread_bps, timestamp_ms, volume_24h, funding_rate, open_interest |
| `StrategyDecision` | action, instrument, side, size, limit_price, order_type, meta |
| `VerifyResult` | ok, checks, errors |

---

## 7. Risk Management (`parent/risk_manager.py`)

Deterministic policy-based (no ML). Enforces hard limits:

### RiskLimits
| Limit | Testnet Default | Mainnet Default |
|-------|----------------|-----------------|
| Max position qty | 10.0 | 2.0 |
| Max notional USD | $25,000 | $10,000 |
| Max single order | 5.0 | 1.0 |
| Daily drawdown % | 2.5% | 1.0% |
| Max leverage | 3x | 2x |
| TVL | $100,000 | $50,000 |
| Reserve factor | 10% | 20% |

### Pre-round check
- Position cap enforcement
- Daily drawdown circuit breaker
- Reduce-only mode activation
- Safe mode (emergency)

### Order validation
- Filter orders that would exceed limits
- Block new exposure in reduce-only mode

### Post-fill update
- Track daily PnL high-water mark
- Update drawdown calculation

---

## 8. Position Tracker (`parent/position_tracker.py`)

- Per-agent, per-instrument position tracking
- Applies fills → updates net qty, avg entry, notional
- Unrealized PnL calculation from mark price
- Realized PnL tracking
- Serializable to/from dict for state persistence

---

## 9. Order Management (`cli/order_manager.py`)

- Translates `StrategyDecision` list into exchange orders
- Cancel-and-replace semantics each tick
- Tracks order statistics (placed, filled, rejected)
- Bulk cancel on shutdown

---

## 10. Managed Order Types (`execution/order_types.py`)

Stateful orders evaluated each tick by the engine:

### BracketOrder
- Entry + take-profit + stop-loss as state machine
- Status: active → tp_triggered / sl_triggered → closed

### ConditionalOrder
- Trigger child order when price crosses threshold
- Condition: "above" or "below" trigger_price
- Optional expiry (timestamp)

### PeggedOrder
- Tracks mid price with offset (in bps)
- Re-prices every tick
- Optional max_ticks lifetime

---

## 11. WOLF Orchestrator (`modules/wolf_engine.py`, `cli/commands/wolf.py`)

Autonomous multi-slot strategy that composes Scanner + Movers + DSL:

### Concepts
- **Slots**: Independent trading positions (default 2-3)
- **Budget**: Total capital allocated, divided equally per slot
- **Presets**: default, conservative, aggressive

### Flow
1. Scanner finds opportunities → scores 0-400
2. Movers detects sudden capital inflow → confidence signals
3. WOLF selects best opportunity for empty slot
4. Opens position with DSL trailing stop guard
5. DSL manages exit (tiered profit-locking)
6. Slot freed for next opportunity

### CLI
```bash
hl wolf run --budget 500 --slots 3 --preset aggressive
hl wolf once                    # Single tick
hl wolf status                  # Show slots, positions, PnL
hl wolf presets                 # List available presets
```

### State persistence
- `data/wolf/state.json`: slots, positions, daily PnL, trade count
- Resumes from saved state on restart

---

## 12. Opportunity Scanner (`modules/scanner_engine.py`)

4-stage funnel screening all exchange assets:

### Pipeline
1. **Volume filter**: Min 24h volume threshold
2. **Market structure**: Spread, book depth, OI analysis
3. **Technicals**: RSI, momentum, trend indicators
4. **BTC macro**: Overall market regime assessment

### Scoring
- Score 0-400 across 4 pillars
- Configurable pillar weights
- Score threshold to qualify (default: 150)

### Output
- Ranked opportunity list with scores and direction
- Scan history persistence for trend tracking

```bash
hl scanner run --top-n 20 --min-volume 500000
hl scanner once                # Single scan
hl scanner status              # Last scan results
hl scanner presets              # Available configurations
```

---

## 13. Emerging Movers Detector (`modules/movers_engine.py`)

Real-time capital inflow detection:

### Signals
- **OI delta**: Sudden open interest changes
- **Volume surge**: Volume spike vs baseline
- **Funding flip**: Funding rate direction change

### Confidence levels
- IMMEDIATE (100): Strong multi-signal confirmation
- HIGH (75-99): Strong single signal
- MEDIUM (50-74): Developing signal

```bash
hl movers run --tick 60
hl movers once
hl movers status
```

---

## 14. Dynamic Stop Loss — DSL (`modules/dsl_guard.py`)

2-phase trailing stop with tiered profit-locking:

### Phase 1 (pre-profit)
- Absolute floor (default: -3% ROE at leverage)
- Retrace-from-high tracking
- Breach counting with decay

### Phase 2 (in-profit)
- Tiered profit locks (e.g., trigger at +2% → lock at +1%)
- Each tier ratchets up the floor
- Progressive protection as profit grows

### Features
- ROE-based triggers (auto-account for leverage)
- Stagnation take-profit (optional: TP if ROE sits above threshold for N seconds)
- Presets: moderate, tight
- Standalone mode or composable with engine

```bash
hl dsl start ETH-PERP --entry 3200 --size 0.5 --direction long --leverage 10 --preset moderate
hl dsl status
hl dsl presets
```

---

## 15. HOWL — Performance Review (`modules/howl_engine.py`)

Nightly self-improvement loop:

### Analysis
- Compute metrics from trade log (JSONL)
- Win rate, avg win/loss, max drawdown
- Trade duration analysis
- Strategy performance breakdown

### Report generation
- Markdown report saved to `data/howl/YYYY-MM-DD.md`
- Summary distillation for quick review
- History tracking with trend

```bash
hl howl run --since 2026-01-01
hl howl report --date 2026-03-10
hl howl history --limit 10
```

---

## 16. Trade Journal (`modules/journal_engine.py`)

Structured position records with reasoning:

### Entry fields
- entry_id, instrument, direction
- entry_price, exit_price
- PnL (absolute + ROE %)
- signal_quality rating
- entry_reasoning, exit_reasoning, retrospective
- close_reason, holding duration

### CLI
```bash
hl journal view --date 2026-03-10 --limit 20
hl journal entry <entry-id>          # Full detail with reasoning
```

---

## 17. Agent Memory (`modules/memory_engine.py`)

Persistent learnings across sessions:

### Event types
- `param_change`: Strategy parameter adjustments
- `howl_review`: Performance review findings
- `notable_trade`: Significant trades worth remembering
- `judge_finding`: Signal quality evaluations
- `session_start` / `session_end`: Session boundaries

### Playbook
- Accumulated knowledge from all events
- Queryable via MCP tool

---

## 18. Judge Engine (`modules/judge_engine.py`)

Signal quality evaluator:

- Analyzes signal → outcome correlation
- False positive rate tracking
- Generates actionable recommendations
- Reports accessible via MCP tool

---

## 19. Obsidian Integration (`modules/obsidian_reader.py`, `obsidian_writer.py`)

Reads/writes trading context from Obsidian vault:

- Watchlists
- Market theses
- Risk preferences
- Bi-directional sync

---

## 20. Wallet & Keystore (`cli/keystore.py`)

Encrypted key management:

- `hl wallet auto --save-env`: Create wallet + save creds (agent-friendly, zero prompts)
- `hl wallet import`: Import existing private key
- `hl wallet list`: List saved keystores
- Auto-unlock via `HL_KEYSTORE_PASSWORD` env var
- Keys stored encrypted at `~/.hl-agent/keystores/`
- Fallback to `HL_PRIVATE_KEY` env var

---

## 21. Config System (`cli/config.py`)

Hierarchical configuration: YAML file → CLI flags → env vars

### TradingConfig
- Strategy selection + params
- Instrument, network (testnet/mainnet)
- Tick interval, max ticks
- Risk limits (auto-switches testnet → mainnet defaults)
- DSL config (optional)
- Anomaly protection config (optional)
- Builder fee config
- Logging level

### YAML config example
```yaml
strategy: engine_mm
instrument: ETH-PERP
tick_interval: 10
max_leverage: 3.0
dsl:
  enabled: true
  preset: moderate
```

---

## 22. MCP Server (`cli/mcp_server.py`)

16 tools exposed via Model Context Protocol for AI agents:

### Fast tools (direct Python calls)
| Tool | Description |
|------|-------------|
| `strategies()` | List all strategies with params |
| `builder_status()` | Builder fee config |
| `wallet_list()` | List keystores |
| `wallet_auto()` | Create wallet (agent-friendly) |
| `setup_check()` | Validate environment |
| `account()` | Exchange account state |
| `status()` | Positions + PnL |

### Action tools (subprocess, long-running)
| Tool | Description |
|------|-------------|
| `trade(instrument, side, size)` | Place single order |
| `run_strategy(strategy, instrument, ...)` | Start autonomous trading |
| `scanner_run(mock)` | Run opportunity scanner |
| `wolf_status()` | WOLF orchestrator state |
| `wolf_run(mock, max_ticks, preset)` | Start WOLF |
| `howl_run(since)` | Performance review |

### Self-improvement tools
| Tool | Description |
|------|-------------|
| `agent_memory(query_type, limit)` | Read learnings + playbook |
| `trade_journal(date, limit)` | Structured trade records |
| `judge_report()` | Signal quality evaluation |
| `obsidian_context()` | Trading context from Obsidian vault |

---

## 23. Display / Formatting (`cli/display.py`)

ANSI-colored terminal output:

- `tick_line()`: One-line per-tick summary with color-coded PnL
- `status_table()`: Full status dashboard (positions, PnL, risk, recent fills)
- `strategy_table()`: Strategy list with descriptions + params
- `account_table()`: Account state (value, margin, withdrawable)
- `shutdown_summary()`: Final stats on graceful exit

---

## 24. Execution Layer (`execution/`)

### Order Book (`execution/order_book.py`)
- `ManagedOrderBook`: Container for bracket, conditional, pegged orders
- Evaluates all managed orders each tick
- Returns triggered decisions to engine

### TWAP Executor (`execution/twap.py`)
- Time-weighted average price execution
- Splits large orders into slices over time

### Parent Order (`execution/parent_order.py`)
- Multi-child order management
- Tracks completion across child fills

### Portfolio Risk (`execution/portfolio_risk.py`)
- Cross-instrument risk aggregation
- Correlation-aware exposure calculation

---

## 25. Skills System (`skills/`)

6 self-contained skills following the Agent Skills standard:

| Skill | Purpose | Files |
|-------|---------|-------|
| `onboard` | First-time setup from zero to first trade (9 steps) | `SKILL.md` |
| `wolf` | Autonomous multi-slot trading composition | `SKILL.md`, `standalone_runner.py` |
| `scanner` | 4-stage opportunity funnel | `SKILL.md`, `standalone_runner.py` |
| `movers` | Capital inflow detection | `SKILL.md`, `standalone_runner.py` |
| `dsl` | Dynamic trailing stop | `SKILL.md`, `standalone_runner.py` |
| `howl` | Nightly self-improvement | `SKILL.md` |

Each skill has:
- `SKILL.md` with YAML frontmatter (name, version, description)
- Optional standalone runner scripts
- Installable via Claude Code, OpenClaw, or raw URL

---

## 26. Builder Fee (`cli/builder_fee.py`)

Revenue collection on trades:
- Configurable fee in bps
- Builder address for fee routing
- One-time approval step (`hl builder approve`)
- Passes builder info to exchange on every order

---

## 27. Smart Money Tracker (`modules/smart_money/`)

- Tracks known whale/institutional wallets
- Configurable tracker with wallet lists
- Provides signal input for strategies

---

## 28. Deployment

### Railway (one-click)
- `railway.toml` + `Dockerfile`
- Template URL for instant deploy
- Env vars: `HL_PRIVATE_KEY`, `HL_TESTNET`, `RUN_MODE`, `WOLF_PRESET`

### Docker
- `Dockerfile` at root
- `.dockerignore` for clean builds

### OpenClaw
- `deploy/openclaw-railway/`: Node.js gateway for OpenClaw platform
- Agent workspace with `AGENTS.md`, `SOUL.md`, `TOOLS.md`

---

## 29. Testing

263 tests covering:
- All strategies (`test_new_strategies.py`, `test_engine_strategies.py`)
- WOLF engine, scanner, movers
- DSL trailing stop, order types
- HOWL performance engine
- Journal, judge, memory engines
- Smart money tracker
- Portfolio risk, TWAP executor
- Builder fee, keystore

---

## 30. Network Guard

Safety against wrong-chain deployment:
- `--mainnet` flag cross-checked against `HL_TESTNET` env var
- Refuses to start if mismatch detected
- Prevents accidental mainnet trading from testnet config (and vice versa)

---

## Summary: What's Reusable vs Exchange-Specific

### Reusable (architecture patterns)
- Typer CLI skeleton + command groups
- BaseStrategy + StrategyContext + StrategyDecision pattern
- Trading engine tick loop structure
- Risk manager (deterministic policy limits)
- Position tracker (per-agent, per-instrument)
- Config system (YAML + CLI + env hierarchy)
- MCP server (fast tools + subprocess for long-running)
- Display formatting (ANSI colored output)
- State persistence (StateDB + JSONL)
- Wallet/keystore management
- Skills system (SKILL.md + standalone runners)
- Mock proxy for testing
- Network guard (safety checks)
- WOLF orchestrator pattern (multi-slot + compose modules)
- HOWL review pattern (trade analysis + report generation)
- Journal pattern (structured records with reasoning)
- Memory pattern (persistent learnings across sessions)

### Exchange-specific (must be replaced)
- `hl_adapter.py` — all Hyperliquid SDK calls
- `parent/hl_proxy.py` — raw exchange API wrapper
- All 14 strategy implementations (perp/orderbook logic)
- YEX market mapping
- Builder fee mechanism
- Funding rate, OI, spread calculations in scanner/movers
- Candle data fetching
- Order size rounding (szDecimals)
- IOC slippage logic
- `claim-usdyp` setup step
