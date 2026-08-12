import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import AppHeader from '../src/components/AppHeader';
import { toast } from '../src/components/Toast';
import { Screen } from '../src/components/ui';
import { COLOR, GREY, LAYOUT, RADIUS, SHADOW, body, heading } from '../src/constants/theme';
import { useLangStore, useT } from '../src/i18n';
import { relativeTime } from '../src/lib/format';
import creditService from '../src/services/creditService';
import planService from '../src/services/planService';
import { costFor, useCreditStore } from '../src/store/creditStore';

/**
 * Balance, packages, and the transaction log.
 *
 * All three are real: the balance and the ledger come from
 * `GET /api/credits/history`, the price per generate from
 * `GET /api/credits/costs`, and the packages from `GET /api/plans` — the same
 * `Plan` rows the website sells, so a price change upstream lands here with no
 * release.
 *
 * **Buying is not wired.** `POST /api/payments/checkout` exists, but a purchase
 * inside the app means a gateway redirect, order-status polling and a verify
 * step, against live money. Until that is built and tested, tapping a package
 * says where to buy rather than pretending to sell — the prototype's "credits
 * added" toast added credits to a local variable, which is the one behaviour
 * that must not ship.
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
  const remaining =
    balance != null && perGenerate ? Math.floor(balance / perGenerate) : null;

  return (
    <Screen>
      <AppHeader title={t.hCredits} showBack showCredits={false} />

      <ScrollView
        contentContainerStyle={{
          padding: LAYOUT.screenPadding,
          paddingBottom: LAYOUT.scrollBottom,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR.orange500} />
        }
      >
        <View
          style={{
            backgroundColor: COLOR.white,
            borderRadius: 20,
            padding: 20,
            ...SHADOW.raised,
          }}
        >
          <Text style={[body(12.5), { color: GREY.label }]}>{t.balance}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginVertical: 4 }}>
            <Text style={[heading(40, '800'), { color: COLOR.ink800, lineHeight: 46 }]}>
              {balance == null ? '—' : num(balance)}
            </Text>
            <Text style={[body(13), { color: GREY.label }]}>{t.creditWord}</Text>
          </View>
          {remaining != null ? (
            <Text style={[body(12.5), { color: '#5B6472' }]}>{t.generatesLeft(num(remaining))}</Text>
          ) : null}
        </View>

        {packs.length ? (
          <>
            <Text style={[heading(15, '700'), { color: COLOR.ink800, marginTop: 22, marginBottom: 10 }]}>
              {t.packs}
            </Text>
            <View style={{ gap: 8 }}>
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
                      borderRadius: RADIUS['2xl'],
                      padding: 14,
                      borderWidth: 1,
                      borderColor: pack.isPopular ? 'rgba(152,16,250,.22)' : 'transparent',
                      ...SHADOW.card,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[heading(14.5, '700'), { color: COLOR.ink800 }]} numberOfLines={1}>
                          {pack.name}
                        </Text>
                        {pack.isPopular ? (
                          <View
                            style={{
                              borderWidth: 1,
                              borderColor: 'rgba(152,16,250,.25)',
                              borderRadius: RADIUS.pill,
                              paddingVertical: 1,
                              paddingHorizontal: 8,
                            }}
                          >
                            <Text style={[body(10, '700'), { color: COLOR.violet500 }]}>
                              {t.popular}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[body(12), { color: GREY.label, marginTop: 3 }]}>
                        {num(pack.credits)} {t.creditWord}
                        {images != null ? ` · ${t.imageCount(num(images))}` : ''}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => toast.info(t.buyInApp)}
                      style={{
                        borderWidth: 1,
                        borderColor: GREY.border,
                        borderRadius: RADIUS.pill,
                        paddingVertical: 9,
                        paddingHorizontal: 15,
                      }}
                    >
                      <Text style={[heading(13, '700'), { color: COLOR.ink800 }]}>
                        ৳{num(price)}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <Text style={[body(11.5), { color: GREY.label, marginTop: 10, lineHeight: 17 }]}>
              {t.buyInApp}
            </Text>
          </>
        ) : null}

        <Text style={[heading(15, '700'), { color: COLOR.ink800, marginTop: 24, marginBottom: 10 }]}>
          {t.history}
        </Text>
        <View
          style={{
            backgroundColor: COLOR.white,
            borderRadius: RADIUS['2xl'],
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
              const label =
                tx.metadata?.templateName ||
                tx.metadata?.planName ||
                tx.module ||
                tx.source ||
                '';
              return (
                <View
                  key={tx.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderBottomWidth: i === ledger.length - 1 ? 0 : 1,
                    borderBottomColor: COLOR.line100,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[body(13, '600'), { color: COLOR.ink800 }]} numberOfLines={1}>
                      {label}
                    </Text>
                    <Text style={[body(11.5), { color: GREY.label, marginTop: 2 }]}>
                      {relativeTime(tx.createdAt, lang)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      heading(14, '800'),
                      { color: added ? COLOR.greenInk : GREY.label },
                    ]}
                  >
                    {added ? '+' : '−'}
                    {num(Math.abs(tx.cost ?? 0))}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={[body(12.5), { color: GREY.label, padding: 16 }]}>{t.noLedger}</Text>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
