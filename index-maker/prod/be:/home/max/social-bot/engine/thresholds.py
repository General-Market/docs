import yaml
from pathlib import Path


def load_thresholds():
    path = Path(__file__).parent.parent / "thresholds.yaml"
    with open(path) as f:
        return yaml.safe_load(f)


def evaluate_rules(source_config, data: dict) -> dict | None:
    """Evaluate threshold rules against data. Returns first matching rule or None."""
    for rule in source_config.get("rules", []):
        condition = rule["condition"]
        if _eval_condition(condition, data):
            return {
                "outcome": rule["outcome"],
                "context_priority": rule.get("context", []),
            }
    return None


def _eval_condition(condition: str, data: dict) -> bool:
    """Simple condition evaluator. Supports: >=, <=, >, <, ==, AND, OR.
    Variables are looked up in data dict."""
    # Handle AND/OR
    if " AND " in condition:
        parts = condition.split(" AND ")
        return all(_eval_condition(p.strip(), data) for p in parts)
    if " OR " in condition:
        parts = condition.split(" OR ")
        return any(_eval_condition(p.strip(), data) for p in parts)

    # Handle comparison operators
    for op in [">=", "<=", "!=", "==", ">", "<"]:
        if op in condition:
            left, right = condition.split(op, 1)
            left = left.strip()
            right = right.strip()
            left_val = data.get(left, left)
            try:
                left_val = float(left_val)
                right_val = float(right)
            except (ValueError, TypeError):
                right_val = right
                left_val = data.get(left, left)
            ops = {
                ">=": lambda a, b: a >= b,
                "<=": lambda a, b: a <= b,
                ">": lambda a, b: a > b,
                "<": lambda a, b: a < b,
                "==": lambda a, b: a == b,
                "!=": lambda a, b: a != b,
            }
            return ops[op](left_val, right_val)

    # Boolean field check
    return bool(data.get(condition, False))
