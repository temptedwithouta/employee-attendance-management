import { INestApplication } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app-setup';
import { ExceptionTestModule } from './fixtures/exception-test.module';

process.env.APP_DATABASE_URL ??= 'mysql://dexa_app:test@127.0.0.1:3306/dexa_wfh';
process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';

describe('Health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, ExceptionTestModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  it('returns a healthy status', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(200).expect({ status: 'ok' });
  });

  it('exposes an OpenAPI document', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/docs-json').expect(200);

    expect(response.body.info.title).toBe('Dexa WFH API');
  });

  it('returns a consistent validation error response', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/test-errors/validation')
      .send({ email: 'invalid', unexpected: true })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      path: '/api/v1/test-errors/validation',
    });
    expect(response.body.message).toEqual(
      expect.arrayContaining(['property unexpected should not exist', 'email must be an email']),
    );
    expect(Date.parse(response.body.timestamp)).not.toBeNaN();
  });

  it('preserves expected HTTP exception messages in the common response shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/test-errors/bad-request?access_token=private-value')
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      message: 'Request was invalid',
      path: '/api/v1/test-errors/bad-request',
    });
    expect(Date.parse(response.body.timestamp)).not.toBeNaN();
  });

  it('does not expose unexpected server error details', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/test-errors/unexpected')
      .expect(500);

    expect(response.body).toMatchObject({
      statusCode: 500,
      message: 'Internal server error',
      path: '/api/v1/test-errors/unexpected',
    });
    expect(response.body.message).not.toContain('private database detail');
  });

  it('composes Prisma and the three feature modules', () => {
    const moduleNames = [...app.get(ModulesContainer).values()].map(
      (moduleRef) => moduleRef.metatype?.name,
    );

    expect(moduleNames).toEqual(
      expect.arrayContaining(['PrismaModule', 'AuthModule', 'EmployeesModule', 'AttendanceModule']),
    );
  });

  it('resolves feature-specific repository ports from their adapters', () => {
    const userRepository = app.get<{ findByEmail: (email: string) => Promise<unknown> }>(
      'dexa.auth.user-repository',
    );
    const employeeRepository = app.get<{ findById: (id: string) => Promise<unknown> }>(
      'dexa.employees.employee-repository',
    );
    const attendanceRepository = app.get<{
      findForEmployeeOnDate: (employeeId: string, date: Date) => Promise<unknown>;
    }>('dexa.attendance.attendance-repository');

    expect(typeof userRepository.findByEmail).toBe('function');
    expect(typeof employeeRepository.findById).toBe('function');
    expect(typeof attendanceRepository.findForEmployeeOnDate).toBe('function');
  });

  afterAll(async () => {
    await app.close();
  });
});
