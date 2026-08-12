import { FlashList } from '@shopify/flash-list';
import { View } from 'react-native';
import { LAYOUT } from '../constants/theme';

/**
 * The virtualised two-column masonry the long galleries scroll.
 *
 * `TemplateGrid` deals items into columns inside a plain ScrollView, which is
 * fine for a bounded list (the picker sheet) and ruinous for the catalogue:
 * with ~600 templates every card stayed mounted, each one an `expo-image`
 * decoding a full-size thumbnail. Measured on the emulator while scrolling the
 * hub: **54% janky frames**, a 300ms 90th-percentile frame, 17 missed vsyncs.
 * Capping how many were mounted did not fix it either — appending to the slice
 * re-rendered every card already on screen.
 *
 * FlashList's masonry mode is the fix that actually addresses it: offscreen rows
 * are unmounted and their views recycled, so the mounted set stays proportional
 * to the screen rather than to the catalogue.
 *
 * The design's rule that each card keeps its own template's aspect ratio is why
 * this is `masonry` rather than a plain `numColumns` list — `numColumns` alone
 * forces one height per row.
 */
export default function TemplateMasonry({
  items,
  renderCard,
  header,
  gap = 12,
  refreshControl,
  onEndReached,
  ListEmptyComponent,
  ListFooterComponent,
}) {
  return (
    <FlashList
      data={items}
      numColumns={2}
      masonry
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item, index }) => (
        // FlashList has no gap prop, so the gutter is per-item padding. Half a
        // gap on each inner edge adds up to one full gap between the columns
        // while the outer edges stay flush with the screen padding.
        <View
          style={{
            paddingLeft: index % 2 === 0 ? 0 : gap / 2,
            paddingRight: index % 2 === 0 ? gap / 2 : 0,
            paddingBottom: gap,
          }}
        >
          {renderCard(item)}
        </View>
      )}
      // A stable element type: React reconciles it by type, so a keystroke in
      // the header's search box re-renders it instead of remounting it and
      // stealing the keyboard focus mid-word.
      ListHeaderComponent={header}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      refreshControl={refreshControl}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: LAYOUT.screenPadding,
        paddingBottom: LAYOUT.scrollBottom,
      }}
    />
  );
}
