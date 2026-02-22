# Vision Bot Strategy Framework

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a modular strategy framework for vision-bot so any agent can add a new prediction strategy in under 5 minutes — just subclass, implement `generate_bets()`, done.

**Architecture:** Extract chain interaction into an `Executor`, market data fetching into a `DataSource`, exposure controls into a `RiskManager`, and prediction logic into a `Strategy` ABC. Strategies are auto-discovered from `strategies/` folder and selected via `STRATEGY` env var. The existing random behavior becomes `RandomStrategy` — the default.

**Tech Stack:** Python 3.11+, web3.py, requests. No new dependencies.

---

## Target Structure

```
vision-bot/
├── bot.py                          # Entry point — wires framework, runs poll loop
├── requirements.txt
├── framework/
│   ├── __init__.py
│   ├── types.py                    # BatchInfo, Position, Bet, MarketData
│   ├── strategy.py                 # Strategy ABC
│   ├── data.py                     # DataSource — fetches prices from data-node
│   ├── risk.py                     # RiskManager — exposure limits
│   ├── executor.py                 # Chain ops — approve, join, submit bitmap
│   └── registry.py                 # Strategy auto-discovery
├── strategies/
│   ├── __init__.py
│   ├── random_strategy.py          # Current random behavior
│   └── momentum.py                 # Example: follow 24h price change
└── tests/
    ├── __init__.py
    ├── test_types.py
    ├── test_strategy.py
    ├── test_data.py
    ├── test_risk.py
    ├── test_registry.py
    ├── test_random_strategy.py
    └── test_momentum.py
```

## Adding a New Strategy (End Result)

After this framework, adding a strategy is just:

```python
# strategies/my_strategy.py
from framework.strategy import Strategy
from framework.types import BatchInfo, MarketData

class MyStrategy(Strategy):
    name = "my_strategy"

    def generate_bets(self, batch: BatchInfo, markets: list[MarketData]) -> list[str]:
        # Your logic here — return ["UP", "DOWN", "UP", ...] per market
        return ["UP" if m.change_pct and m.change_pct > 0 else "DOWN" for m in markets]
```

Then run with: `STRATEGY=my_strategy python3 bot.py`

---

## Task 1: Shared Types (`framework/types.py`)

**Files:**
- Create: `vision-bot/framework/__init__.py`
- Create: `vision-bot/framework/types.py`
- Create: `vision-bot/tests/__init__.py`
- Create: `vision-bot/tests/test_types.py`

**Step 1: Write the failing test**

```python
# vision-bot/tests/test_types.py
from framework.types import BatchInfo, Position, MarketData, encode_bitmap, hash_bitmap

def test_batch_info_fields():
    b = BatchInfo(id=1, market_ids=["btc", "eth"], market_count=2, tick_duration=60, paused=False)
    assert b.id == 1
    assert b.market_count == 2

def test_market_data_fields():
    m = MarketData(asset_id="btc", source="coingecko", symbol="BTC", name="Bitcoin",
                   value=50000.0, change_pct=2.5, volume_24h=1e9, market_cap=1e12)
    assert m.value == 50000.0
    assert m.change_pct == 2.5

def test_position_fields():
    p = Position(bitmap_hash=b"\x00"*32, stake_per_tick=1000000, start_tick=0,
                 balance=10000000, last_claimed_tick=0, join_timestamp=0,
                 total_deposited=10000000, total_claimed=0)
    assert p.balance == 10000000

def test_encode_bitmap_all_up():
    bets = ["UP", "UP", "UP", "UP", "UP", "UP", "UP", "UP"]
    result = encode_bitmap(bets, 8)
    assert result == bytes([0xFF])

def test_encode_bitmap_all_down():
    bets = ["DOWN"] * 8
    result = encode_bitmap(bets, 8)
    assert result == bytes([0x00])

def test_encode_bitmap_mixed():
    # UP, DOWN, UP, DOWN, UP, DOWN, UP, DOWN = 10101010 = 0xAA
    bets = ["UP", "DOWN", "UP", "DOWN", "UP", "DOWN", "UP", "DOWN"]
    result = encode_bitmap(bets, 8)
    assert result == bytes([0xAA])

def test_encode_bitmap_partial_byte():
    # 3 markets: UP, DOWN, UP → 10100000 = 0xA0
    bets = ["UP", "DOWN", "UP"]
    result = encode_bitmap(bets, 3)
    assert result == bytes([0xA0])

def test_hash_bitmap_deterministic():
    bm = encode_bitmap(["UP", "DOWN"], 2)
    h1 = hash_bitmap(bm)
    h2 = hash_bitmap(bm)
    assert h1 == h2
    assert len(h1) == 32
```

**Step 2: Run test to verify it fails**

Run: `cd vision-bot && python -m pytest tests/test_types.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'framework'`

**Step 3: Write the implementation**

```python
# vision-bot/framework/__init__.py
```

```python
# vision-bot/framework/types.py
"""Shared types for the Vision bot strategy framework."""

from dataclasses import dataclass, field
from typing import Optional
from web3 import Web3


@dataclass
class BatchInfo:
    """Batch metadata from chain + API."""
    id: int
    market_ids: list[str]
    market_count: int
    tick_duration: int
    paused: bool
    creator: str = ""
    player_count: int = 0
    tvl: int = 0
    resolution_types: list[int] = field(default_factory=list)


@dataclass
class MarketData:
    """Single market's price data from data-node snapshot."""
    asset_id: str
    source: str
    symbol: str
    name: str
    value: float
    change_pct: Optional[float] = None
    volume_24h: Optional[float] = None
    market_cap: Optional[float] = None
    category: Optional[str] = None


@dataclass
class Position:
    """On-chain player position in a batch."""
    bitmap_hash: bytes
    stake_per_tick: int
    start_tick: int
    balance: int
    last_claimed_tick: int
    join_timestamp: int
    total_deposited: int
    total_claimed: int


def encode_bitmap(bets: list[str], market_count: int) -> bytes:
    """Encode UP/DOWN bets into packed bitmap. Bit 1 = UP, 0 = DOWN. Big-endian."""
    byte_count = (market_count + 7) // 8
    bitmap = bytearray(byte_count)
    for i in range(market_count):
        if i < len(bets) and bets[i] == "UP":
            byte_idx = i // 8
            bit_idx = 7 - (i % 8)
            bitmap[byte_idx] |= 1 << bit_idx
    return bytes(bitmap)


def hash_bitmap(bitmap: bytes) -> bytes:
    """keccak256 hash of bitmap bytes."""
    return Web3.keccak(bitmap)
```

**Step 4: Run test to verify it passes**

Run: `cd vision-bot && python -m pytest tests/test_types.py -v`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add vision-bot/framework/__init__.py vision-bot/framework/types.py vision-bot/tests/__init__.py vision-bot/tests/test_types.py
git commit -m "feat(vision-bot): add shared types for strategy framework"
```

---

## Task 2: Strategy ABC (`framework/strategy.py`)

**Files:**
- Create: `vision-bot/framework/strategy.py`
- Create: `vision-bot/tests/test_strategy.py`

**Step 1: Write the failing test**

```python
# vision-bot/tests/test_strategy.py
import pytest
from framework.strategy import Strategy
from framework.types import BatchInfo, MarketData

def test_strategy_is_abstract():
    """Can't instantiate Strategy directly."""
    with pytest.raises(TypeError):
        Strategy()

def test_subclass_must_implement_generate_bets():
    """Subclass without generate_bets raises TypeError."""
    class Incomplete(Strategy):
        name = "incomplete"
    with pytest.raises(TypeError):
        Incomplete()

def test_subclass_with_generate_bets_works():
    class Simple(Strategy):
        name = "simple"
        def generate_bets(self, batch, markets):
            return ["UP"] * len(markets)

    s = Simple()
    assert s.name == "simple"
    batch = BatchInfo(id=1, market_ids=["a", "b"], market_count=2, tick_duration=60, paused=False)
    markets = [
        MarketData(asset_id="a", source="x", symbol="A", name="A", value=1.0),
        MarketData(asset_id="b", source="x", symbol="B", name="B", value=2.0),
    ]
    assert s.generate_bets(batch, markets) == ["UP", "UP"]

def test_should_join_defaults_true():
    class Simple(Strategy):
        name = "simple"
        def generate_bets(self, batch, markets):
            return []

    s = Simple()
    batch = BatchInfo(id=1, market_ids=[], market_count=0, tick_duration=60, paused=False)
    assert s.should_join(batch) is True

def test_position_size_returns_defaults():
    class Simple(Strategy):
        name = "simple"
        def generate_bets(self, batch, markets):
            return []

    s = Simple()
    batch = BatchInfo(id=1, market_ids=[], market_count=0, tick_duration=60, paused=False)
    deposit, stake = s.position_size(batch)
    assert deposit > 0
    assert stake > 0
```

**Step 2: Run test to verify it fails**

Run: `cd vision-bot && python -m pytest tests/test_strategy.py -v`
Expected: FAIL — `ModuleNotFoundError`

**Step 3: Write the implementation**

```python
# vision-bot/framework/strategy.py
"""Strategy base class — subclass this to add a prediction strategy."""

import os
from abc import ABC, abstractmethod
from framework.types import BatchInfo, MarketData

DECIMALS = 6


class Strategy(ABC):
    """
    Base class for Vision prediction strategies.

    To create a strategy:
    1. Subclass Strategy
    2. Set `name` class attribute
    3. Implement `generate_bets(batch, markets) -> list[str]`
    4. Optionally override `should_join()` and `position_size()`

    Place your file in strategies/ — it's auto-discovered.
    """

    name: str = ""

    @abstractmethod
    def generate_bets(self, batch: BatchInfo, markets: list[MarketData]) -> list[str]:
        """
        Generate UP/DOWN predictions for each market in the batch.

        Args:
            batch: Batch metadata (id, market_ids, tick_duration, etc.)
            markets: Price data for each market_id, in the same order as batch.market_ids.
                     If a market has no data, its MarketData.value will be 0.

        Returns:
            List of "UP" or "DOWN" strings, one per market. Length must equal batch.market_count.
        """
        ...

    def should_join(self, batch: BatchInfo) -> bool:
        """
        Filter: should this strategy join this batch?
        Override to skip batches based on market count, tick duration, etc.
        Default: join everything that's not paused.
        """
        return not batch.paused

    def position_size(self, batch: BatchInfo) -> tuple[int, int]:
        """
        Decide deposit and stake amounts (in raw wei, 6 decimals).
        Override for dynamic sizing.
        Default: reads from DEPOSIT_AMOUNT and STAKE_PER_TICK env vars.

        Returns:
            (deposit_wei, stake_per_tick_wei)
        """
        deposit = int(os.environ.get("DEPOSIT_AMOUNT", "10")) * (10 ** DECIMALS)
        stake = int(os.environ.get("STAKE_PER_TICK", "1")) * (10 ** DECIMALS)
        return deposit, stake
```

**Step 4: Run test to verify it passes**

Run: `cd vision-bot && python -m pytest tests/test_strategy.py -v`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add vision-bot/framework/strategy.py vision-bot/tests/test_strategy.py
git commit -m "feat(vision-bot): add Strategy ABC with generate_bets, should_join, position_size"
```

---

## Task 3: DataSource (`framework/data.py`)

**Files:**
- Create: `vision-bot/framework/data.py`
- Create: `vision-bot/tests/test_data.py`

**Step 1: Write the failing test**

```python
# vision-bot/tests/test_data.py
import json
from unittest.mock import patch, MagicMock
from framework.data import DataSource
from framework.types import MarketData

MOCK_SNAPSHOT = {
    "count": 2,
    "snapshots": [
        {"assetId": "bitcoin", "source": "coingecko", "symbol": "BTC", "name": "Bitcoin",
         "value": "50000", "changePct": "2.5", "volume24h": "1000000000", "marketCap": "1000000000000",
         "category": "crypto", "fetchedAt": "2026-01-01T00:00:00Z"},
        {"assetId": "ethereum", "source": "coingecko", "symbol": "ETH", "name": "Ethereum",
         "value": "3000", "changePct": "-1.2", "volume24h": "500000000", "marketCap": "400000000000",
         "category": "crypto", "fetchedAt": "2026-01-01T00:00:00Z"},
    ]
}

def test_fetch_snapshot_parses_response():
    ds = DataSource(data_node_url="http://fake:8200")
    with patch("framework.data.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = MOCK_SNAPSHOT
        mock_get.return_value = mock_resp

        result = ds.fetch_snapshot()
        assert len(result) == 2
        assert result[0].asset_id == "bitcoin"
        assert result[0].value == 50000.0
        assert result[1].change_pct == -1.2

def test_fetch_snapshot_with_source_filter():
    ds = DataSource(data_node_url="http://fake:8200")
    with patch("framework.data.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = MOCK_SNAPSHOT
        mock_get.return_value = mock_resp

        ds.fetch_snapshot(source="coingecko")
        mock_get.assert_called_once()
        call_args = mock_get.call_args
        assert "source" in call_args[1].get("params", {}) or "source=coingecko" in str(call_args)

def test_get_markets_for_batch():
    ds = DataSource(data_node_url="http://fake:8200")
    with patch("framework.data.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = MOCK_SNAPSHOT
        mock_get.return_value = mock_resp

        # Request only bitcoin
        result = ds.get_markets_for_batch(["bitcoin", "unknown_market"])
        assert len(result) == 2  # one per requested market_id
        assert result[0].asset_id == "bitcoin"
        assert result[0].value == 50000.0
        # Unknown market gets a zero-value placeholder
        assert result[1].asset_id == "unknown_market"
        assert result[1].value == 0.0

def test_fetch_snapshot_handles_failure():
    ds = DataSource(data_node_url="http://fake:8200")
    with patch("framework.data.requests.get") as mock_get:
        mock_get.side_effect = Exception("connection refused")
        result = ds.fetch_snapshot()
        assert result == []
```

**Step 2: Run test to verify it fails**

Run: `cd vision-bot && python -m pytest tests/test_data.py -v`
Expected: FAIL — `ModuleNotFoundError`

**Step 3: Write the implementation**

```python
# vision-bot/framework/data.py
"""DataSource — fetches market price data from data-node for strategy consumption."""

import logging
from typing import Optional
import requests
from framework.types import MarketData

log = logging.getLogger("vision-bot.data")


class DataSource:
    """
    Fetches market data from data-node's /vision/snapshot endpoint.

    Usage in a strategy:
        markets = data.get_markets_for_batch(batch.market_ids)
        # markets[i] corresponds to batch.market_ids[i]
        # markets[i].value = 0.0 if no data available
    """

    def __init__(self, data_node_url: str = "http://localhost:8200"):
        self.data_node_url = data_node_url.rstrip("/")
        self._cache: dict[str, MarketData] = {}

    def fetch_snapshot(self, source: Optional[str] = None) -> list[MarketData]:
        """Fetch all market data from data-node. Caches by asset_id."""
        try:
            params = {}
            if source:
                params["source"] = source
            resp = requests.get(
                f"{self.data_node_url}/vision/snapshot",
                params=params,
                timeout=15,
            )
            if not resp.ok:
                log.warning("Snapshot fetch failed: %d", resp.status_code)
                return []
            data = resp.json()
            snapshots = data.get("snapshots", [])
            results = []
            for s in snapshots:
                md = MarketData(
                    asset_id=s.get("assetId", ""),
                    source=s.get("source", ""),
                    symbol=s.get("symbol", ""),
                    name=s.get("name", ""),
                    value=float(s.get("value", 0)),
                    change_pct=float(s["changePct"]) if s.get("changePct") is not None else None,
                    volume_24h=float(s["volume24h"]) if s.get("volume24h") is not None else None,
                    market_cap=float(s["marketCap"]) if s.get("marketCap") is not None else None,
                    category=s.get("category"),
                )
                results.append(md)
                self._cache[md.asset_id] = md
            return results
        except Exception as e:
            log.warning("Failed to fetch snapshot: %s", e)
            return []

    def get_markets_for_batch(self, market_ids: list[str]) -> list[MarketData]:
        """
        Get MarketData for each market_id in a batch, in order.
        Fetches snapshot if cache is empty. Returns zero-value placeholder for unknown markets.
        """
        if not self._cache:
            self.fetch_snapshot()

        results = []
        for mid in market_ids:
            if mid in self._cache:
                results.append(self._cache[mid])
            else:
                # Placeholder so strategies always get one MarketData per market
                results.append(MarketData(
                    asset_id=mid, source="", symbol=mid.upper(),
                    name=mid, value=0.0,
                ))
        return results

    def refresh(self):
        """Force-refresh the cache."""
        self._cache.clear()
        self.fetch_snapshot()
```

**Step 4: Run test to verify it passes**

Run: `cd vision-bot && python -m pytest tests/test_data.py -v`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add vision-bot/framework/data.py vision-bot/tests/test_data.py
git commit -m "feat(vision-bot): add DataSource for market data fetching"
```

---

## Task 4: RiskManager (`framework/risk.py`)

**Files:**
- Create: `vision-bot/framework/risk.py`
- Create: `vision-bot/tests/test_risk.py`

**Step 1: Write the failing test**

```python
# vision-bot/tests/test_risk.py
from framework.risk import RiskManager

def test_default_limits():
    rm = RiskManager()
    assert rm.max_concurrent_batches > 0
    assert rm.max_total_exposure > 0

def test_can_join_within_limits():
    rm = RiskManager(max_concurrent_batches=3, max_total_exposure=100_000_000)
    assert rm.can_join(deposit=10_000_000) is True

def test_can_join_blocked_by_max_batches():
    rm = RiskManager(max_concurrent_batches=1, max_total_exposure=100_000_000)
    rm.record_join(batch_id=1, deposit=10_000_000)
    assert rm.can_join(deposit=10_000_000) is False

def test_can_join_blocked_by_exposure():
    rm = RiskManager(max_concurrent_batches=10, max_total_exposure=15_000_000)
    rm.record_join(batch_id=1, deposit=10_000_000)
    # 10M already exposed, trying to add 10M more > 15M limit
    assert rm.can_join(deposit=10_000_000) is False

def test_record_exit_frees_capacity():
    rm = RiskManager(max_concurrent_batches=1, max_total_exposure=100_000_000)
    rm.record_join(batch_id=1, deposit=10_000_000)
    assert rm.can_join(deposit=10_000_000) is False
    rm.record_exit(batch_id=1)
    assert rm.can_join(deposit=10_000_000) is True

def test_current_exposure():
    rm = RiskManager(max_concurrent_batches=10, max_total_exposure=100_000_000)
    rm.record_join(batch_id=1, deposit=5_000_000)
    rm.record_join(batch_id=2, deposit=7_000_000)
    assert rm.current_exposure() == 12_000_000
    assert rm.active_batch_count() == 2
```

**Step 2: Run test to verify it fails**

Run: `cd vision-bot && python -m pytest tests/test_risk.py -v`
Expected: FAIL

**Step 3: Write the implementation**

```python
# vision-bot/framework/risk.py
"""RiskManager — controls exposure limits and batch capacity."""

import logging

log = logging.getLogger("vision-bot.risk")

DECIMALS = 6


class RiskManager:
    """
    Tracks active exposure and enforces limits.

    Configure via constructor or env vars:
        MAX_CONCURRENT_BATCHES (default: 5)
        MAX_TOTAL_EXPOSURE     (default: 100 USDC = 100_000_000 raw)
    """

    def __init__(
        self,
        max_concurrent_batches: int = 5,
        max_total_exposure: int = 100_000_000,  # 100 USDC in 6-decimal raw
    ):
        self.max_concurrent_batches = max_concurrent_batches
        self.max_total_exposure = max_total_exposure
        self._active: dict[int, int] = {}  # batch_id -> deposit amount

    def can_join(self, deposit: int) -> bool:
        """Check if joining with this deposit is within risk limits."""
        if len(self._active) >= self.max_concurrent_batches:
            log.info("Risk: at max concurrent batches (%d)", self.max_concurrent_batches)
            return False
        if self.current_exposure() + deposit > self.max_total_exposure:
            log.info("Risk: would exceed max exposure (%d + %d > %d)",
                     self.current_exposure(), deposit, self.max_total_exposure)
            return False
        return True

    def record_join(self, batch_id: int, deposit: int):
        """Record that we joined a batch with this deposit."""
        self._active[batch_id] = deposit

    def record_exit(self, batch_id: int):
        """Record that we exited a batch."""
        self._active.pop(batch_id, None)

    def current_exposure(self) -> int:
        """Total USDC currently at risk across all active batches."""
        return sum(self._active.values())

    def active_batch_count(self) -> int:
        """Number of batches currently active."""
        return len(self._active)
```

**Step 4: Run test to verify it passes**

Run: `cd vision-bot && python -m pytest tests/test_risk.py -v`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add vision-bot/framework/risk.py vision-bot/tests/test_risk.py
git commit -m "feat(vision-bot): add RiskManager with exposure and batch limits"
```

---

## Task 5: Executor (`framework/executor.py`)

**Files:**
- Create: `vision-bot/framework/executor.py`
- Test: `vision-bot/tests/test_executor.py` (light — chain interaction is hard to unit test)

**Step 1: Write the failing test**

```python
# vision-bot/tests/test_executor.py
"""Executor tests — mostly structural since chain calls need integration setup."""
from unittest.mock import MagicMock, patch
from framework.executor import Executor

def test_executor_init_requires_private_key():
    """Executor needs a private key."""
    import pytest
    with pytest.raises(ValueError, match="private_key"):
        Executor(rpc_url="http://fake", vision_addr="0x" + "0" * 40,
                 usdc_addr="0x" + "0" * 40, private_key="",
                 issuer_urls=["http://localhost:10001"])

def test_executor_init_with_valid_key():
    """Executor initializes with a valid private key (doesn't connect yet)."""
    # Use a throwaway test key (not real funds)
    key = "0x" + "ab" * 32
    ex = Executor(
        rpc_url="http://fake:8546",
        vision_addr="0x" + "11" * 20,
        usdc_addr="0x" + "22" * 20,
        private_key=key,
        issuer_urls=["http://localhost:10001"],
    )
    assert ex.bot_addr is not None
    assert ex.bot_addr.startswith("0x")
```

**Step 2: Run test to verify it fails**

Run: `cd vision-bot && python -m pytest tests/test_executor.py -v`
Expected: FAIL

**Step 3: Write the implementation**

```python
# vision-bot/framework/executor.py
"""Executor — handles all chain interaction and bitmap submission."""

import logging
import time
from typing import Optional
import requests
from web3 import Web3
from framework.types import encode_bitmap, hash_bitmap, Position

log = logging.getLogger("vision-bot.executor")

ERC20_ABI = [
    {"name": "approve", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
     "outputs": [{"name": "", "type": "bool"}]},
    {"name": "balanceOf", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "account", "type": "address"}],
     "outputs": [{"name": "", "type": "uint256"}]},
]

VISION_ABI = [
    {"name": "joinBatch", "type": "function", "stateMutability": "nonpayable",
     "inputs": [
         {"name": "batchId", "type": "uint256"}, {"name": "depositAmount", "type": "uint256"},
         {"name": "stakePerTick", "type": "uint256"}, {"name": "bitmapHash", "type": "bytes32"},
     ], "outputs": []},
    {"name": "getPosition", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "batchId", "type": "uint256"}, {"name": "player", "type": "address"}],
     "outputs": [{"name": "", "type": "tuple", "components": [
         {"name": "bitmapHash", "type": "bytes32"}, {"name": "stakePerTick", "type": "uint256"},
         {"name": "startTick", "type": "uint256"}, {"name": "balance", "type": "uint256"},
         {"name": "lastClaimedTick", "type": "uint256"}, {"name": "joinTimestamp", "type": "uint256"},
         {"name": "totalDeposited", "type": "uint256"}, {"name": "totalClaimed", "type": "uint256"},
     ]}]},
    {"name": "getBatch", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "batchId", "type": "uint256"}],
     "outputs": [{"name": "", "type": "tuple", "components": [
         {"name": "creator", "type": "address"}, {"name": "marketIds", "type": "bytes32[]"},
         {"name": "resolutionTypes", "type": "uint8[]"}, {"name": "tickDuration", "type": "uint256"},
         {"name": "customThresholds", "type": "uint256[]"}, {"name": "createdAtTick", "type": "uint256"},
         {"name": "paused", "type": "bool"},
     ]}]},
    {"name": "registerBot", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "endpoint", "type": "string"}, {"name": "pubkeyHash", "type": "bytes32"}],
     "outputs": []},
]


class Executor:
    """
    Handles all blockchain interaction:
    - USDC approval and balance checks
    - Joining batches on-chain
    - Submitting bitmaps to issuer nodes
    - Reading positions and batch info
    """

    def __init__(self, rpc_url: str, vision_addr: str, usdc_addr: str,
                 private_key: str, issuer_urls: list[str]):
        if not private_key:
            raise ValueError("private_key is required")

        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.account = self.w3.eth.account.from_key(private_key)
        self.bot_addr = self.account.address
        self.issuer_urls = issuer_urls

        self.vision = self.w3.eth.contract(
            address=Web3.to_checksum_address(vision_addr), abi=VISION_ABI)
        self.usdc = self.w3.eth.contract(
            address=Web3.to_checksum_address(usdc_addr), abi=ERC20_ABI)

    def _sign_and_send(self, tx: dict) -> bytes:
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash

    def usdc_balance(self) -> int:
        return self.usdc.functions.balanceOf(self.bot_addr).call()

    def approve_usdc(self, amount: int):
        tx = self.usdc.functions.approve(
            self.vision.address, amount
        ).build_transaction({
            "from": self.bot_addr, "gas": 200_000,
            "gasPrice": self.w3.eth.gas_price,
            "nonce": self.w3.eth.get_transaction_count(self.bot_addr),
        })
        self._sign_and_send(tx)
        log.info("USDC approved: %d", amount)

    def join_batch(self, batch_id: int, deposit: int, stake: int, bitmap_hash: bytes):
        tx = self.vision.functions.joinBatch(
            batch_id, deposit, stake, bitmap_hash
        ).build_transaction({
            "from": self.bot_addr, "gas": 500_000,
            "gasPrice": self.w3.eth.gas_price,
            "nonce": self.w3.eth.get_transaction_count(self.bot_addr),
        })
        tx_hash = self._sign_and_send(tx)
        log.info("Joined batch %d (tx: %s)", batch_id, tx_hash.hex()[:16])

    def get_position(self, batch_id: int) -> Position:
        raw = self.vision.functions.getPosition(batch_id, self.bot_addr).call()
        return Position(
            bitmap_hash=raw[0], stake_per_tick=raw[1], start_tick=raw[2],
            balance=raw[3], last_claimed_tick=raw[4], join_timestamp=raw[5],
            total_deposited=raw[6], total_claimed=raw[7],
        )

    def get_batch_market_count(self, batch_id: int) -> int:
        info = self.vision.functions.getBatch(batch_id).call()
        return len(info[1])  # marketIds array length

    def submit_bitmap(self, batch_id: int, bitmap: bytes, bitmap_hash: bytes,
                      retries: int = 3) -> int:
        """Submit bitmap to issuer nodes. Returns number of acceptances."""
        bm_hex = "0x" + bitmap.hex()
        hash_hex = "0x" + bitmap_hash.hex()
        accepted = 0
        for attempt in range(retries):
            for url in self.issuer_urls:
                try:
                    resp = requests.post(
                        f"{url}/vision/bitmap",
                        json={"player": self.bot_addr, "batch_id": batch_id,
                              "bitmap_hex": bm_hex, "expected_hash": hash_hex},
                        timeout=10,
                    )
                    if resp.ok:
                        accepted += 1
                except requests.RequestException:
                    pass
            if accepted >= 1:
                break
            log.info("Bitmap retry %d/%d...", attempt + 1, retries)
            time.sleep(3)
        log.info("Bitmap submitted to %d/%d issuers", accepted, len(self.issuer_urls))
        return accepted

    def register_bot(self):
        endpoint = "http://localhost:9999"
        pubkey_hash = Web3.keccak(text=f"bot-{self.bot_addr}")
        try:
            tx = self.vision.functions.registerBot(
                endpoint, pubkey_hash
            ).build_transaction({
                "from": self.bot_addr, "gas": 200_000,
                "gasPrice": self.w3.eth.gas_price,
                "nonce": self.w3.eth.get_transaction_count(self.bot_addr),
            })
            self._sign_and_send(tx)
            log.info("Bot registered on Vision contract")
        except Exception as e:
            log.warning("Bot registration failed: %s", e)

    def fetch_batches(self, api_url: str) -> list[dict]:
        """Fetch active batches from issuer Vision API."""
        try:
            resp = requests.get(f"{api_url}/vision/batches", timeout=10)
            if resp.ok:
                data = resp.json()
                return data.get("batches", data if isinstance(data, list) else [])
        except requests.RequestException:
            pass
        return []
```

**Step 4: Run test to verify it passes**

Run: `cd vision-bot && python -m pytest tests/test_executor.py -v`
Expected: Both tests PASS

**Step 5: Commit**

```bash
git add vision-bot/framework/executor.py vision-bot/tests/test_executor.py
git commit -m "feat(vision-bot): add Executor for chain interaction and bitmap submission"
```

---

## Task 6: Strategy Registry (`framework/registry.py`)

**Files:**
- Create: `vision-bot/framework/registry.py`
- Create: `vision-bot/tests/test_registry.py`

**Step 1: Write the failing test**

```python
# vision-bot/tests/test_registry.py
from framework.registry import discover_strategies, get_strategy
from framework.strategy import Strategy
from framework.types import BatchInfo, MarketData

def test_discover_finds_builtin_strategies():
    """discover_strategies finds RandomStrategy from strategies/ folder."""
    strategies = discover_strategies()
    assert "random" in strategies

def test_get_strategy_returns_instance():
    s = get_strategy("random")
    assert isinstance(s, Strategy)
    assert s.name == "random"

def test_get_strategy_unknown_raises():
    import pytest
    with pytest.raises(KeyError):
        get_strategy("nonexistent_strategy_xyz")

def test_discovered_strategy_generates_bets():
    s = get_strategy("random")
    batch = BatchInfo(id=1, market_ids=["a", "b", "c"], market_count=3,
                      tick_duration=60, paused=False)
    markets = [MarketData(asset_id=x, source="test", symbol=x, name=x, value=1.0)
               for x in ["a", "b", "c"]]
    bets = s.generate_bets(batch, markets)
    assert len(bets) == 3
    assert all(b in ("UP", "DOWN") for b in bets)
```

**Step 2: Run test to verify it fails**

Run: `cd vision-bot && python -m pytest tests/test_registry.py -v`
Expected: FAIL

**Step 3: Write the implementation**

```python
# vision-bot/framework/registry.py
"""Strategy auto-discovery — imports all Strategy subclasses from strategies/ folder."""

import importlib
import logging
import pkgutil
from framework.strategy import Strategy

log = logging.getLogger("vision-bot.registry")

_registry: dict[str, type[Strategy]] = {}


def discover_strategies() -> dict[str, type[Strategy]]:
    """
    Import all modules in the strategies/ package and collect Strategy subclasses.
    Returns dict mapping strategy name -> class.
    """
    global _registry
    if _registry:
        return _registry

    import strategies
    for importer, modname, ispkg in pkgutil.iter_modules(strategies.__path__):
        try:
            module = importlib.import_module(f"strategies.{modname}")
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if (isinstance(attr, type) and issubclass(attr, Strategy)
                        and attr is not Strategy and getattr(attr, "name", "")):
                    _registry[attr.name] = attr
                    log.info("Discovered strategy: %s", attr.name)
        except Exception as e:
            log.warning("Failed to import strategies.%s: %s", modname, e)

    return _registry


def get_strategy(name: str) -> Strategy:
    """Get a strategy instance by name. Raises KeyError if not found."""
    strategies = discover_strategies()
    if name not in strategies:
        available = ", ".join(sorted(strategies.keys()))
        raise KeyError(f"Unknown strategy '{name}'. Available: {available}")
    return strategies[name]()
```

**Step 4: Run test to verify it passes**

Run: `cd vision-bot && python -m pytest tests/test_registry.py -v`
Expected: FAIL — `strategies` package doesn't exist yet. This is expected. We build it in Task 7.

**Step 5: Commit (test file only)**

```bash
git add vision-bot/framework/registry.py vision-bot/tests/test_registry.py
git commit -m "feat(vision-bot): add strategy auto-discovery registry"
```

---

## Task 7: RandomStrategy (`strategies/random_strategy.py`)

**Files:**
- Create: `vision-bot/strategies/__init__.py`
- Create: `vision-bot/strategies/random_strategy.py`
- Create: `vision-bot/tests/test_random_strategy.py`

**Step 1: Write the failing test**

```python
# vision-bot/tests/test_random_strategy.py
from strategies.random_strategy import RandomStrategy
from framework.types import BatchInfo, MarketData

def test_random_strategy_name():
    s = RandomStrategy()
    assert s.name == "random"

def test_random_strategy_returns_correct_count():
    s = RandomStrategy()
    batch = BatchInfo(id=1, market_ids=["a", "b", "c", "d", "e"],
                      market_count=5, tick_duration=60, paused=False)
    markets = [MarketData(asset_id=x, source="t", symbol=x, name=x, value=1.0)
               for x in batch.market_ids]
    bets = s.generate_bets(batch, markets)
    assert len(bets) == 5
    assert all(b in ("UP", "DOWN") for b in bets)

def test_random_strategy_should_join_not_paused():
    s = RandomStrategy()
    batch = BatchInfo(id=1, market_ids=[], market_count=0, tick_duration=60, paused=False)
    assert s.should_join(batch) is True

def test_random_strategy_should_not_join_paused():
    s = RandomStrategy()
    batch = BatchInfo(id=1, market_ids=[], market_count=0, tick_duration=60, paused=True)
    assert s.should_join(batch) is False
```

**Step 2: Run test to verify it fails**

Run: `cd vision-bot && python -m pytest tests/test_random_strategy.py -v`
Expected: FAIL

**Step 3: Write the implementation**

```python
# vision-bot/strategies/__init__.py
```

```python
# vision-bot/strategies/random_strategy.py
"""Random strategy — the default. Generates random UP/DOWN bets."""

import random
from framework.strategy import Strategy
from framework.types import BatchInfo, MarketData


class RandomStrategy(Strategy):
    name = "random"

    def generate_bets(self, batch: BatchInfo, markets: list[MarketData]) -> list[str]:
        return [random.choice(["UP", "DOWN"]) for _ in range(batch.market_count)]
```

**Step 4: Run test to verify it passes**

Run: `cd vision-bot && python -m pytest tests/test_random_strategy.py -v`
Expected: All 4 tests PASS

**Step 5: Also verify registry tests now pass**

Run: `cd vision-bot && python -m pytest tests/test_registry.py -v`
Expected: All 4 tests PASS

**Step 6: Commit**

```bash
git add vision-bot/strategies/__init__.py vision-bot/strategies/random_strategy.py vision-bot/tests/test_random_strategy.py
git commit -m "feat(vision-bot): add RandomStrategy (default) and verify registry discovery"
```

---

## Task 8: Momentum Strategy Example (`strategies/momentum.py`)

**Files:**
- Create: `vision-bot/strategies/momentum.py`
- Create: `vision-bot/tests/test_momentum.py`

**Step 1: Write the failing test**

```python
# vision-bot/tests/test_momentum.py
from strategies.momentum import MomentumStrategy
from framework.types import BatchInfo, MarketData

def test_momentum_name():
    s = MomentumStrategy()
    assert s.name == "momentum"

def test_momentum_bets_up_on_positive_change():
    s = MomentumStrategy()
    batch = BatchInfo(id=1, market_ids=["a", "b"], market_count=2,
                      tick_duration=60, paused=False)
    markets = [
        MarketData(asset_id="a", source="t", symbol="A", name="A", value=100, change_pct=5.0),
        MarketData(asset_id="b", source="t", symbol="B", name="B", value=50, change_pct=3.0),
    ]
    bets = s.generate_bets(batch, markets)
    assert bets == ["UP", "UP"]

def test_momentum_bets_down_on_negative_change():
    s = MomentumStrategy()
    batch = BatchInfo(id=1, market_ids=["a", "b"], market_count=2,
                      tick_duration=60, paused=False)
    markets = [
        MarketData(asset_id="a", source="t", symbol="A", name="A", value=100, change_pct=-2.0),
        MarketData(asset_id="b", source="t", symbol="B", name="B", value=50, change_pct=-0.5),
    ]
    bets = s.generate_bets(batch, markets)
    assert bets == ["DOWN", "DOWN"]

def test_momentum_defaults_up_on_no_data():
    s = MomentumStrategy()
    batch = BatchInfo(id=1, market_ids=["a"], market_count=1,
                      tick_duration=60, paused=False)
    markets = [
        MarketData(asset_id="a", source="t", symbol="A", name="A", value=100, change_pct=None),
    ]
    bets = s.generate_bets(batch, markets)
    assert bets == ["UP"]  # no data → default UP
```

**Step 2: Run test to verify it fails**

Run: `cd vision-bot && python -m pytest tests/test_momentum.py -v`
Expected: FAIL

**Step 3: Write the implementation**

```python
# vision-bot/strategies/momentum.py
"""Momentum strategy — bet in the direction of recent price change."""

from framework.strategy import Strategy
from framework.types import BatchInfo, MarketData


class MomentumStrategy(Strategy):
    """
    Simple momentum: if 24h change is positive → UP, negative → DOWN.
    No data → default UP (slight long bias).

    This is an example strategy to show how the framework works.
    """

    name = "momentum"

    def generate_bets(self, batch: BatchInfo, markets: list[MarketData]) -> list[str]:
        bets = []
        for m in markets:
            if m.change_pct is not None and m.change_pct < 0:
                bets.append("DOWN")
            else:
                bets.append("UP")
        return bets
```

**Step 4: Run test to verify it passes**

Run: `cd vision-bot && python -m pytest tests/test_momentum.py -v`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add vision-bot/strategies/momentum.py vision-bot/tests/test_momentum.py
git commit -m "feat(vision-bot): add MomentumStrategy example"
```

---

## Task 9: Rewrite `bot.py` to Use Framework

**Files:**
- Modify: `vision-bot/bot.py` (full rewrite — replace entire file)

**Step 1: Rewrite bot.py**

Replace the entire `vision-bot/bot.py` with:

```python
#!/usr/bin/env python3
"""
Vision Bot — Modular prediction strategy framework.

Usage:
    python3 bot.py [--once]           # Run once then exit
    python3 bot.py                    # Loop: poll for batches, join new ones

Environment:
    L3_RPC_URL              Chain RPC (default: http://localhost:8546)
    VISION_API_URL          Issuer Vision API (default: http://localhost:10001)
    DATA_NODE_URL           Data-node URL (default: http://localhost:8200)
    BOT_PRIVATE_KEY         Bot wallet private key (required)
    STRATEGY                Strategy name (default: random)
    DEPOSIT_AMOUNT          USDC deposit per batch (default: 10)
    STAKE_PER_TICK          USDC stake per tick (default: 1)
    POLL_INTERVAL           Seconds between polls (default: 30)
    MAX_CONCURRENT_BATCHES  Max active batches (default: 5)
    MAX_TOTAL_EXPOSURE      Max total USDC exposure (default: 100)
"""

import json
import os
import sys
import time
import logging

from framework.types import BatchInfo, encode_bitmap, hash_bitmap
from framework.data import DataSource
from framework.risk import RiskManager
from framework.executor import Executor
from framework.registry import get_strategy, discover_strategies

# ── Config ──────────────────────────────────────────────────────

L3_RPC_URL = os.environ.get("L3_RPC_URL", "http://localhost:8546")
VISION_API_URL = os.environ.get("VISION_API_URL", "http://localhost:10001")
DATA_NODE_URL = os.environ.get("DATA_NODE_URL", "http://localhost:8200")
BOT_PRIVATE_KEY = os.environ.get("BOT_PRIVATE_KEY", "")
STRATEGY_NAME = os.environ.get("STRATEGY", "random")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "30"))

DECIMALS = 6
MAX_BATCHES = int(os.environ.get("MAX_CONCURRENT_BATCHES", "5"))
MAX_EXPOSURE = int(os.environ.get("MAX_TOTAL_EXPOSURE", "100")) * (10 ** DECIMALS)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("vision-bot")


# ── Deployment ──────────────────────────────────────────────────

def load_deployment() -> dict:
    paths = [
        "deployments/active-deployment.json",
        "../deployments/active-deployment.json",
        os.path.join(os.path.dirname(__file__), "..", "deployments", "active-deployment.json"),
    ]
    for p in paths:
        if os.path.exists(p):
            with open(p) as f:
                return json.load(f)
    raise FileNotFoundError("Cannot find active-deployment.json")


# ── Main loop ───────────────────────────────────────────────────

def run_once(executor: Executor, strategy, data: DataSource, risk: RiskManager,
             joined: set[int]) -> bool:
    """Poll for batches and join using the active strategy. Returns True if joined one."""
    batches = executor.fetch_batches(VISION_API_URL)
    if not batches:
        log.info("No active batches found")
        return False

    for batch_raw in batches:
        batch_id = batch_raw.get("id", batch_raw.get("batch_id"))
        if batch_id is None:
            continue
        if batch_id in joined:
            continue

        # Build BatchInfo
        batch = BatchInfo(
            id=batch_id,
            market_ids=batch_raw.get("market_ids", []),
            market_count=batch_raw.get("market_count", 0),
            tick_duration=batch_raw.get("tick_duration", 0),
            paused=batch_raw.get("paused", False),
            creator=batch_raw.get("creator", ""),
            player_count=batch_raw.get("player_count", 0),
            tvl=batch_raw.get("tvl", 0),
        )

        # Strategy filter
        if not strategy.should_join(batch):
            log.info("Strategy '%s' skipping batch %d", strategy.name, batch_id)
            continue

        # Check if already joined on-chain
        try:
            pos = executor.get_position(batch_id)
            if pos.balance > 0:
                log.info("Already joined batch %d (balance: %d)", batch_id,
                         pos.balance // (10 ** DECIMALS))
                joined.add(batch_id)
                continue
        except Exception:
            pass

        # Get market count from chain if needed
        if batch.market_count == 0:
            try:
                batch.market_count = executor.get_batch_market_count(batch_id)
            except Exception:
                batch.market_count = len(batch.market_ids) or 10

        # Position sizing (strategy decides, risk checks)
        deposit, stake = strategy.position_size(batch)
        if not risk.can_join(deposit):
            log.info("Risk manager blocked batch %d", batch_id)
            continue

        # Balance check
        balance = executor.usdc_balance()
        if balance < deposit:
            log.warning("Insufficient USDC: have %d, need %d",
                        balance // (10 ** DECIMALS), deposit // (10 ** DECIMALS))
            continue

        # Fetch market data and generate bets
        data.refresh()
        markets = data.get_markets_for_batch(batch.market_ids)
        bets = strategy.generate_bets(batch, markets)

        # Encode and hash
        bitmap = encode_bitmap(bets, batch.market_count)
        bm_hash = hash_bitmap(bitmap)

        log.info("Batch %d: %d markets, %d UP / %d DOWN [strategy: %s]",
                 batch_id, batch.market_count, bets.count("UP"), bets.count("DOWN"),
                 strategy.name)

        # Execute on-chain
        executor.approve_usdc(deposit)
        executor.join_batch(batch_id, deposit, stake, bm_hash)

        # Wait for indexer, then submit bitmap
        log.info("Waiting 6s for chain indexer...")
        time.sleep(6)
        executor.submit_bitmap(batch_id, bitmap, bm_hash)

        # Record
        joined.add(batch_id)
        risk.record_join(batch_id, deposit)

        # Verify
        try:
            pos = executor.get_position(batch_id)
            log.info("Position verified — balance: %d USDC, stake/tick: %d USDC",
                     pos.balance // (10 ** DECIMALS), pos.stake_per_tick // (10 ** DECIMALS))
        except Exception:
            pass

        return True

    log.info("No new batches to join")
    return False


def main():
    # Discover strategies
    available = discover_strategies()
    log.info("Available strategies: %s", ", ".join(sorted(available.keys())))

    strategy = get_strategy(STRATEGY_NAME)
    log.info("Active strategy: %s", strategy.name)

    # Load deployment
    deploy = load_deployment()
    vision_addr = deploy["contracts"]["Vision"]
    usdc_addr = deploy["contracts"]["ARB_USDC"]

    # Initialize components
    executor = Executor(
        rpc_url=L3_RPC_URL,
        vision_addr=vision_addr,
        usdc_addr=usdc_addr,
        private_key=BOT_PRIVATE_KEY,
        issuer_urls=[
            "http://localhost:10001",
            "http://localhost:10002",
            "http://localhost:10003",
        ],
    )

    data = DataSource(data_node_url=DATA_NODE_URL)
    risk = RiskManager(max_concurrent_batches=MAX_BATCHES, max_total_exposure=MAX_EXPOSURE)
    joined: set[int] = set()

    log.info("Vision Bot starting")
    log.info("  Bot address:  %s", executor.bot_addr)
    log.info("  L3 RPC:       %s", L3_RPC_URL)
    log.info("  Vision API:   %s", VISION_API_URL)
    log.info("  Data Node:    %s", DATA_NODE_URL)

    # Connectivity check
    try:
        chain_id = executor.w3.eth.chain_id
        log.info("  Chain ID:     %d", chain_id)
    except Exception as e:
        log.error("Cannot connect to RPC: %s", e)
        sys.exit(1)

    # Balance check
    balance = executor.usdc_balance()
    log.info("  USDC balance: %d", balance // (10 ** DECIMALS))

    # Register bot
    executor.register_bot()

    once = "--once" in sys.argv

    if once:
        success = run_once(executor, strategy, data, risk, joined)
        sys.exit(0 if success else 1)

    while True:
        try:
            run_once(executor, strategy, data, risk, joined)
        except Exception as e:
            log.error("Error in poll cycle: %s", e)
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
```

**Step 2: Run all tests**

Run: `cd vision-bot && python -m pytest tests/ -v`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add vision-bot/bot.py
git commit -m "refactor(vision-bot): rewrite bot.py to use modular strategy framework"
```

---

## Task 10: Run Full Test Suite and Verify

**Step 1: Run all tests**

Run: `cd vision-bot && python -m pytest tests/ -v --tb=short`
Expected: All tests PASS (types: 8, strategy: 5, data: 4, risk: 6, executor: 2, registry: 4, random: 4, momentum: 4 = **37 tests**)

**Step 2: Verify strategy discovery**

Run: `cd vision-bot && python -c "from framework.registry import discover_strategies; print(discover_strategies())"`
Expected: `{'random': <class 'RandomStrategy'>, 'momentum': <class 'MomentumStrategy'>}`

**Step 3: Final commit with any fixes**

Only if needed.

---

## Quick Reference: How to Add a Strategy

After this framework is built, adding a new strategy is 3 steps:

1. **Create file** in `vision-bot/strategies/my_strat.py`
2. **Subclass Strategy**, set `name`, implement `generate_bets()`
3. **Run** with `STRATEGY=my_strat python3 bot.py`

### Available hooks (all optional except `generate_bets`):

| Method | Purpose | Default |
|--------|---------|---------|
| `generate_bets(batch, markets)` | Return `["UP","DOWN",...]` | **required** |
| `should_join(batch)` | Filter which batches to join | `not batch.paused` |
| `position_size(batch)` | `(deposit_wei, stake_wei)` | From env vars |

### Available data in `markets: list[MarketData]`:

| Field | Type | Source |
|-------|------|--------|
| `asset_id` | str | data-node |
| `symbol` | str | data-node |
| `value` | float | Latest price |
| `change_pct` | float? | 24h % change |
| `volume_24h` | float? | 24h volume |
| `market_cap` | float? | Market cap |
| `category` | str? | Asset category |
