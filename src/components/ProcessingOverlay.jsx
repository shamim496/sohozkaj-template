import { ActivityIndicator, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLOR, GRADIENT, GREY, RADIUS, body, heading } from '../constants/theme';

/**
 * The white veil over a template card while its image is generating.
 *
 * Ported from `components/feedback/ProcessingOverlay.jsx` — white at 88% with a
 * blur behind it. The blur is dropped: RN's only blur is `expo-blur`, which on
 * Android renders as a flat overlay anyway, so it would cost a dependency to
 * change nothing. 88% white over a photo already reads as "held".
 *
 * `progress` is deliberately optimistic-but-honest. The generate endpoint
 * reports nothing until it returns, so the caller creeps this toward 99 and
 * never claims completion — see the comment in `app/template/[id].jsx`.
 */
export default function ProcessingOverlay({ label, sublabel, progress }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
        backgroundColor: 'rgba(255,255,255,.88)',
      }}
    >
      <ActivityIndicator size="large" color={COLOR.orange500} />

      <Text style={[heading(16, '700'), { color: COLOR.black, textAlign: 'center' }]}>{label}</Text>

      {sublabel ? (
        <Text style={[body(13), { color: GREY.label, textAlign: 'center' }]}>{sublabel}</Text>
      ) : null}

      {progress != null ? (
        <View
          style={{
            width: 200,
            height: 6,
            borderRadius: RADIUS.pill,
            backgroundColor: COLOR.orange100,
            overflow: 'hidden',
          }}
        >
          <LinearGradient
            colors={GRADIENT.brand.colors}
            start={GRADIENT.brand.start}
            end={GRADIENT.brand.end}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%`, height: '100%' }}
          />
        </View>
      ) : null}
    </View>
  );
}
