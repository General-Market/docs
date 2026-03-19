from framework.core import Strategy


class ContrarianStrategy(Strategy):
    name = "contrarian"

    def predict(self, markets):
        return ["DOWN" if (m.get("change") or 0) >= 0 else "UP" for m in markets]
