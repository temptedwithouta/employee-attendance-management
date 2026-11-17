import { useCallback, useState, type ReactNode } from 'react';
import { ACCESS_TOKEN_KEY, AuthSessionContext } from './auth-session-context';

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState(() =>
    sessionStorage.getItem(ACCESS_TOKEN_KEY),
  );
  const setAccessToken = useCallback((token: string) => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    setAccessTokenState(token);
  }, []);
  const clearAccessToken = useCallback(() => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    setAccessTokenState(null);
  }, []);

  return (
    <AuthSessionContext.Provider value={{ accessToken, setAccessToken, clearAccessToken }}>
      {children}
    </AuthSessionContext.Provider>
  );
}
