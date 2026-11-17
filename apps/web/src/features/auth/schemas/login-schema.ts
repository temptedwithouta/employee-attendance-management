import { z } from 'zod';

export const authenticatedUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(['EMPLOYEE', 'HR']),
  employeeId: z.string().nullable(),
});

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: authenticatedUserSchema,
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type LoginInput = { email: string; password: string };
export type LoginResponse = z.infer<typeof loginResponseSchema>;
