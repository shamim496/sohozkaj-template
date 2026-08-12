import api from './api';

/**
 * Image generation — the "AI photo edit" feature, and the history both it and
 * template generate write into.
 */
const imageGenerationService = {
  /**
   * Multipart: `image`, `size`, `dress`, `dressCode`, `bg`, optional
   * `extraGuide` / `extraGuideLabel` / `userCustomInstruction` /
   * `toolSelections`, plus `officeSpaceId` and `displayName`.
   */
  generate: (formData) => api.post('/api/image-generation/generate', formData, { timeout: 180000 }),

  /**
   * @param {{page?, limit?, officeSpaceId?, search?, sortOrder?, source?}} params
   *        `source` is 'regular' | 'ai-templates' | 'manual'.
   */
  history: (params = {}) => api.get('/api/image-generation/history', { params }),

  get: (id) => api.get(`/api/image-generation/${id}`),

  remove: (id) => api.delete(`/api/image-generation/delete/${id}`),

  rename: (id, fileName) => api.patch(`/api/image-generation/${id}`, { fileName }),

  /** Best-effort analytics — the caller never waits on or fails over these. */
  trackDownload: (id) => api.patch(`/api/image-generation/track-download/${id}`).catch(() => null),

  submitFeedback: (id, feedback) => api.patch(`/api/image-generation/feedback/${id}`, { feedback }),
};

export default imageGenerationService;
