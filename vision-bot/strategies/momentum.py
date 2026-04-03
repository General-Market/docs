import hashlib
import os
import random

from framework.core import Strategy


def _rng(salt: str) -> random.Random:
    key = os.environ.get("BOT_PRIVATE_KEY", str(os.getpid()))
    seed = int(hashlib.sha256(f"{key}:{salt}".encode()).hexdigest(), 16) % (2**32)
    return random.Random(seed)


class MomentumStrategy(Strategy):
    """Pure momentum — follow the trend. Supports min_change_pct param."""
    name = "momentum"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = _rng("momentum")

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
                results.append("UP")
            elif change < 0:
                results.append("DOWN")
            else:
                results.append(self._rng.choice(["UP", "DOWN"]))
        return results


class MomentumNoiseStrategy(Strategy):
    """Momentum + 10% random flips."""
    name = "momentum_noise"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = _rng("noise")

    def predict(self, markets):
        out = []
        for m in markets:
            change = m.get("change")
            if change is None or change == 0:
                d = self._rng.choice(["UP", "DOWN"])
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
        self._rng = _rng("thresh")

    def predict(self, markets):
        results = []
        for m in markets:
            change = m.get("change")
            if change is None:
                results.append(self._rng.choice(["UP", "DOWN"]))
            elif abs(change) > 1.0:
                results.append("UP" if change > 0 else "DOWN")
            else:
                results.append(self._rng.choice(["UP", "DOWN"]))
        return results
