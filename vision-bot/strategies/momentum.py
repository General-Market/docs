from framework.core import Strategy


class MomentumStrategy(Strategy):
    name = "momentum"

    def predict(self, markets):
        return ["UP" if (m.get("change") or 0) >= 0 else "DOWN" for m in markets]
