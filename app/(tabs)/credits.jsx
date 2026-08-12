import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppHeader from '../../src/components/AppHeader';
import ConfirmBuySheet from '../../src/components/ConfirmBuySheet';
import PaymentWebView from '../../src/components/PaymentWebView';
import { toast } from '../../src/components/Toast';
import { Button, Screen } from '../../src/components/ui';
import {
  COLOR,
  DURATION,
  GRADIENT,
  GREY,
  LAYOUT,
  RADIUS,
  SHADOW,
  body,
  heading,
} from '../../src/constants/theme';
import { useLangStore, useT } from '../../src/i18n';
import { ledgerLabel, relativeTime } from '../../src/lib/format';
import { settlePayment } from '../../src/lib/payment';
import creditService from '../../src/services/creditService';
import paymentService from '../../src/services/paymentService';
import planService from '../../src/services/planService';
import { useAuthStore } from '../../src/store/authStore';
import { costFor, useCreditStore } from '../../src/store/creditStore';

/**
 * Balance, packages, buying, and the transaction log.
 *
 * All of it is real: balance and ledger from `GET /api/credits/history`, the
 * price per generate from `GET /api/credits/costs`, and the packages from
 * `GET /api/plans` — the same `Plan` rows the website sells, so a price change
 * upstream lands here with no release.
 *
 * "Credits never expire" is on the balance card because it is true: nothing in
 * `CreditService` or the schema puts an expiry on a balance. The `expiresAt`
 * columns in the schema belong to device blocks, not credits.
 *
 * **কিনুন charges real money.** `POST /api/payments/{ssl/,}checkout` opens a
 * gateway session and returns its page URL; the app hosts that page, watches
 * for the return redirect and then settles the order against the API. Which
 * gateway is live and whether selling is on at all come from
 * `GET /api/credits/config` — never from a constant here.
 *
 * Two cases still point at the website, because no native flow exists for them:
 * FastSpring (non-Bangladesh accounts and `packageType: 'others'` packages)
 * settles by webhook from a JS popup with no redirect URL, and an OPERATOR is
 * refused by all three checkout endpoints.
 */
export default function Credits() {
  const { t, num } = useT();
  const lang = useLangStore((s) => s.lang);

  const user = useAuthStore((s) => s.user);
  const balance = useCreditStore((s) => s.balance);
  const costs = useCreditStore((s) => s.costs);
  const refreshCredits = useCreditStore((s) => s.refresh);

  const [ledger, setLedger] = useState([]);
  const [packs, setPacks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // ── Buying ────────────────────────────────────────────────────────────────
  const [config, setConfig] = useState(null);
  // `selected` is the row the radio is on; `picked` is the one the confirm
  // sheet is open for. Two states, because choosing a package and committing to
  // pay for it are two different decisions.
  const [selected, setSelected] = useState(null);
  const [picked, setPicked] = useState(null);
  const [starting, setStarting] = useState(false);
  const [checkout, setCheckout] = useState(null); // { url, orderId, gateway }
  const [settling, setSettling] = useState(false);

  // An account with no country set is treated as Bangladeshi, which is what the
  // website does and what the `bangladesh` package default assumes.
  const region = !user?.country || user.country.toUpperCase() === 'BD' ? 'bangladesh' : 'others';

  const load = async () => {
    await Promise.all([
      refreshCredits(),
      creditService
        .history({ limit: 20 })
        .then((res) => setLedger(res?.data?.transactions || []))
        .catch(() => {}),
      planService
        .list()
        .then((res) => {
          const rows = Array.isArray(res?.data) ? res.data : res?.data?.plans || [];
          // Filtered by region, as the website does: an `others` package is
          // priced in USD, and listing it here would print a dollar figure
          // behind a ৳ sign. A non-Bangladesh account therefore sees no
          // packages and the "buy on the website" note — which is the true
          // state, since FastSpring is the only way to sell them.
          setPacks(
            rows.filter(
              (p) => p.status !== 'inactive' && (p.packageType || 'bangladesh') === region
            )
          );
        })
        .catch(() => {}),
      paymentService
        .config()
        .then((res) => setConfig(res?.data || null))
        .catch(() => {}),
    ]);
  };

  useEffect(() => {
    load();
    // `load` closes over stable store actions only; re-running it on every
    // render would poll the endpoint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /**
   * Whether this package can be bought here, or only pointed at.
   *
   * `globalShowBuyCreditTab` is read the way the website reads it — off only
   * when the server says so *explicitly*. Treating an unloaded or failed config
   * as "off" would turn a flaky network into a shop that quietly stops selling.
   */
  const canBuy = (pack) =>
    config?.globalShowBuyCreditTab !== false &&
    user?.role !== 'OPERATOR' &&
    region === 'bangladesh' &&
    (pack.packageType || 'bangladesh') === 'bangladesh';

  const onBuy = (pack) => {
    if (user?.role === 'OPERATOR') {
      toast.info(t.buyNotAllowed);
      return;
    }
    if (!canBuy(pack)) {
      toast.info(t.buyInApp);
      return;
    }
    setPicked(pack);
  };

  /**
   * Open a gateway session for the picked package.
   *
   * `starting` gates the button for the whole round trip: there is no
   * idempotency key on either checkout endpoint, so a second tap mints a second
   * PENDING order that sits on the account for a day.
   */
  const startCheckout = async () => {
    if (!picked || starting) return;
    const gateway = config?.activePaymentGateway === 'moneybag' ? 'moneybag' : 'ssl';
    setStarting(true);
    try {
      const res =
        gateway === 'moneybag'
          ? await paymentService.checkoutMoneybag(picked.id)
          : await paymentService.checkoutSsl(picked.id);

      const url = res?.data?.redirectUrl;
      const orderId = res?.data?.orderId;
      if (!url || !orderId) throw new Error(t.payStartFailed);

      // The package's credits ride along: the sheet closes here, and the
      // success message needs a number even if `/status` comes back thin.
      //
      // The two modals are handed over in sequence, not in one update: iOS
      // presents one at a time, and mounting the gateway on the frame the
      // confirm sheet starts dismissing drops the presentation — leaving a
      // real, paid-for order with no page to pay it on.
      setPicked(null);
      setTimeout(() => setCheckout({ url, orderId, gateway, credits: picked.credits }), DURATION.sheet);
    } catch (error) {
      toast.error(error.message || t.payStartFailed);
    } finally {
      setStarting(false);
    }
  };

  /**
   * The browser is finished; ask the server what the order actually did.
   *
   * The server has the last word, always — a fail redirect and a late gateway
   * confirmation race each other, and closing this on a payment that went
   * through would be the worse mistake. But when the server has *no* better
   * answer than the redirect (a cancel usually leaves nothing to verify, so
   * `/status` stays PENDING for a day), the redirect's own verdict is the
   * truthful thing to report — telling someone who just cancelled that their
   * credits are on the way is the failure this guards against.
   */
  const onCheckoutDone = async (outcome, { transactionId, reason } = {}) => {
    const order = checkout;
    setCheckout(null);
    if (!order) return;

    setSettling(true);
    const payment = await settlePayment({
      orderId: order.orderId,
      gateway: order.gateway,
      transactionId,
    });
    setSettling(false);

    // The gateway said it did not go through and the server has not disagreed.
    const unresolved = payment.status === 'PENDING' || payment.status === 'UNKNOWN';
    if (outcome === 'failed' && unresolved) {
      toast.info(reason === 'cancelled' ? t.payCancelled : t.payFailed);
    } else if (payment.status === 'SUCCESS') {
      toast.success(t.paySuccess(num(payment.credits ?? order.credits ?? 0)));
    } else if (payment.status === 'FAILED') {
      toast.error(t.payFailed);
    } else if (payment.status === 'CANCELLED') {
      toast.info(outcome === 'closed' ? t.payPending : t.payCancelled);
    } else {
      // PENDING, and UNKNOWN when the network gave out mid-settlement. Neither
      // is a failure and neither is a receipt; the one thing that must not
      // happen is a completed payment ending in silence.
      toast.info(t.payPending);
    }

    // The ledger gains a row on a successful purchase, and the packages list is
    // cheap enough to re-read alongside it.
    load();
  };

  const perGenerate = costFor(costs, 'AI_TEMPLATE');
  const remaining = balance != null && perGenerate ? Math.floor(balance / perGenerate) : null;

  /**
   * Each package with the three numbers the row prints.
   *
   * `finalPrice` is what the checkout will actually charge — `amount` is only
   * the pre-discount base, so quoting it would name a price the gateway then
   * contradicts. Both are derived server-side by `computePlanPrice`; the
   * fallbacks are for a plan row that predates them.
   */
  const priced = useMemo(
    () =>
      packs.map((pack) => {
        const basePrice = pack.basePrice ?? pack.amount ?? pack.credits ?? 0;
        const price = pack.finalPrice ?? basePrice;
        return {
          pack,
          basePrice,
          price,
          // Held in paisa, and rounded the same way the row prints it: a badge
          // that disagrees with the number under it reads as a bug.
          rate: pack.credits > 0 ? Math.round((price / pack.credits) * 100) : null,
          off: basePrice > price && basePrice > 0
            ? Math.round(((basePrice - price) / basePrice) * 100)
            : 0,
        };
      }),
    [packs]
  );

  /**
   * The package with the lowest price per credit — or nothing at all.
   *
   * A "best value" badge on a list where every package charges the same per
   * credit is decoration dressed as advice, so it only appears when the rates
   * genuinely differ. A tie goes to the bigger package.
   */
  const bestValueId = useMemo(() => {
    const rates = priced.filter((p) => p.rate != null).map((p) => p.rate);
    if (rates.length < 2) return null;
    const best = Math.min(...rates);
    if (best === Math.max(...rates)) return null;
    return priced
      .filter((p) => p.rate === best)
      .sort((a, b) => b.pack.credits - a.pack.credits)[0].pack.id;
  }, [priced]);

  /**
   * Whether "bigger packages cost less per credit" is a true sentence today.
   *
   * It usually is, but it is a claim about the prices the admin actually set,
   * not a slogan: the hint shows only when the rate never rises as the packages
   * grow and the largest genuinely beats the smallest.
   */
  const cheaperAtScale = useMemo(() => {
    const rated = priced.filter((p) => p.rate != null).sort((a, b) => a.pack.credits - b.pack.credits);
    if (rated.length < 2) return false;
    const falls = rated.every((p, i) => i === 0 || p.rate <= rated[i - 1].rate);
    return falls && rated[rated.length - 1].rate < rated[0].rate;
  }, [priced]);

  // Something is always selected, so the buy button is never a dead end: the
  // package the admin flagged popular, else the first row.
  useEffect(() => {
    setSelected((cur) => {
      if (!packs.length) return null;
      if (cur && packs.some((p) => p.id === cur)) return cur;
      return (packs.find((p) => p.isPopular) || packs[0]).id;
    });
  }, [packs]);

  const chosen = priced.find((p) => p.pack.id === selected) || null;

  const SectionTitle = ({ children, style }) => (
    <Text style={[heading(15, '700'), { color: COLOR.ink800 }, style]}>{children}</Text>
  );

  /** The two translucent pills on the gradient card. */
  const CardPill = ({ children }) => (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,.2)',
        borderRadius: RADIUS.pill,
        paddingVertical: 5,
        paddingHorizontal: 12,
      }}
    >
      <Text style={[body(12, '600'), { color: COLOR.white }]}>{children}</Text>
    </View>
  );

  /** A package's badge — violet for popular, green for the rate, orange for a cut price. */
  const TAG_TONE = {
    violet: { fg: COLOR.violet500, bg: COLOR.violet050, line: 'rgba(152,16,250,.28)' },
    green: { fg: COLOR.greenInk, bg: '#E9F9F2', line: 'rgba(12,166,120,.26)' },
    orange: { fg: COLOR.orangeBurnt, bg: COLOR.orange050, line: 'rgba(245,73,0,.24)' },
  };

  const PackTag = ({ tone, children }) => (
    <View
      style={{
        backgroundColor: TAG_TONE[tone].bg,
        borderWidth: 1,
        borderColor: TAG_TONE[tone].line,
        borderRadius: RADIUS.pill,
        paddingVertical: 2.5,
        paddingHorizontal: 9,
      }}
    >
      <Text style={[body(10.5, '700'), { color: TAG_TONE[tone].fg }]}>{children}</Text>
    </View>
  );

  return (
    // The design puts these screens on the darker content well, not the page grey.
    <Screen style={{ backgroundColor: COLOR.muted }}>
      <AppHeader title={t.hCredits} showCredits={false} />

      <ScrollView
        contentContainerStyle={{
          padding: LAYOUT.screenPadding,
          paddingBottom: LAYOUT.scrollBottom,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR.orange500} />
        }
      >
        <LinearGradient
          colors={GRADIENT.getStarted.colors}
          start={GRADIENT.getStarted.start}
          end={GRADIENT.getStarted.end}
          style={{ borderRadius: RADIUS['3xl'], padding: 20, marginBottom: 16 }}
        >
          <Text style={[body(13), { color: COLOR.white, opacity: 0.9 }]}>{t.balance}</Text>
          <Text style={[heading(42, '800'), { color: COLOR.white, lineHeight: 46 }]}>
            {balance == null ? '—' : num(balance)}
          </Text>
          {perGenerate ? (
            <Text style={[body(13), { color: COLOR.white, opacity: 0.9, marginBottom: 14 }]}>
              {t.perImage(num(perGenerate))}
            </Text>
          ) : (
            <View style={{ marginBottom: 14 }} />
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {remaining != null ? <CardPill>{t.generatesLeft(num(remaining))}</CardPill> : null}
            <CardPill>{t.noExpiry}</CardPill>
          </View>
        </LinearGradient>

        {priced.length ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <SectionTitle>{t.packs}</SectionTitle>
              {/* Only shown when the rates really do fall — see `cheaperAtScale`. */}
              {cheaperAtScale ? (
                <Text
                  style={[body(11), { color: GREY.label, flexShrink: 1, textAlign: 'right' }]}
                  numberOfLines={1}
                >
                  {t.packsHint}
                </Text>
              ) : null}
            </View>

            <View style={{ gap: 10 }}>
              {priced.map(({ pack, basePrice, price, rate, off }) => {
                const on = selected === pack.id;
                const images = perGenerate ? Math.floor(pack.credits / perGenerate) : null;
                const tags = [
                  pack.isPopular ? ['violet', t.popular] : null,
                  pack.id === bestValueId ? ['green', t.bestValue] : null,
                  off > 0 ? ['orange', t.percentOff(num(off))] : null,
                ].filter(Boolean);

                return (
                  <Pressable
                    key={pack.id}
                    onPress={() => setSelected(pack.id)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
                  >
                    <View
                      style={{
                        backgroundColor: COLOR.white,
                        borderRadius: RADIUS.xl,
                        padding: 14,
                        // Both states carry the same border width, so picking a
                        // package cannot shift the rows under it.
                        borderWidth: 1.5,
                        borderColor: on ? COLOR.orange500 : COLOR.line200,
                        ...(on ? SHADOW.raised : SHADOW.card),
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            borderWidth: 2,
                            borderColor: on ? COLOR.orange500 : GREY.dashed,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {on ? (
                            <View
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: COLOR.orange500,
                              }}
                            />
                          ) : null}
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
                            <Text style={[heading(19, '800'), { color: COLOR.ink800 }]}>
                              {num(pack.credits)}
                            </Text>
                            <Text
                              style={[body(12, '600'), { color: COLOR.ink500, marginBottom: 2 }]}
                            >
                              {t.creditWord}
                            </Text>
                          </View>
                          <Text
                            style={[body(12), { color: COLOR.ink500, marginTop: 1 }]}
                            numberOfLines={1}
                          >
                            {pack.name}
                            {images != null ? ` · ${t.imageCount(num(images))}` : ''}
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                            {off > 0 ? (
                              <Text
                                style={[
                                  body(11.5),
                                  {
                                    color: COLOR.ink500,
                                    textDecorationLine: 'line-through',
                                    marginBottom: 2,
                                  },
                                ]}
                              >
                                ৳{num(basePrice)}
                              </Text>
                            ) : null}
                            <Text style={[heading(18, '800'), { color: COLOR.ink800 }]}>
                              ৳{num(price)}
                            </Text>
                          </View>
                          {rate != null ? (
                            <Text style={[body(10.5), { color: GREY.label, marginTop: 2 }]}>
                              {t.perCredit(num((rate / 100).toFixed(2)))}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {tags.length ? (
                        // Indented past the radio so the badges line up with the
                        // package name rather than floating off to the left.
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginTop: 10,
                            marginLeft: 34,
                          }}
                        >
                          {tags.map(([tone, label]) => (
                            <PackTag key={tone} tone={tone}>
                              {label}
                            </PackTag>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Button
              label={chosen ? t.buyFor(num(chosen.price)) : t.buy}
              fullWidth
              disabled={!chosen || starting || settling}
              onPress={() => chosen && onBuy(chosen.pack)}
              style={{ marginTop: 14 }}
            />

            {/* Said before the tap, not after it: `onBuy` still toasts the same
                thing, but a button that only explains itself once pressed is a
                trap. */}
            {chosen && !canBuy(chosen.pack) ? (
              <Text
                style={[
                  body(11.5),
                  { color: GREY.label, textAlign: 'center', marginTop: 10, lineHeight: 17 },
                ]}
              >
                {user?.role === 'OPERATOR' ? t.buyNotAllowed : t.buyInApp}
              </Text>
            ) : null}
          </>
        ) : null}

        <SectionTitle style={{ marginTop: 20, marginBottom: 10 }}>{t.history}</SectionTitle>
        <View
          style={{
            backgroundColor: COLOR.white,
            borderRadius: RADIUS.xl,
            overflow: 'hidden',
            ...SHADOW.card,
          }}
        >
          {ledger.length ? (
            ledger.map((tx, i) => {
              // The sign is read off the balance, not the `cost` field: a
              // deduction and a top-up both store a positive cost, and only
              // balanceBefore → balanceAfter says which way it went.
              const added = (tx.balanceAfter ?? 0) > (tx.balanceBefore ?? 0);
              return (
                <View
                  key={tx.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                    borderBottomWidth: i === ledger.length - 1 ? 0 : 1,
                    borderBottomColor: COLOR.line100,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[body(13, '600'), { color: COLOR.ink800 }]} numberOfLines={1}>
                      {ledgerLabel(tx, lang)}
                    </Text>
                    <Text style={[body(11.5), { color: COLOR.ink500, marginTop: 2 }]}>
                      {relativeTime(tx.createdAt, lang)}
                    </Text>
                  </View>
                  <Text
                    style={[heading(14, '800'), { color: added ? COLOR.greenInk : COLOR.ink800 }]}
                  >
                    {added ? '+' : '−'}
                    {num(Math.abs(tx.cost ?? 0))}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={[body(12.5), { color: COLOR.ink500, padding: 16 }]}>{t.noLedger}</Text>
          )}
        </View>
      </ScrollView>

      <ConfirmBuySheet
        open={!!picked}
        pack={picked}
        busy={starting}
        onClose={() => (starting ? null : setPicked(null))}
        onConfirm={startCheckout}
      />

      {checkout ? <PaymentWebView url={checkout.url} onDone={onCheckoutDone} /> : null}

      {/* Verifying can take the poll's full sixteen seconds. Blocking the
          screen for it is the point: the answer decides whether the money
          bought anything, and a tap through to another package meanwhile would
          start a second order against the same intent. */}
      {settling ? (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(255,255,255,.92)',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
          }}
        >
          <ActivityIndicator size="large" color={COLOR.orange500} />
          <Text style={[body(13.5, '600'), { color: COLOR.ink600 }]}>{t.payChecking}</Text>
        </View>
      ) : null}
    </Screen>
  );
}
