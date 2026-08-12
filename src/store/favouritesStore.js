import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nativeStorage } from '../lib/storage';

/**
 * Favourited templates.
 *
 * On the device, not on the server. `/api/pinned-templates` exists but pins
 * *document* template sets, a different table with a different id space —
 * pushing AI-template ids through it would write rows the web app then renders
 * as broken document tiles. There is no AI-template favourite endpoint.
 *
 * The consequence is worth stating plainly: favourites do not follow the account
 * to another phone. Only ids are stored, so a template deleted upstream simply
 * stops appearing once the list is re-resolved against the API.
 */
export const useFavouritesStore = create(
  persist(
    (set, get) => ({
      ids: [],

      isFavourite: (id) => get().ids.includes(Number(id)),

      toggle: (id) => {
        const numeric = Number(id);
        const { ids } = get();
        const next = ids.includes(numeric)
          ? ids.filter((x) => x !== numeric)
          : [numeric, ...ids];
        set({ ids: next });
        return next.includes(numeric);
      },

      clear: () => set({ ids: [] }),
    }),
    { name: 'eape-favourites', storage: nativeStorage }
  )
);
