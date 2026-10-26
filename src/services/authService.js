// ==============================================================================
// AUTH SERVICE - Centralized Client Connected to Express Backend API
// ==============================================================================

import apiClient from './apiClient';

const SESSION_KEY = 'dsa_vault_session';

// ─── Pure Client-side Validation Helpers ─────────────────────────────────────
export function validateUsername(username) {
  if (!username || !username.trim()) return 'Username is required.';
  const u = username.trim();
  if (u.length < 3) return 'Username must be at least 3 characters.';
  if (u.length > 30) return 'Username must be 30 characters or fewer.';
  if (!/^[A-Za-z0-9]/.test(u)) return 'Username must start with a letter or digit.';
  if (!/^[A-Za-z0-9_-]+$/.test(u)) return 'Username may only contain letters, digits, underscores, and hyphens.';
  return null;
}

export function validatePassword(password) {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

export function validateConfirmPassword(password, confirm) {
  if (!confirm) return 'Please confirm your password.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

// ─── Session Helpers (sessionStorage only) ────────────────────────────────────
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function _saveSession(user, token) {
  const session = {
    userId: user.id,
    username: user.username,
    token,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── Service Functions ────────────────────────────────────────────────────────
export const authService = {
  /**
   * Register a new user.
   * Calls: POST /api/auth/register
   */
  register: async ({ username, password }) => {
    const normalizedUsername = username.trim();

    try {
      const data = await apiClient('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: normalizedUsername, password }),
      });

      return _saveSession(data.user, data.token);
    } catch (err) {
      if (err.status === 403 || err.message === 'ACCOUNT_LIMIT_REACHED' || err.data?.error === 'ACCOUNT_LIMIT_REACHED') {
        throw new Error('ACCOUNT_LIMIT_REACHED');
      }
      if (err.status === 409 || err.message === 'USERNAME_TAKEN' || err.data?.error === 'USERNAME_TAKEN') {
        throw new Error('USERNAME_TAKEN');
      }
      throw err;
    }
  },

  /**
   * Log in an existing user.
   * Calls: POST /api/auth/login
   */
  login: async ({ username, password }) => {
    const normalizedUsername = username.trim();

    try {
      const data = await apiClient('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: normalizedUsername, password }),
      });

      return _saveSession(data.user, data.token);
    } catch (err) {
      if (err.status === 401 || err.message === 'INVALID_CREDENTIALS') {
        throw new Error('INVALID_CREDENTIALS');
      }
      throw err;
    }
  },

  /**
   * Log out current user
   */
  logout: async () => {
    clearSession();
  },

  /**
   * Verify token validity.
   * Calls: GET /api/auth/me
   */
  verifySession: async () => {
    let session = getSession();

    // Check if token was passed via URL from the mobile companion app (SSO)
    if (!session || !session.token) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const ssoToken = urlParams.get('auth_token') || hashParams.get('token');

        if (ssoToken) {
          session = { token: ssoToken };
          // Clean the token from address bar immediately for security and clean display
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      } catch {}
    }
    if (!session || !session.token) return null;

    try {
      const data = await apiClient('/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });

      return _saveSession(data.user, session.token);
    } catch (err) {
      clearSession();
      return null;
    }
  },
};
