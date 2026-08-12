// Expo inlines EXPO_PUBLIC_* vars at build time, but only when they appear as
// literal static member accesses. `process.env[name]` or destructuring silently
// yields undefined in a release bundle — so every var is spelled out here once
// and the rest of the app imports from this module.

export const API_URL = process.env.EXPO_PUBLIC_API_URL || '';
export const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL || '';

if (__DEV__ && !API_URL) {
  console.warn(
    '[env] EXPO_PUBLIC_API_URL is empty. A native binary has no same-origin ' +
      'fallback — every request will fail. Set it in .env.development.'
  );
}
