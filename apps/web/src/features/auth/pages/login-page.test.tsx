import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { AuthSessionProvider } from '../auth-session';
import type { LoginResponse } from '../api/auth-api';
import { currentUserQueryKey } from '../hooks/use-current-user';
import { LoginPage } from './login-page';

const employeeLogin: LoginResponse = {
  accessToken: 'employee-token',
  user: {
    id: 'employee-user',
    email: 'employee@example.test',
    role: 'EMPLOYEE',
    employeeId: 'employee-id',
  },
};

const hrLogin: LoginResponse = {
  accessToken: 'hr-token',
  user: {
    id: 'hr-user',
    email: 'hr@example.test',
    role: 'HR',
    employeeId: null,
  },
};

let originalAdapter = apiClient.defaults.adapter;

function respondWith(data: unknown) {
  apiClient.defaults.adapter = async (config) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
  });
}

function rejectWithStatus(status: number) {
  apiClient.defaults.adapter = async (config) => {
    const response = {
      data: { message: 'Sensitive backend detail' },
      status,
      statusText: 'Unauthorized',
      headers: new AxiosHeaders(),
      config,
    };
    throw new AxiosError(
      'Request failed',
      undefined,
      config,
      undefined,
      response,
    );
  };
}

function renderLogin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/employee/attendance" element={<p>Employee attendance route</p>} />
            <Route path="/hr/employees" element={<p>HR employees route</p>} />
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>
    </QueryClientProvider>,
  );

  return queryClient;
}

function fillCredentials(email: string, password = 'correct-horse-battery') {
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    originalAdapter = apiClient.defaults.adapter;
  });

  afterEach(() => {
    cleanup();
    apiClient.defaults.adapter = originalAdapter;
    sessionStorage.clear();
  });

  it('requires an email and password', () => {
    renderLogin();

    expect(screen.getByRole('textbox', { name: 'Email' })).toBeRequired();
    expect(screen.getByLabelText('Password')).toBeRequired();
  });

  it('shows field errors and skips the API for an invalid email and blank password', async () => {
    let requestCount = 0;
    apiClient.defaults.adapter = async (config) => {
      requestCount += 1;
      return {
        data: employeeLogin,
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      };
    };
    renderLogin();
    fillCredentials('not-an-email', '');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(requestCount).toBe(0);
  });

  it('shows a generic 401 error without clearing the entered credentials', async () => {
    rejectWithStatus(401);
    renderLogin();
    fillCredentials('employee@example.test');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't sign you in. Check your email and password and try again.",
    );
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue(
      'employee@example.test',
    );
    expect(screen.getByLabelText('Password')).toHaveValue('correct-horse-battery');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Sensitive backend detail');
    expect(sessionStorage.getItem('dexa.accessToken')).toBeNull();
  });

  it('does not establish a session when the response schema is invalid', async () => {
    respondWith({
      ...employeeLogin,
      user: { ...employeeLogin.user, role: 'ADMIN' },
    });
    const queryClient = renderLogin();
    fillCredentials('employee@example.test');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't sign you in. Check your email and password and try again.",
    );
    expect(sessionStorage.getItem('dexa.accessToken')).toBeNull();
    expect(queryClient.getQueryData(currentUserQueryKey)).toBeUndefined();
    expect(screen.queryByText('Employee attendance route')).not.toBeInTheDocument();
  });

  it.each([
    [employeeLogin, 'employee@example.test', 'Employee attendance route'],
    [hrLogin, 'hr@example.test', 'HR employees route'],
  ] as const)(
    'establishes a session and redirects %s users to their role landing page',
    async (response, email, landingPage) => {
      respondWith(response);
      const queryClient = renderLogin();
      fillCredentials(email);

      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(await screen.findByText(landingPage)).toBeInTheDocument();
      expect(sessionStorage.getItem('dexa.accessToken')).toBe(response.accessToken);
      expect(queryClient.getQueryData(currentUserQueryKey)).toEqual(response.user);
    },
  );

  it('disables submit while login is pending to prevent duplicate submissions', async () => {
    let releaseLogin: (() => void) | undefined;
    let requestCount = 0;
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      requestCount += 1;
      await new Promise<void>((resolve) => {
        releaseLogin = resolve;
      });
      return {
        data: employeeLogin,
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      };
    };
    renderLogin();
    fillCredentials('employee@example.test');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const submitButton = screen.getByRole('button', { name: 'Signing in...' });
    expect(submitButton).toBeDisabled();
    await waitFor(() => expect(requestCount).toBe(1));
    fireEvent.click(submitButton);
    expect(requestCount).toBe(1);

    releaseLogin?.();
    await waitFor(() => {
      expect(screen.getByText('Employee attendance route')).toBeInTheDocument();
    });
  });
});
