import { z } from 'zod';
import { apiClient } from '@/lib/api-client';

const employeeSchema = z.object({
  id: z.string(),
  employeeNumber: z.string(),
  name: z.string(),
  email: z.string(),
  department: z.string(),
  position: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

const employeeListResponseSchema = z.object({
  items: z.array(employeeSchema),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
});

export type Employee = z.infer<typeof employeeSchema>;
export type EmployeeStatus = Employee['status'];
export type EmployeeUpdateInput = Pick<
  Employee,
  'employeeNumber' | 'name' | 'email' | 'department' | 'position'
>;
export type EmployeeCreateInput = EmployeeUpdateInput & { initialPassword: string };
export interface EmployeeListParams {
  page: number;
  limit: number;
  search?: string;
  status?: EmployeeStatus;
}
export type EmployeeListResponse = z.infer<typeof employeeListResponseSchema>;

export async function listEmployees(params: EmployeeListParams): Promise<EmployeeListResponse> {
  const response = await apiClient.get<unknown>('/employees', { params });
  return employeeListResponseSchema.parse(response.data);
}

export async function getEmployee(id: string): Promise<Employee> {
  const response = await apiClient.get<unknown>(`/employees/${id}`);
  return employeeSchema.parse(response.data);
}

export async function createEmployee(input: EmployeeCreateInput): Promise<Employee> {
  const response = await apiClient.post<unknown>('/employees', input);
  return employeeSchema.parse(response.data);
}

export async function updateEmployee(id: string, input: EmployeeUpdateInput): Promise<Employee> {
  const { employeeNumber, name, email, department, position } = input;
  const response = await apiClient.patch<unknown>(`/employees/${id}`, {
    employeeNumber,
    name,
    email,
    department,
    position,
  });
  return employeeSchema.parse(response.data);
}

export async function deactivateEmployee(id: string): Promise<Employee> {
  const response = await apiClient.patch<unknown>(`/employees/${id}/deactivate`);
  return employeeSchema.parse(response.data);
}
