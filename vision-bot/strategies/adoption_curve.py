"""Adoption curve — for metrics on an S-curve trajectory.

npm downloads, PyPI installs, GitHub stars, Reddit subscribers.
Growth that accelerates is early adoption. Growth that decelerates
is maturity. The second derivative tells you which phase you inhabit.
"""

import logging
import random

from framework.core import Strategy

log = logging.getLogger(__name__)


class AdoptionCurveStrategy(Strategy):
    """Bet on the second derivative of price movement.

    Positive acceleration (growth speeding up) -> UP (early adoption).
    Negative acceleration (growth slowing) -> DOWN (plateau/decline).
    When the rate of change itself is changing, that is the signal.
    """

    name = "adoption_curve"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = random.Random()

    def predict(self, markets):
        """Fallback: bullish bias (adoption metrics tend upward)."""
        return [
            "UP" if (m.get("change") or 0) >= 0 else "DOWN"
            for m in markets
        ]

    def predict_with_context(self, markets, feed=None, batch_id=None):
        if not feed or not batch_id:
            return self.predict(markets)

        results = []

        for m in markets:
            asset_id = m.get("id", "")
            history = feed.history(batch_id, asset_id)

            if len(history) < 4:
                # Need at least 4 points for a meaningful second derivative
                results.append(
                    "UP" if (m.get("change") or 0) >= 0 else "DOWN"
                )
                continue

            # Extract prices from recent history
            prices = [h["price"] for h in history[-10:] if h.get("price")]
            if len(prices) < 4:
                results.append(self._rng.choice(["UP", "DOWN"]))
                continue

            # First derivatives (rate of change between consecutive prices)
            deltas = [
                prices[i] - prices[i - 1] for i in range(1, len(prices))
            ]

            # Second derivatives (acceleration)
            accels = [
                deltas[i] - deltas[i - 1] for i in range(1, len(deltas))
            ]

            # Recent acceleration: average of last few second derivatives
            recent_accel = sum(accels[-3:]) / len(accels[-3:]) if accels else 0

            if abs(recent_accel) < 1e-9:
                # Flat — no acceleration signal
                results.append(self._rng.choice(["UP", "DOWN"]))
            elif recent_accel > 0:
                # Growth accelerating — early adoption
                results.append("UP")
            else:
                # Growth decelerating — maturity or decline
                results.append("DOWN")

        return results
