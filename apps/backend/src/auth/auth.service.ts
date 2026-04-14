import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/user.entity';
import { CreateUserDto } from '../users/dtos/user.dto';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole | string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<AuthUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && await this.usersService.validatePassword(password, user.password)) {
      return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role };
    }
    return null;
  }

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.createAndReturn(createUserDto);
    return this.buildAuthResponse(user);
  }

  async login(user: AuthUser) {
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: AuthUser) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}

// Re-export for use in LocalStrategy
export type { AuthUser };
