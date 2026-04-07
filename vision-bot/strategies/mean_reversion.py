"""Mean reversion — for data that orbits a center of gravity.

Weather, air quality, transit disruptions, tides, sensor readings.
Things that wander but always return. The strategy simply trusts the average.
"""

import logging

from framework.core import Strategy, make_strategy_rng

log = logging.getLogger(__name__)


class MeanReversionStrategy(Strategy):
    """Bet against deviation from the rolling mean.

    Price above mean -> DOWN (revert down).
    Price below mean -> UP (revert up).
    The wider the gap, the more confident the reversion.
    """

    name = "mean_reversion"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)

    def predict(self, markets):
        """Fallback without history: simple contrarian on last change."""
        results = []
        for m in markets:
            c = m.get("change")
            if c is None:
                results.append(self._rng.choice(["UP", "DOWN"]))
            elif c == 0.0:
                # Zero change: nothing to revert toward. Default DOWN.
                results.append("DOWN")
            else:
                results.append("DOWN" if c > 0 else "UP")
        return results

    def predict_with_context(self, markets, feed=None, batch_id=None):
        if not feed or not batch_id:
            return self.predict(markets)

        lookback = self.params.get("lookback_ticks", 10)
        sensitivity = self.params.get("sensitivity", 1.0)
        results = []

        for m in markets:
            asset_id = m.get("id", "")
            history = feed.history(batch_id, asset_id)

            if len(history) < 3:
                c = m.get("change")
                if c is None:
                    results.append(self._rng.choice(["UP", "DOWN"]))
                elif c == 0.0:
                    results.append("DOWN")
                else:
                    results.append("DOWN" if c > 0 else "UP")
                continue

            recent = history[-lookback:]
            prices = [h["price"] for h in recent if h.get("price")]
            if not prices:
                results.append(self._rng.choice(["UP", "DOWN"]))
                continue

            mean = sum(prices) / len(prices)
            current = m.get("price") or prices[-1]
            deviation = (current - mean) / mean if mean else 0

            if abs(deviation) < 0.001 / sensitivity:
                # Too close to mean — coin flip
                results.append(self._rng.choice(["UP", "DOWN"]))
            elif deviation > 0:
                results.append("DOWN")
            else:
                results.append("UP")

        return results
