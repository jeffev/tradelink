import {
  Controller, Get, Post, Delete,
  Body, Param, UseGuards, Request,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DCAService } from './dca.service';
import { CreateDCADto } from './dtos/create-dca.dto';

@ApiTags('dca')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dca')
export class DCAController {
  constructor(private readonly dcaService: DCAService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateDCADto) {
    return this.dcaService.create(req.user.userId, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.dcaService.findAll(req.user.userId, req.user.role);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.dcaService.findOne(id, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.dcaService.remove(id, req.user.userId, req.user.role);
  }
}
