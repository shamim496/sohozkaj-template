import api from './api';

/**
 * Only the calls this app needs.
 *
 * Accounts are created in the main SohozKaj app — this one is three tools and a
 * sign-in, so there is deliberately no register or password-reset flow.
 */
const authApi = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  getCurrentUser: () => api.get('/api/auth/me'),
};

export default authApi;
