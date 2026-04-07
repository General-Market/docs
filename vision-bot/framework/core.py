"""
Core framework primitives for Vision bots.

Provides bitmap encoding/hashing, the Strategy ABC, risk management,
and dynamic strategy loading.
"""

from abc import ABC
import importlib
import os
import pkgutil
import random

from web3 import Web3


# ── Bitmap helpers ───────────────────────────────────────────────

# Fixed bitmap ceiling. The bot fetches market_count at time T; the oracle
# may record market_count = T+1 by the time the join lands. An exact-length
# bitmap loses that race and the join is rejected. A padded bitmap does not.
#
# 1024 bytes covers 8192 markets. No source approaches this in any horizon
# we will live to see. The on-chain commitment is keccak256(padded_bytes);
# the oracle's resolver iterates only [0, market_count), so trailing zero
# bits are inert. The hash and the submitted bytes match exactly because
# both sides handle the same padded buffer.
MAX_BITMAP_BYTES = 1024
MAX_BITMAP_BITS = MAX_BITMAP_BYTES * 8


def encode_bitmap(bets: list[str], count: int) -> bytes:
    """["UP","DOWN",...] -> packed bytes, padded to MAX_BITMAP_BYTES.

    1=UP, 0=DOWN, big-endian. The buffer is always MAX_BITMAP_BYTES long
    so the on-chain commitment survives the inevitable race with the
    oracle's view of market_count. Trailing zero bits are inert — the
    resolver only walks [0, market_count).

    Raises ValueError if bets is shorter than count — a short bitmap
    means uncovered markets, concentrated risk, and silent losses.

    Raises ValueError if count exceeds MAX_BITMAP_BITS — the ceiling
    must rise before the world does.
    """
    if len(bets) < count:
        raise ValueError(
            f"Bitmap underflow: {len(bets)} bets for {count} markets. "
            f"Refusing to encode — a short bitmap is a quiet catastrophe."
        )
    if count > MAX_BITMAP_BITS:
        raise ValueError(
            f"Bitmap overflow: {count} markets exceeds ceiling of "
            f"{MAX_BITMAP_BITS}. Raise MAX_BITMAP_BYTES before the bot "
            f"silently truncates the world."
        )
    bitmap = bytearray(MAX_BITMAP_BYTES)
    for i in range(count):
        if bets[i] == "UP":
            byte_idx = i // 8
            bit_idx = 7 - (i % 8)
            bitmap[byte_idx] |= 1 << bit_idx
    return bytes(bitmap)


def hash_bitmap(bitmap: bytes) -> bytes:
    """keccak256 of bitmap. Hashes whatever bytes you give it; pad first."""
    return Web3.keccak(bitmap)


# ── Strategy RNG ─────────────────────────────────────────────────


def make_strategy_rng(strategy_name: str) -> random.Random:
    """Return a per-strategy RNG seeded from BOT_PRIVATE_KEY + strategy_name.

    The seed is keccak256(private_key_bytes || strategy_name_bytes), passed
    to random.Random as a full 256-bit integer. Python's Mersenne Twister
    accepts arbitrary integer seeds and uses every bit it is given.

    The previous derivation truncated to 32 bits — a search space an
    adversary watching a few bitmaps could exhaust before lunch. The
    private key would not leak, but the bitmap stream would. Predicting
    a bot's bets is a good way to drain a bot.

    If BOT_PRIVATE_KEY is unset, falls back to os.urandom(32). The bot
    that runs without a key is a bot that runs without a memory; that is
    a separate problem this helper does not pretend to solve.
    """
    pk_hex = os.environ.get("BOT_PRIVATE_KEY", "")
    if pk_hex:
        pk_bytes = bytes.fromhex(pk_hex.removeprefix("0x"))
    else:
        pk_bytes = os.urandom(32)
    seed_bytes = Web3.keccak(pk_bytes + strategy_name.encode("utf-8"))
    seed_int = int.from_bytes(seed_bytes, "big")
    return random.Random(seed_int)


# ── Strategy ABC ─────────────────────────────────────────────────


class Strategy(ABC):
    """Base class for all Vision prediction strategies.

    Subclasses MUST implement at least one of `predict` or
    `predict_with_context`. The canonical entry point is
    `predict_with_context` — callers should always invoke that. Its
    default body delegates to `predict`, so simple strategies only need
    `predict`; history-aware strategies override `predict_with_context`
    and may ignore `predict` entirely.
    """

    name: str = ""

    def __init__(self, params: dict = None):
        self.params = params or {}

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

        Default raises NotImplementedError. Override this OR
        `predict_with_context`. Implementing neither is a strategy
        that has nothing to say; refuse it loudly.
        """
        raise NotImplementedError(
            f"Strategy {type(self).__name__} implements neither "
            f"predict() nor predict_with_context()."
        )

    def predict_with_context(
        self, markets: list[dict], feed=None, batch_id=None,
    ) -> list[str]:
        """Canonical strategy hook. Override for history-aware strategies.

        Default: ignore context, delegate to predict().
        """
        return self.predict(markets)


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


def load_strategy(name: str, params: dict = None) -> Strategy:
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
                return cls(params=params)
    raise ValueError(f"Unknown strategy: {name}")


# ── Config loader ─────────────────────────────────────────────


def load_config(path=None):
    """Load config.toml, merge with env var overrides. Returns flat dict."""
    defaults = {
        "strategy": "random",
        "deposit": 10.0,
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
    # Vault mode defaults
    defaults["vault_mode"] = False
    defaults["vault_address"] = ""
    defaults["vault_factory_address"] = ""
    defaults["vault_name"] = "Vision Bot Fund"
    defaults["vault_symbol"] = "vbFUND"
    defaults["vault_perf_fee"] = 2000
    defaults["vault_seed_deposit"] = 100.0
    defaults["vault_auto_reconcile"] = True

    # Try TOML parsing
    for p in [path, "config.toml", "../config.toml"]:
        if p and os.path.exists(p):
            try:
                try:
                    import tomllib
                except ImportError:
                    import tomli as tomllib  # type: ignore[no-redef]
                with open(p, "rb") as f:
                    raw = tomllib.load(f)
                # Flatten [vault] section into top-level vault_* keys
                vault_section = raw.pop("vault", {})
                if vault_section:
                    _vault_key_map = {
                        "enabled": "vault_mode",
                        "factory_address": "vault_factory_address",
                        "vault_address": "vault_address",
                        "name": "vault_name",
                        "symbol": "vault_symbol",
                        "perf_fee": "vault_perf_fee",
                        "seed_deposit": "vault_seed_deposit",
                        "auto_reconcile": "vault_auto_reconcile",
                    }
                    for toml_key, cfg_key in _vault_key_map.items():
                        if toml_key in vault_section:
                            defaults[cfg_key] = vault_section[toml_key]
                defaults.update(raw)
            except ImportError:
                pass  # no TOML parser, rely on defaults + env vars
            break
    # Env var overrides
    env_map = {
        "STRATEGY": "strategy",
        "DEPOSIT_AMOUNT": "deposit",
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
            try:
                if default_type == bool:
                    defaults[conf_key] = val.lower() in ("true", "1", "yes")
                elif default_type == float:
                    defaults[conf_key] = float(val)
                elif default_type == int:
                    defaults[conf_key] = int(float(val))
                else:
                    defaults[conf_key] = val
            except (ValueError, TypeError):
                # Bad input survives the bot. The default holds. A
                # crash on startup over a typo is the least dignified
                # death a long-running process can suffer.
                pass
    # ORACLE_URLS: comma-separated list of URLs
    if "ORACLE_URLS" in os.environ:
        defaults["oracle_urls"] = [u.strip() for u in os.environ["ORACLE_URLS"].split(",") if u.strip()]
    # BATCH_IDS: comma-separated list of ints
    if "BATCH_IDS" in os.environ:
        try:
            defaults["batch_ids"] = [
                int(x.strip())
                for x in os.environ["BATCH_IDS"].split(",")
                if x.strip()
            ]
        except (ValueError, TypeError):
            defaults["batch_ids"] = []
    # MIN_BATCH_ID: skip batches below this ID (useful after redeployments)
    defaults["min_batch_id"] = 0
    if "MIN_BATCH_ID" in os.environ:
        try:
            defaults["min_batch_id"] = int(os.environ["MIN_BATCH_ID"])
        except (ValueError, TypeError):
            pass
    # Vault env var overrides
    vault_env_map = {
        "VAULT_MODE": ("vault_mode", bool),
        "VAULT_ADDRESS": ("vault_address", str),
        "VAULT_FACTORY_ADDRESS": ("vault_factory_address", str),
        "VAULT_NAME": ("vault_name", str),
        "VAULT_SYMBOL": ("vault_symbol", str),
        "VAULT_PERF_FEE": ("vault_perf_fee", int),
        "VAULT_SEED_DEPOSIT": ("vault_seed_deposit", float),
        "VAULT_AUTO_RECONCILE": ("vault_auto_reconcile", bool),
    }
    for env_key, (conf_key, typ) in vault_env_map.items():
        if env_key in os.environ:
            val = os.environ[env_key]
            try:
                if typ == bool:
                    defaults[conf_key] = val.lower() in ("true", "1", "yes")
                elif typ == float:
                    defaults[conf_key] = float(val)
                elif typ == int:
                    defaults[conf_key] = int(float(val))
                else:
                    defaults[conf_key] = val
            except (ValueError, TypeError):
                pass
    return defaults
