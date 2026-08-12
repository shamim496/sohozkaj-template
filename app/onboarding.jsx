import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, GradientWord, Wordmark } from '../src/components/ui';
import { COLOR, GREY, RADIUS, body, heading } from '../src/constants/theme';
import { useLangStore, useT } from '../src/i18n';
import aiTemplateService from '../src/services/aiTemplateService';
import { useSettingsStore } from '../src/store/settingsStore';

/**
 * Three slides, shown once.
 *
 * The design fills each slide with three template thumbnails. Those come from
 * the live gallery when it is reachable — this is the first thing a new user
 * sees, and showing the real catalogue is the honest version of "৫০০+
 * টেমপ্লেট". The endpoint needs a session though, and nobody has one yet on
 * slide 1, so the request is fire-and-forget: it succeeds for a returning user
 * who signed out, and falls back to flat tinted tiles for everyone else.
 */

const TINTS = [
  ['#FFE3C2', '#E9DDFF', '#FFD3D3'],
  ['#DDEBFF', '#FFE9C2', '#E4F7DE'],
  ['#F0E2FF', '#FFDCE6', '#DFF1FF'],
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const finish = useSettingsStore((s) => s.finishOnboarding);

  const [step, setStep] = useState(0);
  const [thumbs, setThumbs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    aiTemplateService
      .list({ sort: 'popular' })
      .then((res) => {
        if (cancelled) return;
        setThumbs((res.data || []).map((x) => x.thumbnail).filter(Boolean).slice(0, 9));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const slides = [
    { titleA: t.onb1TitleA, titleB: t.onb1TitleB, body: t.onb1Body },
    { titleA: t.onb2TitleA, titleB: t.onb2TitleB, body: t.onb2Body },
    { titleA: t.onb3TitleA, titleB: t.onb3TitleB, body: t.onb3Body },
  ];
  const slide = slides[step];
  const isLast = step === slides.length - 1;

  const done = () => {
    finish();
    router.replace('/login');
  };

  const LangTab = ({ code, label }) => {
    const on = lang === code;
    return (
      <Pressable
        onPress={() => setLang(code)}
        style={{
          borderRadius: RADIUS.pill,
          paddingVertical: 6,
          paddingHorizontal: 12,
          backgroundColor: on ? COLOR.white : 'transparent',
          ...(on
            ? {
                shadowColor: '#101828',
                shadowOpacity: 0.08,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              }
            : null),
        }}
      >
        <Text style={[heading(12, '700'), { color: on ? COLOR.ink800 : GREY.label }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLOR.white,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 26,
        paddingHorizontal: 22,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Wordmark size={17} />
        <View
          style={{
            flexDirection: 'row',
            gap: 2,
            backgroundColor: '#F3F4F6',
            borderRadius: RADIUS.pill,
            padding: 3,
          }}
        >
          <LangTab code="bn" label="বাংলা" />
          <LangTab code="en" label="EN" />
        </View>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: 20, paddingVertical: 32 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[0, 1, 2].map((i) => {
            const uri = thumbs[step * 3 + i];
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  aspectRatio: 3 / 4,
                  borderRadius: RADIUS.xl,
                  overflow: 'hidden',
                  backgroundColor: TINTS[step][i],
                }}
              >
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        <View>
          <Text style={[body(12, '700'), { color: COLOR.violet500, marginBottom: 10 }]}>
            {t.stepOf(step + 1, slides.length)}
          </Text>

          {/* The design's rule: exactly one word of the heading takes the brand
              gradient, never the whole line.

              The plain half is split per word rather than set as a single Text.
              A gradient word has to be its own element (it is a masked view, and
              a mask cannot live inside a Text), which makes the heading a
              wrapping row — and in a wrapping row a multi-word Text is one
              unbreakable item, so the line breaks land wherever that item ends
              instead of between words. One item per word lets the row wrap the
              way the design's `<h1>` does. */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              columnGap: 9,
              marginBottom: 10,
            }}
          >
            {slide.titleA.split(' ').map((word, i) => (
              <Text
                key={`${word}-${i}`}
                style={[heading(29, '800'), { color: COLOR.ink800, lineHeight: 38 }]}
              >
                {word}
              </Text>
            ))}
            {/* The gradient half is split per word for the same reason. Each
                word gets its own ramp rather than one continuous run across the
                phrase — the design's rule is a gradient *word*, and a correct
                line break is worth more than a shared ramp across two of them. */}
            {slide.titleB.split(' ').map((word, i) => (
              <GradientWord key={`${word}-${i}`} style={heading(29, '800', { lineHeight: 38 })}>
                {word}
              </GradientWord>
            ))}
          </View>

          <Text style={[body(14), { color: '#5B6472', lineHeight: 22, maxWidth: '92%' }]}>
            {slide.body}
          </Text>
        </View>
      </View>

      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === step ? COLOR.violet500 : GREY.dot,
              }}
            />
          ))}
        </View>

        {isLast ? (
          <View style={{ gap: 8 }}>
            <Button label={t.startFree} fullWidth onPress={done} />
            <Text style={[body(11.5), { color: GREY.label, textAlign: 'center', lineHeight: 17 }]}>
              {t.freeCredits}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            <Button label={t.next} fullWidth onPress={() => setStep((s) => s + 1)} />
            <Pressable onPress={done} style={{ padding: 11 }}>
              <Text style={[heading(13, '700'), { color: '#8A94A2', textAlign: 'center' }]}>
                {t.skip}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
