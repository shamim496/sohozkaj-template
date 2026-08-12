import { useEffect, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import OtpInput from '../src/components/OtpInput';
import { toast } from '../src/components/Toast';
import {
  AuthButton,
  AuthField,
  AuthInput,
  AuthLink,
  AuthNotice,
  AuthPassword,
  AuthScreen,
  AuthStepHead,
} from '../src/components/authUi';
import { SK, body } from '../src/constants/theme';
import { useT } from '../src/i18n';
import authApi from '../src/services/authApi';
import { useAuthStore } from '../src/store/authStore';

/**
 * Reset a forgotten password — the third of the ported website screens.
 *
 * `POST /api/auth/forgot-password` texts a code, `POST /api/auth/reset-password`
 * takes the code and the new password together — it verifies the code itself
 * when the caller has not already spent it, so the two steps below are the whole
 * flow and there is no separate "verify" call.
 *
 * It ends at sign-in rather than signing anyone in: reset-password returns no
 * token, and the backend allows one live session per account, so proving the
 * new password immediately is the honest next step.
 *
 * Bangladesh only, because the endpoint is: its schema takes eleven digits and
 * nothing else, and the code goes out by SMS.
 */

const BD_PHONE = /^01[3-9]\d{8}$/;
const RESEND_SECONDS = 60;

export default function ForgotPassword() {
  const { t, num } = useT();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Back belongs to the step while there is a step to go back to.
  useEffect(() => {
    if (step !== 'reset') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep('phone');
      setError('');
      return true;
    });
    return () => sub.remove();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (isAuthenticated) return <Redirect href="/(tabs)" />;

  const goSignIn = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const sendError = (err) => {
    // The only 400 this endpoint raises past the schema is "no such account",
    // and the schema already matched the number we sent. A 403 is the device
    // block that guards the whole OTP surface.
    if (err.status === 400) return t.noSuchAccount;
    if (err.status === 403) return t.tooManyTries;
    return err.message || t.otpSendFailed;
  };

  const sendCode = async () => {
    if (busy) return;
    const number = phone.trim();
    if (!BD_PHONE.test(number)) {
      setError(t.badPhone);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await authApi.forgotPassword({ phone: number });
      setStep('reset');
      setCode('');
      setCooldown(RESEND_SECONDS);
      toast.success(t.otpSent);
    } catch (err) {
      setError(sendError(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError('');
    try {
      await authApi.forgotPassword({ phone: phone.trim() });
      setCooldown(RESEND_SECONDS);
      toast.success(t.otpSent);
    } catch (err) {
      setError(sendError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (busy) return;
    if (code.length !== 6) {
      setError(t.otpShort);
      return;
    }
    // Eight characters, matching the change-password screen — the endpoint
    // itself only asks for six.
    if (password.length < 8) {
      setError(t.pwShort);
      return;
    }
    if (password !== confirm) {
      setError(t.pwMismatch);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await authApi.resetPassword({
        phone: phone.trim(),
        otp: code,
        newPassword: password,
        purpose: 'password_reset',
      });
      toast.success(t.resetDone);
      // Straight to sign-in with the number already filled in — the password is
      // the only thing left to type.
      router.replace({ pathname: '/login', params: { phone: phone.trim() } });
    } catch (err) {
      setError(err.status === 401 ? t.otpWrong : err.message || t.pwFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      subtitle={step === 'phone' ? t.forgotTitle : t.resetTitle}
      progress={step === 'phone' ? 50 : 100}
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
          <Text style={[body(13), { color: SK.body }]}>{t.haveAccount}</Text>
          <AuthLink label={t.signIn} bold onPress={goSignIn} />
        </View>
      }
    >
      {step === 'phone' ? (
        <View style={{ gap: 16 }}>
          <Text style={[body(13), { color: SK.muted, lineHeight: 20 }]}>{t.forgotBody}</Text>

          {/* Sign-up now takes any country, so say plainly that this does not —
              the endpoint's schema is eleven digits and the code goes by SMS. */}
          <AuthField label={t.fPhone} required hint={t.resetBdOnly}>
            <AuthInput
              icon="phone"
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, '').slice(0, 11))}
              placeholder={t.phonePh}
              keyboardType="phone-pad"
              inputMode="numeric"
              autoComplete="tel"
              onSubmitEditing={sendCode}
              returnKeyType="go"
            />
          </AuthField>

          {error ? <AuthNotice>{error}</AuthNotice> : null}

          <AuthButton label={t.sendCode} loading={busy} onPress={sendCode} />
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <AuthStepHead title={t.otpTitle} body={t.resetBody(phone.trim())} />

          <View style={{ gap: 10 }}>
            <Text style={[body(13), { color: SK.body, textAlign: 'center' }]}>{t.enterCode}</Text>
            <OtpInput value={code} onChangeText={setCode} autoFocus />
            <Text style={[body(11.5), { color: SK.faint, textAlign: 'center' }]}>{t.otpFoot}</Text>
          </View>

          <AuthField label={t.pwNew} required>
            <AuthPassword
              value={password}
              onChangeText={setPassword}
              placeholder={t.pwPh}
              autoComplete="new-password"
              returnKeyType="next"
            />
          </AuthField>

          <AuthField label={t.pwConfirm} required>
            <AuthPassword
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t.pwConfirmPh}
              autoComplete="new-password"
              onSubmitEditing={submitReset}
              returnKeyType="go"
            />
          </AuthField>

          {error ? <AuthNotice>{error}</AuthNotice> : null}

          <AuthButton label={t.resetCta} loading={busy} onPress={submitReset} />

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {cooldown > 0 ? (
              <Text style={[body(13), { color: SK.muted }]}>{t.otpResendIn(num(cooldown))}</Text>
            ) : (
              <>
                <Text style={[body(13), { color: SK.muted }]}>{t.codeNotReceived}</Text>
                <AuthLink label={t.otpResend} disabled={busy} onPress={resend} />
              </>
            )}
            <Text style={[body(13), { color: SK.faint }]}>·</Text>
            <AuthLink
              label={t.changeNumber}
              disabled={busy}
              onPress={() => {
                setStep('phone');
                setError('');
              }}
            />
          </View>
        </View>
      )}
    </AuthScreen>
  );
}
