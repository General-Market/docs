from framework.core import Strategy, make_strategy_rng


class RandomStrategy(Strategy):
    name = "random"

    def __init__(self, params=None):
        super().__init__(params)
        # Per-strategy RNG seeded from BOT_PRIVATE_KEY via keccak256.
        # Reproducible across restarts. Not brute-forceable from a few bitmaps.
        self._rng = make_strategy_rng(self.name)

    def predict(self, markets):
        return [self._rng.choice(["UP", "DOWN"]) for _ in markets]
