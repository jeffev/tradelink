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
} from '@nestjs/common';
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
    const idArray = Array.isArray(ids) ? ids : [ids];
    return this.backtestingService.compareJobs(idArray, req.user.userId, req.user.role);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.backtestingService.findOne(id, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.backtestingService.remove(id, req.user.userId, req.user.role);
  }
}
