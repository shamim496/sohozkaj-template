import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLOR, GRADIENT, GREY, LAYOUT, RADIUS, SHADOW, heading } from '../constants/theme';
import { useT } from '../i18n';
import ModuleIcon from './icons/ModuleIcon';

/**
 * The five-tab bar, ported from the design system's `BottomNav`.
 *
 * Five evenly spread tabs and no centre FAB — Credits is a destination of its
 * own here, not a screen pushed from the header. The active tab is orange
 * (`--orange-500`), inactive `--ink-500`, and it carries two marks the design is
 * specific about: a 3px red→orange indicator across the middle 60% of the tab's
 * top edge, and an `--orange-050` well behind the icon.
 *
 * The icons come from the design system's own module set, in the mapping the
 * prototype uses — `print-media` for Credits included. Its rule is to use that
 * set first and never mix in another library's defaults.
 */

const TABS = [
  { key: 'index', icon: 'ai-templates', label: 'nav1' },
  { key: 'creations', icon: 'bulk-photo-editing', label: 'nav2' },
  { key: 'favourites', icon: 'easy-tools', label: 'nav3' },
  { key: 'credits', icon: 'print-media', label: 'nav4' },
  { key: 'profile', icon: 'job', label: 'nav5' },
];

function Tab({ tab, active, onPress }) {
  const { t } = useT();
  const tint = active ? COLOR.orange500 : COLOR.ink500;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingTop: 8,
        paddingBottom: 6,
        paddingHorizontal: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* The top indicator. Rendered always, transparent when inactive, so the
          tab's height never changes as the selection moves. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: 3,
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          overflow: 'hidden',
        }}
      >
        {active ? (
          <LinearGradient
            colors={[COLOR.red500, COLOR.orange500]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        ) : null}
      </View>

      <View
        style={{
          width: 36,
          height: 28,
          borderRadius: RADIUS.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? COLOR.orange050 : 'transparent',
        }}
      >
        <ModuleIcon name={tab.icon} size={19} color={tint} />
      </View>

      {/* `alignSelf: stretch` + `textAlign: center` rather than letting the
          label shrink-to-fit. Shrink-to-fit measured these Bengali labels short
          and ellipsised them — "হোম" rendered as "…" inside a 269px tab — and
          the tracking that `heading()` applies at larger sizes only makes the
          measurement worse at 10px. Stretched, the label has the whole tab to
          lay out in and the ellipsis never triggers. */}
      <Text
        numberOfLines={1}
        style={[
          heading(10, '600'),
          { color: tint, lineHeight: 13, letterSpacing: 0, alignSelf: 'stretch', textAlign: 'center' },
        ]}
      >
        {t[tab.label]}
      </Text>
    </Pressable>
  );
}

/**
 * @param {{ state, navigation }} props expo-router hands these through from
 *        `<Tabs tabBar={…}>`; `state.index` is the focused route.
 */
export default function BottomNav({ state, navigation }) {
  const insets = useSafeAreaInsets();

  const go = (index) => {
    const route = state.routes[index];
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route.name);
  };

  // Order by the declared TABS list rather than by route order, so adding a
  // hidden route to the group cannot reshuffle the bar.
  const indexOf = (key) => state.routes.findIndex((r) => r.name === key);

  return (
    <View
      style={{
        backgroundColor: COLOR.white,
        borderTopWidth: 1,
        borderTopColor: GREY.hairline,
        paddingBottom: insets.bottom,
        ...SHADOW.nav,
      }}
    >
      <View style={{ height: LAYOUT.tabBarHeight, flexDirection: 'row', alignItems: 'stretch' }}>
        {TABS.map((tab) => {
          const i = indexOf(tab.key);
          return <Tab key={tab.key} tab={tab} active={state.index === i} onPress={() => go(i)} />;
        })}
      </View>
    </View>
  );
}
