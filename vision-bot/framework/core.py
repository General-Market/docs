"""
Core framework primitives for Vision bots.

Provides bitmap encoding/hashing, the Strategy ABC, risk management,
and dynamic strategy loading.
"""

from abc import ABC, abstractmethod
import importlib
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
