import api from './api';

/**
 * Only the calls this app needs.
 *
 * Accounts are created in the main SohozKaj app — this one is three tools and a
 * sign-in, so there is deliberately no register or password-reset flow.
 *
 * Everything under `/api/auth` here edits *the caller*: there is no
 * `/api/users` mount on the backend at all, and no `:id` to pass. Each of these
 * is guarded by `authenticate` alone, so a normal account may call them.
 */
const authApi = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  getCurrentUser: () => api.get('/api/auth/me'),

  /**
   * Partial update — only the keys present are written, `null` clears a value
   * and an absent key leaves it alone.
   *
   * The response omits `phoneVerified` / `emailVerified`, so the caller must
   * re-read `/me` rather than store what comes back from here.
   */
  updateProfile: (fields) => api.put('/api/auth/profile', fields),

  /** Multipart, one file, jpeg/png/webp. The server re-encodes it to 400px WebP. */
  uploadProfilePicture: (formData) => api.post('/api/auth/profile/picture', formData),

  changePassword: (payload) => api.post('/api/auth/change-password', payload),
};

export default authApi;
