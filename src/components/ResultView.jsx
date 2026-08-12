import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import AppHeader from './AppHeader';
import BottomSheet from './BottomSheet';
import CompareSlider from './CompareSlider';
import TemplatePickerSheet from './TemplatePickerSheet';
import { toast } from './Toast';
import { Button, Caption, Chevron, Screen } from './ui';
import { COLOR, GREY, LAYOUT, RADIUS, SHADOW, body, heading, ratioFor } from '../constants/theme';
import { useT } from '../i18n';
import {
  downloadImage,
  ensureGalleryPermission,
  saveRemoteToGallery,
  shareFile,
} from '../lib/files';
import { templateTitle } from '../lib/format';
import imageGenerationService from '../services/imageGenerationService';
import { templateIdOf, useCreationsStore } from '../store/creationsStore';

/**
 * A finished image: save, share, compare, regenerate, report.
 *
 * Shared by the template screen (straight after a generate, where the source
 * photo is in hand so before/after works) and the creations tab (opening an
 * older result, where the source comes back from the history row).
 *
 * Two departures from the design, both deliberate:
 *
 *  - **The share sheet is the OS one.** The design draws a grid of app tiles —
 *    Facebook, WhatsApp, Messenger. Those tiles would have to either deep-link
 *    per app (which breaks the moment one is not installed) or open the system
 *    sheet anyway, in which case the grid is a picture of a choice the user does
 *    not actually get. `expo-sharing` shows the real list.
 *
 *  - **No variations strip, no watermark row.** The generate endpoint returns
 *    exactly one image per call, and there is no watermark or HD tier in the
 *    API. What sits in the strip's place is real: earlier results *this account*
 *    made from *this template*, which is browseable rather than decorative.
 */
export default function ResultView({
  title,
  template,
  result,
  beforeUri,
  onRegenerate,
  onBack,
  keepOriginal = false,
}) {
  const { t, num } = useT();
  const creations = useCreationsStore((s) => s.items);

  const [shown, setShown] = useState(result);
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => setShown(result), [result]);

  const afterUri = shown?.aiImage;
  // The row keeps the photo it was made from; on a fresh generate the local file
  // is better — it is already on disk and needs no round trip.
  const sourceUri = shown?.id === result?.id ? beforeUri || shown?.uploadedImage : shown?.uploadedImage;

  const earlier = useMemo(() => {
    if (!template) return [];
    return creations.filter(
      (item) =>
        templateIdOf(item) === Number(template.id) && String(item.id) !== String(shown?.id)
    );
  }, [creations, template, shown?.id]);

  const fileName = shown?.fileName || title || 'photo';

  const save = async () => {
    if (!afterUri || busy) return;
    setBusy(true);
    try {
      // Asked once per run, by the caller that is about to write — requesting
      // inside the save loop would stack prompts.
      if (!(await ensureGalleryPermission())) throw new Error(t.saveFailed);
      await saveRemoteToGallery(afterUri, fileName);
      toast.success(t.saved);
    } catch (error) {
      toast.error(error.message || t.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!afterUri || busy) return;
    setBusy(true);
    try {
      const file = await downloadImage(afterUri, fileName);
      const ok = await shareFile(file.uri, { dialogTitle: t.shareTitle });
      if (!ok) throw new Error(t.shareFailed);
    } catch (error) {
      toast.error(error.message || t.shareFailed);
    } finally {
      setBusy(false);
    }
  };

  // "Keep the original" is a local setting, so the save happens here rather than
  // server-side: as soon as a result lands, a copy goes to the phone gallery.
  useEffect(() => {
    if (!keepOriginal || !result?.aiImage) return;
    let cancelled = false;
    (async () => {
      try {
        if (!(await ensureGalleryPermission())) return;
        if (cancelled) return;
        await saveRemoteToGallery(result.aiImage, result.fileName || title || 'photo');
      } catch {
        // A silent auto-save that fails must stay silent — the user did not ask
        // for it in this moment, and the explicit Save button is right there.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [keepOriginal, result?.aiImage, result?.fileName, title]);

  /**
   * All four reasons send the same thing.
   *
   * `PATCH /api/image-generation/feedback/:id` takes `feedback: 'positive' |
   * 'negative'` and nothing else — there is no field for *why*. So the reason
   * the user picked is not transmitted, and the sheet's footer says only what
   * is true: the image is flagged for review. Adding a free-text reason means a
   * backend change, not a client one.
   */
  const report = async () => {
    setReportOpen(false);
    try {
      await imageGenerationService.submitFeedback(shown.id, 'negative');
      toast.success(t.reported);
    } catch (error) {
      toast.error(error.message || t.loadFailed);
    }
  };

  const Link = ({ label, active, onPress }) => (
    <Pressable onPress={onPress} hitSlop={6}>
      <Text style={[heading(12.5, '700'), { color: active ? COLOR.violet500 : GREY.label }]}>
        {label}
      </Text>
    </Pressable>
  );

  const ratio = ratioFor(template?.imageSize);

  return (
    <Screen>
      <AppHeader title={title} onBack={onBack || (() => router.back())} />

      <ScrollView
        contentContainerStyle={{
          padding: LAYOUT.screenPadding,
          paddingBottom: LAYOUT.scrollBottom,
        }}
      >
        <View style={{ borderRadius: RADIUS['3xl'], overflow: 'hidden', ...SHADOW.raised }}>
          {compare && sourceUri ? (
            <CompareSlider
              beforeUri={sourceUri}
              afterUri={afterUri}
              beforeLabel={t.before}
              ratio={ratio}
            />
          ) : (
            <Image
              source={{ uri: afterUri }}
              style={{ width: '100%', aspectRatio: ratio, backgroundColor: GREY.fill }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={180}
            />
          )}
        </View>

        <View style={{ gap: 8, marginTop: 18 }}>
          <Button label={t.save} fullWidth loading={busy} onPress={save} />
          <Button label={t.share} variant="ghost" fullWidth onPress={share} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 18,
            marginTop: 16,
            paddingHorizontal: 2,
          }}
        >
          {sourceUri ? (
            <Link
              label={compare ? t.compareOff : t.compareOn}
              active={compare}
              onPress={() => setCompare((v) => !v)}
            />
          ) : null}
          {onRegenerate ? <Link label={t.regenerate} onPress={onRegenerate} /> : null}
          <Link label={t.tryOther} onPress={() => setPickerOpen(true)} />
          <Link label={t.report} onPress={() => setReportOpen(true)} />
        </View>

        {earlier.length ? (
          <View style={{ marginTop: 26 }}>
            <Caption style={{ marginBottom: 10 }}>
              {t.earlierResults} · {num(earlier.length)}
            </Caption>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            >
              {earlier.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setCompare(false);
                    setShown(item);
                  }}
                  style={{
                    width: 78,
                    aspectRatio: 1,
                    borderRadius: RADIUS.lg,
                    overflow: 'hidden',
                    backgroundColor: GREY.fill,
                    borderWidth: 1,
                    borderColor: GREY.hairline,
                  }}
                >
                  <Image
                    source={{ uri: item.aiImage }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet
        open={reportOpen}
        title={t.reportTitle}
        onClose={() => setReportOpen(false)}
        height={0.46}
      >
        <View style={{ gap: 8, paddingHorizontal: 6 }}>
          {[t.r1, t.r2, t.r3, t.r4].map((reason) => (
            <Pressable
              key={reason}
              onPress={report}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: 13,
                borderWidth: 1,
                borderColor: GREY.hairline,
                borderRadius: RADIUS.xl,
                backgroundColor: COLOR.white,
              }}
            >
              <Text style={[body(13, '600'), { color: COLOR.ink700, flex: 1 }]}>{reason}</Text>
              <Chevron />
            </Pressable>
          ))}
          <Text style={[body(11.5), { color: GREY.label, margin: 6, lineHeight: 17 }]}>
            {t.reportFoot}
          </Text>
        </View>
      </BottomSheet>

      <TemplatePickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </Screen>
  );
}

/** Used by the creations tab, which has a row but not the template object. */
export const resultTitleFor = (template, record, lang) =>
  template ? templateTitle(template, lang) : record?.fileName || '';
