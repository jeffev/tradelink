"""Backtesting worker — FastAPI application.

Endpoints:
  POST /run-backtest   — Run a backtest and return results
  POST /fetch-candles  — Fetch OHLCV data from Yahoo Finance and return it
  GET  /health         — Health check
"""

from __future__ import annotations

import logging
import re
from datetime import date
from typing import Any

import pandas as pd
import io

import requests
import yfinance as yf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from backtester import run_backtest
from dca_engine import run_dca
from indicators import calculate_indicators
from scanner import run_scanner

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from curl_cffi import requests as curl_requests
    _CURL_SESSION = curl_requests.Session(impersonate="chrome")
    logger.info("curl_cffi session ready — yfinance will use it")
except ImportError:
    _CURL_SESSION = None
    logger.warning("curl_cffi not available — yfinance may be blocked for intraday data")

app = FastAPI(title="Tradelink Backtesting Worker", version="2.0.0")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

# Symbols end up in stooq/Yahoo URLs: only ticker characters are accepted
# (AAPL, PETR4.SA, BTC-USD, EURUSD=X, ^BVSP).
SYMBOL_RE = re.compile(r"^[A-Za-z0-9^][A-Za-z0-9.=^-]{0,19}$")
MAX_RANGE_DAYS = 20 * 366
TIMEFRAMES = ("1d", "1w", "1mo", "1h", "15m")


class MarketRequest(BaseModel):
    """Symbol + date range shared by every endpoint that downloads prices."""

    symbol: str
    start_date: str          # YYYY-MM-DD
    end_date: str            # YYYY-MM-DD

    @field_validator("symbol")
    @classmethod
    def _check_symbol(cls, v: str) -> str:
        v = v.strip()
        if not SYMBOL_RE.fullmatch(v):
            raise ValueError("invalid symbol")
        return v

    @field_validator("start_date", "end_date")
    @classmethod
    def _check_date(cls, v: str) -> str:
        return date.fromisoformat(v[:10]).isoformat()

    @model_validator(mode="after")
    def _check_range(self):
        days = (date.fromisoformat(self.end_date) - date.fromisoformat(self.start_date)).days
        if days < 0:
            raise ValueError("end_date must be after start_date")
        if days > MAX_RANGE_DAYS:
            raise ValueError(f"date range too long (max {MAX_RANGE_DAYS} days)")
        return self


class IndicatorConfig(BaseModel):
    name: str = Field(max_length=40)
    params: dict[str, Any] = {}


class RunBacktestRequest(MarketRequest):
    strategy_type: str
    strategy_params: dict[str, Any] = {}
    initial_capital: float = Field(10_000.0, gt=0, le=1e12)
    brokerage_rate: float = Field(0.0, ge=0, le=0.1)
    timeframe: str = "1d"
    indicators: list[IndicatorConfig] | None = Field(None, max_length=15)

    @field_validator("timeframe")
    @classmethod
    def _check_timeframe(cls, v: str) -> str:
        if v not in TIMEFRAMES:
            raise ValueError(f"timeframe must be one of {TIMEFRAMES}")
        return v


class FetchCandlesRequest(MarketRequest):
    interval: str = "1d"

    @field_validator("interval")
    @classmethod
    def _check_interval(cls, v: str) -> str:
        if v not in TIMEFRAMES:
            raise ValueError(f"interval must be one of {TIMEFRAMES}")
        return v


class CalculateIndicatorsRequest(MarketRequest):
    indicators: list[IndicatorConfig] = Field(max_length=15)
    timeframe: str = "1d"

    @field_validator("timeframe")
    @classmethod
    def _check_timeframe(cls, v: str) -> str:
        if v not in TIMEFRAMES:
            raise ValueError(f"timeframe must be one of {TIMEFRAMES}")
        return v


class DCACondition(BaseModel):
    indicator: str = Field(max_length=40)
    operator: str = Field(max_length=20)
    value: float


class RunDCARequest(MarketRequest):
    amount_per_period: float = Field(500.0, gt=0, le=1e12)
    period: str = "monthly"          # weekly | biweekly | monthly | quarterly
    day_of_month: int = Field(1, ge=1, le=28)
    conditions: list[DCACondition] | None = Field(None, max_length=10)
    condition_logic: str = "AND"
    indicators: list[IndicatorConfig] | None = Field(None, max_length=15)


class FilterCondition(BaseModel):
    indicator: str = Field(max_length=40)
    params: dict[str, Any] = {}
    operator: str = Field(max_length=20)
    value: float | None = None


class RunScannerRequest(MarketRequest):
    conditions: list[FilterCondition] = Field(max_length=20)
    logic: str = "AND"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

INTERVAL_MAP = {
    "1d": "1d",
    "1w": "1wk",
    "1mo": "1mo",
    "1h": "1h",
    "15m": "15m",
}

# pandas resample rules for intervals stooq fetches as daily then we resample
RESAMPLE_RULES: dict[str, str] = {
    "1w": "W",
    "1mo": "ME",
}


def _normalise_df(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise column names and strip timezone from index."""
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df.columns = [c.lower() for c in df.columns]
    needed = [c for c in ["open", "high", "low", "close", "volume"] if c in df.columns]
    df = df[needed].copy()
    if "volume" not in df.columns:
        df["volume"] = 0.0
    df.index = pd.to_datetime(df.index)
    if df.index.tz is not None:
        df.index = df.index.tz_convert(None)
    return df.sort_index()


def _fetch_stooq(symbol: str, start: str, end: str) -> pd.DataFrame:
    """Fetch daily OHLCV from stooq via direct CSV URL (no pandas_datareader needed)."""
    d1 = start.replace("-", "")
    d2 = end.replace("-", "")
    for sym in [f"{symbol}.US", symbol]:
        try:
            params = {"s": sym.lower(), "d1": d1, "d2": d2, "i": "d"}
            logger.info("Trying stooq for %s", sym)
            resp = requests.get("https://stooq.com/q/d/l/", params=params, timeout=15)
            resp.raise_for_status()
            df = pd.read_csv(io.StringIO(resp.text), index_col="Date", parse_dates=True)
            if not df.empty and "No data" not in resp.text:
                logger.info(f"stooq success: got {len(df)} rows for {sym}")
                return _normalise_df(df)
            logger.warning(f"stooq({sym}) returned empty or no-data response")
        except Exception as exc:
            logger.warning("stooq(%s) failed: %s", sym, exc)
    logger.warning("stooq: no data available for any symbol variant")
    return pd.DataFrame()


def _fetch_yfinance(symbol: str, start: str, end: str, interval: str) -> pd.DataFrame:
    """Fetch OHLCV from Yahoo Finance via yfinance.
    Uses curl_cffi session when available to bypass Yahoo Finance bot detection.
    Falls back to plain requests if session triggers YFTzMissingError.
    """
    yf_interval = INTERVAL_MAP.get(interval, "1d")
    base_kwargs: dict[str, Any] = dict(
        start=start, end=end, interval=yf_interval,
        auto_adjust=True, progress=False,
    )

    attempts = [
        {**base_kwargs, "session": _CURL_SESSION} if _CURL_SESSION is not None else base_kwargs,
        base_kwargs,  # plain requests fallback (no session)
    ]

    for i, kwargs in enumerate(attempts):
        try:
            attempt_num = i + 1
            logger.info(f"yfinance attempt {attempt_num} for {symbol} interval={yf_interval}")
            df: pd.DataFrame = yf.download(symbol, **kwargs)
            if not df.empty:
                logger.info(f"yfinance attempt {attempt_num} success: got {len(df)} rows for {symbol}")
                return _normalise_df(df)
            else:
                logger.warning(f"yfinance attempt {attempt_num} returned empty dataframe for {symbol}")
        except Exception as exc:
            logger.warning("yfinance attempt %d failed for %s: %s", i + 1, symbol, exc)

    logger.warning(f"yfinance: no data available for {symbol} after all attempts")
    return pd.DataFrame()


def _resample_df(df: pd.DataFrame, rule: str) -> pd.DataFrame:
    """Resample a daily DataFrame to weekly or monthly bars."""
    agg = {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    return df.resample(rule).agg(agg).dropna(subset=["close"])


# Maximum history (in days) that yfinance reliably returns per interval
_INTRADAY_MAX_DAYS = {"1h": 730, "15m": 60}


def _fetch_df(symbol: str, start: str, end: str, interval: str = "1d") -> pd.DataFrame:
    """Fetch OHLCV data for the given interval.

    Strategy:
    - Daily / weekly / monthly: fetch daily from stooq, then resample if needed.
    - Intraday (1h, 15m): yfinance only (requires curl_cffi to bypass bot detection).
    - If stooq fails for any reason, fall back to yfinance.
    """
    # Validate intraday date range against yfinance limits
    if interval in _INTRADAY_MAX_DAYS:
        from datetime import date
        days = (date.fromisoformat(end) - date.fromisoformat(start)).days
        max_days = _INTRADAY_MAX_DAYS[interval]
        if days > max_days:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Interval '{interval}' supports at most {max_days} days of history "
                    f"(requested {days} days). Reduce the date range."
                ),
            )

    df = pd.DataFrame()
    resample_rule = RESAMPLE_RULES.get(interval)

    if interval in ("1d", "1w", "1mo"):
        df = _fetch_stooq(symbol, start, end)
        if not df.empty and resample_rule:
            df = _resample_df(df, resample_rule)

    if df.empty:
        logger.info("Falling back to yfinance for %s interval=%s", symbol, interval)
        df = _fetch_yfinance(symbol, start, end, interval)

    if df.empty:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No data found for '{symbol}' between {start} and {end}. "
                "Check the symbol (e.g. AAPL, MSFT, BTC-USD) and date range."
            ),
        )
    return df


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/run-backtest")
def run_backtest_endpoint(req: RunBacktestRequest) -> dict[str, Any]:
    logger.info(
        "Backtest request: symbol=%s strategy=%s period=%s→%s",
        req.symbol,
        req.strategy_type,
        req.start_date,
        req.end_date,
    )

    try:
        df = _fetch_df(req.symbol, req.start_date, req.end_date, req.timeframe)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch data")
        raise HTTPException(status_code=502, detail=f"Data fetch error: {exc}") from exc

    try:
        result = run_backtest(
            df=df,
            strategy_type=req.strategy_type,
            strategy_params=req.strategy_params,
            initial_capital=req.initial_capital,
            brokerage_rate=req.brokerage_rate,
            indicators_config=[{"name": ind.name, "params": ind.params} for ind in (req.indicators or [])],
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Backtest engine error")
        raise HTTPException(status_code=500, detail=f"Backtest error: {exc}") from exc

    return {
        "metrics": result.metrics,
        "equityCurve": result.equity_curve,
        "trades": result.trades,
        "priceData": result.price_data,
        "indicators": result.indicators,
    }


@app.post("/fetch-candles")
def fetch_candles_endpoint(req: FetchCandlesRequest) -> dict[str, Any]:
    logger.info("Fetch candles: %s %s %s→%s", req.symbol, req.interval, req.start_date, req.end_date)

    try:
        df = _fetch_df(req.symbol, req.start_date, req.end_date, req.interval)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Data fetch error: {exc}") from exc

    candles = [
        {
            "timestamp": str(idx.date()),
            "open": round(float(row["open"]), 8),
            "high": round(float(row["high"]), 8),
            "low": round(float(row["low"]), 8),
            "close": round(float(row["close"]), 8),
            "volume": round(float(row["volume"]), 2),
        }
        for idx, row in df.iterrows()
    ]

    return {"symbol": req.symbol.upper(), "interval": req.interval, "candles": candles}


@app.post("/calculate-indicators")
def calculate_indicators_endpoint(req: CalculateIndicatorsRequest) -> dict[str, Any]:
    logger.info(
        "Calculate indicators: symbol=%s indicators=%s period=%s→%s",
        req.symbol,
        [i.name for i in req.indicators],
        req.start_date,
        req.end_date,
    )

    try:
        df = _fetch_df(req.symbol, req.start_date, req.end_date, req.timeframe)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Data fetch error: {exc}") from exc

    indicator_configs = [{"name": i.name, "params": i.params} for i in req.indicators]

    try:
        ind_results = calculate_indicators(df, indicator_configs)
    except Exception as exc:
        logger.exception("Indicator calculation error")
        raise HTTPException(status_code=500, detail=f"Calculation error: {exc}") from exc

    price_data = [
        {
            "date": str(idx.date()),
            "open": round(float(row["open"]), 8),
            "high": round(float(row["high"]), 8),
            "low": round(float(row["low"]), 8),
            "close": round(float(row["close"]), 8),
        }
        for idx, row in df.iterrows()
    ]

    return {
        "symbol": req.symbol.upper(),
        "priceData": price_data,
        "indicators": ind_results,
    }


@app.post("/run-dca")
def run_dca_endpoint(req: RunDCARequest) -> dict[str, Any]:
    logger.info(
        "DCA request: symbol=%s period=%s amount=%.2f %s→%s",
        req.symbol, req.period, req.amount_per_period, req.start_date, req.end_date,
    )

    try:
        df = _fetch_df(req.symbol, req.start_date, req.end_date, "1d")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("DCA data fetch error")
        raise HTTPException(status_code=502, detail=f"Data fetch error: {exc}") from exc

    conditions = [c.model_dump() for c in (req.conditions or [])] or None
    indicators_config = [{"name": i.name, "params": i.params} for i in (req.indicators or [])] or None

    try:
        strategies = run_dca(
            df=df,
            amount_per_period=req.amount_per_period,
            period=req.period,
            day_of_month=req.day_of_month,
            conditions=conditions,
            condition_logic=req.condition_logic,
            indicators_config=indicators_config,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("DCA engine error")
        raise HTTPException(status_code=500, detail=f"DCA error: {exc}") from exc

    # Build price data for chart
    price_data = [
        {
            "date": str(idx.date()),
            "open": round(float(row["open"]), 4),
            "high": round(float(row["high"]), 4),
            "low": round(float(row["low"]), 4),
            "close": round(float(row["close"]), 4),
        }
        for idx, row in df.iterrows()
    ]

    return {"strategies": strategies, "priceData": price_data}


@app.post("/run-scanner")
def run_scanner_endpoint(req: RunScannerRequest) -> dict[str, Any]:
    logger.info("Scanner: symbol=%s conditions=%d logic=%s", req.symbol, len(req.conditions), req.logic)

    try:
        df = _fetch_df(req.symbol, req.start_date, req.end_date)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Data fetch error: {exc}") from exc

    conditions = [c.model_dump() for c in req.conditions]

    try:
        passed, indicator_values = run_scanner(df, conditions, req.logic)
    except Exception as exc:
        logger.exception("Scanner error")
        raise HTTPException(status_code=500, detail=f"Scanner error: {exc}") from exc

    return {"symbol": req.symbol.upper(), "passed": passed, "indicatorValues": indicator_values}
