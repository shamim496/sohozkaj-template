import { memo, useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import AppHeader from '../../src/components/AppHeader';
import TemplateMasonry from '../../src/components/TemplateMasonry';
import { TemplateCard } from '../../src/components/TemplateGrid';
import {
  Caption,
  ErrorState,
  Loading,
  Pill,
  Screen,
  ScreenTitle,
  SearchInput,
} from '../../src/components/ui';
import { COLOR, GREY, LAYOUT, body } from '../../src/constants/theme';
import { useLangStore, useT } from '../../src/i18n';
import { categoryLabel, templateTitle } from '../../src/lib/format';
import { select, useTemplatesStore } from '../../src/store/templatesStore';

/**
 * Everything above the grid: search, category pills, and the count row.
 *
 * Declared at module scope and memoised on purpose. FlashList reconciles
 * `ListHeaderComponent` by element type, so a header defined inline (or via
 * useCallback) gets a new type on every keystroke, remounts, and the search box
 * loses the keyboard mid-word. A stable type re-renders instead.
 */
const HubHeader = memo(function HubHeader({
  t,
  lang,
  num,
  query,
  setQuery,
  categories,
  category,
  setCategory,
  count,
}) {
  return (
    <View>
      <SearchInput value={query} onChangeText={setQuery} placeholder={t.searchPh} />

      {categories.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Negative margin + matching padding lets the row bleed to the screen
          // edges while the first and last pill stay inside the 16px gutter —
          // the design's overflow strip.
          style={{ marginHorizontal: -LAYOUT.screenPadding, marginTop: 14 }}
          contentContainerStyle={{
            gap: 8,
            paddingHorizontal: LAYOUT.screenPadding,
            paddingBottom: 2,
          }}
        >
          <Pill label={t.all} active={category === null} onPress={() => setCategory(null)} />
          {categories.map((c) => (
            <Pill
              key={c.slug}
              label={categoryLabel(c, lang)}
              active={category === c.slug}
              onPress={() => setCategory(c.slug)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginTop: 22,
          marginBottom: 12,
        }}
      >
        <ScreenTitle>
          {category ? categoryLabel(categories.find((c) => c.slug === category), lang) : t.popular}
        </ScreenTitle>
        <Caption>{num(count)}</Caption>
      </View>
    </View>
  );
});

/**
 * The template hub — search, category pills, and the masonry gallery.
 *
 * Filtering is local; see the note in `src/store/templatesStore.js` for why
 * (short version: the endpoint's own search is a JS filter over a full table
 * read, so a request per keystroke buys nothing).
 *
 * The whole filtered catalogue is handed to the list — no slicing, no paging.
 * FlashList only mounts what is on screen, so ~600 templates cost the same as
 * a dozen.
 */
export default function Hub() {
  const { t, num } = useT();
  const lang = useLangStore((s) => s.lang);

  const items = useTemplatesStore((s) => s.items);
  const categories = useTemplatesStore((s) => s.categories);
  const status = useTemplatesStore((s) => s.status);
  const error = useTemplatesStore((s) => s.error);
  const load = useTemplatesStore((s) => s.load);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null); // a slug, null = all
  const [refreshing, setRefreshing] = useState(false);

  const visible = useMemo(() => select(items, { category, query }), [items, category, query]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load({ force: true });
    setRefreshing(false);
  };

  const renderCard = useCallback(
    (item) => (
      <TemplateCard
        title={templateTitle(item, lang)}
        thumbnail={item.thumbnail}
        imageSize={item.imageSize}
        // The API resolves a numeric id or a slug; the id is the one the
        // generate endpoint takes, so route on it and skip a lookup on the way
        // back.
        onPress={() => router.push(`/template/${item.id}`)}
      />
    ),
    [lang]
  );

  if (status === 'loading') {
    return (
      <Screen>
        <AppHeader title={t.hHub} />
        <Loading />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <AppHeader title={t.hHub} />
        <ErrorState
          message={error || t.loadFailed}
          retryLabel={t.retry}
          onRetry={() => load({ force: true })}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title={t.hHub} />

      <TemplateMasonry
        items={visible}
        renderCard={renderCard}
        header={
          <HubHeader
            t={t}
            lang={lang}
            num={num}
            query={query}
            setQuery={setQuery}
            categories={categories}
            category={category}
            setCategory={setCategory}
            count={visible.length}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLOR.orange500}
          />
        }
        ListEmptyComponent={
          <Text style={[body(13), { textAlign: 'center', paddingVertical: 56, color: GREY.label }]}>
            {query.trim() ? t.emptySearch(query.trim()) : t.noTemplates}
          </Text>
        }
      />
    </Screen>
  );
}
