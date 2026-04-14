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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FiltersService } from './filters.service';
import { CreateFilterDto, UpdateFilterDto, RunScanDto } from './dtos/filter.dto';

@ApiTags('filters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('filters')
export class FiltersController {
  constructor(private readonly filtersService: FiltersService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateFilterDto) {
    return this.filtersService.create(req.user.userId, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.filtersService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.filtersService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateFilterDto,
  ) {
    return this.filtersService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.filtersService.remove(id, req.user.userId);
  }

  @Post(':id/scan')
  runScan(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: RunScanDto,
  ) {
    return this.filtersService.runScan(id, req.user.userId, dto);
  }

  @Get(':id/results')
  getResults(@Request() req, @Param('id') id: string) {
    return this.filtersService.getResults(id, req.user.userId);
  }
}
