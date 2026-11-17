import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG } from '../config';
import type { AppConfig } from '../config';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AccessToken {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/**
 * Demo-grade authentication: a single user defined by environment variables.
 * In production this would be delegated to an OAuth 2.0 / OpenID Connect provider.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<AccessToken> {
    const { demoUser } = this.config;
    // Both comparisons always run so timing does not reveal which field was wrong.
    const emailOk = safeEqual(email.trim().toLowerCase(), demoUser.email);
    const passwordOk = safeEqual(password, demoUser.password);
    if (!emailOk || !passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwt.signAsync({ sub: demoUser.id, email: demoUser.email });
    return { accessToken, tokenType: 'Bearer', expiresIn: this.config.jwtExpiresInSeconds };
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(token);
      return { id: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
