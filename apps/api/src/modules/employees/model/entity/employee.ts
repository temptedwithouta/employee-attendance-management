export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';

export interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  department: string;
  position: string;
  status: EmployeeStatus;
}
