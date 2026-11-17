import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { AuthController } from './controller/auth.controller';
import { AuthService } from './service/auth.service';
import { JwtAuthGuard } from './infrastructure/security/guard/jwt-auth.guard';
import { RolesGuard } from './infrastructure/security/guard/roles.guard';
import { AUTH_USER_REPOSITORY } from './tokens';
import type { UserRepository } from './repository/user.repository';
import { Argon2PasswordVerifier } from './infrastructure/argon2-password-verifier';

export { AUTH_USER_REPOSITORY } from './tokens';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET must be at least 32 characters');
        }
        const expiry = process.env.JWT_EXPIRES_IN ?? '1h';
        const match = /^([1-9]\d*)(s|m|h|d)$/.exec(expiry);
        const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
        if (!match || !Number.isSafeInteger(Number(match[1]) * units[match[2]])) {
          throw new Error('JWT_EXPIRES_IN must be a positive duration such as 1h');
        }
        return {
          secret,
          signOptions: { expiresIn: Number(match[1]) * units[match[2]], algorithm: 'HS256' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    Argon2PasswordVerifier,
    {
      provide: AuthService,
      inject: [AUTH_USER_REPOSITORY, Argon2PasswordVerifier, JwtService],
      useFactory: (users: UserRepository, passwords: Argon2PasswordVerifier, jwt: JwtService) =>
        new AuthService(users, passwords, {
          sign: (user) => jwt.signAsync({ sub: user.id, email: user.email, role: user.role }),
        }),
    },
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AUTH_USER_REPOSITORY, JwtModule, AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
