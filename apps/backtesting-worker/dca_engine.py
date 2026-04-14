"""DCA (Dollar Cost Averaging) engine — compara estratégias de aporte periódico."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass
class DCAPurchase:
    date: str
    price: float
    amount: float
    shares: float
    bought: bool = True  # False when conditional skips


@dataclass
class DCAEquityPoint:
    date: str
    value: float
    invested: float


@dataclass
class DCAStrategyResult:
    name: str
    strategy_type: str  # 'fixed' | 'lump_sum' | 'conditional'
    total_invested: float
    final_value: float
    total_return: float
    total_return_pct: float
    avg_cost_basis: float
    shares_owned: float
    n_purchases: int
    purchases: list[dict]
    equity_curve: list[dict]


# ---------------------------------------------------------------------------
# Period date generation
# ---------------------------------------------------------------------------

def _next_trading_day(df: pd.DataFrame, target: pd.Timestamp) -> pd.Timestamp | None:
    """Return the first available trading day >= target."""
    idx = df.index.searchsorted(target)
    if idx < len(df.index):
        return df.index[idx]
    return None


def _get_period_dates(df: pd.DataFrame, period: str, day_of_month: int = 1) -> list[pd.Timestamp]:
    """Return the sorted list of purchase dates within the DataFrame range."""
    dates: list[pd.Timestamp] = []
    start = df.index[0]
    end = df.index[-1]

    if period in ("weekly", "biweekly"):
        freq = "W-MON" if period == "weekly" else "2W-MON"
        for d in pd.date_range(start, end, freq=freq):
            t = _next_trading_day(df, d)
            if t is not None:
                dates.append(t)

    elif period == "monthly":
        cur = pd.Timestamp(start.year, start.month, 1)
        while cur <= end:
            try:
                target = cur.replace(day=min(day_of_month, 28))
            except ValueError:
                target = cur.replace(day=28)
            t = _next_trading_day(df, target)
            if t is not None and t <= end:
                dates.append(t)
            # advance one month
            if cur.month == 12:
                cur = pd.Timestamp(cur.year + 1, 1, 1)
            else:
                cur = pd.Timestamp(cur.year, cur.month + 1, 1)

    elif period == "quarterly":
        quarter_months = [1, 4, 7, 10]
        cur = pd.Timestamp(start.year, start.month, 1)
        # Align to next quarter start
        for qm in quarter_months:
            if cur.month <= qm:
                cur = pd.Timestamp(cur.year, qm, 1)
                break
        else:
            cur = pd.Timestamp(cur.year + 1, 1, 1)

        while cur <= end:
            try:
                target = cur.replace(day=min(day_of_month, 28))
            except ValueError:
                target = cur.replace(day=28)
            t = _next_trading_day(df, target)
            if t is not None and t <= end:
                dates.append(t)
            # advance one quarter
            month = cur.month
            if month < 10:
                cur = pd.Timestamp(cur.year, month + 3, 1)
            else:
                cur = pd.Timestamp(cur.year + 1, 1, 1)

    # Remove duplicates, preserve order
    seen: set = set()
    unique: list[pd.Timestamp] = []
    for d in dates:
        if d not in seen:
            seen.add(d)
            unique.append(d)
    return sorted(unique)


# ---------------------------------------------------------------------------
# Condition checking
# ---------------------------------------------------------------------------

def _check_conditions(row: pd.Series, conditions: list[dict], logic: str) -> bool:
    results: list[bool] = []
    for cond in conditions:
        indicator = cond.get("indicator", "")
        op = cond.get("operator", ">")
        val = float(cond.get("value", 0))

        if indicator not in row.index or pd.isna(row.get(indicator)):
            results.append(False)
            continue

        ind_val = float(row[indicator])
        if op == "<":
            results.append(ind_val < val)
        elif op == "<=":
            results.append(ind_val <= val)
        elif op == ">":
            results.append(ind_val > val)
        elif op == ">=":
            results.append(ind_val >= val)
        elif op in ("=", "=="):
            results.append(abs(ind_val - val) < 1e-6)
        else:
            results.append(False)

    if not results:
        return True
    return all(results) if logic.upper() == "AND" else any(results)


# ---------------------------------------------------------------------------
# Equity curve builder
# ---------------------------------------------------------------------------

def _build_equity_curve(
    df: pd.DataFrame,
    purchase_dates: list[pd.Timestamp],
    amount_per_purchase: float,
) -> tuple[list[dict], float, float, float]:
    """Return (equity_curve, total_invested, shares_owned, avg_cost)."""
    purchase_set = set(purchase_dates)
    running_shares = 0.0
    running_invested = 0.0
    equity_curve: list[dict] = []

    for idx, row in df.iterrows():
        if idx in purchase_set:
            price = float(row["close"])
            running_shares += amount_per_purchase / price
            running_invested += amount_per_purchase

        value = running_shares * float(row["close"])
        equity_curve.append({
            "date": str(idx.date()),
            "value": round(value, 2),
            "invested": round(running_invested, 2),
        })

    avg_cost = (running_invested / running_shares) if running_shares > 0 else 0.0
    return equity_curve, running_invested, running_shares, avg_cost


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_dca(
    df: pd.DataFrame,
    amount_per_period: float,
    period: str,
    day_of_month: int = 1,
    conditions: list[dict] | None = None,
    condition_logic: str = "AND",
    indicators_config: list[dict] | None = None,
) -> list[dict]:
    """
    Run DCA simulations and return list of strategy results.

    Always returns:
      - Fixed DCA (invest every period no matter what)
      - Lump Sum (invest everything at start, for comparison)
    Optionally returns:
      - Conditional DCA (invest only when indicator conditions are met)
    """
    from indicators import calculate_indicators

    period_dates = _get_period_dates(df, period, day_of_month)
    if not period_dates:
        raise ValueError(f"No trading days found for period '{period}' in the given date range.")

    n_periods = len(period_dates)
    total_budget = amount_per_period * n_periods
    final_price = float(df["close"].iloc[-1])
    first_price = float(df["close"].iloc[0])

    results: list[dict] = []

    # ── 1. Fixed DCA ──────────────────────────────────────────────────────────
    equity, invested, shares, avg_cost = _build_equity_curve(df, period_dates, amount_per_period)
    final_val = shares * final_price

    purchases_fixed = []
    for d in period_dates:
        price = float(df.loc[d, "close"])
        sh = amount_per_period / price
        purchases_fixed.append({
            "date": str(d.date()),
            "price": round(price, 2),
            "amount": amount_per_period,
            "shares": round(sh, 6),
        })

    results.append({
        "name": f"DCA {_period_label(period)} (${amount_per_period:,.0f}/período)",
        "strategyType": "fixed",
        "totalInvested": round(invested, 2),
        "finalValue": round(final_val, 2),
        "totalReturn": round(final_val - invested, 2),
        "totalReturnPct": round((final_val - invested) / invested * 100, 2) if invested > 0 else 0.0,
        "avgCostBasis": round(avg_cost, 4),
        "sharesOwned": round(shares, 6),
        "nPurchases": len(period_dates),
        "purchases": purchases_fixed,
        "equityCurve": equity,
    })

    # ── 2. Lump Sum ───────────────────────────────────────────────────────────
    lump_shares = total_budget / first_price
    lump_curve = [
        {
            "date": str(idx.date()),
            "value": round(lump_shares * float(row["close"]), 2),
            "invested": round(total_budget, 2),
        }
        for idx, row in df.iterrows()
    ]
    lump_final = lump_shares * final_price

    results.append({
        "name": f"Lump Sum (${total_budget:,.0f} de uma vez)",
        "strategyType": "lump_sum",
        "totalInvested": round(total_budget, 2),
        "finalValue": round(lump_final, 2),
        "totalReturn": round(lump_final - total_budget, 2),
        "totalReturnPct": round((lump_final - total_budget) / total_budget * 100, 2) if total_budget > 0 else 0.0,
        "avgCostBasis": round(first_price, 4),
        "sharesOwned": round(lump_shares, 6),
        "nPurchases": 1,
        "purchases": [{
            "date": str(df.index[0].date()),
            "price": round(first_price, 2),
            "amount": round(total_budget, 2),
            "shares": round(lump_shares, 6),
        }],
        "equityCurve": lump_curve,
    })

    # ── 3. Conditional DCA ────────────────────────────────────────────────────
    if conditions:
        # Merge indicator values into df
        ind_df = df.copy()
        if indicators_config:
            ind_results = calculate_indicators(df, indicators_config)
            for key, points in ind_results.items():
                date_map = {}
                for p in points:
                    v = p.get("value")
                    if v is not None:
                        date_map[pd.Timestamp(p["date"])] = v
                ind_df[key] = pd.Series(date_map, dtype=float)

        # Determine which period dates pass the condition
        cond_dates: list[pd.Timestamp] = []
        skipped_dates: list[pd.Timestamp] = []
        for d in period_dates:
            row = ind_df.loc[d]
            if _check_conditions(row, conditions, condition_logic):
                cond_dates.append(d)
            else:
                skipped_dates.append(d)

        if cond_dates:
            c_equity, c_invested, c_shares, c_avg = _build_equity_curve(df, cond_dates, amount_per_period)
            c_final = c_shares * final_price

            purchases_cond = []
            for d in period_dates:
                price = float(df.loc[d, "close"])
                bought = d in set(cond_dates)
                entry = {
                    "date": str(d.date()),
                    "price": round(price, 2),
                    "amount": amount_per_period if bought else 0,
                    "shares": round(amount_per_period / price, 6) if bought else 0,
                    "bought": bought,
                }
                purchases_cond.append(entry)

            results.append({
                "name": f"DCA Condicional (${amount_per_period:,.0f} quando condição)",
                "strategyType": "conditional",
                "totalInvested": round(c_invested, 2),
                "finalValue": round(c_final, 2),
                "totalReturn": round(c_final - c_invested, 2),
                "totalReturnPct": round((c_final - c_invested) / c_invested * 100, 2) if c_invested > 0 else 0.0,
                "avgCostBasis": round(c_avg, 4),
                "sharesOwned": round(c_shares, 6),
                "nPurchases": len(cond_dates),
                "nSkipped": len(skipped_dates),
                "purchases": purchases_cond,
                "equityCurve": c_equity,
            })
        else:
            results.append({
                "name": "DCA Condicional (nenhuma compra realizada)",
                "strategyType": "conditional",
                "totalInvested": 0,
                "finalValue": 0,
                "totalReturn": 0,
                "totalReturnPct": 0,
                "avgCostBasis": 0,
                "sharesOwned": 0,
                "nPurchases": 0,
                "nSkipped": len(skipped_dates),
                "purchases": [],
                "equityCurve": [{"date": str(idx.date()), "value": 0, "invested": 0} for idx, _ in df.iterrows()],
            })

    return results


def _period_label(period: str) -> str:
    labels = {"weekly": "Semanal", "biweekly": "Quinzenal", "monthly": "Mensal", "quarterly": "Trimestral"}
    return labels.get(period, period.capitalize())
