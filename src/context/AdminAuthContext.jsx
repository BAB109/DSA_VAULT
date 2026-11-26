import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAdminToken,
  clearAdminToken,
  decodeAdminTokenClaims,
  isAdminTokenExpired,
  refreshAdminSession,
  getLastAdminActivity,
  ADMIN_EXPIRED_KEY,
  ADMIN_SESSION_ENDS_KEY,
} from '../services/adminApi';
import { clearSession } from '../services/authService';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => getAdminToken());
  const [isLoading, setIsLoading] = useState(true);
  const [warningState, setWarningState] = useState(null); // null | { type: 'ending_soon', minutesLeft: number } | { type: 'cap_near', formattedTime: string }
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Parse claims client-side for UX
  const claims = useMemo(() => decodeAdminTokenClaims(token), [token]);

  const isAdminAuthed = useMemo(() => {
    if (!token) return false;
    return !isAdminTokenExpired(token);
  }, [token]);

  const logout = useCallback((reason = null) => {
    clearAdminToken();
    clearSession();
    setToken(null);
    setWarningState(null);
    if (reason === 'expired') {
      try {
        sessionStorage.setItem(ADMIN_EXPIRED_KEY, 'Your admin session expired, please sign in again.');
      } catch {
        // Ignore storage errors
      }
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await refreshAdminSession();
      if (refreshed) {
        setWarningState(null);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Listen for admin token changes dispatched by adminApi or other components
  useEffect(() => {
    const handleTokenChange = (e) => {
      const updatedToken = e.detail?.token || getAdminToken();
      setToken(updatedToken);
    };

    window.addEventListener('admin-token-changed', handleTokenChange);
    return () => window.removeEventListener('admin-token-changed', handleTokenChange);
  }, []);

  // Session monitor loop: runs every 10 seconds to check:
  // 1. Silent refresh when <20% of idle window remains AND activity in last half of window
  // 2. 5-minute warning banner before idle expiry ("Your admin session ends soon" + Stay signed in)
  // 3. Hard-cap banner ("Maximum session length reached at HH:MM, finish your work and sign in again")
  // 4. Auto-logout when expired (timer in ms)
  useEffect(() => {
    setIsLoading(true);

    if (!token) {
      setIsLoading(false);
      setWarningState(null);
      return;
    }

    if (isAdminTokenExpired(token)) {
      logout('expired');
      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    const checkSessionState = async () => {
      const currentToken = getAdminToken();
      if (!currentToken || isAdminTokenExpired(currentToken)) {
        logout('expired');
        return;
      }

      const currentClaims = decodeAdminTokenClaims(currentToken);
      if (!currentClaims || !currentClaims.exp) return;

      const now = Date.now();
      const expMs = currentClaims.exp * 1000;
      const remainingMs = expMs - now;

      if (remainingMs <= 0) {
        logout('expired');
        return;
      }

      // Read sessionEndsAt
      let sessionEndsMs = null;
      try {
        const storedEnds = sessionStorage.getItem(ADMIN_SESSION_ENDS_KEY);
        if (storedEnds) {
          sessionEndsMs = new Date(storedEnds).getTime();
        }
      } catch {
        // Ignore
      }

      // If hard cap timestamp is reached or within 5 minutes of hard cap
      const isNearHardCap = sessionEndsMs && (sessionEndsMs - now <= 5 * 60 * 1000);

      if (isNearHardCap && sessionEndsMs) {
        const d = new Date(sessionEndsMs);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setWarningState({
          type: 'cap_near',
          formattedTime: `${hours}:${minutes}`,
        });
        return;
      }

      // Calculate total idle window of current token
      const iatMs = (currentClaims.iat || (currentClaims.exp - 7200)) * 1000;
      const totalWindowMs = Math.max(1000, expMs - iatMs);
      const remainingRatio = remainingMs / totalWindowMs;

      // Silent refresh condition:
      // When < 20% of idle window remains AND there was activity in the last half of the window
      const lastActivity = getLastAdminActivity();
      const halfWindowStart = expMs - totalWindowMs / 2;
      const hadActivityInSecondHalf = lastActivity >= halfWindowStart;

      if (remainingRatio < 0.20 && hadActivityInSecondHalf) {
        // Trigger silent refresh
        const refreshed = await refreshAdminSession();
        if (refreshed) {
          setWarningState(null);
          return;
        }
      }

      // 5 minutes warning banner condition before idle expiry
      if (remainingMs <= 5 * 60 * 1000) {
        setWarningState({
          type: 'ending_soon',
          minutesLeft: Math.max(1, Math.ceil(remainingMs / 60000)),
        });
      } else {
        setWarningState(null);
      }
    };

    // Initial check
    checkSessionState();

    // Check periodically every 10 seconds
    const interval = setInterval(checkSessionState, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [token, claims, logout]);

  const value = useMemo(
    () => ({
      token,
      claims,
      isAdminAuthed,
      isLoading,
      warningState,
      isRefreshing,
      refreshSession: handleRefresh,
      logout,
    }),
    [token, claims, isAdminAuthed, isLoading, warningState, isRefreshing, handleRefresh, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
