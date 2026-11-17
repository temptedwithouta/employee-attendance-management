import { Controller, Get, Module, UseGuards, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app-setup';
import { AuthModule } from '../src/modules/auth/auth.module';
import { JwtAuthGuard } from '../src/modules/auth/infrastructure/security/guard/jwt-auth.guard';
import { Roles, RolesGuard } from '../src/modules/auth/infrastructure/security/guard/roles.guard';

process.env.APP_DATABASE_URL = 'mysql://test:test@127.0.0.1:3306/test';
process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
process.env.JWT_EXPIRES_IN = '2h';

@Controller('test-roles')
@UseGuards(JwtAuthGuard, RolesGuard)
class RoleTestController {
  @Get('hr')
  @Roles('HR')
  hr(): string {
    return 'hr';
  }

  @Get('employee')
  @Roles('EMPLOYEE')
  employee(): string {
    return 'employee';
  }
}

@Module({ imports: [AuthModule], controllers: [RoleTestController] })
class RoleTestModule {}

describe('Authentication', () => {
  let app: INestApplication;
  let passwordHash: string;
  let employeeStatus: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
  let currentRole: 'EMPLOYEE' | 'HR' = 'EMPLOYEE';

  beforeAll(async () => {
    passwordHash = await argon2.hash('correct-password', { type: argon2.argon2id });
    const repository = {
      findByEmail: async (email: string) =>
        email === 'employee@example.test'
          ? {
              id: 'user-id',
              employeeId: 'employee-id',
              email,
              role: currentRole,
              passwordHash,
              employeeStatus,
            }
          : null,
      findById: async (id: string) =>
        id === 'user-id'
          ? {
              id,
              employeeId: 'employee-id',
              email: 'employee@example.test',
              role: currentRole,
              passwordHash,
              employeeStatus,
            }
          : null,
    };
    const module = await Test.createTestingModule({ imports: [AppModule, RoleTestModule] })
      .overrideProvider('dexa.auth.user-repository')
      .useValue(repository)
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterEach(() => {
    employeeStatus = 'ACTIVE';
    currentRole = 'EMPLOYEE';
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee@example.test', password: 'correct-password' })
      .expect(200);
    expect(response.body.user).toEqual({
      id: 'user-id',
      email: 'employee@example.test',
      role: 'EMPLOYEE',
      employeeId: 'employee-id',
    });
    expect(response.body.accessToken).toEqual(expect.any(String));
    return response.body.accessToken as string;
  }

  it('authenticates with a valid password and returns the current user without a hash', async () => {
    const token = await login();
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body).toEqual({
      id: 'user-id',
      email: 'employee@example.test',
      role: 'EMPLOYEE',
      employeeId: 'employee-id',
    });
  });

  it('returns the same generic error for unknown email and wrong password', async () => {
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@example.test', password: 'wrong-password' })
      .expect(401);
    const wrong = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee@example.test', password: 'wrong-password' })
      .expect(401);
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('rejects missing and invalid bearer tokens', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });

  it('rejects a token after employee deactivation', async () => {
    const token = await login();
    employeeStatus = 'INACTIVE';
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects inactive employees during login', async () => {
    employeeStatus = 'INACTIVE';
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee@example.test', password: 'correct-password' })
      .expect(401);
  });

  it('rejects expired tokens and signed tokens without an expiry', async () => {
    const jwt = app.get(JwtService);
    const expired = await jwt.signAsync({ sub: 'user-id' }, { expiresIn: -1 });
    const noExpiry = await new JwtService({ secret: process.env.JWT_SECRET }).signAsync({
      sub: 'user-id',
    });
    for (const token of [expired, noExpiry]) {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }
  });

  it('rejects role fields supplied in the login body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee@example.test', password: 'correct-password', role: 'HR' })
      .expect(400);
  });

  it('uses the configured JWT expiry', async () => {
    const token = await login();
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
      iat: number;
      exp: number;
    };
    expect(payload.exp - payload.iat).toBe(7200);
  });

  it('enforces both roles using current database state rather than the token role', async () => {
    const token = await login();
    await request(app.getHttpServer())
      .get('/api/v1/test-roles/hr')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/test-roles/employee')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    currentRole = 'HR';
    await request(app.getHttpServer())
      .get('/api/v1/test-roles/hr')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/test-roles/employee')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
