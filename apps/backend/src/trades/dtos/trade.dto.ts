import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  IsDateString,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  IsInt,
} from 'class-validator';
import {
  TradeSide,
  TradeStatus,
  ExitReason,
  TradeTimeframe,
  TradeTrend,
  AssetClass,
  EmotionAtEntry,
} from '../trade.entity';

export class CreateTradeDto {
  @IsString()
  @MaxLength(20)
  ticker: string;

  @IsEnum(TradeSide)
  side: TradeSide;

  @IsNumber()
  @Min(0)
  entryPrice: number;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsUUID()
  strategyId?: string;

  @IsOptional()
  @IsDateString()
  entryAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Gestão da Operação
  @IsOptional()
  @IsNumber()
  @Min(0)
  stopLoss?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  takeProfit?: number;

  // Contexto de Mercado
  @IsOptional()
  @IsEnum(TradeTimeframe)
  timeframe?: TradeTimeframe;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  setup?: string;

  @IsOptional()
  @IsEnum(TradeTrend)
  trend?: TradeTrend;

  @IsOptional()
  @IsEnum(AssetClass)
  assetClass?: AssetClass;

  // Psicologia & Qualidade
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  confidenceLevel?: number;

  @IsOptional()
  @IsEnum(EmotionAtEntry)
  emotionAtEntry?: EmotionAtEntry;

  @IsOptional()
  @IsBoolean()
  enteredOnTime?: boolean;

  // Sizing & Risco
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  capitalPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commission?: number;
}

export class CloseTradeDto {
  @IsNumber()
  @Min(0)
  exitPrice: number;

  @IsOptional()
  @IsDateString()
  exitAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID()
  strategyId?: string;

  @IsOptional()
  @IsBoolean()
  followedStrategy?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  closeNotes?: string;

  // Gestão da Operação
  @IsOptional()
  @IsEnum(ExitReason)
  exitReason?: ExitReason;

  // Psicologia & Qualidade
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  entryQuality?: number;

  @IsOptional()
  @IsBoolean()
  movedStop?: boolean;

  @IsOptional()
  @IsBoolean()
  enteredOnTime?: boolean;

  // Sizing
  @IsOptional()
  @IsNumber()
  @Min(0)
  slippage?: number;
}

export class UpdateTradeDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ticker?: string;

  @IsOptional()
  @IsEnum(TradeSide)
  side?: TradeSide;

  @IsOptional()
  @IsNumber()
  @Min(0)
  entryPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  exitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsEnum(TradeStatus)
  status?: TradeStatus;

  @IsOptional()
  @IsUUID()
  strategyId?: string;

  @IsOptional()
  @IsDateString()
  entryAt?: string;

  @IsOptional()
  @IsDateString()
  exitAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  followedStrategy?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  closeNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stopLoss?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  takeProfit?: number;

  @IsOptional()
  @IsEnum(ExitReason)
  exitReason?: ExitReason;

  @IsOptional()
  @IsEnum(TradeTimeframe)
  timeframe?: TradeTimeframe;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  setup?: string;

  @IsOptional()
  @IsEnum(TradeTrend)
  trend?: TradeTrend;

  @IsOptional()
  @IsEnum(AssetClass)
  assetClass?: AssetClass;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  confidenceLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  entryQuality?: number;

  @IsOptional()
  @IsEnum(EmotionAtEntry)
  emotionAtEntry?: EmotionAtEntry;

  @IsOptional()
  @IsBoolean()
  movedStop?: boolean;

  @IsOptional()
  @IsBoolean()
  enteredOnTime?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  capitalPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commission?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  slippage?: number;
}

export class TradeResponseDto {
  id: string;
  userId: string;
  strategyId: string | null;
  ticker: string;
  side: TradeSide;
  status: TradeStatus;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  entryAt: Date;
  exitAt: Date | null;
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
  createdAt: Date;
  updatedAt: Date;
}
