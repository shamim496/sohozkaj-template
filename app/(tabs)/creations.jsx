import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AppHeader from '../../src/components/AppHeader';
import TemplateMasonry from '../../src/components/TemplateMasonry';
import { TemplateCard } from '../../src/components/TemplateGrid';
import { Caption, EmptyState, ErrorState, Loading, Screen } from '../../src/components/ui';
import { COLOR } from '../../src/constants/theme';
import { useLangStore, useT } from '../../src/i18n';
import { templateTitle } from '../../src/lib/format';
import { templateIdOf, useCreationsStore } from '../../src/store/creationsStore';
import { useOfficeSpaceStore } from '../../src/store/officeSpaceStore';
import { useTemplatesStore } from '../../src/store/templatesStore';

/**
 * Every image this account has generated from a template.
 *
 * Each tile is the *result*, but it carries its template's name — a wall of
 * portraits with no captions is unreadable, and the template is the only thing
 * that distinguishes two photos of the same face. The template is resolved
 * against the catalogue rather than stored on the row: history returns
 * `aiTemplateId`, not the name.
 */
export default function Creations() {
  const { t, num } = useT();
  const lang = useLangStore((s) => s.lang);

  const items = useCreationsStore((s) => s.items);
  const status = useCreationsStore((s) => s.status);
  const error = useCreationsStore((s) => s.error);
  const refresh = useCreationsStore((s) => s.refresh);
  const loadMore = useCreationsStore((s) => s.loadMore);
  const hasMore = useCreationsStore((s) => s.hasMore);

  const officeSpaceId = useOfficeSpaceStore((s) => s.selected?.id ?? null);
  const byId = useTemplatesStore((s) => s.byId);

  const [refreshing, setRefreshing] = useState(false);

  // A generate that happened on the template screen has already been prepended
  // locally; this re-reads the page so a result made on the web (or on another
  // device) shows up too.
  useFocusEffect(
    useCallback(() => {
      refresh(officeSpaceId);
    }, [refresh, officeSpaceId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh(officeSpaceId);
    setRefreshing(false);
  };

  if (status === 'loading') {
    return (
      <Screen>
        <AppHeader title={t.hCreations} />
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title={t.hCreations} />

      {status === 'error' && !items.length ? (
        <ErrorState
          message={error || t.loadFailed}
          retryLabel={t.retry}
          onRetry={() => refresh(officeSpaceId)}
        />
      ) : (
        <TemplateMasonry
          items={items}
          header={
            items.length ? (
              <Caption style={{ marginBottom: 12 }}>{t.imageCount(num(items.length))}</Caption>
            ) : null
          }
          renderCard={(item) => {
            const template = byId(templateIdOf(item));
            return (
              <TemplateCard
                title={template ? templateTitle(template, lang) : item.fileName || ''}
                thumbnail={item.aiImage}
                imageSize={template?.imageSize}
                onPress={() => router.push(`/result/${item.id}`)}
              />
            );
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR.orange500} />
          }
          // The list owns "am I near the end" now, so the hand-rolled scroll
          // maths is gone — and unlike `onMomentumScrollEnd` it also fires on a
          // slow drag that never builds momentum.
          onEndReached={() => {
            if (hasMore) loadMore(officeSpaceId);
          }}
          ListEmptyComponent={
            <EmptyState
              title={t.emptyCreationsTitle}
              message={t.emptyCreationsBody}
              action={t.browseTemplates}
              onAction={() => router.replace('/(tabs)')}
            />
          }
        />
      )}
    </Screen>
  );
}
