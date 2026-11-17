import type { Employee } from '../model/entity/employee';

export type EmployeeFields = Pick<
  Employee,
  'employeeNumber' | 'name' | 'email' | 'department' | 'position'
>;
export type EmployeeChanges = Partial<EmployeeFields>;

export interface EmployeeListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: Employee['status'];
}

export interface EmployeePage {
  items: Employee[];
  page: number;
  limit: number;
  total: number;
}

export class EmployeeConflictError extends Error {}
export class EmployeeNotFoundError extends Error {}

export interface EmployeeRepository {
  list(query: EmployeeListQuery): Promise<EmployeePage>;
  findById(id: string): Promise<Employee | null>;
  create(fields: EmployeeFields, passwordHash: string): Promise<Employee>;
  update(id: string, changes: EmployeeChanges): Promise<Employee>;
  deactivate(id: string): Promise<Employee>;
}
