import api from './api';

/**
 * Balance, per-module prices, and the transaction log.
 *
 * `/history` is the only endpoint that returns the live balance, so `balance()`
 * fetches it with `limit: 1` — the transaction list is discarded and only
 * `data.balance` is used. `history()` is the same endpoint asked for a page
 * worth reading.
 */
const creditService = {
  balance: () => api.get('/api/credits/history', { params: { page: 1, limit: 1 } }),

  /** @param {{page?: number, limit?: number, module?: string, days?: number}} params */
  history: (params = {}) =>
    api.get('/api/credits/history', { params: { page: 1, limit: 20, ...params } }),

  costs: () => api.get('/api/credits/costs'),
};

export default creditService;
