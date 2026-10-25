import { ConfigService } from '@nestjs/config';

/**
 * JWT signing secret. Production refuses to start without JWT_SECRET: a
 * built-in fallback would let anyone who read the source forge tokens.
 */
export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (secret) return secret;
  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'tradelink-dev-only-secret';
}
