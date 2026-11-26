import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, getSession, clearSession } from '../services/authService';
import { clearAdminToken } from '../services/adminApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = "checking"

  // On mount: verify the stored session is still valid
  useEffect(() => {
    authService.verifySession()
      .then((s) => setSession(s))
      .catch(() => {
        clearSession();
        clearAdminToken();
        setSession(null);
      });

    const handleExpired = () => {
      clearAdminToken();
      setSession(null);
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const login = useCallback(async (credentials) => {
    const s = await authService.login(credentials);
    setSession(s);
    return s;
  }, []);

  const register = useCallback(async (credentials) => {
    const s = await authService.register(credentials);
    setSession(s);
    return s;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearAdminToken();
      setSession(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ session, login, register, logout, isLoading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
