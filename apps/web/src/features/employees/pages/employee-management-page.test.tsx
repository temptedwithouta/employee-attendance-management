import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { EmployeeManagementPage } from './employee-management-page';

const employee = {
  id: 'employee-id',
  employeeNumber: 'EMP-001',
  name: 'Maria Example',
  email: 'maria@example.test',
  department: 'People',
  position: 'HR Manager',
  status: 'ACTIVE',
};

let originalAdapter = apiClient.defaults.adapter;

function respondWith(
  config: InternalAxiosRequestConfig,
  data: unknown,
): AxiosResponse<unknown> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
  };
}

function renderPage(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {

  return render(
    <QueryClientProvider client={queryClient}>
      <EmployeeManagementPage />
    </QueryClientProvider>,
  );
}

function listResponse(config: InternalAxiosRequestConfig) {
  const page = Number(config.params?.page ?? 1);
  const total = 1;
  return respondWith(config, { items: [employee], page, limit: 25, total });
}

describe('EmployeeManagementPage', () => {
  beforeEach(() => {
    originalAdapter = apiClient.defaults.adapter;
  });

  afterEach(() => {
    cleanup();
    apiClient.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  it('shows loading then employee rows', async () => {
    let release: (() => void) | undefined;
    apiClient.defaults.adapter = async (config) =>
      new Promise((resolve) => {
        release = () => resolve(listResponse(config));
      });

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(/loading employees/i);
    await waitFor(() => expect(release).toBeDefined());
    release?.();
    expect(await screen.findByRole('row', { name: /EMP-001 Maria Example/i })).toBeInTheDocument();
  });

  it('shows a retryable error', async () => {
    let requests = 0;
    apiClient.defaults.adapter = async (config) => {
      requests += 1;
      if (requests === 1) {
        throw new AxiosError('Request failed', undefined, config, undefined, {
          data: {},
          status: 503,
          statusText: 'Unavailable',
          headers: new AxiosHeaders(),
          config,
        });
      }
      return listResponse(config);
    };

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load employees/i);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('row', { name: /EMP-001 Maria Example/i })).toBeInTheDocument();
    expect(requests).toBe(2);
  });

  it('keeps cached rows visible and retries a failed background refresh', async () => {
    let requests = 0;
    apiClient.defaults.adapter = async (config) => {
      requests += 1;
      if (requests === 2) {
        throw new AxiosError('Request failed', undefined, config);
      }
      if (requests === 3) {
        return respondWith(config, {
          items: [{ ...employee, name: 'Maria Updated' }],
          page: 1,
          limit: 25,
          total: 1,
        });
      }
      return listResponse(config);
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderPage(queryClient);
    await screen.findByRole('row', { name: /EMP-001 Maria Example/i });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    });

    expect(screen.getByRole('row', { name: /EMP-001 Maria Example/i })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not refresh employees/i);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('row', { name: /EMP-001 Maria Updated/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    apiClient.defaults.adapter = async (config) =>
      respondWith(config, { items: [], page: 1, limit: 25, total: 0 });

    renderPage();

    expect(await screen.findByText('No employees found')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('searches and filters by status', async () => {
    const requests: Array<{ page?: number; search?: string; status?: string }> = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(config.params as { page?: number; search?: string; status?: string });
      return listResponse(config);
    };

    renderPage();
    await screen.findByRole('row', { name: /EMP-001 Maria Example/i });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search employees' }), {
      target: { value: 'Maria' },
    });
    await waitFor(() => expect(requests).toContainEqual(expect.objectContaining({ search: 'Maria' })));

    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: 'ACTIVE' },
    });
    await waitFor(() =>
      expect(requests).toContainEqual(
        expect.objectContaining({ page: 1, search: 'Maria', status: 'ACTIVE' }),
      ),
    );
  });

  it('changes pages and resets page when filters change', async () => {
    const requests: Array<{ page?: number; search?: string; status?: string }> = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(config.params as { page?: number; search?: string; status?: string });
      return respondWith(config, {
        items: [employee],
        page: Number(config.params?.page ?? 1),
        limit: 25,
        total: 51,
      });
    };

    renderPage();
    await screen.findByRole('row', { name: /EMP-001 Maria Example/i });
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(requests).toContainEqual(expect.objectContaining({ page: 2 })));
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search employees' }), {
      target: { value: 'Maria' },
    });
    await waitFor(() =>
      expect(requests).toContainEqual(expect.objectContaining({ page: 1, search: 'Maria' })),
    );
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    const requestCountBeforeNextPage = requests.length;
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(requests).toHaveLength(requestCountBeforeNextPage + 1));
    expect(requests.at(-1)).toMatchObject({ page: 2, search: 'Maria' });
    await screen.findByText('Page 2 of 3');

    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: 'INACTIVE' },
    });
    await waitFor(() =>
      expect(requests.at(-1)).toMatchObject({
        page: 1,
        search: 'Maria',
        status: 'INACTIVE',
      }),
    );
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('offers deactivation only for active employees', async () => {
    apiClient.defaults.adapter = async (config) =>
      respondWith(config, {
        items: [employee, { ...employee, id: 'inactive-id', name: 'Inactive Employee', status: 'INACTIVE' }],
        page: 1,
        limit: 25,
        total: 2,
      });

    renderPage();

    expect(await screen.findByRole('button', { name: 'Deactivate Maria Example' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Deactivate Inactive Employee' }),
    ).not.toBeInTheDocument();
  });

  it('does not send a request when deactivation confirmation is canceled', async () => {
    const methods: string[] = [];
    apiClient.defaults.adapter = async (config) => {
      methods.push(config.method ?? '');
      return listResponse(config);
    };
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();
    await screen.findByRole('row', { name: /EMP-001 Maria Example/i });
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Maria Example' }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Maria Example'));
    expect(methods).toEqual(['get']);
  });

  it('deactivates an employee and refreshes all employee-list queries', async () => {
    let deactivated = false;
    let listRequests = 0;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const otherListKey = ['employees', 2, 25, '', 'INACTIVE'];
    queryClient.setQueryData(otherListKey, {
      items: [],
      page: 2,
      limit: 25,
      total: 0,
    });
    apiClient.defaults.adapter = async (config) => {
      if (config.method === 'patch') {
        deactivated = true;
        return respondWith(config, { ...employee, status: 'INACTIVE' });
      }

      listRequests += 1;
      return respondWith(config, {
        items: [deactivated ? { ...employee, status: 'INACTIVE' } : employee],
        page: 1,
        limit: 25,
        total: 1,
      });
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage(queryClient);
    await screen.findByRole('row', { name: /EMP-001 Maria Example/i });
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Maria Example' }));

    expect(await screen.findByText('INACTIVE')).toBeInTheDocument();
    expect(listRequests).toBe(2);
    expect(queryClient.getQueryState(otherListKey)?.isInvalidated).toBe(true);
    expect(
      screen.queryByRole('button', { name: 'Deactivate Maria Example' }),
    ).not.toBeInTheDocument();
  });

  it('disables the deactivation action while the request is pending', async () => {
    let releasePatch: (() => void) | undefined;
    let deactivated = false;
    apiClient.defaults.adapter = async (config) => {
      if (config.method === 'patch') {
        return new Promise((resolve) => {
          releasePatch = () => {
            deactivated = true;
            resolve(respondWith(config, { ...employee, status: 'INACTIVE' }));
          };
        });
      }
      return respondWith(config, {
        items: [deactivated ? { ...employee, status: 'INACTIVE' } : employee],
        page: 1,
        limit: 25,
        total: 1,
      });
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await screen.findByRole('row', { name: /EMP-001 Maria Example/i });
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Maria Example' }));
    await waitFor(() => expect(releasePatch).toBeDefined());

    expect(screen.getByRole('button', { name: 'Deactivate Maria Example' })).toBeDisabled();
    releasePatch?.();
    expect(await screen.findByText('INACTIVE')).toBeInTheDocument();
  });

  it('shows deactivation failures and allows retry', async () => {
    let patchAttempts = 0;
    let deactivated = false;
    apiClient.defaults.adapter = async (config) => {
      if (config.method === 'patch') {
        patchAttempts += 1;
        if (patchAttempts === 1) throw new Error('temporary failure');
        deactivated = true;
        return respondWith(config, { ...employee, status: 'INACTIVE' });
      }
      return respondWith(config, {
        items: [deactivated ? { ...employee, status: 'INACTIVE' } : employee],
        page: 1,
        limit: 25,
        total: 1,
      });
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await screen.findByRole('row', { name: /EMP-001 Maria Example/i });
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Maria Example' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not deactivate/i);
    expect(screen.getByRole('button', { name: 'Deactivate Maria Example' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Maria Example' }));
    expect(await screen.findByText('INACTIVE')).toBeInTheDocument();
    expect(patchAttempts).toBe(2);
  });
});
