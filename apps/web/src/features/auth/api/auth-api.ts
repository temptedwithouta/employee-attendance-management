import { apiClient } from '@/lib/api-client';
import {
  authenticatedUserSchema,
  loginResponseSchema,
} from '../schemas/login-schema';
import type {
  AuthenticatedUser,
  LoginInput,
  LoginResponse,
} from '../schemas/login-schema';

export type { AuthenticatedUser, LoginInput, LoginResponse } from '../schemas/login-schema';

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  const response = await apiClient.get<unknown>('/auth/me');
  return authenticatedUserSchema.parse(response.data);
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  const response = await apiClient.post<unknown>('/auth/login', input);
  return loginResponseSchema.parse(response.data);
}
