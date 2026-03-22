"""
Core framework primitives for Vision bots.

Provides bitmap encoding/hashing, the Strategy ABC, risk management,
and dynamic strategy loading.
"""

from abc import ABC, abstractmethod
import importlib
import os
import pkgutil

from web3 import Web3


# ── Bitmap helpers ───────────────────────────────────────────────


def encode_bitmap(bets: list[str], count: int) -> bytes:
    """["UP","DOWN",...] -> packed bytes. 1=UP, 0=DOWN, big-endian."""
    byte_count = (count + 7) // 8
    bitmap = bytearray(byte_count)
    for i in range(count):
        if i < len(bets) and bets[i] == "UP":
            byte_idx = i // 8
            bit_idx = 7 - (i % 8)
            bitmap[byte_idx] |= 1 << bit_idx
    return bytes(bitmap)


def hash_bitmap(bitmap: bytes) -> bytes:
    """keccak256 of bitmap."""
    return Web3.keccak(bitmap)


# ── Strategy ABC ─────────────────────────────────────────────────


class Strategy(ABC):
    """Base class for all Vision prediction strategies."""

    name: str = ""

    @abstractmethod
    def predict(self, markets: list[dict]) -> list[str]:
        """
        Given market data, return UP/DOWN for each.

        markets[i] = {
            "id": str,
            "price": float,
            "change": float | None,
            "volume": float | None,
            "market_cap": float | None,
        }

        Return: ["UP", "DOWN", "UP", ...] -- one per market.
        """
        ...


# ── Risk management ──────────────────────────────────────────────


class RiskCheck:
    """Simple exposure tracker."""

    def __init__(self, max_batches: int, max_exposure: int):
        self._max_batches = max_batches
        self._max_exposure = max_exposure
        self._active: dict[int, int] = {}  # batch_id -> deposit_wei

    def can_join(self, deposit: int) -> bool:
        if len(self._active) >= self._max_batches:
            return False
        if sum(self._active.values()) + deposit > self._max_exposure:
            return False
        return True

    def record_join(self, batch_id: int, deposit: int):
        self._active[batch_id] = deposit

    def record_exit(self, batch_id: int):
        self._active.pop(batch_id, None)

    @property
    def active_count(self) -> int:
        return len(self._active)

    @property
    def active_ids(self) -> set[int]:
        return set(self._active.keys())


# ── Dynamic strategy loader ──────────────────────────────────────


def load_strategy(name: str) -> Strategy:
    """Import all modules in strategies/, find the one with matching name."""
    import strategies

    for _importer, modname, _ispkg in pkgutil.iter_modules(strategies.__path__):
        mod = importlib.import_module(f"strategies.{modname}")
        for attr in dir(mod):
            cls = getattr(mod, attr)
            if (
                isinstance(cls, type)
                and issubclass(cls, Strategy)
                and cls is not Strategy
                and getattr(cls, "name", "") == name
            ):
                return cls()
    raise ValueError(f"Unknown strategy: {name}")


# ── Config loader ─────────────────────────────────────────────


def load_config(path=None):
    """Load config.toml, merge with env var overrides. Returns flat dict."""
    defaults = {
        "strategy": "random",
        "deposit": 10.0,
        "stake": 1.0,
        "max_batches": 50,
        "max_exposure": 1000,
        "poll_interval": 30,
        "auto_claim": True,
        "auto_withdraw": True,
        "claim_above": 5,
        "withdraw_below": 2,
        "rpc_url": "http://localhost:8545",
        "vision_api": "http://localhost:10001",
        "data_node": "http://localhost:8200",
        "oracle_discovery": "static",
        "oracle_urls": ["http://localhost:10001", "http://localhost:10002", "http://localhost:10003"],
        "pnl_file": "pnl.json",
        "batch_ids": [],  # empty = join any, e.g. [1, 3, 7]
    }
    # Try TOML parsing
    for p in [path, "config.toml", "../config.toml"]:
        if p and os.path.exists(p):
            try:
                try:
                    import tomllib
                except ImportError:
                    import tomli as tomllib  # type: ignore[no-redef]
                with open(p, "rb") as f:
                    defaults.update(tomllib.load(f))
            except ImportError:
                pass  # no TOML parser, rely on defaults + env vars
            break
    # Env var overrides
    env_map = {
        "STRATEGY": "strategy",
        "DEPOSIT_AMOUNT": "deposit",
        "STAKE_PER_TICK": "stake",
        "MAX_BATCHES": "max_batches",
        "MAX_EXPOSURE": "max_exposure",
        "POLL_INTERVAL": "poll_interval",
        "L3_RPC_URL": "rpc_url",
        "VISION_API_URL": "vision_api",
        "DATA_NODE_URL": "data_node",
        "PNL_FILE": "pnl_file",
        "ORACLE_DISCOVERY": "oracle_discovery",
    }
    for env_key, conf_key in env_map.items():
        if env_key in os.environ:
            val = os.environ[env_key]
            default_type = type(defaults[conf_key])
            if default_type == bool:
                defaults[conf_key] = val.lower() in ("true", "1", "yes")
            elif default_type == float:
                defaults[conf_key] = float(val)
            elif default_type == int:
                defaults[conf_key] = int(float(val))
            else:
                defaults[conf_key] = val
    # ORACLE_URLS: comma-separated list of URLs
    if "ORACLE_URLS" in os.environ:
        defaults["oracle_urls"] = [u.strip() for u in os.environ["ORACLE_URLS"].split(",") if u.strip()]
    # BATCH_IDS: comma-separated list of ints
    if "BATCH_IDS" in os.environ:
        defaults["batch_ids"] = [int(x.strip()) for x in os.environ["BATCH_IDS"].split(",") if x.strip()]
    # MIN_BATCH_ID: skip batches below this ID (useful after redeployments)
    if "MIN_BATCH_ID" in os.environ:
        defaults["min_batch_id"] = int(os.environ["MIN_BATCH_ID"])
    else:
        defaults["min_batch_id"] = 0
    return defaults
