import random

from framework.core import Strategy


class BullishStrategy(Strategy):
    name = "bullish"

    def predict(self, markets):
        return [random.choice(["UP", "UP", "UP", "DOWN"]) for _ in markets]


class BearishStrategy(Strategy):
    name = "bearish"

    def predict(self, markets):
        return [random.choice(["UP", "DOWN", "DOWN", "DOWN"]) for _ in markets]
