import { Module } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaEmployeeRepository } from './infrastructure/persistence/prisma-employee.repository';
import type { EmployeeRepository } from './repository/employee.repository';
import { EmployeesService } from './service/employees.service';
import { EmployeesController } from './controller/employees.controller';

export const EMPLOYEE_REPOSITORY = 'dexa.employees.employee-repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EmployeesController],
  providers: [
    {
      provide: EMPLOYEE_REPOSITORY,
      useClass: PrismaEmployeeRepository,
    },
    {
      provide: EmployeesService,
      inject: [EMPLOYEE_REPOSITORY],
      useFactory: (employees: EmployeeRepository) =>
        new EmployeesService(employees, {
          hash: (password) => argon2.hash(password, { type: argon2.argon2id }),
        }),
    },
  ],
  exports: [EMPLOYEE_REPOSITORY],
})
export class EmployeesModule {}
