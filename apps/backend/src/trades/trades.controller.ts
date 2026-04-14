import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TradesService } from './trades.service';
import { CreateTradeDto, CloseTradeDto, UpdateTradeDto } from './dtos/trade.dto';

@UseGuards(JwtAuthGuard)
@Controller('trades')
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateTradeDto) {
    return this.tradesService.create(req.user.userId, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.tradesService.findAll(req.user.userId, req.user.role);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.tradesService.findOne(id, req.user.userId, req.user.role);
  }

  @Post(':id/close')
  closeTrade(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseTradeDto,
  ) {
    return this.tradesService.close(id, req.user.userId, req.user.role, dto);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTradeDto,
  ) {
    return this.tradesService.update(id, req.user.userId, req.user.role, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.tradesService.remove(id, req.user.userId, req.user.role);
  }
}
