import hashlib
import os
import random

from framework.core import Strategy


class RandomStrategy(Strategy):
    name = "random"

    def __init__(self, params=None):
        super().__init__(params)
        # Seed per-bot using the private key so bots starting within seconds
        # of each other on the same machine produce different bitmaps.
        key = os.environ.get("BOT_PRIVATE_KEY", str(id(self)))
        seed = int(hashlib.sha256(key.encode()).hexdigest(), 16) % (2**32)
        self._rng = random.Random(seed)

    def predict(self, markets):
        return [self._rng.choice(["UP", "DOWN"]) for _ in markets]
