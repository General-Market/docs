import random

from framework.core import Strategy


class ContrarianStrategy(Strategy):
    """Fade the trend. Supports min_change_pct param."""
    name = "contrarian"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = random.Random()

    def predict(self, markets):
        threshold = self.params.get("min_change_pct", 0)
        results = []
        for m in markets:
            change = m.get("change")
            if change is None:
                results.append(self._rng.choice(["UP", "DOWN"]))
            elif threshold and abs(change) < threshold:
                results.append(self._rng.choice(["UP", "DOWN"]))
            elif change > 0:
                results.append("DOWN")
            elif change < 0:
                results.append("UP")
            else:
                results.append(self._rng.choice(["UP", "DOWN"]))
        return results
