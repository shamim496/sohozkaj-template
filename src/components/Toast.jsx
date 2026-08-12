import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { COLOR, RADIUS, body } from '../constants/theme';

/**
 * One-line feedback, called imperatively from anywhere.
 *
 * A store rather than a context so `toast.error(...)` works inside a service
 * callback or a `catch` block that has no access to hooks — which is most of the
 * places this app needs to report a failed generate.
 *
 * The design's toast is a single dark pill floating above the tab bar; it does
 * not carry an icon or a tone colour. Errors are distinguished by staying a
 * beat longer, not by turning red — a red banner over a photo the user is
 * looking at is louder than the failure usually warrants.
 */

let nextId = 1;

const useToastStore = create((set) => ({
  items: [],
  push: (item) => {
    const id = nextId++;
    set((state) => ({ items: [...state.items, { ...item, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((t) => t.id !== id) })),
}));

const show = (type, message, options = {}) =>
  useToastStore.getState().push({ type, message: String(message ?? ''), ...options });

export const toast = {
  success: (message, options) => show('success', message, options),
  error: (message, options) => show('error', message, { duration: 4200, ...options }),
  info: (message, options) => show('info', message, options),
  dismiss: (id) => useToastStore.getState().dismiss(id),
};

function ToastItem({ item }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), item.duration ?? 2600);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, dismiss]);

  return (
    <Pressable
      onPress={() => dismiss(item.id)}
      style={{
        marginTop: 8,
        maxWidth: '92%',
        backgroundColor: 'rgba(17,17,17,.92)',
        borderRadius: RADIUS.pill,
        paddingVertical: 10,
        paddingHorizontal: 18,
        // Elevation keeps it above screen content on Android, where z-index
        // alone is not enough for an absolutely positioned sibling.
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      <Text style={[body(12.5, '600'), { color: COLOR.white, textAlign: 'center' }]}>
        {item.message}
      </Text>
    </Pressable>
  );
}

/** Mounted once, in the root layout, above the navigator. */
export function Toaster() {
  const items = useToastStore((s) => s.items);
  const insets = useSafeAreaInsets();

  if (!items.length) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        // Clear of the 68px tab bar, which is where the design floats it.
        bottom: insets.bottom + 96,
        alignItems: 'center',
        zIndex: 999,
      }}
    >
      {items.map((item) => (
        <ToastItem key={item.id} item={item} />
      ))}
    </View>
  );
}
