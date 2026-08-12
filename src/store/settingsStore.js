import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nativeStorage } from '../lib/storage';

/**
 * The two switches on the profile screen, and whether onboarding has been seen.
 *
 * Both switches change what this app does locally — they are not server
 * preferences, so there is nothing to sync. The design's third switch ("HD
 * output · 4 extra credits") is not here: the generate endpoint has no HD tier,
 * and a switch that charges credits for nothing would be a lie.
 */
export const useSettingsStore = create(
  persist(
    (set) => ({
      /** Save a copy of every result to the phone gallery as soon as it lands. */
      keepOriginal: true,
      /** Warn before generating when the picked photo is low-resolution. */
      warnBlurry: true,
      /** Onboarding is three slides, shown once. */
      onboarded: false,

      toggle: (key) => set((state) => ({ [key]: !state[key] })),
      finishOnboarding: () => set({ onboarded: true }),
    }),
    { name: 'eape-settings', storage: nativeStorage }
  )
);
