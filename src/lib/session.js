/**
 * The bearer token and the "session is over" callback, held outside the store.
 *
 * The API client needs both, and the auth store needs the API client to log in
 * — so importing one from the other makes a cycle (`authStore -> authApi ->
 * api -> authStore`). Metro allows it but warns, and the warning is earned:
 * whichever module the bundle happens to evaluate second sees the other's
 * exports uninitialised.
 *
 * This module depends on nothing, so both sides can import it. The store is the
 * only writer; see the subscription at the bottom of `store/authStore.js`, which
 * keeps this in step with every login, logout and rehydrate.
 */

let token = null;
let onUnauthorized = null;

export const getToken = () => token;

export const setToken = (next) => {
  token = next ?? null;
};

export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

/** Called when a protected request comes back 401 on a session we thought valid. */
export const handleUnauthorized = () => {
  onUnauthorized?.();
};
