import api from './api';

/**
 * AI templates — the "template generate" feature.
 *
 * Only the read + generate half of the web API is here; creating and editing
 * templates is an admin job that happens in the browser.
 */
const aiTemplateService = {
  /**
   * @param {{search?: string, category?: string, sort?: 'new'|'popular'|'default'}} params
   *        `category` is a slug. `sort` drives the hub's heading: the design
   *        calls the unfiltered grid "জনপ্রিয়" (Popular), which is
   *        `sort=popular` — most-generated first — not the admin's curated
   *        `sortOrder` the default returns.
   */
  list: (params = {}) => api.get('/api/ai-templates', { params }),

  categories: () => api.get('/api/ai-templates/categories'),

  /** Accepts a numeric id or a slug. */
  get: (idOrSlug) => api.get(`/api/ai-templates/${idOrSlug}`),

  /**
   * Multipart: `image` (+ `image_2`, `image_3`, …), `officeSpaceId`,
   * `displayName`, and one part per dynamic field keyed by the field's `key`.
   *
   * Generation runs the photo through the image model, which routinely takes
   * over a minute — hence the explicit timeout well above the client default.
   */
  generate: (id, formData) =>
    api.post(`/api/ai-templates/${id}/generate`, formData, { timeout: 180000 }),
};

export default aiTemplateService;
