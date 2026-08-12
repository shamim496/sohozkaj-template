import api from './api';

/**
 * Credit packages.
 *
 * `Plan` rows are exactly what the design's "প্যাকেজ" list shows: a name, the
 * credits granted, the BDT price and an `isPopular` flag. The endpoint is
 * public, so the list renders even before a session exists.
 *
 * Buying is deliberately not here — see the note at the top of
 * `app/credits.jsx`.
 */
const planService = {
  list: () => api.get('/api/plans', { params: { status: 'active', sortBy: 'order' } }),
};

export default planService;
