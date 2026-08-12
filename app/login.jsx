import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Button, Field, Input, Wordmark } from '../src/components/ui';
import { COLOR, GREY, RADIUS, body } from '../src/constants/theme';
import { useT } from '../src/i18n';
import { useAuthStore } from '../src/store/authStore';
import { useCreditStore } from '../src/store/creditStore';
import { useOfficeSpaceStore } from '../src/store/officeSpaceStore';

/**
 * Sign in.
 *
 * The design has no sign-in screen — it starts at the gallery. It cannot: every
 * AI-template endpoint sits behind `authenticate`, including the plain list, so
 * there is nothing to show before a token exists. This screen is therefore an
 * addition, built from the design's own primitives rather than borrowed from
 * another app.
 *
 * Accounts are created in the main SohozKaj app, so there is deliberately no
 * register or password-reset flow here — the same rule sohozkaj-studio follows.
 *
 * `identifier` is the backend's unified login field and takes a phone number or
 * an email; the older `phone`-only body still works but narrows what a user can
 * type for no reason.
 */
export default function Login() {
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const fetchOfficeSpaces = useOfficeSpaceStore((s) => s.fetch);
  const refreshCredits = useCreditStore((s) => s.refresh);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError(t.signInMissing);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login({ identifier: identifier.trim(), password });
      // The office space decides which balance credits come out of, and every
      // generate needs it — fetch it now rather than on the first generate,
      // where a failure would look like the generate itself was broken.
      await Promise.all([fetchOfficeSpaces().catch(() => {}), refreshCredits().catch(() => {})]);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err.message || t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLOR.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* The design system is explicit that this product has no mark: set the
            name in Anek Bangla 800 with "AI" gradient-filled. Do not draw one. */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Wordmark size={24} />
          <Text style={[body(13.5), { color: GREY.label, marginTop: 8, textAlign: 'center' }]}>
            {t.signInBody}
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <Field label={t.phone}>
            <Input
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={t.phonePh}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
            />
          </Field>

          <Field label={t.password}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLOR.white,
                borderWidth: 1,
                borderColor: GREY.border,
                borderRadius: RADIUS.lg,
                paddingRight: 8,
              }}
            >
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onSubmitEditing={submit}
                returnKeyType="go"
                style={{ flex: 1, borderWidth: 0, backgroundColor: 'transparent' }}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} style={{ padding: 6 }}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"
                    stroke={GREY.label}
                    strokeWidth={1.8}
                  />
                  <Path d="M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z" stroke={GREY.label} strokeWidth={1.8} />
                  {!showPassword ? (
                    <Path d="M4 20 20 4" stroke={GREY.label} strokeWidth={1.8} strokeLinecap="round" />
                  ) : null}
                </Svg>
              </Pressable>
            </View>
          </Field>

          {error ? (
            <View
              style={{
                backgroundColor: '#FFF1F0',
                borderWidth: 1,
                borderColor: 'rgba(250,16,20,.2)',
                borderRadius: RADIUS.lg,
                padding: 12,
              }}
            >
              <Text style={[body(12.5), { color: COLOR.redInk, lineHeight: 19 }]}>{error}</Text>
            </View>
          ) : null}

          <Button label={t.signIn} fullWidth loading={busy} onPress={submit} />
        </View>

        <Text style={[body(12), { color: GREY.label, textAlign: 'center', marginTop: 32 }]}>
          {t.noAccount}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
