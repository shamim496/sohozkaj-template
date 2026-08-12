import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../src/components/AppHeader';
import { toast } from '../src/components/Toast';
import { Button, ErrorState, Field, Input, Loading, Screen } from '../src/components/ui';
import { COLOR, GRADIENT, GREY, LAYOUT, RADIUS, SHADOW, body, heading } from '../src/constants/theme';
import { useT } from '../src/i18n';
import { pickImages } from '../src/lib/files';
import { optimizeForUpload } from '../src/lib/image';
import { useAuthStore } from '../src/store/authStore';
import { useCreditStore } from '../src/store/creditStore';
import authApi from '../src/services/authApi';

/**
 * Editing the account, against `PUT /api/auth/profile`.
 *
 * The design has no such screen — its "আমার প্রোফাইল" row is a link to nowhere
 * — so this is built from the design's own primitives, the way the sign-in
 * screen was.
 *
 * **What is deliberately not editable.**
 *
 *  - **Phone.** The endpoint accepts it, but there is no OTP purpose for a
 *    phone *change* (`send-otp` covers registration and password reset only),
 *    `phoneVerified` is not cleared by the write, and the JWT keeps the old
 *    claim. A number that silently disagrees with the one the account is
 *    verified against is worse than a locked field.
 *  - **Email, once set.** Same rule the website applies: it is the recovery
 *    address, and the endpoint has no way to prove the new one belongs to
 *    whoever typed it. Blank means it can still be filled in.
 *  - **Shop and business fields.** The route *schema* accepts `shopName`,
 *    `businessCategory` and the rest, but `AuthService.updateProfile` drops
 *    them on the floor — they moved to the office space's business profile and
 *    are written by `PUT /api/office-spaces/:id`. Putting them here would be a
 *    form that saves successfully and changes nothing. The shop *picker* on the
 *    profile tab is unaffected.
 */
/** What `POST /api/auth/profile/picture` will accept; anything else is a 400. */
const ACCEPTED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];

/** The text fields, and the column length each one has to stay inside. */
const LIMITS = {
  name: 100,
  email: 255,
  address: 500,
  district: 100,
  thana: 100,
  postcode: 20,
  profession: 255,
  about: 1000,
};

const toForm = (user) => ({
  name: user?.name || '',
  email: user?.email || '',
  address: user?.address || '',
  district: user?.district || '',
  thana: user?.thana || '',
  postcode: user?.postcode || '',
  gender: user?.gender || '',
  profession: user?.profession || '',
  about: user?.about || '',
  // The API returns a full ISO timestamp; the field takes the date half.
  dateOfBirth: (user?.dateOfBirth || '').slice(0, 10),
});

export default function ProfileEdit() {
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [form, setForm] = useState(() => toForm(user));
  // What the server last told us, to diff the save against.
  const [loaded, setLoaded] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  /**
   * The form is not editable until `/auth/me` has landed.
   *
   * The cached user can be the *login* projection, which carries none of
   * address, postcode, gender, profession, about or dateOfBirth — the tabs
   * layout refreshes it once per sign-in and swallows a failure. Seeding a
   * savable form from that object and then sending every field would write
   * `null` over six columns the user never saw, and report it as a success.
   */
  const [attempt, setAttempt] = useState(0);
  const reload = () => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fresh = await refreshUser();
      if (cancelled) return;
      if (fresh) {
        setLoaded(fresh);
        setForm(toForm(fresh));
        setStatus('ready');
      } else {
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser, attempt]);

  const emailLocked = !!loaded?.email;
  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: null } : prev));
  };

  // ── Validation ──────────────────────────────────────────────────────────
  //
  // `dateOfBirth` is the one that matters: the server hands the string straight
  // to `new Date()`, so anything it cannot parse becomes an Invalid Date and
  // the write dies as a 500 rather than a field error.
  const validate = () => {
    const next = {};
    const name = form.name.trim();
    if (name.length < 2) next.name = t.tooShort;

    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t.badEmail;

    const dob = form.dateOfBirth.trim();
    if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(new Date(dob).getTime()))) {
      next.dateOfBirth = t.badDob;
    }

    // The columns are length-capped but nothing between here and Postgres
    // checks: an over-long value comes back as a raw Prisma error in a 500,
    // naming no field. Caught here, it names the field it belongs to.
    for (const [key, max] of Object.entries(LIMITS)) {
      if ((form[key] || '').trim().length > max) next[key] = t.tooLong(max);
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (busy || !validate()) return;
    setBusy(true);
    try {
      /**
       * Only what actually changed.
       *
       * The service reads `undefined` as "leave it alone" and `null` as
       * "clear it", so a diff is what lets a field be cleared *and* keeps this
       * screen from writing over anything it never showed. Sending the whole
       * form would make every field this app does not render — and every value
       * saved by a flow it does not have — a casualty of one save.
       */
      const payload = {};
      const put = (key, value) => {
        const before = key === 'dateOfBirth' ? (loaded?.[key] || '').slice(0, 10) : loaded?.[key] || '';
        if (value === before) return;
        payload[key] = value || null;
      };

      put('name', form.name.trim());
      put('address', form.address.trim());
      put('district', form.district.trim());
      put('thana', form.thana.trim());
      put('postcode', form.postcode.trim());
      put('gender', form.gender);
      put('profession', form.profession.trim());
      put('about', form.about.trim());
      put('dateOfBirth', form.dateOfBirth.trim());

      // `name` is the one field the server refuses to clear, so a diff that
      // emptied it would 400 rather than save. Keep the last good value.
      if (payload.name === null) delete payload.name;

      // An email is sent only when it is new: the field is locked once set, and
      // re-sending the same address makes the server run its uniqueness check
      // against the account's own row for nothing.
      if (!emailLocked && form.email.trim()) payload.email = form.email.trim();

      if (!Object.keys(payload).length) {
        if (router.canGoBack()) router.back();
        return;
      }

      const res = await authApi.updateProfile(payload);

      // The update response omits `phoneVerified` and `emailVerified`, so the
      // profile is re-read rather than taken from the write.
      const fresh = await refreshUser();
      if (!fresh && res?.data) setUser(res.data);

      // The bonus flag is a sibling of `data`, not a field inside it.
      if (res?.profileCompletionBonus) {
        useCreditStore.getState().refresh();
        toast.success(t.bonusEarned);
      } else {
        toast.success(t.profileSaved);
      }

      if (router.canGoBack()) router.back();
    } catch (error) {
      if (error.code === 'EMAIL_ALREADY_EXISTS') {
        setErrors((prev) => ({ ...prev, email: t.emailTaken }));
      } else {
        toast.error(error.message || t.profileSaveFailed);
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Avatar ──────────────────────────────────────────────────────────────
  //
  // The server re-encodes to a 400px WebP, so the local pass only exists to
  // keep a 12MP camera frame off a mobile connection.
  const pickPhoto = async () => {
    if (uploading) return;

    let picked;
    try {
      [picked] = await pickImages();
    } catch (error) {
      toast.error(error.code === 'PERMISSION_DENIED' ? t.permissionPhotos : error.message);
      return;
    }
    if (!picked) return;

    setUploading(true);
    try {
      // 800px is generous for something the server then re-encodes to 400 —
      // it is here to keep a 12MP frame off a mobile connection, not to size
      // the avatar.
      const optimised = await optimizeForUpload(picked, { maxEdge: 800 });

      const formData = new FormData();
      formData.append('file', {
        uri: optimised.uri,
        name: optimised.name,
        // `optimizeForUpload` returns the untouched asset when it fails, and an
        // iPhone hands the picker an `image/heic` the endpoint rejects
        // outright. Only the three types it accepts are ever declared.
        type: ACCEPTED_IMAGE.includes(optimised.mimeType) ? optimised.mimeType : 'image/jpeg',
      });

      const res = await authApi.uploadProfilePicture(formData);
      if (res?.data) setUser(res.data);
    } catch (error) {
      toast.error(error.message || t.photoFailed);
    } finally {
      setUploading(false);
    }
  };

  const initial = (user?.name || user?.phone || '—').trim().charAt(0);

  const SectionTitle = ({ children, style }) => (
    <Text style={[heading(14.5, '700'), { color: COLOR.ink800, marginBottom: 8 }, style]}>
      {children}
    </Text>
  );

  const card = {
    backgroundColor: COLOR.white,
    borderRadius: RADIUS.xl,
    padding: 14,
    gap: 14,
    marginBottom: 18,
    ...SHADOW.card,
  };

  const GenderButton = ({ value, label }) => {
    const on = form.gender === value;
    return (
      <Pressable
        // Tapping the chosen option again clears it — `gender` is optional, and
        // there is no other way back to "not saying".
        onPress={() => set('gender')(on ? '' : value)}
        style={{
          flex: 1,
          borderRadius: RADIUS.lg,
          paddingVertical: 11,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: on ? 'rgba(152,16,250,.28)' : GREY.border,
          backgroundColor: on ? COLOR.violet050 : COLOR.white,
        }}
      >
        <Text style={[body(13, '600'), { color: on ? COLOR.violet500 : COLOR.ink600 }]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  if (status === 'loading') {
    return (
      <Screen style={{ backgroundColor: COLOR.muted }}>
        <AppHeader title={t.pl1} showBack showCredits={false} />
        <Loading />
      </Screen>
    );
  }

  // Editing a profile the server never confirmed is how fields get erased —
  // better to say the load failed and offer it again.
  if (status === 'error') {
    return (
      <Screen style={{ backgroundColor: COLOR.muted }}>
        <AppHeader title={t.pl1} showBack showCredits={false} />
        <ErrorState message={t.loadFailed} retryLabel={t.retry} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: COLOR.muted }}>
      <AppHeader title={t.pl1} showBack showCredits={false} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + LAYOUT.headerHeight}
      >
        <ScrollView
          contentContainerStyle={{ padding: LAYOUT.screenPadding, paddingBottom: 40 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Pressable onPress={pickPhoto} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
              {user?.profilePicture ? (
                <Image
                  source={{ uri: user.profilePicture }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  style={{ width: 84, height: 84, borderRadius: 42 }}
                />
              ) : (
                <LinearGradient
                  colors={GRADIENT.login.colors}
                  start={GRADIENT.login.start}
                  end={GRADIENT.login.end}
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 42,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={[heading(30, '800'), { color: COLOR.white }]}>{initial}</Text>
                </LinearGradient>
              )}
            </Pressable>
            <Pressable onPress={pickPhoto} hitSlop={8} style={{ marginTop: 10 }}>
              <Text style={[body(12.5, '700'), { color: COLOR.violet500 }]}>
                {uploading ? t.uploadingPhoto : t.changePhoto}
              </Text>
            </Pressable>
          </View>

          <SectionTitle>{t.secBasic}</SectionTitle>
          <View style={card}>
            <Field label={t.fName} required error={errors.name}>
              <Input
                value={form.name}
                onChangeText={set('name')}
                placeholder={t.fName}
                autoCapitalize="words"
                maxLength={LIMITS.name}
                invalid={!!errors.name}
              />
            </Field>

            <Field label={t.fPhone} hint={t.phoneLocked}>
              <Input
                value={user?.phone || ''}
                editable={false}
                style={{ backgroundColor: COLOR.subtle, color: COLOR.ink500 }}
              />
            </Field>

            <Field
              label={t.fEmail}
              hint={emailLocked ? t.emailLocked : undefined}
              error={errors.email}
            >
              <Input
                value={form.email}
                onChangeText={set('email')}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!emailLocked}
                maxLength={LIMITS.email}
                invalid={!!errors.email}
                style={emailLocked ? { backgroundColor: COLOR.subtle, color: COLOR.ink500 } : null}
              />
            </Field>
          </View>

          <SectionTitle>{t.secAddress}</SectionTitle>
          <View style={card}>
            <Field label={t.fAddress}>
              <Input
                value={form.address}
                onChangeText={set('address')}
                placeholder={t.fAddress}
                maxLength={LIMITS.address}
              />
            </Field>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label={t.fDistrict}>
                  <Input
                    value={form.district}
                    onChangeText={set('district')}
                    maxLength={LIMITS.district}
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t.fThana}>
                  <Input
                    value={form.thana}
                    onChangeText={set('thana')}
                    maxLength={LIMITS.thana}
                  />
                </Field>
              </View>
            </View>
            <Field label={t.fPostcode}>
              <Input
                value={form.postcode}
                onChangeText={set('postcode')}
                keyboardType="number-pad"
                maxLength={LIMITS.postcode}
              />
            </Field>
          </View>

          <SectionTitle>{t.secMore}</SectionTitle>
          <View style={card}>
            <Field label={t.fGender}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <GenderButton value="male" label={t.gMale} />
                <GenderButton value="female" label={t.gFemale} />
                <GenderButton value="other" label={t.gOther} />
              </View>
            </Field>

            <Field label={t.fProfession}>
              <Input
                value={form.profession}
                onChangeText={set('profession')}
                maxLength={LIMITS.profession}
              />
            </Field>

            <Field label={t.fDob} error={errors.dateOfBirth}>
              <Input
                value={form.dateOfBirth}
                onChangeText={set('dateOfBirth')}
                placeholder={t.dobPh}
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
                invalid={!!errors.dateOfBirth}
              />
            </Field>

            <Field label={t.fAbout}>
              <Input
                value={form.about}
                onChangeText={set('about')}
                maxLength={LIMITS.about}
                multiline
              />
            </Field>
          </View>

          <Button label={t.saveProfile} fullWidth loading={busy} onPress={submit} />

          <Pressable
            onPress={() => router.push('/change-password')}
            style={{
              marginTop: 12,
              borderWidth: 1,
              borderColor: GREY.border,
              backgroundColor: COLOR.white,
              borderRadius: RADIUS.pill,
              paddingVertical: 13,
              alignItems: 'center',
            }}
          >
            <Text style={[heading(14, '700'), { color: COLOR.ink700 }]}>{t.changePw}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
