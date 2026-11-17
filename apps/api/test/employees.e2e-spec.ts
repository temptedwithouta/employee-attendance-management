import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app-setup';

const databaseUrl = process.env.EMPLOYEE_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase('Employee management', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let hrToken: string;
  let employeeToken: string;
  let hrId: string;
  let employeeId: string;
  let createdId: string;
  const unexpectedCreatedIds: string[] = [];
  const suffix = randomUUID();
  const hrEmail = `hr-${suffix}@example.test`;
  const employeeEmail = `employee-${suffix}@example.test`;
  const createdEmail = `created-${suffix}@example.test`;
  const updatedEmail = `updated-${suffix}@example.test`;
  const initialPassword = 'test-password-123';
  const input = {
    employeeNumber: `E-${suffix}`,
    name: 'Test Employee',
    email: createdEmail,
    department: 'Engineering',
    position: 'Developer',
    initialPassword,
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('EMPLOYEE_TEST_DATABASE_URL is required');
    process.env.APP_DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
    process.env.JWT_EXPIRES_IN = '1h';
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const hash = await argon2.hash(initialPassword, { type: argon2.argon2id });
    const hr = await prisma.user.create({
      data: { email: hrEmail, role: 'HR', passwordHash: hash },
    });
    hrId = hr.id;
    const employee = await prisma.employee.create({
      data: {
        employeeNumber: `existing-${suffix}`,
        name: 'Existing Employee',
        email: employeeEmail,
        department: 'Operations',
        position: 'Staff',
        user: { create: { email: employeeEmail, passwordHash: hash, role: 'EMPLOYEE' } },
      },
    });
    employeeId = employee.id;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    hrToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: hrEmail, password: initialPassword })
        .expect(200)
    ).body.accessToken as string;
    employeeToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: employeeEmail, password: initialPassword })
        .expect(200)
    ).body.accessToken as string;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) {
      const ids = [employeeId, createdId, ...unexpectedCreatedIds].filter((id): id is string =>
        Boolean(id),
      );
      if (ids.length > 0) {
        await prisma.attendance.deleteMany({ where: { employeeId: { in: ids } } });
        await prisma.user.deleteMany({ where: { employeeId: { in: ids } } });
        await prisma.employee.deleteMany({ where: { id: { in: ids } } });
      }
      if (hrId) await prisma.user.deleteMany({ where: { id: hrId } });
      await prisma.$disconnect();
    }
  });

  it('requires authentication and rejects employee access for every HR operation', async () => {
    const paths = [
      ['get', '/api/v1/employees'],
      ['get', `/api/v1/employees/${employeeId}`],
      ['post', '/api/v1/employees'],
      ['patch', `/api/v1/employees/${employeeId}`],
      ['patch', `/api/v1/employees/${employeeId}/deactivate`],
    ] as const;
    for (const [method, path] of paths) {
      await request(app.getHttpServer())[method](path).expect(401);
      await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    }
  });

  it('validates input and pagination without accepting role or status overrides', async () => {
    const auth = `Bearer ${hrToken}`;
    await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', auth)
      .send({ ...input, email: 'bad', role: 'HR' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', auth)
      .send({ ...input, name: '   ' })
      .expect(400);
    const blankPassword = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', auth)
      .send({
        ...input,
        employeeNumber: `blank-${suffix}`,
        email: `blank-${suffix}@example.test`,
        initialPassword: '            ',
      });
    if (blankPassword.status === 201 && typeof blankPassword.body.id === 'string') {
      unexpectedCreatedIds.push(blankPassword.body.id);
    }
    expect(blankPassword.status).toBe(400);
    await request(app.getHttpServer())
      .get('/api/v1/employees?limit=101')
      .set('Authorization', auth)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/employees?page=0')
      .set('Authorization', auth)
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employeeId}`)
      .set('Authorization', auth)
      .send({ status: 'ACTIVE' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employeeId}`)
      .set('Authorization', auth)
      .send({ name: null })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employeeId}`)
      .set('Authorization', auth)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/employees/not-a-uuid')
      .set('Authorization', auth)
      .expect(400);
  });

  it('creates an employee and linked account atomically without returning credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send(input)
      .expect(201);
    createdId = response.body.id as string;
    expect(response.body).toMatchObject({
      id: expect.any(String),
      employeeNumber: input.employeeNumber,
      email: createdEmail,
      status: 'ACTIVE',
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('initialPassword');
    const user = await prisma.user.findUniqueOrThrow({ where: { employeeId: createdId } });
    expect(user.role).toBe('EMPLOYEE');
    expect(await argon2.verify(user.passwordHash, initialPassword)).toBe(true);
  });

  it('searches and paginates employees and returns details', async () => {
    const auth = `Bearer ${hrToken}`;
    const list = await request(app.getHttpServer())
      .get(`/api/v1/employees?search=${suffix}&page=1&limit=1`)
      .set('Authorization', auth)
      .expect(200);
    expect(list.body).toMatchObject({ page: 1, limit: 1, total: 2 });
    expect(list.body.items).toHaveLength(1);
    const second = await request(app.getHttpServer())
      .get(`/api/v1/employees?search=${suffix}&page=2&limit=1`)
      .set('Authorization', auth)
      .expect(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].id).not.toBe(list.body.items[0].id);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/employees/${createdId}`)
      .set('Authorization', auth)
      .expect(200);
    expect(detail.body.email).toBe(createdEmail);
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${randomUUID()}`)
      .set('Authorization', auth)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${randomUUID()}`)
      .set('Authorization', auth)
      .send({ name: 'Unknown' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${randomUUID()}/deactivate`)
      .set('Authorization', auth)
      .expect(404);
  });

  it('rejects duplicate numbers and account emails without partial employee rows', async () => {
    const auth = `Bearer ${hrToken}`;
    await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', auth)
      .send({ ...input, email: `unique-${suffix}@example.test` })
      .expect(409);
    const number = `conflict-${suffix}`;
    await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', auth)
      .send({ ...input, employeeNumber: number, email: hrEmail })
      .expect(409);
    expect(await prisma.employee.findUnique({ where: { employeeNumber: number } })).toBeNull();
  });

  it('updates profile and login email atomically, including conflict rollback', async () => {
    const auth = `Bearer ${hrToken}`;
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${createdId}`)
      .set('Authorization', auth)
      .send({ email: hrEmail, name: 'Changed' })
      .expect(409);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: createdId } })).name).toBe(
      'Test Employee',
    );
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${createdId}`)
      .set('Authorization', auth)
      .send({ email: updatedEmail, name: 'Changed' })
      .expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { employeeId: createdId } })).email).toBe(
      updatedEmail,
    );
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: updatedEmail, password: initialPassword })
      .expect(200);
  });

  it('allows email updates for existing employees without a linked account', async () => {
    const employee = await prisma.employee.create({
      data: {
        employeeNumber: `unlinked-${suffix}`,
        name: 'Unlinked Employee',
        email: `unlinked-${suffix}@example.test`,
        department: 'Operations',
        position: 'Staff',
      },
    });
    unexpectedCreatedIds.push(employee.id);
    const newEmail = `unlinked-updated-${suffix}@example.test`;
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employee.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ email: newEmail })
      .expect(200);
    const saved = await prisma.employee.findUniqueOrThrow({
      where: { id: employee.id },
      include: { user: true },
    });
    expect(saved.email).toBe(newEmail);
    expect(saved.user).toBeNull();
  });

  it('deactivates without deleting attendance and rejects the existing employee token', async () => {
    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        attendanceDate: new Date('2026-01-01T00:00:00Z'),
        photoPath: 'test-photo',
      },
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employeeId}/deactivate`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(await prisma.attendance.findUnique({ where: { id: attendance.id } })).not.toBeNull();
    const filtered = await request(app.getHttpServer())
      .get(`/api/v1/employees?search=${suffix}&status=INACTIVE`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].id).toBe(employeeId);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: employeeEmail, password: initialPassword })
      .expect(401);
  });
});
