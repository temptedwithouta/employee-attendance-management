import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from '@/app/router';
import { AuthSessionProvider } from '@/features/auth/auth-session';
import { apiClient } from '@/lib/api-client';

const employee = {
  id: 'employee-id',
  employeeNumber: 'EMP-001',
  name: 'Maria Example',
  email: 'maria@example.test',
  department: 'People',
  position: 'Manager',
  status: 'ACTIVE',
};
const editable = {
  employeeNumber: 'EMP-001',
  name: 'Maria Example',
  email: 'maria@example.test',
  department: 'People',
  position: 'Manager',
};
const originalAdapter = apiClient.defaults.adapter;
let role: 'HR' | 'EMPLOYEE';
let requests: Array<{ method?: string; url?: string; data: unknown }>;
let detail: (config: InternalAxiosRequestConfig) => Promise<unknown>;
let save: (config: InternalAxiosRequestConfig) => Promise<unknown>;

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { data, status, statusText: 'OK', headers: new AxiosHeaders(), config };
}

function httpError(config: InternalAxiosRequestConfig, status: number) {
  return new AxiosError('Request failed', undefined, config, undefined, {
    data: { statusCode: status, message: 'Employee number or email already exists' },
    status,
    statusText: 'Error',
    headers: new AxiosHeaders(),
    config,
  });
}

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['employees', 'cached'], { items: [] });
  const memoryRouter = createMemoryRouter(router.routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <RouterProvider router={memoryRouter} />
      </AuthSessionProvider>
    </QueryClientProvider>,
  );
  return { queryClient, memoryRouter };
}

function fillCreate(password: string) {
  for (const [label, value] of Object.entries({
    'Employee number': editable.employeeNumber,
    Name: editable.name,
    Email: editable.email,
    Department: editable.department,
    Position: editable.position,
    'Initial password': password,
  })) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

describe('employee form routes', () => {
  beforeEach(() => {
    sessionStorage.setItem('dexa.accessToken', 'test-token');
    role = 'HR';
    requests = [];
    detail = async () => employee;
    save = async () => employee;
    apiClient.defaults.adapter = async (config) => {
      requests.push({
        method: config.method,
        url: config.url,
        data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
      });
      if (config.url === '/auth/me') {
        return response(config, { id: 'user-id', email: 'hr@example.test', role, employeeId: null });
      }
      if (config.method === 'get' && config.url === '/employees/employee-id') {
        return response(config, await detail(config));
      }
      if (config.method === 'get' && config.url === '/employees') {
        return response(config, { items: [employee], page: 1, limit: 25, total: 1 });
      }
      if (config.method === 'post' || config.method === 'patch') {
        return response(config, await save(config));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    };
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    apiClient.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  it.each([
    [11, false],
    [12, true],
    [1024, true],
    [1025, false],
  ])('validates a password of length %i', async (length, valid) => {
    renderRoute('/hr/employees/new');
    await screen.findByLabelText('Employee number');
    fillCreate('x'.repeat(length));
    fireEvent.click(screen.getByRole('button', { name: /create employee/i }));
    if (valid) {
      await waitFor(() => expect(requests.some((request) => request.method === 'post')).toBe(true));
    } else {
      expect(await screen.findByText(/12.*1024/i)).toBeInTheDocument();
      expect(requests.some((request) => request.method === 'post')).toBe(false);
    }
  });

  it.each([
    [11, false],
    [12, true],
    [1024, true],
    [1025, false],
  ])('validates a password of %i Unicode characters', async (length, valid) => {
    renderRoute('/hr/employees/new');
    await screen.findByLabelText('Employee number');
    fillCreate('🔒'.repeat(length));
    fireEvent.click(screen.getByRole('button', { name: /create employee/i }));
    if (valid) {
      await waitFor(() => expect(requests.some((request) => request.method === 'post')).toBe(true));
    } else {
      expect(await screen.findByText(/12.*1024/i)).toBeInTheDocument();
      expect(requests.some((request) => request.method === 'post')).toBe(false);
    }
  });

  it('creates with six fields, invalidates the list and navigates to it', async () => {
    const { queryClient, memoryRouter } = renderRoute('/hr/employees/new');
    await screen.findByLabelText('Employee number');
    fillCreate('validpassword');
    fireEvent.click(screen.getByRole('button', { name: /create employee/i }));
    await waitFor(() => expect(memoryRouter.state.location.pathname).toBe('/hr/employees'));
    expect(requests.find((request) => request.method === 'post')?.data).toEqual({
      ...editable, initialPassword: 'validpassword',
    });
    expect(queryClient.getQueryState(['employees', 'cached'])?.isInvalidated).toBe(true);
  });

  it('prefills edit and submits only the five editable fields', async () => {
    const { queryClient, memoryRouter } = renderRoute('/hr/employees/employee-id/edit');
    expect(await screen.findByLabelText('Name')).toHaveValue('Maria Example');
    expect(screen.queryByLabelText('Initial password')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Maria Updated' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(memoryRouter.state.location.pathname).toBe('/hr/employees'));
    expect(requests.find((request) => request.method === 'patch')?.data).toEqual({
      ...editable, name: 'Maria Updated',
    });

    expect(queryClient.getQueryState(['employees', 'cached'])?.isInvalidated).toBe(true);
  });

  it('reopens the updated employee instead of stale cached details', async () => {
    let current = employee;
    detail = async () => current;
    save = async () => {
      current = { ...employee, name: 'Maria Updated' };
      return current;
    };
    const { memoryRouter, queryClient } = renderRoute('/hr/employees/employee-id/edit');
    expect(await screen.findByLabelText('Name')).toHaveValue('Maria Example');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Maria Updated' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(memoryRouter.state.location.pathname).toBe('/hr/employees'));
    expect(queryClient.getQueryData(['employee', 'employee-id'])).toMatchObject({ name: 'Maria Updated' });
    await screen.findByRole('table');
    await act(async () => { await memoryRouter.navigate('/hr/employees/employee-id/edit'); });
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Maria Updated'));
  });

  it('disables form fields and submission while saving', async () => {
    save = () => new Promise(() => {});
    renderRoute('/hr/employees/new');
    await screen.findByLabelText('Employee number');
    fillCreate('validpassword');
    fireEvent.click(screen.getByRole('button', { name: /create employee/i }));
    await waitFor(() => expect(screen.getByLabelText('Name')).toBeDisabled());
    expect(screen.getByLabelText('Initial password')).toBeDisabled();
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });

  it.each([
    ['/hr/employees/new', 'create employee'],
    ['/hr/employees/employee-id/edit', 'save changes'],
  ])('shows a duplicate error without losing input on %s', async (path, button) => {
    save = async (config) => { throw httpError(config, 409); };
    renderRoute(path);
    await screen.findByLabelText('Name');
    if (path.endsWith('/new')) fillCreate('validpassword');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsaved name' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(button, 'i') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already|duplicate/i);
    expect(screen.getByLabelText('Name')).toHaveValue('Unsaved name');
    if (path.endsWith('/new')) expect(screen.getByLabelText('Initial password')).toHaveValue('validpassword');
  });

  it('shows loading without an editable form while detail is pending', async () => {
    detail = () => new Promise(() => {});
    renderRoute('/hr/employees/employee-id/edit');
    expect(await screen.findByText(/loading employee/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
  });

  it('shows not found when employee detail returns 404', async () => {
    detail = async (config) => { throw httpError(config, 404); };
    renderRoute('/hr/employees/employee-id/edit');
    expect(await screen.findByText(/employee not found/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
  });

  it.each(['/hr/employees/new', '/hr/employees/employee-id/edit'])(
    'denies an employee access to %s',
    async (path) => {
      role = 'EMPLOYEE';
      renderRoute(path);
      expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
      expect(requests.some((request) => request.url === '/employees/employee-id')).toBe(false);
    },
  );

  it('provides create and edit links with a deactivation action for active employees', async () => {
    renderRoute('/hr/employees');
    expect(await screen.findByRole('link', { name: /create employee/i })).toHaveAttribute('href', '/hr/employees/new');
    expect(await screen.findByRole('link', { name: /edit maria example/i })).toHaveAttribute('href', '/hr/employees/employee-id/edit');
    expect(screen.getByRole('button', { name: 'Deactivate Maria Example' })).toBeInTheDocument();
  });
});
