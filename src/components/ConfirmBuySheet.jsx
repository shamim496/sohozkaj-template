import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import BottomSheet from './BottomSheet';
import { Button } from './ui';
import { COLOR, GREY, RADIUS, body, heading } from '../constants/theme';
import { useT } from '../i18n';

/**
 * The step between tapping কিনুন and a card form.
 *
 * Everything else in this app spends credits, which are refundable by asking.
 * This spends money, which is not — so the package, the credits it grants and
 * the exact figure that will be charged are restated once, and the button is
 * dead until the terms are ticked. That is the whole job.
 *
 * No coupon field, deliberately. The server increments a coupon's use count at
 * checkout *initiation* and never decrements it, so an abandoned payment burns
 * a limited code; and `BottomSheet` has no keyboard avoidance, so the input
 * would sit under the keyboard anyway. Packages carry their own discount.
 */
export default function ConfirmBuySheet({ open, pack, busy, onClose, onConfirm }) {
  const { t, num } = useT();
  const [agreed, setAgreed] = useState(false);

  // A fresh sheet must not inherit the last purchase's tick.
  useEffect(() => {
    if (open) setAgreed(false);
  }, [open]);

  const basePrice = pack?.basePrice ?? pack?.amount ?? pack?.credits ?? 0;
  const finalPrice = pack?.finalPrice ?? basePrice;
  const discounted = finalPrice < basePrice;

  const Line = ({ label, value, strong }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 11,
      }}
    >
      <Text style={[body(13), { color: COLOR.ink500 }]}>{label}</Text>
      <Text
        style={[
          strong ? heading(19, '800') : body(13.5, '600'),
          { color: COLOR.ink800, flexShrink: 1, textAlign: 'right' },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );

  return (
    <BottomSheet open={open} title={t.buyTitle} onClose={onClose} height={0.62}>
      <View style={{ paddingHorizontal: 8 }}>
        <Text style={[heading(16.5, '700'), { color: COLOR.ink800 }]} numberOfLines={2}>
          {pack?.name || ''}
        </Text>

        <View style={{ marginTop: 6 }}>
          <Line label={t.creditWord} value={num(pack?.credits ?? 0)} />
          <View style={{ height: 1, backgroundColor: COLOR.line100 }} />
          {discounted ? (
            <>
              <Line label={t.priceBefore} value={`৳${num(basePrice)}`} />
              <View style={{ height: 1, backgroundColor: COLOR.line100 }} />
              <Line label={t.discount} value={`− ৳${num(basePrice - finalPrice)}`} />
              <View style={{ height: 1, backgroundColor: COLOR.line100 }} />
            </>
          ) : null}
          <Line label={t.payable} value={`৳${num(finalPrice)}`} strong />
        </View>

        <Pressable
          onPress={() => setAgreed((v) => !v)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: 10,
            marginBottom: 14,
            padding: 12,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: agreed ? 'rgba(152,16,250,.28)' : GREY.border,
            backgroundColor: agreed ? COLOR.violet050 : COLOR.white,
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: RADIUS.xs,
              borderWidth: 1.5,
              borderColor: agreed ? COLOR.violet500 : GREY.dashed,
              backgroundColor: agreed ? COLOR.violet500 : COLOR.white,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {agreed ? (
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path
                  d="m5 13 4 4L19 7"
                  stroke={COLOR.white}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            ) : null}
          </View>
          <Text style={[body(12.5), { flex: 1, color: COLOR.ink600, lineHeight: 18 }]}>
            {t.payTerms}
          </Text>
        </Pressable>

        <Button
          label={t.payNow(num(finalPrice))}
          fullWidth
          loading={busy}
          disabled={!agreed}
          onPress={onConfirm}
        />

        <Text
          style={[body(11.5), { color: GREY.label, textAlign: 'center', marginTop: 12, lineHeight: 17 }]}
        >
          {t.payGatewayNote}
        </Text>
      </View>
    </BottomSheet>
  );
}
