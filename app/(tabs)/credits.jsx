import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppHeader from '../../src/components/AppHeader';
import { toast } from '../../src/components/Toast';
import { Screen } from '../../src/components/ui';
import { COLOR, GRADIENT, LAYOUT, RADIUS, SHADOW, body, heading } from '../../src/constants/theme';
import { useLangStore, useT } from '../../src/i18n';
import { ledgerLabel, relativeTime } from '../../src/lib/format';
import creditService from '../../src/services/creditService';
import planService from '../../src/services/planService';
import { costFor, useCreditStore } from '../../src/store/creditStore';

/**
 * Balance, packages, and the transaction log.
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
 * **Buying is not wired.** `POST /api/payments/checkout` exists, but a purchase
 * inside the app means a gateway redirect, order-status polling and a verify
 * step against live money. The design's "কিনুন" button is drawn as designed and
 * says where to buy instead of pretending to sell — the prototype's version
 * added credits to a local variable, which is the one behaviour that must not
 * ship.
 */
export default function Credits() {
  const { t, num } = useT();
  const lang = useLangStore((s) => s.lang);

  const balance = useCreditStore((s) => s.balance);
  const costs = useCreditStore((s) => s.costs);
  const refreshCredits = useCreditStore((s) => s.refresh);

  const [ledger, setLedger] = useState([]);
  const [packs, setPacks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

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
          setPacks(rows.filter((p) => p.status !== 'inactive'));
        })
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

  const perGenerate = costFor(costs, 'AI_TEMPLATE');
  const remaining = balance != null && perGenerate ? Math.floor(balance / perGenerate) : null;

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

        {packs.length ? (
          <>
            <SectionTitle style={{ marginBottom: 10 }}>{t.packs}</SectionTitle>
            <View style={{ gap: 10 }}>
              {packs.map((pack) => {
                // `amount` is the BDT price; 0 means the plan falls back to
                // 1 credit = 1tk, which is the backend's own rule.
                const price = pack.amount || pack.credits;
                const images = perGenerate ? Math.floor(pack.credits / perGenerate) : null;
                return (
                  <View
                    key={pack.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      backgroundColor: COLOR.white,
                      borderRadius: RADIUS.xl,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: pack.isPopular ? 'rgba(152,16,250,.28)' : 'transparent',
                      ...SHADOW.card,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[heading(15, '700'), { color: COLOR.ink800 }]} numberOfLines={1}>
                          {pack.name}
                        </Text>
                        {pack.isPopular ? (
                          <View
                            style={{
                              backgroundColor: COLOR.violet050,
                              borderWidth: 1,
                              borderColor: 'rgba(152,16,250,.28)',
                              borderRadius: RADIUS.pill,
                              paddingVertical: 2,
                              paddingHorizontal: 9,
                            }}
                          >
                            <Text style={[body(10.5, '700'), { color: COLOR.violet500 }]}>
                              {t.popular}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[body(12.5), { color: COLOR.ink500, marginTop: 2 }]}>
                        {num(pack.credits)} {t.creditWord}
                        {images != null ? ` · ${t.imageCount(num(images))}` : ''}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={[heading(17, '800'), { color: COLOR.ink800 }]}>
                        ৳{num(price)}
                      </Text>
                      <Pressable
                        onPress={() => toast.info(t.buyInApp)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                      >
                        <LinearGradient
                          colors={GRADIENT.login.colors}
                          start={GRADIENT.login.start}
                          end={GRADIENT.login.end}
                          style={{
                            borderRadius: RADIUS.pill,
                            paddingVertical: 9,
                            paddingHorizontal: 16,
                          }}
                        >
                          <Text style={[body(12.5, '700'), { color: COLOR.white }]}>{t.buy}</Text>
                        </LinearGradient>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
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
    </Screen>
  );
}
