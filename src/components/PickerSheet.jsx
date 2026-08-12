import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import BottomSheet from './BottomSheet';
import { SearchInput } from './ui';
import { COLOR, GREY, RADIUS, body } from '../constants/theme';
import { useT } from '../i18n';

/**
 * Pick one row out of a long list — today the sign-up country list.
 *
 * The sheet's body is a plain `ScrollView` (a virtualised list cannot nest
 * inside one), so the matches are **capped** rather than all mounted: 245
 * countries of `Pressable` is a visible pause on the phones this app is for.
 * The cap is stated in the list instead of silently truncating it — the search
 * box above is how you reach the rest.
 *
 * `items` are `{ key, label, hint }`. Search matches the label, the hint and the
 * key, so a country is found by name, by dial code, or by typing "bd".
 */

const MAX_ROWS = 50;

export default function PickerSheet({
  open,
  title,
  searchPlaceholder,
  items,
  value,
  onSelect,
  onClose,
}) {
  const { t, num } = useT();
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.key.toLowerCase().startsWith(q) ||
        (item.hint || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  const shown = matches.slice(0, MAX_ROWS);
  const hidden = matches.length - shown.length;

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet open={open} title={title} onClose={close} height={0.72}>
      <View style={{ paddingHorizontal: 6, gap: 10 }}>
        <SearchInput value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />

        {shown.map((item) => {
          const active = item.key === value;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                onSelect(item.key);
                close();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: RADIUS.xl,
                borderWidth: 1,
                borderColor: active ? 'rgba(152,16,250,.28)' : GREY.hairline,
                backgroundColor: active ? COLOR.violet050 : COLOR.white,
              }}
            >
              <Text
                style={[body(13.5, '600'), { flex: 1, color: active ? COLOR.violet500 : COLOR.ink800 }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {item.hint ? (
                <Text style={[body(12.5), { color: GREY.label }]}>{item.hint}</Text>
              ) : null}
            </Pressable>
          );
        })}

        {!matches.length ? (
          <Text style={[body(12.5), { color: GREY.label, textAlign: 'center', padding: 18 }]}>
            {t.emptySearch(query.trim())}
          </Text>
        ) : null}

        {hidden > 0 ? (
          <Text style={[body(11.5), { color: GREY.label, textAlign: 'center', paddingVertical: 10 }]}>
            {t.moreToSearch(num(hidden))}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
