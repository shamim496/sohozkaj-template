import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { LangSwitch, Wordmark } from './ui';
import { SK, body, heading } from '../constants/theme';
import { useLangStore } from '../i18n';

/**
 * The SohozKaj website's sign-in form, as React Native.
 *
 * These screens are a port, not a design of ours: `sohozkaj-app`'s LoginPage and
 * RegisterPage, control for control — the same logo over the same subtitle, the
 * same white card with a zinc hairline, `rounded-md` inputs with a grey glyph at
 * the head, and one solid-orange button. It is the same account system, so the
 * form a person filled in on sohozkaj.com is the form they get here.
 *
 * That is why none of it is built on `ui.jsx`. The app's own primitives are the
 * AI-template design system — pill buttons, 12px radii, the violet→orange
 * account gradient — and the two must not be averaged into something that is
 * neither. The split is the point: `ui.jsx` inside the app, this file at its
 * door. `LangSwitch` is the one thing shared, because the website's switcher is
 * exactly what onboarding already carries.
 *
 * Metrics come from the Tailwind classes on those two pages: `text-sm` is 14,
 * `px-3 py-2` is the input box, `gap-4` between fields, `p-5` inside the card.
 * The one deliberate change is vertical: web inputs and buttons are ~36px tall,
 * which is under a thumb's worth on a phone, so both are padded to ~44.
 */

// ── Icons ───────────────────────────────────────────────────────────────────

// The Tabler outlines the website puts at the head of each field, redrawn on
// the same 24 grid. Five fields and a shield is not worth an icon font.
const GLYPHS = {
  phone: [
    'M6.8 10.9a15 15 0 0 0 6.3 6.3l2.1-2.1a1.1 1.1 0 0 1 1.1-.27 12 12 0 0 0 3.4.55 1.1 1.1 0 0 1 1.1 1.1v3.3a1.1 1.1 0 0 1-1.1 1.1A17.2 17.2 0 0 1 2.9 3.7 1.1 1.1 0 0 1 4 2.6h3.3a1.1 1.1 0 0 1 1.1 1.1 12 12 0 0 0 .55 3.4 1.1 1.1 0 0 1-.27 1.1l-2.1 2.1z',
  ],
  mail: ['M3.2 6.4h17.6v11.2H3.2z', 'm3.6 7 8.4 5.6L20.4 7'],
  user: ['M12 11.6a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8z', 'M4.4 20.2c0-3.4 3.4-6 7.6-6s7.6 2.6 7.6 6'],
  pin: [
    'M12 21.2s6.8-5.6 6.8-10.8a6.8 6.8 0 1 0-13.6 0C5.2 15.6 12 21.2 12 21.2z',
    'M12 12.6a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
  ],
  lock: ['M5.6 10.6h12.8v9.6H5.6z', 'M8.6 10.6V7.4a3.4 3.4 0 0 1 6.8 0v3.2'],
  shield: ['M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3z'],
  chevron: ['m6 9 6 6 6-6'],
};

export function AuthIcon({ name, size = 16, color = SK.faint, strokeWidth = 1.8 }) {
  const paths = GLYPHS[name];
  if (!paths) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

// ── Screen shell ────────────────────────────────────────────────────────────

/**
 * Logo, subtitle, optional progress bar, card, footer — the frame all three
 * screens share, so none of them can drift from the others.
 *
 * The language switch is pinned over the scroll view rather than laid out in
 * it, which is where the website puts it (`position: absolute; top: 12px;
 * right: 16px`) and what keeps it reachable while the form is scrolled.
 */
export function AuthScreen({ subtitle, progress, footer, children }) {
  const insets = useSafeAreaInsets();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: SK.page }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 16,
          // Room for the switcher, which floats above this.
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
          {/* The product's mark is its name — the design system is explicit that
              Easy AI Photo Edit has no drawn logo, and SohozKaj's own mark is
              the parent platform's, not this app's. Whose account this is gets
              said in the subtitle underneath, in words. */}
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Wordmark size={24} />
          </View>

          {subtitle ? (
            <Text
              style={[
                body(13.5),
                { color: SK.muted, textAlign: 'center', marginBottom: progress == null ? 22 : 14 },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}

          {progress != null ? <ProgressBar value={progress} /> : null}

          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: SK.radiusCard,
              borderWidth: 1,
              borderColor: SK.hairline,
              padding: 20,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            {children}
          </View>

          {footer ? <View style={{ marginTop: 16 }}>{footer}</View> : null}
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
        <LangSwitch lang={lang} onSelect={setLang} />
      </View>
    </KeyboardAvoidingView>
  );
}

/** `h-2` track, orange fill, both fully rounded. */
export function ProgressBar({ value }) {
  return (
    <View
      style={{
        height: 8,
        borderRadius: 9999,
        backgroundColor: SK.hairline,
        overflow: 'hidden',
        marginBottom: 22,
      }}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          borderRadius: 9999,
          backgroundColor: SK.orange,
        }}
      />
    </View>
  );
}

// ── Fields ──────────────────────────────────────────────────────────────────

/**
 * Label, control, then the error *or* the hint — never both, since the error is
 * the answer to whatever the hint was asking for.
 */
export function AuthField({ label, required, optional, hint, error, children }) {
  return (
    <View>
      {label ? (
        <Text style={[body(13.5, '600'), { color: SK.label, marginBottom: 5 }]}>
          {label}
          {optional ? <Text style={[body(11.5), { color: SK.faint }]}> ({optional})</Text> : null}
          {required ? <Text style={{ color: SK.danger }}> *</Text> : null}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text style={[body(11.5), { color: SK.danger, marginTop: 4 }]}>{error}</Text>
      ) : hint ? (
        <Text style={[body(11), { color: SK.faint, marginTop: 4, lineHeight: 16 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/**
 * The box every control sits in: 1px zinc border, `rounded-md`, a glyph at the
 * head. The border belongs to the row and not to the `TextInput`, so an icon and
 * an eye can share it without either being drawn over a second border.
 */
export function AuthBox({ icon, invalid, style, children }) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: invalid ? SK.danger : SK.border,
          borderRadius: SK.radius,
          paddingLeft: icon ? 10 : 0,
          paddingRight: 0,
        },
        style,
      ]}
    >
      {icon ? <AuthIcon name={icon} /> : null}
      {children}
    </View>
  );
}

const fieldText = {
  flex: 1,
  paddingHorizontal: 12,
  paddingVertical: 11,
  color: SK.ink,
};

/**
 * `prefix` prints a fixed head to the value — the country's dial code, which is
 * decided by the picker above the field and so is shown rather than typed.
 */
export function AuthInput({ icon, invalid, prefix, style, ...props }) {
  return (
    <AuthBox icon={icon} invalid={invalid}>
      {prefix ? (
        <Text style={[body(14), { color: SK.muted, paddingLeft: icon ? 0 : 12 }]}>{prefix}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={SK.faint}
        style={[body(14), fieldText, icon || prefix ? { paddingLeft: 0 } : null, style]}
        {...props}
      />
    </AuthBox>
  );
}

/** Same box, with the show/hide eye the website puts at `right-2`. */
export function AuthPassword({ icon = 'lock', invalid, ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <AuthBox icon={icon} invalid={invalid} style={{ paddingRight: 8 }}>
      <TextInput
        placeholderTextColor={SK.faint}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        style={[body(14), fieldText, icon ? { paddingLeft: 0 } : null]}
        {...props}
      />
      <Pressable onPress={() => setShown((v) => !v)} hitSlop={10} style={{ padding: 4 }}>
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
          <Path
            d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"
            stroke={SK.faint}
            strokeWidth={1.8}
          />
          <Path d="M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z" stroke={SK.faint} strokeWidth={1.8} />
          {!shown ? (
            <Path d="M4 20 20 4" stroke={SK.faint} strokeWidth={1.8} strokeLinecap="round" />
          ) : null}
        </Svg>
      </Pressable>
    </AuthBox>
  );
}

/** The website's `<select>`: same box, a chevron at its end, a sheet behind it. */
export function AuthSelect({ icon, value, placeholder, onPress, invalid }) {
  return (
    <Pressable onPress={onPress}>
      <AuthBox icon={icon} invalid={invalid} style={{ paddingRight: 12 }}>
        <Text
          style={[body(14), fieldText, icon ? { paddingLeft: 0 } : null, { color: value ? SK.ink : SK.faint }]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <AuthIcon name="chevron" size={16} strokeWidth={2} />
      </AuthBox>
    </Pressable>
  );
}

// ── Actions ─────────────────────────────────────────────────────────────────

/** Full width, solid orange, `rounded-md`. The website has exactly one of these. */
export function AuthButton({ label, loading, disabled, onPress }) {
  const off = loading || disabled;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: pressed ? SK.orangeDark : SK.orange,
        borderRadius: SK.radius,
        paddingVertical: 12,
        paddingHorizontal: 16,
        opacity: off ? 0.6 : 1,
      })}
    >
      {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
      <Text style={[body(14.5, '700'), { color: '#FFFFFF' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function AuthLink({ label, onPress, disabled, bold }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8}>
      <Text style={[body(13, bold ? '700' : '600'), { color: SK.orange }]}>{label}</Text>
    </Pressable>
  );
}

/** 16px box with the orange accent, and its label as the rest of the target. */
export function AuthCheckbox({ checked, onPress, children }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!checked }}
      hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <View
        style={{
          width: 17,
          height: 17,
          borderRadius: 4,
          borderWidth: 1.5,
          alignItems: 'center',
          justifyContent: 'center',
          borderColor: checked ? SK.orange : SK.border,
          backgroundColor: checked ? SK.orange : '#FFFFFF',
        }}
      >
        {checked ? (
          <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
            <Path
              d="m5 13 4.5 4.5L19 7"
              stroke="#FFFFFF"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </View>
      {children}
    </Pressable>
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────

/** The box a server's answer lands in, above the button. */
export function AuthNotice({ children }) {
  return (
    <View
      style={{
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: SK.radius,
        padding: 11,
      }}
    >
      <Text style={[body(12.5), { color: '#B91C1C', lineHeight: 19 }]}>{children}</Text>
    </View>
  );
}

/** The verification step's header: shield, heading, where the code went. */
export function AuthStepHead({ title, body: copy }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <AuthIcon name="shield" size={44} color={SK.orange} strokeWidth={1.5} />
      <Text style={[heading(16, '700'), { color: SK.ink, marginTop: 10, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text style={[body(13), { color: SK.muted, marginTop: 4, textAlign: 'center', lineHeight: 20 }]}>
        {copy}
      </Text>
    </View>
  );
}
