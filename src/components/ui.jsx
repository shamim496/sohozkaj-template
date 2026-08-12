import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { COLOR, GRADIENT, GREY, RADIUS, SHADOW, TEXT, body, heading } from '../constants/theme';

/**
 * The design system's core primitives, as React Native.
 *
 * Ported from `components/core/*` and `components/forms/*` in
 * `_ds/easy-ai-photo-edit-design-system-…`. Where the web version relies on a
 * CSS-only affordance the port drops it rather than approximating it:
 *
 *  - **Hover states are gone.** The design's rule is "buttons glow and brighten
 *    1.1×, they never move" — there is no hover on a phone. Press feedback uses
 *    the design's *press* rule instead: 0.97 scale on tiles, opacity on buttons.
 *  - **Gradients are components, not backgrounds.** RN cannot put a gradient in
 *    `backgroundColor`, so a gradient button is a `LinearGradient` wrapping the
 *    label, and gradient-filled heading words are `GradientText` (a masked
 *    overlay).
 */

// ── Button ──────────────────────────────────────────────────────────────────

const SIZES = {
  sm: { paddingVertical: 10, paddingHorizontal: 20, fontSize: 14 },
  md: { paddingVertical: 14, paddingHorizontal: 28, fontSize: 15 },
  lg: { paddingVertical: 18, paddingHorizontal: 44, fontSize: 17 },
};

/**
 * `variant` follows the design system's names.
 *
 * `account` is the violet→orange gradient the design reserves for AI and
 * account actions — sign-in, and the generate button. `primary` is the
 * red→orange brand gradient. `ghost` is the white outlined secondary.
 */
export function Button({
  label,
  onPress,
  variant = 'account',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}) {
  const off = disabled || loading;
  const dims = SIZES[size];
  const gradient =
    variant === 'account' ? GRADIENT.login : variant === 'primary' ? GRADIENT.brand : null;

  const labelColor = gradient ? COLOR.white : COLOR.ink700;

  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      {loading ? <ActivityIndicator size="small" color={labelColor} /> : null}
      <Text
        style={[
          body(dims.fontSize, '700'),
          { color: labelColor, textAlign: 'center' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  const shell = {
    borderRadius: RADIUS.pill,
    paddingVertical: dims.paddingVertical,
    paddingHorizontal: dims.paddingHorizontal,
    alignItems: 'center',
    justifyContent: 'center',
    width: fullWidth ? '100%' : undefined,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
  };

  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [
        { opacity: off ? 0.5 : pressed ? 0.9 : 1, width: fullWidth ? '100%' : undefined },
        style,
      ]}
    >
      {gradient ? (
        <LinearGradient
          colors={gradient.colors}
          start={gradient.start}
          end={gradient.end}
          style={shell}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            shell,
            variant === 'ghost'
              ? { backgroundColor: COLOR.white, borderWidth: 1, borderColor: GREY.border }
              : { backgroundColor: COLOR.white },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

// ── Pill ────────────────────────────────────────────────────────────────────

/** Category chips. Active takes the account gradient, per the design system. */
export function Pill({ label, active, onPress }) {
  const inner = (
    <Text
      style={[
        heading(14, '600'),
        { color: active ? TEXT.inverse : COLOR.ink600, lineHeight: 20 },
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );

  const shell = {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      {active ? (
        <LinearGradient
          colors={GRADIENT.login.colors}
          start={GRADIENT.login.start}
          end={GRADIENT.login.end}
          style={shell}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View style={[shell, { backgroundColor: '#F3F4F6' }]}>{inner}</View>
      )}
    </Pressable>
  );
}

// ── Search ──────────────────────────────────────────────────────────────────

/**
 * The design's SearchInput without its "Ctrl K" keycap — that affordance is for
 * the desktop site, and the prototype passes `showShortcut={false}` on mobile.
 */
export function SearchInput({ value, onChangeText, placeholder }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: COLOR.white,
        borderWidth: 1,
        borderColor: GREY.border,
        borderRadius: RADIUS.pill,
        paddingLeft: 20,
        paddingRight: 16,
        ...SHADOW.card,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={GREY.label}
        returnKeyType="search"
        style={[body(15), { flex: 1, paddingVertical: 13, color: COLOR.black }]}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M18 6 6 18M6 6l12 12"
              stroke={GREY.label}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      ) : (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Circle cx={11} cy={11} r={7} stroke={COLOR.violetSoft} strokeWidth={2.5} />
          <Path
            d="m20 20-3.2-3.2"
            stroke={COLOR.violetSoft}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </Svg>
      )}
    </View>
  );
}

// ── Text ────────────────────────────────────────────────────────────────────

/**
 * A heading word filled with the brand gradient — the design's rule is exactly
 * one word per heading, never the whole thing.
 *
 * RN has no `background-clip: text`, so this is a `LinearGradient` behind a mask
 * cut from the same text: the glyphs punch through, the gradient shows in them.
 * The masked copy must carry identical type metrics to the visible one, hence
 * the shared `style` on both.
 */
export function GradientWord({ children, style, gradient = GRADIENT.brand }) {
  return (
    <MaskedView
      style={{ flexDirection: 'row' }}
      maskElement={<Text style={[style, { backgroundColor: 'transparent' }]}>{children}</Text>}
    >
      <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end}>
        {/* Transparent text sizes the gradient to the glyphs; the mask does the drawing. */}
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

/**
 * The app's mark.
 *
 * The design system is explicit that this product has no drawn logo — wherever
 * a mark would go, set the name in Anek Bangla 800 with one word gradient
 * filled, and do not draw one. "SohozKaj" is the parent platform and stays
 * plain; "Template" is what this app is, so it takes the gradient.
 *
 * One component rather than the same three elements copied into onboarding and
 * login: it is the product's name, and it should only ever be changed once.
 */
export function Wordmark({ size = 24 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={[heading(size, '800'), { color: COLOR.ink800 }]}>SohozKaj </Text>
      <GradientWord style={heading(size, '800')}>Template</GradientWord>
    </View>
  );
}

export function ScreenTitle({ children, style }) {
  return <Text style={[heading(19, '700'), { color: COLOR.ink800 }, style]}>{children}</Text>;
}

export function Caption({ children, style, numberOfLines }) {
  return (
    <Text numberOfLines={numberOfLines} style={[body(12), { color: GREY.label }, style]}>
      {children}
    </Text>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────────────

export function Screen({ children, style }) {
  return <View style={[{ flex: 1, backgroundColor: COLOR.page }, style]}>{children}</View>;
}

/**
 * White card. The design system's signature is an *inset* bevel
 * (`--shadow-card`), which RN cannot draw; its own guidance gives flat mobile
 * tiles a soft outer shadow instead, so that is what this uses.
 */
export function Card({ children, style, radius = RADIUS['3xl'], padding = 16 }) {
  return (
    <View
      style={[
        { backgroundColor: COLOR.white, borderRadius: radius, padding, ...SHADOW.raised },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Field({ label, hint, error, required, children }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={[body(12.5, '700'), { color: COLOR.ink600 }]}>
          {label}
          {required ? <Text style={{ color: COLOR.redDanger }}> *</Text> : null}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text style={[body(11.5), { color: COLOR.redDanger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[body(11.5), { color: GREY.label }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input({ multiline = false, invalid = false, style, ...props }) {
  return (
    <TextInput
      placeholderTextColor={GREY.label}
      multiline={multiline}
      style={[
        body(15),
        {
          backgroundColor: COLOR.white,
          borderWidth: 1,
          borderColor: invalid ? '#F3B0B0' : GREY.border,
          borderRadius: RADIUS.lg,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: COLOR.black,
          minHeight: multiline ? 88 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
      {...props}
    />
  );
}

// ── States ──────────────────────────────────────────────────────────────────

export function Center({ children, style }) {
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }, style]}>
      {children}
    </View>
  );
}

export function Loading({ label }) {
  return (
    <Center>
      <ActivityIndicator size="large" color={COLOR.orange500} />
      {label ? (
        <Text style={[body(13), { marginTop: 12, color: GREY.label }]}>{label}</Text>
      ) : null}
    </Center>
  );
}

export function ErrorState({ message, retryLabel, onRetry }) {
  return (
    <Center>
      <Text style={[body(13.5), { color: COLOR.ink600, textAlign: 'center', lineHeight: 21 }]}>
        {message}
      </Text>
      {onRetry ? (
        <Button label={retryLabel} variant="ghost" size="sm" onPress={onRetry} style={{ marginTop: 16 }} />
      ) : null}
    </Center>
  );
}

/** The design's empty states: title, one line of body, one optional ghost button. */
export function EmptyState({ title, message, action, onAction }) {
  return (
    <View style={{ paddingVertical: 80, paddingHorizontal: 24, alignItems: 'center' }}>
      <Text style={[heading(17, '700'), { color: COLOR.ink800, marginBottom: 8, textAlign: 'center' }]}>
        {title}
      </Text>
      {message ? (
        <Text
          style={[
            body(13),
            { color: GREY.label, textAlign: 'center', lineHeight: 21, marginBottom: 18 },
          ]}
        >
          {message}
        </Text>
      ) : null}
      {action ? <Button label={action} variant="ghost" size="sm" onPress={onAction} /> : null}
    </View>
  );
}

/** Right-pointing chevron — the design's 2.4-stroke glyph, used in every list row. */
export function Chevron({ size = 15, color = GREY.chevron }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 6 6 6-6 6"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The favourite heart: outlined when off, filled red when on. */
export function Heart({ filled, size = 16, color }) {
  const stroke = color || (filled ? COLOR.red500 : '#A2AAB6');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"
        fill={filled ? COLOR.red500 : 'none'}
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * A settings switch: 46×27 track, 21px knob — the design's dimensions.
 *
 * "On" is the account gradient rather than a flat colour, which is why the
 * track is a `LinearGradient` with the off state painted over it: RN cannot put
 * a gradient in `backgroundColor`, and swapping the element type between states
 * would drop the press target for a frame.
 */
export function Switch({ value, onPress }) {
  const knob = (
    <View
      style={{
        width: 21,
        height: 21,
        borderRadius: 10.5,
        backgroundColor: COLOR.white,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
      }}
    />
  );

  const track = {
    width: 46,
    height: 27,
    borderRadius: RADIUS.pill,
    padding: 3,
    flexDirection: 'row',
    justifyContent: value ? 'flex-end' : 'flex-start',
    alignItems: 'center',
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value }}
    >
      {value ? (
        <LinearGradient
          colors={GRADIENT.login.colors}
          start={GRADIENT.login.start}
          end={GRADIENT.login.end}
          style={track}
        >
          {knob}
        </LinearGradient>
      ) : (
        <View style={[track, { backgroundColor: GREY.track }]}>{knob}</View>
      )}
    </Pressable>
  );
}
