import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

it('refuses to seed without explicitly supplied demo credentials', () => {
  const env = { ...process.env };
  env.SEED_HR_EMAIL = '';
  env.SEED_HR_PASSWORD = '';
  env.SEED_EMPLOYEE_EMAIL = '';
  env.SEED_EMPLOYEE_PASSWORD = '';
  const result = spawnSync(process.execPath, [resolve(__dirname, '../prisma/seed.cjs')], {
    env,
    encoding: 'utf8',
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('SEED_HR_EMAIL');
});
