import type { Attendance } from '../model/entity/attendance';

export interface AttendanceWithEmployee extends Attendance {
  employee: { id: string; employeeNumber: string; name: string; email: string };
}

export interface AttendanceListQuery {
  page: number;
  limit: number;
  date?: Date;
  employeeId?: string;
}

export class AttendanceConflictError extends Error {}
export class AttendanceNotFoundError extends Error {}

export interface AttendanceRepository {
  findForEmployeeOnDate(employeeId: string, date: Date): Promise<Attendance | null>;
  create(input: Omit<Attendance, 'id'>): Promise<Attendance>;
  list(query: AttendanceListQuery): Promise<{ items: AttendanceWithEmployee[]; total: number }>;
  findById(id: string): Promise<AttendanceWithEmployee | null>;
}
