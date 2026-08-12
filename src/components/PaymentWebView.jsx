import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { Button } from './ui';
import { COLOR, GREY, body, heading } from '../constants/theme';
import { useT } from '../i18n';
import { intentFallbacks, isExternalScheme, queryParam, returnPageOf } from '../lib/payment';

/**
 * The gateway's own checkout page, hosted in the app.
 *
 * A full-screen `Modal` rather than a route: the payment is a detour out of the
 * credits screen and back, and a route would put it in the history stack where
 * Android's back button could return the user to a dead gateway session.
 *
 * `onDone(outcome, { transactionId, reason })` fires exactly once, with
 * `'success'`, `'failed'` or `'closed'`, plus whatever the return URL said.
 * That is only what the *browser* saw — none of it is the order's status, which
 * the caller settles against the API.
 *
 * **Nothing here reports through `toast`.** On Android a `Modal` is its own
 * window, and the `Toaster` mounted in the root layout renders behind it — a
 * toast raised from this screen is simply never seen. Messages are rendered
 * inside the modal instead.
 */
export default function PaymentWebView({ url, onDone }) {
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const webRef = useRef(null);
  // Android fires both handlers for the gateway's 302 chain, and a redirect can
  // land twice; whichever gets there first wins and the rest are ignored.
  const handled = useRef(false);
  const canGoBack = useRef(false);

  const [note, setNote] = useState('');
  const [loadError, setLoadError] = useState(false);

  const finish = (outcome, extra) => {
    if (handled.current) return;
    handled.current = true;
    onDone(outcome, extra || {});
  };

  const done = (url_) =>
    finish(returnPageOf(url_) === 'success' ? 'success' : 'failed', {
      transactionId: queryParam(url_, 'transaction_id'),
      reason: queryParam(url_, 'reason'),
    });

  /**
   * Hand a non-web URL to the OS.
   *
   * `bkash://` and friends open directly. `intent://` does not: React Native's
   * `Linking` builds an ACTION_VIEW for a URI whose scheme is literally
   * "intent", which no activity claims, so it always throws. Android's own
   * rule is to read the target scheme and the `browser_fallback_url` out of
   * the intent's fragment, which is what `intentFallbacks` extracts.
   */
  const openExternal = async (target) => {
    for (const candidate of intentFallbacks(target)) {
      try {
        await Linking.openURL(candidate);
        return;
      } catch {
        // Try the next candidate — a missing app is the normal case here, not
        // an error worth reporting until every option is exhausted.
      }
    }
    setNote(t.payAppMissing);
  };

  /**
   * Every navigation the WebView is about to make, returning false to stop it.
   *
   * The two return pages are stopped rather than loaded: they belong to the
   * website, they would 401 in here, and the app has its own answer to show.
   */
  const shouldStart = (request) => {
    const { url: next } = request;

    if (isExternalScheme(next)) {
      openExternal(next);
      return false;
    }

    if (!returnPageOf(next)) return true;
    done(next);
    return false;
  };

  // The server-side 302 to the return page does not always reach
  // `onShouldStartLoadWithRequest` on Android, so the same match runs again
  // here, against the navigation that actually happened.
  const onNavigationStateChange = (state) => {
    canGoBack.current = state.canGoBack;
    if (returnPageOf(state.url)) done(state.url);
  };

  /**
   * Android's back button.
   *
   * A gateway checkout is several pages deep — method, then bank, then a
   * 3-D Secure step — so back means "back a page" for as long as there is one.
   * Only at the first page does it abandon the payment.
   */
  const onRequestClose = () => {
    if (canGoBack.current && webRef.current) {
      webRef.current.goBack();
      return;
    }
    finish('closed');
  };

  const retry = () => {
    setLoadError(false);
    webRef.current?.reload();
  };

  return (
    <Modal visible={!!url} animationType="slide" onRequestClose={onRequestClose}>
      <View style={{ flex: 1, backgroundColor: COLOR.white, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: COLOR.line100,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[heading(15.5, '700'), { color: COLOR.black }]}>{t.payTitle}</Text>
            <Text style={[body(11.5), { color: GREY.label, marginTop: 1 }]}>{t.payDontClose}</Text>
          </View>
          <Pressable onPress={() => finish('closed')} hitSlop={10} style={{ padding: 6 }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M18 6 6 18M6 6l12 12"
                stroke={COLOR.ink700}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        {note ? (
          <Pressable
            onPress={() => setNote('')}
            style={{
              backgroundColor: COLOR.orange050,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: COLOR.orange100,
            }}
          >
            <Text style={[body(12), { color: COLOR.amberInk }]}>{note}</Text>
          </Pressable>
        ) : null}

        <View style={{ flex: 1 }}>
          {url ? (
            <WebView
              ref={webRef}
              source={{ uri: url }}
              originWhitelist={['*']}
              onShouldStartLoadWithRequest={shouldStart}
              onNavigationStateChange={onNavigationStateChange}
              javaScriptEnabled
              domStorageEnabled
              // The gateway keeps the session in a cookie and 3-D Secure bounces
              // through the issuing bank, so both cookie jars have to persist.
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              // A card page that opens its ACS step with target="_blank" would
              // otherwise ask for a second window that never appears, and the
              // 3-D Secure prompt would simply not show.
              setSupportMultipleWindows={false}
              startInLoadingState
              renderLoading={() => (
                // Absolutely positioned, matching the library's own default:
                // the WebView is a layout sibling that is never hidden, so a
                // `flex: 1` overlay would take half the screen and leave the
                // gateway page rendering into the other half.
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: COLOR.white,
                  }}
                >
                  <ActivityIndicator size="large" color={COLOR.orange500} />
                </View>
              )}
              // A dropped request on the 3-D Secure hop is not an outcome — the
              // gateway session is still alive, and settling here would strand
              // a payment the user could have finished. Offer the reload
              // instead, and let the ✕ be the only way to give up.
              onError={() => setLoadError(true)}
              onRenderProcessGone={() => setLoadError(true)}
              style={{ flex: 1 }}
            />
          ) : null}

          {loadError ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: COLOR.white,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                gap: 16,
              }}
            >
              <Text
                style={[
                  body(13.5),
                  { color: COLOR.ink600, textAlign: 'center', lineHeight: 21 },
                ]}
              >
                {t.payLoadFailed}
              </Text>
              <Button label={t.retry} variant="ghost" size="sm" onPress={retry} />
              <Pressable onPress={() => finish('closed')} hitSlop={8}>
                <Text style={[body(12.5, '700'), { color: COLOR.ink500 }]}>{t.payGiveUp}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
