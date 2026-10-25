import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';

  // One reverse proxy (Caddy, or nginx in docker-compose) sits in front:
  // trust its X-Forwarded-For so rate limits see the real client address.
  app.set('trust proxy', 1);

  // Security headers. The JSON API needs no CSP relaxations; Swagger UI (dev
  // only) does, so CSP is left off outside production.
  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS configuration
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  app.enableCors({
    origin: corsOrigin.split(',').map(o => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix for API routes
  app.setGlobalPrefix('api');

  // Swagger documentation (non-production)
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Tradelink API')
      .setDescription('Trading platform REST API - Phase 1 MVP')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get('PORT', 3001);
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
  if (!isProduction) {
    console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
