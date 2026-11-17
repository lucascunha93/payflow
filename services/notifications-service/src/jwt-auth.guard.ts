import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

type AuthenticatedRequest = Request & { userId?: string };

/** Validates access tokens issued by payments-api (shared HS256 secret). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      request.userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }
}

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const userId = context.switchToHttp().getRequest<AuthenticatedRequest>().userId;
    if (!userId) throw new UnauthorizedException();
    return userId;
  },
);
