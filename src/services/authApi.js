import api from './api';

/**
 * Only the calls this app needs.
 *
 * Two groups. The signed-out ones — sign-in, registration, password reset — take
 * no token and are listed as public in `api.js` so a stale one is never attached
 * and a 401 from them is read as "wrong credentials", not "dead session".
 *
 * The rest edit *the caller*: there is no `/api/users` mount on the backend at
 * all, and no `:id` to pass. Each is guarded by `authenticate` alone, so a
 * normal account may call them.
 */
const authApi = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  getCurrentUser: () => api.get('/api/auth/me'),

  // ── Registration ──────────────────────────────────────────────────────────
  //
  // Three calls, in this order: `preRegister` writes an *unverified* row and
  // sends the SMS code, `verifyOtp` marks the code used, and `register` is what
  // actually creates the account and answers with `{ user, token }`. Skipping
  // the middle one fails — `register` re-checks the verification server-side.

  /** Saves the unverified account and texts a 6-digit code. */
  preRegister: (payload) => api.post('/api/auth/pre-register', payload),

  /** Re-sends the SMS code for a registration already started. */
  sendOtp: (payload) => api.post('/api/auth/send-otp', payload),

  /**
   * The email-code equivalent, for the non-Bangladesh flow. It also writes the
   * address onto the pending registration, so it doubles as "I mistyped my
   * email" — which `send-otp` cannot do.
   */
  sendRegistrationEmailOtp: (payload) => api.post('/api/auth/send-registration-email-otp', payload),

  verifyOtp: (payload) => api.post('/api/auth/verify-otp', payload),

  /** Completes registration. Returns `{ user, token }` — a live session. */
  register: (payload) => api.post('/api/auth/register', payload),

  /**
   * For an account that was pre-registered but never verified: verifies the code
   * and signs it in, without re-sending name or password. This is the path a
   * `PHONE_NOT_VERIFIED` sign-in takes.
   */
  verifyAndLogin: (payload) => api.post('/api/auth/verify-and-login', payload),

  /** Moves a pending registration to another number and texts a fresh code. */
  changeRegistrationPhone: (payload) => api.post('/api/auth/change-registration-phone', payload),

  // ── Password reset ────────────────────────────────────────────────────────

  forgotPassword: (payload) => api.post('/api/auth/forgot-password', payload),

  /** Verifies the code itself when the caller has not already done so. */
  resetPassword: (payload) => api.post('/api/auth/reset-password', payload),

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
