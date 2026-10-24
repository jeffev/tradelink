// Fixed content of the visitor account. Prices are NOT here: trades are built
// from the real daily candles stored for each ticker (see DemoService), so the
// journal, the charts and the backtests all tell the same story.

import { AssetClass, TradeTimeframe } from '../trades/trade.entity';
import { StrategyType } from '../strategies/strategy.entity';
import { BacktestStrategyType } from '../backtesting/backtest-job.entity';
import { AlertCondition, AlertType } from '../alerts/price-alert.entity';
import { FilterCondition } from '../filters/filter.entity';

export interface DemoTicker {
  symbol: string;
  name: string;
  assetType: string;
  exchange: string;
  assetClass: AssetClass;
  /** Relative weight when drawing tickers for trades. */
  weight: number;
  /** Fallback price when the candles could not be downloaded. */
  fallbackPrice: number;
}

export const DEMO_TICKERS: DemoTicker[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    assetType: 'stock',
    exchange: 'NASDAQ',
    assetClass: AssetClass.STOCKS,
    weight: 10,
    fallbackPrice: 230,
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    assetType: 'stock',
    exchange: 'NASDAQ',
    assetClass: AssetClass.STOCKS,
    weight: 8,
    fallbackPrice: 430,
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    assetType: 'stock',
    exchange: 'NASDAQ',
    assetClass: AssetClass.STOCKS,
    weight: 10,
    fallbackPrice: 140,
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    assetType: 'stock',
    exchange: 'NASDAQ',
    assetClass: AssetClass.STOCKS,
    weight: 6,
    fallbackPrice: 200,
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    assetType: 'stock',
    exchange: 'NASDAQ',
    assetClass: AssetClass.STOCKS,
    weight: 7,
    fallbackPrice: 250,
  },
  {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    assetType: 'stock',
    exchange: 'NASDAQ',
    assetClass: AssetClass.STOCKS,
    weight: 5,
    fallbackPrice: 580,
  },
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF',
    assetType: 'etf',
    exchange: 'NYSE',
    assetClass: AssetClass.ETF,
    weight: 6,
    fallbackPrice: 570,
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    assetType: 'etf',
    exchange: 'NASDAQ',
    assetClass: AssetClass.ETF,
    weight: 5,
    fallbackPrice: 490,
  },
  {
    symbol: 'BTC-USD',
    name: 'Bitcoin',
    assetType: 'crypto',
    exchange: 'CRYPTO',
    assetClass: AssetClass.CRYPTO,
    weight: 7,
    fallbackPrice: 65000,
  },
  {
    symbol: 'ETH-USD',
    name: 'Ethereum',
    assetType: 'crypto',
    exchange: 'CRYPTO',
    assetClass: AssetClass.CRYPTO,
    weight: 5,
    fallbackPrice: 2600,
  },
  {
    symbol: 'EURUSD=X',
    name: 'EUR/USD',
    assetType: 'forex',
    exchange: 'FX',
    assetClass: AssetClass.FOREX,
    weight: 3,
    fallbackPrice: 1.09,
  },
];

export interface DemoStrategy {
  key: string;
  name: string;
  description: string;
  type: StrategyType;
  isActive: boolean;
  parameters: Record<string, unknown>;
  setups: string[];
  timeframes: TradeTimeframe[];
}

export const DEMO_STRATEGIES: DemoStrategy[] = [
  {
    key: 'pullback',
    name: 'Pullback na média de 20',
    description:
      'Ativo em tendência de alta (preço acima da SMA 50) que recua até a SMA 20. Entrada no candle de rejeição, stop abaixo da mínima, alvo de 2R.',
    type: StrategyType.TREND_FOLLOWING,
    isActive: true,
    parameters: {
      sma_fast: 20,
      sma_trend: 50,
      risk_reward: 2,
      risk_per_trade_pct: 1,
    },
    setups: ['Pullback na SMA 20', 'Pullback na SMA 20 com volume baixo'],
    timeframes: [TradeTimeframe.D1, TradeTimeframe.H4],
  },
  {
    key: 'breakout',
    name: 'Rompimento de topo',
    description:
      'Rompimento da máxima de 20 dias com volume acima da média. Stop no meio da consolidação.',
    type: StrategyType.BREAKOUT,
    isActive: true,
    parameters: { lookback_days: 20, min_volume_ratio: 1.5, risk_reward: 2.5 },
    setups: ['Rompimento de topo de 20 dias', 'Rompimento de triângulo'],
    timeframes: [TradeTimeframe.D1, TradeTimeframe.H4],
  },
  {
    key: 'ifr',
    name: 'IFR 2 — reversão à média',
    description:
      'Compra quando o IFR de 2 períodos fica abaixo de 10 com o preço acima da SMA 200. Saída na máxima dos dois últimos dias.',
    type: StrategyType.MEAN_REVERSION,
    isActive: true,
    parameters: {
      rsi_period: 2,
      entry_below: 10,
      trend_filter_sma: 200,
      max_days: 5,
    },
    setups: ['IFR 2 sobrevendido', 'Divergência de IFR'],
    timeframes: [TradeTimeframe.D1],
  },
  {
    key: 'scalp',
    name: 'Scalp na abertura',
    description:
      'Operações curtas nos primeiros 60 minutos do pregão americano, a favor do gap. Encerrada em agosto: os custos comiam o resultado.',
    type: StrategyType.SCALPING,
    isActive: false,
    parameters: { window_minutes: 60, max_trades_per_day: 3 },
    setups: ['Gap and go', 'Falha de gap'],
    timeframes: [TradeTimeframe.M5, TradeTimeframe.M15],
  },
  {
    key: 'swing-cripto',
    name: 'Swing cripto no 4h',
    description:
      'Cruzamento da EMA 9 sobre a EMA 21 no gráfico de 4 horas, só a favor da tendência do diário.',
    type: StrategyType.TREND_FOLLOWING,
    isActive: true,
    parameters: { ema_fast: 9, ema_slow: 21, timeframe: '4h' },
    setups: ['Cruzamento EMA 9/21', 'Reteste da EMA 21'],
    timeframes: [TradeTimeframe.H4, TradeTimeframe.H1],
  },
];

export const ENTRY_NOTES: string[] = [
  'Entrada conforme o plano, stop técnico abaixo da mínima do candle de sinal.',
  'Setup limpo, volume confirmando. Mantive o tamanho padrão.',
  'Entrei um pouco antes do fechamento do candle — o sinal ainda não estava confirmado.',
  'Mercado geral fraco, reduzi a mão pela metade.',
  'Notícia de resultado na semana: posição menor para atravessar o evento.',
  'Entrada atrasada, o preço já tinha andado quase 1R.',
  'Contexto favorável: índice em alta e setor forte.',
  'Segunda tentativa no mesmo ativo depois de um stop ontem.',
];

export const CLOSE_NOTES_WIN: string[] = [
  'Alvo atingido sem drawdown relevante. Execução de manual.',
  'Saí na parcial e deixei o restante correr com stop no zero a zero.',
  'Movi o stop para o ponto de entrada após 1R; saí no trailing.',
  'Bom trade, mas saí antes do alvo por ansiedade — deixei dinheiro na mesa.',
];

export const CLOSE_NOTES_LOSS: string[] = [
  'Stop respeitado. Faz parte da estatística.',
  'Falso rompimento. O volume não confirmou — devia ter esperado.',
  'Movi o stop para longe e perdi mais do que o planejado. Não repetir.',
  'Saí antes do stop porque o setup perdeu a validade.',
  'Entrada por FOMO, fora do plano. Resultado previsível.',
];

export interface DemoBacktest {
  symbol: string;
  strategyType: BacktestStrategyType;
  strategyParams: Record<string, unknown>;
  indicators: Array<{ name: string; params: Record<string, unknown> }>;
  startDate: string;
  endDate: string;
  initialCapital: number;
  brokerageRate: number;
}

// Fixed dates so identical jobs can reuse results across visitors.
export const DEMO_BACKTESTS: DemoBacktest[] = [
  {
    symbol: 'AAPL',
    strategyType: BacktestStrategyType.SMA_CROSSOVER,
    strategyParams: { fast_period: 20, slow_period: 50 },
    indicators: [
      { name: 'SMA', params: { period: 20 } },
      { name: 'SMA', params: { period: 50 } },
    ],
    startDate: '2020-01-01',
    endDate: '2025-12-31',
    initialCapital: 10000,
    brokerageRate: 0.001,
  },
  {
    symbol: 'NVDA',
    strategyType: BacktestStrategyType.SMA_CROSSOVER,
    strategyParams: { fast_period: 10, slow_period: 30 },
    indicators: [
      { name: 'SMA', params: { period: 10 } },
      { name: 'SMA', params: { period: 30 } },
    ],
    startDate: '2020-01-01',
    endDate: '2025-12-31',
    initialCapital: 10000,
    brokerageRate: 0.001,
  },
  {
    symbol: 'QQQ',
    strategyType: BacktestStrategyType.SMA_CROSSOVER,
    strategyParams: { fast_period: 50, slow_period: 200 },
    indicators: [
      { name: 'SMA', params: { period: 50 } },
      { name: 'SMA', params: { period: 200 } },
    ],
    startDate: '2018-01-01',
    endDate: '2025-12-31',
    initialCapital: 25000,
    brokerageRate: 0.0005,
  },
  {
    symbol: 'SPY',
    strategyType: BacktestStrategyType.BUY_AND_HOLD,
    strategyParams: {},
    indicators: [{ name: 'SMA', params: { period: 200 } }],
    startDate: '2018-01-01',
    endDate: '2025-12-31',
    initialCapital: 25000,
    brokerageRate: 0.0005,
  },
  {
    symbol: 'BTC-USD',
    strategyType: BacktestStrategyType.RSI,
    strategyParams: { rsi_period: 14, oversold: 30, overbought: 70 },
    indicators: [{ name: 'RSI', params: { period: 14 } }],
    startDate: '2021-01-01',
    endDate: '2025-12-31',
    initialCapital: 10000,
    brokerageRate: 0.001,
  },
  {
    symbol: 'MSFT',
    strategyType: BacktestStrategyType.RSI,
    strategyParams: { rsi_period: 14, oversold: 35, overbought: 70 },
    indicators: [{ name: 'RSI', params: { period: 14 } }],
    startDate: '2020-01-01',
    endDate: '2025-12-31',
    initialCapital: 10000,
    brokerageRate: 0.001,
  },
  {
    symbol: 'TSLA',
    strategyType: BacktestStrategyType.SMA_CROSSOVER,
    strategyParams: { fast_period: 20, slow_period: 50 },
    indicators: [
      { name: 'SMA', params: { period: 20 } },
      { name: 'SMA', params: { period: 50 } },
    ],
    startDate: '2020-01-01',
    endDate: '2025-12-31',
    initialCapital: 10000,
    brokerageRate: 0.001,
  },
  {
    symbol: 'ETH-USD',
    strategyType: BacktestStrategyType.BUY_AND_HOLD,
    strategyParams: {},
    indicators: [{ name: 'SMA', params: { period: 50 } }],
    startDate: '2021-01-01',
    endDate: '2025-12-31',
    initialCapital: 10000,
    brokerageRate: 0.001,
  },
];

export interface DemoDCA {
  symbol: string;
  startDate: string;
  endDate: string;
  amountPerPeriod: number;
  period: string;
  dayOfMonth: number;
  conditions: Array<{
    indicator: string;
    operator: string;
    value: number;
  }> | null;
  conditionLogic: string;
  indicators: Array<{ name: string; params: Record<string, unknown> }> | null;
}

export const DEMO_DCAS: DemoDCA[] = [
  {
    symbol: 'SPY',
    startDate: '2018-01-01',
    endDate: '2025-12-31',
    amountPerPeriod: 500,
    period: 'monthly',
    dayOfMonth: 5,
    conditions: null,
    conditionLogic: 'AND',
    indicators: null,
  },
  {
    symbol: 'BTC-USD',
    startDate: '2020-01-01',
    endDate: '2025-12-31',
    amountPerPeriod: 100,
    period: 'weekly',
    dayOfMonth: 1,
    conditions: null,
    conditionLogic: 'AND',
    indicators: null,
  },
  {
    symbol: 'QQQ',
    startDate: '2019-01-01',
    endDate: '2025-12-31',
    amountPerPeriod: 500,
    period: 'monthly',
    dayOfMonth: 1,
    conditions: [{ indicator: 'RSI_14', operator: '<', value: 50 }],
    conditionLogic: 'AND',
    indicators: [{ name: 'RSI', params: { period: 14 } }],
  },
];

export interface DemoFilter {
  name: string;
  description: string;
  logic: string;
  conditions: Omit<FilterCondition, 'id'>[];
  scanSymbols: string[];
}

export const DEMO_FILTERS: DemoFilter[] = [
  {
    name: 'Correção em tendência de alta',
    description:
      'Acima da SMA 50, mas com o IFR abaixo de 45: candidatos a pullback.',
    logic: 'AND',
    conditions: [
      {
        indicator: 'SMA',
        params: { period: 50 },
        operator: 'price_above_sma',
        value: null,
      },
      { indicator: 'RSI', params: { period: 14 }, operator: 'lt', value: 45 },
    ],
    scanSymbols: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'SPY'],
  },
  {
    name: 'Momentum forte',
    description: 'IFR acima de 60 e MACD positivo.',
    logic: 'AND',
    conditions: [
      { indicator: 'RSI', params: { period: 14 }, operator: 'gt', value: 60 },
      {
        indicator: 'MACD',
        params: { fast: 12, slow: 26, signal: 9 },
        operator: 'gt',
        value: 0,
      },
    ],
    scanSymbols: ['NVDA', 'TSLA', 'QQQ', 'BTC-USD', 'ETH-USD'],
  },
  {
    name: 'Esticado demais',
    description:
      'IFR acima de 75 ou estocástico acima de 90 — cuidado com novas compras.',
    logic: 'OR',
    conditions: [
      { indicator: 'RSI', params: { period: 14 }, operator: 'gt', value: 75 },
      {
        indicator: 'STOCH_K',
        params: { k_period: 14, d_period: 3 },
        operator: 'gt',
        value: 90,
      },
    ],
    scanSymbols: [],
  },
];

export interface DemoAlert {
  symbol: string;
  alertType: AlertType;
  condition: AlertCondition;
  /** For PRICE alerts: multiplier over the last close. Otherwise the raw value. */
  value: number;
  relativeToPrice: boolean;
  params: Record<string, unknown> | null;
  triggeredDaysAgo: number | null;
  isActive: boolean;
}

export const DEMO_ALERTS: DemoAlert[] = [
  {
    symbol: 'AAPL',
    alertType: AlertType.PRICE,
    condition: AlertCondition.BELOW,
    value: 0.93,
    relativeToPrice: true,
    params: null,
    triggeredDaysAgo: null,
    isActive: true,
  },
  {
    symbol: 'NVDA',
    alertType: AlertType.PRICE,
    condition: AlertCondition.ABOVE,
    value: 1.08,
    relativeToPrice: true,
    params: null,
    triggeredDaysAgo: null,
    isActive: true,
  },
  {
    symbol: 'BTC-USD',
    alertType: AlertType.PRICE,
    condition: AlertCondition.BELOW,
    value: 0.88,
    relativeToPrice: true,
    params: null,
    triggeredDaysAgo: null,
    isActive: true,
  },
  {
    symbol: 'TSLA',
    alertType: AlertType.RSI,
    condition: AlertCondition.BELOW,
    value: 30,
    relativeToPrice: false,
    params: { period: 14 },
    triggeredDaysAgo: null,
    isActive: true,
  },
  {
    symbol: 'SPY',
    alertType: AlertType.PRICE,
    condition: AlertCondition.BELOW,
    value: 0.95,
    relativeToPrice: true,
    params: null,
    triggeredDaysAgo: null,
    isActive: true,
  },
  {
    symbol: 'EURUSD=X',
    alertType: AlertType.PRICE,
    condition: AlertCondition.ABOVE,
    value: 1.03,
    relativeToPrice: true,
    params: null,
    triggeredDaysAgo: null,
    isActive: false,
  },
  {
    symbol: 'MSFT',
    alertType: AlertType.RSI,
    condition: AlertCondition.ABOVE,
    value: 70,
    relativeToPrice: false,
    params: { period: 14 },
    triggeredDaysAgo: 6,
    isActive: true,
  },
  {
    symbol: 'ETH-USD',
    alertType: AlertType.PRICE,
    condition: AlertCondition.ABOVE,
    value: 0.97,
    relativeToPrice: true,
    params: null,
    triggeredDaysAgo: 2,
    isActive: true,
  },
  {
    symbol: 'QQQ',
    alertType: AlertType.RSI,
    condition: AlertCondition.BELOW,
    value: 35,
    relativeToPrice: false,
    params: { period: 14 },
    triggeredDaysAgo: 11,
    isActive: true,
  },
];

export const DEMO_SAVED_INDICATORS: Array<{
  symbol: string;
  name: string;
  params: Record<string, unknown>;
}> = [
  { symbol: 'AAPL', name: 'SMA', params: { period: 20 } },
  { symbol: 'AAPL', name: 'RSI', params: { period: 14 } },
  { symbol: 'NVDA', name: 'MACD', params: { fast: 12, slow: 26, signal: 9 } },
  { symbol: 'BTC-USD', name: 'BB', params: { period: 20, std: 2 } },
  { symbol: 'SPY', name: 'SMA', params: { period: 200 } },
];
