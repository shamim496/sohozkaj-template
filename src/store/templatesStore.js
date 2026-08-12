import { create } from 'zustand';
import aiTemplateService from '../services/aiTemplateService';

/**
 * The template catalogue, fetched once.
 *
 * `GET /api/ai-templates` takes `search` and `category`, so the obvious build is
 * a request per keystroke. It is not worth it here, and the reason is in the
 * endpoint: it runs the category filter in SQL but the *search* in JavaScript,
 * after loading every matching row — `templates.filter(t => t.name…includes(q))`
 * over name, nameBn and tags. A search request therefore costs a full table read
 * to do work this app can do on a list it already holds.
 *
 * So: one unfiltered fetch, and `select()` below reproduces the server's filter
 * exactly — same fields, same case-insensitive substring, same category-slug
 * match. Typing is instant and offline-tolerant, and the semantics are the
 * server's, not an approximation of them.
 *
 * The list is small by construction (an admin-curated gallery, published rows
 * only) and every row is needed anyway: the favourites tab resolves stored ids
 * against it, and the picker sheet renders from it.
 */
export const useTemplatesStore = create((set, get) => ({
  items: [],
  categories: [],
  status: 'idle', // idle | loading | ready | error
  error: '',

  load: async ({ force = false } = {}) => {
    if (get().status === 'loading') return;
    if (get().status === 'ready' && !force) return;
    set({ status: get().items.length ? 'ready' : 'loading', error: '' });
    try {
      // 'popular' is most-generated first, which is what the design's unfiltered
      // grid is headed — "জনপ্রিয়". The API's default sort is the admin's
      // curated `sortOrder`, a different list under the same heading.
      const [templates, categories] = await Promise.all([
        aiTemplateService.list({ sort: 'popular' }),
        // Admins get drafts back too; a user must only ever see published ones.
        aiTemplateService.categories().catch(() => ({ data: [] })),
      ]);
      set({
        items: templates?.data || [],
        categories: (categories?.data || []).filter((c) => c.status === 'published'),
        status: 'ready',
      });
    } catch (error) {
      set({ status: 'error', error: error.message || '' });
    }
  },

  byId: (id) => get().items.find((x) => String(x.id) === String(id)) || null,

  reset: () => set({ items: [], categories: [], status: 'idle', error: '' }),
}));

/**
 * The hub's filter, matching `GET /api/ai-templates` field for field.
 *
 * @param {Array} items    the catalogue
 * @param {{ category?: string|null, query?: string }} filter category is a slug
 */
export function select(items, { category = null, query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (category && item.categoryRef?.slug !== category) return false;
    if (!q) return true;
    return (
      item.name?.toLowerCase().includes(q) ||
      item.nameBn?.toLowerCase().includes(q) ||
      (item.tags || []).some((tag) => String(tag).toLowerCase().includes(q))
    );
  });
}

/**
 * How many photo slots a template asks for, and whether each is required.
 *
 * `imageLabels` has been written two ways over the life of the feature — a plain
 * `string[]`, and `[{ label, required }]` — so both are normalised here rather
 * than at three call sites.
 */
export function photoInputsOf(template) {
  const requiresPhoto = template ? String(template.requireUserImage) !== 'false' : true;
  if (!requiresPhoto) return { requiresPhoto: false, slots: [], requiredCount: 0, maxImages: 0 };

  const raw = Array.isArray(template?.imageLabels) ? template.imageLabels : [];
  const labelled = raw.map((entry) =>
    entry && typeof entry === 'object'
      ? { label: entry.label ?? '', required: entry.required !== false }
      : { label: entry ?? '', required: true }
  );

  const isMulti = !!template?.allowMultipleImages;
  if (!isMulti) {
    return {
      requiresPhoto: true,
      slots: [{ label: labelled[0]?.label || '', required: true }],
      requiredCount: 1,
      maxImages: 1,
    };
  }

  // The web app offers six slots on a multi-image template even when the admin
  // defined fewer; the backend's multipart config refuses more than ten files in
  // one request, so that is the ceiling.
  const defined = Math.max(1, labelled.length);
  const maxImages = Math.min(10, Math.max(6, defined));
  const slots = Array.from({ length: defined }, (_, i) => ({
    label: labelled[i]?.label || '',
    required: labelled[i] ? labelled[i].required : i === 0,
  }));

  // The minimum is positional: the index of the last REQUIRED input, plus one.
  // Optional trailing inputs do not hold the generate button hostage.
  const requiredCount = Math.max(
    1,
    slots.reduce((max, slot, i) => (slot.required ? i + 1 : max), 0)
  );

  return { requiresPhoto: true, slots, requiredCount, maxImages };
}
