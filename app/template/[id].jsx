import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import AppHeader from '../../src/components/AppHeader';
import FieldInputs, {
  defaultFieldValues,
  parseFields,
  validateFields,
} from '../../src/components/FieldInputs';
import PhotoSourceSheet from '../../src/components/PhotoSourceSheet';
import ProcessingOverlay from '../../src/components/ProcessingOverlay';
import ResultView from '../../src/components/ResultView';
import { TemplateCard } from '../../src/components/TemplateGrid';
import { toast } from '../../src/components/Toast';
import { Button, Caption, ErrorState, Heart, Loading, Screen } from '../../src/components/ui';
import { COLOR, GREY, LAYOUT, RADIUS, SHADOW, body, heading } from '../../src/constants/theme';
import { useLangStore, useT } from '../../src/i18n';
import { toUploadFile } from '../../src/lib/files';
import { generationName, humanSize, templateTitle } from '../../src/lib/format';
import { optimizeForUpload } from '../../src/lib/image';
import aiTemplateService from '../../src/services/aiTemplateService';
import { useAuthStore } from '../../src/store/authStore';
import { asTemplateImageRef, useCreationsStore } from '../../src/store/creationsStore';
import { costFor, useCreditStore } from '../../src/store/creditStore';
import { useFavouritesStore } from '../../src/store/favouritesStore';
import { officeSpaceLabel, useOfficeSpaceStore } from '../../src/store/officeSpaceStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { photoInputsOf, useTemplatesStore } from '../../src/store/templatesStore';

/**
 * One template, start to finish: pick photos → generate → result.
 *
 * The design draws these as three screens; they are one route with a `stage`,
 * because the photos the user picked are what the before/after slider compares
 * against and a real navigation would throw them away. Back from a result
 * therefore returns to the filled-in form, ready to generate again.
 *
 * A photo is treated as low-resolution under 900px on its long edge — the
 * design's "quality warning" slot, honestly wired. Blur cannot be measured
 * without reading pixels; size can, and it is the failure the model actually
 * suffers from, since it re-encodes to 1536px and has nothing to work with
 * below that.
 */
const MIN_LONG_EDGE = 900;

export default function TemplateScreen() {
  const { id } = useLocalSearchParams();
  const { t, num } = useT();
  const lang = useLangStore((s) => s.lang);

  const cached = useTemplatesStore((s) => s.byId(id));
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const selectedOfficeSpace = useOfficeSpaceStore((s) => s.selected);
  const costs = useCreditStore((s) => s.costs);
  const balance = useCreditStore((s) => s.balance);
  const refreshCredits = useCreditStore((s) => s.refresh);
  const spend = useCreditStore((s) => s.spend);
  const prependCreation = useCreationsStore((s) => s.prepend);
  const keepOriginal = useSettingsStore((s) => s.keepOriginal);
  const warnBlurry = useSettingsStore((s) => s.warnBlurry);

  const favourites = useFavouritesStore((s) => s.ids);
  const toggleFavourite = useFavouritesStore((s) => s.toggle);
  const isFavourite = favourites.includes(Number(id));

  const [template, setTemplate] = useState(cached);
  const [status, setStatus] = useState(cached ? 'ready' : 'loading');
  const [error, setError] = useState('');

  const [photos, setPhotos] = useState([]); // index 0 is the primary `image`
  const [values, setValues] = useState({});
  const [sizeAcknowledged, setSizeAcknowledged] = useState(false);

  const [stage, setStage] = useState('form'); // form | generating | result
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const [sheetSlot, setSheetSlot] = useState(null);

  const progressTimer = useRef(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  // The catalogue has the row already, but not `fieldDefs` — the list endpoint
  // does not include them and the detail endpoint does. So the cached copy
  // paints the screen immediately and this fills in the form behind it.
  useEffect(() => {
    let cancelled = false;
    aiTemplateService
      .get(id)
      .then((res) => {
        if (cancelled) return;
        setTemplate(res?.data || null);
        setStatus('ready');
      })
      .catch((err) => {
        // A cached row is enough to keep the screen usable — it only lacks the
        // field definitions — so a failed detail fetch is not an error state
        // when the catalogue already has this template.
        if (cancelled || useTemplatesStore.getState().byId(id)) return;
        setError(err.message || t.templateGone);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id, t.templateGone]);

  const fields = useMemo(() => parseFields(template?.fields), [template]);
  useEffect(() => setValues(defaultFieldValues(fields)), [fields]);

  const inputs = useMemo(() => photoInputsOf(template), [template]);

  // ── Progress theatre ──────────────────────────────────────────────────────
  // A generate takes 20–90s and the endpoint reports nothing until it returns.
  // A bar that creeps toward 99 is the honest version of "working": it never
  // claims to be finished, and it tells the user the app is alive.
  useEffect(() => {
    if (stage !== 'generating') {
      clearInterval(progressTimer.current);
      return undefined;
    }
    setProgress(0);
    progressTimer.current = setInterval(
      () => setProgress((p) => (p >= 99 ? 99 : Math.min(p + 0.6, 99))),
      140
    );
    return () => clearInterval(progressTimer.current);
  }, [stage]);

  useEffect(() => () => clearInterval(progressTimer.current), []);

  // ── Photos ────────────────────────────────────────────────────────────────
  const setPhotoAt = useCallback((index, asset) => {
    setSizeAcknowledged(false);
    setPhotos((prev) => {
      const next = [...prev];
      if (asset) next[index] = asset;
      else next.splice(index, 1);
      // Slots fill left to right; a hole would silently shift every later photo
      // onto the wrong `image_N` field.
      return next.filter(Boolean);
    });
  }, []);

  const tooSmall = photos.some(
    (p) => p.width && p.height && Math.max(p.width, p.height) < MIN_LONG_EDGE
  );
  const showSizeWarning = warnBlurry && tooSmall && !sizeAcknowledged;

  // ── Generate ──────────────────────────────────────────────────────────────
  const cost = template?.isFree ? 0 : costFor(costs, 'AI_TEMPLATE');
  const fieldsValid = validateFields(fields, values);
  const enoughPhotos = photos.length >= inputs.requiredCount;
  const notEnoughCredits = cost != null && balance != null && balance < cost;
  const canGenerate =
    stage !== 'generating' &&
    fieldsValid &&
    enoughPhotos &&
    !showSizeWarning &&
    (isAdmin || !!selectedOfficeSpace);

  const generate = async () => {
    if (!template || stage === 'generating') return;
    if (!isAdmin && !selectedOfficeSpace) return toast.error(t.needShop);
    if (!enoughPhotos) return toast.error(t.addPhotoFirst(inputs.requiredCount));
    if (!fieldsValid) return toast.error(t.fillRequired);

    setStage('generating');
    setResult(null);
    try {
      const optimised = [];
      for (const photo of photos) optimised.push(await optimizeForUpload(photo));

      const form = new FormData();
      optimised.forEach((photo, i) => {
        // Field naming is fixed by the backend: `image`, then `image_2`, `image_3`…
        form.append(i === 0 ? 'image' : `image_${i + 1}`, toUploadFile(photo));
      });
      if (selectedOfficeSpace?.id) form.append('officeSpaceId', String(selectedOfficeSpace.id));
      form.append('displayName', generationName(officeSpaceLabel(selectedOfficeSpace)));
      // Each dynamic field is sent as its own part, keyed by the prompt token.
      Object.entries(values).forEach(([key, value]) => form.append(key, String(value ?? '')));

      const response = await aiTemplateService.generate(template.id, form);
      const data = response?.data;
      if (!data?.aiImage) throw new Error(t.genFailed);

      setProgress(100);
      const record = {
        ...data,
        id: asTemplateImageRef(data.id),
        aiTemplateId: template.id,
        aiTemplateGeneration: true,
        fileName: data.fileName || templateTitle(template, lang),
        timestamp: data.timestamp || new Date().toISOString(),
      };
      setResult(record);
      setStage('result');
      prependCreation(record);
      toast.success(t.ready);

      // The balance moved on the server; drop it locally at once so the header
      // is right before the refresh lands, then reconcile with the truth.
      if (cost) spend(cost);
      refreshCredits();
    } catch (err) {
      setStage('form');
      toast.error(err.code === 'INSUFFICIENT_CREDITS' ? t.lowCreditToast : err.message || t.genFailed);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <Screen>
        <AppHeader title="" showBack />
        <Loading />
      </Screen>
    );
  }

  if (status === 'error' || !template) {
    return (
      <Screen>
        <AppHeader title="" showBack />
        <ErrorState message={error || t.templateGone} />
      </Screen>
    );
  }

  const title = templateTitle(template, lang);

  if (stage === 'result' && result) {
    return (
      <ResultView
        title={title}
        template={template}
        result={result}
        beforeUri={photos[0]?.uri}
        onRegenerate={generate}
        onBack={() => setStage('form')}
        keepOriginal={keepOriginal}
      />
    );
  }

  if (stage === 'generating') {
    return (
      <Screen>
        <AppHeader title={title} />
        <View
          style={{
            flex: 1,
            backgroundColor: COLOR.white,
            paddingHorizontal: 22,
            justifyContent: 'center',
            gap: 20,
          }}
        >
          <View style={{ borderRadius: RADIUS['3xl'], overflow: 'hidden' }}>
            <TemplateCard title={title} thumbnail={template.thumbnail} imageSize={template.imageSize} />
            <ProcessingOverlay label={t.generating} sublabel={t.genEta} progress={progress} />
          </View>
          <Text style={[body(12), { color: GREY.label, textAlign: 'center', lineHeight: 18 }]}>
            {t.genFoot}
          </Text>
        </View>
      </Screen>
    );
  }

  const slotLabel = (index) => {
    const defined = inputs.slots[index]?.label;
    if (defined) return defined;
    if (inputs.slots.length === 1) return t.slotOne;
    if (index === 0) return t.slotA;
    if (index === 1) return t.slotB;
    return t.slotN(num(index + 1));
  };

  // Show the defined slots, plus one empty slot to grow into on a multi-image
  // template — never past the ten files the backend's multipart config accepts.
  const renderSlots = Math.min(
    inputs.maxImages,
    Math.max(inputs.slots.length, photos.length + 1)
  );

  return (
    <Screen>
      <AppHeader title={title} showBack />

      <ScrollView
        contentContainerStyle={{
          padding: LAYOUT.screenPadding,
          paddingBottom: LAYOUT.scrollBottom,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: COLOR.white,
            borderRadius: 20,
            overflow: 'hidden',
            ...SHADOW.raised,
          }}
        >
          {/* The example output, so the user knows what they are buying. */}
          <TemplateCard title={title} thumbnail={template.thumbnail} imageSize={template.imageSize} />

          <View style={{ padding: 16, gap: 12 }}>
            {inputs.requiresPhoto ? (
              <View style={{ gap: 8 }}>
                {Array.from({ length: renderSlots }).map((_, index) => {
                  const photo = photos[index];
                  const disabled = index > photos.length;
                  const required = inputs.slots[index]?.required ?? index === 0;
                  return (
                    <Pressable
                      key={index}
                      // Slots fill left to right because the backend matches
                      // photos to `image_N` by position. Tapping slot 3 first
                      // would land the photo in slot 1 anyway — greying the gap
                      // out says so up front.
                      onPress={disabled ? undefined : () => setSheetSlot(index)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        padding: 10,
                        borderRadius: RADIUS.xl,
                        opacity: disabled ? 0.4 : 1,
                        backgroundColor: photo ? '#FAFBFC' : COLOR.white,
                        borderWidth: 1,
                        borderStyle: photo ? 'solid' : 'dashed',
                        borderColor: photo ? GREY.hairline : GREY.dashed,
                      }}
                    >
                      <View
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: RADIUS.md,
                          overflow: 'hidden',
                          backgroundColor: COLOR.thumb,
                        }}
                      >
                        {photo ? (
                          <Image
                            source={{ uri: photo.uri }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                        ) : null}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[heading(13.5, '700'), { color: COLOR.ink800 }]} numberOfLines={1}>
                          {slotLabel(index)}
                          {!required ? (
                            <Text style={[body(11.5), { color: GREY.label }]}> · {t.optional}</Text>
                          ) : null}
                        </Text>
                        <Text style={[body(11.5), { color: GREY.label, marginTop: 3 }]} numberOfLines={1}>
                          {photo
                            ? [photo.name, humanSize(photo.size)].filter(Boolean).join(' · ')
                            : t.slotEmpty}
                        </Text>
                      </View>

                      <Text style={[heading(12.5, '700'), { color: COLOR.violet500 }]}>
                        {photo ? t.change : t.add}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={[body(12.5), { color: GREY.label, lineHeight: 19 }]}>
                {t.noPhotoNeeded}
              </Text>
            )}

            {showSizeWarning ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: '#FFF6E8',
                  borderWidth: 1,
                  borderColor: 'rgba(255,153,0,.3)',
                  borderRadius: RADIUS.lg,
                  paddingVertical: 11,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={[body(12), { flex: 1, color: '#8A5A00', lineHeight: 18 }]}>
                  {t.warnBody}
                </Text>
                <Pressable onPress={() => setSizeAcknowledged(true)} hitSlop={8}>
                  <Text style={[heading(12, '700'), { color: COLOR.orangeBurnt }]}>
                    {t.continueAnyway}
                  </Text>
                </Pressable>
              </View>
            ) : photos.length && !tooSmall ? (
              <Text style={[body(12, '600'), { color: COLOR.greenInk }]}>{t.qualityOk}</Text>
            ) : null}

            {fields.length ? (
              <View style={{ gap: 10, marginTop: 2 }}>
                <Text style={[heading(13, '700'), { color: COLOR.ink800 }]}>{t.details}</Text>
                <FieldInputs
                  fields={fields}
                  values={values}
                  onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
                />
              </View>
            ) : null}

            <Button
              label={cost == null ? t.generate : cost === 0 ? t.generateFree : t.generateCost(num(cost))}
              fullWidth
              disabled={!canGenerate}
              onPress={generate}
            />

            {notEnoughCredits ? (
              <Pressable onPress={() => router.push('/credits')}>
                <Text style={[body(12, '700'), { color: COLOR.redDanger }]}>{t.lowCredit}</Text>
              </Pressable>
            ) : null}

            {!isAdmin && !selectedOfficeSpace ? (
              <Text style={[body(12), { color: COLOR.amberInk, lineHeight: 18 }]}>{t.needShop}</Text>
            ) : null}
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 14,
            paddingHorizontal: 2,
          }}
        >
          <Caption style={{ flex: 1, lineHeight: 18 }}>{t.noPromptBody}</Caption>
          <Pressable
            onPress={() => toggleFavourite(template.id)}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: COLOR.white,
              borderWidth: 1,
              borderColor: isFavourite ? 'rgba(250,16,20,.28)' : GREY.border,
            }}
          >
            <Heart filled={isFavourite} />
          </Pressable>
        </View>
      </ScrollView>

      <PhotoSourceSheet
        open={sheetSlot != null}
        onClose={() => setSheetSlot(null)}
        recent={photos}
        onPicked={(asset) => {
          setPhotoAt(sheetSlot, asset);
          setSheetSlot(null);
        }}
      />
    </Screen>
  );
}
