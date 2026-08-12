import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import officeSpaceService from '../services/officeSpaceService';
import { nativeStorage } from '../lib/storage';

/**
 * Which shop the credits come out of.
 *
 * Only the id is persisted; the object is re-resolved from the fetched list on
 * every load, so a stale id from another environment can never pin the app to
 * an office space the server does not return.
 */
export const useOfficeSpaceStore = create(
  persist(
    (set, get) => ({
      officeSpaces: [],
      selected: null,
      selectedId: null,
      isLoading: false,
      error: null,

      fetch: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await officeSpaceService.list();
          const officeSpaces = response.data || [];
          const resolved =
            officeSpaces.find((os) => os.id === get().selectedId) || officeSpaces[0] || null;

          set({
            officeSpaces,
            selected: resolved,
            selectedId: resolved?.id ?? null,
            isLoading: false,
          });
          return officeSpaces;
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      select: (officeSpace) => set({ selected: officeSpace, selectedId: officeSpace?.id ?? null }),

      reset: () => set({ officeSpaces: [], selected: null, selectedId: null, error: null }),
    }),
    {
      name: 'eape-office-space-storage',
      storage: nativeStorage,
      partialize: (state) => ({ selectedId: state.selectedId }),
    }
  )
);

/**
 * The shop name generated files are stamped with, matching the web app's
 * "<shop> - <date> - <n>" filenames.
 */
export const officeSpaceLabel = (officeSpace) =>
  officeSpace?.businessProfile?.shopName?.trim() || officeSpace?.name?.trim() || 'Sohozkaj';
