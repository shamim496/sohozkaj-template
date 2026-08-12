import api from './api';

/**
 * Buying credits.
 *
 * Two gateways sit on two different prefixes and are *not* interchangeable:
 * SSLCommerz at `/api/payments/ssl/*` and Moneybag at the bare
 * `/api/payments/*`. Which one is live is a server setting, never a constant
 * here — `config()` returns `activePaymentGateway`, and calling the wrong
 * gateway's `/verify` 404s because each looks its row up filtered by its own
 * `gateway` column.
 *
 * `status()` and `history()` are the exception: they live only on the bare
 * prefix and are gateway-agnostic, so both flows poll the same endpoint.
 *
 * FastSpring (`/api/payments/fastspring`) is deliberately absent. It returns a
 * `sessionId` for a JS popup rather than a redirect URL, has no verify endpoint,
 * and settles by webhook only — there is nothing a native client can drive.
 */
const paymentService = {
  /**
   * `{ globalShowBuyCreditTab, activePaymentGateway }`.
   *
   * `globalShowBuyCreditTab` is a server kill switch: when it is off, selling
   * is off, and the app must stop offering it rather than let a checkout 400.
   */
  config: () => api.get('/api/credits/config'),

  /** → `{ redirectUrl, orderId }`. 403s an OPERATOR, 400s an inactive plan. */
  checkoutSsl: (planId) => api.post('/api/payments/ssl/checkout', { planId }),

  /** The same body and the same response shape, on the other gateway. */
  checkoutMoneybag: (planId) => api.post('/api/payments/checkout', { planId }),

  /** `ref` is the orderId. SSLCommerz queries by our own tran_id, so no body. */
  verifySsl: (ref) => api.post(`/api/payments/ssl/verify/${ref}`),

  /**
   * Moneybag's verify needs the gateway's `transaction_id` — the one it puts in
   * the return URL. Without it the server can only fall back to the stored
   * session id, which Moneybag's own API 404s on.
   */
  verifyMoneybag: (ref, transactionId) =>
    api.post(`/api/payments/verify/${ref}`, transactionId ? { transactionId } : {}),

  /** The final word on an order: `{ status, credits, amount, failureReason }`. */
  status: (orderId) => api.get(`/api/payments/status/${orderId}`),

  /** @param {{page?: number, limit?: number}} params */
  history: (params = {}) =>
    api.get('/api/payments/history', { params: { page: 1, limit: 20, ...params } }),
};

export default paymentService;
