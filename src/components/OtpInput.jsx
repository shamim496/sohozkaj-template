import { useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SK, heading } from '../constants/theme';

/**
 * The website's six-digit code row: 40×48 boxes, a 2px border that turns orange
 * as each one fills, centred under the shield.
 *
 * Drawn from **one** `TextInput` stretched invisibly across the row rather than
 * six of them. Six is what the web page does, and on the web it is right —
 * there is a real keyboard and a focus model to go with it. On a phone it means
 * a ref per box, a focus hop per keystroke, a backspace-on-empty dance, and
 * Android's SMS autofill still only filling the first box. With a single field
 * the OS drops all six in at once (`autoComplete="sms-otp"`, iOS
 * `oneTimeCode`), and paste works without a handler.
 */
export default function OtpInput({ value, onChangeText, length = 6, autoFocus = false, onFilled }) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);

  const set = (raw) => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, length);
    onChangeText(digits);
    if (digits.length === length) onFilled?.(digits);
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={{ position: 'relative' }}>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {Array.from({ length }).map((_, i) => {
          const char = value[i] ?? '';
          // The box the next digit lands in is the one that reads as active —
          // including the last one when the code is full.
          const next =
            focused && (i === value.length || (i === length - 1 && value.length === length));
          return (
            <View
              key={i}
              style={{
                width: 42,
                height: 50,
                borderRadius: SK.radius,
                borderWidth: 2,
                borderColor: next ? SK.orange : char ? SK.orangeSoft : SK.border,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[heading(19, '700'), { color: SK.ink }]}>{char}</Text>
            </View>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={set}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          // Not `opacity: 0` — Android drops the hit area of a fully
          // transparent input, and the row would stop opening the keyboard.
          opacity: 0.01,
          color: 'transparent',
          fontSize: 20,
        }}
      />
    </Pressable>
  );
}
