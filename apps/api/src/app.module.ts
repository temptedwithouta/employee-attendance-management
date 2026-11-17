import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {resolve} from 'node:path';
import {AppController} from './app.controller';
import {AttendanceModule} from './modules/attendance/attendance.module';
import {AuthModule} from './modules/auth/auth.module';
import {EmployeesModule} from './modules/employees/employees.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '../../../.env'),
    }),
    AuthModule,
    EmployeesModule,
    AttendanceModule,
  ],
  controllers: [AppController],
})
export class AppModule {
}
