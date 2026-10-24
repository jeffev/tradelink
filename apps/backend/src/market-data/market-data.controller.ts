import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarketDataService } from './market-data.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { FetchCandlesDto } from './dtos/market-data.dto';

@ApiTags('market-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('tickers')
  listTickers() {
    return this.marketDataService.listTickers();
  }

  @Post('fetch')
  fetchAndStore(@Body() dto: FetchCandlesDto) {
    return this.marketDataService.fetchAndStore(dto);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        symbol: { type: 'string' },
        interval: { type: 'string', default: '1d' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10 MB
          new FileTypeValidator({ fileType: 'text/csv' }),
        ],
        fileIsRequired: false,
      }),
    )
    file: Express.Multer.File | undefined,
    @Body('symbol') symbol: string,
    @Body('interval') interval: string = '1d',
  ) {
    if (!file) throw new Error('File is required');
    if (!symbol) throw new Error('Symbol is required');
    return this.marketDataService.importCsv(symbol, interval, file.buffer);
  }

  @Get('tickers/:symbol/candles')
  getCandles(
    @Param('symbol') symbol: string,
    @Query('interval') interval: string = '1d',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.marketDataService.getCandles(symbol, interval, startDate, endDate);
  }

  // Tickers and candles are shared by every user.
  @Delete('tickers/:symbol')
  @UseGuards(AdminGuard)
  deleteTicker(@Param('symbol') symbol: string) {
    return this.marketDataService.deleteTicker(symbol);
  }
}
