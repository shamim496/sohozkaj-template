import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { COLOR, GRADIENT, GREY, LAYOUT, SHADOW, heading } from '../constants/theme';
import { useT } from '../i18n';
import ModuleIcon from './icons/ModuleIcon';

/**
 * The four-tab bar with the generate FAB punched through its centre.
 *
 * Two tabs, a fixed 78px gap, two tabs — the gap is what the FAB sits in, and it
 * is a spacer rather than a fifth flex child so the four labels stay evenly
 * spaced whatever the FAB is doing.
 *
 * The icons come from the design system's own module set; the prototype's
 * mapping is followed exactly (`ai-templates` for Home, `bulk-photo-editing`
 * for Creations, `easy-tools` for Favourites, `job` for Profile) rather than
 * substituting more literal glyphs — the design system's iconography rule is to
 * use its own set first and never mix in another library's defaults.
 */

/** How far the 60px FAB rises above the bar's top edge. */
const FAB_OVERHANG = 22;

const TABS = [
  { key: 'index', icon: 'ai-templates', label: 'nav1' },
  { key: 'creations', icon: 'bulk-photo-editing', label: 'nav2' },
  { key: 'favourites', icon: 'easy-tools', label: 'nav3' },
  { key: 'profile', icon: 'job', label: 'nav4' },
];

function Tab({ tab, active, onPress }) {
  const { t } = useT();
  const tint = active ? COLOR.violet500 : GREY.navIdle;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: 4,
        paddingVertical: 8,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <ModuleIcon name={tab.icon} size={22} color={tint} />
      <Text numberOfLines={1} style={[heading(10.5, '700'), { color: tint }]}>
        {t[tab.label]}
      </Text>
    </Pressable>
  );
}

/**
 * @param {{ state, navigation }} props expo-router hands these through from
 *        `<Tabs tabBar={…}>`; `state.index` is the focused route.
 */
export default function BottomNav({ state, navigation, onFabPress }) {
  const insets = useSafeAreaInsets();

  const go = (index) => {
    const route = state.routes[index];
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route.name);
  };

  // Order the visible tabs by the declared TABS list rather than by route order,
  // so adding a hidden route to the group cannot reshuffle the bar.
  const indexOf = (key) => state.routes.findIndex((r) => r.name === key);
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  return (
    // The FAB overhangs the bar by 22px. On Android a touch outside a parent's
    // bounds is never delivered to its children, so the overhang cannot be a
    // negative offset inside the bar — it lives in this taller transparent
    // container instead. `box-none` keeps the empty strip above the bar from
    // swallowing taps meant for the content behind it.
    <View pointerEvents="box-none" style={{ paddingTop: FAB_OVERHANG }}>
      <View
        style={{
          backgroundColor: COLOR.white,
          borderTopWidth: 1,
          borderTopColor: GREY.hairline,
          paddingBottom: insets.bottom,
          ...SHADOW.nav,
        }}
      >
        <View style={{ height: LAYOUT.tabBarHeight, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {left.map((tab) => {
              const i = indexOf(tab.key);
              return <Tab key={tab.key} tab={tab} active={state.index === i} onPress={() => go(i)} />;
            })}
          </View>

          <View style={{ width: 78 }} />

          <View style={{ flex: 1, flexDirection: 'row' }}>
            {right.map((tab) => {
              const i = indexOf(tab.key);
              return <Tab key={tab.key} tab={tab} active={state.index === i} onPress={() => go(i)} />;
            })}
          </View>
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}
      >
        <Pressable
          onPress={onFabPress}
          accessibilityRole="button"
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}
        >
          <LinearGradient
            colors={GRADIENT.login.colors}
            start={GRADIENT.login.start}
            end={GRADIENT.login.end}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              borderWidth: 4,
              borderColor: COLOR.white,
              alignItems: 'center',
              justifyContent: 'center',
              ...SHADOW.fab,
            }}
          >
            {/* The design's generate spark — a hand-drawn 2.2-stroke glyph, not
                an icon-font sparkle. */}
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.2 2.2m8.4 8.5 2.2 2.1M5.6 18.4l2.2-2.1m8.4-8.5 2.2-2.1"
                stroke={COLOR.white}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
