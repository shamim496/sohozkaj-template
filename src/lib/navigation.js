import { router } from 'expo-router';

/**
 * Router access for modules that are not React components.
 *
 * The API client has to be able to bounce an expired session to the login
 * screen, and it is imported long before any component mounts. `expo-router`'s
 * imperative `router` is safe to hold onto, but calling it before the navigator
 * is mounted throws — so both helpers are defensive.
 */

let currentPath = '/';

export function setCurrentPath(path) {
  if (path) currentPath = path;
}

export function getCurrentPath() {
  return currentPath;
}

export function navigate(path) {
  try {
    router.replace(path);
  } catch {
    // Navigator not mounted yet — the root layout's auth gate will land the
    // user in the right place on its first render anyway.
  }
}
