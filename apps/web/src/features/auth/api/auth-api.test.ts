import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { getCurrentUser, login } from './auth-api';

const userResponse = {
  id: 'user-id',
  email: 'person@example.test',
  role: 'HR',
  employeeId: null,
};

const loginResponse = {
  accessToken: 'access-token',
  user: userResponse,
};

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

describe('auth API', () => {
  beforeEach(() => {
    sessionStorage.setItem('dexa.accessToken', 'session-token');
    requestConfig = undefined;
    originalAdapter = apiClient.defaults.adapter;
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    sessionStorage.clear();
  });

  it('sends the stored bearer token and parses the current user response', async () => {
    respondWith(userResponse);

    await expect(getCurrentUser()).resolves.toEqual(userResponse);
    expect(requestConfig?.url).toBe('/auth/me');
    expect(requestConfig?.headers.get('Authorization')).toBe('Bearer session-token');
  });

  it('rejects a current-user response with an unsupported role', async () => {
    respondWith({ ...userResponse, role: 'ADMIN' });

    await expect(getCurrentUser()).rejects.toThrow();
  });

  it('sends credentials and parses a valid login response', async () => {
    respondWith(loginResponse);
    const credentials = { email: 'person@example.test', password: 'passphrase' };

    await expect(login(credentials)).resolves.toEqual(loginResponse);
    expect(requestConfig?.url).toBe('/auth/login');
    expect(requestConfig?.method).toBe('post');
    expect(JSON.parse(String(requestConfig?.data))).toEqual(credentials);
  });

  it('rejects a malformed login response', async () => {
    respondWith({
      ...loginResponse,
      user: { ...userResponse, role: 'ADMIN' },
    });

    await expect(
      login({ email: 'person@example.test', password: 'passphrase' }),
    ).rejects.toThrow();
  });
});
