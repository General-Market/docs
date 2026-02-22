import random

from framework.core import Strategy


class RandomStrategy(Strategy):
    name = "random"

    def predict(self, markets):
        return [random.choice(["UP", "DOWN"]) for _ in markets]
