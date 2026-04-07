from framework.core import Strategy, make_strategy_rng


class BullishStrategy(Strategy):
    name = "bullish"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)

    def predict(self, markets):
        return [self._rng.choice(["UP", "UP", "UP", "DOWN"]) for _ in markets]


class BearishStrategy(Strategy):
    name = "bearish"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)

    def predict(self, markets):
        return [self._rng.choice(["UP", "DOWN", "DOWN", "DOWN"]) for _ in markets]
