"""Cluster detection — for episodic, bursty phenomena.

Earthquakes, weather alerts, power outages, security incidents.
Events that arrive in swarms: one tremor begets another,
one outage reveals the fragility of the next substation.
"""

import logging
import random

from framework.core import Strategy

log = logging.getLogger(__name__)


class ClusterStrategy(Strategy):
    """Bet on event clustering.

    High recent activity -> momentum (more events incoming).
    Low recent activity -> bearish (calm persists).
    Measures the fraction of recent ticks that showed non-zero change.
    """

    name = "cluster"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = random.Random()

    def predict(self, markets):
        """Fallback: momentum on last tick (coin flip when change is None or 0)."""
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

        lookback = self.params.get("lookback_ticks", 10)
        activity_threshold = self.params.get("activity_threshold", 0.5)
        results = []

        for m in markets:
            asset_id = m.get("id", "")
            history = feed.history(batch_id, asset_id)

            if len(history) < 3:
                c = m.get("change")
                if c is None or c == 0:
                    results.append(self._rng.choice(["UP", "DOWN"]))
                else:
                    results.append("UP" if c > 0 else "DOWN")
                continue

            recent = history[-lookback:]
            active_ticks = sum(
                1 for h in recent
                if h.get("change_pct") is not None and abs(h["change_pct"]) > 0.001
            )
            activity_ratio = active_ticks / len(recent) if recent else 0

            if activity_ratio >= activity_threshold:
                # Cluster detected — momentum, more events likely
                results.append("UP")
            else:
                # Quiet period — stay bearish
                results.append("DOWN")

        return results
