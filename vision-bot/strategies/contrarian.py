from framework.core import Strategy, make_strategy_rng


class ContrarianStrategy(Strategy):
    """Fade the trend. Supports min_change_pct param."""
    name = "contrarian"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)

    def predict(self, markets):
        threshold = self.params.get("min_change_pct", 0)
        results = []
        for m in markets:
            change = m.get("change")
            if change is None:
                results.append(self._rng.choice(["UP", "DOWN"]))
            elif change == 0.0:
                # Zero change: contrarian's neutral default. The trend is
                # nothing — the fade of nothing is also nothing — DOWN.
                results.append("DOWN")
            elif threshold and abs(change) < threshold:
                results.append(self._rng.choice(["UP", "DOWN"]))
            elif change > 0:
                results.append("DOWN")
            else:
                results.append("UP")
        return results
