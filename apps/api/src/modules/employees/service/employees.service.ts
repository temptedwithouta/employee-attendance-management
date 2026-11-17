import type { Employee } from '../model/entity/employee';
import {
  EmployeeNotFoundError,
  type EmployeeChanges,
  type EmployeeFields,
  type EmployeeListQuery,
  type EmployeePage,
  type EmployeeRepository,
} from '../repository/employee.repository';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

export class EmployeesService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  list(query: EmployeeListQuery): Promise<EmployeePage> {
    return this.employees.list(query);
  }

  async findById(id: string): Promise<Employee> {
    const employee = await this.employees.findById(id);
    if (!employee) throw new EmployeeNotFoundError('Employee not found');
    return employee;
  }

  async create(fields: EmployeeFields, password: string): Promise<Employee> {
    const hash = await this.passwords.hash(password);
    return this.employees.create(fields, hash);
  }

  update(id: string, changes: EmployeeChanges): Promise<Employee> {
    return this.employees.update(id, changes);
  }

  deactivate(id: string): Promise<Employee> {
    return this.employees.deactivate(id);
  }
}
