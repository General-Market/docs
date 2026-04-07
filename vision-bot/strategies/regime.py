"""Regime detection — conditional contrarian.

Macro data, energy prices, stock indices, interest rates.
When the world picks a direction, it keeps walking that way
until something breaks. Then it picks a new one.

With rich history, detect regime via consecutive-direction streaks.
With thin history, infer the regime from move magnitude:
  - Large move (abs > 3%) = trending regime -> follow momentum direction
  - Small move (abs < 3%) = mean-reverting regime -> bet OPPOSITE (contrarian)

This diverges from momentum, which always follows sign.
Regime cares about whether the market is trending or reverting.
"""

import logging

from framework.core import Strategy, make_strategy_rng

log = logging.getLogger(__name__)

# Above this absolute change, assume a trending regime (follow direction).
# Below it, assume mean-reversion (oppose direction).
TRENDING_THRESHOLD_PCT = 3.0


class RegimeStrategy(Strategy):
    """Conditional contrarian — contrarian in quiet markets, momentum in volatile ones.

    Diverges from momentum: a small positive change triggers DOWN (mean-reversion),
    a small negative change triggers UP. Only large moves align with momentum.
    """

    name = "regime"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)
        self._trending_pct = (params or {}).get(
            "trending_threshold_pct", TRENDING_THRESHOLD_PCT,
        )

    def _regime_signal(self, change):
        """Infer regime from a single change value.

        Returns the same direction for large moves (trending regime),
        opposite direction for small moves (mean-reverting regime).
        Momentum says UP for change=+1%. Regime says DOWN — quiet market reverts.
        """
        if change is None:
            return self._rng.choice(["UP", "DOWN"])
        if change == 0.0:
            # Zero change: a regime of stillness. DOWN.
            return "DOWN"

        if abs(change) >= self._trending_pct:
            # Large move — trending regime, follow direction
            return "UP" if change > 0 else "DOWN"
        else:
            # Small move — mean-reverting regime, oppose direction
            return "DOWN" if change > 0 else "UP"

    def predict(self, markets):
        """Regime inference from change magnitude alone. Never momentum."""
        return [self._regime_signal(m.get("change")) for m in markets]

    def predict_with_context(self, markets, feed=None, batch_id=None):
        if not feed or not batch_id:
            return self.predict(markets)

        threshold = self.params.get("regime_threshold", 3)
        results = []

        for m in markets:
            asset_id = m.get("id", "")
            history = feed.history(batch_id, asset_id)

            if len(history) < 2:
                results.append(self._regime_signal(m.get("change")))
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
                # No regime — coin flip. The market hasn't picked a side yet,
                # and following the most recent flip is just lag in disguise.
                results.append(self._rng.choice(["UP", "DOWN"]))

        return results
