import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AppHeader from '../../src/components/AppHeader';
import BottomSheet from '../../src/components/BottomSheet';
import { toast } from '../../src/components/Toast';
import { Chevron, Screen, Switch } from '../../src/components/ui';
import { COLOR, GRADIENT, GREY, LAYOUT, RADIUS, SHADOW, body, heading } from '../../src/constants/theme';
import { useLangStore, useT } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { useCreationsStore } from '../../src/store/creationsStore';
import { useCreditStore } from '../../src/store/creditStore';
import { officeSpaceLabel, useOfficeSpaceStore } from '../../src/store/officeSpaceStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useTemplatesStore } from '../../src/store/templatesStore';

/**
 * Account, language, settings, links, sign out.
 *
 * Two departures from the design, both deliberate:
 *
 *  - **Its "নোটিফিকেশন" and "HD আউটপুট · ৪ ক্রেডিট বেশি" switches are not here.**
 *    Neither exists on the server: there is no push infrastructure in
 *    `sohozkaj-backend` at all, and `ImageGenerationService` hard-codes
 *    `upscaler: 'none'`, so nothing would change and the HD row would be
 *    charging four credits for it. The two switches that remain both do
 *    something real, on this device.
 *
 *  - **A shop row is added.** Every credit-charging endpoint refuses a
 *    non-admin caller without an `officeSpaceId` — that is the shop the
 *    generation is billed to. The store picks the first silently, so an account
 *    with one shop never sees a decision; an account with several must be able
 *    to say which, and there is nowhere else to say it.
 */
export default function Profile() {
  const { t, num } = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = user?.role === 'admin';
  const balance = useCreditStore((s) => s.balance);

  const officeSpaces = useOfficeSpaceStore((s) => s.officeSpaces);
  const selected = useOfficeSpaceStore((s) => s.selected);
  const selectOfficeSpace = useOfficeSpaceStore((s) => s.select);
  const resetOfficeSpaces = useOfficeSpaceStore((s) => s.reset);

  const settings = useSettingsStore();
  const [shopSheet, setShopSheet] = useState(false);

  const signOut = () => {
    logout();
    resetOfficeSpaces();
    useCreditStore.getState().reset();
    useCreationsStore.getState().reset();
    useTemplatesStore.getState().reset();
    router.replace('/login');
  };

  const initial = (user?.name || user?.phone || '—').trim().charAt(0);

  const SectionTitle = ({ children }) => (
    <Text style={[heading(14.5, '700'), { color: COLOR.ink800, marginBottom: 8 }]}>{children}</Text>
  );

  const card = {
    backgroundColor: COLOR.white,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOW.card,
  };

  const LangButton = ({ code, label }) => {
    const on = lang === code;
    return (
      <Pressable
        onPress={() => setLang(code)}
        style={{
          flex: 1,
          borderRadius: RADIUS.lg,
          paddingVertical: 12,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: on ? 'rgba(152,16,250,.28)' : GREY.border,
          backgroundColor: on ? COLOR.violet050 : COLOR.white,
        }}
      >
        <Text style={[heading(13.5, '700'), { color: on ? COLOR.violet500 : COLOR.ink500 }]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const Row = ({ children, last }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: COLOR.line100,
      }}
    >
      {children}
    </View>
  );

  const ToggleRow = ({ label, hint, value, onPress, last }) => (
    <Row last={last}>
      <View style={{ flex: 1 }}>
        <Text style={[body(13.5, '600'), { color: COLOR.ink800 }]}>{label}</Text>
        <Text style={[body(11.5), { color: COLOR.ink500, marginTop: 2 }]}>{hint}</Text>
      </View>
      <Switch value={value} onPress={onPress} />
    </Row>
  );

  const LinkRow = ({ label, value, onPress, last }) => (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: COLOR.line100,
      }}
    >
      <Text style={[body(13.5, '600'), { color: COLOR.ink800, flex: 1 }]}>{label}</Text>
      {value ? (
        <Text style={[body(12.5), { color: COLOR.ink500, maxWidth: '45%' }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Chevron size={16} color={COLOR.ink400} />
    </Pressable>
  );

  return (
    <Screen style={{ backgroundColor: COLOR.muted }}>
      <AppHeader title={t.hProfile} />

      <ScrollView
        contentContainerStyle={{
          padding: LAYOUT.screenPadding,
          paddingBottom: LAYOUT.scrollBottom,
        }}
      >
        <View
          style={{
            backgroundColor: COLOR.white,
            borderRadius: RADIUS['3xl'],
            padding: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            marginBottom: 16,
            ...SHADOW.card,
          }}
        >
          <LinearGradient
            colors={GRADIENT.login.colors}
            start={GRADIENT.login.start}
            end={GRADIENT.login.end}
            style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[heading(21, '800'), { color: COLOR.white }]}>{initial}</Text>
          </LinearGradient>

          <View style={{ flex: 1 }}>
            <Text style={[heading(16, '700'), { color: COLOR.ink800 }]} numberOfLines={1}>
              {user?.name || '—'}
            </Text>
            <Text style={[body(12.5), { color: COLOR.ink500, marginTop: 2 }]} numberOfLines={1}>
              {user?.phone || user?.email || ''}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/credits')}
            style={{
              borderWidth: 1,
              borderColor: 'rgba(152,16,250,.22)',
              backgroundColor: COLOR.violet050,
              borderRadius: RADIUS.pill,
              paddingVertical: 7,
              paddingHorizontal: 13,
            }}
          >
            <Text style={[body(12, '700'), { color: COLOR.violet500 }]}>
              {balance == null ? '—' : num(balance)} {t.creditWord}
            </Text>
          </Pressable>
        </View>

        {/* An admin bills nothing to a shop — the generate endpoint exempts them
            — so the row would be a decision with no consequence. */}
        {!isAdmin ? (
          <>
            <SectionTitle>{t.shop}</SectionTitle>
            <View style={[card, { marginBottom: 18 }]}>
              <LinkRow
                label={selected ? officeSpaceLabel(selected) : t.noShop}
                value={officeSpaces.length > 1 ? t.change : undefined}
                onPress={officeSpaces.length > 1 ? () => setShopSheet(true) : undefined}
                last
              />
            </View>
          </>
        ) : null}

        <SectionTitle>{t.language}</SectionTitle>
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            backgroundColor: COLOR.white,
            borderRadius: RADIUS.xl,
            padding: 8,
            marginBottom: 18,
            ...SHADOW.card,
          }}
        >
          <LangButton code="bn" label="বাংলা" />
          <LangButton code="en" label="English" />
        </View>

        <SectionTitle>{t.settings}</SectionTitle>
        <View style={[card, { marginBottom: 18 }]}>
          <ToggleRow
            label={t.tg1}
            hint={t.tg1h}
            value={settings.keepOriginal}
            onPress={() => settings.toggle('keepOriginal')}
          />
          <ToggleRow
            label={t.tg2}
            hint={t.tg2h}
            value={settings.warnBlurry}
            onPress={() => settings.toggle('warnBlurry')}
            last
          />
        </View>

        <View style={card}>
          <LinkRow label={t.pl1} onPress={() => toast.info(t.manageInApp)} />
          <LinkRow label={t.pl2} onPress={() => toast.info(t.manageInApp)} />
          <LinkRow label={t.pl3} onPress={() => toast.info(t.manageInApp)} />
          <LinkRow label={t.pl4} onPress={() => toast.info(t.manageInApp)} last />
        </View>

        <Pressable
          onPress={signOut}
          style={{
            marginTop: 16,
            borderWidth: 1,
            borderColor: GREY.border,
            backgroundColor: COLOR.white,
            borderRadius: RADIUS.pill,
            paddingVertical: 13,
            alignItems: 'center',
          }}
        >
          <Text style={[heading(14, '700'), { color: COLOR.redDanger }]}>{t.signOut}</Text>
        </Pressable>
      </ScrollView>

      <BottomSheet
        open={shopSheet}
        title={t.pickShop}
        onClose={() => setShopSheet(false)}
        height={0.5}
      >
        <View style={{ gap: 8, paddingHorizontal: 6 }}>
          {officeSpaces.map((space) => {
            const active = space.id === selected?.id;
            return (
              <Pressable
                key={space.id}
                onPress={() => {
                  selectOfficeSpace(space);
                  setShopSheet(false);
                  toast.success(t.copiedShop);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 14,
                  borderRadius: RADIUS.xl,
                  borderWidth: 1,
                  borderColor: active ? 'rgba(152,16,250,.28)' : GREY.hairline,
                  backgroundColor: active ? COLOR.violet050 : COLOR.white,
                }}
              >
                <Text
                  style={[
                    body(13.5, '600'),
                    { flex: 1, color: active ? COLOR.violet500 : COLOR.ink800 },
                  ]}
                  numberOfLines={1}
                >
                  {officeSpaceLabel(space)}
                </Text>
              </Pressable>
            );
          })}
          <Text style={[body(11.5), { color: COLOR.ink500, margin: 6, lineHeight: 17 }]}>
            {t.shopHint}
          </Text>
        </View>
      </BottomSheet>
    </Screen>
  );
}
