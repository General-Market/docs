import random

from framework.core import Strategy


class HomeFieldStrategy(Strategy):
    """Sports-specific: bet UP on home team metrics, DOWN on away."""
    name = "home_field"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = random.Random()

    def predict(self, markets):
        results = []
        for m in markets:
            mid = (m.get("id") or "").lower()
            if "home" in mid:
                results.append("UP")
            elif "away" in mid:
                results.append("DOWN")
            else:
                c = m.get("change")
                if c is None or c == 0:
                    results.append(self._rng.choice(["UP", "DOWN"]))
                else:
                    results.append("UP" if c > 0 else "DOWN")
        return results
