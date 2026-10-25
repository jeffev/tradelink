import { BadRequestException } from '@nestjs/common';

/**
 * Ticker symbols as Yahoo/stooq know them: AAPL, PETR4.SA, BTC-USD, EURUSD=X, ^BVSP.
 * Symbols end up in the worker's data-source URLs, so nothing else is accepted.
 */
export const SYMBOL_PATTERN = /^[A-Za-z0-9^][A-Za-z0-9.=^-]{0,19}$/;
export const SYMBOL_MESSAGE =
  'symbol must look like AAPL, PETR4.SA, BTC-USD, EURUSD=X or ^BVSP';

export const TIMEFRAMES = ['1d', '1w', '1mo', '1h', '15m'] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Longest history a backtest, DCA or indicator chart may request (~20 years). */
export const MAX_HISTORY_DAYS = 20 * 366;

/** Rejects reversed or oversized ranges before any work is queued. */
export function assertDateRange(
  startDate: string,
  endDate: string,
  maxDays = MAX_HISTORY_DAYS,
): void {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new BadRequestException('startDate and endDate must be valid dates');
  }
  if (end < start) {
    throw new BadRequestException('endDate must be after startDate');
  }
  if (end - start > maxDays * DAY_MS) {
    throw new BadRequestException(
      `Date range too long: at most ${Math.floor(maxDays / 365)} years`,
    );
  }
}
