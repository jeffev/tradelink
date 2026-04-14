import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortfolioService } from './portfolio.service';

@UseGuards(JwtAuthGuard)
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('stats')
  getStats(@Request() req) {
    return this.portfolioService.getStats(req.user.userId, req.user.role);
  }

  @Get('insights')
  getInsights(@Request() req) {
    return this.portfolioService.getInsights(req.user.userId, req.user.role);
  }

  @Get('positions')
  getOpenPositions(@Request() req) {
    return this.portfolioService.getOpenPositions(req.user.userId, req.user.role);
  }
}
