import { useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { COLOR, RADIUS, body } from '../constants/theme';

/**
 * Before/after wipe.
 *
 * The design draws this as a native `<input type=range>` under the image. A
 * slider you drag *away from* the thing it changes is fine with a mouse and
 * poor with a thumb, so here the whole image is the control: drag anywhere on it
 * and the seam follows. The seam itself is the design's 2px white rule.
 *
 * `PanResponder` rather than a gesture-handler `Pan`: this runs on the JS
 * thread, which is idle on this screen, and it avoids pulling a worklet into a
 * component whose only job is to move one edge.
 */
export default function CompareSlider({ beforeUri, afterUri, beforeLabel, ratio = 3 / 4 }) {
  const [width, setWidth] = useState(0);
  const [pct, setPct] = useState(55);
  const widthRef = useRef(0);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => update(event.nativeEvent.locationX),
      onPanResponderMove: (event) => update(event.nativeEvent.locationX),
    })
  ).current;

  function update(x) {
    const w = widthRef.current;
    if (!w) return;
    setPct(Math.max(0, Math.min(100, (x / w) * 100)));
  }

  return (
    <View
      {...responder.panHandlers}
      onLayout={(event) => {
        const w = event.nativeEvent.layout.width;
        widthRef.current = w;
        setWidth(w);
      }}
      style={{
        width: '100%',
        aspectRatio: ratio,
        borderRadius: RADIUS['3xl'],
        overflow: 'hidden',
        backgroundColor: '#EDEFF2',
      }}
    >
      <Image
        source={{ uri: afterUri }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      {/* The "before" pane is clipped to the seam. The inner image keeps the
          full container width so the two halves stay in register — sizing it to
          the clip would squash the photo as the seam moves. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: `${pct}%`,
          overflow: 'hidden',
          borderRightWidth: 2,
          borderRightColor: COLOR.white,
        }}
      >
        <Image
          source={{ uri: beforeUri }}
          style={{ width, height: '100%' }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
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
          <Text style={[body(11, '700'), { color: '#374151' }]}>{beforeLabel}</Text>
        </View>
      </View>
    </View>
  );
}
