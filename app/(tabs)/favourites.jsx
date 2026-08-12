import { useMemo } from 'react';
import { router } from 'expo-router';
import AppHeader from '../../src/components/AppHeader';
import TemplateMasonry from '../../src/components/TemplateMasonry';
import { TemplateCard } from '../../src/components/TemplateGrid';
import { Caption, EmptyState, Screen } from '../../src/components/ui';
import { useLangStore, useT } from '../../src/i18n';
import { templateTitle } from '../../src/lib/format';
import { useFavouritesStore } from '../../src/store/favouritesStore';
import { useTemplatesStore } from '../../src/store/templatesStore';

/**
 * Hearted templates.
 *
 * Stored ids are resolved against the live catalogue on every render, so a
 * template unpublished upstream simply stops appearing — there is no stale copy
 * to go looking for. Order follows the favourites list (most recent first),
 * not the catalogue's.
 */
export default function Favourites() {
  const { t, num } = useT();
  const lang = useLangStore((s) => s.lang);

  const ids = useFavouritesStore((s) => s.ids);
  const items = useTemplatesStore((s) => s.items);

  const favourites = useMemo(
    () => ids.map((id) => items.find((x) => Number(x.id) === id)).filter(Boolean),
    [ids, items]
  );

  return (
    <Screen>
      <AppHeader title={t.hFavs} />

      <TemplateMasonry
        items={favourites}
        header={
          favourites.length ? (
            <Caption style={{ marginBottom: 12 }}>{t.savedCount(num(favourites.length))}</Caption>
          ) : null
        }
        renderCard={(item) => (
          <TemplateCard
            title={templateTitle(item, lang)}
            thumbnail={item.thumbnail}
            imageSize={item.imageSize}
            onPress={() => router.push(`/template/${item.id}`)}
          />
        )}
        ListEmptyComponent={<EmptyState title={t.emptyFavTitle} message={t.emptyFavBody} />}
      />
    </Screen>
  );
}
