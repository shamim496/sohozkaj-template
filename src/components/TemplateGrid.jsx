import { memo, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLOR, GREY, RADIUS, SHADOW, body, heading, ratioFor } from '../constants/theme';

/**
 * A template tile, and the column-balanced grid it lives in.
 *
 * Ported from `components/media/TemplateCard.jsx` + `TemplateGrid.jsx`. The
 * design's two load-bearing rules are both here:
 *
 *  - **Aspect ratio comes from the template, not the grid.** A 9/16 jersey and
 *    a 1/1 DP sit side by side at their real shapes, which is why this is a
 *    two-column masonry rather than a `FlatList` with `numColumns`.
 *  - **The scrim is fixed.** Black→transparent over the bottom 45%, white 12px
 *    title on it. It is what makes a title legible on a photo whose bottom edge
 *    could be anything.
 */

/**
 * Memoised because a recycled list re-renders its rows constantly, and a card
 * whose props have not changed has nothing to redo — without this, appending to
 * the gallery re-rendered every card already on screen.
 */
export const TemplateCard = memo(function TemplateCard({
  title,
  thumbnail,
  imageSize,
  badge,
  onPress,
  footer,
}) {
  // A thumbnail can be absent (an admin published without one) or present and
  // unreachable (a stale R2 key). Both land on the design system's own empty
  // state rather than an unexplained grey rectangle with a caption floating in
  // it — `onError` is what catches the second case, which no null check can.
  const [failed, setFailed] = useState(false);
  const showImage = !!thumbnail && !failed;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <View
        style={{
          borderRadius: RADIUS['2xl'],
          overflow: 'hidden',
          backgroundColor: COLOR.thumb,
          aspectRatio: ratioFor(imageSize),
          ...SHADOW.card,
        }}
      >
        {showImage ? (
          <Image
            source={{ uri: thumbnail }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[body(12), { color: COLOR.ink400 }]}>ছবি নেই</Text>
          </View>
        )}

        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              backgroundColor: 'rgba(255,255,255,.92)',
              borderRadius: RADIUS.pill,
              paddingVertical: 3,
              paddingHorizontal: 10,
            }}
          >
            <Text style={[heading(11, '600'), { color: COLOR.redInk }]}>{badge}</Text>
          </View>
        ) : null}

        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,.78)']}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            minHeight: '45%',
            justifyContent: 'flex-end',
            padding: 12,
          }}
        >
          <Text numberOfLines={2} style={[heading(12, '600'), { color: COLOR.white, lineHeight: 16 }]}>
            {title}
          </Text>
          {footer}
        </LinearGradient>
      </View>
    </Pressable>
  );
});

/**
 * Column-balanced masonry in a plain View: items are dealt round-robin into
 * `columns` columns, exactly as the design system's grid does.
 *
 * For BOUNDED lists only — the picker sheet, and any short list. It mounts every
 * item it is given, so the catalogue and the creations feed use
 * `TemplateMasonry` (FlashList) instead; see the note there for the numbers.
 * This one stays because a virtualised list cannot nest inside the scrolling
 * bottom sheet the picker lives in.
 */
export default function TemplateGrid({ items = [], columns = 2, gap = 12, renderItem }) {
  const cols = useMemo(() => {
    const out = Array.from({ length: columns }, () => []);
    items.forEach((item, i) => out[i % columns].push(item));
    return out;
  }, [items, columns]);

  return (
    <View style={{ flexDirection: 'row', gap, alignItems: 'flex-start' }}>
      {cols.map((colItems, i) => (
        <View key={i} style={{ flex: 1, gap }}>
          {colItems.map(renderItem)}
        </View>
      ))}
    </View>
  );
}

export const GRID_PLACEHOLDER = GREY.fill;
