import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from './use-auth-session';
import { getCurrentUser } from '../api/auth-api';

export const currentUserQueryKey = ['auth', 'me'] as const;

export function useCurrentUser() {
  const { accessToken, clearAccessToken } = useAuthSession();

  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: async () => {
      try {
        return await getCurrentUser();
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          clearAccessToken();
        }
        throw error;
      }
    },
    enabled: Boolean(accessToken),
  });
}
