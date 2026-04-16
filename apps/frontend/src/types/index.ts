// ─── Phase 1 ─────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'trader';
  fullName?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export type StrategyType =
  | 'manual'
  | 'trend_following'
  | 'mean_reversion'
  | 'breakout'
  | 'scalping'
  | 'other';

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  type: StrategyType;
  isActive: boolean;
  parameters: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type TradeSide   = 'buy' | 'sell';
export type TradeStatus = 'open' | 'closed';

export type ExitReason    = 'TP_HIT' | 'SL_HIT' | 'MANUAL' | 'TIMEOUT' | 'TRAIL_STOP';
export type TradeTimeframe= '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
export type TradeTrend    = 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
export type AssetClass    = 'STOCKS' | 'CRYPTO' | 'FOREX' | 'FUTURES' | 'ETF' | 'OPTIONS';
export type EmotionAtEntry= 'CALM' | 'FOMO' | 'FEAR' | 'REVENGE' | 'CONFIDENT';

export interface Trade {
  id: string;
  userId: string;
  strategyId: string | null;
  ticker: string;
  side: TradeSide;
  status: TradeStatus;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  entryAt: string;
  exitAt: string | null;
  notes: string | null;
  followedStrategy: boolean | null;
  closeNotes: string | null;
  profitLoss: number | null;
  profitLossPct: number | null;
  riskAmount: number | null;
  plannedRR: number | null;
  realizedRR: number | null;
  // Gestão
  stopLoss: number | null;
  takeProfit: number | null;
  exitReason: ExitReason | null;
  // Contexto
  timeframe: TradeTimeframe | null;
  setup: string | null;
  trend: TradeTrend | null;
  assetClass: AssetClass | null;
  // Psicologia
  confidenceLevel: number | null;
  entryQuality: number | null;
  emotionAtEntry: EmotionAtEntry | null;
  movedStop: boolean | null;
  enteredOnTime: boolean | null;
  // Sizing
  capitalPct: number | null;
  commission: number | null;
  slippage: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfitLoss: number;
  totalProfitLossPct: number;
  bestTrade: number | null;
  worstTrade: number | null;
  avgProfitLoss: number | null;
  totalVolume: number;
  // Psychology metrics
  disciplineRate: number;
  tradesFollowed: number;
  tradesNotFollowed: number;
  tradesUntagged: number;
  winRateFollowing: number;
  winRateNotFollowing: number;
  avgPnlFollowing: number | null;
  avgPnlNotFollowing: number | null;
  totalPnlFollowing: number;
  totalPnlNotFollowing: number;
}

export interface DashboardInsights {
  // Performance Temporal
  pnlByDayOfWeek: { day: string; pnl: number; trades: number; winRate: number }[];
  pnlByHour: { hour: number; pnl: number; trades: number; winRate: number }[];
  pnlByMonth: { month: string; pnl: number; trades: number; winRate: number }[];
  disciplineByMonth: { month: string; rate: number; followed: number; tagged: number }[];
  // Gestão de Risco
  avgHoldingTimeHours: number | null;
  longOpenTrades: number;
  buyCount: number;
  sellCount: number;
  topTickers: { ticker: string; pnl: number; trades: number; volume: number; winRate: number }[];
  slHitRate: number;
  tpHitRate: number;
  avgPlannedRR: number | null;
  avgRealizedRR: number | null;
  avgSlippage: number | null;
  avgCommission: number | null;
  // Psicologia
  avgConfidenceLevel: number | null;
  emotionBreakdown: { emotion: string; count: number; winRate: number; avgPnl: number }[];
  avgEntryQuality: number | null;
  movedStopCount: number;
  enteredOnTimeRate: number;
  // Contexto
  timeframeBreakdown: { timeframe: string; count: number; winRate: number; pnl: number }[];
  mostProfitableSetup: { setup: string; pnl: number; winRate: number } | null;
  assetClassBreakdown: { assetClass: string; count: number; winRate: number; pnl: number }[];
  trendBreakdown: { trend: string; count: number; winRate: number; pnl: number }[];
  // Sizing
  avgCapitalPct: number | null;
  totalCommissionPaid: number;
  totalSlippageLost: number;
  // Aprendizado
  tradesWithNotes: number;
  tradesWithoutNotes: number;
  winRateByStrategyType: { type: string; winRate: number; trades: number; pnl: number }[];
  disciplineBreaksWon: number;
  disciplineBreaksTotal: number;
  expectedValue: number | null;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  path: string;
  timestamp: string;
}

// ─── Phase 2 ─────────────────────────────────────────────────────────────────

export type BacktestStrategyType = 'sma_crossover' | 'rsi' | 'buy_and_hold' | 'multi_indicator';
export type BacktestStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturnPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  avgRR: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

export interface BacktestTradeResult {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'buy' | 'sell';
  pnl: number;
  pnlPct: number;
}

export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface IndicatorPoint {
  date?: string;
  value?: number;
  // MACD / Stochastic secondary lines
  signal?: number;
  histogram?: number;
  // Bollinger Bands
  upper?: number;
  lower?: number;
  // Pivot Points
  r2?: number;
  r1?: number;
  pivot?: number;
  s1?: number;
  s2?: number;
  // Volume Profile — meta record (first element, type === 'meta')
  type?: 'meta' | 'bin';
  poc?: number;
  vah?: number;
  val?: number;
  // Volume Profile — bin records (type === 'bin')
  price?: number;
  volume_pct?: number;
  is_hvn?: boolean;
  is_lvn?: boolean;
}

export interface BacktestResults {
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: BacktestTradeResult[];
  priceData: PricePoint[];
  indicators: Record<string, IndicatorPoint[]>;
}

export interface BacktestJob {
  id: string;
  userId: string;
  strategyId: string | null;
  symbol: string;
  strategyType: BacktestStrategyType;
  strategyParams: Record<string, unknown> | null;
  startDate: string;
  endDate: string;
  initialCapital: number;
  brokerageRate: number;
  timeframe: string;
  indicators: Array<{ name: string; params: Record<string, unknown> }> | null;
  status: BacktestStatus;
  errorMessage: string | null;
  results: BacktestResults | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── DCA ─────────────────────────────────────────────────────────────────────

export interface DCAEquityPoint {
  date: string;
  value: number;
  invested: number;
}

export interface DCAPurchase {
  date: string;
  price: number;
  amount: number;
  shares: number;
  bought?: boolean;
}

export interface DCAStrategyResult {
  name: string;
  strategyType: 'fixed' | 'lump_sum' | 'conditional';
  totalInvested: number;
  finalValue: number;
  totalReturn: number;
  totalReturnPct: number;
  avgCostBasis: number;
  sharesOwned: number;
  nPurchases: number;
  nSkipped?: number;
  purchases: DCAPurchase[];
  equityCurve: DCAEquityPoint[];
}

export interface DCAResults {
  strategies: DCAStrategyResult[];
  priceData: PricePoint[];
}

export type DCAStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DCAJob {
  id: string;
  userId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  amountPerPeriod: number;
  period: string;
  dayOfMonth: number;
  conditions: Array<{ indicator: string; operator: string; value: number }> | null;
  conditionLogic: string;
  indicators: Array<{ name: string; params: Record<string, unknown> }> | null;
  status: DCAStatus;
  errorMessage: string | null;
  results: DCAResults | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ticker {
  id: string;
  symbol: string;
  name: string | null;
  assetType: string | null;
  exchange: string | null;
  createdAt: string;
}

export interface Candle {
  symbol: string;
  interval: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
