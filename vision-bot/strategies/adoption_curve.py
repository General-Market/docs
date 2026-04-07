"""Adoption curve — S-curve phase detection.

The thesis: growth follows a logistic curve. Early phase (accelerating)
rewards the bold. Late phase (decelerating) punishes them. The second
derivative tells you which side of the inflection point you inhabit.

With rich history, compute the second derivative directly.
With thin history, infer the phase from the magnitude of change:
  - Large positive change = early explosive growth = UP
  - Small positive change = saturation, the top of the S-curve = DOWN
  - Negative change = decline phase = DOWN (but small decline = possible recovery = UP)

This diverges from momentum, which blindly follows sign.
Adoption curve cares about magnitude and phase, not direction alone.
"""

import logging

from framework.core import Strategy, make_strategy_rng

log = logging.getLogger(__name__)

# Thresholds for phase inference from a single change value (percent).
# Above this = explosive early growth. Below this = saturation/plateau.
GROWTH_EXPLOSION_PCT = 3.0
# Small negative changes might indicate a dip before recovery.
RECOVERY_DIP_PCT = -1.5


class AdoptionCurveStrategy(Strategy):
    """Bet on the phase of the S-curve, not the direction of the trend.

    Diverges from momentum: a small positive change triggers DOWN (saturation),
    a small negative change triggers UP (recovery dip). Only large moves
    in either direction align with momentum's prediction.
    """

    name = "adoption_curve"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)
        self._explosion_pct = (params or {}).get(
            "explosion_pct", GROWTH_EXPLOSION_PCT,
        )
        self._recovery_dip_pct = (params or {}).get(
            "recovery_dip_pct", RECOVERY_DIP_PCT,
        )

    def _phase_from_change(self, change):
        """Infer S-curve phase from a single change percentage.

        Returns UP for early-growth or recovery-dip phases,
        DOWN for saturation or steep decline.
        """
        if change is None:
            return self._rng.choice(["UP", "DOWN"])
        if change == 0.0:
            # Zero change: the plateau of the S-curve. DOWN — saturation.
            return "DOWN"

        if change >= self._explosion_pct:
            # Explosive growth — early adoption phase
            return "UP"
        elif change > 0:
            # Positive but modest — saturation. Momentum says UP, we say DOWN.
            return "DOWN"
        elif change >= self._recovery_dip_pct:
            # Small dip — possible recovery before next growth leg. Momentum
            # says DOWN, we say UP.
            return "UP"
        else:
            # Steep decline — past the inflection, heading to zero
            return "DOWN"

    def predict(self, markets):
        """Phase inference from change magnitude alone. Never momentum."""
        return [self._phase_from_change(m.get("change")) for m in markets]

    def predict_with_context(self, markets, feed=None, batch_id=None):
        if not feed or not batch_id:
            return self.predict(markets)

        results = []

        for m in markets:
            asset_id = m.get("id", "")
            history = feed.history(batch_id, asset_id)

            # Extract prices from available history
            prices = [h["price"] for h in history[-10:] if h.get("price")]

            if len(prices) < 4:
                # Insufficient history for second derivative — use phase inference
                results.append(self._phase_from_change(m.get("change")))
                continue

            # First derivatives (rate of change between consecutive prices)
            deltas = [
                prices[i] - prices[i - 1] for i in range(1, len(prices))
            ]

            # Second derivatives (acceleration)
            accels = [
                deltas[i] - deltas[i - 1] for i in range(1, len(deltas))
            ]

            recent_accel = sum(accels[-3:]) / len(accels[-3:]) if accels else 0

            if abs(recent_accel) < 1e-9:
                # No acceleration signal — fall back to phase inference
                results.append(self._phase_from_change(m.get("change")))
            elif recent_accel > 0:
                # Growth accelerating — early adoption
                results.append("UP")
            else:
                # Growth decelerating — maturity or decline
                results.append("DOWN")

        return results
