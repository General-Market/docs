"""Regime detection — trends persist until they don't.

Macro data, energy prices, stock indices, interest rates.
When the world picks a direction, it keeps walking that way
until something breaks. Then it picks a new one.
"""

import logging
import random

from framework.core import Strategy

log = logging.getLogger(__name__)


class RegimeStrategy(Strategy):
    """Bet that the current regime persists.

    Count consecutive same-direction ticks from history.
    If N+ ticks in the same direction -> momentum (regime holds).
    If the direction just flipped -> momentum on the NEW direction.
    The regime is the message. The flip is the message too.
    """

    name = "regime"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = random.Random()

    def predict(self, markets):
        """Fallback: momentum (coin flip when change is None or 0)."""
        results = []
        for m in markets:
            c = m.get("change")
            if c is None or c == 0:
                results.append(self._rng.choice(["UP", "DOWN"]))
            else:
                results.append("UP" if c > 0 else "DOWN")
        return results

    def predict_with_context(self, markets, feed=None, batch_id=None):
        if not feed or not batch_id:
            return self.predict(markets)

        threshold = self.params.get("regime_threshold", 3)
        results = []

        for m in markets:
            asset_id = m.get("id", "")
            history = feed.history(batch_id, asset_id)

            if len(history) < 2:
                c = m.get("change")
                if c is None or c == 0:
                    results.append(self._rng.choice(["UP", "DOWN"]))
                else:
                    results.append("UP" if c > 0 else "DOWN")
                continue

            # Count consecutive direction from the tail of history
            directions = []
            for h in history:
                cp = h.get("change_pct")
                if cp is not None:
                    directions.append("UP" if cp >= 0 else "DOWN")

            if not directions:
                results.append(self._rng.choice(["UP", "DOWN"]))
                continue

            # Walk backward from the end, count consecutive same direction
            last_dir = directions[-1]
            streak = 0
            for d in reversed(directions):
                if d == last_dir:
                    streak += 1
                else:
                    break

            if streak >= threshold:
                # Regime established — follow it
                results.append(last_dir)
            else:
                # Recent flip or no regime — follow the newest direction
                results.append(last_dir)

        return results
