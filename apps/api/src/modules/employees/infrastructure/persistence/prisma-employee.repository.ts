import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import type { Employee } from '../../model/entity/employee';
import {
  EmployeeConflictError,
  EmployeeNotFoundError,
  type EmployeeChanges,
  type EmployeeFields,
  type EmployeeListQuery,
  type EmployeePage,
  type EmployeeRepository,
} from '../../repository/employee.repository';

const employeeSelect = {
  id: true,
  employeeNumber: true,
  name: true,
  email: true,
  department: true,
  position: true,
  status: true,
} as const;

function translateError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      throw new EmployeeConflictError('Employee number or email already exists');
    if (error.code === 'P2025') throw new EmployeeNotFoundError('Employee not found');
  }
  throw error;
}

@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: EmployeeListQuery): Promise<EmployeePage> {
    const where: Prisma.EmployeeWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { employeeNumber: { contains: query.search } },
              { name: { contains: query.search } },
              { email: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        select: employeeSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async findById(id: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({ where: { id }, select: employeeSelect });
  }

  async create(fields: EmployeeFields, passwordHash: string): Promise<Employee> {
    try {
      return await this.prisma.employee.create({
        data: {
          ...fields,
          user: { create: { email: fields.email, passwordHash, role: 'EMPLOYEE' } },
        },
        select: employeeSelect,
      });
    } catch (error) {
      return translateError(error);
    }
  }

  async update(id: string, changes: EmployeeChanges): Promise<Employee> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const employee = await tx.employee.update({
          where: { id },
          data: changes,
          select: employeeSelect,
        });
        if (changes.email !== undefined) {
          await tx.user.updateMany({ where: { employeeId: id }, data: { email: changes.email } });
        }
        return employee;
      });
    } catch (error) {
      return translateError(error);
    }
  }

  async deactivate(id: string): Promise<Employee> {
    try {
      return await this.prisma.employee.update({
        where: { id },
        data: { status: 'INACTIVE' },
        select: employeeSelect,
      });
    } catch (error) {
      return translateError(error);
    }
  }
}
