import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app-setup';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

const databaseUrl = process.env.ATTENDANCE_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');

describeDatabase('WFH attendance', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let uploadDir: string;
  let hrId: string;
  const employeeIds: string[] = [];
  const tokens: string[] = [];
  let hrToken: string;
  let attendanceId: string;
  const suffix = randomUUID();
  const password = 'test-password-123';

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ATTENDANCE_TEST_DATABASE_URL is required');
    uploadDir = await mkdtemp(join(tmpdir(), 'dexa-attendance-test-'));
    process.env.APP_DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.UPLOAD_DIR = uploadDir;
    process.env.UPLOAD_MAX_SIZE_MB = '5';
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const hrEmail = `attendance-hr-${suffix}@example.test`;
    const hr = await prisma.user.create({
      data: { email: hrEmail, role: 'HR', passwordHash: hash },
    });
    hrId = hr.id;
    const emails: string[] = [];
    for (let i = 0; i < 5; i++) {
      const email = `attendance-${i}-${suffix}@example.test`;
      emails.push(email);
      const employee = await prisma.employee.create({
        data: {
          employeeNumber: `att-${i}-${suffix}`,
          name: `Attendance Employee ${i}`,
          email,
          department: 'Testing',
          position: 'Staff',
          user: { create: { email, role: 'EMPLOYEE', passwordHash: hash } },
        },
      });
      employeeIds.push(employee.id);
    }
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    for (const email of [hrEmail, ...emails]) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      if (email === hrEmail) hrToken = response.body.accessToken as string;
      else tokens.push(response.body.accessToken as string);
    }
  });

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) {
      if (employeeIds.length > 0) {
        await prisma.attendance.deleteMany({ where: { employeeId: { in: employeeIds } } });
        await prisma.user.deleteMany({ where: { employeeId: { in: employeeIds } } });
        await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
      }
      if (hrId) await prisma.user.deleteMany({ where: { id: hrId } });
      await prisma.$disconnect();
    }
    if (uploadDir) {
      for (const file of await readdir(uploadDir)) await unlink(join(uploadDir, file));
      await rmdir(uploadDir);
    }
  });

  it('requires authentication and enforces employee and HR roles', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .attach('photo', png, 'proof.png')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${hrToken}`)
      .attach('photo', png, 'proof.png')
      .expect(403);
    await request(app.getHttpServer()).get('/api/v1/attendance').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/attendance')
      .set('Authorization', `Bearer ${tokens[0]}`)
      .expect(403);
  });

  it('rejects empty files, wrong MIME, extension, signature, and oversized photos', async () => {
    const auth = `Bearer ${tokens[0]}`;
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', auth)
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', auth)
      .attach('photo', Buffer.alloc(0), { filename: 'proof.png', contentType: 'image/png' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', auth)
      .attach('photo', png, { filename: 'proof.txt', contentType: 'image/png' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', auth)
      .attach('photo', png, { filename: 'proof.png', contentType: 'image/jpeg' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', auth)
      .attach('photo', Buffer.from('not an image'), {
        filename: 'proof.png',
        contentType: 'image/png',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', auth)
      .attach('photo', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'proof.png',
        contentType: 'image/png',
      })
      .expect(413);
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', auth)
      .attach('photo', Buffer.alloc(5 * 1024 * 1024 + 2), {
        filename: 'proof.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect(await readdir(uploadDir)).toHaveLength(0);
  });

  it('rejects client-supplied identity and timestamps', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${tokens[0]}`)
      .field('employeeId', employeeIds[1])
      .field('submittedAt', '2020-01-01T00:00:00Z')
      .attach('photo', png, { filename: 'proof.png', contentType: 'image/png' })
      .expect(400);
    expect(await readdir(uploadDir)).toHaveLength(0);
  });

  it('records server identity and time and keeps the photo private', async () => {
    const before = Date.now();
    const response = await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${tokens[0]}`)
      .attach('photo', png, { filename: '../../proof.png', contentType: 'image/png' })
      .expect(201);
    const after = Date.now();
    attendanceId = response.body.id as string;
    expect(response.body.employeeId).toBe(employeeIds[0]);
    expect(Date.parse(response.body.submittedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(response.body.submittedAt)).toBeLessThanOrEqual(after);
    expect(response.body).not.toHaveProperty('photoPath');
    const row = await prisma.attendance.findUniqueOrThrow({ where: { id: attendanceId } });
    expect(row.employeeId).toBe(employeeIds[0]);
    expect(row.photoPath).toMatch(/^[a-f0-9-]+\.png$/);
    await request(app.getHttpServer()).get(`/uploads/${row.photoPath}`).expect(404);
  });

  it('provides HR monitoring, filters, details, and protected photo access', async () => {
    const auth = `Bearer ${hrToken}`;
    const recorded = await prisma.attendance.findUniqueOrThrow({ where: { id: attendanceId } });
    const date = recorded.attendanceDate.toISOString().slice(0, 10);
    const list = await request(app.getHttpServer())
      .get(`/api/v1/attendance?date=${date}&employeeId=${employeeIds[0]}`)
      .set('Authorization', auth)
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      id: attendanceId,
      employeeId: employeeIds[0],
      employee: { id: employeeIds[0], name: 'Attendance Employee 0' },
    });
    expect(list.body.items[0]).not.toHaveProperty('photoPath');
    await request(app.getHttpServer())
      .get('/api/v1/attendance?limit=101')
      .set('Authorization', auth)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/attendance?date=2026-02-31')
      .set('Authorization', auth)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/attendance/${attendanceId}`)
      .set('Authorization', auth)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/attendance/${attendanceId}`)
      .set('Authorization', `Bearer ${tokens[0]}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/attendance/${randomUUID()}`)
      .set('Authorization', auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/attendance/${randomUUID()}/photo`)
      .set('Authorization', auth)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/attendance/${attendanceId}/photo`)
      .set('Authorization', `Bearer ${tokens[0]}`)
      .expect(403);
    await request(app.getHttpServer()).get(`/api/v1/attendance/${attendanceId}/photo`).expect(401);
    const photo = await request(app.getHttpServer())
      .get(`/api/v1/attendance/${attendanceId}/photo`)
      .set('Authorization', auth)
      .expect('Content-Type', /image\/png/)
      .expect(200);
    expect(photo.body).toEqual(png);
  });

  it('enforces database uniqueness for simultaneous submissions and removes the losing file', async () => {
    const before = await readdir(uploadDir);
    const submit = () =>
      request(app.getHttpServer())
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${tokens[1]}`)
        .attach('photo', png, { filename: 'proof.png', contentType: 'image/png' });
    const responses = await Promise.all([submit(), submit()]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.attendance.count({ where: { employeeId: employeeIds[1] } })).toBe(1);
    expect((await readdir(uploadDir)).length).toBe(before.length + 1);
  });

  it('removes an uploaded photo when database persistence fails', async () => {
    const before = await readdir(uploadDir);
    const db = app.get(PrismaService);
    const spy = jest
      .spyOn(db.attendance, 'create')
      .mockRejectedValueOnce(new Error('database unavailable'));
    try {
      await request(app.getHttpServer())
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${tokens[2]}`)
        .attach('photo', png, { filename: 'proof.png', contentType: 'image/png' })
        .expect(500);
    } finally {
      spy.mockRestore();
    }
    expect((await readdir(uploadDir)).sort()).toEqual(before.sort());
  });

  it('accepts a photo exactly at the 5 MiB limit', async () => {
    const data = Buffer.alloc(5 * 1024 * 1024);
    png.copy(data);
    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${tokens[2]}`)
      .attach('photo', data, { filename: 'proof.png', contentType: 'image/png' })
      .expect(201);
  });

  it('accepts JPEG with a matching extension and signature', async () => {
    const jpeg = Buffer.from('ffd8ffe000', 'hex');
    const response = await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${tokens[3]}`)
      .attach('photo', jpeg, { filename: 'proof.JPEG', contentType: 'image/jpeg' })
      .expect(201);
    const photo = await request(app.getHttpServer())
      .get(`/api/v1/attendance/${response.body.id}/photo`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect('Content-Type', /image\/jpeg/)
      .expect(200);
    expect(photo.body).toEqual(jpeg);
  });

  it('enforces a lower configured upload limit', async () => {
    process.env.UPLOAD_MAX_SIZE_MB = '1';
    let limitedApp: INestApplication | undefined;
    try {
      const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
      limitedApp = module.createNestApplication({ logger: false });
      configureApp(limitedApp);
      await limitedApp.init();
      const data = Buffer.alloc(1024 * 1024 + 1);
      png.copy(data);
      const auth = `Bearer ${tokens[4]}`;
      await request(limitedApp.getHttpServer())
        .post('/api/v1/attendance')
        .set('Authorization', auth)
        .attach('photo', data, { filename: 'proof.png', contentType: 'image/png' })
        .expect(413);
      await request(limitedApp.getHttpServer())
        .post('/api/v1/attendance')
        .set('Authorization', auth)
        .attach('photo', data.subarray(0, 1024 * 1024), {
          filename: 'proof.png',
          contentType: 'image/png',
        })
        .expect(201);
    } finally {
      if (limitedApp) await limitedApp.close();
      process.env.UPLOAD_MAX_SIZE_MB = '5';
    }
  });
});
