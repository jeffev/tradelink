import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IndicatorsService } from './indicators.service';
import { CalculateIndicatorsDto, SaveIndicatorDto } from './dtos/indicator.dto';

@ApiTags('indicators')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly indicatorsService: IndicatorsService) {}

  @Post('calculate')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  calculate(@Body() dto: CalculateIndicatorsDto) {
    return this.indicatorsService.calculate(dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.indicatorsService.findAll(req.user.userId);
  }

  @Post()
  save(@Request() req, @Body() dto: SaveIndicatorDto) {
    return this.indicatorsService.save(req.user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.indicatorsService.remove(id, req.user.userId);
  }
}
