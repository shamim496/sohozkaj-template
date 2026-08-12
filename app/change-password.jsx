import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../src/components/AppHeader';
import { toast } from '../src/components/Toast';
import { Button, Field, Input, Screen } from '../src/components/ui';
import { COLOR, LAYOUT, RADIUS, body } from '../src/constants/theme';
import { useT } from '../src/i18n';
import authApi from '../src/services/authApi';

/**
 * `POST /api/auth/change-password`.
 *
 * Its own route rather than a sheet: `BottomSheet` has no keyboard avoidance,
 * and two secure fields under a keyboard is exactly where that shows.
 *
 * The session survives this — `AuthService.changePassword` never rotates
 * `sessionToken`, so there is no re-login to handle and nothing to write back
 * to the auth store.
 */
export default function ChangePassword() {
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!current || !next) {
      setError(t.fillRequired);
      return;
    }
    // The endpoint's schema only demands six characters. Eight is what the
    // website asks for, and the stricter of the two is the one to enforce
    // where the user can still see the field.
    if (next.length < 8) {
      setError(t.pwShort);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      toast.success(t.pwSaved);
      if (router.canGoBack()) router.back();
    } catch (err) {
      setError(err.message || t.pwFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={{ backgroundColor: COLOR.muted }}>
      <AppHeader title={t.changePw} showBack showCredits={false} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + LAYOUT.headerHeight}
      >
        <ScrollView
          contentContainerStyle={{ padding: LAYOUT.screenPadding, paddingBottom: 40 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 16 }}>
            <Field label={t.pwCurrent}>
              <Input
                value={current}
                onChangeText={setCurrent}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
              />
            </Field>

            <Field label={t.pwNew}>
              <Input
                value={next}
                onChangeText={setNext}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                onSubmitEditing={submit}
                returnKeyType="go"
              />
            </Field>

            {/* The server's rejection is usually about the *current* password,
                so it goes in its own box rather than under whichever field the
                error happens to sit next to. Same shape as the sign-in screen. */}
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

            <Button label={t.saveProfile} fullWidth loading={busy} onPress={submit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
