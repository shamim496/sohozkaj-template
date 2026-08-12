import { useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  AuthButton,
  AuthCheckbox,
  AuthField,
  AuthInput,
  AuthLink,
  AuthNotice,
  AuthPassword,
  AuthScreen,
} from '../src/components/authUi';
import { SK, body } from '../src/constants/theme';
import { useT } from '../src/i18n';
import { useAuthStore } from '../src/store/authStore';
import { useCreditStore } from '../src/store/creditStore';
import { useOfficeSpaceStore } from '../src/store/officeSpaceStore';

/**
 * Sign in.
 *
 * The AI-template design has no sign-in screen — it starts at the gallery. It
 * cannot: every AI-template endpoint sits behind `authenticate`, including the
 * plain list, so there is nothing to show before a token exists.
 *
 * So this screen, sign-up and password reset are ports of sohozkaj.com's own —
 * see `src/components/authUi.jsx`. They are the same account system, and the
 * form should be the one the user already knows.
 *
 * `identifier` is the backend's unified login field and takes a phone number or
 * an email; the older `phone`-only body still works but narrows what a user can
 * type for no reason. An email only works once it has been *verified*, which the
 * SMS signup does not do — so for an account created in this app the phone
 * number is the login handle until an email is confirmed elsewhere.
 */
export default function Login() {
  const { t } = useT();
  // The password-reset screen hands the number back so only the password is
  // left to type.
  const params = useLocalSearchParams();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const fetchOfficeSpaces = useOfficeSpaceStore((s) => s.fetch);
  const refreshCredits = useCreditStore((s) => s.refresh);

  const [identifier, setIdentifier] = useState(typeof params.phone === 'string' ? params.phone : '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    if (busy) return;
    if (!identifier.trim() || !password) {
      setError(t.signInMissing);
      return;
    }
    setBusy(true);
    setError('');
    try {
      // `rememberMe` is the server's own flag: it signs a 180-day token instead
      // of the default seven. Nothing is stored differently on this side.
      await login({ identifier: identifier.trim(), password, rememberMe: remember });
      // The office space decides which balance credits come out of, and every
      // generate needs it — fetch it now rather than on the first generate,
      // where a failure would look like the generate itself was broken.
      await Promise.all([fetchOfficeSpaces().catch(() => {}), refreshCredits().catch(() => {})]);
      router.replace('/(tabs)');
    } catch (err) {
      // A registration that never got past the SMS code answers here, not at
      // sign-up. Send it to the code screen with the number rather than leaving
      // a correct password looking like a wrong one.
      if (err.code === 'PHONE_NOT_VERIFIED') {
        router.push({ pathname: '/register', params: { phone: identifier.trim(), verify: '1' } });
        return;
      }
      setError(err.message || t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      subtitle={t.signInBody}
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
          <Text style={[body(13), { color: SK.body }]}>{t.noAccount}</Text>
          <AuthLink label={t.signUp} bold onPress={() => router.push('/register')} />
        </View>
      }
    >
      <View style={{ gap: 16 }}>
        <AuthField label={t.phone} required>
          <AuthInput
            icon="phone"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={t.phonePh}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
          />
        </AuthField>

        <AuthField label={t.password} required>
          <AuthPassword
            value={password}
            onChangeText={setPassword}
            placeholder={t.pwEnter}
            autoComplete="current-password"
            onSubmitEditing={submit}
            returnKeyType="go"
          />
        </AuthField>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <AuthCheckbox checked={remember} onPress={() => setRemember((v) => !v)}>
            <Text style={[body(13), { color: SK.body }]}>{t.rememberMe}</Text>
          </AuthCheckbox>
          <AuthLink
            label={t.forgotLink}
            disabled={busy}
            onPress={() => router.push('/forgot-password')}
          />
        </View>

        {error ? <AuthNotice>{error}</AuthNotice> : null}

        <AuthButton label={t.signIn} loading={busy} onPress={submit} />
      </View>
    </AuthScreen>
  );
}
