"""Market scanner — evaluates filter conditions against a DataFrame."""

from __future__ import annotations

from typing import Any

import pandas as pd

from indicators import calculate_indicators


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _latest(data: list[dict], key: str = "value") -> float | None:
    if not data:
        return None
    return data[-1].get(key)


def _prev(data: list[dict], key: str = "value") -> float | None:
    if len(data) < 2:
        return None
    return data[-2].get(key)


def _resolve_indicator_key(indicator: str, params: dict[str, Any]) -> str:
    """Return the dict key that calculate_indicators uses for a given config."""
    ind = indicator.upper()
    if ind in ("BB_UPPER", "BB_LOWER"):
        period = int(params.get("period", 20))
        return f"BB_{period}"
    if ind == "STOCH_K":
        k = int(params.get("k_period", 14))
        d = int(params.get("d_period", 3))
        return f"STOCH_{k}_{d}"
    if ind == "SMA":
        return f"SMA_{int(params.get('period', 20))}"
    if ind == "EMA":
        return f"EMA_{int(params.get('period', 20))}"
    if ind == "RSI":
        return f"RSI_{int(params.get('period', 14))}"
    if ind == "ATR":
        return f"ATR_{int(params.get('period', 14))}"
    if ind == "MACD":
        fast = int(params.get("fast", 12))
        slow = int(params.get("slow", 26))
        sig = int(params.get("signal", 9))
        return f"MACD_{fast}_{slow}_{sig}"
    return ind


def _indicator_name_for_calc(indicator: str) -> str:
    """Return the canonical name to pass to calculate_indicators."""
    ind = indicator.upper()
    if ind in ("BB_UPPER", "BB_LOWER"):
        return "BB"
    if ind == "STOCH_K":
        return "STOCH"
    return ind


# ---------------------------------------------------------------------------
# Condition evaluation
# ---------------------------------------------------------------------------


def _check_condition(
    condition: dict[str, Any],
    ind_results: dict[str, list[dict]],
    latest_price: float,
) -> bool:
    indicator = condition.get("indicator", "PRICE").upper()
    operator = condition.get("operator", "gt").lower()
    threshold = condition.get("value")
    params = condition.get("params", {})

    # ---- special cross-indicator operators --------------------------------
    if operator == "price_above_sma":
        period = int(params.get("period", 20))
        sma_val = _latest(ind_results.get(f"SMA_{period}", []))
        return sma_val is not None and latest_price > sma_val

    if operator == "price_below_sma":
        period = int(params.get("period", 20))
        sma_val = _latest(ind_results.get(f"SMA_{period}", []))
        return sma_val is not None and latest_price < sma_val

    if operator == "price_above_ema":
        period = int(params.get("period", 20))
        ema_val = _latest(ind_results.get(f"EMA_{period}", []))
        return ema_val is not None and latest_price > ema_val

    if operator == "price_below_ema":
        period = int(params.get("period", 20))
        ema_val = _latest(ind_results.get(f"EMA_{period}", []))
        return ema_val is not None and latest_price < ema_val

    # ---- resolve current value --------------------------------------------
    if indicator == "PRICE":
        current = latest_price
    elif indicator == "BB_UPPER":
        key = f"BB_{int(params.get('period', 20))}"
        current = _latest(ind_results.get(key, []), "upper")
    elif indicator == "BB_LOWER":
        key = f"BB_{int(params.get('period', 20))}"
        current = _latest(ind_results.get(key, []), "lower")
    elif indicator == "STOCH_K":
        k = int(params.get("k_period", 14))
        d = int(params.get("d_period", 3))
        current = _latest(ind_results.get(f"STOCH_{k}_{d}", []))
    else:
        key = _resolve_indicator_key(indicator, params)
        current = _latest(ind_results.get(key, []))

    if current is None:
        return False

    if threshold is None and operator not in (
        "crosses_above",
        "crosses_below",
    ):
        return False

    # ---- scalar comparisons -----------------------------------------------
    if operator == "gt":
        return current > threshold
    if operator == "gte":
        return current >= threshold
    if operator == "lt":
        return current < threshold
    if operator == "lte":
        return current <= threshold
    if operator == "eq":
        return abs(current - threshold) < 0.001

    # ---- cross detections (need previous bar) -----------------------------
    if operator in ("crosses_above", "crosses_below"):
        key = _resolve_indicator_key(indicator, params)
        data = ind_results.get(key, [])
        prev_val = _prev(data)
        curr_val = _latest(data)
        if prev_val is None or curr_val is None or threshold is None:
            return False
        if operator == "crosses_above":
            return prev_val <= threshold < curr_val
        return prev_val >= threshold > curr_val

    return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def run_scanner(
    df: pd.DataFrame,
    conditions: list[dict[str, Any]],
    logic: str = "AND",
) -> tuple[bool, dict[str, Any]]:
    """Evaluate filter conditions against a price DataFrame.

    Returns ``(passed, current_indicator_values)``.
    """
    # Build the minimal set of indicators needed
    ind_configs: list[dict[str, Any]] = []
    seen: set[str] = set()

    def _add_config(ind_name: str, params: dict) -> None:
        canon = _indicator_name_for_calc(ind_name)
        key = _resolve_indicator_key(ind_name, params)
        if key not in seen:
            seen.add(key)
            ind_configs.append({"name": canon, "params": params})

    for cond in conditions:
        ind = cond.get("indicator", "PRICE").upper()
        params = cond.get("params", {})
        op = cond.get("operator", "").lower()
        if ind != "PRICE":
            _add_config(ind, params)
        # price_above/below_sma/ema also need the MA
        if op in ("price_above_sma", "price_below_sma"):
            _add_config("SMA", params)
        if op in ("price_above_ema", "price_below_ema"):
            _add_config("EMA", params)

    ind_results = calculate_indicators(df, ind_configs)
    latest_price = float(df["close"].iloc[-1])

    # Evaluate each condition
    eval_results = [
        _check_condition(c, ind_results, latest_price) for c in conditions
    ]

    if logic.upper() == "OR":
        passed = any(eval_results)
    else:
        passed = all(eval_results) if eval_results else False

    # Flatten current indicator values for the response
    current_values: dict[str, Any] = {"price": round(latest_price, 6)}
    for key, data in ind_results.items():
        if not data:
            continue
        last = data[-1]
        if "upper" in last:  # BB
            current_values[f"{key}_upper"] = last["upper"]
            current_values[key] = last["value"]
            current_values[f"{key}_lower"] = last["lower"]
        elif "signal" in last and "histogram" in last:  # MACD
            current_values[key] = last["value"]
            current_values[f"{key}_signal"] = last["signal"]
            current_values[f"{key}_histogram"] = last["histogram"]
        elif "signal" in last:  # STOCH
            current_values[key] = last["value"]
            current_values[f"{key}_signal"] = last["signal"]
        else:
            current_values[key] = last["value"]

    return passed, current_values
