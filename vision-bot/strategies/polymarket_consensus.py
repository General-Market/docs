from framework.core import Strategy, make_strategy_rng


class PolymarketConsensusStrategy(Strategy):
    """Bet WITH the market's own belief.

    For prediction-market sources (polymarket etc.) the asset 'price' is
    the YES-share price in the range (0, 1). The market's posterior on
    YES is exactly that number. Pure noise plus martingale gives roughly
    zero drift, but in practice YES prices have small positive drift when
    above 0.5 and negative drift below — new information arrives, books
    refill on the favorite side, the price creeps toward resolution.

    Strategy:
      price > 0.5 + margin → UP   (favorite drifts up)
      price < 0.5 - margin → DOWN (longshot drifts down)
      within the margin    → coin flip (no edge inside the noise band)
      missing data         → coin flip

    Params:
      margin : float = 0.02  — distance from 0.5 below which we abstain
                               to a coin flip. Tune wider for less signal,
                               narrower for more directional confidence.
    """

    name = "polymarket_consensus"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)

    def predict(self, markets):
        margin = float(self.params.get("margin", 0.02))
        out = []
        for m in markets:
            price = m.get("price")
            if price is None:
                out.append(self._rng.choice(["UP", "DOWN"]))
                continue
            try:
                p = float(price)
            except (TypeError, ValueError):
                out.append(self._rng.choice(["UP", "DOWN"]))
                continue
            if p > 0.5 + margin:
                out.append("UP")
            elif p < 0.5 - margin:
                out.append("DOWN")
            else:
                out.append(self._rng.choice(["UP", "DOWN"]))
        return out


class PolymarketExtremeFadeStrategy(Strategy):
    """Fade extreme prices.

    YES at 0.97 cannot move up much (capped at 1.0); the only meaningful
    move is down. Same logic on the 0.03 side. Within the broad middle
    we have no information, so we abstain to a coin flip rather than
    pretending.

    Params:
      upper : float = 0.92  — fade DOWN above this
      lower : float = 0.08  — fade UP below this
    """

    name = "polymarket_extreme_fade"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)

    def predict(self, markets):
        upper = float(self.params.get("upper", 0.92))
        lower = float(self.params.get("lower", 0.08))
        out = []
        for m in markets:
            price = m.get("price")
            if price is None:
                out.append(self._rng.choice(["UP", "DOWN"]))
                continue
            try:
                p = float(price)
            except (TypeError, ValueError):
                out.append(self._rng.choice(["UP", "DOWN"]))
                continue
            if p >= upper:
                out.append("DOWN")
            elif p <= lower:
                out.append("UP")
            else:
                out.append(self._rng.choice(["UP", "DOWN"]))
        return out
