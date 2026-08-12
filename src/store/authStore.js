import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import authApi from '../services/authApi';
import { toast } from '../components/Toast';
import { currentLang } from '../i18n';
import { navigate } from '../lib/navigation';
import { setToken, setUnauthorizedHandler } from '../lib/session';
import { nativeStorage } from '../lib/storage';
import { useCreditStore } from './creditStore';
import { useOfficeSpaceStore } from './officeSpaceStore';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials) => {
        set({ isLoading: true });
        try {
          const response = await authApi.login(credentials);
          const { user, token } = response.data;
          set({ user, token, isAuthenticated: true, isLoading: false });
          return { success: true, user };
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      /**
       * Take the `{ user, token }` a *registration* answered with.
       *
       * `/auth/register` and `/auth/verify-and-login` both end with a signed-in
       * session, exactly like `/auth/login` — so they land here rather than
       * making the sign-up screen reach into `set()` itself, and the token
       * reaches the API client through the same subscription at the bottom of
       * this file.
       */
      adoptSession: ({ user, token }) => set({ user, token, isAuthenticated: true, isLoading: false }),

      logout: () => set({ user: null, token: null, isAuthenticated: false }),

      /**
       * Merge a partial profile the server just returned into the cached one.
       *
       * The profile screen edits the account, and the header, the profile card
       * and the avatar all read this object — so a save writes through here
       * rather than waiting for the next `refreshUser()` on app entry.
       *
       * A merge and not a replacement: these `/api/auth` responses are narrower
       * than `/me` (the update one omits `phoneVerified` and `emailVerified`),
       * and overwriting wholesale would drop `role` and `country` — which the
       * credits screen reads to decide whether this account may buy at all.
       */
      setUser: (user) => set((state) => ({ user: { ...state.user, ...user } })),

      /** Refreshes the profile (and therefore the credit balance on it). */
      refreshUser: async () => {
        try {
          const response = await authApi.getCurrentUser();
          set({ user: response.data });
          return response.data;
        } catch (error) {
          // A 401 already logged the user out through the API interceptor;
          // anything else (a flaky network) must not throw them out of the app.
          if (error.status === 401) get().logout();
          return null;
        }
      },

      isAdmin: () => get().user?.role === 'admin',
    }),
    {
      name: 'eape-auth-storage',
      // Rehydration is async — the root layout waits on
      // useAuthStore.persist.hasHydrated() before deciding login vs app,
      // otherwise a logged-in user flashes the login screen on cold start.
      storage: nativeStorage,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Mirror the token into the dependency-free session module the API client reads.
// A subscription rather than a setter call inside each action: login, logout and
// the async rehydrate from AsyncStorage all land here, so there is no path that
// can change the token and forget to tell the client.
setToken(useAuthStore.getState().token);
useAuthStore.subscribe((state) => setToken(state.token));

setUnauthorizedHandler(() => {
  // The backend enforces ONE active session per non-admin account: `authenticate`
  // compares the JWT's sessionToken against the user's current one and 401s when
  // they differ. So signing in on the main SohozKaj app — or any other device —
  // silently kills this app's session, and the next request bounces the user to
  // login mid-task. Without this message that looks like a crash rather than a
  // rule, so say what happened before navigating away.
  toast.error(
    currentLang() === 'bn'
      ? 'সাইন আউট হয়ে গেছে — এই অ্যাকাউন্ট অন্য ডিভাইসে ব্যবহার হয়েছে।'
      : 'Signed out — this account was used on another device.',
    { duration: 6000 }
  );
  useAuthStore.getState().logout();
  useOfficeSpaceStore.getState().reset();
  useCreditStore.getState().reset();
  navigate('/login');
});
