import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import AppHeader from '../../src/components/AppHeader';
import ResultView, { resultTitleFor } from '../../src/components/ResultView';
import { ErrorState, Loading, Screen } from '../../src/components/ui';
import { useLangStore, useT } from '../../src/i18n';
import imageGenerationService from '../../src/services/imageGenerationService';
import { templateIdOf, useCreationsStore } from '../../src/store/creationsStore';
import { useTemplatesStore } from '../../src/store/templatesStore';

/**
 * An older result, opened from the creations tab.
 *
 * The list row already carries everything the view needs, so it paints from the
 * store first and only calls `GET /api/image-generation/:id` when the id was not
 * in the list — a deep link, or a row that has since scrolled out of the cached
 * page.
 *
 * `id` is the API's opaque, source-tagged reference (`t123` for a template
 * image), not a bare row id. It is passed through untouched.
 */
export default function ResultRoute() {
  const { id } = useLocalSearchParams();
  const { t } = useT();
  const lang = useLangStore((s) => s.lang);

  const fromList = useCreationsStore((s) =>
    s.items.find((item) => String(item.id) === String(id))
  );
  const byId = useTemplatesStore((s) => s.byId);

  const [record, setRecord] = useState(fromList || null);
  const [status, setStatus] = useState(fromList ? 'ready' : 'loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (fromList) {
      setRecord(fromList);
      setStatus('ready');
      return undefined;
    }
    let cancelled = false;
    imageGenerationService
      .get(id)
      .then((res) => {
        if (cancelled) return;
        setRecord(res?.data || null);
        setStatus(res?.data ? 'ready' : 'error');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || t.loadFailed);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id, fromList, t.loadFailed]);

  if (status === 'loading') {
    return (
      <Screen>
        <AppHeader title="" showBack />
        <Loading />
      </Screen>
    );
  }

  if (status === 'error' || !record) {
    return (
      <Screen>
        <AppHeader title="" showBack />
        <ErrorState message={error || t.loadFailed} />
      </Screen>
    );
  }

  const template = byId(templateIdOf(record));

  return (
    <ResultView
      title={resultTitleFor(template, record, lang)}
      template={template}
      result={record}
      // No regenerate here: the photos that made this image are gone, and
      // re-running the template would need them picked again — which is the
      // template screen, one tap away through "another template".
      onRegenerate={null}
    />
  );
}
