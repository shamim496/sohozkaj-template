import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import AppHeader from '../src/components/AppHeader';
import { toast } from '../src/components/Toast';
import { EmptyState, ErrorState, Loading, Screen } from '../src/components/ui';
import { COLOR, GREY, LAYOUT, RADIUS, SHADOW, body, heading } from '../src/constants/theme';
import { useLangStore, useT } from '../src/i18n';
import { relativeTime } from '../src/lib/format';
import { settlePayment } from '../src/lib/payment';
import paymentService from '../src/services/paymentService';

/**
 * What this account has paid for, from `GET /api/payments/history`.
 *
 * Not `/api/invoices` — that is a different module entirely, the POS billing
 * the user issues to *their own* customers, on a different table with a
 * different id space. Wiring it here would show a shopkeeper their shop's sales
 * under a heading about their SohozKaj purchases.
 *
 * **Rows are labelled by credits and amount, not by package name.** The row
 * stores `planName`, but the history endpoint's `select` leaves it out, so the
 * name genuinely is not in the response.
 *
 * **There is no receipt to download.** No endpoint anywhere in the backend
 * renders one for a purchase, so the footnote points at the website rather than
 * offering a button that cannot work.
 */
export default function Payments() {
  const { t, num } = useT();
  const lang = useLangStore((s) => s.lang);

  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(null);

  const load = async () => {
    try {
      const res = await paymentService.history({ limit: 30 });
      setRows(res?.data?.transactions || []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /**
   * Ask the gateway again about an order that never resolved.
   *
   * A payment can sit PENDING because the gateway's confirmation was slow or
   * never arrived, and this is the same verify-then-poll the purchase itself
   * runs — so the row can still turn into credits days later.
   *
   * Only the two gateways with a verify endpoint are offered it. A FastSpring
   * order settles by webhook and a MANUAL one was recorded by an admin;
   * neither has anything to query, and the SSLCommerz verify would answer a
   * flat 404 because it filters by its own gateway column.
   *
   * `transactionId` is deliberately not sent. Until settlement the row's
   * `gatewayTxnId` holds the checkout *session* id, and passing that to
   * Moneybag's verify is read by the server as "a real transaction id is in
   * hand" — which suppresses the one branch that can retire a dead order. The
   * server already falls back to the stored value on its own.
   */
  const gatewayOf = (tx) =>
    tx.gateway === 'MONEYBAG' ? 'moneybag' : tx.gateway === 'SSLCOMMERZ' ? 'ssl' : null;

  const recheck = async (tx) => {
    const gateway = gatewayOf(tx);
    if (checking || !gateway) return;
    setChecking(tx.orderId);
    const payment = await settlePayment({ orderId: tx.orderId, gateway });
    setChecking(null);

    if (payment.status === 'SUCCESS') toast.success(t.paySuccess(num(payment.credits ?? tx.credits)));
    else if (payment.status === 'PENDING') toast.info(t.payPending);
    else if (payment.status === 'FAILED') toast.error(t.payFailed);
    else if (payment.status === 'CANCELLED') toast.info(t.payCancelled);

    load();
  };

  const STATUS_TONE = {
    SUCCESS: { fg: COLOR.greenInk, bg: COLOR.green050 },
    PENDING: { fg: COLOR.amberInk, bg: COLOR.orange050 },
    FAILED: { fg: COLOR.redInk, bg: COLOR.red050 },
    CANCELLED: { fg: COLOR.ink500, bg: COLOR.subtle },
  };

  const Badge = ({ value }) => {
    const tone = STATUS_TONE[value] || STATUS_TONE.CANCELLED;
    return (
      <View
        style={{
          backgroundColor: tone.bg,
          borderRadius: RADIUS.pill,
          paddingVertical: 3,
          paddingHorizontal: 10,
        }}
      >
        <Text style={[body(10.5, '700'), { color: tone.fg }]}>{t[`st${value}`] || value}</Text>
      </View>
    );
  };

  return (
    <Screen style={{ backgroundColor: COLOR.muted }}>
      <AppHeader title={t.pl2} showBack showCredits={false} />

      {status === 'loading' ? (
        <Loading />
      ) : status === 'error' ? (
        // A failed request and an account that has never paid look identical
        // in an empty list, and only one of them is worth a retry.
        <ErrorState message={t.loadFailed} retryLabel={t.retry} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: LAYOUT.screenPadding,
            paddingBottom: LAYOUT.scrollBottom,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR.orange500} />
          }
        >
          {rows.length ? (
            <>
              <View
                style={{
                  backgroundColor: COLOR.white,
                  borderRadius: RADIUS.xl,
                  overflow: 'hidden',
                  ...SHADOW.card,
                }}
              >
                {rows.map((tx, i) => (
                  <View
                    key={tx.id}
                    style={{
                      padding: 14,
                      gap: 8,
                      borderBottomWidth: i === rows.length - 1 ? 0 : 1,
                      borderBottomColor: COLOR.line100,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[body(13.5, '600'), { color: COLOR.ink800 }]} numberOfLines={1}>
                          {num(tx.credits ?? 0)} {t.creditWord}
                        </Text>
                        <Text style={[body(11.5), { color: COLOR.ink500, marginTop: 2 }]}>
                          {relativeTime(tx.createdAt, lang)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 5 }}>
                        <Text style={[heading(15, '800'), { color: COLOR.ink800 }]}>
                          ৳{num(tx.amount ?? 0)}
                        </Text>
                        <Badge value={tx.status} />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text
                        style={[body(10.5), { color: GREY.label, flex: 1 }]}
                        numberOfLines={1}
                      >
                        {t.orderId}: {tx.orderId}
                      </Text>
                      {tx.status === 'PENDING' && gatewayOf(tx) ? (
                        <Pressable
                          onPress={() => recheck(tx)}
                          disabled={!!checking}
                          hitSlop={8}
                          style={({ pressed }) => ({
                            opacity: checking ? 0.5 : pressed ? 0.7 : 1,
                          })}
                        >
                          <Text style={[body(11.5, '700'), { color: COLOR.violet500 }]}>
                            {checking === tx.orderId ? t.payChecking : t.recheck}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>

              <Text
                style={[
                  body(11.5),
                  { color: GREY.label, marginTop: 12, lineHeight: 17, paddingHorizontal: 4 },
                ]}
              >
                {t.receiptNote}
              </Text>
            </>
          ) : (
            <EmptyState title={t.noPayments} message={t.receiptNote} />
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
