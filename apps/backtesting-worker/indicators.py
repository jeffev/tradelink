"""Technical indicator calculations using pandas/numpy (no TA-Lib required)."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Core calculation helpers
# ---------------------------------------------------------------------------


def _sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period).mean()


def _ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100.0 - (100.0 / (1.0 + rs))


def _macd(
    series: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    ema_fast = _ema(series, fast)
    ema_slow = _ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = _ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def _bollinger_bands(
    series: pd.Series,
    period: int = 20,
    num_std: float = 2.0,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    middle = _sma(series, period)
    std_dev = series.rolling(window=period).std()
    upper = middle + num_std * std_dev
    lower = middle - num_std * std_dev
    return upper, middle, lower


def _atr(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
) -> pd.Series:
    tr = pd.concat(
        [
            high - low,
            (high - close.shift()).abs(),
            (low - close.shift()).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.ewm(com=period - 1, min_periods=period).mean()


def _stochastic(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    k_period: int = 14,
    d_period: int = 3,
) -> tuple[pd.Series, pd.Series]:
    lowest_low = low.rolling(window=k_period).min()
    highest_high = high.rolling(window=k_period).max()
    denom = (highest_high - lowest_low).replace(0, np.nan)
    k = 100.0 * (close - lowest_low) / denom
    d = _sma(k, d_period)
    return k, d


def _cci(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 20,
) -> pd.Series:
    """Commodity Channel Index"""
    tp = (high + low + close) / 3.0
    sma_tp = tp.rolling(window=period).mean()
    mad = tp.rolling(window=period).apply(
        lambda x: np.abs(x - x.mean()).mean()
    )
    cci = (tp - sma_tp) / (0.015 * mad)
    return cci.replace([np.inf, -np.inf], np.nan)


def _adx(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
) -> pd.Series:
    """Average Directional Index (simplified)"""
    plus_dm = high.diff()
    minus_dm = -low.diff()
    plus_dm = plus_dm.where(plus_dm > 0, 0)
    minus_dm = minus_dm.where(minus_dm > 0, 0)

    tr = pd.concat(
        [
            high - low,
            (high - close.shift()).abs(),
            (low - close.shift()).abs(),
        ],
        axis=1,
    ).max(axis=1)

    atr = tr.ewm(com=period - 1, min_periods=period).mean()
    plus_di = 100 * (plus_dm.ewm(com=period - 1, min_periods=period).mean() / atr)
    minus_di = 100 * (minus_dm.ewm(com=period - 1, min_periods=period).mean() / atr)
    di_diff = (plus_di - minus_di).abs()
    di_sum = plus_di + minus_di
    di_sum = di_sum.replace(0, np.nan)
    dx = 100 * (di_diff / di_sum)
    adx = dx.ewm(com=period - 1, min_periods=period).mean()
    return adx


def _obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    """On-Balance Volume"""
    obv = pd.Series(index=close.index, dtype=float)
    obv.iloc[0] = 0
    for i in range(1, len(close)):
        if close.iloc[i] > close.iloc[i - 1]:
            obv.iloc[i] = obv.iloc[i - 1] + volume.iloc[i]
        elif close.iloc[i] < close.iloc[i - 1]:
            obv.iloc[i] = obv.iloc[i - 1] - volume.iloc[i]
        else:
            obv.iloc[i] = obv.iloc[i - 1]
    return obv


def _vwap(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    volume: pd.Series,
) -> pd.Series:
    """Volume Weighted Average Price"""
    tp = (high + low + close) / 3.0
    cum_vtp = (tp * volume).cumsum()
    cum_vol = volume.cumsum()
    vwap = cum_vtp / cum_vol
    return vwap


def _williams_r(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
) -> pd.Series:
    """Williams %R Indicator"""
    highest_high = high.rolling(window=period).max()
    lowest_low = low.rolling(window=period).min()
    wr = -100.0 * (highest_high - close) / (highest_high - lowest_low)
    return wr.replace([np.inf, -np.inf], np.nan)


def _ichimoku(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series, pd.Series]:
    """Ichimoku Cloud (Tenkan, Kijun, Senkou Span A, Senkou Span B, Chikou)"""
    # Tenkan (9-period max/min)
    tenkan = (
        (high.rolling(window=9).max() + low.rolling(window=9).min()) / 2.0
    )
    # Kijun (26-period max/min)
    kijun = (
        (high.rolling(window=26).max() + low.rolling(window=26).min()) / 2.0
    )
    # Senkou Span A (midpoint of Tenkan + Kijun, shifted 26 forward)
    senkou_a = ((tenkan + kijun) / 2.0).shift(26)
    # Senkou Span B (52-period max/min, shifted 26 forward)
    senkou_b = (
        (high.rolling(window=52).max() + low.rolling(window=52).min()) / 2.0
    ).shift(26)
    # Chikou (close shifted 26 backward)
    chikou = close.shift(-26)

    return tenkan, kijun, senkou_a, senkou_b, chikou


def _parabolic_sar(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    iaf: float = 0.02,
    max_af: float = 0.2,
) -> pd.Series:
    """Parabolic SAR (simplified)"""
    sar = pd.Series(index=close.index, dtype=float)
    af = iaf
    uptrend = True
    hp = high.iloc[0]
    lp = low.iloc[0]
    sar.iloc[0] = low.iloc[0]

    for i in range(1, len(close)):
        if uptrend:
            sar.iloc[i] = sar.iloc[i - 1] + af * (hp - sar.iloc[i - 1])
            if low.iloc[i] < sar.iloc[i]:
                uptrend = False
                sar.iloc[i] = hp
                lp = low.iloc[i]
                af = iaf
            else:
                if high.iloc[i] > hp:
                    hp = high.iloc[i]
                    af = min(af + iaf, max_af)
        else:
            sar.iloc[i] = sar.iloc[i - 1] - af * (sar.iloc[i - 1] - lp)
            if high.iloc[i] > sar.iloc[i]:
                uptrend = True
                sar.iloc[i] = lp
                hp = high.iloc[i]
                af = iaf
            else:
                if low.iloc[i] < lp:
                    lp = low.iloc[i]
                    af = min(af + iaf, max_af)

    return sar


def _pivot_points(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series, pd.Series]:
    """Classic Pivot Points: R2, R1, Pivot, S1, S2"""
    pivot = (high + low + close) / 3.0
    r1 = 2 * pivot - low
    s1 = 2 * pivot - high
    r2 = pivot + (high - low)
    s2 = pivot - (high - low)

    return r2, r1, pivot, s1, s2


def _calc_vp_levels(
    df: pd.DataFrame, num_bins: int = 50
) -> tuple[float, float, float] | None:
    """Calculate POC, VAH, VAL for a DataFrame slice.

    Returns (poc_price, vah, val) or None if volume data is insufficient.
    """
    price_min = float(df["low"].min())
    price_max = float(df["high"].max())
    if price_max <= price_min or df.empty:
        return None

    bin_size = (price_max - price_min) / num_bins
    bins = np.zeros(num_bins)

    for _, row in df.iterrows():
        candle_low = float(row["low"])
        candle_high = float(row["high"])
        candle_volume = float(row["volume"])
        if candle_volume <= 0:
            continue
        low_bin = max(0, int((candle_low - price_min) / bin_size))
        high_bin = min(num_bins - 1, int((candle_high - price_min) / bin_size))
        span = high_bin - low_bin + 1
        bins[low_bin : high_bin + 1] += candle_volume / span

    if bins.sum() == 0:
        return None

    # POC — bucket with highest volume
    poc_idx = int(np.argmax(bins))
    poc_price = price_min + (poc_idx + 0.5) * bin_size

    # Value Area — expand from POC until 70 % of total volume is covered
    total_volume = bins.sum()
    target = total_volume * 0.70
    va_low = poc_idx
    va_high = poc_idx
    va_vol = bins[poc_idx]

    while va_vol < target:
        can_expand_low = va_low > 0
        can_expand_high = va_high < num_bins - 1
        if not can_expand_low and not can_expand_high:
            break
        vol_below = bins[va_low - 1] if can_expand_low else -1.0
        vol_above = bins[va_high + 1] if can_expand_high else -1.0
        if vol_above >= vol_below:
            va_high += 1
            va_vol += bins[va_high]
        else:
            va_low -= 1
            va_vol += bins[va_low]

    vah = price_min + (va_high + 1) * bin_size
    val = price_min + va_low * bin_size

    return poc_price, vah, val


def _volume_profile(
    df: pd.DataFrame, num_bins: int = 50, period: str = "month"
) -> list[dict]:
    """Period-based Volume Profile.

    Calculates a separate POC / VAH / VAL for each period window
    (week / month / quarter / year / full) and returns a time series
    [{date, poc, vah, val}] — one entry per candle — so the three levels
    render as step lines on the price chart.
    """
    _PERIOD_MAP = {"week": "W", "month": "M", "quarter": "Q", "year": "A"}
    freq = _PERIOD_MAP.get(period)  # None → full period

    result: list[dict] = []

    if freq is None:
        levels = _calc_vp_levels(df, num_bins)
        if levels:
            poc, vah, val = levels
            for idx in df.index:
                result.append({
                    "date": _date_str(idx),
                    "poc": round(poc, 4),
                    "vah": round(vah, 4),
                    "val": round(val, 4),
                })
    else:
        for _, group_df in df.groupby(df.index.to_period(freq)):
            if group_df.empty:
                continue
            levels = _calc_vp_levels(group_df, num_bins)
            if not levels:
                continue
            poc, vah, val = levels
            for idx in group_df.index:
                result.append({
                    "date": _date_str(idx),
                    "poc": round(poc, 4),
                    "vah": round(vah, 4),
                    "val": round(val, 4),
                })

    return result


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------


def _date_str(idx: pd.Timestamp) -> str:
    return str(idx.date())


def _to_list(index: pd.Index, series: pd.Series) -> list[dict]:
    return [
        {"date": _date_str(idx), "value": round(float(v), 6)}
        for idx, v in zip(index, series)
        if not pd.isna(v)
    ]


def _to_macd_list(
    index: pd.Index,
    macd: pd.Series,
    signal: pd.Series,
    histogram: pd.Series,
) -> list[dict]:
    result = []
    for idx, m, s, h in zip(index, macd, signal, histogram):
        if not (pd.isna(m) or pd.isna(s) or pd.isna(h)):
            result.append(
                {
                    "date": _date_str(idx),
                    "value": round(float(m), 6),
                    "signal": round(float(s), 6),
                    "histogram": round(float(h), 6),
                }
            )
    return result


def _to_bb_list(
    index: pd.Index,
    upper: pd.Series,
    middle: pd.Series,
    lower: pd.Series,
) -> list[dict]:
    result = []
    for idx, u, m, l in zip(index, upper, middle, lower):
        if not (pd.isna(u) or pd.isna(m) or pd.isna(l)):
            result.append(
                {
                    "date": _date_str(idx),
                    "upper": round(float(u), 6),
                    "value": round(float(m), 6),
                    "lower": round(float(l), 6),
                }
            )
    return result


def _to_stoch_list(
    index: pd.Index,
    k: pd.Series,
    d: pd.Series,
) -> list[dict]:
    result = []
    for idx, kv, dv in zip(index, k, d):
        if not (pd.isna(kv) or pd.isna(dv)):
            result.append(
                {
                    "date": _date_str(idx),
                    "value": round(float(kv), 6),
                    "signal": round(float(dv), 6),
                }
            )
    return result


def _to_ichimoku_list(
    index: pd.Index,
    tenkan: pd.Series,
    kijun: pd.Series,
    senkou_a: pd.Series,
    senkou_b: pd.Series,
    chikou: pd.Series,
) -> list[dict]:
    result = []
    for idx, t, k, sa, sb, ch in zip(index, tenkan, kijun, senkou_a, senkou_b, chikou):
        if not (pd.isna(t) or pd.isna(k)):
            result.append(
                {
                    "date": _date_str(idx),
                    "tenkan": round(float(t), 6) if not pd.isna(t) else None,
                    "kijun": round(float(k), 6) if not pd.isna(k) else None,
                    "senkou_a": round(float(sa), 6) if not pd.isna(sa) else None,
                    "senkou_b": round(float(sb), 6) if not pd.isna(sb) else None,
                    "chikou": round(float(ch), 6) if not pd.isna(ch) else None,
                }
            )
    return result


def _to_pivot_list(
    index: pd.Index,
    r2: pd.Series,
    r1: pd.Series,
    pivot: pd.Series,
    s1: pd.Series,
    s2: pd.Series,
) -> list[dict]:
    result = []
    for idx, r2_v, r1_v, p, s1_v, s2_v in zip(index, r2, r1, pivot, s1, s2):
        if not (pd.isna(p)):
            result.append(
                {
                    "date": _date_str(idx),
                    "r2": round(float(r2_v), 6),
                    "r1": round(float(r1_v), 6),
                    "pivot": round(float(p), 6),
                    "s1": round(float(s1_v), 6),
                    "s2": round(float(s2_v), 6),
                }
            )
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def calculate_indicators(
    df: pd.DataFrame,
    indicator_configs: list[dict[str, Any]],
) -> dict[str, list[dict]]:
    """Calculate multiple indicators for a DataFrame.

    Returns a mapping of indicator_key -> serialised data points.
    """
    results: dict[str, list[dict]] = {}
    seen: set[str] = set()

    for config in indicator_configs:
        name = config.get("name", "").upper()
        params: dict[str, Any] = config.get("params", {})

        if name == "SMA":
            period = int(params.get("period", 20))
            src = params.get("source", "close")
            series = df[src] if src in df.columns else df["close"]
            key = f"SMA_{period}"
            if key not in seen:
                results[key] = _to_list(df.index, _sma(series, period))
                seen.add(key)

        elif name == "EMA":
            period = int(params.get("period", 20))
            src = params.get("source", "close")
            series = df[src] if src in df.columns else df["close"]
            key = f"EMA_{period}"
            if key not in seen:
                results[key] = _to_list(df.index, _ema(series, period))
                seen.add(key)

        elif name == "RSI":
            period = int(params.get("period", 14))
            key = f"RSI_{period}"
            if key not in seen:
                results[key] = _to_list(df.index, _rsi(df["close"], period))
                seen.add(key)

        elif name == "MACD":
            fast = int(params.get("fast", 12))
            slow = int(params.get("slow", 26))
            sig = int(params.get("signal", 9))
            key = f"MACD_{fast}_{slow}_{sig}"
            if key not in seen:
                macd_l, sig_l, hist = _macd(df["close"], fast, slow, sig)
                results[key] = _to_macd_list(df.index, macd_l, sig_l, hist)
                seen.add(key)

        elif name == "BB":
            period = int(params.get("period", 20))
            num_std = float(params.get("std", 2.0))
            key = f"BB_{period}"
            if key not in seen:
                upper, middle, lower = _bollinger_bands(df["close"], period, num_std)
                results[key] = _to_bb_list(df.index, upper, middle, lower)
                seen.add(key)

        elif name == "ATR":
            period = int(params.get("period", 14))
            key = f"ATR_{period}"
            if key not in seen:
                results[key] = _to_list(
                    df.index, _atr(df["high"], df["low"], df["close"], period)
                )
                seen.add(key)

        elif name == "STOCH":
            k_period = int(params.get("k_period", 14))
            d_period = int(params.get("d_period", 3))
            key = f"STOCH_{k_period}_{d_period}"
            if key not in seen:
                k, d = _stochastic(df["high"], df["low"], df["close"], k_period, d_period)
                results[key] = _to_stoch_list(df.index, k, d)
                seen.add(key)

        elif name == "CCI":
            period = int(params.get("period", 20))
            key = f"CCI_{period}"
            if key not in seen:
                results[key] = _to_list(
                    df.index, _cci(df["high"], df["low"], df["close"], period)
                )
                seen.add(key)

        elif name == "ADX":
            period = int(params.get("period", 14))
            key = f"ADX_{period}"
            if key not in seen:
                results[key] = _to_list(
                    df.index, _adx(df["high"], df["low"], df["close"], period)
                )
                seen.add(key)

        elif name == "OBV":
            key = "OBV"
            if key not in seen:
                results[key] = _to_list(df.index, _obv(df["close"], df["volume"]))
                seen.add(key)

        elif name == "BBPCTB":
            # Bollinger Band %B: (close - lower) / (upper - lower)
            # 0 = at lower band, 1 = at upper band, 0.5 = at middle (SMA)
            period = int(params.get("period", 20))
            num_std = float(params.get("std", 2.0))
            key = f"BBPCTB_{period}"
            if key not in seen:
                upper, _, lower = _bollinger_bands(df["close"], period, num_std)
                bandwidth = (upper - lower).replace(0, np.nan)
                pct_b = (df["close"] - lower) / bandwidth
                results[key] = _to_list(df.index, pct_b)
                seen.add(key)

        elif name == "VWAP":
            key = "VWAP"
            if key not in seen:
                results[key] = _to_list(
                    df.index, _vwap(df["high"], df["low"], df["close"], df["volume"])
                )
                seen.add(key)

        elif name == "SMA_CROSS":
            # Returns SMA overlay line + (close − SMA) crossover series for conditions
            # Condition > 0 means price is above SMA (buy); < 0 means below (sell)
            period = int(params.get("period", 20))
            sma_key = f"SMA_{period}"
            cross_key = f"SMA_CROSS_{period}"
            if cross_key not in seen:
                sma_vals = _sma(df["close"], period)
                if sma_key not in seen:
                    results[sma_key] = _to_list(df.index, sma_vals)
                    seen.add(sma_key)
                results[cross_key] = _to_list(df.index, df["close"] - sma_vals)
                seen.add(cross_key)

        elif name == "VWAP_CROSS":
            # Returns VWAP overlay line + (close − VWAP) crossover series for conditions
            # Condition > 0 means price is above VWAP (buy); < 0 means below (sell)
            vwap_key = "VWAP"
            cross_key = "VWAP_CROSS"
            if cross_key not in seen:
                vwap_vals = _vwap(df["high"], df["low"], df["close"], df["volume"])
                if vwap_key not in seen:
                    results[vwap_key] = _to_list(df.index, vwap_vals)
                    seen.add(vwap_key)
                results[cross_key] = _to_list(df.index, df["close"] - vwap_vals)
                seen.add(cross_key)

        elif name == "WILLIAMS_R":
            period = int(params.get("period", 14))
            key = f"WILLIAMS_R_{period}"
            if key not in seen:
                results[key] = _to_list(
                    df.index, _williams_r(df["high"], df["low"], df["close"], period)
                )
                seen.add(key)

        elif name == "ICHIMOKU":
            key = "ICHIMOKU"
            if key not in seen:
                tenkan, kijun, senkou_a, senkou_b, chikou = _ichimoku(
                    df["high"], df["low"], df["close"]
                )
                results[key] = _to_ichimoku_list(
                    df.index, tenkan, kijun, senkou_a, senkou_b, chikou
                )
                seen.add(key)

        elif name == "SAR":
            iaf = float(params.get("iaf", 0.02))
            max_af = float(params.get("max_af", 0.2))
            key = "SAR"
            if key not in seen:
                results[key] = _to_list(
                    df.index, _parabolic_sar(df["high"], df["low"], df["close"], iaf, max_af)
                )
                seen.add(key)

        elif name == "PIVOT_POINTS":
            key = "PIVOT_POINTS"
            if key not in seen:
                r2, r1, pivot, s1, s2 = _pivot_points(df["high"], df["low"], df["close"])
                results[key] = _to_pivot_list(df.index, r2, r1, pivot, s1, s2)
                seen.add(key)

        elif name == "VOLUME_PROFILE":
            key = "VOLUME_PROFILE"
            if key not in seen:
                # Bounded: the histogram is allocated per call (np.zeros(num_bins)).
                num_bins = min(max(int(params.get("num_bins", 50)), 5), 500)
                vp_period = str(params.get("period", "month"))
                results[key] = _volume_profile(df, num_bins, vp_period)
                seen.add(key)

        elif name == "VOLUME_SMA":
            period = int(params.get("period", 20))
            key = f"VOLUME_SMA_{period}"
            if key not in seen:
                results[key] = _to_list(df.index, _sma(df["volume"], period))
                seen.add(key)

        elif name == "VOLUME_RATIO":
            # volume / SMA(volume, period) — > 1 means above-average volume
            period = int(params.get("period", 20))
            key = f"VOLUME_RATIO_{period}"
            if key not in seen:
                vol_sma = _sma(df["volume"], period)
                ratio = df["volume"] / vol_sma.replace(0, np.nan)
                results[key] = _to_list(df.index, ratio)
                seen.add(key)

        elif name in ("VP_POC_CROSS", "VP_VAH_CROSS", "VP_VAL_CROSS"):
            # close - VP_level per period  (> 0 = price above level, like VWAP_CROSS)
            vp_period = str(params.get("period", "month"))
            key = name
            if key not in seen:
                field = {"VP_POC_CROSS": "poc", "VP_VAH_CROSS": "vah", "VP_VAL_CROSS": "val"}[name]
                vp_data = _volume_profile(df, num_bins=50, period=vp_period)
                level_map: dict[str, float] = {
                    d["date"]: float(d[field])
                    for d in vp_data
                    if "date" in d and field in d
                }
                level_series = pd.Series(
                    {pd.Timestamp(date): val for date, val in level_map.items()},
                    dtype=float,
                ).reindex(df.index)
                results[key] = _to_list(df.index, df["close"] - level_series)
                seen.add(key)

    return results
