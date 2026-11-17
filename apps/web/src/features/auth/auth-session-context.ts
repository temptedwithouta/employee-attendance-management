import { createContext } from 'react';

export const ACCESS_TOKEN_KEY = 'dexa.accessToken';

export interface AuthSessionContextValue {
  accessToken: string | null;
  setAccessToken: (token: string) => void;
  clearAccessToken: () => void;
}

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);
