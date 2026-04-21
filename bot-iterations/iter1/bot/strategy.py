"""Pick strategy. Article permits 'even all YES' for iteration 1."""


def all_yes(markets: list[dict]) -> list[str]:
    return ["UP"] * len(markets)


def pick(markets: list[dict], mode: str = "all_yes") -> list[str]:
    if mode == "all_yes":
        return all_yes(markets)
    if mode == "all_no":
        return ["DOWN"] * len(markets)
    raise ValueError(f"unknown strategy: {mode}")
