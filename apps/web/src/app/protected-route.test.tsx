import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser, type AuthenticatedUser } from '../features/auth/api/auth-api';
import { AuthSessionProvider } from '../features/auth/auth-session';
import { RequireRole } from './protected-route';

vi.mock('../features/auth/api/auth-api', () => ({
  getCurrentUser: vi.fn(),
}));

const user: AuthenticatedUser = {
  id: 'user-id',
  email: 'person@example.test',
  role: 'HR',
  employeeId: null,
};

function renderProtectedRoute(role: AuthenticatedUser['role']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<p>Login route</p>} />
            <Route element={<RequireRole role={role} />}>
              <Route path="/protected" element={<p>Protected content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>
    </QueryClientProvider>,
  );
}

function httpError(status: number): AxiosError {
  const error = new AxiosError(`HTTP ${status}`);
  error.response = {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  };
  return error;
}

describe('RequireRole', () => {
  afterEach(cleanup);

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('redirects missing sessions without requesting the current user', () => {
    renderProtectedRoute('HR');

    expect(screen.getByText('Login route')).toBeInTheDocument();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('clears a rejected session and redirects after a 401', async () => {
    sessionStorage.setItem('dexa.accessToken', 'expired-token');
    vi.mocked(getCurrentUser).mockRejectedValueOnce(httpError(401));

    renderProtectedRoute('HR');

    expect(await screen.findByText('Login route')).toBeInTheDocument();
    expect(sessionStorage.getItem('dexa.accessToken')).toBeNull();
  });

  it('shows retry for temporary API errors without clearing the session', async () => {
    sessionStorage.setItem('dexa.accessToken', 'valid-token');
    vi.mocked(getCurrentUser).mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce(user);

    renderProtectedRoute('HR');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not verify your session');
    expect(sessionStorage.getItem('dexa.accessToken')).toBe('valid-token');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(2));
  });

  it('shows a loading state while the current user request is pending', async () => {
    sessionStorage.setItem('dexa.accessToken', 'valid-token');
    vi.mocked(getCurrentUser).mockReturnValueOnce(new Promise(() => {}));

    renderProtectedRoute('HR');

    expect(await screen.findByRole('status')).toHaveTextContent('Checking your session');
  });

  it.each([
    ['HR', 'EMPLOYEE'],
    ['EMPLOYEE', 'HR'],
  ] as const)('denies %s access to a %s route', async (routeRole, userRole) => {
    sessionStorage.setItem('dexa.accessToken', 'valid-token');
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      ...user,
      role: userRole,
    });

    renderProtectedRoute(routeRole);

    expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
