"""Cluster detection — for episodic, bursty phenomena.

Raids, hosts, viral moments. Events that arrive in swarms: one spike
begets another, one raid reveals the audience of the next streamer.

The thesis: only large, sudden moves indicate a cluster event (raid/host).
Small moves are noise. If change is below the spike threshold, bet DOWN —
the calm will persist. Only above the threshold does the cascade bet pay.

This diverges from momentum: momentum bets UP on any positive change.
Cluster ignores small positives entirely and bets DOWN on them.
"""

import logging
import random

from framework.core import Strategy

log = logging.getLogger(__name__)

# A change must exceed this to be considered a cluster/raid event (percent).
SPIKE_THRESHOLD_PCT = 5.0
# After a spike, decline below this rate suggests the cascade is exhausted.
EXHAUSTION_DECLINE_PCT = -2.0


class ClusterStrategy(Strategy):
    """Bet on cluster events — raids, hosts, viral cascades.

    Only bets UP when change exceeds the spike threshold.
    Small positive changes get DOWN (no cluster = reversion to mean).
    This is the opposite of momentum for modest moves.
    """

    name = "cluster"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = random.Random()
        self._spike_pct = (params or {}).get(
            "spike_threshold_pct", SPIKE_THRESHOLD_PCT,
        )
        self._exhaustion_pct = (params or {}).get(
            "exhaustion_decline_pct", EXHAUSTION_DECLINE_PCT,
        )

    def _spike_signal(self, change):
        """Detect cluster event from a single change value.

        Returns UP only for large spikes. Everything else is DOWN.
        Momentum says UP for change=+1%. Cluster says DOWN — no raid detected.
        """
        if change is None:
            return self._rng.choice(["UP", "DOWN"])

        if change >= self._spike_pct:
            # Large spike — cluster event detected, cascade incoming
            return "UP"
        elif change <= self._exhaustion_pct:
            # Sharp decline after a spike — cascade exhausted
            return "DOWN"
        else:
            # Modest move in either direction — no cluster signal.
            # Bet DOWN: without a raid, viewership reverts to baseline.
            return "DOWN"

    def predict(self, markets):
        """Spike detection from change alone. Never momentum."""
        return [self._spike_signal(m.get("change")) for m in markets]

    def predict_with_context(self, markets, feed=None, batch_id=None):
        if not feed or not batch_id:
            return self.predict(markets)

        lookback = self.params.get("lookback_ticks", 10)
        activity_threshold = self.params.get("activity_threshold", 0.5)
        results = []

        for m in markets:
            asset_id = m.get("id", "")
            history = feed.history(batch_id, asset_id)

            recent = history[-lookback:] if history else []

            if len(recent) < 3:
                # Thin history — use spike detection on current change
                results.append(self._spike_signal(m.get("change")))
                continue

            # With enough history, measure activity density (cluster detection)
            active_ticks = sum(
                1 for h in recent
                if h.get("change_pct") is not None and abs(h["change_pct"]) > 0.001
            )
            activity_ratio = active_ticks / len(recent) if recent else 0

            if activity_ratio >= activity_threshold:
                # Dense activity — cluster in progress, cascade continues
                results.append("UP")
            else:
                # Sparse activity — no cluster, revert to baseline
                results.append("DOWN")

        return results
