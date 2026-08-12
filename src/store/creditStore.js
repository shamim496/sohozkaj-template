import { create } from 'zustand';
import creditService from '../services/creditService';

/**
 * Credit balance + per-module prices.
 *
 * Not persisted: a stale balance shown after a week offline is worse than no
 * balance at all, and both endpoints are cheap enough to re-fetch on focus.
 * Every screen that spends credits calls `refresh()` after a successful
 * generate so the number in the header is the number the server now holds.
 */
export const useCreditStore = create((set, get) => ({
  balance: null,
  costs: null,
  isLoading: false,

  refresh: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      // Prices change rarely; the balance changes on every generate. Fetching
      // both together keeps the call sites down to one line.
      const [history, costs] = await Promise.all([
        creditService.balance(),
        get().costs ? Promise.resolve({ data: get().costs }) : creditService.costs(),
      ]);
      set({
        balance: history?.data?.balance ?? null,
        costs: costs?.data ?? get().costs,
        isLoading: false,
      });
    } catch {
      // A missing balance renders as "—"; it is never worth a toast.
      set({ isLoading: false });
    }
  },

  /** Optimistic local decrement so the header updates the instant a job starts. */
  spend: (amount) =>
    set((state) => ({
      balance: state.balance == null ? null : Math.max(0, state.balance - (Number(amount) || 0)),
    })),

  reset: () => set({ balance: null, costs: null, isLoading: false }),
}));

/** `costs.IMAGE`, `costs.AI_TEMPLATE`, `costs.BULK_PHOTO` — null while unloaded. */
export const costFor = (costs, module) => {
  const value = costs?.[module];
  return Number.isFinite(value) ? value : null;
};
