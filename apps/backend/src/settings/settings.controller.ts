import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dtos/settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(@Request() req) {
    return this.settingsService.getOrCreate(req.user.userId);
  }

  @Patch()
  update(@Request() req, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(req.user.userId, dto);
  }
}
