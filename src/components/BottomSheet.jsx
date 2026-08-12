import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { COLOR, RADIUS, SHADOW, heading } from '../constants/theme';

/**
 * The bottom sheet every picker in this app uses.
 *
 * Ported from `components/feedback/BottomSheet.jsx`: 18px top corners, a grab
 * handle, a violet-tinted header with a round close button, and the upward
 * shadow with a violet cast.
 *
 * `height` is a fraction of the screen, matching the design's percentage props
 * ("46%", "64%"). It is a *maximum*: the body scrolls inside it, so a sheet with
 * two rows does not render two rows and a void.
 */
export default function BottomSheet({ open, title, onClose, height = 0.6, children }) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(16,24,40,.45)' }]}
        />

        <View
          style={{
            backgroundColor: COLOR.white,
            borderTopLeftRadius: RADIUS.sheet,
            borderTopRightRadius: RADIUS.sheet,
            maxHeight: screenHeight * height + insets.bottom,
            ...SHADOW.sheet,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#D0D5DD',
              alignSelf: 'center',
              marginTop: 10,
              marginBottom: 6,
            }}
          />

          <LinearGradient
            colors={[COLOR.violet050, COLOR.white]}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingTop: 6,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#F0E8FF',
            }}
          >
            <Text style={[heading(16, '700'), { color: COLOR.black, flex: 1 }]} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: 'rgba(152,16,250,.22)',
                backgroundColor: COLOR.violet050,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6 6 18M6 6l12 12"
                  stroke={COLOR.violet500}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </LinearGradient>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 10,
              paddingTop: 10,
              paddingBottom: 20 + insets.bottom,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
