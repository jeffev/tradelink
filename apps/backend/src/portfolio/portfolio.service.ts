import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade, TradeStatus, TradeSide } from '../trades/trade.entity';
import { UserRole } from '../users/user.entity';

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

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
  ) {}

  async getStats(userId: string, role: UserRole): Promise<PortfolioStats> {
    const where = role === UserRole.ADMIN ? {} : { userId };
    const trades = await this.tradeRepository.find({ where });

    const closed = trades.filter(t => t.status === TradeStatus.CLOSED);
    const open = trades.filter(t => t.status === TradeStatus.OPEN);

    const pnls = closed.map(t => t.profitLoss ?? 0);
    const winning = pnls.filter(p => p > 0).length;
    const losing = pnls.filter(p => p <= 0).length;
    const totalPnl = pnls.reduce((sum, p) => sum + p, 0);
    const totalVolume = trades.reduce(
      (sum, t) => sum + Number(t.entryPrice) * Number(t.quantity),
      0,
    );
    const totalEntryValue = closed.reduce(
      (sum, t) => sum + Number(t.entryPrice) * Number(t.quantity),
      0,
    );

    // Psychology metrics
    const followed    = closed.filter(t => t.followedStrategy === true);
    const notFollowed = closed.filter(t => t.followedStrategy === false);
    const tagged = followed.length + notFollowed.length;

    const pnlsFollowed    = followed.map(t => t.profitLoss ?? 0);
    const pnlsNotFollowed = notFollowed.map(t => t.profitLoss ?? 0);

    const winsFollowed    = pnlsFollowed.filter(p => p > 0).length;
    const winsNotFollowed = pnlsNotFollowed.filter(p => p > 0).length;

    const totalPnlFollowed    = pnlsFollowed.reduce((s, p) => s + p, 0);
    const totalPnlNotFollowed = pnlsNotFollowed.reduce((s, p) => s + p, 0);

    return {
      totalTrades: trades.length,
      openTrades: open.length,
      closedTrades: closed.length,
      winningTrades: winning,
      losingTrades: losing,
      winRate: closed.length > 0 ? (winning / closed.length) * 100 : 0,
      totalProfitLoss: totalPnl,
      totalProfitLossPct: totalEntryValue > 0 ? (totalPnl / totalEntryValue) * 100 : 0,
      bestTrade: pnls.length > 0 ? Math.max(...pnls) : null,
      worstTrade: pnls.length > 0 ? Math.min(...pnls) : null,
      avgProfitLoss: pnls.length > 0 ? totalPnl / pnls.length : null,
      totalVolume,
      disciplineRate: tagged > 0 ? (followed.length / tagged) * 100 : 0,
      tradesFollowed: followed.length,
      tradesNotFollowed: notFollowed.length,
      tradesUntagged: closed.length - tagged,
      winRateFollowing: followed.length > 0 ? (winsFollowed / followed.length) * 100 : 0,
      winRateNotFollowing: notFollowed.length > 0 ? (winsNotFollowed / notFollowed.length) * 100 : 0,
      avgPnlFollowing: followed.length > 0 ? totalPnlFollowed / followed.length : null,
      avgPnlNotFollowing: notFollowed.length > 0 ? totalPnlNotFollowed / notFollowed.length : null,
      totalPnlFollowing: totalPnlFollowed,
      totalPnlNotFollowing: totalPnlNotFollowed,
    };
  }

  async getInsights(userId: string, role: UserRole): Promise<DashboardInsights> {
    const where = role === UserRole.ADMIN ? {} : { userId };
    const trades = await this.tradeRepository.find({
      where,
      relations: ['strategy'],
      order: { entryAt: 'ASC' },
    });

    const closed = trades.filter(t => t.status === TradeStatus.CLOSED);
    const open   = trades.filter(t => t.status === TradeStatus.OPEN);

    // ── Performance Temporal ────────────────────────────────────────────────

    const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const byDay: Record<number, { pnl: number; wins: number; total: number }> = {};
    for (let i = 0; i < 7; i++) byDay[i] = { pnl: 0, wins: 0, total: 0 };

    for (const t of closed) {
      const day = new Date(t.entryAt).getDay();
      const pnl = t.profitLoss ?? 0;
      byDay[day].pnl += pnl;
      byDay[day].total++;
      if (pnl > 0) byDay[day].wins++;
    }

    // Mon→Sun order
    const pnlByDayOfWeek = [1, 2, 3, 4, 5, 6, 0].map(d => ({
      day: DAYS[d],
      pnl: byDay[d].pnl,
      trades: byDay[d].total,
      winRate: byDay[d].total > 0 ? (byDay[d].wins / byDay[d].total) * 100 : 0,
    }));

    const byHour: Record<number, { pnl: number; wins: number; total: number }> = {};
    for (let h = 0; h < 24; h++) byHour[h] = { pnl: 0, wins: 0, total: 0 };

    for (const t of closed) {
      const hour = new Date(t.entryAt).getHours();
      const pnl  = t.profitLoss ?? 0;
      byHour[hour].pnl += pnl;
      byHour[hour].total++;
      if (pnl > 0) byHour[hour].wins++;
    }

    const pnlByHour = Object.entries(byHour)
      .filter(([, v]) => v.total > 0)
      .map(([h, v]) => ({
        hour: parseInt(h),
        pnl: v.pnl,
        trades: v.total,
        winRate: (v.wins / v.total) * 100,
      }))
      .sort((a, b) => a.hour - b.hour);

    const byMonth: Record<string, { pnl: number; wins: number; total: number }> = {};

    for (const t of closed) {
      const d   = new Date(t.entryAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { pnl: 0, wins: 0, total: 0 };
      const pnl = t.profitLoss ?? 0;
      byMonth[key].pnl += pnl;
      byMonth[key].total++;
      if (pnl > 0) byMonth[key].wins++;
    }

    const pnlByMonth = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        pnl: v.pnl,
        trades: v.total,
        winRate: v.total > 0 ? (v.wins / v.total) * 100 : 0,
      }));

    const discByMonth: Record<string, { followed: number; tagged: number }> = {};

    for (const t of closed) {
      if (t.followedStrategy === null || t.followedStrategy === undefined) continue;
      const d   = new Date(t.entryAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!discByMonth[key]) discByMonth[key] = { followed: 0, tagged: 0 };
      discByMonth[key].tagged++;
      if (t.followedStrategy) discByMonth[key].followed++;
    }

    const disciplineByMonth = Object.entries(discByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        rate: v.tagged > 0 ? (v.followed / v.tagged) * 100 : 0,
        followed: v.followed,
        tagged: v.tagged,
      }));

    // ── Gestão de Risco ─────────────────────────────────────────────────────

    const holdingTimes = closed
      .filter(t => t.exitAt)
      .map(t => (new Date(t.exitAt!).getTime() - new Date(t.entryAt).getTime()) / (1000 * 60 * 60));

    const avgHoldingTimeHours = holdingTimes.length > 0
      ? holdingTimes.reduce((s, h) => s + h, 0) / holdingTimes.length
      : null;

    const now = Date.now();
    const longOpenTrades = open.filter(
      t => (now - new Date(t.entryAt).getTime()) > 7 * 24 * 60 * 60 * 1000,
    ).length;

    const buyCount  = trades.filter(t => t.side === TradeSide.BUY).length;
    const sellCount = trades.filter(t => t.side === TradeSide.SELL).length;

    const byTicker: Record<string, { pnl: number; wins: number; total: number; volume: number }> = {};

    for (const t of trades) {
      if (!byTicker[t.ticker]) byTicker[t.ticker] = { pnl: 0, wins: 0, total: 0, volume: 0 };
      byTicker[t.ticker].total++;
      byTicker[t.ticker].volume += Number(t.entryPrice) * Number(t.quantity);
      if (t.status === TradeStatus.CLOSED) {
        const pnl = t.profitLoss ?? 0;
        byTicker[t.ticker].pnl += pnl;
        if (pnl > 0) byTicker[t.ticker].wins++;
      }
    }

    const topTickers = Object.entries(byTicker)
      .map(([ticker, v]) => ({
        ticker,
        pnl: v.pnl,
        trades: v.total,
        volume: v.volume,
        winRate: v.total > 0 ? (v.wins / v.total) * 100 : 0,
      }))
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
      .slice(0, 5);

    // ── Aprendizado ─────────────────────────────────────────────────────────

    const tradesWithNotes    = closed.filter(t => t.closeNotes?.trim()).length;
    const tradesWithoutNotes = closed.length - tradesWithNotes;

    const byStratType: Record<string, { wins: number; total: number; pnl: number }> = {};

    for (const t of closed) {
      const type = t.strategy?.type ?? 'sem estratégia';
      if (!byStratType[type]) byStratType[type] = { wins: 0, total: 0, pnl: 0 };
      const pnl = t.profitLoss ?? 0;
      byStratType[type].total++;
      byStratType[type].pnl += pnl;
      if (pnl > 0) byStratType[type].wins++;
    }

    const winRateByStrategyType = Object.entries(byStratType)
      .map(([type, v]) => ({
        type,
        winRate: v.total > 0 ? (v.wins / v.total) * 100 : 0,
        trades: v.total,
        pnl: v.pnl,
      }))
      .sort((a, b) => b.trades - a.trades);

    const disciplineBreaksWon   = closed.filter(t => t.followedStrategy === false && (t.profitLoss ?? 0) > 0).length;
    const disciplineBreaksTotal = closed.filter(t => t.followedStrategy === false).length;

    const pnls    = closed.map(t => t.profitLoss ?? 0);
    const wins    = pnls.filter(p => p > 0);
    const losses  = pnls.filter(p => p < 0);
    const winRate = pnls.length > 0 ? wins.length / pnls.length : 0;
    const avgWin  = wins.length > 0 ? wins.reduce((s, p) => s + p, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, p) => s + p, 0) / losses.length) : 0;
    const expectedValue = pnls.length > 0 ? winRate * avgWin - (1 - winRate) * avgLoss : null;

    // ── Gestão de Risco expandida ────────────────────────────────────────────

    const slHitCount = closed.filter(t => t.exitReason === 'SL_HIT').length;
    const tpHitCount = closed.filter(t => t.exitReason === 'TP_HIT').length;
    const slHitRate  = closed.length > 0 ? (slHitCount / closed.length) * 100 : 0;
    const tpHitRate  = closed.length > 0 ? (tpHitCount / closed.length) * 100 : 0;

    const withRR = closed.filter(t => t.plannedRR != null && t.realizedRR != null);
    const avgPlannedRR = withRR.length > 0
      ? withRR.reduce((s, t) => s + (t.plannedRR ?? 0), 0) / withRR.length
      : null;
    const avgRealizedRR = withRR.length > 0
      ? withRR.reduce((s, t) => s + (t.realizedRR ?? 0), 0) / withRR.length
      : null;

    const slippages = closed.filter(t => t.slippage != null).map(t => t.slippage ?? 0);
    const avgSlippage = slippages.length > 0
      ? slippages.reduce((s, v) => s + v, 0) / slippages.length
      : null;

    const commissions = closed.filter(t => t.commission != null).map(t => t.commission ?? 0);
    const avgCommission = commissions.length > 0
      ? commissions.reduce((s, v) => s + v, 0) / commissions.length
      : null;

    // ── Psicologia expandida ────────────────────────────────────────────────

    const confidences = closed.filter(t => t.confidenceLevel != null).map(t => t.confidenceLevel ?? 0);
    const avgConfidenceLevel = confidences.length > 0
      ? confidences.reduce((s, v) => s + v, 0) / confidences.length
      : null;

    const byEmotion: Record<string, { count: number; wins: number; pnl: number }> = {};
    const emotions = ['CALM', 'FOMO', 'FEAR', 'REVENGE', 'CONFIDENT'];
    emotions.forEach(e => byEmotion[e] = { count: 0, wins: 0, pnl: 0 });

    for (const t of closed) {
      if (t.emotionAtEntry) {
        byEmotion[t.emotionAtEntry].count++;
        byEmotion[t.emotionAtEntry].pnl += t.profitLoss ?? 0;
        if ((t.profitLoss ?? 0) > 0) byEmotion[t.emotionAtEntry].wins++;
      }
    }

    const emotionBreakdown = Object.entries(byEmotion)
      .filter(([, v]) => v.count > 0)
      .map(([emotion, v]) => ({
        emotion,
        count: v.count,
        winRate: (v.wins / v.count) * 100,
        avgPnl: v.pnl / v.count,
      }))
      .sort((a, b) => b.count - a.count);

    const qualities = closed.filter(t => t.entryQuality != null).map(t => t.entryQuality ?? 0);
    const avgEntryQuality = qualities.length > 0
      ? qualities.reduce((s, v) => s + v, 0) / qualities.length
      : null;

    const movedStopCount = closed.filter(t => t.movedStop === true).length;
    const enteredOnTimeRaw = closed.filter(t => t.enteredOnTime === true).length;
    const enteredOnTimeDefined = closed.filter(t => t.enteredOnTime !== null).length;
    const enteredOnTimeRate = enteredOnTimeDefined > 0 ? (enteredOnTimeRaw / enteredOnTimeDefined) * 100 : 0;

    // ── Contexto ────────────────────────────────────────────────────────────

    const byTimeframe: Record<string, { count: number; wins: number; pnl: number }> = {};
    for (const t of closed) {
      if (t.timeframe) {
        if (!byTimeframe[t.timeframe]) byTimeframe[t.timeframe] = { count: 0, wins: 0, pnl: 0 };
        byTimeframe[t.timeframe].count++;
        byTimeframe[t.timeframe].pnl += t.profitLoss ?? 0;
        if ((t.profitLoss ?? 0) > 0) byTimeframe[t.timeframe].wins++;
      }
    }

    const timeframeBreakdown = Object.entries(byTimeframe)
      .map(([tf, v]) => ({
        timeframe: tf,
        count: v.count,
        winRate: (v.wins / v.count) * 100,
        pnl: v.pnl,
      }))
      .sort((a, b) => b.pnl - a.pnl);

    const bySetup: Record<string, { pnl: number; wins: number; count: number }> = {};
    for (const t of closed) {
      if (t.setup) {
        if (!bySetup[t.setup]) bySetup[t.setup] = { pnl: 0, wins: 0, count: 0 };
        bySetup[t.setup].pnl += t.profitLoss ?? 0;
        bySetup[t.setup].count++;
        if ((t.profitLoss ?? 0) > 0) bySetup[t.setup].wins++;
      }
    }

    const mostProfitableSetup = Object.entries(bySetup).length > 0
      ? (() => {
          const sorted = Object.entries(bySetup).sort((a, b) => b[1].pnl - a[1].pnl);
          const [setup, v] = sorted[0];
          return { setup, pnl: v.pnl, winRate: (v.wins / v.count) * 100 };
        })()
      : null;

    const byAssetClass: Record<string, { count: number; wins: number; pnl: number }> = {};
    for (const t of closed) {
      if (t.assetClass) {
        if (!byAssetClass[t.assetClass]) byAssetClass[t.assetClass] = { count: 0, wins: 0, pnl: 0 };
        byAssetClass[t.assetClass].count++;
        byAssetClass[t.assetClass].pnl += t.profitLoss ?? 0;
        if ((t.profitLoss ?? 0) > 0) byAssetClass[t.assetClass].wins++;
      }
    }

    const assetClassBreakdown = Object.entries(byAssetClass)
      .map(([ac, v]) => ({
        assetClass: ac,
        count: v.count,
        winRate: (v.wins / v.count) * 100,
        pnl: v.pnl,
      }))
      .sort((a, b) => b.pnl - a.pnl);

    const byTrend: Record<string, { count: number; wins: number; pnl: number }> = {};
    for (const t of closed) {
      if (t.trend) {
        if (!byTrend[t.trend]) byTrend[t.trend] = { count: 0, wins: 0, pnl: 0 };
        byTrend[t.trend].count++;
        byTrend[t.trend].pnl += t.profitLoss ?? 0;
        if ((t.profitLoss ?? 0) > 0) byTrend[t.trend].wins++;
      }
    }

    const trendBreakdown = Object.entries(byTrend)
      .map(([trend, v]) => ({
        trend,
        count: v.count,
        winRate: (v.wins / v.count) * 100,
        pnl: v.pnl,
      }))
      .sort((a, b) => b.pnl - a.pnl);

    // ── Sizing ──────────────────────────────────────────────────────────────

    const capitalPcts = closed.filter(t => t.capitalPct != null).map(t => t.capitalPct ?? 0);
    const avgCapitalPct = capitalPcts.length > 0
      ? capitalPcts.reduce((s, v) => s + v, 0) / capitalPcts.length
      : null;

    const totalCommissionPaid = closed.reduce((s, t) => s + (t.commission ?? 0), 0);
    const totalSlippageLost   = closed.reduce((s, t) => s + (t.slippage ?? 0), 0);

    return {
      pnlByDayOfWeek,
      pnlByHour,
      pnlByMonth,
      disciplineByMonth,
      avgHoldingTimeHours,
      longOpenTrades,
      buyCount,
      sellCount,
      topTickers,
      slHitRate,
      tpHitRate,
      avgPlannedRR,
      avgRealizedRR,
      avgSlippage,
      avgCommission,
      avgConfidenceLevel,
      emotionBreakdown,
      avgEntryQuality,
      movedStopCount,
      enteredOnTimeRate,
      timeframeBreakdown,
      mostProfitableSetup,
      assetClassBreakdown,
      trendBreakdown,
      avgCapitalPct,
      totalCommissionPaid,
      totalSlippageLost,
      tradesWithNotes,
      tradesWithoutNotes,
      winRateByStrategyType,
      disciplineBreaksWon,
      disciplineBreaksTotal,
      expectedValue,
    };
  }

  async getOpenPositions(userId: string, role: UserRole) {
    const where = role === UserRole.ADMIN
      ? { status: TradeStatus.OPEN }
      : { userId, status: TradeStatus.OPEN };
    return this.tradeRepository.find({ where, order: { entryAt: 'DESC' } });
  }
}
