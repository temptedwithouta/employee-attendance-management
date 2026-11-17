import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { PageState } from '@/components/shared/page-state';
import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const currentUser = useCurrentUser();
  const { clearAccessToken } = useAuthSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAccessToken();
    queryClient.clear();
    void navigate('/login', { replace: true });
  };

  if (currentUser.isPending) {
    return <PageState kind="loading" title="Loading your workspace" />;
  }
  if (currentUser.isError || !currentUser.data) {
    return (
      <PageState
        kind="error"
        title="Could not load your workspace"
        description="Check your connection and try again."
        onRetry={() => {
          void currentUser.refetch();
        }}
      />
    );
  }

  const links =
    currentUser.data.role === 'HR'
      ? [
          { to: '/hr/employees', label: 'Employees' },
          { to: '/hr/attendance', label: 'Attendance' },
        ]
      : [{ to: '/employee/attendance', label: 'WFH attendance' }];

  return (
    <div className="min-h-screen bg-slate-50">
      <a
        className="sr-only rounded-md bg-white px-4 py-2 text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-10 focus:ring-2 focus:ring-slate-500"
        href="#main-content"
      >
        Skip to main content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-lg font-semibold text-slate-950">Dexa WFH</p>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Primary navigation" className="flex flex-wrap items-center gap-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500',
                      isActive
                        ? 'bg-slate-100 text-slate-950'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      >
        <Outlet />
      </main>
    </div>
  );
}
