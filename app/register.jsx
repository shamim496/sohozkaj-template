import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import OtpInput from '../src/components/OtpInput';
import PickerSheet from '../src/components/PickerSheet';
import { toast } from '../src/components/Toast';
import {
  AuthButton,
  AuthCheckbox,
  AuthField,
  AuthInput,
  AuthLink,
  AuthNotice,
  AuthPassword,
  AuthScreen,
  AuthSelect,
  AuthStepHead,
} from '../src/components/authUi';
import { COUNTRIES, DEFAULT_COUNTRY, countryOf, dialOf, flagOf } from '../src/constants/countries';
import { SK, body } from '../src/constants/theme';
import { useT } from '../src/i18n';
import authApi from '../src/services/authApi';
import { useAuthStore } from '../src/store/authStore';
import { useCreditStore } from '../src/store/creditStore';
import { useOfficeSpaceStore } from '../src/store/officeSpaceStore';

/**
 * Sign up — a port of sohozkaj.com's RegisterPage (see `authUi.jsx`).
 *
 * Registration is not a single call. `POST /api/auth/pre-register` writes an
 * *unverified* row and sends a six-digit code; `POST /api/auth/verify-otp`
 * spends the code; only then does `POST /api/auth/register` create the account
 * and answer with a session. `register` re-checks the verification server-side,
 * so the middle step cannot be skipped — hence the two steps, and the progress
 * bar over them.
 *
 * **The country decides how the code travels.** The backend routes it: BD (or
 * unset) gets an SMS, every other country gets an email, which is why the email
 * field is optional here and required there. The purpose string, the resend call
 * and `verificationMethod` on the final `register` all have to agree with that
 * choice, so they are derived from the country in one place — `method` below —
 * rather than typed out per call site.
 *
 * **The role is OWNER, deliberately.** `AuthService.register` grants the signup
 * bonus and creates the default "Personal Space" office space for OWNER only,
 * and every credit-charging endpoint refuses a non-admin caller without an
 * office space. An OPERATOR signed up here would land in the app with no
 * credits, no shop, and no way to generate anything.
 *
 * Reached one other way: signing in with a number that was pre-registered but
 * never verified answers `PHONE_NOT_VERIFIED`, and the sign-in screen sends the
 * user straight here with `verify=1`. That path already has a row in the
 * database, so it finishes on `/verify-and-login` instead — no name or password
 * is asked for a second time.
 */

// 01 + operator digit + 8 more, for the Bangladeshi local form.
const BD_PHONE = /^01[3-9]\d{8}$/;

/**
 * Everywhere else, the server's own rule — `Validator.validatePhone` takes E.164
 * and nothing narrower. Matching it exactly is the point: a stricter check here
 * would reject numbers the account system accepts, and the website (which does
 * carry libphonenumber-js) would then be the only place those people can
 * register. The dial code comes from the picker, so only the length is in doubt.
 */
const E164 = /^\+[1-9]\d{7,14}$/;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Long enough that a resent code is a considered act, short enough to wait out. */
const RESEND_SECONDS = 60;

export default function Register() {
  const { t, num } = useT();
  const params = useLocalSearchParams();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const adoptSession = useAuthStore((s) => s.adoptSession);
  const fetchOfficeSpaces = useOfficeSpaceStore((s) => s.fetch);
  const refreshCredits = useCreditStore((s) => s.refresh);

  // An unverified account sent here by the sign-in screen: the row exists, only
  // the code is missing. That path is always a phone number, since it is the
  // sign-in handle that failed.
  const fromLogin = params.verify === '1';
  const initialPhone = typeof params.phone === 'string' ? params.phone : '';

  const [step, setStep] = useState(fromLogin ? 'code' : 'details');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(fromLogin ? initialPhone : '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [code, setCode] = useState('');
  // What the pending registration was started with — not necessarily what is in
  // the form, which the user can go back and edit.
  const [pending, setPending] = useState(
    fromLogin ? { phone: initialPhone, method: 'phone' } : null
  );
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null);

  const sentOnEntry = useRef(false);

  const isBd = country === DEFAULT_COUNTRY;
  const method = isBd ? 'phone' : 'email';
  // The OTP is stored against a purpose, and the wrong one reads as "not
  // verified" at the end of an otherwise perfect flow.
  const purposeFor = (m) => (m === 'email' ? 'registration_email' : 'registration');
  // BD keeps the local 01… form the whole country writes; everywhere else the
  // dial code is prepended to what was typed, because E.164 is what the server
  // stores.
  const fullPhone = isBd ? phone.trim() : `${dialOf(country)}${phone.replace(/\D/g, '')}`;

  const countryItems = useMemo(
    () => COUNTRIES.map((c) => ({ key: c.code, label: `${flagOf(c.code)}  ${c.name}`, hint: `+${c.dial}` })),
    []
  );
  // Android's back button belongs to the *step*, not the screen: from the code
  // step it returns to the form, which is where the number that needs fixing
  // is. Without this it pops to sign-in and takes the filled-in form with it.
  useEffect(() => {
    if (step !== 'code' || fromLogin) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep('details');
      setError('');
      return true;
    });
    return () => sub.remove();
  }, [step, fromLogin]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // The `verify=1` entry arrives with nothing sent yet — the sign-in attempt
  // only told us the number is unverified. Send the first code on arrival.
  useEffect(() => {
    if (!fromLogin || sentOnEntry.current || !initialPhone) return;
    sentOnEntry.current = true;
    setBusy(true);
    authApi
      .sendOtp({ phone: initialPhone, purpose: 'registration' })
      .then(() => {
        setCooldown(RESEND_SECONDS);
        toast.success(t.otpSent);
      })
      .catch((err) => setError(err.message || t.otpSendFailed))
      .finally(() => setBusy(false));
    // `t` is the locale dictionary; re-running this on a language switch would
    // send a second SMS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLogin, initialPhone]);

  if (isAuthenticated) return <Redirect href="/(tabs)" />;

  const goSignIn = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  /** A rejected code reads the same whichever call reported it. */
  const codeError = (err) =>
    err.status === 400 || err.status === 401 ? t.otpWrong : err.message || t.otpWrong;

  const validateDetails = () => {
    if (name.trim().length < 2) return t.tooShort;
    if (isBd ? !BD_PHONE.test(phone.trim()) : !E164.test(fullPhone)) {
      return isBd ? t.badPhone : t.badPhoneIntl;
    }
    // Outside Bangladesh the code goes to the inbox, so there has to be one.
    if (!isBd && !email.trim()) return t.emailNeeded;
    if (email.trim() && !EMAIL.test(email.trim())) return t.badEmail;
    // The endpoint's schema only demands six characters. Eight is what the
    // website asks for, and the stricter of the two is the one to enforce where
    // the user can still see the field — the same rule the change-password
    // screen follows.
    if (password.length < 8) return t.pwTooShort;
    if (password !== confirm) return t.pwMismatch;
    if (!terms) return t.termsNeeded;
    return '';
  };

  /**
   * The body both `pre-register` and `register` take, from one place.
   *
   * No `district`: the field is not asked for here, and an absent key leaves the
   * column null — which is what the schema allows. It is editable in Profile,
   * where filling it in is part of what earns the profile-completion bonus.
   */
  const signUpPayload = (target) => ({
    name: name.trim(),
    phone: target,
    password,
    role: 'OWNER',
    country,
    email: email.trim() || null,
  });

  const sendFreshCode = async (target, forMethod) => {
    if (forMethod === 'email') {
      // This one also writes the address onto the pending row, so a corrected
      // email lands with the code.
      await authApi.sendRegistrationEmailOtp({ phone: target, email: email.trim() });
    } else {
      await authApi.sendOtp({ phone: target, purpose: 'registration' });
    }
  };

  const enterCodeStep = (target, forMethod) => {
    setPending({ phone: target, method: forMethod });
    setCode('');
    setStep('code');
    setCooldown(RESEND_SECONDS);
  };

  /** Step one: claim the number and get a code to it. */
  const startVerification = async () => {
    if (busy) return;
    const invalid = validateDetails();
    if (invalid) {
      setError(invalid);
      return;
    }

    const target = fullPhone;
    setBusy(true);
    setError('');
    try {
      if (!pending) {
        await authApi.preRegister(signUpPayload(target));
      } else if (pending.phone === target) {
        // Same number, back for another code — and, on the email path, possibly
        // a corrected address.
        await sendFreshCode(target, method);
      } else if (isBd && pending.method === 'phone') {
        // The number was corrected after the first code went out: move the
        // pending row rather than starting a second registration, which the
        // server would reject as a duplicate.
        try {
          await authApi.changeRegistrationPhone({ oldPhone: pending.phone, newPhone: target });
        } catch (moveErr) {
          // No row left to move — it was claimed, or cleaned up. Forget it, so
          // the next attempt starts the registration over instead of trying to
          // move something that is not there.
          setPending(null);
          throw moveErr;
        }
      } else {
        // A different number on the email path (or the country was switched,
        // which rewrites the number anyway): `change-registration-phone` always
        // answers by SMS, so it is the wrong door here. Start the registration
        // for the new number instead; the row left behind stays unverified and
        // owns nothing.
        await authApi.preRegister(signUpPayload(target));
      }
      enterCodeStep(target, method);
      toast.success(t.otpSent);
    } catch (err) {
      if (err.code === 'USER_ALREADY_EXISTS') {
        setError(t.phoneTaken);
      } else if (err.code === 'EMAIL_ALREADY_EXISTS') {
        setError(t.emailTakenSignUp);
      } else if (err.status === 403) {
        // The backend blocks a device that starts registration for too many
        // different numbers (3/hour, 5/day) — say so in the app's own words
        // rather than passing on the server's English.
        setError(t.tooManyTries);
      } else if (err.code === 'REGISTRATION_ALREADY_STARTED') {
        // This number was left half-registered by an earlier attempt. Nothing
        // was sent (pre-register threw before the code went out), so send one
        // now and pick the registration up where it stopped — the final
        // `register` call writes what was typed just now over the abandoned row.
        try {
          await sendFreshCode(target, method);
          enterCodeStep(target, method);
          toast.info(t.resumeSignUp);
        } catch (sendErr) {
          setError(sendErr.status === 403 ? t.tooManyTries : sendErr.message || t.otpSendFailed);
        }
      } else {
        setError(err.message || t.signUpFailed);
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy || cooldown > 0 || !pending) return;
    setBusy(true);
    setError('');
    try {
      await sendFreshCode(pending.phone, pending.method);
      setCooldown(RESEND_SECONDS);
      toast.success(t.otpSent);
    } catch (err) {
      setError(err.status === 403 ? t.tooManyTries : err.message || t.otpSendFailed);
    } finally {
      setBusy(false);
    }
  };

  /** Step two: spend the code, take the session it comes back with. */
  const verify = async (value = code) => {
    if (busy || !pending) return;
    if (value.length !== 6) {
      setError(t.otpShort);
      return;
    }

    const purpose = purposeFor(pending.method);
    setBusy(true);
    setError('');
    try {
      let response;
      if (fromLogin) {
        // One call: the row already carries the name, password and role.
        response = await authApi.verifyAndLogin({
          phone: pending.phone,
          otp: value,
          purpose: 'registration',
        });
      } else {
        try {
          await authApi.verifyOtp({ phone: pending.phone, otp: value, purpose });
        } catch (err) {
          setError(codeError(err));
          return;
        }
        response = await authApi.register({
          ...signUpPayload(pending.phone),
          purpose,
          verificationMethod: pending.method,
        });
      }

      const { user, token } = response.data;
      adoptSession({ user, token });
      // Same as sign-in: the office space decides which balance a generate is
      // billed to, so it is fetched here rather than on the first generate,
      // where a failure would look like the generate itself was broken. A fresh
      // OWNER always has one — the server creates "Personal Space" as part of
      // registering.
      await Promise.all([fetchOfficeSpaces().catch(() => {}), refreshCredits().catch(() => {})]);
      toast.success(fromLogin ? t.phoneVerified : t.accountCreated);
      router.replace('/(tabs)');
    } catch (err) {
      setError(fromLogin ? codeError(err) : err.message || t.signUpFailed);
    } finally {
      setBusy(false);
    }
  };

  const emailCode = pending?.method === 'email';

  return (
    <AuthScreen
      subtitle={t.signUpTitle}
      progress={step === 'details' ? 50 : 100}
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
          <Text style={[body(13), { color: SK.body }]}>{t.haveAccount}</Text>
          <AuthLink label={t.signIn} bold onPress={goSignIn} />
        </View>
      }
    >
      {step === 'details' ? (
        <View style={{ gap: 16 }}>
          <AuthField label={t.country} required>
            {/* The flag is the icon here — nothing generic would say more. */}
            <AuthSelect
              value={`${flagOf(country)}  ${countryOf(country).name}  ${dialOf(country)}`}
              onPress={() => setSheet('country')}
            />
          </AuthField>

          <AuthField
            label={t.fPhone}
            required
            hint={isBd ? t.codeBySms : `${t.codeByEmail} · ${t.phoneIntlHint}`}
          >
            {isBd ? (
              <AuthInput
                icon="phone"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, '').slice(0, 11))}
                placeholder={t.phonePh}
                keyboardType="phone-pad"
                inputMode="numeric"
                autoComplete="tel"
                returnKeyType="next"
              />
            ) : (
              // The dial code is fixed by the country picker one line above, so
              // it is printed rather than typed — exactly as the website does.
              <AuthInput
                icon="phone"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, '').slice(0, 14))}
                placeholder={t.phonePhIntl}
                keyboardType="phone-pad"
                inputMode="numeric"
                autoComplete="tel"
                returnKeyType="next"
                prefix={dialOf(country)}
              />
            )}
          </AuthField>

          <AuthField label={t.fEmail} required={!isBd} optional={isBd ? t.optionalTag : undefined}>
            <AuthInput
              icon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder={t.emailPh}
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
            />
          </AuthField>

          <AuthField label={t.fFullName} required>
            <AuthInput
              icon="user"
              value={name}
              onChangeText={setName}
              placeholder={t.namePh}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
            />
          </AuthField>

          <AuthField label={t.password} required>
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
              onSubmitEditing={startVerification}
              returnKeyType="go"
            />
          </AuthField>

          <AuthCheckbox checked={terms} onPress={() => setTerms((v) => !v)}>
            {/* The terms themselves live on the website — the Profile row says
                the same thing — so the coloured words are part of the sentence
                rather than a link to a page this app does not have. */}
            <Text style={[body(13), { color: SK.body, flex: 1 }]}>
              {t.agreeTermsPre} <Text style={{ color: SK.orange }}>{t.termsLink}</Text>
              {t.agreeTermsPost ? ` ${t.agreeTermsPost}` : ''}
            </Text>
          </AuthCheckbox>

          {error ? <AuthNotice>{error}</AuthNotice> : null}

          <AuthButton label={t.signUpCta} loading={busy} onPress={startVerification} />

          {/* What the account is worth on day one, in the app's own words. */}
          <Text style={[body(11.5), { color: SK.faint, textAlign: 'center', lineHeight: 18 }]}>
            {t.freeCredits}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <AuthStepHead
            title={emailCode ? t.otpTitleEmail : t.otpTitle}
            body={
              fromLogin
                ? t.verifyToSignIn
                : emailCode
                  ? t.otpBodyEmail(email.trim())
                  : t.otpBody(pending?.phone || '')
            }
          />

          <View style={{ gap: 10 }}>
            <Text style={[body(13), { color: SK.body, textAlign: 'center' }]}>{t.enterCode}</Text>
            <OtpInput value={code} onChangeText={setCode} autoFocus onFilled={verify} />
            <Text style={[body(11.5), { color: SK.faint, textAlign: 'center' }]}>{t.otpFoot}</Text>
          </View>

          {error ? <AuthNotice>{error}</AuthNotice> : null}

          <AuthButton label={t.otpVerify} loading={busy} onPress={() => verify()} />

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
            {!fromLogin ? (
              <>
                <Text style={[body(13), { color: SK.faint }]}>·</Text>
                <AuthLink
                  label={t.changeNumber}
                  disabled={busy}
                  onPress={() => {
                    setStep('details');
                    setError('');
                  }}
                />
              </>
            ) : null}
          </View>
        </View>
      )}

      <PickerSheet
        open={sheet === 'country'}
        title={t.pickCountry}
        searchPlaceholder={t.searchCountry}
        items={countryItems}
        value={country}
        onSelect={(code2) => {
          // The two phone formats have nothing in common — an 11-digit local
          // number is not the tail of an E.164 one — so the field is cleared
          // rather than reinterpreted.
          setCountry(code2);
          setPhone('');
          setError('');
        }}
        onClose={() => setSheet(null)}
      />
    </AuthScreen>
  );
}
