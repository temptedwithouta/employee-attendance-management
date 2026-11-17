export type UserRole = 'EMPLOYEE' | 'HR';

export interface User {
  id: string;
  employeeId: string | null;
  email: string;
  passwordHash: string;
  role: UserRole;
  employeeStatus: 'ACTIVE' | 'INACTIVE' | null;
}
