import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './app/app-layout';
import { AuthSessionProvider } from './features/auth/auth-session';
import { getCurrentUser, type AuthenticatedUser } from './features/auth/api/auth-api';
import { currentUserQueryKey } from './features/auth/hooks/use-current-user';

vi.mock('./features/auth/api/auth-api', () => ({
  getCurrentUser: vi.fn(),
}));

const hrUser: AuthenticatedUser = {
  id: 'hr-user',
  email: 'hr@example.test',
  role: 'HR',
  employeeId: null,
};

const employeeUser: AuthenticatedUser = {
  ...hrUser,
  id: 'employee-user',
  email: 'employee@example.test',
  role: 'EMPLOYEE',
  employeeId: 'employee-id',
};

function LogoutDestination({ queryClient }: { queryClient: QueryClient }) {
  return (
    <p>
      <span>Login route</span>
      <span data-testid="logout-token">{sessionStorage.getItem('dexa.accessToken') ?? 'null'}</span>
      <span data-testid="logout-identity">
        {queryClient.getQueryData(currentUserQueryKey) ? 'present' : 'missing'}
      </span>
    </p>
  );
}

function renderLayout(user: AuthenticatedUser) {
  sessionStorage.setItem('dexa.accessToken', 'valid-token');
  vi.mocked(getCurrentUser).mockResolvedValueOnce(user);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <MemoryRouter initialEntries={['/page']}>
          <Routes>
            <Route path="/login" element={<LogoutDestination queryClient={queryClient} />} />
            <Route element={<AppLayout />}>
              <Route path="/page" element={<p>Role page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe('AppLayout', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders semantic landmarks and HR-only navigation', async () => {
    renderLayout(hrUser);

    const navigation = await screen.findByRole('navigation', { name: 'Primary navigation' });
    expect(screen.getByRole('main')).toContainElement(screen.getByText('Role page'));
    expect(within(navigation).getByRole('link', { name: 'Employees' })).toHaveAttribute(
      'href',
      '/hr/employees',
    );
    expect(within(navigation).getByRole('link', { name: 'Attendance' })).toHaveAttribute(
      'href',
      '/hr/attendance',
    );
    expect(
      within(navigation).queryByRole('link', { name: 'WFH attendance' }),
    ).not.toBeInTheDocument();
  });

  it('renders only employee navigation for an employee', async () => {
    renderLayout(employeeUser);

    const navigation = await screen.findByRole('navigation', { name: 'Primary navigation' });
    expect(within(navigation).getByRole('link', { name: 'WFH attendance' })).toHaveAttribute(
      'href',
      '/employee/attendance',
    );
    expect(within(navigation).queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument();
  });

  it('clears the token, identity, and feature data before navigating to login', async () => {
    const { queryClient } = renderLayout(employeeUser);

    await screen.findByRole('navigation', { name: 'Primary navigation' });
    queryClient.setQueryData(['employees', 1], { items: [{ id: 'employee-id' }] });
    queryClient.setQueryData(['attendance', 'photo', 'attendance-id'], new Blob(['photo']));
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByText('Login route')).toBeInTheDocument();
    expect(screen.getByTestId('logout-token')).toHaveTextContent('null');
    expect(screen.getByTestId('logout-identity')).toHaveTextContent('missing');
    expect(queryClient.getQueryData(['employees', 1])).toBeUndefined();
    expect(queryClient.getQueryData(['attendance', 'photo', 'attendance-id'])).toBeUndefined();
    expect(sessionStorage.getItem('dexa.accessToken')).toBeNull();
  });
});
