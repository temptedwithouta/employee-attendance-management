import {CanActivate, ExecutionContext, Injectable, UnauthorizedException} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import type {Request} from 'express';
import {
  AuthService,
  InvalidCredentialsError,
  type AuthenticatedUser,
} from '../../../service/auth.service';

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '');
    if (!match) {
      throw new UnauthorizedException();
    }
    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync<object>(match[1], {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string' ||
      !('exp' in payload) ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException();
    }
    try {
      request.user = await this.auth.currentUser(payload.sub);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException();
      }
      throw error;
    }
    return true;
  }
}
