import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaAttendanceRepository } from './infrastructure/persistence/prisma-attendance.repository';
import type { AttendanceRepository } from './repository/attendance.repository';
import { AttendanceService, MAX_PHOTO_BYTES } from './service/attendance.service';
import { LocalPhotoStorage } from './infrastructure/local-photo.storage';
import { AttendanceController } from './controller/attendance.controller';

export const ATTENDANCE_REPOSITORY = 'dexa.attendance.attendance-repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AttendanceController],
  providers: [
    {
      provide: ATTENDANCE_REPOSITORY,
      useClass: PrismaAttendanceRepository,
    },
    {
      provide: AttendanceService,
      inject: [ATTENDANCE_REPOSITORY],
      useFactory: (repository: AttendanceRepository) => {
        const mb = Number(process.env.UPLOAD_MAX_SIZE_MB ?? '5');
        if (!Number.isInteger(mb) || mb < 1 || mb > 5) {
          throw new Error('UPLOAD_MAX_SIZE_MB must be an integer between 1 and 5');
        }
        const directory = process.env.UPLOAD_DIR ?? './uploads';
        if (!directory.trim()) throw new Error('UPLOAD_DIR must not be empty');
        return new AttendanceService(
          repository,
          new LocalPhotoStorage(directory),
          Math.min(mb * 1024 * 1024, MAX_PHOTO_BYTES),
        );
      },
    },
  ],
  exports: [ATTENDANCE_REPOSITORY],
})
export class AttendanceModule {}
