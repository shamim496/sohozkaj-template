import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { COLOR, LAYOUT, RADIUS, body, heading } from '../constants/theme';
import { useT } from '../i18n';
import { useCreditStore } from '../store/creditStore';

/**
 * The fixed 56px app header: optional back arrow, title, credit chip.
 *
 * Ported from `components/navigation/AppHeader.jsx`. The credit chip is not a
 * decoration — the design puts the balance on the header of every screen
 * precisely because every generate spends from it, so it is wired to the live
 * store rather than taking a prop.
 */
export default function AppHeader({ title, onBack, showBack = false, showCredits = true }) {
  const insets = useSafeAreaInsets();
  const { t, num } = useT();
  const balance = useCreditStore((s) => s.balance);

  const back = onBack || (showBack ? () => (router.canGoBack() ? router.back() : router.replace('/')) : null);

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: COLOR.white,
        borderBottomWidth: 1,
        borderBottomColor: COLOR.line100,
      }}
    >
      <View
        style={{
          minHeight: LAYOUT.headerHeight,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 12,
        }}
      >
        {back ? (
          <Pressable onPress={back} hitSlop={10} style={{ padding: 4 }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="m15 18-6-6 6-6"
                stroke={COLOR.ink700}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        ) : null}

        <Text numberOfLines={1} style={[heading(16, '700'), { flex: 1, color: COLOR.black }]}>
          {title}
        </Text>

        {showCredits ? (
          <Pressable
            onPress={() => router.push('/credits')}
            style={{
              borderWidth: 1,
              borderColor: 'rgba(152,16,250,.22)',
              backgroundColor: COLOR.violet050,
              borderRadius: RADIUS.pill,
              paddingVertical: 5,
              paddingHorizontal: 12,
            }}
          >
            {/* An unloaded balance shows an em dash rather than a zero — telling
                someone they have 0 credits when the request simply has not come
                back yet sends them to the packages screen for nothing. */}
            <Text style={[body(12, '700'), { color: COLOR.violet500 }]}>
              {balance == null ? '—' : num(balance)} {t.creditWord}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
