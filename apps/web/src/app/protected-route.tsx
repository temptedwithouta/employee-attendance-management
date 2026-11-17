import { PageState } from '@/components/shared/page-state';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { Navigate, Outlet } from 'react-router-dom';

interface RequireRoleProps {
  role: 'EMPLOYEE' | 'HR';
}

export function RequireRole({ role }: RequireRoleProps) {
  const { accessToken } = useAuthSession();
  const currentUser = useCurrentUser();

  if (!accessToken) return <Navigate to="/login" replace />;
  if (currentUser.isPending) {
    return <PageState kind="loading" title="Checking your session" />;
  }
  if (currentUser.isError) {
    return (
      <PageState
        kind="error"
        title="Could not verify your session"
        description="Check your connection and try again."
        onRetry={() => {
          void currentUser.refetch();
        }}
      />
    );
  }
  if (currentUser.data.role !== role) {
    return (
      <PageState
        kind="error"
        title="Access denied"
        description="Your account does not have access to this area."
      />
    );
  }

  return <Outlet />;
}
