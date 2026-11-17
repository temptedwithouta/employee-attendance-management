const { resolve } = require('node:path');
require('dotenv').config({ path: resolve(__dirname, '../../../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const { isEmail } = require('class-validator');

class SeedError extends Error {}

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new SeedError(`${name} is required`);
  }
  return value;
}

async function main() {
  const hrEmail = required('SEED_HR_EMAIL');
  const hrPassword = required('SEED_HR_PASSWORD');
  const employeeEmail = required('SEED_EMPLOYEE_EMAIL');
  const employeePassword = required('SEED_EMPLOYEE_PASSWORD');
  const employeeNumber = required('SEED_EMPLOYEE_NUMBER');
  const url = required('APP_DATABASE_URL');
  if (
    !isEmail(hrEmail) ||
    !isEmail(employeeEmail) ||
    hrEmail.toLowerCase() === employeeEmail.toLowerCase()
  ) {
    throw new SeedError('Seed emails must be valid and distinct');
  }
  if (hrPassword.length < 12 || employeePassword.length < 12) {
    throw new SeedError('Seed passwords must contain at least 12 characters');
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [hrHash, employeeHash] = await Promise.all([
      argon2.hash(hrPassword, { type: argon2.argon2id }),
      argon2.hash(employeePassword, { type: argon2.argon2id }),
    ]);
    await prisma.$transaction(async (tx) => {
      const hr = await tx.user.findUnique({ where: { email: hrEmail } });
      if (hr && (hr.role !== 'HR' || hr.employeeId !== null)) {
        throw new SeedError('SEED_HR_EMAIL belongs to a different account');
      }
      if (!hr) {
        await tx.user.create({ data: { email: hrEmail, passwordHash: hrHash, role: 'HR' } });
      }
      const account = await tx.user.findUnique({
        where: { email: employeeEmail },
        include: { employee: true },
      });
      if (account) {
        if (
          account.role !== 'EMPLOYEE' ||
          !account.employee ||
          account.employee.employeeNumber !== employeeNumber
        ) {
          throw new SeedError('SEED_EMPLOYEE_EMAIL belongs to a different account');
        }
      } else {
        await tx.employee.create({
          data: {
            employeeNumber,
            name: 'Demo Employee',
            email: employeeEmail,
            department: 'Demo',
            position: 'Employee',
            user: {
              create: { email: employeeEmail, passwordHash: employeeHash, role: 'EMPLOYEE' },
            },
          },
        });
      }
    });
    console.log('Demo accounts are present; existing credentials were not changed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if (error instanceof SeedError) {
    console.error(`Seed failed: ${error.message}`);
  } else {
    console.error('Seed failed: check database access and account uniqueness.');
  }
  process.exitCode = 1;
});
