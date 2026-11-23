/**
 * Centralized API client for DSA Vault frontend.
 * - Handles base URL configuration from VITE_API_URL or relative /api
 * - Automatically injects JWT Bearer token from sessionStorage
 * - Handles token expiration / 401 unauthorized errors gracefully
 * - Standardizes error reporting
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Low-level request wrapper
 */
export async function apiClient(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Retrieve stored session token
  let token = null;
  try {
    const rawSession = sessionStorage.getItem('dsa_vault_session');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      token = parsed.token;
    }
  } catch {
    // Ignore storage parse errors
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (!headers['Authorization'] && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
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
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    // If token expired or unauthorized on private endpoint, clear session and dispatch auth event
    if (response.status === 401 && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/register')) {
      sessionStorage.removeItem('dsa_vault_session');
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    const message = (data && typeof data === 'object' && (data.message || data.error)) || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

export default apiClient;
