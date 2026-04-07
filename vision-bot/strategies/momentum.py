from framework.core import Strategy, make_strategy_rng


class MomentumStrategy(Strategy):
    """Pure momentum — follow the trend. Supports min_change_pct param."""
    name = "momentum"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)

    def predict(self, markets):
        threshold = self.params.get("min_change_pct", 0)
        results = []
        for m in markets:
            change = m.get("change")
            if change is None:
                # No data — coin flip is the only honest answer.
                results.append(self._rng.choice(["UP", "DOWN"]))
            elif change == 0.0:
                # Zero change is data, not absence. Bias toward DOWN —
                # nothing moved, the absence of movement is the prediction.
                results.append("DOWN")
            elif threshold and abs(change) < threshold:
                results.append(self._rng.choice(["UP", "DOWN"]))
            elif change > 0:
                results.append("UP")
            else:
                results.append("DOWN")
        return results


class MomentumNoiseStrategy(Strategy):
    """Momentum + 10% random flips."""
    name = "momentum_noise"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)

    def predict(self, markets):
        out = []
        for m in markets:
            change = m.get("change")
            if change is None:
                d = self._rng.choice(["UP", "DOWN"])
            elif change == 0.0:
                d = "DOWN"
            else:
                d = "UP" if change > 0 else "DOWN"
            if self._rng.random() < 0.10:
                d = "DOWN" if d == "UP" else "UP"
            out.append(d)
        return out


class MomentumThresholdStrategy(Strategy):
    """Momentum only when move > 1%, coin flip otherwise."""
    name = "momentum_threshold"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)

    def predict(self, markets):
        results = []
        for m in markets:
            change = m.get("change")
            if change is None:
                results.append(self._rng.choice(["UP", "DOWN"]))
            elif change == 0.0:
                results.append("DOWN")
            elif abs(change) > 1.0:
                results.append("UP" if change > 0 else "DOWN")
            else:
                results.append(self._rng.choice(["UP", "DOWN"]))
        return results
