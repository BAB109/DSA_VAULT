/**
 * Dedicated Admin API Client for DSA Vault.
 *
 * Rules:
 * - Reads admin token from sessionStorage under 'dsa_admin_token' (never in localStorage).
 * - Attaches the admin token ONLY to /api/admin/* requests.
 * - On 401, clears the token and redirects to /login with a "session expired" message.
 * - The normal user API client must never send the admin token.
 * - Never log tokens, invite links, or sensitive credentials.
 */

import { ApiError } from './apiClient';

export const ADMIN_TOKEN_KEY = 'dsa_admin_token';
export const ADMIN_EXPIRED_KEY = 'dsa_admin_expired_notice';
export const ADMIN_HAD_TOKEN_KEY = 'dsa_admin_had_token';
export const ADMIN_SESSION_ENDS_KEY = 'dsa_admin_session_ends_at';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Activity tracking state
let lastActivityTimestamp = Date.now();
let activityListenersRegistered = false;
let isRefreshing = false;

export function recordAdminActivity() {
  lastActivityTimestamp = Date.now();
}

export function getLastAdminActivity() {
  return lastActivityTimestamp;
}

function ensureActivityListeners() {
  if (activityListenersRegistered || typeof window === 'undefined') return;
  activityListenersRegistered = true;

  const events = ['click', 'keydown', 'touchstart', 'scroll'];
  let throttleTimer = null;

  const onUserActivity = () => {
    if (!throttleTimer) {
      recordAdminActivity();
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 5000); // Throttle activity updates to once every 5 seconds
    }
  };

  events.forEach((evt) => {
    window.addEventListener(evt, onUserActivity, { passive: true });
  });
}

/**
 * Read the admin token from sessionStorage.
 */
export function getAdminToken() {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Save or clear admin token in sessionStorage and dispatch change event.
 */
export function setAdminToken(token, sessionEndsAt = null) {
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
      sessionStorage.setItem(ADMIN_HAD_TOKEN_KEY, '1');
      sessionStorage.removeItem(ADMIN_EXPIRED_KEY);
      if (sessionEndsAt) {
        sessionStorage.setItem(ADMIN_SESSION_ENDS_KEY, sessionEndsAt);
      }
      ensureActivityListeners();
      recordAdminActivity();
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      sessionStorage.removeItem(ADMIN_SESSION_ENDS_KEY);
    }
  } catch {
    // Ignore storage quota/security errors
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('admin-token-changed', { detail: { token } }));
  }
}

/**
 * Remove admin token from sessionStorage.
 */
export function clearAdminToken() {
  setAdminToken(null);
}

/**
 * Decode JWT claims client-side for UX purposes only (exp, sub, scope).
 * Server remains the authority on token validity.
 */
export function decodeAdminTokenClaims(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Check if the admin token is expired based on client-side exp claim.
 */
export function isAdminTokenExpired(token) {
  const claims = decodeAdminTokenClaims(token);
  if (!claims || !claims.exp) return true;
  // Expire 5 seconds early to prevent edge races
  return Date.now() >= (claims.exp * 1000 - 5000);
}

/**
 * Check if valid admin token exists and is not expired.
 */
export function hasValidAdminToken() {
  const token = getAdminToken();
  if (!token) return false;
  return !isAdminTokenExpired(token);
}

/**
 * Call POST /api/admin/refresh to obtain a renewed admin token.
 */
export async function refreshAdminSession() {
  if (isRefreshing) return null;
  const token = getAdminToken();
  if (!token) return null;

  isRefreshing = true;
  try {
    const url = `${API_BASE_URL}/admin/refresh`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearAdminToken();
        try {
          sessionStorage.setItem(ADMIN_EXPIRED_KEY, 'Your admin session expired, please sign in again.');
        } catch {
          // Ignore
        }
      }
      return null;
    }

    const data = await res.json();
    if (data?.adminToken) {
      setAdminToken(data.adminToken, data.sessionEndsAt);
      return data;
    }
    return null;
  } catch (err) {
    console.warn('Failed to refresh admin session:', err);
    return null;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Dedicated admin fetch client.
 */
export async function adminApi(endpoint, options = {}) {
  // Normalize endpoint path ensuring it is under /admin
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!cleanEndpoint.startsWith('/admin')) {
    cleanEndpoint = `/admin${cleanEndpoint}`;
  }

  const url = `${API_BASE_URL}${cleanEndpoint}`;
  const token = getAdminToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Attach token only if available
  if (!headers['Authorization'] && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  let response;
  try {
    recordAdminActivity();
    response = await fetch(url, config);
  } catch {
    throw new ApiError('Unable to connect to the server. Please check your network connection.', 0);
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      // Clear token and record session expired notice
      clearAdminToken();
      try {
        sessionStorage.setItem(ADMIN_EXPIRED_KEY, 'Your admin session expired, please sign in again.');
      } catch {
        // Ignore storage errors
      }

      // If in browser and not already on the login page, redirect to /login
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    const message = data?.message || data?.error || `Admin request failed (${response.status})`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}
