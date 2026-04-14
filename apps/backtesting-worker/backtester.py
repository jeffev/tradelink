"""Core backtesting engine — pure pandas, no external dependencies beyond requirements.txt."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Trade:
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    quantity: float
    side: str  # 'buy' | 'sell'
    pnl: float
    pnl_pct: float


@dataclass
class BacktestResult:
    metrics: dict[str, float | int]
    equity_curve: list[dict[str, Any]]
    trades: list[dict[str, Any]]
    price_data: list[dict[str, Any]]
    indicators: dict[str, list[dict[str, Any]]]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _price_data(df: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {
            "date": str(idx.date()),
            "open": round(float(row["open"]), 4),
            "high": round(float(row["high"]), 4),
            "low": round(float(row["low"]), 4),
            "close": round(float(row["close"]), 4),
        }
        for idx, row in df.iterrows()
    ]


def _series_to_indicator(s: pd.Series) -> list[dict[str, Any]]:
    return [
        {"date": str(idx.date()), "value": round(float(val), 4)}
        for idx, val in s.items()
        if not pd.isna(val)
    ]


def _annualised_return(total_return_pct: float, days: int) -> float:
    if days <= 0:
        return 0.0
    years = days / 365.25
    try:
        return ((1 + total_return_pct / 100) ** (1 / years) - 1) * 100
    except Exception:
        return 0.0


def _sharpe(returns: pd.Series, risk_free: float = 0.0, periods: int = 252) -> float:
    if returns.std() == 0:
        return 0.0
    excess = returns - risk_free / periods
    return float(excess.mean() / excess.std() * math.sqrt(periods))


def _sortino(returns: pd.Series, risk_free: float = 0.0, periods: int = 252) -> float:
    downside = returns[returns < 0]
    if len(downside) == 0 or downside.std() == 0:
        return 0.0
    excess_mean = returns.mean() - risk_free / periods
    return float(excess_mean / downside.std() * math.sqrt(periods))


def _max_drawdown(equity: pd.Series) -> tuple[float, float]:
    rolling_max = equity.cummax()
    drawdown = equity - rolling_max
    drawdown_pct = drawdown / rolling_max * 100
    return float(drawdown.min()), float(drawdown_pct.min())


# ---------------------------------------------------------------------------
# Strategy implementations
# ---------------------------------------------------------------------------

def _strategy_buy_and_hold(
    df: pd.DataFrame, initial_capital: float, brokerage_rate: float
) -> tuple[list[Trade], pd.Series, dict[str, list]]:
    if df.empty:
        return [], pd.Series(dtype=float), {}

    entry_price = float(df.iloc[0]["open"])
    quantity = initial_capital / entry_price * (1 - brokerage_rate)
    exit_price = float(df.iloc[-1]["close"])

    pnl = (exit_price - entry_price) * quantity - exit_price * quantity * brokerage_rate
    pnl_pct = (exit_price / entry_price - 1) * 100

    trades = [
        Trade(
            entry_date=str(df.index[0].date()),
            exit_date=str(df.index[-1].date()),
            entry_price=entry_price,
            exit_price=exit_price,
            quantity=round(quantity, 6),
            side="buy",
            pnl=round(pnl, 2),
            pnl_pct=round(pnl_pct, 4),
        )
    ]

    equity = initial_capital * df["close"] / entry_price
    return trades, equity, {}


def _strategy_sma_crossover(
    df: pd.DataFrame,
    initial_capital: float,
    brokerage_rate: float,
    fast_period: int = 20,
    slow_period: int = 50,
) -> tuple[list[Trade], pd.Series, dict[str, list]]:
    df = df.copy()
    df["fast"] = df["close"].rolling(fast_period).mean()
    df["slow"] = df["close"].rolling(slow_period).mean()

    indicators = {
        "fast_sma": _series_to_indicator(df["fast"]),
        "slow_sma": _series_to_indicator(df["slow"]),
    }

    df = df.dropna()

    cash = initial_capital
    position = 0.0
    entry_price = 0.0
    entry_date = ""
    trades: list[Trade] = []
    equity_values: list[float] = []
    prev_signal = None

    for idx, row in df.iterrows():
        signal = "long" if row["fast"] > row["slow"] else "flat"

        if signal == "long" and prev_signal != "long" and position == 0:
            entry_price = float(row["close"])
            quantity = cash / entry_price * (1 - brokerage_rate)
            position = quantity
            cash = 0.0
            entry_date = str(idx.date())  # type: ignore[union-attr]

        elif signal == "flat" and prev_signal == "long" and position > 0:
            exit_price = float(row["close"])
            gross = position * exit_price
            fee = gross * brokerage_rate
            cash = gross - fee
            pnl = cash - initial_capital
            pnl_pct = (exit_price / entry_price - 1) * 100
            trades.append(Trade(
                entry_date=entry_date,
                exit_date=str(idx.date()),  # type: ignore[union-attr]
                entry_price=round(entry_price, 4),
                exit_price=round(exit_price, 4),
                quantity=round(position, 6),
                side="buy",
                pnl=round(pnl, 2),
                pnl_pct=round(pnl_pct, 4),
            ))
            initial_capital = cash
            position = 0.0

        equity_values.append(cash + position * float(row["close"]))
        prev_signal = signal

    equity = pd.Series(equity_values, index=df.index)
    return trades, equity, indicators


def _strategy_rsi(
    df: pd.DataFrame,
    initial_capital: float,
    brokerage_rate: float,
    rsi_period: int = 14,
    oversold: float = 30.0,
    overbought: float = 70.0,
) -> tuple[list[Trade], pd.Series, dict[str, list]]:
    df = df.copy()
    delta = df["close"].diff()
    gain = delta.clip(lower=0).rolling(rsi_period).mean()
    loss = (-delta.clip(upper=0)).rolling(rsi_period).mean()
    rs = gain / loss.replace(0, np.nan)
    df["rsi"] = 100 - (100 / (1 + rs))

    indicators = {
        "rsi": _series_to_indicator(df["rsi"]),
        "oversold": [{"date": str(df.index[0].date()), "value": oversold},
                     {"date": str(df.index[-1].date()), "value": oversold}],
        "overbought": [{"date": str(df.index[0].date()), "value": overbought},
                       {"date": str(df.index[-1].date()), "value": overbought}],
    }

    df = df.dropna()

    cash = initial_capital
    position = 0.0
    entry_price = 0.0
    entry_date = ""
    trades: list[Trade] = []
    equity_values: list[float] = []

    for idx, row in df.iterrows():
        rsi_val = float(row["rsi"])

        if rsi_val < oversold and position == 0:
            entry_price = float(row["close"])
            quantity = cash / entry_price * (1 - brokerage_rate)
            position = quantity
            cash = 0.0
            entry_date = str(idx.date())  # type: ignore[union-attr]

        elif rsi_val > overbought and position > 0:
            exit_price = float(row["close"])
            gross = position * exit_price
            fee = gross * brokerage_rate
            cash = gross - fee
            pnl = cash - initial_capital
            pnl_pct = (exit_price / entry_price - 1) * 100
            trades.append(Trade(
                entry_date=entry_date,
                exit_date=str(idx.date()),  # type: ignore[union-attr]
                entry_price=round(entry_price, 4),
                exit_price=round(exit_price, 4),
                quantity=round(position, 6),
                side="buy",
                pnl=round(pnl, 2),
                pnl_pct=round(pnl_pct, 4),
            ))
            initial_capital = cash
            position = 0.0

        equity_values.append(cash + position * float(row["close"]))

    equity = pd.Series(equity_values, index=df.index)
    return trades, equity, indicators


def _check_condition(row: pd.Series, indicator_name: str, operator: str, value: float) -> bool:
    """Check if a row meets an indicator condition."""
    if indicator_name not in row.index or pd.isna(row[indicator_name]):
        return False

    val = float(row[indicator_name])

    if operator == ">":
        return val > value
    elif operator == "<":
        return val < value
    elif operator == ">=":
        return val >= value
    elif operator == "<=":
        return val <= value
    elif operator == "==":
        return abs(val - value) < 1e-6
    elif operator == "!=":
        return abs(val - value) >= 1e-6
    else:
        return False


def _evaluate_conditions(row: pd.Series, conditions: list[dict], logic: str = "AND") -> bool:
    """Evaluate a list of conditions with AND/OR logic."""
    if not conditions:
        return True

    results = [_check_condition(row, c["indicator"], c["operator"], c["value"]) for c in conditions]

    if logic == "AND":
        return all(results)
    elif logic == "OR":
        return any(results)
    else:
        return False


def _strategy_multi_indicator(
    df: pd.DataFrame,
    initial_capital: float,
    brokerage_rate: float,
    entry_conditions: list[dict] | None = None,
    exit_conditions: list[dict] | None = None,
    entry_logic: str = "AND",
    exit_logic: str = "AND",
    indicators_config: list[dict[str, Any]] | None = None,
) -> tuple[list[Trade], pd.Series, dict[str, list]]:
    """Strategy based on multiple indicator conditions."""
    df = df.copy()

    if not entry_conditions or not exit_conditions:
        # Fallback to buy and hold if no conditions
        return _strategy_buy_and_hold(df, initial_capital, brokerage_rate)

    # Calculate requested indicators
    if indicators_config:
        from indicators import calculate_indicators as calc_ind_fn
        calc_indicators_result = calc_ind_fn(df, indicators_config)
        for ind_name, ind_values in calc_indicators_result.items():
            if not ind_values:
                continue
            sample = ind_values[0]
            if "macd" in sample:
                # MACD — expose macd line and signal line separately
                df[ind_name] = pd.Series(
                    {pd.Timestamp(iv["date"]): iv["macd"] for iv in ind_values}, dtype=float
                )
                df[f"{ind_name}_signal"] = pd.Series(
                    {pd.Timestamp(iv["date"]): iv["signal"] for iv in ind_values}, dtype=float
                )
            elif "k" in sample:
                # Stochastic — expose K and D lines
                df[ind_name] = pd.Series(
                    {pd.Timestamp(iv["date"]): iv["k"] for iv in ind_values}, dtype=float
                )
                df[f"{ind_name}_d"] = pd.Series(
                    {pd.Timestamp(iv["date"]): iv["d"] for iv in ind_values}, dtype=float
                )
            elif "value" in sample:
                df[ind_name] = pd.Series(
                    {pd.Timestamp(iv["date"]): iv["value"] for iv in ind_values}, dtype=float
                )
    else:
        return _strategy_buy_and_hold(df, initial_capital, brokerage_rate)

    df = df.dropna(subset=[cond["indicator"] for cond in entry_conditions + exit_conditions])

    if df.empty:
        return [], pd.Series(dtype=float), {}

    cash = initial_capital
    position = 0.0
    entry_price = 0.0
    entry_date = ""
    trades: list[Trade] = []
    equity_values: list[float] = []

    indicators = {}
    for config in (indicators_config or []):
        ind_name = config.get("name", "unknown")
        if ind_name in df.columns:
            indicators[ind_name] = _series_to_indicator(df[ind_name])

    for idx, row in df.iterrows():
        entry_signal = _evaluate_conditions(row, entry_conditions, entry_logic)
        exit_signal = _evaluate_conditions(row, exit_conditions, exit_logic)

        if entry_signal and position == 0:
            entry_price = float(row["close"])
            quantity = cash / entry_price * (1 - brokerage_rate)
            position = quantity
            cash = 0.0
            entry_date = str(idx.date())  # type: ignore[union-attr]

        elif exit_signal and position > 0:
            exit_price = float(row["close"])
            gross = position * exit_price
            fee = gross * brokerage_rate
            cash = gross - fee
            pnl = cash - initial_capital
            pnl_pct = (exit_price / entry_price - 1) * 100
            trades.append(Trade(
                entry_date=entry_date,
                exit_date=str(idx.date()),  # type: ignore[union-attr]
                entry_price=round(entry_price, 4),
                exit_price=round(exit_price, 4),
                quantity=round(position, 6),
                side="buy",
                pnl=round(pnl, 2),
                pnl_pct=round(pnl_pct, 4),
            ))
            initial_capital = cash
            position = 0.0

        equity_values.append(cash + position * float(row["close"]))

    equity = pd.Series(equity_values, index=df.index)
    return trades, equity, indicators


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_backtest(
    df: pd.DataFrame,
    strategy_type: str,
    strategy_params: dict[str, Any],
    initial_capital: float,
    brokerage_rate: float,
    indicators_config: list[dict[str, Any]] | None = None,
) -> BacktestResult:
    if df.empty:
        raise ValueError("No price data available for the given parameters")

    raw_price_data = _price_data(df)

    if strategy_type == "buy_and_hold":
        trades, equity, indicators = _strategy_buy_and_hold(df, initial_capital, brokerage_rate)
    elif strategy_type == "sma_crossover":
        trades, equity, indicators = _strategy_sma_crossover(
            df, initial_capital, brokerage_rate,
            fast_period=int(strategy_params.get("fast_period", 20)),
            slow_period=int(strategy_params.get("slow_period", 50)),
        )
    elif strategy_type == "rsi":
        trades, equity, indicators = _strategy_rsi(
            df, initial_capital, brokerage_rate,
            rsi_period=int(strategy_params.get("rsi_period", 14)),
            oversold=float(strategy_params.get("oversold", 30)),
            overbought=float(strategy_params.get("overbought", 70)),
        )
    elif strategy_type == "multi_indicator":
        trades, equity, indicators = _strategy_multi_indicator(
            df, initial_capital, brokerage_rate,
            entry_conditions=strategy_params.get("entry_conditions", []),
            exit_conditions=strategy_params.get("exit_conditions", []),
            entry_logic=strategy_params.get("entry_logic", "AND"),
            exit_logic=strategy_params.get("exit_logic", "AND"),
            indicators_config=indicators_config,
        )
    else:
        raise ValueError(f"Unknown strategy type: {strategy_type}")

    if equity.empty:
        equity = pd.Series([initial_capital], index=df.index[:1])

    rolling_max = equity.cummax()
    drawdown_abs = equity - rolling_max
    drawdown_pct = drawdown_abs / rolling_max * 100

    # Calculate additional indicators if requested
    if indicators_config:
        from indicators import calculate_indicators as calc_ind_fn
        additional_indicators = calc_ind_fn(df, indicators_config)
        indicators.update(additional_indicators)

    equity_curve = [
        {
            "date": str(idx.date()),
            "equity": round(float(val), 2),
            "drawdown": round(float(drawdown_abs[idx]), 2),
            "drawdownPct": round(float(drawdown_pct[idx]), 4),
        }
        for idx, val in equity.items()
    ]

    final_equity = float(equity.iloc[-1]) if not equity.empty else initial_capital
    total_return = final_equity - initial_capital
    total_return_pct = (total_return / initial_capital) * 100

    days = (df.index[-1] - df.index[0]).days if len(df) > 1 else 0
    annualised = _annualised_return(total_return_pct, days)

    daily_returns = equity.pct_change().dropna()
    sharpe = _sharpe(daily_returns)
    sortino = _sortino(daily_returns)
    max_dd_abs, max_dd_pct = _max_drawdown(equity)
    calmar = annualised / abs(max_dd_pct) if max_dd_pct != 0 else 0.0

    winning = [t for t in trades if t.pnl > 0]
    losing = [t for t in trades if t.pnl <= 0]
    win_rate = len(winning) / len(trades) * 100 if trades else 0.0
    avg_win = sum(t.pnl for t in winning) / len(winning) if winning else 0.0
    avg_loss = sum(t.pnl for t in losing) / len(losing) if losing else 0.0
    gross_profit = sum(t.pnl for t in winning)
    gross_loss = abs(sum(t.pnl for t in losing))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")
    avg_rr = abs(avg_win / avg_loss) if avg_loss != 0 else 0.0

    metrics = {
        "totalReturn": round(total_return, 2),
        "totalReturnPct": round(total_return_pct, 4),
        "annualizedReturnPct": round(annualised, 4),
        "sharpeRatio": round(sharpe, 4),
        "sortinoRatio": round(sortino, 4),
        "calmarRatio": round(calmar, 4),
        "maxDrawdown": round(max_dd_abs, 2),
        "maxDrawdownPct": round(max_dd_pct, 4),
        "winRate": round(win_rate, 2),
        "profitFactor": round(profit_factor, 4) if math.isfinite(profit_factor) else 999.0,
        "totalTrades": len(trades),
        "winningTrades": len(winning),
        "losingTrades": len(losing),
        "avgWin": round(avg_win, 2),
        "avgLoss": round(avg_loss, 2),
        "avgRR": round(avg_rr, 4),
    }

    return BacktestResult(
        metrics=metrics,
        equity_curve=equity_curve,
        trades=[
            {
                "entryDate": t.entry_date,
                "exitDate": t.exit_date,
                "entryPrice": t.entry_price,
                "exitPrice": t.exit_price,
                "quantity": t.quantity,
                "side": t.side,
                "pnl": t.pnl,
                "pnlPct": t.pnl_pct,
            }
            for t in trades
        ],
        price_data=raw_price_data,
        indicators=indicators,
    )
