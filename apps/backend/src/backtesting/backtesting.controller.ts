import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { isUUID } from 'class-validator';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BacktestingService } from './backtesting.service';
import { CreateBacktestDto } from './dtos/backtesting.dto';

@ApiTags('backtesting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('backtesting')
export class BacktestingController {
  constructor(private readonly backtestingService: BacktestingService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  create(@Request() req, @Body() dto: CreateBacktestDto) {
    return this.backtestingService.create(req.user.userId, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.backtestingService.findAll(req.user.userId, req.user.role);
  }

  @Get('compare')
  @ApiQuery({ name: 'ids', type: String, isArray: true })
  compare(@Request() req, @Query('ids') ids: string | string[]) {
    const idArray = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (idArray.length > 10 || !idArray.every((id) => isUUID(id))) {
      throw new BadRequestException('ids must be at most 10 UUIDs');
    }
    return this.backtestingService.compareJobs(idArray, req.user.userId, req.user.role);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.backtestingService.findOne(id, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.backtestingService.remove(id, req.user.userId, req.user.role);
  }
}
