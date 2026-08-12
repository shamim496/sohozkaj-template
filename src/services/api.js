import axios from 'axios';
import { API_URL } from '../lib/env';
import { getCurrentPath } from '../lib/navigation';
import { getToken, handleUnauthorized } from '../lib/session';

// The web app fell back to a relative baseURL and let the same origin resolve
// it. A native binary has no origin, so API_URL must be absolute.
const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  // AI generation runs the image through the model server-side; the default
  // 0 (no timeout) would hang forever on a dropped connection, and anything
  // under a minute would abort a perfectly healthy generate.
  timeout: 60000,
});

// Endpoints that must never carry an Authorization header.
const PUBLIC_ENDPOINTS = ['/auth/login', '/auth/send-otp', '/auth/verify-otp'];

// A 401 from these is a normal failed-credentials response, not an expired
// session — never force a logout for them.
const AUTH_ENDPOINTS = [...PUBLIC_ENDPOINTS, '/auth/forgot-password', '/auth/reset-password'];

apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    const isPublic = PUBLIC_ENDPOINTS.some((endpoint) => config.url?.includes(endpoint));

    if (token && !isPublic) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // React Native's fetch/XHR sets its own multipart boundary; leaving an
    // explicit Content-Type here produces a boundary-less request the server
    // cannot parse.
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('The request timed out. Check your connection and try again.'));
    }
    if (!error.response) {
      return Promise.reject(new Error('Network error — could not reach the server.'));
    }

    const { status, data } = error.response;

    if (status === 401) {
      const url = error.config?.url || '';
      const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

      // Only force a logout when the user actually had a session and hit a
      // protected endpoint — a 401 from /auth/login is just a wrong password.
      if (getToken() && !isAuthEndpoint && getCurrentPath() !== '/login') {
        handleUnauthorized();
        return Promise.reject(new Error('Your session has expired. Please sign in again.'));
      }
    }

    // Preserve code + data on the Error so callers can branch on specific
    // server codes (INSUFFICIENT_CREDITS is the one that matters here) instead
    // of matching on a message string.
    const err = new Error(data?.message || 'Something went wrong on the server.');
    if (data?.code) err.code = data.code;
    if (data?.data) err.data = data.data;
    err.status = status;
    return Promise.reject(err);
  }
);

export default apiClient;
