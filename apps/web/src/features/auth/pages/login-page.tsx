import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { login, type LoginResponse } from '../api/auth-api';
import { useAuthSession } from '../hooks/use-auth-session';
import { currentUserQueryKey } from '../hooks/use-current-user';

const loginFormSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

const genericLoginError =
  "We couldn't sign you in. Check your email and password and try again.";

export function LoginPage() {
  const { setAccessToken } = useAuthSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
  });

  const onSubmit = async (credentials: LoginFormValues) => {
    setSubmitError(null);
    let response: LoginResponse;
    try {
      response = await login(credentials);
    } catch {
      setSubmitError(genericLoginError);
      return;
    }

    setAccessToken(response.accessToken);
    queryClient.setQueryData(currentUserQueryKey, response.user);
    void navigate(response.user.role === 'HR' ? '/hr/employees' : '/employee/attendance', {
      replace: true,
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <p className="text-sm font-semibold tracking-wide text-slate-600">Dexa WFH</p>
        <h1 id="login-title" className="mt-3 text-2xl font-semibold text-slate-950">
          Sign in
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use your work account to access your workspace.
        </p>

        <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-800">
              Email
            </label>
            <input
              {...register('email')}
              id="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none focus-visible:border-slate-500 focus-visible:ring-2 focus-visible:ring-slate-500"
            />
            {errors.email && (
              <p id="email-error" className="mt-2 text-sm text-red-700">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-800">
              Password
            </label>
            <input
              {...register('password')}
              id="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none focus-visible:border-slate-500 focus-visible:ring-2 focus-visible:ring-slate-500"
            />
            {errors.password && (
              <p id="password-error" className="mt-2 text-sm text-red-700">
                {errors.password.message}
              </p>
            )}
          </div>

          {submitError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
