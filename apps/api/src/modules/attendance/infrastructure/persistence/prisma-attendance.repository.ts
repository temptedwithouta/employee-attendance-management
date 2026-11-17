import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import type { Attendance } from '../../model/entity/attendance';
import {
  AttendanceConflictError,
  type AttendanceListQuery,
  type AttendanceRepository,
  type AttendanceWithEmployee,
} from '../../repository/attendance.repository';

const fields = {
  id: true,
  employeeId: true,
  attendanceDate: true,
  submittedAt: true,
  photoPath: true,
} as const;

const withEmployee = {
  ...fields,
  employee: { select: { id: true, employeeNumber: true, name: true, email: true } },
} as const;

@Injectable()
export class PrismaAttendanceRepository implements AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findForEmployeeOnDate(employeeId: string, date: Date): Promise<Attendance | null> {
    const attendance = await this.prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate: date,
        },
      },
      select: fields,
    });
    return attendance;
  }

  async create(input: Omit<Attendance, 'id'>): Promise<Attendance> {
    try {
      return await this.prisma.attendance.create({ data: input, select: fields });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AttendanceConflictError('Attendance already submitted for this day');
      }
      throw error;
    }
  }

  async list(
    query: AttendanceListQuery,
  ): Promise<{ items: AttendanceWithEmployee[]; total: number }> {
    const where: Prisma.AttendanceWhereInput = {
      ...(query.date ? { attendanceDate: query.date } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        select: withEmployee,
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<AttendanceWithEmployee | null> {
    return this.prisma.attendance.findUnique({ where: { id }, select: withEmployee });
  }
}
