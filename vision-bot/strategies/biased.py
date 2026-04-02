import hashlib
import os
import random

from framework.core import Strategy


def _bot_rng(salt: str) -> random.Random:
    """Deterministic RNG seeded from private key + a salt string."""
    key = os.environ.get("BOT_PRIVATE_KEY", str(os.getpid()))
    seed = int(hashlib.sha256(f"{key}:{salt}".encode()).hexdigest(), 16) % (2**32)
    return random.Random(seed)


class BullishStrategy(Strategy):
    name = "bullish"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = _bot_rng("bullish")

    def predict(self, markets):
        return [self._rng.choice(["UP", "UP", "UP", "DOWN"]) for _ in markets]


class BearishStrategy(Strategy):
    name = "bearish"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = _bot_rng("bearish")

    def predict(self, markets):
        return [self._rng.choice(["UP", "DOWN", "DOWN", "DOWN"]) for _ in markets]
