import { router } from 'expo-router';
import { useT, useLangStore } from '../i18n';
import { templateTitle } from '../lib/format';
import { useTemplatesStore } from '../store/templatesStore';
import BottomSheet from './BottomSheet';
import TemplateGrid, { TemplateCard } from './TemplateGrid';
import { EmptyState } from './ui';

/**
 * The sheet behind the centre FAB: "pick a template" from anywhere in the app.
 *
 * Three columns rather than the hub's two — this is a shortcut, not a browse,
 * so it shows more at once and leans on the thumbnails alone.
 */
export default function TemplatePickerSheet({ open, onClose }) {
  const { t } = useT();
  const lang = useLangStore((s) => s.lang);
  const items = useTemplatesStore((s) => s.items);

  return (
    <BottomSheet open={open} title={t.pickTitle} onClose={onClose} height={0.66}>
      {items.length ? (
        <TemplateGrid
          items={items.slice(0, 24)}
          columns={3}
          gap={8}
          renderItem={(item) => (
            <TemplateCard
              key={item.id}
              title={templateTitle(item, lang)}
              thumbnail={item.thumbnail}
              imageSize={item.imageSize}
              onPress={() => {
                onClose();
                router.push(`/template/${item.id}`);
              }}
            />
          )}
        />
      ) : (
        <EmptyState title={t.noTemplates} />
      )}
    </BottomSheet>
  );
}
