import { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import BottomNav from '../../src/components/BottomNav';
import TemplatePickerSheet from '../../src/components/TemplatePickerSheet';
import { useAuthStore } from '../../src/store/authStore';
import { useCreationsStore } from '../../src/store/creationsStore';
import { useCreditStore } from '../../src/store/creditStore';
import { useOfficeSpaceStore } from '../../src/store/officeSpaceStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useTemplatesStore } from '../../src/store/templatesStore';

/**
 * The app proper: four tabs and the generate FAB between them.
 *
 * Everything the tabs share is loaded once here rather than per screen — the
 * catalogue (hub, favourites and the picker all read it), the office space
 * (which shop a generate bills), the balance, and the first page of creations.
 * Loading at the gate is what lets each screen render a real state instead of a
 * half-usable one while it waits for its own request.
 */
export default function TabsLayout() {
  const onboarded = useSettingsStore((s) => s.onboarded);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const loadTemplates = useTemplatesStore((s) => s.load);
  const fetchOfficeSpaces = useOfficeSpaceStore((s) => s.fetch);
  const officeSpaceId = useOfficeSpaceStore((s) => s.selected?.id ?? null);
  const refreshCredits = useCreditStore((s) => s.refresh);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const refreshCreations = useCreationsStore((s) => s.refresh);

  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadTemplates();
    refreshCredits();
    refreshUser();
    // Creations are scoped to the shop the images were billed to, so they wait
    // for the office-space list to resolve rather than firing beside it.
    fetchOfficeSpaces()
      .catch(() => {})
      .finally(() => refreshCreations(useOfficeSpaceStore.getState().selected?.id));
  }, [
    isAuthenticated,
    loadTemplates,
    fetchOfficeSpaces,
    refreshCredits,
    refreshUser,
    refreshCreations,
  ]);

  // Re-scope the creations feed when the shop changes on the profile screen.
  useEffect(() => {
    if (isAuthenticated && officeSpaceId != null) refreshCreations(officeSpaceId);
  }, [isAuthenticated, officeSpaceId, refreshCreations]);

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <BottomNav {...props} onFabPress={() => setPickerOpen(true)} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="creations" />
        <Tabs.Screen name="favourites" />
        <Tabs.Screen name="profile" />
      </Tabs>

      <TemplatePickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
}
