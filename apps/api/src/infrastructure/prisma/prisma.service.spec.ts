import { PrismaService } from './prisma.service';

describe('PrismaService runtime connection', () => {
  it('requires an service URL instead of falling back to the migration URL', () => {
    const previousAppUrl = process.env.APP_DATABASE_URL;
    const previousMigrationUrl = process.env.DATABASE_URL;
    delete process.env.APP_DATABASE_URL;
    process.env.DATABASE_URL = 'mysql://migration-user:secret@localhost:3306/dexa_wfh';

    try {
      expect(() => new PrismaService()).toThrow('APP_DATABASE_URL is required');
    } finally {
      if (previousAppUrl === undefined) {
        delete process.env.APP_DATABASE_URL;
      } else {
        process.env.APP_DATABASE_URL = previousAppUrl;
      }

      if (previousMigrationUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousMigrationUrl;
      }
    }
  });
});
