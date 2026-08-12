import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { COLOR, GREY, RADIUS, body, heading } from '../constants/theme';
import { useT } from '../i18n';
import { captureImage, pickImages } from '../lib/files';
import BottomSheet from './BottomSheet';
import ModuleIcon from './icons/ModuleIcon';
import { toast } from './Toast';

/**
 * Camera or gallery, plus the photos already picked in this session.
 *
 * The design calls the third block "আগের আপলোড" / "Earlier uploads". There is no
 * API for a user's upload history — the backend keeps the *generated* image and
 * the source it was made from, not a roll of everything ever offered — so this
 * shows the photos picked during this run of the app. `recent` is passed in by
 * the caller, which is the only place that knows them.
 */
export default function PhotoSourceSheet({ open, onClose, onPicked, recent = [] }) {
  const { t } = useT();

  const run = async (source) => {
    onClose();
    try {
      if (source === 'camera') {
        const asset = await captureImage();
        if (asset) onPicked(asset);
        return;
      }
      const assets = await pickImages();
      if (assets.length) onPicked(assets[0]);
    } catch (error) {
      toast.error(error.code === 'PERMISSION_DENIED' ? t.permissionPhotos : error.message);
    }
  };

  const Row = ({ icon, label, hint, onPress }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 13,
        borderWidth: 1,
        borderColor: GREY.hairline,
        borderRadius: RADIUS.xl,
        backgroundColor: pressed ? COLOR.violet050 : COLOR.white,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: RADIUS.md,
          backgroundColor: COLOR.violet050,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ModuleIcon name={icon} size={19} color={COLOR.violet500} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[heading(13.5, '700'), { color: COLOR.ink800 }]}>{label}</Text>
        <Text style={[body(11.5), { color: GREY.label, marginTop: 2 }]}>{hint}</Text>
      </View>
    </Pressable>
  );

  return (
    <BottomSheet open={open} title={t.addPhoto} onClose={onClose} height={recent.length ? 0.5 : 0.34}>
      <View style={{ gap: 8, paddingHorizontal: 6, paddingBottom: 4 }}>
        <Row
          icon="manual-photo-edit"
          label={t.camera}
          hint={t.cameraHint}
          onPress={() => run('camera')}
        />
        <Row
          icon="easy-tools"
          label={t.gallery}
          hint={t.galleryHint}
          onPress={() => run('gallery')}
        />

        {recent.length ? (
          <>
            <Text
              style={[body(11.5, '700'), { color: GREY.label, marginTop: 10, marginHorizontal: 4 }]}
            >
              {t.recentPhotos}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 2 }}>
              {recent.slice(0, 8).map((asset) => (
                <Pressable
                  key={asset.uri}
                  onPress={() => {
                    onClose();
                    onPicked(asset);
                  }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: RADIUS.md,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: GREY.hairline,
                    backgroundColor: GREY.fill,
                  }}
                >
                  <Image
                    source={{ uri: asset.uri }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}
