import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/lib/api-client';
import {
  createEmployee,
  deactivateEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from './employees-api';

const employee = {
  id: 'employee-id',
  employeeNumber: 'EMP-001',
  name: 'Maria Example',
  email: 'maria@example.test',
  department: 'People',
  position: 'HR Manager',
  status: 'ACTIVE',
} as const;

let originalAdapter = apiClient.defaults.adapter;
let requestConfig: InternalAxiosRequestConfig | undefined;

function respondWith(data: unknown) {
  apiClient.defaults.adapter = async (config) => {
    requestConfig = config;
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    };
  };
}

describe('employee API', () => {
  beforeEach(() => {
    requestConfig = undefined;
    originalAdapter = apiClient.defaults.adapter;
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('serializes pagination, search, and status and parses the response', async () => {
    const data = { items: [employee], page: 2, limit: 10, total: 11 };
    respondWith(data);

    await expect(
      listEmployees({ page: 2, limit: 10, search: 'Maria Example', status: 'ACTIVE' }),
    ).resolves.toEqual(data);

    expect(requestConfig?.url).toBe('/employees');
    const query = new URL(apiClient.getUri(requestConfig), 'http://localhost').searchParams;
    expect(query.get('page')).toBe('2');
    expect(query.get('limit')).toBe('10');
    expect(query.get('search')).toBe('Maria Example');
    expect(query.get('status')).toBe('ACTIVE');
  });

  it('omits optional filters when they are not selected', async () => {
    respondWith({ items: [employee], page: 1, limit: 25, total: 1 });

    await expect(listEmployees({ page: 1, limit: 25 })).resolves.toMatchObject({
      page: 1,
      limit: 25,
    });

    const query = new URL(apiClient.getUri(requestConfig), 'http://localhost').searchParams;
    expect(query.get('page')).toBe('1');
    expect(query.get('limit')).toBe('25');
    expect(query.has('search')).toBe(false);
    expect(query.has('status')).toBe(false);
  });

  it('rejects a malformed employee response', async () => {
    respondWith({ items: [{ ...employee, status: 'SUSPENDED' }], page: 1, limit: 25, total: 1 });

    await expect(listEmployees({ page: 1, limit: 25 })).rejects.toThrow();
  });

  it('gets employee details', async () => {
    respondWith(employee);

    await expect(getEmployee('employee-id')).resolves.toEqual(employee);
    expect(requestConfig?.method).toBe('get');
    expect(requestConfig?.url).toBe('/employees/employee-id');
  });

  it('creates an employee with the exact create payload', async () => {
    respondWith(employee);
    const input = {
      employeeNumber: 'EMP-001',
      name: 'Maria Example',
      email: 'maria@example.test',
      department: 'People',
      position: 'HR Manager',
      initialPassword: 'example-password',
    };

    await expect(createEmployee(input)).resolves.toEqual(employee);
    expect(requestConfig?.method).toBe('post');
    expect(requestConfig?.url).toBe('/employees');
    expect(JSON.parse(requestConfig?.data as string)).toEqual(input);
  });

  it('updates only editable fields without sending a password', async () => {
    respondWith(employee);
    const input = {
      employeeNumber: 'EMP-001',
      name: 'Maria Example',
      email: 'maria@example.test',
      department: 'People',
      position: 'HR Manager',
      initialPassword: 'must-not-be-sent',
    };

    await expect(updateEmployee('employee-id', input)).resolves.toEqual(employee);
    expect(requestConfig?.method).toBe('patch');
    expect(requestConfig?.url).toBe('/employees/employee-id');
    expect(JSON.parse(requestConfig?.data as string)).toEqual({
      employeeNumber: 'EMP-001',
      name: 'Maria Example',
      email: 'maria@example.test',
      department: 'People',
      position: 'HR Manager',
    });
  });

  it('deactivates an employee and parses the response', async () => {
    respondWith(employee);

    await expect(deactivateEmployee('employee-id')).resolves.toEqual(employee);

    expect(requestConfig?.method).toBe('patch');
    expect(requestConfig?.url).toBe('/employees/employee-id/deactivate');
  });

  it.each([
    ['detail', () => getEmployee('employee-id')],
    ['create', () => createEmployee({
      employeeNumber: 'EMP-001',
      name: 'Maria Example',
      email: 'maria@example.test',
      department: 'People',
      position: 'HR Manager',
      initialPassword: 'example-password',
    })],
    ['update', () => updateEmployee('employee-id', {
      employeeNumber: 'EMP-001',
      name: 'Maria Example',
      email: 'maria@example.test',
      department: 'People',
      position: 'HR Manager',
    })],
    ['deactivation', () => deactivateEmployee('employee-id')],
  ])('rejects a malformed %s response', async (_operation, request) => {
    respondWith({ ...employee, status: 'SUSPENDED' });

    await expect(request()).rejects.toThrow();
  });
});
