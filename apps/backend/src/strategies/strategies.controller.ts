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
import { StrategiesService } from './strategies.service';
import { CreateStrategyDto, UpdateStrategyDto } from './dtos/strategy.dto';

@UseGuards(JwtAuthGuard)
@Controller('strategies')
export class StrategiesController {
  constructor(private readonly strategiesService: StrategiesService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateStrategyDto) {
    return this.strategiesService.create(req.user.userId, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.strategiesService.findAll(req.user.userId, req.user.role);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.strategiesService.findOne(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStrategyDto,
  ) {
    return this.strategiesService.update(id, req.user.userId, req.user.role, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.strategiesService.remove(id, req.user.userId, req.user.role);
  }
}
