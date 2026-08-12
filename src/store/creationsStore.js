import { create } from 'zustand';
import imageGenerationService from '../services/imageGenerationService';

/**
 * "My creations" — every image this account has generated from a template.
 *
 * It is the generation history, filtered server-side to `source: 'ai-templates'`
 * so the main SohozKaj app's document photos, bulk jobs and manual edits never
 * appear here. This app only makes template images, but the account is shared
 * with apps that make other kinds, and the user did not create those *here*.
 *
 * Not persisted. The list is remote-owned — a result deleted on the web should
 * not linger in a cache — and one page is a single cheap request on focus.
 */
const PAGE_SIZE = 30;

/**
 * `sortOrder` is an enum in the route's Fastify schema: 'newest' | 'oldest'.
 * Anything else (the 'desc' most REST APIs take) is a 400 before the handler
 * ever runs.
 */
const QUERY = { source: 'ai-templates', sortOrder: 'newest' };

export const useCreationsStore = create((set, get) => ({
  items: [],
  status: 'idle', // idle | loading | ready | error
  error: '',
  page: 1,
  hasMore: true,
  isLoadingMore: false,

  /** First page. Re-run on tab focus and after every successful generate. */
  refresh: async (officeSpaceId) => {
    if (get().status === 'loading') return;
    set({ status: get().items.length ? 'ready' : 'loading', error: '' });
    try {
      const response = await imageGenerationService.history({
        ...QUERY,
        page: 1,
        limit: PAGE_SIZE,
        ...(officeSpaceId ? { officeSpaceId } : null),
      });
      const items = response?.data?.history || [];
      const total = response?.data?.pagination?.total ?? items.length;
      set({ items, status: 'ready', page: 1, hasMore: items.length < total });
    } catch (error) {
      set({ status: 'error', error: error.message || '' });
    }
  },

  loadMore: async (officeSpaceId) => {
    const { hasMore, isLoadingMore, page, items } = get();
    if (!hasMore || isLoadingMore) return;
    set({ isLoadingMore: true });
    try {
      const response = await imageGenerationService.history({
        ...QUERY,
        page: page + 1,
        limit: PAGE_SIZE,
        ...(officeSpaceId ? { officeSpaceId } : null),
      });
      const next = response?.data?.history || [];
      const total = response?.data?.pagination?.total ?? items.length + next.length;
      const merged = items.concat(next);
      set({ items: merged, page: page + 1, hasMore: merged.length < total, isLoadingMore: false });
    } catch {
      // A failed page 2 leaves page 1 on screen; retrying is a scroll away.
      set({ isLoadingMore: false });
    }
  },

  /**
   * Puts a just-finished generate at the top without waiting for a round trip,
   * so the Creations tab is already correct when the user gets there.
   */
  prepend: (record) =>
    set((state) =>
      record?.id && !state.items.some((x) => String(x.id) === String(record.id))
        ? { items: [record, ...state.items], status: 'ready' }
        : state
    ),

  remove: (id) =>
    set((state) => ({ items: state.items.filter((x) => String(x.id) !== String(id)) })),

  reset: () => set({ items: [], status: 'idle', error: '', page: 1, hasMore: true }),
}));

/**
 * The generate endpoint returns the row's bare numeric id; `/history` returns
 * the same row source-tagged (`t<id>` for an AiTemplateImage — see
 * `utils/imageRef.js` in the backend). Both are valid on `GET /:id`, but only
 * one of them dedupes against the history list, so a fresh result is tagged on
 * the way into the store.
 */
export const asTemplateImageRef = (id) =>
  /^\d+$/.test(String(id)) ? `t${id}` : String(id);

/** Which template produced a result. `/history` returns it as a top-level field. */
export const templateIdOf = (record) =>
  record?.aiTemplateId == null ? null : Number(record.aiTemplateId);

/**
 * Field names on a history row, for reference at the call sites that read them
 * directly: `aiImage` is the finished image, `uploadedImage` the photo the user
 * fed in, `fileName` the display name, `timestamp` the creation time.
 */
