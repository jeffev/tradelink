import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../users/user.entity';

/** Use after JwtAuthGuard: lets only administrators through. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { role?: string } }>();
    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Somente administradores.');
    }
    return true;
  }
}
