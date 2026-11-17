import { z } from 'zod';

const requiredText = (label: string, maximum: number) =>
  z.string().trim().min(1, `${label} is required.`).max(maximum, `${label} is too long.`);

export const employeeEditSchema = z.object({
  employeeNumber: requiredText('Employee number', 64),
  name: requiredText('Name', 150),
  email: z.string().trim().max(191, 'Email is too long.').email('Enter a valid email address.'),
  department: requiredText('Department', 100),
  position: requiredText('Position', 100),
});

export const employeeCreateSchema = employeeEditSchema.extend({
  initialPassword: z.string()
    .min(12, 'Password must be 12–1024 characters.')
    .max(1024, 'Password must be 12–1024 characters.')
    .regex(/\S/, 'Password must contain a non-whitespace character.'),
});
