import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DemoService } from './demo.service';

@ApiTags('auth')
@Controller('auth/demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Get()
  status() {
    return { enabled: this.demoService.isEnabled() };
  }

  /** Creates a throwaway visitor account, filled with sample data, and logs in. */
  @Post()
  @HttpCode(201)
  createVisitor(@Req() req: Request) {
    // Caddy replaces X-Forwarded-For with the real client address.
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        ?.split(',')[0]
        .trim() ||
      req.ip ||
      'unknown';
    return this.demoService.createVisitor(ip);
  }
}
