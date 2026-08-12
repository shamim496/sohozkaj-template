import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import AppHeader from '../../src/components/AppHeader';
import BottomSheet from '../../src/components/BottomSheet';
import { toast } from '../../src/components/Toast';
import { Chevron, Screen, Switch } from '../../src/components/ui';
import { COLOR, GREY, LAYOUT, RADIUS, SHADOW, body, heading } from '../../src/constants/theme';
import { useLangStore, useT } from '../../src/i18n';
import { useAuthStore } from '../../src/store/authStore';
import { useCreationsStore } from '../../src/store/creationsStore';
import { useCreditStore } from '../../src/store/creditStore';
import { officeSpaceLabel, useOfficeSpaceStore } from '../../src/store/officeSpaceStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useTemplatesStore } from '../../src/store/templatesStore';

/**
 * Account, language, the two local switches, and sign-out.
 *
 * The shop row is an addition to the design. It has to be: every credit-charging
 * endpoint refuses a non-admin caller without an `officeSpaceId`, because that
 * is the shop whose balance the generation is billed to. The store picks the
 * first one silently, so an account with a single shop never sees a decision —
 * but an account with several must be able to say which, and there is nowhere
 * else in this app to say it.
 */
export default function Profile() {
  const { t } = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = user?.role === 'admin';

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

  const SectionLabel = ({ children }) => (
    <Text style={[body(11.5, '700'), { color: GREY.label, marginHorizontal: 2, marginBottom: 8 }]}>
      {children}
    </Text>
  );

  const LangRow = ({ code, label }) => {
    const on = lang === code;
    return (
      <Pressable
        onPress={() => setLang(code)}
        style={{
          flex: 1,
          borderRadius: RADIUS.md,
          paddingVertical: 12,
          alignItems: 'center',
          backgroundColor: on ? COLOR.violet050 : 'transparent',
        }}
      >
        <Text style={[heading(13.5, '700'), { color: on ? COLOR.violet500 : GREY.label }]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const ToggleRow = ({ label, hint, value, onPress }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={[body(13.5, '600'), { color: COLOR.ink800 }]}>{label}</Text>
        <Text style={[body(11.5), { color: GREY.label, marginTop: 2 }]}>{hint}</Text>
      </View>
      <Switch value={value} onPress={onPress} />
    </View>
  );

  const LinkRow = ({ label, value, onPress, last }) => (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 15,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: COLOR.line100,
      }}
    >
      <Text style={[body(13.5, '600'), { color: COLOR.ink800, flex: 1 }]}>{label}</Text>
      {value ? (
        <Text style={[body(12.5), { color: GREY.label, maxWidth: '45%' }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Chevron />
    </Pressable>
  );

  const cardStyle = {
    backgroundColor: COLOR.white,
    borderRadius: RADIUS['2xl'],
    overflow: 'hidden',
    ...SHADOW.card,
  };

  return (
    <Screen>
      <AppHeader title={t.hProfile} />

      <ScrollView
        contentContainerStyle={{
          padding: LAYOUT.screenPadding,
          paddingBottom: LAYOUT.scrollBottom,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            paddingTop: 4,
            paddingBottom: 20,
            paddingHorizontal: 2,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: COLOR.violet050,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={[heading(20, '800'), { color: COLOR.violet500 }]}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[heading(16.5, '700'), { color: COLOR.ink800 }]} numberOfLines={1}>
              {user?.name || '—'}
            </Text>
            <Text style={[body(12.5), { color: GREY.label, marginTop: 2 }]} numberOfLines={1}>
              {user?.phone || user?.email || ''}
            </Text>
          </View>
        </View>

        {/* An admin bills nothing to a shop — the generate endpoint exempts them
            — so the row would only be a decision with no consequence. */}
        {!isAdmin ? (
          <>
            <SectionLabel>{t.shop}</SectionLabel>
            <View style={[cardStyle, { marginBottom: 22 }]}>
              <LinkRow
                label={selected ? officeSpaceLabel(selected) : t.noShop}
                value={officeSpaces.length > 1 ? t.change : undefined}
                onPress={officeSpaces.length > 1 ? () => setShopSheet(true) : undefined}
                last
              />
            </View>
          </>
        ) : null}

        <SectionLabel>{t.language}</SectionLabel>
        <View
          style={{
            flexDirection: 'row',
            gap: 6,
            backgroundColor: COLOR.white,
            borderRadius: RADIUS.xl,
            padding: 6,
            ...SHADOW.card,
          }}
        >
          <LangRow code="bn" label="বাংলা" />
          <LangRow code="en" label="English" />
        </View>

        <View style={{ height: 22 }} />

        <SectionLabel>{t.settings}</SectionLabel>
        <View style={cardStyle}>
          <ToggleRow
            label={t.tg1}
            hint={t.tg1h}
            value={settings.keepOriginal}
            onPress={() => settings.toggle('keepOriginal')}
          />
          <View style={{ height: 1, backgroundColor: COLOR.line100, marginHorizontal: 14 }} />
          <ToggleRow
            label={t.tg2}
            hint={t.tg2h}
            value={settings.warnBlurry}
            onPress={() => settings.toggle('warnBlurry')}
          />
        </View>

        <View style={[cardStyle, { marginTop: 16 }]}>
          <LinkRow label={t.pl1} onPress={() => router.push('/credits')} />
          <LinkRow label={t.pl2} onPress={() => toast.info(t.buyInApp)} />
          <LinkRow label={t.pl3} onPress={() => toast.info(t.buyInApp)} last />
        </View>

        <Pressable onPress={signOut} style={{ padding: 14, marginTop: 18 }}>
          <Text style={[heading(13.5, '700'), { color: COLOR.redDanger, textAlign: 'center' }]}>
            {t.signOut}
          </Text>
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
          <Text style={[body(11.5), { color: GREY.label, margin: 6, lineHeight: 17 }]}>
            {t.shopHint}
          </Text>
        </View>
      </BottomSheet>
    </Screen>
  );
}
