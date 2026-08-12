import paymentService from '../services/paymentService';
import { useAuthStore } from '../store/authStore';
import { useCreditStore } from '../store/creditStore';

/**
 * Reading the gateway's return URL, and settling the order behind it.
 *
 * **Why a WebView and not the system browser.** The backend builds the
 * gateway's success/fail/cancel URLs itself, from its own origin, and the last
 * hop is a hard-coded 302 to `${FRONTEND_URL}/payment/success|failed`. There is
 * no `return_url` parameter on `/checkout` and no app scheme registered with the
 * gateway, so `Linking.openURL` would hand the user to Chrome and never tell us
 * how it ended. Watching the navigation is the only completion signal that
 * exists, which is what makes an embedded WebView the mechanism rather than a
 * preference.
 *
 * The match is on the *path*, not the whole URL, because `FRONTEND_URL` is a
 * server-side env var this app never sees.
 */

const SUCCESS_PATH = '/payment/success';
const FAILED_PATH = '/payment/failed';

/** `'success' | 'failed' | null` — which return page a URL is, if either. */
export function returnPageOf(url) {
  const path = String(url || '').split('#')[0].split('?')[0];
  if (path.endsWith(SUCCESS_PATH)) return 'success';
  if (path.endsWith(FAILED_PATH)) return 'failed';
  return null;
}

/**
 * A URL the WebView must not try to load itself.
 *
 * The aggregator page's bKash, Nagad and Rocket tiles navigate to `bkash://`,
 * `intent://` and friends. A WebView answers those with a blank frame, so they
 * have to be handed to the OS — without this the mobile-banking half of the
 * gateway is simply dead.
 *
 * Anything without a well-formed absolute scheme is *not* external: a relative
 * or empty url would otherwise be blocked and handed to the OS, which can only
 * fail. `javascript:` is likewise the page's own business, not the OS's.
 */
const OWN_SCHEMES = ['http', 'https', 'about', 'data', 'blob', 'file', 'javascript'];

export function isExternalScheme(url) {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(String(url || ''));
  if (!match) return false;
  return !OWN_SCHEMES.includes(match[1].toLowerCase());
}

/**
 * `decodeURIComponent` throws on a lone or truncated percent escape, and these
 * decodes run inside the WebView's synchronous navigation callback — where an
 * exception would leave the native `shouldOverrideUrlLoading` lock unresolved
 * and the page stuck. A malformed value is worth less than a working payment.
 */
const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * The URLs worth trying, in order, for a scheme the WebView will not load.
 *
 * A plain `bkash://…` is its own only candidate. An `intent://…#Intent;…;end`
 * is not openable at all through React Native's `Linking`, which builds an
 * ACTION_VIEW for a URI whose scheme is the literal string "intent" — no
 * activity declares that, so it always throws. Android's documented reading of
 * the fragment is reproduced here instead: the real target is the `intent://`
 * body re-headed with the fragment's `scheme=`, and `S.browser_fallback_url` is
 * the page's own answer for when the app is missing.
 */
export function intentFallbacks(url) {
  const raw = String(url || '');
  if (!/^intent:/i.test(raw)) return [raw];

  const hash = raw.indexOf('#');
  const body = raw.slice('intent://'.length, hash === -1 ? undefined : hash);
  const fragment = hash === -1 ? '' : raw.slice(hash + 1);

  const part = (name) => {
    const found = fragment.split(';').find((piece) => piece.startsWith(`${name}=`));
    return found ? found.slice(name.length + 1) : null;
  };

  const out = [];
  const scheme = part('scheme');
  if (scheme && body) out.push(`${scheme}://${body}`);

  const fallback = part('S.browser_fallback_url');
  if (fallback) out.push(safeDecode(fallback));

  // Last resort: the Play Store page for the app the intent names, which is
  // the honest answer when the wallet simply is not installed.
  const pkg = part('package');
  if (pkg) out.push(`market://details?id=${pkg}`);

  return out;
}

/** One query parameter off a URL, without pulling in a URL polyfill. */
export function queryParam(url, key) {
  const withoutHash = String(url || '').split('#')[0];
  const start = withoutHash.indexOf('?');
  if (start === -1) return null;

  for (const pair of withoutHash.slice(start + 1).split('&')) {
    const eq = pair.indexOf('=');
    const name = eq === -1 ? pair : pair.slice(0, eq);
    if (safeDecode(name) !== key) continue;
    return eq === -1 ? '' : safeDecode(pair.slice(eq + 1).replace(/\+/g, ' '));
  }
  return null;
}

// Eight tries at 2s — the same budget the website's own success page allows the
// gateway to confirm before it stops asking.
const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Settle an order and report what actually happened to it.
 *
 * Resolves `{ status, credits, amount }` where status is one of `SUCCESS`,
 * `PENDING`, `FAILED`, `CANCELLED` or `UNKNOWN`. It never throws: by the time
 * this runs the money has already moved, and an exception here would be
 * rendered as a failed purchase.
 *
 * `PENDING` is a real terminal answer, not "still loading". SSLCommerz holds a
 * risk-flagged payment for manual review and reports it as pending with the
 * credits not granted, so the copy for this case must promise a later arrival
 * rather than a wait of a few seconds.
 */
export async function settlePayment({ orderId, gateway, transactionId }) {
  if (!orderId) return { status: 'UNKNOWN' };

  const verify = () =>
    gateway === 'moneybag'
      ? paymentService.verifyMoneybag(orderId, transactionId)
      : paymentService.verifySsl(orderId);

  try {
    const verified = await verify();
    if (verified?.data?.status === 'SUCCESS') return finish(await readStatus(orderId));
  } catch (error) {
    // A 401 means the account was signed in elsewhere mid-payment. The API
    // client has already started the sign-out; asking again would only stack a
    // second failure on top of it, and the balance will be right on the next
    // sign-in because the credits were granted server-side.
    if (error.status === 401) return { status: 'UNKNOWN' };
    // Anything else — a 502 from the gateway, a dropped connection — is exactly
    // what the poll below is for.
  }

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const last = attempt === POLL_ATTEMPTS - 1;
    let payment;

    try {
      payment = await readStatus(orderId);
    } catch (error) {
      // A dead session is the one error worth stopping for — the rest is what
      // the retries exist for. Returning on the first dropped packet would
      // abandon the budget precisely in the case it was written for: the
      // connection switching back as the redirect lands.
      if (error.status === 401) return { status: 'UNKNOWN' };
      if (last) return { status: 'UNKNOWN' };
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (payment.status === 'SUCCESS') return finish(payment);
    // CANCELLED is polled through as well: the fail redirect writes it the
    // moment the browser lands, while the IPN that would flip a genuinely paid
    // order to SUCCESS can still be seconds behind.
    if (payment.status !== 'PENDING' && payment.status !== 'CANCELLED') return payment;
    if (last) return payment;

    await sleep(POLL_INTERVAL_MS);
  }

  return { status: 'UNKNOWN' };
}

const readStatus = async (orderId) => (await paymentService.status(orderId))?.data || {};

/**
 * A successful purchase changed the balance on the server, so both places the
 * app shows it have to be told: the credit store behind the header chip, and
 * the user record whose `credit` field the profile card reads.
 */
const finish = (payment) => {
  useCreditStore.getState().refresh();
  useAuthStore.getState().refreshUser();
  return payment;
};
